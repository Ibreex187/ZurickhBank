const { validationResult } = require("express-validator");
const {
    depositRules,
    withdrawRules,
    transferRules,
    MAX_TRANSACTION_AMOUNT,
} = require("../validators/validation.rules");

// Runs express-validator rules against a fake request and returns the error messages.
// Mirrors the helper in tests/pagination.test.js, but against req.body since these are body() rules.
const runRules = async (rules, body) => {
    const req = { body: { ...body } };

    for (const rule of rules) {
        await rule.run(req);
    }

    return {
        req,
        errors: validationResult(req).array().map((error) => error.msg),
    };
};

// Regression test: main-account deposit/withdraw/transfer only ever enforced a *minimum* amount
// (0.01), never a maximum - a real deposit through the app's own UI went through unchecked and
// produced a multi-quintillion-naira balance. Savings deposits already capped at 1,000,000
// (routers/savings.routes.js); this brings the main account in line with that, at a higher
// ceiling since main-account transfers already support tier3's 30,000,000/month.
describe("Main-account transaction amount ceiling", () => {
    const VALID_PIN = "1234";

    it("rejects a deposit above MAX_TRANSACTION_AMOUNT", async () => {
        const { errors } = await runRules(depositRules(), {
            amount: MAX_TRANSACTION_AMOUNT + 1,
            transactionPin: VALID_PIN,
        });

        expect(errors).toEqual(
            expect.arrayContaining([expect.stringContaining("no more than")])
        );
    });

    it("rejects the exact absurd amount reported by a real deposit", async () => {
        const { errors } = await runRules(depositRules(), {
            amount: 5526626262626262600000000,
            transactionPin: VALID_PIN,
        });

        expect(errors.length).toBeGreaterThan(0);
    });

    it("accepts a deposit right at MAX_TRANSACTION_AMOUNT", async () => {
        const { errors } = await runRules(depositRules(), {
            amount: MAX_TRANSACTION_AMOUNT,
            transactionPin: VALID_PIN,
        });

        expect(errors).toEqual([]);
    });

    it("still accepts an ordinary deposit amount", async () => {
        const { errors } = await runRules(depositRules(), {
            amount: 500,
            transactionPin: VALID_PIN,
        });

        expect(errors).toEqual([]);
    });

    it("rejects a withdrawal above MAX_TRANSACTION_AMOUNT", async () => {
        const { errors } = await runRules(withdrawRules(), {
            amount: MAX_TRANSACTION_AMOUNT + 1,
            transactionPin: VALID_PIN,
        });

        expect(errors).toEqual(
            expect.arrayContaining([expect.stringContaining("no more than")])
        );
    });

    it("rejects a transfer above MAX_TRANSACTION_AMOUNT", async () => {
        const { errors } = await runRules(transferRules(), {
            amount: MAX_TRANSACTION_AMOUNT + 1,
            receiverAccountNumber: "1234567890",
            transactionPin: VALID_PIN,
        });

        expect(errors).toEqual(
            expect.arrayContaining([expect.stringContaining("no more than")])
        );
    });

    it("still accepts an ordinary transfer amount", async () => {
        const { errors } = await runRules(transferRules(), {
            amount: 25000,
            receiverAccountNumber: "1234567890",
            transactionPin: VALID_PIN,
        });

        expect(errors).toEqual([]);
    });
});
