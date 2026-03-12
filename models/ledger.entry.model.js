const mongoose = require("mongoose");

const ledgerEntrySchema = new mongoose.Schema({
    journalId: {
        type: String,
        required: true,
        index: true
    },
    referenceType: {
        type: String,
        enum: ["transaction", "savings_transaction", "investment_trade"],
        required: true,
        index: true
    },
    referenceId: {
        type: String,
        required: true,
        index: true
    },
    description: {
        type: String,
        required: true
    },
    accountType: {
        type: String,
        enum: ["user_main", "user_savings", "system_cash_reserve", "system_investment_reserve"],
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
        index: true
    },
    debit: {
        type: Number,
        default: 0,
        min: 0
    },
    credit: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        default: "NGN"
    },
    metadata: {
        type: Object,
        default: {}
    }
}, { timestamps: true, strict: "throw" });

ledgerEntrySchema.index({ referenceType: 1, referenceId: 1 });
ledgerEntrySchema.index({ userId: 1, createdAt: -1 });
ledgerEntrySchema.index({ accountType: 1, createdAt: -1 });

const LedgerEntryModel = mongoose.model("ledgerEntry", ledgerEntrySchema);

module.exports = LedgerEntryModel;
