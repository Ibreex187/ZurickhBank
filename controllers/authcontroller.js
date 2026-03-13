const user = require("../models/user.model")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const {sendWelcomeEmail, sendOtpEmail} = require("../utils/mailer")
const { issueOtp, verifyOtp, OTP_EXPIRY_MINUTES } = require("../utils/otp.service")
const { createRegisteredUser } = require("../utils/user.registration.service")

const FORGOT_PASSWORD_RESET_TOKEN_TTL_MINUTES = Number(process.env.FORGOT_PASSWORD_RESET_TOKEN_TTL_MINUTES || OTP_EXPIRY_MINUTES || 10);

const registerUser = async (req, res) =>{
    const {firstName, lastName, userName, email, password} = req.body;
    try{
    const newUser = await createRegisteredUser({
        firstName,
        lastName,
        userName,
        email,
        password
    });

    res.status(201).send({success:true, message:"User registered successfully", data:{
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        userName: newUser.userName,
        email: newUser.email,
        accountNumber: newUser.accountNumber,
        balance: newUser.balance
    }})

    sendWelcomeEmail(
        newUser.email,
        `${newUser.firstName} ${newUser.lastName}`,
        newUser.userName,
        newUser.accountNumber
    ).catch(() => null);


} catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).send({
                success: false,
                message: error.message
            });
        }

        res.status(500).send({
      success: false,
            message: "Error registering user"
    });
  }
};

const loginUser = async (req, res) =>{
    try {
         
        const {email, password} = req.body;
        if(!email || !password){
            return res.status(400).send({success:false, 
            message:"Email and password are required"})
        }

         const foundUser = await user.findOne({email})
        if(!foundUser){
            return res.status(400).send({success:false, 
            message:"Invalid email or password"})
        }
        const isMatch = await bcrypt.compare(password, foundUser.password)
        if(!isMatch){
            return res.status(400).send({success:false, 
            message:"Invalid email or password"})
        }
        const token = jwt.sign({userId: foundUser._id}, process.env.JWT_SECRET, {expiresIn:"7d"})
        res.status(200).send({success:true, 
        message:"Login successful", data:{token}})

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error logging in"
        });
    }
}

const getMe = async (req, res) => {
    try {
        const userId = req.user.userId; // From auth middleware
        
        const foundUser = await user.findById(userId).select('-password'); // Exclude password field
        
        if (!foundUser) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }
        
        res.status(200).send({
            success: true,
            message: "User profile retrieved successfully",
            data: {
                _id: foundUser._id,
                firstName: foundUser.firstName,
                lastName: foundUser.lastName,
                userName: foundUser.userName,
                email: foundUser.email,
                accountNumber: foundUser.accountNumber,
                balance: foundUser.balance,
                savingsBalance: foundUser.savingsBalance,
                hasTransactionPin: Boolean(foundUser.transactionPinSetAt),
                roles: foundUser.roles,
                createdAt: foundUser.createdAt,
                updatedAt: foundUser.updatedAt,
                beneficiariesCount: foundUser.beneficiaries ? foundUser.beneficiaries.length : 0
            }
        });
        
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving user profile"
        });
    }
}

const requestForgotPasswordOtp = async (req, res) => {
    try {
        const normalizedEmail = String(req.body.email || "").trim().toLowerCase();

        if (!normalizedEmail) {
            return res.status(400).send({
                success: false,
                message: "Email is required"
            });
        }

        const foundUser = await user.findOne({ email: normalizedEmail });

        if (foundUser) {
            const otp = await issueOtp({
                userId: foundUser._id,
                email: foundUser.email,
                purpose: "forgot_password"
            });

            await sendOtpEmail(
                foundUser.email,
                `${foundUser.firstName} ${foundUser.lastName}`,
                otp,
                "forgot password reset"
            );
        }

        return res.status(200).send({
            success: true,
            message: `If the email exists, an OTP has been sent. It expires in ${OTP_EXPIRY_MINUTES} minutes`
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
            message: "Error sending forgot password OTP"
        });
    }
};

const verifyForgotPasswordOtp = async (req, res) => {
    try {
        const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
        const { otp } = req.body;

        if (!normalizedEmail) {
            return res.status(400).send({
                success: false,
                message: "Email is required"
            });
        }

        const foundUser = await user.findOne({ email: normalizedEmail });
        if (!foundUser) {
            return res.status(400).send({
                success: false,
                message: "Invalid OTP or email"
            });
        }

        const otpVerification = await verifyOtp({
            userId: foundUser._id,
            email: foundUser.email,
            purpose: "forgot_password",
            otp
        });

        if (!otpVerification.valid) {
            return res.status(400).send({
                success: false,
                message: otpVerification.message
            });
        }

        const resetToken = jwt.sign(
            {
                userId: foundUser._id,
                email: foundUser.email,
                purpose: "forgot_password_reset"
            },
            process.env.JWT_SECRET,
            { expiresIn: `${FORGOT_PASSWORD_RESET_TOKEN_TTL_MINUTES}m` }
        );

        return res.status(200).send({
            success: true,
            message: "OTP verified successfully",
            data: {
                resetToken,
                expiresInMinutes: FORGOT_PASSWORD_RESET_TOKEN_TTL_MINUTES
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error verifying forgot password OTP"
        });
    }
};

const resetForgotPassword = async (req, res) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) {
            return res.status(400).send({
                success: false,
                message: "Password confirmation does not match"
            });
        }

        let decodedToken;
        try {
            decodedToken = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(400).send({
                success: false,
                message: "Invalid or expired reset token"
            });
        }

        if (decodedToken.purpose !== "forgot_password_reset") {
            return res.status(400).send({
                success: false,
                message: "Invalid reset token"
            });
        }

        const foundUser = await user.findById(decodedToken.userId);
        if (!foundUser || foundUser.email !== String(decodedToken.email || "").trim().toLowerCase()) {
            return res.status(400).send({
                success: false,
                message: "Invalid reset token"
            });
        }

        foundUser.password = await bcrypt.hash(newPassword, 10);
        await foundUser.save();

        return res.status(200).send({
            success: true,
            message: "Password reset successful"
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error resetting password"
        });
    }
}

module.exports = {
    registerUser,
    loginUser,
    getMe,
    requestForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resetForgotPassword
};