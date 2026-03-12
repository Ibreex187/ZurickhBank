# Savings Account API Documentation

## Overview
The Savings Account API allows users to save money from their main balance, earn virtual interest, track savings goals, and manage their financial health through dedicated savings features.

## MongoDB Transaction Requirement

Savings deposit/withdraw operations use MongoDB sessions and transactions for atomic main balance + savings balance + ledger updates.

Your MongoDB must run in replica set mode (single-node replica set is fine for local development).

### Local Setup (Windows/macOS/Linux)

1. Start MongoDB with replica set enabled:
  ```bash
  mongod --dbpath <your-db-path> --replSet rs0
  ```
2. In another terminal, initialize replica set once:
  ```bash
  mongosh --eval "rs.initiate()"
  ```
3. Use a replica-set connection string in `.env`:
  ```
  DATABASE_URI=mongodb://localhost:27017/banknode?replicaSet=rs0
  ```

If replica set is not enabled, savings write endpoints can fail at runtime.

## Key Features
- 💰 **Separate Savings Balance** - Keep savings separate from spending money
- 🔄 **Easy Transfers** - Move money between main and savings accounts
- 📊 **Savings Insights** - Get recommendations and track progress
- 📈 **Transaction History** - Complete record of all savings activities
- 🎯 **Goal Tracking** - Monitor savings milestones and targets

## Available Endpoints

### Savings Operations

#### Deposit to Savings
```http
POST /api/v1/savings/deposit
Content-Type: application/json
Authorization: Bearer <your-jwt-token>

{
  "amount": 500.00
}
```
Transfers money from main balance to savings account.

#### Withdraw from Savings
```http
POST /api/v1/savings/withdraw
Content-Type: application/json
Authorization: Bearer <your-jwt-token>

{
  "amount": 200.00
}
```
Transfers money from savings account back to main balance.

#### Quick Transfer
```http
POST /api/v1/savings/quick-transfer
Content-Type: application/json
Authorization: Bearer <your-jwt-token>

{
  "amount": 300.00,
  "direction": "to-savings"
}
```
Quick transfer between accounts. Direction can be:
- `"to-savings"` - Transfer from main to savings
- `"to-main"` - Transfer from savings to main

### Account Information

#### Get Savings Overview
```http
GET /api/v1/savings/overview
Authorization: Bearer <your-jwt-token>
```
Returns comprehensive savings account information including balances, statistics, and transaction counts.

**Response Example:**
```json
{
  "success": true,
  "message": "Savings overview retrieved successfully",
  "data": {
    "accountInfo": {
      "name": "John Doe",
      "accountNumber": "12345678"
    },
    "balances": {
      "mainBalance": 5000.00,
      "savingsBalance": 2500.00,
      "totalBalance": 7500.00
    },
    "statistics": {
      "totalDeposited": 3000.00,
      "totalWithdrawn": 500.00,
      "netSavings": 2500.00,
      "totalTransactions": 12,
      "deposits": 8,
      "withdrawals": 4
    }
  }
}
```

#### Get Transaction History
```http
GET /api/v1/savings/history?limit=20&page=1&type=deposit
Authorization: Bearer <your-jwt-token>
```

**Query Parameters:**
- `limit` (optional): Number of transactions per page (1-100, default: 20)
- `page` (optional): Page number (default: 1)
- `type` (optional): Filter by type - `"deposit"` or `"withdraw"`

#### Get Savings Insights
```http
GET /api/v1/savings/insights
Authorization: Bearer <your-jwt-token>
```
Returns personalized savings recommendations, health status, and goal suggestions.

**Response Example:**
```json
{
  "success": true,
  "data": {
    "currentStatus": {
      "savingsPercentage": 33.33,
      "savingsHealthStatus": "Good",
      "totalWealth": 7500.00
    },
    "recommendations": [
      "Great savings habit! Keep it up",
      "Consider diversifying with investments for long-term growth"
    ],
    "suggestions": {
      "monthlySavingsTarget": 750.00,
      "emergencyFundTarget": 1875.00,
      "nextMilestone": {
        "amount": 3000.00,
        "description": "Next 1K milestone"
      }
    }
  }
}
```

## Savings Health Status

The system provides intelligent insights based on your savings percentage:

| Savings % | Status | Description |
|-----------|--------|-------------|
| < 10% | Needs Attention | Start building savings habits |
| 10-20% | Fair | Good progress, keep improving |
| 20-50% | Good | Healthy savings rate |
| ≥ 50% | Excellent | Outstanding savings discipline |

## API Response Format

All endpoints return responses in this format:
```json
{
  "success": true/false,
  "message": "Description of the operation",
  "data": { ... }
}
```

## Error Handling

Common error scenarios:

### 400 Bad Request
- Invalid amount (negative, zero, or too large)
- Insufficient balance for deposits/withdrawals
- Invalid direction for quick transfers

### 401 Unauthorized
- Missing or invalid JWT token

### 404 Not Found
- User account not found

### 500 Internal Server Error
- Database connection issues
- Server processing errors

## Example Usage Flow

### 1. Check Current Savings Status
```http
GET /api/v1/savings/overview
```

### 2. Deposit Money to Savings
```http
POST /api/v1/savings/deposit
{
  "amount": 1000.00
}
```

### 3. Get Savings Recommendations
```http
GET /api/v1/savings/insights
```

### 4. View Transaction History
```http
GET /api/v1/savings/history?limit=10
```

### 5. Withdraw When Needed
```http
POST /api/v1/savings/withdraw
{
  "amount": 200.00
}
```

## Integration with Existing Features

The savings system integrates seamlessly with your existing banking features:

- ✅ **User Balance**: Uses existing user balance system
- ✅ **Authentication**: Requires JWT token like other protected routes
- ✅ **Transaction Records**: Maintains detailed transaction history
- ✅ **Validation**: Input validation and error handling
- ✅ **Database**: Uses existing MongoDB setup

## New Database Fields

The user model now includes:
- `savingsBalance` (Number, default: 0) - Separate savings account balance

New collection:
- `savingsTransactions` - Complete history of all savings operations

Start building better financial habits with the savings feature! 💪💰