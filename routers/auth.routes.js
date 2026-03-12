const express = require('express');
const router = express.Router();
const { registerRules, loginRules, forgotPasswordRequestRules, forgotPasswordVerifyRules, forgotPasswordResetRules } = require('../validators/validation.rules');
const validate = require('../middleware/express.validator.middleware');
const authMiddleware = require("../middleware/auth.middleware")
const { registerUser, loginUser, getMe, requestForgotPasswordOtp, verifyForgotPasswordOtp, resetForgotPassword } = require('../controllers/authcontroller');


router.post('/register', registerRules(), validate, registerUser);
router.post('/login', loginRules(), validate, loginUser);
router.post('/forgot-password/request', forgotPasswordRequestRules(), validate, requestForgotPasswordOtp);
router.post('/forgot-password/verify', forgotPasswordVerifyRules(), validate, verifyForgotPasswordOtp);
router.post('/forgot-password/reset', forgotPasswordResetRules(), validate, resetForgotPassword);
router.get('/me', authMiddleware, getMe);

module.exports = router


//POST /api/auth/register
//POST /api/auth/login  
//GET /api/auth/me // endpoints for registration, login and profile retrieval