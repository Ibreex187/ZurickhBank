const UserModel = require("../models/user.model");
const SavingsTransactionModel = require("../models/savings.transaction.model");
const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const { postJournal } = require("../utils/ledger.service");
const { assertOutgoingLimit } = require("../utils/transaction.limit.service");

// Deposit money to savings (from main balance)
exports.depositToSavings = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const parsedAmount = Number(req.body.amount);
        const userId = req.user.userId;

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).send({
                success: false,
                message: "Valid amount is required (must be greater than 0)"
            });
        }

        let transactionId;
        let newBalance;
        let newSavingsBalance;
        let transactionDate;

        await session.withTransaction(async () => {
            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                const error = new Error("User not found");
                error.statusCode = 404;
                throw error;
            }

            if (user.balance < parsedAmount) {
                const error = new Error("Insufficient balance in main account");
                error.statusCode = 400;
                error.details = {
                    required: parsedAmount,
                    available: user.balance
                };
                throw error;
            }

            transactionId = `SAV_DEP_${randomUUID()}`;
            newBalance = user.balance - parsedAmount;
            newSavingsBalance = user.savingsBalance + parsedAmount;

            user.balance = newBalance;
            user.savingsBalance = newSavingsBalance;
            await user.save({ session });

            const transaction = new SavingsTransactionModel({
                userId,
                transactionId,
                type: 'deposit',
                amount: parsedAmount,
                balanceAfter: newBalance,
                savingsBalanceAfter: newSavingsBalance
            });
            await transaction.save({ session });
            transactionDate = transaction.createdAt;

            await postJournal({
                session,
                referenceType: "savings_transaction",
                referenceId: transactionId,
                description: "Transfer from main balance to savings balance",
                entries: [
                    {
                        accountType: "user_savings",
                        userId,
                        debit: parsedAmount
                    },
                    {
                        accountType: "user_main",
                        userId,
                        credit: parsedAmount
                    }
                ]
            });
        });

        res.status(200).send({
            success: true,
            message: "Money deposited to savings successfully",
            data: {
                transactionId,
                amount: parsedAmount,
                mainBalance: newBalance,
                savingsBalance: newSavingsBalance,
                transactionDate
            }
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).send({
                success: false,
                message: error.message,
                ...(error.details || {})
            });
        }
        res.status(500).send({
            success: false,
            message: "Error depositing to savings"
        });
    } finally {
        await session.endSession();
    }
};

// Withdraw money from savings (to main balance)
exports.withdrawFromSavings = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const parsedAmount = Number(req.body.amount);
        const userId = req.user.userId;

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).send({
                success: false,
                message: "Valid amount is required (must be greater than 0)"
            });
        }

        await assertOutgoingLimit({
            userId: new mongoose.Types.ObjectId(userId),
            operation: "withdraw",
            amount: parsedAmount
        });

        let transactionId;
        let newBalance;
        let newSavingsBalance;
        let transactionDate;

        await session.withTransaction(async () => {
            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                const error = new Error("User not found");
                error.statusCode = 404;
                throw error;
            }

            if (user.savingsBalance < parsedAmount) {
                const error = new Error("Insufficient balance in savings account");
                error.statusCode = 400;
                error.details = {
                    required: parsedAmount,
                    available: user.savingsBalance
                };
                throw error;
            }

            transactionId = `SAV_WITH_${randomUUID()}`;
            newBalance = user.balance + parsedAmount;
            newSavingsBalance = user.savingsBalance - parsedAmount;

            user.balance = newBalance;
            user.savingsBalance = newSavingsBalance;
            await user.save({ session });

            const transaction = new SavingsTransactionModel({
                userId,
                transactionId,
                type: 'withdraw',
                amount: parsedAmount,
                balanceAfter: newBalance,
                savingsBalanceAfter: newSavingsBalance
            });
            await transaction.save({ session });
            transactionDate = transaction.createdAt;

            await postJournal({
                session,
                referenceType: "savings_transaction",
                referenceId: transactionId,
                description: "Transfer from savings balance to main balance",
                entries: [
                    {
                        accountType: "user_main",
                        userId,
                        debit: parsedAmount
                    },
                    {
                        accountType: "user_savings",
                        userId,
                        credit: parsedAmount
                    }
                ]
            });
        });

        res.status(200).send({
            success: true,
            message: "Money withdrawn from savings successfully",
            data: {
                transactionId,
                amount: parsedAmount,
                mainBalance: newBalance,
                savingsBalance: newSavingsBalance,
                transactionDate
            }
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).send({
                success: false,
                message: error.message,
                ...(error.details || {})
            });
        }
        res.status(500).send({
            success: false,
            message: "Error withdrawing from savings"
        });
    } finally {
        await session.endSession();
    }
};

