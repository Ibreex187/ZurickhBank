const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
        category: {
            type: String,
            enum: ["debit", "credit", "transfer", "security"],
            required: true
        },
        title: { type: String, required: true, trim: true, maxlength: 120 },
        message: { type: String, required: true, trim: true, maxlength: 500 },
        isRead: { type: Boolean, default: false, index: true },
        readAt: { type: Date, default: null },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    { timestamps: true, strict: "throw" }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

const NotificationModel = mongoose.model("notification", NotificationSchema);

module.exports = NotificationModel;
