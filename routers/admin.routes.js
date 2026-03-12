const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const adminMiddleware = require("../middleware/admin.middleware");
const {
    getAllTransactions,
    getTransactionByTransactionId
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

module.exports = router;