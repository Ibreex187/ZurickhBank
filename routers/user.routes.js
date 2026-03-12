const express = require('express');
const {
	getUserProfile,
	updateUserProfile,
	changePassword,
	requestProfileUpdateOtp
} = require('../controllers/user.controller');
const { registerUser } = require('../controllers/authcontroller');
const authMiddleware = require('../middleware/auth.middleware');
const { registerRules, updateProfileRules, changePasswordRules } = require('../validators/validation.rules');
const validate = require('../middleware/express.validator.middleware');
const router = express.Router();

router.post('/users', registerRules(), validate, registerUser);
router.get('/users/profile', authMiddleware, getUserProfile);
router.post('/users/profile/otp', authMiddleware, requestProfileUpdateOtp);
router.put('/users/profile', authMiddleware, updateProfileRules(), validate, updateUserProfile);
router.post('/users/change-password', authMiddleware, changePasswordRules(), validate, changePassword);

module.exports = router;