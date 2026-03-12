const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

jest.setTimeout(180000);

jest.mock("../utils/mailer", () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(null),
  sendOtpEmail: jest.fn().mockResolvedValue(null)
}));

const { sendOtpEmail } = require("../utils/mailer");

const UserModel = require("../models/user.model");
const TransactionModel = require("../models/transaction.model");
const SavingsTransactionModel = require("../models/savings.transaction.model");
const LedgerEntryModel = require("../models/ledger.entry.model");

let app;
let replset;

const registerAndLogin = async ({
  firstName,
  lastName,
  userName,
  email,
  password = "securePass1"
}) => {
  const registerResponse = await request(app)
    .post("/api/v1/auth/register")
    .send({ firstName, lastName, userName, email, password });

  expect(registerResponse.statusCode).toBe(201);

  const loginResponse = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });

  expect(loginResponse.statusCode).toBe(200);

  return {
    token: loginResponse.body.data.token,
    accountNumber: registerResponse.body.data.accountNumber
  };
};

describe("Money flow integration", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.CORS_ORIGIN = "*";

    replset = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" }
    });

    process.env.DATABASE_URI = replset.getUri("banknode_test");

    app = require("../app");

    await mongoose.connect(process.env.DATABASE_URI);
  });

  afterEach(async () => {
    sendOtpEmail.mockClear();

    await Promise.all([
      UserModel.deleteMany({}),
      TransactionModel.deleteMany({}),
      SavingsTransactionModel.deleteMany({}),
      LedgerEntryModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    if (replset) {
      await replset.stop();
    }
  });

  it("creates balanced ledger entries for deposit", async () => {
    const { token } = await registerAndLogin({
      firstName: "Alice",
      lastName: "Stone",
      userName: "alicestone",
      email: "alice@example.com"
    });

    const beforeMe = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    const initialBalance = beforeMe.body.data.balance;

    const depositResponse = await request(app)
      .post("/api/v1/transactions/deposit")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 500 });

    expect(depositResponse.statusCode).toBe(200);
    expect(depositResponse.body.success).toBe(true);
    expect(depositResponse.body.data.balance).toBe(initialBalance + 500);

    const user = await UserModel.findOne({ email: "alice@example.com" }).lean();
    const transaction = await TransactionModel.findOne({ type: "deposit", receiver: user._id }).lean();
    const ledgerEntries = await LedgerEntryModel.find({
      referenceType: "transaction",
      referenceId: transaction.transactionId
    }).lean();

    expect(ledgerEntries).toHaveLength(2);

    const totalDebits = ledgerEntries.reduce((sum, row) => sum + (row.debit || 0), 0);
    const totalCredits = ledgerEntries.reduce((sum, row) => sum + (row.credit || 0), 0);

    expect(totalDebits).toBe(500);
    expect(totalCredits).toBe(500);
  });

  it("moves funds between two users and records paired transfer ledger entries", async () => {
    const sender = await registerAndLogin({
      firstName: "John",
      lastName: "Doe",
      userName: "johndoe",
      email: "john@example.com"
    });

    const receiver = await registerAndLogin({
      firstName: "Mary",
      lastName: "Hill",
      userName: "maryhill",
      email: "mary@example.com"
    });

    const senderBefore = await UserModel.findOne({ email: "john@example.com" }).lean();
    const receiverBefore = await UserModel.findOne({ email: "mary@example.com" }).lean();

    const transferResponse = await request(app)
      .post("/api/v1/transactions/transfer")
      .set("Authorization", `Bearer ${sender.token}`)
      .send({ amount: 250, receiverAccountNumber: receiver.accountNumber });

    expect(transferResponse.statusCode).toBe(200);
    expect(transferResponse.body.success).toBe(true);

    const senderAfter = await UserModel.findOne({ email: "john@example.com" }).lean();
    const receiverAfter = await UserModel.findOne({ email: "mary@example.com" }).lean();

    expect(senderAfter.balance).toBe(senderBefore.balance - 250);
    expect(receiverAfter.balance).toBe(receiverBefore.balance + 250);

    const transferTx = await TransactionModel.findOne({
      type: "transfer",
      sender: senderAfter._id,
      receiver: receiverAfter._id
    }).lean();

    const ledgerEntries = await LedgerEntryModel.find({
      referenceType: "transaction",
      referenceId: transferTx.transactionId
    }).lean();

    expect(ledgerEntries).toHaveLength(2);
    expect(ledgerEntries.some((row) => row.userId && String(row.userId) === String(senderAfter._id) && row.credit === 250)).toBe(true);
    expect(ledgerEntries.some((row) => row.userId && String(row.userId) === String(receiverAfter._id) && row.debit === 250)).toBe(true);
  });

  it("moves funds from main to savings and journals user_main/user_savings entries", async () => {
    const { token } = await registerAndLogin({
      firstName: "Tina",
      lastName: "Mills",
      userName: "tinamills",
      email: "tina@example.com"
    });

    const beforeUser = await UserModel.findOne({ email: "tina@example.com" }).lean();

    const savingsDepositResponse = await request(app)
      .post("/api/v1/savings/deposit")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 300 });

    expect(savingsDepositResponse.statusCode).toBe(200);
    expect(savingsDepositResponse.body.success).toBe(true);

    const afterUser = await UserModel.findOne({ email: "tina@example.com" }).lean();
    expect(afterUser.balance).toBe(beforeUser.balance - 300);
    expect(afterUser.savingsBalance).toBe(beforeUser.savingsBalance + 300);

    const savingsTx = await SavingsTransactionModel.findOne({
      transactionId: savingsDepositResponse.body.data.transactionId
    }).lean();

    expect(savingsTx).toBeTruthy();

    const ledgerEntries = await LedgerEntryModel.find({
      referenceType: "savings_transaction",
      referenceId: savingsTx.transactionId
    }).lean();

    expect(ledgerEntries).toHaveLength(2);
    expect(ledgerEntries.some((row) => row.accountType === "user_savings" && row.debit === 300)).toBe(true);
    expect(ledgerEntries.some((row) => row.accountType === "user_main" && row.credit === 300)).toBe(true);
  });

  it("resets forgot-password and rejects old password", async () => {
    const email = "reset.case@example.com";
    const oldPassword = "securePass1";
    const newPassword = "securePass2";

    await registerAndLogin({
      firstName: "Reset",
      lastName: "Case",
      userName: "resetcase",
      email,
      password: oldPassword
    });

    const otpRequestResponse = await request(app)
      .post("/api/v1/auth/forgot-password/request")
      .send({ email });

    expect(otpRequestResponse.statusCode).toBe(200);
    expect(otpRequestResponse.body.success).toBe(true);
    expect(sendOtpEmail).toHaveBeenCalled();

    const lastCall = sendOtpEmail.mock.calls[sendOtpEmail.mock.calls.length - 1];
    const otp = lastCall[2];

    expect(otp).toMatch(/^\d{6}$/);

    const verifyResponse = await request(app)
      .post("/api/v1/auth/forgot-password/verify")
      .send({
        email,
        otp
      });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.body.success).toBe(true);
    expect(typeof verifyResponse.body.data.resetToken).toBe("string");

    const resetResponse = await request(app)
      .post("/api/v1/auth/forgot-password/reset")
      .send({
        resetToken: verifyResponse.body.data.resetToken,
        newPassword,
        confirmPassword: newPassword
      });

    expect(resetResponse.statusCode).toBe(200);
    expect(resetResponse.body.success).toBe(true);

    const oldPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: oldPassword });

    expect(oldPasswordLogin.statusCode).toBe(400);
    expect(oldPasswordLogin.body.success).toBe(false);

    const newPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: newPassword });

    expect(newPasswordLogin.statusCode).toBe(200);
    expect(newPasswordLogin.body.success).toBe(true);
    expect(typeof newPasswordLogin.body.data.token).toBe("string");
  });

  it("changes password while logged in without OTP", async () => {
    const email = "change.password@example.com";
    const currentPassword = "securePass1";
    const newPassword = "securePass9";

    const { token } = await registerAndLogin({
      firstName: "Change",
      lastName: "Password",
      userName: "changepassworduser",
      email,
      password: currentPassword
    });

    const changePasswordResponse = await request(app)
      .post("/api/v1/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword,
        newPassword
      });

    expect(changePasswordResponse.statusCode).toBe(200);
    expect(changePasswordResponse.body.success).toBe(true);

    const oldPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: currentPassword });

    expect(oldPasswordLogin.statusCode).toBe(400);
    expect(oldPasswordLogin.body.success).toBe(false);

    const newPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: newPassword });

    expect(newPasswordLogin.statusCode).toBe(200);
    expect(newPasswordLogin.body.success).toBe(true);
    expect(typeof newPasswordLogin.body.data.token).toBe("string");
  });
});