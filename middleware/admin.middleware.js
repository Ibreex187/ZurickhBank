const UserModel = require("../models/user.model");

module.exports = async (req, res, next) => {
    try {
        const userId = req.user && req.user.userId;

        if (!userId) {
            return res.status(401).send({
                success: false,
                message: "Unauthorized user"
            });
        }

        const user = await UserModel.findById(userId).select("roles");

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        if (user.roles !== "admin") {
            return res.status(403).send({
                success: false,
                message: "Access denied. Admin only"
            });
        }

        next();
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error validating admin access",
            error: error.message
        });
    }
};