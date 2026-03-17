const mongoose = require("mongoose");

const NotificationPreferenceSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, unique: true, index: true },
        emailByCategory: {
            debit: { type: Boolean, default: true },
            credit: { type: Boolean, default: true },
            transfer: { type: Boolean, default: true },
            security: { type: Boolean, default: true }
        }
    },
    { timestamps: true, strict: "throw" }
);

const NotificationPreferenceModel = mongoose.model("notificationPreference", NotificationPreferenceSchema);

module.exports = NotificationPreferenceModel;
