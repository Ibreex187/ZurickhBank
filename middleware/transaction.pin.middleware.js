const bcrypt = require("bcrypt");
const UserModel = require("../models/user.model");

const requireTransactionPin = async (req, res, next) => {
    try {
        const providedPin = String(req.body.transactionPin || "").trim();

        if (!providedPin) {
            return res.status(400).send({
                success: false,
                message: "Transaction PIN is required"
            });
        }

        const user = await UserModel.findById(req.user.userId).select("transactionPinHash");

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        if (!user.transactionPinHash) {
            return res.status(403).send({
                success: false,
                message: "Transaction PIN not set. Please set your transaction PIN first"
            });
        }

        const isPinValid = await bcrypt.compare(providedPin, user.transactionPinHash);

        if (!isPinValid) {
            return res.status(401).send({
                success: false,
                message: "Invalid transaction PIN"
            });
        }

        next();
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error verifying transaction PIN"
        });
    }
};

module.exports = { requireTransactionPin };
