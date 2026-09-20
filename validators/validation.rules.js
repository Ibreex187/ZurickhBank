const { body, query, param } = require('express-validator');
const validate = require('../middleware/express.validator.middleware');
// Register validation
const registerRules = () => {
    return [
        body('firstName')
            .trim()
            .notEmpty().withMessage('First name is required')
            .isLength({ min: 2 }).withMessage('First name must be at least 2 characters')
            .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters')
            .isAlpha().withMessage('First name must contain only letters'),
        
        body('lastName')
            .trim()
            .notEmpty().withMessage('Last name is required')
            .isLength({ min: 2 }).withMessage('Last name must be at least 2 characters')
            .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters')
            .isAlpha().withMessage('Last name must contain only letters'),
        
        body('userName')
            .trim()
            .notEmpty().withMessage('Username is required')
            .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
            .isLength({ max: 30 }).withMessage('Username cannot exceed 30 characters')
            .isAlphanumeric().withMessage('Username must contain only alphanumeric characters'),
        
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Email must be valid'),
            
        
        body('password')
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
            .isLength({ max: 30 }).withMessage('Password cannot exceed 30 characters')
    ];
};

// Login validation
const loginRules = () => {
    return [
        body('userName')
            .optional({ nullable: true })
            .trim()
            .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
            .isLength({ max: 30 }).withMessage('Username cannot exceed 30 characters')
            .isAlphanumeric().withMessage('Username must contain only alphanumeric characters'),

        body('username')
            .optional({ nullable: true })
            .trim()
            .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
            .isLength({ max: 30 }).withMessage('Username cannot exceed 30 characters')
            .isAlphanumeric().withMessage('Username must contain only alphanumeric characters'),

        body().custom((_, { req }) => {
            const incomingUserName = String(req.body.userName || req.body.username || '').trim();
            if (!incomingUserName) {
                throw new Error('Username is required');
            }
            return true;
        }),
            
        
        body('password')
            .notEmpty().withMessage('Password is required')
    ];
};

// Deposit validation
const depositRules = () => {
    return [
        body('amount')
            .notEmpty().withMessage('Amount is required')
            .isFloat({ min: 0.01 }).withMessage('Deposit amount must be greater than 0')
            .toFloat(),

        body('transactionPin')
            .trim()
            .notEmpty().withMessage('Transaction PIN is required')
            .isLength({ min: 4, max: 4 }).withMessage('Transaction PIN must be exactly 4 digits')
            .isNumeric().withMessage('Transaction PIN must contain only digits')
    ];
};

// Withdraw validation
const withdrawRules = () => {
    return [
        body('amount')
            .notEmpty().withMessage('Amount is required')
            .isFloat({ min: 0.01 }).withMessage('Withdrawal amount must be greater than 0')
            .toFloat(),

        body('transactionPin')
            .trim()
            .notEmpty().withMessage('Transaction PIN is required')
            .isLength({ min: 4, max: 4 }).withMessage('Transaction PIN must be exactly 4 digits')
            .isNumeric().withMessage('Transaction PIN must contain only digits')
    ];
};

// Transfer validation
const transferRules = () => {
    return [
        body('amount')
            .notEmpty().withMessage('Amount is required')
            .isFloat({ min: 0.01 }).withMessage('Transfer amount must be greater than 0')
            .toFloat(),
        
        body('receiverAccountNumber')
            .trim()
            .notEmpty().withMessage('Receiver account number is required')
            .isLength({ min: 10, max: 10 }).withMessage('Account number must be exactly 10 digits')
            .isNumeric().withMessage('Account number must contain only digits'),

        body('description')
            .optional({ values: 'falsy' })
            .isString().withMessage('Description must be text')
            .trim()
            .isLength({ max: 200 }).withMessage('Description cannot exceed 200 characters'),

        body('transactionPin')
            .trim()
            .notEmpty().withMessage('Transaction PIN is required')
            .isLength({ min: 4, max: 4 }).withMessage('Transaction PIN must be exactly 4 digits')
            .isNumeric().withMessage('Transaction PIN must contain only digits')
    ];
};

const transactionPinRules = () => {
    return [
        body('transactionPin')
            .trim()
            .notEmpty().withMessage('Transaction PIN is required')
            .isLength({ min: 4, max: 4 }).withMessage('Transaction PIN must be exactly 4 digits')
            .isNumeric().withMessage('Transaction PIN must contain only digits')
    ];
};

