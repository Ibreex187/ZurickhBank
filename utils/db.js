const mongoose = require("mongoose");

let cachedConnection = null;
let connectingPromise = null;

async function connectToDatabase() {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        return cachedConnection;
    }

    if (connectingPromise) {
        return connectingPromise;
    }

    if (!process.env.DATABASE_URI) {
        throw new Error("DATABASE_URI is not configured");
    }

    connectingPromise = mongoose.connect(process.env.DATABASE_URI)
        .then((connection) => {
            cachedConnection = connection;
            return cachedConnection;
        })
        .finally(() => {
            connectingPromise = null;
        });

    return connectingPromise;
}

module.exports = { connectToDatabase };
