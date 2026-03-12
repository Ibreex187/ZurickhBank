const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware")
const { getTransactionHistory, getTransactionById, getTransactionSummary } = require('../controllers/transaction.history.controller');

router.get('/history', authMiddleware, getTransactionHistory)
router.get('/history/summary', authMiddleware, getTransactionSummary)
router.get('/history/:transactionId', authMiddleware, getTransactionById)

module.exports = router;