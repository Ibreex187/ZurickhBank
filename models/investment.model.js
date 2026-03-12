const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: "user", 
        required: true
    },
    stockSymbol: {
        type: String, 
        required: true
    },
    stockName: {
        type: String, 
        required: true
    },
    quantity: {
        type: Number, 
        required: true,
        min: 0
    },
    purchasePrice: {
        type: Number, 
        required: true
    },
    totalInvested: {
        type: Number, 
        required: true
    },
    purchaseDate: {
        type: Date, 
        default: Date.now
    },
    status: {
        type: String, 
        enum: ['active', 'sold'], 
        default: 'active'
    }
}, {timestamps: true, strict: "throw"});

// Create index for efficient queries
investmentSchema.index({ userId: 1, stockSymbol: 1 });

const InvestmentModel = mongoose.model("investment", investmentSchema);

module.exports = InvestmentModel;