const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const validate = require('../middleware/express.validator.middleware');
const { ledgerHistoryRules, accountStatementRules } = require('../validators/validation.rules');
const { getLedgerHistory, getAccountStatement } = require('../controllers/ledger.controller');

router.get('/history', authMiddleware, ledgerHistoryRules(), validate, getLedgerHistory);
router.get('/statement', authMiddleware, accountStatementRules(), validate, getAccountStatement);

module.exports = router;
