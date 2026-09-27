const mongoose  = require("mongoose");
const { ACCOUNT_NUMBER_LENGTH } = require("../utils/bankIdentity");

const ACCOUNT_NUMBER_PATTERN = new RegExp(`^\\d{${ACCOUNT_NUMBER_LENGTH}}$`);

const UserSchema = new mongoose.Schema({
firstName: {type: String, required: true},
lastName: {type: String, required: true},
userName:{type: String, required: true, unique: true},
email: {type: String, required: true, unique: true},
password: {type: String, required: true},
transactionPinHash: { type: String, default: null, select: false },
transactionPinSetAt: { type: Date, default: null },
accountNumber: {
    type: String,
    required: true,
    unique: true,
    match: [ACCOUNT_NUMBER_PATTERN, `Account number must be exactly ${ACCOUNT_NUMBER_LENGTH} digits`]
},
balance: {type: Number, default: 100},
savingsBalance: {type: Number, default: 0},
beneficiaries: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
kycTier: { type: String, enum: ["unverified", "tier1", "tier2", "tier3"], default: "unverified" },
    roles: {type: String, enum:["user", "admin"], default:"user"}
}, {timestamps:true, strict:"throw"})

const UserModel = mongoose.model("user", UserSchema)

module.exports = UserModel