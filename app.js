require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');

const userRouter = require("./routers/user.routes");
const authRouter = require("./routers/auth.routes");
const authMiddleware = require("./middleware/auth.middleware");
const transactionRouter = require("./routers/transaction.routes");
const beneficiaryRouter = require("./routers/beneficiary.routes");
const transactionHistoryRouter = require("./routers/transaction.history.routes");
const adminRouter = require("./routers/admin.routes");
const investmentRouter = require("./routers/investment.routes");
const savingsRouter = require("./routers/savings.routes");
const ledgerRouter = require("./routers/ledger.routes");
const { buildSecurityMiddleware } = require("./middleware/security.middleware");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();
const { helmetMiddleware, rateLimitMiddleware } = buildSecurityMiddleware();

// Required behind Vercel/other reverse proxies so req.ip and rate limiting work correctly
app.set('trust proxy', 1);

const defaultCorsOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://zurickh.vercel.app"
].join(",");

const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/+$/, '');

const configuredCorsOrigins = String(process.env.CORS_ORIGIN || defaultCorsOrigins).trim();
const allowAllOrigins = configuredCorsOrigins === "*";
const allowedOrigins = configuredCorsOrigins
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    const normalizedOrigin = normalizeOrigin(origin);

    if (!origin || allowAllOrigins || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

app.use(helmetMiddleware);
app.use(rateLimitMiddleware);
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || '100kb' }));
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '100kb' }));

app.use('/api/v1', transactionRouter);
app.use('/api/v1', userRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/beneficiaries', beneficiaryRouter);
app.use('/api/v1/transactions', transactionHistoryRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/investments', investmentRouter);
app.use('/api/v1/savings', savingsRouter);
app.use('/api/v1/ledger', ledgerRouter);

app.get('/', (req, res) => {
  res.status(200).send({
    success: true,
    message: 'Banknode API is running',
    data: {
      docs: '/api/v1/health',
    },
  });
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.get('/api/v1/health', (req, res) => {
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = dbStates[mongoose.connection.readyState] || 'unknown';

  res.status(200).send({
    success: true,
    message: 'API is healthy',
    data: {
      uptime: process.uptime(),
      database: dbState,
      timestamp: new Date().toISOString()
    }
  });
});

app.get("/api/v1/test", authMiddleware, (req, res) => {
  res.send({
    success: true,
    message: "This is a protected route",
    user: req.user
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
