const  mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
   transactionId:{type:String, required:true},
   type:{type:String, enum:['deposit','withdraw','transfer'], required:true},
    amount:{type:Number, required:true},
    description:{type:String, trim:true, maxlength:200, default:""},
    sender:{type:mongoose.Schema.Types.ObjectId, ref:"user",},
    receiver:{type:mongoose.Schema.Types.ObjectId, ref:"user", },
    status:{type:String, enum:['pending','completed','failed'], default:'pending'}, 
    date:{type:Date, default:Date.now}
}, {timestamps:true, strict:"throw"})

const TransactionModel = mongoose.model("transaction", transactionSchema)

module.exports = TransactionModel