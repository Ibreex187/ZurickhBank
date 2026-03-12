# Investment API Documentation

## Overview
The Investment API allows users to buy and sell stocks using their account balance, track their portfolio, and view real-time gains/losses.

## MongoDB Transaction Requirement

Investment buy/sell operations use MongoDB sessions and transactions for atomic balance + portfolio updates.

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

If replica set is not enabled, investment write endpoints can fail at runtime.

## Available Endpoints

### Public Endpoints

#### Get Available Stocks
```
GET /api/v1/investments/stocks
```
Returns list of all available stocks with current prices.

#### Get Stock Details
```
GET /api/v1/investments/stocks/:symbol
```
Returns detailed information about a specific stock including 30-day price history.

### Protected Endpoints (Require JWT Token)

#### Buy Stock
```
POST /api/v1/investments/buy
Content-Type: application/json
Authorization: Bearer <your-jwt-token>

{
  "stockSymbol": "AAPL",
  "quantity": 10
}
```

#### Sell Stock
```
POST /api/v1/investments/sell
Content-Type: application/json
Authorization: Bearer <your-jwt-token>

{
  "stockSymbol": "AAPL", 
  "quantity": 5
}
```

#### Get Portfolio
```
GET /api/v1/investments/portfolio
Authorization: Bearer <your-jwt-token>
```
Returns user's current active investments with profit/loss calculations.

#### Get Investment History
```
GET /api/v1/investments/history
Authorization: Bearer <your-jwt-token>
```
Returns all investments (both active and sold).

## Available Stocks

The system includes these mock stocks:

- **AAPL** - Apple Inc. (Base price: $150.00)
- **GOOGL** - Alphabet Inc. (Base price: $2800.00)
- **MSFT** - Microsoft Corp. (Base price: $300.00)
- **TSLA** - Tesla Inc. (Base price: $200.00)
- **AMZN** - Amazon.com Inc. (Base price: $3200.00)
- **META** - Meta Platforms Inc. (Base price: $250.00)
- **NFLX** - Netflix Inc. (Base price: $400.00)
- **NVDA** - NVIDIA Corp. (Base price: $800.00)

## Features

1. **Real-time Price Simulation**: Prices fluctuate ±5% from base prices
2. **Portfolio Management**: Track multiple stocks with average cost calculation
3. **Profit/Loss Tracking**: Real-time calculation of gains and losses
4. **Balance Integration**: Uses existing user balance for transactions
5. **Investment History**: Complete transaction history
6. **Average Cost Calculation**: When buying same stock multiple times

## Example Usage

1. **Check available stocks**:
   ```
   GET /api/v1/investments/stocks
   ```

2. **Buy 10 shares of Apple**:
   ```
   POST /api/v1/investments/buy
   {
     "stockSymbol": "AAPL",
     "quantity": 10
   }
   ```

3. **Check your portfolio**:
   ```
   GET /api/v1/investments/portfolio
   ```

4. **Sell 5 shares of Apple**:
   ```
   POST /api/v1/investments/sell
   {
     "stockSymbol": "AAPL", 
     "quantity": 5
   }
   ```

## Response Format

All responses follow this format:
```json
{
  "success": true/false,
  "message": "Description",
  "data": { ... }
}
```

## Error Handling

- **400**: Bad request (insufficient balance, invalid quantity, etc.)
- **401**: Unauthorized (missing or invalid token)
- **404**: Not found (stock or investment not found)
- **500**: Server error