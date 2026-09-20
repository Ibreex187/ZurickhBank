const TransactionModel = require("../models/transaction.model")
const mongoose = require('mongoose')
const { parsePagination, escapeRegex } = require('../utils/pagination')

exports.getTransactionHistory = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.userId);
        
        // Pagination parameters (bounded: at most 100 rows per request)
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
        
        // Date range filtering
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        // Search parameter
        const search = req.query.search;
        const searchBy = req.query.searchBy || 'recipient'; // recipient, transactionId, amount
        
        // Base query - user must be sender or receiver
        let baseQuery = {
            $or: [
                { sender: userId },
                { receiver: userId }
            ]
        };
        
        // Add date range filter
        if (startDate || endDate) {
            baseQuery.date = {};
            if (startDate) {
                baseQuery.date.$gte = new Date(startDate);
            }
            if (endDate) {
                baseQuery.date.$lte = new Date(endDate);
            }
        }
        
        // Add transaction type filter
        if (req.query.type && ['deposit', 'withdraw', 'transfer'].includes(req.query.type)) {
            baseQuery.type = req.query.type;
        }
        
        // Add amount range filter
        if (req.query.minAmount || req.query.maxAmount) {
            baseQuery.amount = {};
            if (req.query.minAmount) {
                baseQuery.amount.$gte = parseFloat(req.query.minAmount);
            }
            if (req.query.maxAmount) {
                baseQuery.amount.$lte = parseFloat(req.query.maxAmount);
            }
        }
        
        // Build aggregation pipeline for search functionality
        let pipeline = [
            { $match: baseQuery },
            {
                $lookup: {
                    from: 'users',
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'senderInfo'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'receiver',
                    foreignField: '_id',
                    as: 'receiverInfo'
                }
            }
        ];
        
        // Add search filter
        if (search) {
            // Case-insensitive, literal match: user text must not be treated as a regex pattern
            const searchRegex = new RegExp(escapeRegex(search), 'i');
            
            let searchConditions = [];
            
            if (searchBy === 'recipient' || searchBy === 'all') {
                searchConditions.push(
                    { 'senderInfo.firstName': searchRegex },
                    { 'senderInfo.lastName': searchRegex },
                    { 'senderInfo.accountNumber': searchRegex },
                    { 'receiverInfo.firstName': searchRegex },
                    { 'receiverInfo.lastName': searchRegex },
                    { 'receiverInfo.accountNumber': searchRegex }
                );
            }
            
            if (searchBy === 'transactionId' || searchBy === 'all') {
                searchConditions.push({ transactionId: searchRegex });
            }
            
            if (searchBy === 'amount' || searchBy === 'all') {
                const searchAmount = parseFloat(search);
                if (!isNaN(searchAmount)) {
                    searchConditions.push({ amount: searchAmount });
                }
            }
            
            if (searchConditions.length > 0) {
                pipeline.push({ $match: { $or: searchConditions } });
            }
        }
        
        // Add sorting, pagination, and field selection
        pipeline.push(
            { $sort: { date: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    transactionId: 1,
                    type: 1,
                    amount: 1,
                    status: 1,
                    date: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    sender: {
                        $arrayElemAt: ['$senderInfo', 0]
                    },
                    receiver: {
                        $arrayElemAt: ['$receiverInfo', 0]
                    }
                }
            },
            {
                $project: {
                    transactionId: 1,
                    type: 1,
                    amount: 1,
                    status: 1,
                    date: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    'sender._id': 1,
                    'sender.firstName': 1,
                    'sender.lastName': 1,
                    'sender.accountNumber': 1,
                    'receiver._id': 1,
                    'receiver.firstName': 1,
                    'receiver.lastName': 1,
                    'receiver.accountNumber': 1
                }
            }
        );
        
        // Execute the aggregation
        const transactions = await TransactionModel.aggregate(pipeline);
        
        // Get total count for pagination
        const totalCountPipeline = [
            { $match: baseQuery },
            {
                $lookup: {
                    from: 'users',
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'senderInfo'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'receiver',
                    foreignField: '_id',
                    as: 'receiverInfo'
                }
            }
        ];
        
        // Add search filter for count if search exists
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            let searchConditions = [];
            
            if (searchBy === 'recipient' || searchBy === 'all') {
                searchConditions.push(
                    { 'senderInfo.firstName': searchRegex },
                    { 'senderInfo.lastName': searchRegex },
                    { 'senderInfo.accountNumber': searchRegex },
                    { 'receiverInfo.firstName': searchRegex },
                    { 'receiverInfo.lastName': searchRegex },
                    { 'receiverInfo.accountNumber': searchRegex }
                );
            }
            
            if (searchBy === 'transactionId' || searchBy === 'all') {
                searchConditions.push({ transactionId: searchRegex });
            }
            
            if (searchBy === 'amount' || searchBy === 'all') {
                const searchAmount = parseFloat(search);
                if (!isNaN(searchAmount)) {
                    searchConditions.push({ amount: searchAmount });
                }
            }
            
            if (searchConditions.length > 0) {
                totalCountPipeline.push({ $match: { $or: searchConditions } });
            }
        }
        
        totalCountPipeline.push({ $count: "total" });
        
        const countResult = await TransactionModel.aggregate(totalCountPipeline);
        const totalTransactions = countResult.length > 0 ? countResult[0].total : 0;
        const totalPages = Math.ceil(totalTransactions / limit);
        
        if (!transactions || transactions.length === 0) {
            return res.status(200).send({
                success: true,
                message: "No transactions found for the given criteria",
                data: {
                    transactions: [],
                    pagination: {
                        currentPage: page,
                        totalPages: 0,
                        totalTransactions: 0,
                        hasNextPage: false,
                        hasPrevPage: false
                    }
                }
            });
        }
        
        res.status(200).send({
            success: true,
            message: "Transaction history retrieved successfully",
            data: {
                transactions,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalTransactions,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                    limit
                }
            }
        });
        
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving transaction history"
        });
    }
};

