const TransactionModel = require("../models/transaction.model");
const SavingsTransactionModel = require("../models/savings.transaction.model");
const UserModel = require("../models/user.model");

const SUPPORTED_TIERS = ["unverified", "tier1", "tier2", "tier3"];

const DEFAULT_TIER_LIMITS = {
    unverified: {
        withdrawDaily: 50,
        withdrawMonthly: 300,
        transferDaily: 100,
        transferMonthly: 500
    },
    tier1: {
        withdrawDaily: 200,
        withdrawMonthly: 2000,
        transferDaily: 500,
        transferMonthly: 5000
    },
    tier2: {
        withdrawDaily: 500,
        withdrawMonthly: 5000,
        transferDaily: 1000,
        transferMonthly: 12000
    },
    tier3: {
        withdrawDaily: 1000,
        withdrawMonthly: 15000,
        transferDaily: 3000,
        transferMonthly: 30000
    }
};

const parseLimit = (rawValue, fallback) => {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeTier = (tier) => {
    const normalized = String(tier || "").trim().toLowerCase();
    return SUPPORTED_TIERS.includes(normalized) ? normalized : "unverified";
};

const readLimitWithFallback = ({ tier, operation, period, tierDefault }) => {
    const tierEnvKey = `${tier.toUpperCase()}_${operation.toUpperCase()}_${period.toUpperCase()}_LIMIT`;
    const globalEnvKey = `${operation.toUpperCase()}_${period.toUpperCase()}_LIMIT`;

    const globalFallback = parseLimit(process.env[globalEnvKey], tierDefault);
    return parseLimit(process.env[tierEnvKey], globalFallback);
};

const buildTierLimits = (tier) => {
    const resolvedTier = normalizeTier(tier);
    const defaults = DEFAULT_TIER_LIMITS[resolvedTier];

    return {
        tier: resolvedTier,
        withdrawDaily: readLimitWithFallback({ tier: resolvedTier, operation: "withdraw", period: "daily", tierDefault: defaults.withdrawDaily }),
        withdrawMonthly: readLimitWithFallback({ tier: resolvedTier, operation: "withdraw", period: "monthly", tierDefault: defaults.withdrawMonthly }),
        transferDaily: readLimitWithFallback({ tier: resolvedTier, operation: "transfer", period: "daily", tierDefault: defaults.transferDaily }),
        transferMonthly: readLimitWithFallback({ tier: resolvedTier, operation: "transfer", period: "monthly", tierDefault: defaults.transferMonthly })
    };
};

const getUtcDayStart = (referenceDate = new Date()) => {
    return new Date(Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate(),
        0, 0, 0, 0
    ));
};

const getUtcMonthStart = (referenceDate = new Date()) => {
    return new Date(Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        1,
        0, 0, 0, 0
    ));
};

