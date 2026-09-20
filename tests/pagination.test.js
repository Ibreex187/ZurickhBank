const { validationResult } = require("express-validator");
const { parsePagination, escapeRegex, MAX_LIMIT, MAX_PAGE } = require("../utils/pagination");
const { transactionHistoryRules, dateRangeRules } = require("../validators/validation.rules");

// Runs express-validator rules against a fake request and returns the error messages
const runRules = async (rules, query) => {
    const req = { query: { ...query } };

    for (const rule of rules) {
        await rule.run(req);
    }

    return {
        req,
        errors: validationResult(req).array().map((error) => error.msg)
    };
};

describe("parsePagination", () => {
    it("uses defaults when nothing is provided", () => {
        expect(parsePagination({})).toEqual({ page: 1, limit: 10, skip: 0 });
        expect(parsePagination(undefined, { defaultLimit: 20 })).toEqual({ page: 1, limit: 20, skip: 0 });
    });

    it("reads valid values, including strings from a query string", () => {
        expect(parsePagination({ page: "3", limit: "25" })).toEqual({ page: 3, limit: 25, skip: 50 });
    });

    it("never returns more than the maximum page size", () => {
        expect(parsePagination({ limit: "500" }).limit).toBe(MAX_LIMIT);
        expect(parsePagination({ limit: "999999999" }).limit).toBe(MAX_LIMIT);
        expect(parsePagination({ limit: "500" }, { maxLimit: 50 }).limit).toBe(50);
    });

    it("falls back to defaults for zero, negative and non-numeric values", () => {
        expect(parsePagination({ page: "0", limit: "0" })).toEqual({ page: 1, limit: 10, skip: 0 });
        expect(parsePagination({ page: "-5", limit: "-1" })).toEqual({ page: 1, limit: 10, skip: 0 });
        expect(parsePagination({ page: "abc", limit: "xyz" })).toEqual({ page: 1, limit: 10, skip: 0 });
        expect(parsePagination({ page: ["2", "3"], limit: {} }).skip).toBeGreaterThanOrEqual(0);
    });

    it("caps the page number so skip stays sane", () => {
        expect(parsePagination({ page: "99999999999" }).page).toBe(MAX_PAGE);
    });
});

describe("escapeRegex", () => {
    it("lets text that looks like a pattern be matched literally", () => {
        const dangerous = ["(", "[a-", "a{2,1}", "*", "(a+)+$", "\\", "a.b"];

        for (const text of dangerous) {
            expect(() => new RegExp(escapeRegex(text), "i")).not.toThrow();
        }
    });

    it("throws without escaping but not with it", () => {
        expect(() => new RegExp("(", "i")).toThrow();
        expect(() => new RegExp(escapeRegex("("), "i")).not.toThrow();
        expect(() => new RegExp(escapeRegex("[a-"), "i")).not.toThrow();
    });

    it("matches special characters literally instead of as wildcards", () => {
        expect(new RegExp(escapeRegex("a.b"), "i").test("a.b")).toBe(true);
        expect(new RegExp(escapeRegex("a.b"), "i").test("axb")).toBe(false);
        expect(new RegExp(escapeRegex(".*"), "i").test("anything")).toBe(false);
    });

    it("still matches normal names case-insensitively", () => {
        expect(new RegExp(escapeRegex("ada"), "i").test("Ada Obi")).toBe(true);
    });
});

describe("transactionHistoryRules", () => {
    it("accepts what the frontend actually sends", async () => {
        const { errors, req } = await runRules(transactionHistoryRules(), {
            page: "2",
            limit: "10",
            startDate: "2026-09-01",
            endDate: "2026-09-30",
            minAmount: "100",
            maxAmount: "5000",
            search: "ada",
            searchBy: "recipient"
        });

        expect(errors).toEqual([]);
        expect(req.query.page).toBe(2); // converted to numbers by the rules
        expect(req.query.limit).toBe(10);
    });

    it("accepts an empty request", async () => {
        const { errors } = await runRules(transactionHistoryRules(), {});
        expect(errors).toEqual([]);
    });

    it("rejects a page size above 100", async () => {
        const { errors } = await runRules(transactionHistoryRules(), { limit: "500" });
        expect(errors).toContain("limit must be between 1 and 100");
    });

    it("rejects zero, negative and non-numeric paging", async () => {
        for (const limit of ["0", "-1", "abc", "1.5"]) {
            const { errors } = await runRules(transactionHistoryRules(), { limit });
            expect(errors).toContain("limit must be between 1 and 100");
        }

        for (const page of ["0", "-5", "abc"]) {
            const { errors } = await runRules(transactionHistoryRules(), { page });
            expect(errors).toContain("page must be a positive integer");
        }
    });

    it("rejects invalid dates instead of letting them reach the database", async () => {
        const { errors } = await runRules(transactionHistoryRules(), { startDate: "not-a-date", endDate: "31/31/2026" });
        expect(errors).toEqual(expect.arrayContaining(["startDate must be a valid ISO date", "endDate must be a valid ISO date"]));
    });

    it("rejects bad amounts, unknown searchBy and over-long search text", async () => {
        const { errors } = await runRules(transactionHistoryRules(), {
            minAmount: "abc",
            maxAmount: "-5",
            searchBy: "everything",
            search: "x".repeat(101)
        });

        expect(errors).toEqual(
            expect.arrayContaining([
                "minAmount must be a non-negative number",
                "maxAmount must be a non-negative number",
                "searchBy is invalid",
                "search cannot exceed 100 characters"
            ])
        );
    });

    it("rejects a repeated search parameter (an array) rather than crashing", async () => {
        const { errors } = await runRules(transactionHistoryRules(), { search: ["a", "b"] });
        expect(errors).toContain("search must be text");
    });
});

describe("dateRangeRules (used by the summary endpoint)", () => {
    it("accepts ISO dates and rejects garbage", async () => {
        expect((await runRules(dateRangeRules(), { startDate: "2026-09-01T00:00:00.000Z" })).errors).toEqual([]);
        expect((await runRules(dateRangeRules(), { startDate: "abc" })).errors).toContain("startDate must be a valid ISO date");
    });
});
