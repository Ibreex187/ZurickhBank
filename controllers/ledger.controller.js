const mongoose = require("mongoose");
const LedgerEntryModel = require("../models/ledger.entry.model");

const allowedAccountTypes = ["user_main", "user_savings"];
const allowedReferenceTypes = ["transaction", "savings_transaction", "investment_trade"];

const getDateRange = (startDate, endDate) => {
    const range = {};

    if (startDate) {
        range.$gte = new Date(startDate);
    }

    if (endDate) {
        range.$lte = new Date(endDate);
    }

    return Object.keys(range).length ? range : null;
};

exports.getLedgerHistory = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.userId);
        const {
            accountType,
            referenceType,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        const parsedPage = Math.max(Number(page) || 1, 1);
        const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
        const skip = (parsedPage - 1) * parsedLimit;

        const filter = {
            userId,
            accountType: { $in: allowedAccountTypes }
        };

        if (accountType && allowedAccountTypes.includes(accountType)) {
            filter.accountType = accountType;
        }

        if (referenceType && allowedReferenceTypes.includes(referenceType)) {
            filter.referenceType = referenceType;
        }

        const createdAtRange = getDateRange(startDate, endDate);
        if (createdAtRange) {
            filter.createdAt = createdAtRange;
        }

        const [entries, total] = await Promise.all([
            LedgerEntryModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean(),
            LedgerEntryModel.countDocuments(filter)
        ]);

        return res.status(200).send({
            success: true,
            message: "Ledger history retrieved successfully",
            data: {
                entries,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total,
                    totalPages: Math.ceil(total / parsedLimit),
                    hasNextPage: parsedPage * parsedLimit < total,
                    hasPrevPage: parsedPage > 1
                }
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error retrieving ledger history"
        });
    }
};

exports.getAccountStatement = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.userId);
        const {
            accountType,
            startDate,
            endDate
        } = req.query;

        const targetAccountTypes = accountType && allowedAccountTypes.includes(accountType)
            ? [accountType]
            : allowedAccountTypes;

        const periodRange = getDateRange(startDate, endDate);
        const periodFilter = {
            userId,
            accountType: { $in: targetAccountTypes }
        };

        if (periodRange) {
            periodFilter.createdAt = periodRange;
        }

        const openingCutoff = startDate ? new Date(startDate) : null;

        const [periodEntries, openingBalancesAgg] = await Promise.all([
            LedgerEntryModel.find(periodFilter).sort({ createdAt: 1 }).lean(),
            openingCutoff
                ? LedgerEntryModel.aggregate([
                    {
                        $match: {
                            userId,
                            accountType: { $in: targetAccountTypes },
                            createdAt: { $lt: openingCutoff }
                        }
                    },
                    {
                        $group: {
                            _id: "$accountType",
                            openingBalance: { $sum: { $subtract: ["$debit", "$credit"] } }
                        }
                    }
                ])
                : Promise.resolve([])
        ]);

        const openingMap = new Map(
            openingBalancesAgg.map((item) => [item._id, item.openingBalance || 0])
        );

        const grouped = targetAccountTypes.map((type) => {
            const accountEntries = periodEntries.filter((entry) => entry.accountType === type);
            const totalDebits = accountEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
            const totalCredits = accountEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
            const openingBalance = openingMap.get(type) || 0;
            const netMovement = totalDebits - totalCredits;
            const closingBalance = openingBalance + netMovement;

            return {
                accountType: type,
                openingBalance: Math.round((openingBalance + Number.EPSILON) * 100) / 100,
                totalDebits: Math.round((totalDebits + Number.EPSILON) * 100) / 100,
                totalCredits: Math.round((totalCredits + Number.EPSILON) * 100) / 100,
                netMovement: Math.round((netMovement + Number.EPSILON) * 100) / 100,
                closingBalance: Math.round((closingBalance + Number.EPSILON) * 100) / 100,
                entryCount: accountEntries.length
            };
        });

        return res.status(200).send({
            success: true,
            message: "Account statement retrieved successfully",
            data: {
                period: {
                    startDate: startDate || null,
                    endDate: endDate || null
                },
                accounts: grouped
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error retrieving account statement"
        });
    }
};
