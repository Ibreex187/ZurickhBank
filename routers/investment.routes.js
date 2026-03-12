const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const investmentController = require('../controllers/investment.controller');
const { body } = require('express-validator');
const validationMiddleware = require('../middleware/express.validator.middleware');

// Validation rules for buying stocks
const buyStockValidation = [
    body('stockSymbol')
        .isString()
        .isLength({ min: 1, max: 10 })
        .withMessage('Stock symbol must be a string between 1-10 characters'),
    body('quantity')
        .isNumeric()
        .isFloat({ min: 0.001 })
        .withMessage('Quantity must be a positive number')
];

// Validation rules for selling stocks
const sellStockValidation = [
    body('stockSymbol')
        .isString()
        .isLength({ min: 1, max: 10 })
        .withMessage('Stock symbol must be a string between 1-10 characters'),
    body('quantity')
        .isNumeric()
        .isFloat({ min: 0.001 })
        .withMessage('Quantity must be a positive number')
];

// Get all available stocks (public endpoint - no auth needed)
router.get('/stocks', investmentController.getAvailableStocks);

// Get specific stock details with price history
router.get('/stocks/:symbol', investmentController.getStockDetails);

// Protected routes (require authentication)
router.use(authMiddleware);

// Buy stocks
router.post('/buy', buyStockValidation, validationMiddleware, investmentController.buyStock);

// Sell stocks
router.post('/sell', sellStockValidation, validationMiddleware, investmentController.sellStock);

// Get user's current portfolio
router.get('/portfolio', investmentController.getPortfolio);

// Get user's investment history (including sold stocks)
router.get('/history', investmentController.getInvestmentHistory);

module.exports = router;