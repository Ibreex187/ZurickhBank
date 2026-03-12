const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const savingsController = require('../controllers/savings.controller');
const { body, query } = require('express-validator');
const validationMiddleware = require('../middleware/express.validator.middleware');

// Validation rules for savings deposits and withdrawals
const amountValidation = [
    body('amount')
        .isNumeric()
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number (minimum 0.01)')
        .custom((value) => {
            if (value > 1000000) {
                throw new Error('Amount cannot exceed 1,000,000');
            }
            return true;
        })
];

// Validation for quick transfer
const quickTransferValidation = [
    body('amount')
        .isNumeric()
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number (minimum 0.01)'),
    body('direction')
        .isIn(['to-savings', 'to-main'])
        .withMessage('Direction must be either "to-savings" or "to-main"')
];

// Validation for transaction history query
const historyValidation = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('type')
        .optional()
        .isIn(['deposit', 'withdraw'])
        .withMessage('Type must be either "deposit" or "withdraw"')
];

// Apply authentication middleware to all savings routes
router.use(authMiddleware);

// Deposit money to savings (from main balance)
router.post('/deposit', amountValidation, validationMiddleware, savingsController.depositToSavings);

// Withdraw money from savings (to main balance)
router.post('/withdraw', amountValidation, validationMiddleware, savingsController.withdrawFromSavings);

// Quick transfer between main and savings
router.post('/quick-transfer', quickTransferValidation, validationMiddleware, savingsController.quickTransfer);

// Get savings account overview and statistics
router.get('/overview', savingsController.getSavingsOverview);

// Get savings transaction history with pagination
router.get('/history', historyValidation, validationMiddleware, savingsController.getSavingsHistory);

// Get savings insights and recommendations
router.get('/insights', savingsController.getSavingsInsights);

module.exports = router;