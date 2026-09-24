const UserModel = require("../models/user.model")
const TransactionModel = require("../models/transaction.model")
const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const { postJournal } = require("../utils/ledger.service");
const { createNotification } = require("../utils/notification.service");
const { assertOutgoingLimit, getOutgoingLimitSnapshot } = require("../utils/transaction.limit.service");

// Defense in depth: validators/validation.rules.js (depositRules/withdrawRules/transferRules)
// already enforces this on the route, but a controller shouldn't trust that unconditionally -
// this is what actually stopped a mistyped/unbounded amount from reaching user.balance before.
const MAX_TRANSACTION_AMOUNT = 50000000;

exports.deposit = async (req, res) => {
    const session = await mongoose.startSession();
    try {
       const parsedAmount = Number(req.body.amount)
       if(!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > MAX_TRANSACTION_AMOUNT){
        return res.status(400).send({success:false,
        message:`deposit must be greater than 0 and no more than ${MAX_TRANSACTION_AMOUNT.toLocaleString()}`})
       }

       let user;
       let transactionId;
       await session.withTransaction(async () => {
            user = await UserModel.findById(req.user.userId).session(session)
            if(!user){
                const error = new Error("User not found");
                error.statusCode = 404;
                throw error;
            }

            user.balance += parsedAmount
            await user.save({ session })

            const transaction = new TransactionModel({
                transactionId: randomUUID(),
                type:"deposit",
                amount: parsedAmount,
                sender:null, 
                receiver:user._id,
                status:"completed"
            })
            await transaction.save({ session })
            transactionId = transaction.transactionId

            await postJournal({
                session,
                referenceType: "transaction",
                referenceId: transaction.transactionId,
                description: "Main account cash deposit",
                entries: [
                    {
                        accountType: "user_main",
                        userId: user._id,
                        debit: parsedAmount
                    },
                    {
                        accountType: "system_cash_reserve",
                        credit: parsedAmount
                    }
                ]
            });

            await createNotification({
                userId: user._id,
                category: "credit",
                title: "Deposit successful",
                message: `Your account was credited with ${parsedAmount}`,
                metadata: {
                    transactionId: transaction.transactionId,
                    amount: parsedAmount,
                    type: "deposit"
                },
                session
            });
       })

        res.status(200).send({success:true, message:"Deposit successful", data:{
            balance: user.balance,
            transactionId
        }})

       

    } catch (error) {
            if (error.statusCode) {
                return res.status(error.statusCode).send({
                    success: false,
                    message: error.message,
                    ...(error.details || {})
                });
            }
        res.status(500).send({success:false,
        message:"Deposit failed"
    })
        } finally {
            await session.endSession();
    }
}


exports.withdraw = async (req, res) =>{
    const session = await mongoose.startSession();
    try {
         const parsedAmount = Number(req.body.amount)
         if(!Number.isFinite(parsedAmount) || parsedAmount <=0 || parsedAmount > MAX_TRANSACTION_AMOUNT){
            return res.status(400).send({success:false,
            message:`withdrawal must be greater than 0 and no more than ${MAX_TRANSACTION_AMOUNT.toLocaleString()}`})
           }

             await assertOutgoingLimit({
                 userId: new mongoose.Types.ObjectId(req.user.userId),
                 operation: "withdraw",
                 amount: parsedAmount
             });

           let user;
           let transactionId;
           await session.withTransaction(async () => {
                user = await UserModel.findById(req.user.userId).session(session)
                if(!user){
                    const error = new Error("User not found");
                    error.statusCode = 404;
                    throw error;
                }

                if(user.balance < parsedAmount){
                    const error = new Error("Insufficient balance");
                    error.statusCode = 400;
                    throw error;
                }

                user.balance -= parsedAmount
                await user.save({ session })

                const transaction = new TransactionModel({
                    transactionId: randomUUID(),
                    type:"withdraw",
                    amount: parsedAmount,
                    sender:user._id, 
                    receiver:null,
                    status:"completed"
                })
                await transaction.save({ session })
                transactionId = transaction.transactionId

                await postJournal({
                    session,
                    referenceType: "transaction",
                    referenceId: transaction.transactionId,
                    description: "Main account cash withdrawal",
                    entries: [
                        {
                            accountType: "system_cash_reserve",
                            debit: parsedAmount
                        },
                        {
                            accountType: "user_main",
                            userId: user._id,
                            credit: parsedAmount
                        }
                    ]
                });

                await createNotification({
                    userId: user._id,
                    category: "debit",
                    title: "Withdrawal successful",
                    message: `Your account was debited by ${parsedAmount}`,
                    metadata: {
                        transactionId: transaction.transactionId,
                        amount: parsedAmount,
                        type: "withdraw"
                    },
                    session
                });
           })

        res.status(200).send({success:true, 
            message:"Withdrawal successful", data:{
                balance: user.balance,
                transactionId
            }})

    } catch (error) {
         if (error.statusCode) {
            return res.status(error.statusCode).send({
                success: false,
                message: error.message,
                ...(error.details || {})
            });
         }
         res.status(500).send({success:false, 
        message:"Withdrawal failed"})

    } finally {
        await session.endSession();
    }
}