exports.getTransactionById = async(req, res) =>{
    try {
        const { transactionId } = req.params
        const userId = req.user.userId;

        const transaction = await TransactionModel.findOne({transactionId})
            .populate('sender', 'firstName lastName accountNumber')
            .populate('receiver', 'firstName lastName accountNumber')

        if(!transaction){
            return res.status(404).send({success:false,
                message:"Transaction not found"
            })
        }

        const isSender = transaction.sender && transaction.sender._id && transaction.sender._id.toString() === userId;
        const isReceiver = transaction.receiver && transaction.receiver._id && transaction.receiver._id.toString() === userId;

        if (!isSender && !isReceiver) {
            return res.status(403).send({
                success: false,
                message: "Access denied for this transaction"
            });
        }

        res.status(200).send({success:true,
            message:"Transaction retrieved successfully", data: transaction
        })

    } catch (error) {
        res.status(500).send({success:false,
            message:"Error retrieving transaction"
        })
    }
}

exports.getTransactionSummary = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.userId);
        const period = req.query.period || 'month'; // month, week, year, custom
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        let dateRange = {};
        const now = new Date();
        
        // Set date range based on period
        if (period === 'month' && !startDate && !endDate) {
            dateRange = {
                $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0)
            };
        } else if (period === 'week' && !startDate && !endDate) {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            
            dateRange = { $gte: startOfWeek, $lte: endOfWeek };
        } else if (period === 'year' && !startDate && !endDate) {
            dateRange = {
                $gte: new Date(now.getFullYear(), 0, 1),
                $lte: new Date(now.getFullYear(), 11, 31)
            };
        } else if (startDate || endDate) {
            if (startDate) dateRange.$gte = new Date(startDate);
            if (endDate) dateRange.$lte = new Date(endDate);
        }
        
        const pipeline = [
            {
                $match: {
                    $or: [{ sender: userId }, { receiver: userId }],
                    date: dateRange,
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                    transactions: { $push: '$$ROOT' }
                }
            }
        ];
        
        const summary = await TransactionModel.aggregate(pipeline);
        
        // Calculate totals
        let totalSent = 0;
        let totalReceived = 0;
        let totalDeposited = 0;
        let totalWithdrawn = 0;
        let transactionCounts = { deposit: 0, withdraw: 0, transfer: 0, sent: 0, received: 0 };
        
        for (const item of summary) {
            if (item._id === 'deposit') {
                totalDeposited = item.totalAmount;
                transactionCounts.deposit = item.count;
            } else if (item._id === 'withdraw') {
                totalWithdrawn = item.totalAmount;
                transactionCounts.withdraw = item.count;
            } else if (item._id === 'transfer') {
                // Separate sent vs received transfers
                for (const transaction of item.transactions) {
                    if (transaction.sender && transaction.sender.toString() === userId.toString()) {
                        totalSent += transaction.amount;
                        transactionCounts.sent += 1;
                    }
                    if (transaction.receiver && transaction.receiver.toString() === userId.toString()) {
                        totalReceived += transaction.amount;
                        transactionCounts.received += 1;
                    }
                }
                transactionCounts.transfer = item.count;
            }
        }
        
        const responseData = {
            period: period,
            dateRange: dateRange,
            summary: {
                totalDeposited,
                totalWithdrawn,
                totalSent,
                totalReceived,
                netAmount: totalDeposited + totalReceived - totalWithdrawn - totalSent
            },
            transactionCounts,
            breakdown: summary.map(item => ({
                type: item._id,
                count: item.count,
                totalAmount: item.totalAmount
            }))
        };
        
        res.status(200).send({
            success: true,
            message: "Transaction summary retrieved successfully",
            data: responseData
        });
        
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving transaction summary"
        });
    }
};