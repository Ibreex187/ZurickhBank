const UserModel = require("../models/user.model");
const EmailRegistryModel = require("../models/email.registry.model");
const bcrypt = require("bcrypt");
const { sendOtpEmail } = require("../utils/mailer");
const { issueOtp, verifyOtp, OTP_EXPIRY_MINUTES } = require("../utils/otp.service");
const DUPLICATE_KEY_ERROR_CODE = 11000;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isDuplicateEmailRegistryError = (error) => {
    return Boolean(
        error &&
            error.code === DUPLICATE_KEY_ERROR_CODE &&
            ((error.keyPattern && error.keyPattern.email) || (error.keyValue && error.keyValue.email))
    );
};

const getUserProfile = async (req, res) => {
    try {
        const user = await UserModel.findById(req.user.userId).select('-password');
        
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).send({
            success: true,
            message: "User profile retrieved successfully",
            data: {
                ...user.toObject(),
                hasTransactionPin: Boolean(user.transactionPinSetAt)
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving user profile"
        });
    }
};

const setTransactionPin = async (req, res) => {
    try {
        const { currentPassword, transactionPin } = req.body;

        const user = await UserModel.findById(req.user.userId).select('password transactionPinSetAt');

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordValid) {
            return res.status(400).send({
                success: false,
                message: "Current password is incorrect"
            });
        }

        user.transactionPinHash = await bcrypt.hash(String(transactionPin), 10);
        const hadTransactionPin = Boolean(user.transactionPinSetAt);
        user.transactionPinSetAt = new Date();
        await user.save();

        return res.status(200).send({
            success: true,
            message: hadTransactionPin ? "Transaction PIN updated successfully" : "Transaction PIN set successfully"
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error setting transaction PIN"
        });
    }
};

const updateUserProfile = async (req, res) => {
    try {
        const { firstName, lastName, userName, email, otp } = req.body;
        const updateData = {};
        const normalizedEmail = email ? normalizeEmail(email) : null;

        const currentUser = await UserModel.findById(req.user.userId).select('email');
        if (!currentUser) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // Only add fields that are provided
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (userName) updateData.userName = userName;
        if (normalizedEmail) updateData.email = normalizedEmail;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).send({
                success: false,
                message: "Provide at least one profile field to update"
            });
        }

        // Check for duplicate username or email (excluding current user)
        if (userName || email) {
            const query = { _id: { $ne: req.user.userId } };
            if (userName && email) {
                query.$or = [{ userName }, { email: normalizedEmail }];
            } else if (userName) {
                query.userName = userName;
            } else if (email) {
                query.email = normalizedEmail;
            }

            const existingUser = await UserModel.findOne(query);
            if (existingUser) {
                const field = existingUser.userName === userName ? 'Username' : 'Email';
                return res.status(400).send({
                    success: false,
                    message: `${field} already taken`
                });
            }
        }

        const otpVerification = await verifyOtp({
            userId: req.user.userId,
            email: currentUser.email,
            purpose: "profile_update",
            otp
        });

        if (!otpVerification.valid) {
            return res.status(400).send({
                success: false,
                message: otpVerification.message
            });
        }

        const user = await UserModel.findByIdAndUpdate(
            req.user.userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        if (normalizedEmail && normalizedEmail !== currentUser.email) {
            try {
                await EmailRegistryModel.create({
                    email: normalizedEmail,
                    firstUserId: req.user.userId
                });
            } catch (error) {
                if (!isDuplicateEmailRegistryError(error)) {
                    throw error;
                }
            }
        }

        res.status(200).send({
            success: true,
            message: "Profile updated successfully",
            data: user
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error updating profile"
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).send({
                success: false,
                message: "Current password and new password are required"
            });
        }

        const user = await UserModel.findById(req.user.userId);

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).send({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Hash and save new password
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).send({
            success: true,
            message: "Password changed successfully"
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error changing password"
        });
    }
};

const requestProfileUpdateOtp = async (req, res) => {
    try {
        const foundUser = await UserModel.findById(req.user.userId).select('firstName lastName email');

        if (!foundUser) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        const otp = await issueOtp({
            userId: foundUser._id,
            email: foundUser.email,
            purpose: "profile_update"
        });

        await sendOtpEmail(
            foundUser.email,
            `${foundUser.firstName} ${foundUser.lastName}`,
            otp,
            "profile update"
        );

        return res.status(200).send({
            success: true,
            message: `OTP sent to your email. It expires in ${OTP_EXPIRY_MINUTES} minutes`
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).send({
                success: false,
                message: error.message
            });
        }

        return res.status(500).send({
            success: false,
            message: "Error sending profile update OTP"
        });
    }
};

module.exports = {
    getUserProfile,
    updateUserProfile,
    changePassword,
    requestProfileUpdateOtp,
    setTransactionPin
};