const dotenv = require('dotenv');
const app = require('../app');
const { connectToDatabase } = require('../utils/db');

dotenv.config();

module.exports = async (req, res) => {
    try {
        await connectToDatabase();
        return app(req, res);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Database connection failed'
        });
    }
};