// Get savings account overview
exports.getSavingsOverview = async (req, res) => {
    try {
        const userId = req.user.userId;
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Find user
        const user = await UserModel.findById(userId).select('firstName lastName accountNumber balance savingsBalance');
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // Get recent transactions count
        const recentTransactionsCount = await SavingsTransactionModel.countDocuments({ userId: userObjectId });
        
        // Get total deposited and withdrawn amounts
        const depositStats = await SavingsTransactionModel.aggregate([
            { $match: { userId: userObjectId, type: 'deposit' } },
            { $group: { _id: null, totalDeposits: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);

        const withdrawStats = await SavingsTransactionModel.aggregate([
            { $match: { userId: userObjectId, type: 'withdraw' } },
            { $group: { _id: null, totalWithdraws: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);

        const totalDeposited = depositStats[0]?.totalDeposits || 0;
        const totalWithdrawn = withdrawStats[0]?.totalWithdraws || 0;
        const depositCount = depositStats[0]?.count || 0;
        const withdrawCount = withdrawStats[0]?.count || 0;

        res.status(200).send({
            success: true,
            message: "Savings overview retrieved successfully",
            data: {
                accountInfo: {
                    name: `${user.firstName} ${user.lastName}`,
                    accountNumber: user.accountNumber
                },
                balances: {
                    mainBalance: user.balance,
                    savingsBalance: user.savingsBalance,
                    totalBalance: user.balance + user.savingsBalance
                },
                statistics: {
                    totalDeposited,
                    totalWithdrawn,
                    netSavings: totalDeposited - totalWithdrawn,
                    totalTransactions: recentTransactionsCount,
                    deposits: depositCount,
                    withdrawals: withdrawCount
                }
            }
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving savings overview"
        });
    }
};

// Get savings transaction history
exports.getSavingsHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const { limit = 20, page = 1, type } = req.query;

        // Build query filter
        const filter = { userId: userObjectId };
        if (type && ['deposit', 'withdraw'].includes(type)) {
            filter.type = type;
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Get transactions with pagination
        const transactions = await SavingsTransactionModel.find(filter)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(skip)
            .lean();

        // Get total count for pagination info
        const totalTransactions = await SavingsTransactionModel.countDocuments(filter);
        const totalPages = Math.ceil(totalTransactions / limit);

        res.status(200).send({
            success: true,
            message: "Savings transaction history retrieved successfully",
            data: {
                transactions,
                pagination: {
                    currentPage: Number(page),
                    totalPages,
                    totalTransactions,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving savings transaction history"
        });
    }
};

// Transfer between main and savings (quick transfer)
exports.quickTransfer = async (req, res) => {
    try {
        const { amount, direction } = req.body; // direction: 'to-savings' or 'to-main'
        const userId = req.user.userId;

        if (!amount || amount <= 0) {
            return res.status(400).send({
                success: false,
                message: "Valid amount is required"
            });
        }

        if (!direction || !['to-savings', 'to-main'].includes(direction)) {
            return res.status(400).send({
                success: false,
                message: "Valid direction is required ('to-savings' or 'to-main')"
            });
        }

        // Route to appropriate function based on direction
        if (direction === 'to-savings') {
            req.body = { amount }; // Format for depositToSavings
            return exports.depositToSavings(req, res);
        } else {
            req.body = { amount }; // Format for withdrawFromSavings
            return exports.withdrawFromSavings(req, res);
        }

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error processing quick transfer"
        });
    }
};

// Get savings goals and recommendations
exports.getSavingsInsights = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // Calculate savings rate and recommendations
        const totalWealth = user.balance + user.savingsBalance;
        const savingsPercentage = totalWealth > 0 ? (user.savingsBalance / totalWealth) * 100 : 0;

        // Generate recommendations based on savings percentage
        let recommendations = [];
        let savingsHealthStatus = "Good";

        if (savingsPercentage < 10) {
            savingsHealthStatus = "Needs Attention";
            recommendations.push("Consider saving at least 10-20% of your total balance");
            recommendations.push("Start with small, regular deposits to build a habit");
        } else if (savingsPercentage < 20) {
            savingsHealthStatus = "Fair";
            recommendations.push("You're on the right track! Try to increase your savings rate");
            recommendations.push("Consider setting up automatic transfers to savings");
        } else if (savingsPercentage >= 50) {
            savingsHealthStatus = "Excellent";
            recommendations.push("Amazing savings rate! Consider investment opportunities");
            recommendations.push("You might want to keep some funds accessible in main balance");
        } else {
            savingsHealthStatus = "Good";
            recommendations.push("Great savings habit! Keep it up");
            recommendations.push("Consider diversifying with investments for long-term growth");
        }

        // Calculate suggested monthly savings (10% of current total)
        const suggestedMonthlySavings = Math.round(totalWealth * 0.1);

        res.status(200).send({
            success: true,
            message: "Savings insights retrieved successfully",
            data: {
                currentStatus: {
                    savingsPercentage: Math.round(savingsPercentage * 100) / 100,
                    savingsHealthStatus,
                    totalWealth
                },
                recommendations,
                suggestions: {
                    monthlySavingsTarget: suggestedMonthlySavings,
                    emergencyFundTarget: Math.round(totalWealth * 0.25), // 25% emergency fund
                    nextMilestone: {
                        amount: Math.ceil(user.savingsBalance / 1000) * 1000 + 1000,
                        description: "Next 1K milestone"
                    }
                }
            }
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving savings insights"
        });
    }
};