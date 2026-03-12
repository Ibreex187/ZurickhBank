const mongoose  = require("mongoose");

const UserSchema = new mongoose.Schema({
firstName: {type: String, required: true},
lastName: {type: String, required: true},
userName:{type: String, required: true, unique: true},
email: {type: String, required: true, unique: true},
password: {type: String, required: true},
accountNumber: {
    type: String,
    required: true,
    unique: true,
    match: [/^\d{10}$/, "Account number must be exactly 10 digits"]
},
balance: {type: Number, default: 99999},
savingsBalance: {type: Number, default: 0},
beneficiaries: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    roles: {type: String, enum:["user", "admin"], default:"user"}
}, {timestamps:true, strict:"throw"})

const UserModel = mongoose.model("user", UserSchema)

module.exports = UserModel