const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const adminMiddleware = require("../middleware/admin.middleware");
const validate = require('../middleware/express.validator.middleware');
const { adminUpdateKycTierRules, adminListUsersByTierRules } = require('../validators/validation.rules');
const {
    getAllTransactions,
    getTransactionByTransactionId,
    updateUserKycTier,
    listUsersByKycTier
} = require("../controllers/admin.controller");

router.get(
    "/transactions",
    authMiddleware,
    adminMiddleware,
    getAllTransactions
);

router.get(
    "/transactions/:transactionId",
    authMiddleware,
    adminMiddleware,
    getTransactionByTransactionId
);

router.patch(
    "/users/:userId/kyc-tier",
    authMiddleware,
    adminMiddleware,
    adminUpdateKycTierRules(),
    validate,
    updateUserKycTier
);

router.get(
    "/users",
    authMiddleware,
    adminMiddleware,
    adminListUsersByTierRules(),
    validate,
    listUsersByKycTier
);

module.exports = router;