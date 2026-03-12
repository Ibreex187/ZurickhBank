const TransactionModel = require("../models/transaction.model");

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