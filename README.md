# Banknode API

Backend API for a banking app with authentication, user profile management, transfers, beneficiaries, savings, investments, and admin transaction views.

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- express-validator

## Prerequisites

- Node.js 18+
- MongoDB 6+
- npm

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env template and update values:
   ```bash
   copy .env.example .env
   ```
   On macOS/Linux:
   ```bash
   cp .env.example .env
   ```
3. Start MongoDB in replica set mode (required for atomic transactions):
   ```bash
   mongod --dbpath <your-db-path> --replSet rs0
   ```
4. Initialize replica set once:
   ```bash
   mongosh --eval "rs.initiate()"
   ```
5. Ensure `.env` contains a replica set URI:
   ```env
   DATABASE_URI=mongodb://localhost:27017/banknode?replicaSet=rs0
   ```
6. Start the API:
   ```bash
   npm run dev
   ```

## Test Modes

- Default smoke/unit run:
   ```bash
   npm test
   ```
- Full money-flow integration suite (opt-in):
   ```bash
   npm run test:integration
   ```

## Environment Variables

Use `.env.example` as reference.

Required values:

- `PORT` (example: `4040`)
- `DATABASE_URI` (must include `replicaSet=rs0` for local transactional writes)
- `JWT_SECRET`
- `CORS_ORIGIN` (frontend origin(s), comma-separated)

## Base URL

- `http://localhost:4040/api/v1`

## Main Route Groups

- `/auth` - register/login
- `/users` - profile and password
- `/transactions` - deposit/withdraw/transfer + history
- `/beneficiaries` - add/list/remove beneficiary
- `/savings` - savings operations and insights
- `/investments` - stock buy/sell/portfolio/history
- `/ledger` - per-user journal history and account statements
- `/admin` - admin transaction endpoints

## Auth Route Notes

- Canonical registration endpoint: `POST /api/v1/auth/register`
- Canonical login endpoint: `POST /api/v1/auth/login`
- Backward-compatible registration alias is also available at `POST /api/v1/users`

## Common Protected Endpoints

- `GET /api/v1/transactions/history`
- `GET /api/v1/transactions/history/summary`
- `GET /api/v1/transactions/history/:transactionId`
- `POST /api/v1/beneficiaries/add`
- `GET /api/v1/beneficiaries`
- `DELETE /api/v1/beneficiaries/:beneficiaryId`

## API References

- Savings API details: `SAVINGS_API.md`
- Investment API details: `INVESTMENT_API.md`
- OTP flow details: `OTP_FLOW.md`
- Vercel deployment runbook: `VERCEL_DEPLOYMENT.md`

## Transfer Recipient Lookup

Use this endpoint to confirm recipient name while entering account number before transfer submission.

- `GET /api/v1/transactions/recipient?accountNumber=1234567890`
- Requires `Authorization: Bearer <token>`
- Returns recipient `name` and `accountNumber` when found

## Ledger Query Endpoints

- `GET /api/v1/ledger/history`
   - Requires `Authorization: Bearer <token>`
   - Optional query: `accountType`, `referenceType`, `startDate`, `endDate`, `page`, `limit`

- `GET /api/v1/ledger/statement`
   - Requires `Authorization: Bearer <token>`
   - Optional query: `accountType`, `startDate`, `endDate`
   - Returns opening balance, debits, credits, net movement, and closing balance per account

## Backfill Legacy History into Ledger

If you introduced ledger after transactions already existed, run a one-time backfill:

```bash
npm run ledger:backfill -- --dry-run
```

Then execute write mode:

```bash
npm run ledger:backfill
```

Options:

- `--dry-run` previews what would be inserted without writing
- `--include-failed` also attempts mapping of failed/pending records (default is completed only)

Notes:

- Backfill is idempotent by `referenceType + referenceId` and can be re-run safely.
- Legacy `transaction` and `savingsTransaction` records are backfilled.
- Historical `investment_trade` journals cannot be deterministically reconstructed from current schema because buy/sell events are not stored as standalone trade records with stable ledger reference IDs.

## Notes

- Savings, transfer, and investment write operations use MongoDB sessions/transactions.
- Money-moving operations now create balanced double-entry ledger records in the `ledgerentries` collection.
- If MongoDB is not running with replica set enabled, those write endpoints can fail.

## Deploying to Vercel

This repo is configured for Vercel Serverless Functions using `api/index.js` and `vercel.json`.

Set these environment variables in Vercel:

- `DATABASE_URI` (use MongoDB Atlas/replica set URI)
- `JWT_SECRET`
- `CORS_ORIGIN` (your deployed frontend URL, or comma-separated list)
- `NODE_ENV=production`
- Optional mail/OTP env values from `.env.example`
- Optional hardening controls: `REQUEST_BODY_LIMIT`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`

After deploy, your API base URL remains:

- `https://<your-vercel-domain>/api/v1`

### Post-Deploy Checklist

- Confirm env vars are set (`DATABASE_URI`, `JWT_SECRET`, `CORS_ORIGIN`)
- Verify health endpoint: `GET /api/v1/health`
- Verify public route: `GET /api/v1/investments/stocks`
- Verify protected route with token: `GET /api/v1/auth/me`
- Verify one transactional write flow (`/transactions/transfer`, `/savings/deposit`, or `/investments/buy`)
