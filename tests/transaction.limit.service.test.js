const mongoose = require("mongoose");

jest.mock("../models/transaction.model", () => ({
  aggregate: jest.fn()
}));

jest.mock("../models/savings.transaction.model", () => ({
  aggregate: jest.fn()
}));

const TransactionModel = require("../models/transaction.model");
const SavingsTransactionModel = require("../models/savings.transaction.model");
const { assertOutgoingLimit } = require("../utils/transaction.limit.service");

const envBackup = { ...process.env };

describe("transaction limit service", () => {
  afterEach(() => {
    process.env = { ...envBackup };
    jest.clearAllMocks();
  });

  it("allows withdrawals within configured limits", async () => {
    process.env.WITHDRAW_DAILY_LIMIT = "200";
    process.env.WITHDRAW_MONTHLY_LIMIT = "1000";

    TransactionModel.aggregate
      .mockResolvedValueOnce([{ total: 40 }])
      .mockResolvedValueOnce([{ total: 200 }]);

    SavingsTransactionModel.aggregate
      .mockResolvedValueOnce([{ total: 10 }])
      .mockResolvedValueOnce([{ total: 50 }]);

    await expect(
      assertOutgoingLimit({
        userId: new mongoose.Types.ObjectId(),
        operation: "withdraw",
        amount: 100,
        tier: "tier1"
      })
    ).resolves.toBeUndefined();
  });

  it("blocks withdrawals that exceed the daily limit", async () => {
    process.env.WITHDRAW_DAILY_LIMIT = "100";
    process.env.WITHDRAW_MONTHLY_LIMIT = "1000";

    TransactionModel.aggregate
      .mockResolvedValueOnce([{ total: 50 }])
      .mockResolvedValueOnce([{ total: 200 }]);

    SavingsTransactionModel.aggregate
      .mockResolvedValueOnce([{ total: 40 }])
      .mockResolvedValueOnce([{ total: 100 }]);

    const rejection = assertOutgoingLimit({
      userId: new mongoose.Types.ObjectId(),
      operation: "withdraw",
      amount: 20,
      tier: "tier1"
    });

    await expect(rejection).rejects.toMatchObject({
      statusCode: 429,
      message: "Daily withdraw limit exceeded",
      details: {
        tier: "tier1",
        period: "daily",
        remaining: 10,
        remainingDaily: 10,
        remainingMonthly: 700
      }
    });
  });

  it("blocks transfers that exceed the monthly limit", async () => {
    process.env.TRANSFER_DAILY_LIMIT = "1000";
    process.env.TRANSFER_MONTHLY_LIMIT = "100";

    TransactionModel.aggregate
      .mockResolvedValueOnce([{ total: 30 }])
      .mockResolvedValueOnce([{ total: 90 }]);

    await expect(
      assertOutgoingLimit({
        userId: new mongoose.Types.ObjectId(),
        operation: "transfer",
        amount: 20,
        tier: "tier1"
      })
    ).rejects.toMatchObject({
      statusCode: 429,
      message: "Monthly transfer limit exceeded"
    });

    expect(SavingsTransactionModel.aggregate).not.toHaveBeenCalled();
  });

  it("uses tier-specific env override when provided", async () => {
    process.env.TIER1_TRANSFER_DAILY_LIMIT = "100";
    process.env.TIER1_TRANSFER_MONTHLY_LIMIT = "1000";

    TransactionModel.aggregate
      .mockResolvedValueOnce([{ total: 90 }])
      .mockResolvedValueOnce([{ total: 100 }]);

    await expect(
      assertOutgoingLimit({
        userId: new mongoose.Types.ObjectId(),
        operation: "transfer",
        amount: 20,
        tier: "tier1"
      })
    ).rejects.toMatchObject({
      statusCode: 429,
      message: "Daily transfer limit exceeded",
      details: {
        tier: "tier1",
        remainingDaily: 10
      }
    });
  });
});
