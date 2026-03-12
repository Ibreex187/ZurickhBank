const notFoundHandler = (req, res) => {
    return res.status(404).send({
        success: false,
        message: "Route not found",
        requestId: req.requestId
    });
};

const errorHandler = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const statusCode = error.statusCode || error.status || 500;
    const isOperational = statusCode >= 400 && statusCode < 500;

    console.error("[request-error]", {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode,
        message: error.message
    });

    return res.status(statusCode).send({
        success: false,
        message: isOperational ? error.message : "Internal server error",
        requestId: req.requestId
    });
};

module.exports = {
    notFoundHandler,
    errorHandler
};