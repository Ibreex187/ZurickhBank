# Product Backlog (Prioritized)

This backlog is tailored to the current Banknode scope (auth, transactions, savings, investments, ledger, admin).

## P0 — Critical (Security, Compliance, Money Integrity)

### 1) Idempotency for Money-Moving Endpoints
**Why:** Prevent duplicate debit/credit from retries, network timeouts, or client re-submissions.

**Scope:**
- Add `Idempotency-Key` support to:
  - `POST /api/v1/transactions/deposit`
  - `POST /api/v1/transactions/withdraw`
  - `POST /api/v1/transactions/transfer`
  - `POST /api/v1/savings/deposit`
  - `POST /api/v1/savings/withdraw`
  - `POST /api/v1/savings/quick-transfer`
  - `POST /api/v1/investments/buy`
  - `POST /api/v1/investments/sell`
- Persist request hash + response snapshot with TTL.
- Return original response for repeated key within validity window.

**Done when:** Duplicate request with same key cannot move funds twice.

---

### 2) Transaction State Lifecycle + Reversal
**Why:** Real systems need explicit state transitions and controlled reversals.

**Scope:**
- Introduce transaction statuses: `pending`, `completed`, `failed`, `reversed`.
- Add admin-only reversal endpoint and reason capture.
- Write matching double-entry reversal records in ledger.
- Expose status in transaction history and detail endpoints.

**Done when:** Any reversal produces a full, auditable money trail and consistent balances.

---

### 3) KYC + Tiered Transfer Limits
**Why:** Required for risk control and regulatory readiness.

**Scope:**
- Add user KYC status fields (`unverified`, `tier1`, `tier2`, `tier3`).
- Enforce configurable daily/monthly limits by tier.
- Return clear limit-exceeded errors with remaining allowance.

**Done when:** Transfers are blocked above configured tier caps and tracked per period.

---

### 4) Security Hardening (Session + Auth)
**Why:** Banking apps need stronger account/session protection.

**Scope:**
- Add refresh token rotation + revocation list.
- Add device/session listing and remote logout.
- Add optional step-up OTP for high-value transfers.
- Tighten rate limits for auth/OTP endpoints.

**Done when:** Compromised tokens can be invalidated quickly and risky actions require extra verification.

---

### 5) Reconciliation & Consistency Jobs
**Why:** Ledger and wallet balances must remain provably consistent.

**Scope:**
- Daily reconciliation job: user balances vs ledger aggregates.
- Alert/report mismatches and affected account IDs.
- Add admin endpoint/report for reconciliation status.

**Done when:** System can detect, report, and investigate balance drifts automatically.

## P1 — Important (User Value + Operational Maturity)

### 6) Notification Center
**Scope:**
- In-app + email notifications for debit, credit, transfer, failed login, PIN change.
- Notification read/unread endpoints.
- Preference toggles (email on/off per category).

### 7) Dispute Management Workflow
**Scope:**
- User endpoint to raise dispute on transaction reference.
- Admin queue with statuses (`open`, `investigating`, `resolved`, `rejected`).
- Notes, evidence links, final resolution record.

### 8) Bill Payments / Airtime / Data
**Scope:**
- Provider abstraction layer + transaction recording.
- Purchase endpoints and webhook callback verification.
- Failed payment compensation flow.

### 9) Scheduled & Recurring Transfers
**Scope:**
- One-off scheduled transfer and recurring rules (daily/weekly/monthly).
- Background scheduler with retry policy.
- User pause/cancel endpoint.

### 10) Audit Logging (Admin + Sensitive User Actions)
**Scope:**
- Immutable action logs for admin endpoints and profile/security changes.
- Capture actor, action, target, before/after, IP, user-agent.
- Query endpoint with filters for investigations.

## P2 — Growth / Nice-to-Have

### 11) Smart Savings Automation
**Scope:**
- Rule-based autosave (round-up, fixed interval, percentage of inflow).
- Savings goals with target dates and progress milestones.

### 12) Advanced Financial Insights
**Scope:**
- Monthly cashflow categorization.
- Spend trends and budgeting recommendations.
- Downloadable insight snapshots.

### 13) Investment Enhancements
**Scope:**
- Watchlist + price alerts.
- More realistic pricing adapter (mock -> provider abstraction).
- Realized vs unrealized P/L breakdown.

### 14) Public Statement Export
**Scope:**
- PDF/CSV statement export with date range filters.
- Include opening/closing balance and running balance.

### 15) Developer Platform Improvements
**Scope:**
- OpenAPI/Swagger generation from routes.
- API versioning strategy and deprecation policy.
- Contract tests for critical endpoints.

---

## Suggested Execution Order (First 6 Weeks)
1. P0-1 Idempotency
2. P0-2 Transaction states + reversal
3. P0-5 Reconciliation jobs
4. P0-3 KYC + tiered limits
5. P0-4 Security hardening
6. P1-6 Notifications

## Backlog Hygiene Rules
- Every item must have: owner, estimate, dependencies, and measurable acceptance criteria.
- No item moves to “In Progress” without API contract + test plan.
- P0 items block P1/P2 releases when they affect money integrity or security.