const setTransactionPinRules = () => {
    return [
        body('currentPassword')
            .notEmpty().withMessage('Current password is required'),

        body('transactionPin')
            .trim()
            .notEmpty().withMessage('Transaction PIN is required')
            .isLength({ min: 4, max: 4 }).withMessage('Transaction PIN must be exactly 4 digits')
            .isNumeric().withMessage('Transaction PIN must contain only digits'),

        body('confirmTransactionPin')
            .trim()
            .notEmpty().withMessage('Confirm transaction PIN is required')
            .custom((confirmTransactionPin, { req }) => {
                if (confirmTransactionPin !== req.body.transactionPin) {
                    throw new Error('Confirm transaction PIN must match transaction PIN');
                }
                return true;
            })
    ];
};

const transferRecipientLookupRules = () => {
    return [
        query('accountNumber')
            .trim()
            .notEmpty().withMessage('Account number is required')
            .isLength({ min: 10, max: 10 }).withMessage('Account number must be exactly 10 digits')
            .isNumeric().withMessage('Account number must contain only digits')
    ];
};

const transactionLimitsRules = () => {
    return [
        query('operation')
            .optional()
            .trim()
            .isIn(['withdraw', 'transfer']).withMessage('operation must be either withdraw or transfer')
    ];
};

// Beneficiary validation
const beneficiaryRules = () => {
    return [
        body('accountNumber')
            .trim()
            .notEmpty().withMessage('Account number is required')
            .isLength({ min: 10, max: 10 }).withMessage('Account number must be exactly 10 digits')
            .isNumeric().withMessage('Account number must contain only digits')
    ];
};

// Update profile validation
const updateProfileRules = () => {
    return [
        body('otp')
            .trim()
            .notEmpty().withMessage('OTP is required')
            .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits')
            .isNumeric().withMessage('OTP must contain only digits'),

        body('firstName')
            .optional()
            .trim()
            .isLength({ min: 2 }).withMessage('First name must be at least 2 characters')
            .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters')
            .isAlpha().withMessage('First name must contain only letters'),
        
        body('lastName')
            .optional()
            .trim()
            .isLength({ min: 2 }).withMessage('Last name must be at least 2 characters')
            .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters')
            .isAlpha().withMessage('Last name must contain only letters'),
        
        body('userName')
            .optional()
            .trim()
            .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
            .isLength({ max: 30 }).withMessage('Username cannot exceed 30 characters')
            .isAlphanumeric().withMessage('Username must contain only alphanumeric characters'),
        
        body('email')
            .optional()
            .trim()
            .isEmail().withMessage('Email must be valid')
    ];
};

// Change password validation
const changePasswordRules = () => {
    return [
        body('currentPassword')
            .notEmpty().withMessage('Current password is required'),
        
        body('newPassword')
            .notEmpty().withMessage('New password is required')
            .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
            .isLength({ max: 30 }).withMessage('New password cannot exceed 30 characters')
    ];
};

const forgotPasswordRequestRules = () => {
    return [
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Email must be valid')
    ];
};

const forgotPasswordVerifyRules = () => {
    return [
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Email must be valid'),

        body('otp')
            .trim()
            .notEmpty().withMessage('OTP is required')
            .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits')
            .isNumeric().withMessage('OTP must contain only digits')
    ];
};

const forgotPasswordResetRules = () => {
    return [
        body('resetToken')
            .trim()
            .notEmpty().withMessage('Reset token is required'),

        body('newPassword')
            .notEmpty().withMessage('New password is required')
            .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
            .isLength({ max: 30 }).withMessage('New password cannot exceed 30 characters'),

        body('confirmPassword')
            .notEmpty().withMessage('Confirm password is required')
            .custom((confirmPassword, { req }) => {
                if (confirmPassword !== req.body.newPassword) {
                    throw new Error('Confirm password must match new password');
                }
                return true;
            })
    ];
};

const paginationRules = () => {
    return [
        query('page')
            .optional()
            .isInt({ min: 1, max: 100000 }).withMessage('page must be a positive integer')
            .toInt(),

        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
            .toInt()
    ];
};

const dateRangeRules = () => {
    return [
        query('startDate')
            .optional({ values: 'falsy' })
            .isISO8601().withMessage('startDate must be a valid ISO date'),

        query('endDate')
            .optional({ values: 'falsy' })
            .isISO8601().withMessage('endDate must be a valid ISO date')
    ];
};

