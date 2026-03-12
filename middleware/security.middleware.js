const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const buildSecurityMiddleware = () => {
    const commonRateLimit = rateLimit({
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
        max: process.env.NODE_ENV === "test"
            ? Number(process.env.RATE_LIMIT_TEST_MAX || 1000)
            : Number(process.env.RATE_LIMIT_MAX || 300),
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: "Too many requests, please try again later"
        }
    });

    return {
        helmetMiddleware: helmet(),
        rateLimitMiddleware: commonRateLimit
    };
};

module.exports = {
    buildSecurityMiddleware
};