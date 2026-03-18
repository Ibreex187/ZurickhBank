const express = require('express')
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware")
const { depositRules, withdrawRules, transferRules, transferRecipientLookupRules, transactionLimitsRules } = require('../validators/validation.rules')
const validate = require('../middleware/express.validator.middleware');
const { requireTransactionPin } = require('../middleware/transaction.pin.middleware');
const {deposit, withdraw, transferFunds, getTransferRecipient, getOutgoingLimits} = require("../controllers/transaction.controller")

router.post('/transactions/deposit', authMiddleware, depositRules(), validate, requireTransactionPin, deposit)
router.post('/transactions/withdraw', authMiddleware, withdrawRules(), validate, requireTransactionPin, withdraw)
router.get('/transactions/limits', authMiddleware, transactionLimitsRules(), validate, getOutgoingLimits)
router.get('/transactions/recipient', authMiddleware, transferRecipientLookupRules(), validate, getTransferRecipient)
router.post('/transactions/transfer', authMiddleware, transferRules(), validate, requireTransactionPin, transferFunds)



module.exports = router;