const sumMainTransactions = async ({ userId, type, fromDate }) => {
    const rows = await TransactionModel.aggregate([
        {
            $match: {
                sender: userId,
                type,
                status: "completed",
                createdAt: { $gte: fromDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$amount" }
            }
        }
    ]);

    return rows[0]?.total || 0;
};

const sumSavingsWithdrawals = async ({ userId, fromDate }) => {
    const rows = await SavingsTransactionModel.aggregate([
        {
            $match: {
                userId,
                type: "withdraw",
                status: "completed",
                createdAt: { $gte: fromDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$amount" }
            }
        }
    ]);

    return rows[0]?.total || 0;
};

const getUsedAmount = async ({ userId, operation, fromDate }) => {
    if (operation === "transfer") {
        return sumMainTransactions({ userId, type: "transfer", fromDate });
    }

    const [mainWithdrawals, savingsWithdrawals] = await Promise.all([
        sumMainTransactions({ userId, type: "withdraw", fromDate }),
        sumSavingsWithdrawals({ userId, fromDate })
    ]);

    return mainWithdrawals + savingsWithdrawals;
};

const resolveUserTier = async ({ userId, tier }) => {
    if (tier) {
        return normalizeTier(tier);
    }

    const user = await UserModel.findById(userId).select("kycTier").lean();
    if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    return normalizeTier(user.kycTier);
};

const buildOperationStatus = async ({ userId, operation, limits, now }) => {
    const isTransfer = operation === "transfer";
    const dailyLimit = isTransfer ? limits.transferDaily : limits.withdrawDaily;
    const monthlyLimit = isTransfer ? limits.transferMonthly : limits.withdrawMonthly;

    const [dailyUsed, monthlyUsed] = await Promise.all([
        getUsedAmount({ userId, operation, fromDate: getUtcDayStart(now) }),
        getUsedAmount({ userId, operation, fromDate: getUtcMonthStart(now) })
    ]);

    return {
        operation,
        daily: {
            limit: dailyLimit,
            used: dailyUsed,
            remaining: Math.max(0, dailyLimit - dailyUsed)
        },
        monthly: {
            limit: monthlyLimit,
            used: monthlyUsed,
            remaining: Math.max(0, monthlyLimit - monthlyUsed)
        }
    };
};

const getOutgoingLimitSnapshot = async ({ userId, tier, operation }) => {
    const resolvedTier = await resolveUserTier({ userId, tier });
    const limits = buildTierLimits(resolvedTier);
    const now = new Date();

    const operations = operation ? [operation] : ["withdraw", "transfer"];
    const operationStatuses = await Promise.all(
        operations.map((item) => buildOperationStatus({ userId, operation: item, limits, now }))
    );

    const statusByOperation = operationStatuses.reduce((acc, item) => {
        acc[item.operation] = {
            daily: item.daily,
            monthly: item.monthly
        };
        return acc;
    }, {});

    return {
        tier: resolvedTier,
        asOf: now.toISOString(),
        operations: statusByOperation
    };
};

const assertOutgoingLimit = async ({ userId, operation, amount, tier }) => {
    const resolvedTier = await resolveUserTier({ userId, tier });
    const limits = buildTierLimits(resolvedTier);
    const now = new Date();

    const isTransfer = operation === "transfer";
    const dailyLimit = isTransfer ? limits.transferDaily : limits.withdrawDaily;
    const monthlyLimit = isTransfer ? limits.transferMonthly : limits.withdrawMonthly;

    const [dailyUsed, monthlyUsed] = await Promise.all([
        getUsedAmount({ userId, operation, fromDate: getUtcDayStart(now) }),
        getUsedAmount({ userId, operation, fromDate: getUtcMonthStart(now) })
    ]);

    const nextDailyTotal = dailyUsed + amount;
    if (nextDailyTotal > dailyLimit) {
        const error = new Error(`Daily ${operation} limit exceeded`);
        error.statusCode = 429;
        error.details = {
            period: "daily",
            operation,
            tier: resolvedTier,
            limit: dailyLimit,
            used: dailyUsed,
            remaining: Math.max(0, dailyLimit - dailyUsed),
            remainingDaily: Math.max(0, dailyLimit - dailyUsed),
            remainingMonthly: Math.max(0, monthlyLimit - monthlyUsed),
            attemptedAmount: amount
        };
        throw error;
    }

    const nextMonthlyTotal = monthlyUsed + amount;
    if (nextMonthlyTotal > monthlyLimit) {
        const error = new Error(`Monthly ${operation} limit exceeded`);
        error.statusCode = 429;
        error.details = {
            period: "monthly",
            operation,
            tier: resolvedTier,
            limit: monthlyLimit,
            used: monthlyUsed,
            remaining: Math.max(0, monthlyLimit - monthlyUsed),
            remainingDaily: Math.max(0, dailyLimit - dailyUsed),
            remainingMonthly: Math.max(0, monthlyLimit - monthlyUsed),
            attemptedAmount: amount
        };
        throw error;
    }
};

module.exports = {
    assertOutgoingLimit,
    getOutgoingLimitSnapshot
};
