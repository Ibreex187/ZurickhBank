const bcrypt = require("bcrypt");
const UserModel = require("../models/user.model");
const EmailRegistryModel = require("../models/email.registry.model");

const DUPLICATE_KEY_ERROR_CODE = 11000;
const ACCOUNT_NUMBER_MIN = 1000000000;
const ACCOUNT_NUMBER_MAX = 9999999999;
const SIGN_UP_BONUS_BALANCE = Number(process.env.SIGN_UP_BONUS_BALANCE || 99999);
const NO_SIGN_UP_BONUS_BALANCE = Number(process.env.NO_SIGN_UP_BONUS_BALANCE || 0);

const getMaxAccountNumberRetries = () => {
    const parsed = Number(process.env.ACCOUNT_NUMBER_MAX_RETRIES);

    if (Number.isFinite(parsed) && parsed >= 1) {
        return Math.floor(parsed);
    }

    return 12;
};

const generateAccountNumber = () => {
    const generated = Math.floor(ACCOUNT_NUMBER_MIN + Math.random() * (ACCOUNT_NUMBER_MAX - ACCOUNT_NUMBER_MIN + 1));
    return String(generated).padStart(10, "0");
};

const buildValidationError = (message) => {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isDuplicateAccountNumberError = (error) => {
    return Boolean(
        error &&
        error.code === DUPLICATE_KEY_ERROR_CODE &&
        ((error.keyPattern && error.keyPattern.accountNumber) ||
            (error.keyValue && error.keyValue.accountNumber))
    );
};

const isDuplicateUserIdentityError = (error) => {
    return Boolean(
        error &&
        error.code === DUPLICATE_KEY_ERROR_CODE &&
        ((error.keyPattern && (error.keyPattern.email || error.keyPattern.userName)) ||
            (error.keyValue && (error.keyValue.email || error.keyValue.userName)))
    );
};

const isDuplicateEmailRegistryError = (error) => {
    return Boolean(
        error &&
            error.code === DUPLICATE_KEY_ERROR_CODE &&
            ((error.keyPattern && error.keyPattern.email) || (error.keyValue && error.keyValue.email))
    );
};

const createRegisteredUser = async ({ firstName, lastName, userName, email, password }) => {
    if (!firstName || !lastName || !userName || !email || !password) {
        throw buildValidationError("All fields are required");
    }

    const normalizedEmail = normalizeEmail(email);

    const existingUser = await UserModel.findOne({
        $or: [{ email: normalizedEmail }, { userName }]
    });

    if (existingUser) {
        const field = existingUser.email === normalizedEmail ? "Email" : "Username";
        throw buildValidationError(`${field} already exists`);
    }

    const existingEmailRegistry = await EmailRegistryModel.findOne({ email: normalizedEmail }).lean();

    const hashedPassword = await bcrypt.hash(password, 10);
    const basePayload = {
        firstName,
        lastName,
        userName,
        email: normalizedEmail,
        password: hashedPassword,
        balance: existingEmailRegistry ? NO_SIGN_UP_BONUS_BALANCE : SIGN_UP_BONUS_BALANCE
    };

    const maxRetries = getMaxAccountNumberRetries();

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        const accountNumber = generateAccountNumber();

        try {
            const createdUser = await UserModel.create({
                ...basePayload,
                accountNumber
            });

            if (!existingEmailRegistry) {
                try {
                    await EmailRegistryModel.create({
                        email: normalizedEmail,
                        firstUserId: createdUser._id
                    });
                } catch (error) {
                    if (!isDuplicateEmailRegistryError(error)) {
                        throw error;
                    }
                }
            }

            return createdUser;
        } catch (error) {
            if (isDuplicateAccountNumberError(error)) {
                continue;
            }

            if (isDuplicateUserIdentityError(error)) {
                const duplicatedField =
                    (error.keyPattern && error.keyPattern.email) || (error.keyValue && error.keyValue.email)
                        ? "Email"
                        : "Username";
                throw buildValidationError(`${duplicatedField} already exists`);
            }

            throw error;
        }
    }

    const exhaustionError = new Error("Unable to allocate account number. Please retry");
    exhaustionError.statusCode = 503;
    throw exhaustionError;
};

module.exports = {
    createRegisteredUser
};