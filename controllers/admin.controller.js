const TransactionModel = require("../models/transaction.model");
const UserModel = require("../models/user.model");

exports.getAllTransactions = async (req, res) => {
    try {
        const { type, status, page = 1, limit = 20 } = req.query;

        const filters = {};

        if (type) {
            filters.type = type;
        }

        if (status) {
            filters.status = status;
        }

        const parsedPage = Math.max(Number(page) || 1, 1);
        const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
        const skip = (parsedPage - 1) * parsedLimit;

        const [transactions, total] = await Promise.all([
            TransactionModel.find(filters)
                .populate("sender", "firstName lastName accountNumber email")
                .populate("receiver", "firstName lastName accountNumber email")
                .sort({ date: -1 })
                .skip(skip)
                .limit(parsedLimit),
            TransactionModel.countDocuments(filters)
        ]);

        return res.status(200).send({
            success: true,
            message: "Transactions retrieved successfully",
            data: transactions,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                totalPages: Math.ceil(total / parsedLimit)
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error retrieving transactions"
        });
    }
};

exports.getTransactionByTransactionId = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await TransactionModel.findOne({ transactionId })
            .populate("sender", "firstName lastName accountNumber email")
            .populate("receiver", "firstName lastName accountNumber email");

        if (!transaction) {
            return res.status(404).send({
                success: false,
                message: "Transaction not found"
            });
        }

        return res.status(200).send({
            success: true,
            message: "Transaction retrieved successfully",
            data: transaction
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error retrieving transaction"
        });
    }
};

exports.updateUserKycTier = async (req, res) => {
    try {
        const { userId } = req.params;
        const { kycTier } = req.body;

        const user = await UserModel.findById(userId).select("firstName lastName userName email kycTier");

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        const previousTier = user.kycTier || "unverified";
        const nextTier = String(kycTier || "").trim().toLowerCase();

        user.kycTier = nextTier;
        await user.save();

        return res.status(200).send({
            success: true,
            message: "User KYC tier updated successfully",
            data: {
                userId: user._id,
                name: `${user.firstName} ${user.lastName}`,
                userName: user.userName,
                email: user.email,
                previousTier,
                currentTier: user.kycTier
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error updating user KYC tier"
        });
    }
};

exports.listUsersByKycTier = async (req, res) => {
    try {
        const { kycTier, page = 1, limit = 20 } = req.query;

        const parsedPage = Math.max(Number(page) || 1, 1);
        const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
        const skip = (parsedPage - 1) * parsedLimit;

        const filter = {};
        if (kycTier) {
            filter.kycTier = String(kycTier).trim().toLowerCase();
        }

        const [users, total] = await Promise.all([
            UserModel.find(filter)
                .select("firstName lastName userName email kycTier balance savingsBalance createdAt")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean(),
            UserModel.countDocuments(filter)
        ]);

        const usersList = users.map(user => ({
            userId: user._id,
            name: `${user.firstName} ${user.lastName}`,
            userName: user.userName,
            email: user.email,
            kycTier: user.kycTier || "unverified",
            balance: user.balance,
            savingsBalance: user.savingsBalance,
            createdAt: user.createdAt
        }));

        return res.status(200).send({
            success: true,
            message: "Users retrieved successfully",
            data: usersList,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                totalPages: Math.ceil(total / parsedLimit),
                hasNextPage: parsedPage < Math.ceil(total / parsedLimit),
                hasPrevPage: parsedPage > 1
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error retrieving users"
        });
    }
};