const mongoose = require("mongoose");

const savingsTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: "user", 
        required: true
    },
    transactionId: {
        type: String, 
        required: true,
        unique: true
    },
    type: {
        type: String, 
        enum: ['deposit', 'withdraw'], 
        required: true
    },
    amount: {
        type: Number, 
        required: true,
        min: 0.01
    },
    balanceAfter: {
        type: Number, 
        required: true
    },
    savingsBalanceAfter: {
        type: Number, 
        required: true
    },
    description: {
        type: String,
        default: function() {
            return this.type === 'deposit' ? 'Savings deposit' : 'Savings withdrawal';
        }
    },
    status: {
        type: String, 
        enum: ['pending', 'completed', 'failed'], 
        default: 'completed'
    }
}, {timestamps: true, strict: "throw"});

// Create index for efficient queries
savingsTransactionSchema.index({ userId: 1, createdAt: -1 });

const SavingsTransactionModel = mongoose.model("savingsTransaction", savingsTransactionSchema);

module.exports = SavingsTransactionModel;