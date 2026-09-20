// End-to-end checks of the real GET /api/v1/transactions/history route.
// The requests below are rejected by validation before any database call,
// so no database is needed. That is also what proves the rules are wired to the route.
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

jest.mock("uuid", () => ({
    v4: () => "test-uuid"
}));

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

const app = require("../app");

const token = jwt.sign({ userId: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET);
const getHistory = (query) =>
    request(app).get("/api/v1/transactions/history").query(query).set("Authorization", `Bearer ${token}`);

describe("GET /api/v1/transactions/history validation", () => {
    it("still requires authentication", async () => {
        const response = await request(app).get("/api/v1/transactions/history");
        expect(response.statusCode).toBe(401);
    });

    it("rejects a page size above 100", async () => {
        const response = await getHistory({ limit: 500 });

        expect(response.statusCode).toBe(400);
        expect(response.body.errors.map((e) => e.message)).toContain("limit must be between 1 and 100");
        expect(response.body.errors[0].field).toBe("limit"); // the field name is reported too
    });

    it("rejects a huge page size", async () => {
        const response = await getHistory({ limit: 999999999 });
        expect(response.statusCode).toBe(400);
    });

    it("rejects zero and negative paging instead of returning everything or erroring", async () => {
        expect((await getHistory({ limit: 0 })).statusCode).toBe(400);
        expect((await getHistory({ limit: -1 })).statusCode).toBe(400);
        expect((await getHistory({ page: 0 })).statusCode).toBe(400);
        expect((await getHistory({ page: -5 })).statusCode).toBe(400);
    });

    it("rejects an invalid date instead of crashing later", async () => {
        const response = await getHistory({ startDate: "not-a-date" });

        expect(response.statusCode).toBe(400);
        expect(response.body.errors.map((e) => e.message)).toContain("startDate must be a valid ISO date");
    });

    it("rejects over-long search text", async () => {
        const response = await getHistory({ search: "x".repeat(101) });
        expect(response.statusCode).toBe(400);
    });
});

describe("GET /api/v1/transactions/history/summary validation", () => {
    it("rejects an invalid date range", async () => {
        const response = await request(app)
            .get("/api/v1/transactions/history/summary")
            .query({ startDate: "abc" })
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(400);
    });
});
