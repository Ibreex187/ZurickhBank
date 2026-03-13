# Vercel Deployment Runbook

This project deploys as a Vercel Serverless Function using `api/index.js` and `vercel.json`.

## 1) Pre-Deploy Checks

Run these locally before pushing:

```bash
npm test
npm run test:integration
```

Confirm the API boots with your `.env`:

```bash
npm run dev
```

## 2) Required Vercel Environment Variables

Set these in Vercel Project Settings → Environment Variables:

- `DATABASE_URI` (MongoDB replica set/Atlas URI)
- `JWT_SECRET`
- `CORS_ORIGIN` (single origin or comma-separated list)
- `NODE_ENV=production`

Optional but recommended:

- `REQUEST_BODY_LIMIT` (example: `100kb`)
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `FROM_EMAIL`
- `SUPPORT_EMAIL`
- OTP controls (`OTP_EXPIRY_MINUTES`, `OTP_REQUEST_WINDOW_MINUTES`, `OTP_MAX_REQUESTS_PER_WINDOW`, `OTP_MIN_RESEND_SECONDS`)

## 3) Deploy

- Connect repository to Vercel and deploy the default branch.
- Ensure `vercel.json` is detected at project root.
- No custom build command is required for this API-only project.

## 4) Post-Deploy Verification

Assuming base URL `https://<your-vercel-domain>`:

1. Health check
   - `GET /api/v1/health`
2. Public endpoint
   - `GET /api/v1/investments/stocks`
3. Auth flow
   - `POST /api/v1/auth/register`
   - `POST /api/v1/auth/login`
   - `GET /api/v1/auth/me` (with bearer token)
4. Money movement sanity check
   - One of: `/api/v1/transactions/transfer`, `/api/v1/savings/deposit`, `/api/v1/investments/buy`

## 5) Operational Notes

- DB connection is cached between warm invocations to reduce latency.
- Write endpoints use MongoDB transactions, so `DATABASE_URI` must point to a replica set capable deployment.
- CORS failures are usually caused by `CORS_ORIGIN` mismatch.
- If OTP emails fail in production, verify SMTP env values and provider restrictions.

## 6) Rollback

If a deployment introduces issues:

- Promote the previous successful deployment from Vercel dashboard.
- Keep environment variables unchanged unless the incident is config-related.
- Re-run post-deploy verification checklist after rollback.

## 7) Localhost Emergency Fallback

If Vercel and rollback are both unavailable, serve API from localhost immediately:

1. Ensure local `.env` is configured (`DATABASE_URI`, `JWT_SECRET`, `CORS_ORIGIN`).
2. Start API:

   ```bash
   npm install
   npm run dev
   ```

3. Verify:

   - `GET http://localhost:4040/api/v1/health`

4. Switch frontend/API client base URL to:

   - `http://localhost:4040/api/v1`

Keep `CORS_ORIGIN` comma-separated to include both local frontend origins and your Vercel frontend domain.
