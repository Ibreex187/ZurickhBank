const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware")
const validate = require('../middleware/express.validator.middleware');
const { transactionHistoryRules, dateRangeRules } = require('../validators/validation.rules');
const { getTransactionHistory, getTransactionById, getTransactionSummary } = require('../controllers/transaction.history.controller');

router.get('/history', authMiddleware, transactionHistoryRules(), validate, getTransactionHistory)
router.get('/history/summary', authMiddleware, dateRangeRules(), validate, getTransactionSummary)
router.get('/history/:transactionId', authMiddleware, getTransactionById)

module.exports = router;