exports.transferFunds = async (req, res) =>{
    const session = await mongoose.startSession();
    try {
        const { receiverAccountNumber } = req.body;
        const parsedAmount = Number(req.body.amount);

        if(!Number.isFinite(parsedAmount) || parsedAmount <=0 || parsedAmount > MAX_TRANSACTION_AMOUNT || !receiverAccountNumber){
           return res.status(400).send({success:false,
           message:"invalid transfer details"})
          }

                    await assertOutgoingLimit({
                        userId: new mongoose.Types.ObjectId(req.user.userId),
                        operation: "transfer",
                        amount: parsedAmount
                    });

          let sender;
          let receiver;
          let transaction;

          await session.withTransaction(async () => {
            sender = await UserModel.findById(req.user.userId).session(session)

            if(!sender){
                const error = new Error("Sender not found");
                error.statusCode = 404;
                throw error;
            }

            if(sender.accountNumber === receiverAccountNumber){
                const error = new Error("Cannot transfer to the same account");
                error.statusCode = 400;
                throw error;
            }

            receiver = await UserModel.findOne({accountNumber: receiverAccountNumber}).session(session)

            if(!receiver){
                const error = new Error("Receiver not found");
                error.statusCode = 404;
                throw error;
            }
        
            if(sender.balance < parsedAmount){
                const error = new Error("Insufficient balance");
                error.statusCode = 400;
                throw error;
            }
            
            sender.balance -= parsedAmount
            receiver.balance += parsedAmount

            await sender.save({ session })
            await receiver.save({ session })

            transaction = new TransactionModel({
                transactionId: randomUUID(),
                type:"transfer",
                amount: parsedAmount,
                description: String(req.body.description || "").trim().slice(0, 200),
                sender: sender._id,
                receiver: receiver._id,
                status:"completed"
            })
            await transaction.save({ session })

            await postJournal({
                session,
                referenceType: "transaction",
                referenceId: transaction.transactionId,
                description: "Main account transfer",
                entries: [
                    {
                        accountType: "user_main",
                        userId: receiver._id,
                        debit: parsedAmount
                    },
                    {
                        accountType: "user_main",
                        userId: sender._id,
                        credit: parsedAmount
                    }
                ]
            });

            await createNotification({
                userId: sender._id,
                category: "transfer",
                title: "Transfer sent",
                message: `You sent ${parsedAmount} to ${receiver.firstName} ${receiver.lastName}`,
                metadata: {
                    transactionId: transaction.transactionId,
                    amount: parsedAmount,
                    direction: "outgoing",
                    accountNumber: receiver.accountNumber
                },
                session
            });

            await createNotification({
                userId: receiver._id,
                category: "transfer",
                title: "Transfer received",
                message: `You received ${parsedAmount} from ${sender.firstName} ${sender.lastName}`,
                metadata: {
                    transactionId: transaction.transactionId,
                    amount: parsedAmount,
                    direction: "incoming",
                    accountNumber: sender.accountNumber
                },
                session
            });
          })

        return res.status(200).send({success:true, 
        message:"Transfer successful",
        data: {
            transactionId: transaction.transactionId,
            newBalance: sender.balance,
            amount: parsedAmount,
            recipient: {
                name: `${receiver.firstName} ${receiver.lastName}`,
                accountNumber: receiver.accountNumber
            }
        }})

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).send({
                success: false,
                message: error.message,
                ...(error.details || {})
            });
        }
        return res.status(500).send({success:false, 
        message:"Transfer failed"})
    } finally {
        await session.endSession();
    }
}

exports.getTransferRecipient = async (req, res) => {
    try {
        const normalizedAccountNumber = String(req.query.accountNumber || "").trim();

        if (!normalizedAccountNumber) {
            return res.status(400).send({
                success: false,
                message: "Account number is required"
            });
        }

        const sender = await UserModel.findById(req.user.userId).select("accountNumber");
        if (!sender) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        if (sender.accountNumber === normalizedAccountNumber) {
            return res.status(400).send({
                success: false,
                message: "Cannot transfer to the same account"
            });
        }

        const recipient = await UserModel.findOne({ accountNumber: normalizedAccountNumber })
            .select("firstName lastName accountNumber");

        if (!recipient) {
            return res.status(404).send({
                success: false,
                message: "Recipient not found"
            });
        }

        return res.status(200).send({
            success: true,
            message: "Recipient found",
            data: {
                name: `${recipient.firstName} ${recipient.lastName}`,
                accountNumber: recipient.accountNumber
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error fetching recipient details"
        });
    }
}

exports.getOutgoingLimits = async (req, res) => {
    try {
        const requestedOperation = String(req.query.operation || "").trim().toLowerCase();
        const operation = requestedOperation || undefined;

        const data = await getOutgoingLimitSnapshot({
            userId: new mongoose.Types.ObjectId(req.user.userId),
            operation
        });

        return res.status(200).send({
            success: true,
            message: "Transaction limits retrieved successfully",
            data
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).send({
                success: false,
                message: error.message,
                ...(error.details || {})
            });
        }

        return res.status(500).send({
            success: false,
            message: "Failed to fetch transaction limits"
        });
    }
}