const transactionHistoryRules = () => {
    return [
        ...paginationRules(),
        ...dateRangeRules(),

        query('minAmount')
            .optional({ values: 'falsy' })
            .isFloat({ min: 0 }).withMessage('minAmount must be a non-negative number'),

        query('maxAmount')
            .optional({ values: 'falsy' })
            .isFloat({ min: 0 }).withMessage('maxAmount must be a non-negative number'),

        query('searchBy')
            .optional({ values: 'falsy' })
            .isIn(['recipient', 'transactionId', 'amount', 'all']).withMessage('searchBy is invalid'),

        query('search')
            .optional({ values: 'falsy' })
            .isString().withMessage('search must be text')
            .trim()
            .isLength({ max: 100 }).withMessage('search cannot exceed 100 characters')
    ];
};

const ledgerHistoryRules = () => {
    return [
        query('accountType')
            .optional()
            .isIn(['user_main', 'user_savings']).withMessage('accountType must be user_main or user_savings'),

        query('referenceType')
            .optional()
            .isIn(['transaction', 'savings_transaction', 'investment_trade']).withMessage('referenceType is invalid'),

        query('startDate')
            .optional()
            .isISO8601().withMessage('startDate must be a valid ISO date'),

        query('endDate')
            .optional()
            .isISO8601().withMessage('endDate must be a valid ISO date'),

        query('page')
            .optional()
            .isInt({ min: 1 }).withMessage('page must be a positive integer')
            .toInt(),

        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
            .toInt()
    ];
};

const accountStatementRules = () => {
    return [
        query('accountType')
            .optional()
            .isIn(['user_main', 'user_savings']).withMessage('accountType must be user_main or user_savings'),

        query('startDate')
            .optional()
            .isISO8601().withMessage('startDate must be a valid ISO date'),

        query('endDate')
            .optional()
            .isISO8601().withMessage('endDate must be a valid ISO date')
    ];
};

const notificationListRules = () => {
    return [
        query('page')
            .optional()
            .isInt({ min: 1 }).withMessage('page must be a positive integer')
            .toInt(),

        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
            .toInt(),

        query('unreadOnly')
            .optional()
            .isIn(['true', 'false']).withMessage('unreadOnly must be true or false'),

        query('category')
            .optional()
            .isIn(['debit', 'credit', 'transfer', 'security']).withMessage('category is invalid')
    ];
};

const notificationIdParamRules = () => {
    return [
        param('notificationId')
            .isMongoId().withMessage('notificationId must be a valid MongoDB id')
    ];
};

const notificationPreferenceRules = () => {
    return [
        body('emailByCategory')
            .optional()
            .isObject().withMessage('emailByCategory must be an object'),

        body('emailByCategory.debit')
            .optional()
            .isBoolean().withMessage('emailByCategory.debit must be a boolean'),

        body('emailByCategory.credit')
            .optional()
            .isBoolean().withMessage('emailByCategory.credit must be a boolean'),

        body('emailByCategory.transfer')
            .optional()
            .isBoolean().withMessage('emailByCategory.transfer must be a boolean'),

        body('emailByCategory.security')
            .optional()
            .isBoolean().withMessage('emailByCategory.security must be a boolean')
    ];
};

const adminUpdateKycTierRules = () => {
    return [
        param('userId')
            .isMongoId().withMessage('userId must be a valid MongoDB id'),

        body('kycTier')
            .trim()
            .notEmpty().withMessage('kycTier is required')
            .isIn(['unverified', 'tier1', 'tier2', 'tier3']).withMessage('kycTier must be one of unverified, tier1, tier2, tier3')
    ];
};

const adminListUsersByTierRules = () => {
    return [
        query('kycTier')
            .optional()
            .trim()
            .isIn(['unverified', 'tier1', 'tier2', 'tier3']).withMessage('kycTier must be one of unverified, tier1, tier2, tier3'),

        query('page')
            .optional()
            .isInt({ min: 1 }).withMessage('page must be a positive integer')
            .toInt(),

        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
            .toInt()
    ];
};

module.exports = {
    registerRules,
    loginRules,
    depositRules,
    withdrawRules,
    transferRules,
    transferRecipientLookupRules,
    transactionLimitsRules,
    beneficiaryRules,
    updateProfileRules,
    changePasswordRules,
    forgotPasswordRequestRules,
    forgotPasswordVerifyRules,
    forgotPasswordResetRules,
    paginationRules,
    dateRangeRules,
    transactionHistoryRules,
    ledgerHistoryRules,
    accountStatementRules,
    transactionPinRules,
    setTransactionPinRules,
    notificationListRules,
    notificationIdParamRules,
    notificationPreferenceRules,
    adminUpdateKycTierRules,
    adminListUsersByTierRules
};