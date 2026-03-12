const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware")
const { beneficiaryRules } = require('../validators/validation.rules');
const validate = require('../middleware/express.validator.middleware');
const { addBeneficiary, getBeneficiaries, deleteBeneficiary } = require('../controllers/beneficiary.controller');

router.post('/add', authMiddleware, beneficiaryRules(), validate, addBeneficiary)
router.get('/', authMiddleware, getBeneficiaries)
router.delete('/:beneficiaryId', authMiddleware, deleteBeneficiary)

module.exports = router;