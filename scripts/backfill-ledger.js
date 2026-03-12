require("dotenv").config();

const mongoose = require("mongoose");
const { connectToDatabase } = require("../utils/db");
const TransactionModel = require("../models/transaction.model");
const SavingsTransactionModel = require("../models/savings.transaction.model");
const LedgerEntryModel = require("../models/ledger.entry.model");

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const parseArgs = () => {
    const rawArgs = process.argv.slice(2);
    const args = new Set(rawArgs);

    return {
        dryRun: args.has("--dry-run"),
        includeFailed: args.has("--include-failed")
    };
};

const getExistingReferenceSet = async (referenceType) => {
    const docs = await LedgerEntryModel.find({ referenceType })
        .select("referenceId")
        .lean();

    return new Set(docs.map((doc) => String(doc.referenceId)));
};

const buildTransactionLedgerEntries = (transaction) => {
    const amount = roundMoney(transaction.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        return { skipReason: "invalid_amount", entries: [] };
    }

    if (transaction.type === "deposit") {
        if (!transaction.receiver) {
            return { skipReason: "missing_receiver_for_deposit", entries: [] };
        }

        return {
            entries: [
                {
                    accountType: "user_main",
                    userId: transaction.receiver,
                    debit: amount,
                    credit: 0
                },
                {
                    accountType: "system_cash_reserve",
                    userId: null,
                    debit: 0,
                    credit: amount
                }
            ]
        };
    }

    if (transaction.type === "withdraw") {
        if (!transaction.sender) {
            return { skipReason: "missing_sender_for_withdraw", entries: [] };
        }

        return {
            entries: [
                {
                    accountType: "system_cash_reserve",
                    userId: null,
                    debit: amount,
                    credit: 0
                },
                {
                    accountType: "user_main",
                    userId: transaction.sender,
                    debit: 0,
                    credit: amount
                }
            ]
        };
    }

    if (transaction.type === "transfer") {
        if (!transaction.sender || !transaction.receiver) {
            return { skipReason: "missing_sender_or_receiver_for_transfer", entries: [] };
        }

        return {
            entries: [
                {
                    accountType: "user_main",
                    userId: transaction.receiver,
                    debit: amount,
                    credit: 0
                },
                {
                    accountType: "user_main",
                    userId: transaction.sender,
                    debit: 0,
                    credit: amount
                }
            ]
        };
    }

    return { skipReason: "unsupported_transaction_type", entries: [] };
};

const buildSavingsLedgerEntries = (transaction) => {
    const amount = roundMoney(transaction.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        return { skipReason: "invalid_amount", entries: [] };
    }

    if (!transaction.userId) {
        return { skipReason: "missing_user", entries: [] };
    }

    if (transaction.type === "deposit") {
        return {
            entries: [
                {
                    accountType: "user_savings",
                    userId: transaction.userId,
                    debit: amount,
                    credit: 0
                },
                {
                    accountType: "user_main",
                    userId: transaction.userId,
                    debit: 0,
                    credit: amount
                }
            ]
        };
    }

    if (transaction.type === "withdraw") {
        return {
            entries: [
                {
                    accountType: "user_main",
                    userId: transaction.userId,
                    debit: amount,
                    credit: 0
                },
                {
                    accountType: "user_savings",
                    userId: transaction.userId,
                    debit: 0,
                    credit: amount
                }
            ]
        };
    }

    return { skipReason: "unsupported_savings_type", entries: [] };
};

const buildLedgerDocs = ({
    journalId,
    referenceType,
    referenceId,
    description,
    sourceCreatedAt,
    entries,
    metadata
}) => {
    const createdAt = sourceCreatedAt ? new Date(sourceCreatedAt) : new Date();

    return entries.map((entry) => ({
        journalId,
        referenceType,
        referenceId,
        description,
        accountType: entry.accountType,
        userId: entry.userId || null,
        debit: roundMoney(entry.debit || 0),
        credit: roundMoney(entry.credit || 0),
        currency: "NGN",
        metadata,
        createdAt,
        updatedAt: createdAt
    }));
};

const increment = (counterMap, key) => {
    const current = counterMap[key] || 0;
    counterMap[key] = current + 1;
};

const backfillTransactions = async ({ dryRun, includeFailed }) => {
    const existingRefs = await getExistingReferenceSet("transaction");
    const query = includeFailed ? {} : { status: "completed" };
    const transactions = await TransactionModel.find(query)
        .select("transactionId type amount sender receiver status date createdAt")
        .sort({ createdAt: 1 })
        .lean();

    const docsToInsert = [];
    const skipReasons = {};
    let skippedExisting = 0;

    for (const tx of transactions) {
        const referenceId = String(tx.transactionId || "").trim();
        if (!referenceId) {
            increment(skipReasons, "missing_transaction_id");
            continue;
        }

        if (existingRefs.has(referenceId)) {
            skippedExisting += 1;
            continue;
        }

        const mapped = buildTransactionLedgerEntries(tx);
        if (!mapped.entries || mapped.entries.length === 0) {
            increment(skipReasons, mapped.skipReason || "unmapped_transaction");
            continue;
        }

        const journalId = tx.transactionId;
        const sourceCreatedAt = tx.date || tx.createdAt;
        const description = `Backfilled: ${tx.type} transaction`;

        docsToInsert.push(
            ...buildLedgerDocs({
                journalId,
                referenceType: "transaction",
                referenceId,
                description,
                sourceCreatedAt,
                entries: mapped.entries,
                metadata: {
                    source: "legacy_backfill",
                    originalCollection: "transactions",
                    originalStatus: tx.status || null
                }
            })
        );

        existingRefs.add(referenceId);
    }

    if (!dryRun && docsToInsert.length > 0) {
        await LedgerEntryModel.insertMany(docsToInsert, { ordered: false });
    }

    return {
        scanned: transactions.length,
        insertedLedgerRows: docsToInsert.length,
        insertedReferences: docsToInsert.length / 2,
        skippedExisting,
        skippedByReason: skipReasons
    };
};

const backfillSavingsTransactions = async ({ dryRun, includeFailed }) => {
    const existingRefs = await getExistingReferenceSet("savings_transaction");
    const query = includeFailed ? {} : { status: "completed" };
    const savingsTransactions = await SavingsTransactionModel.find(query)
        .select("transactionId type amount userId status createdAt")
        .sort({ createdAt: 1 })
        .lean();

    const docsToInsert = [];
    const skipReasons = {};
    let skippedExisting = 0;

    for (const tx of savingsTransactions) {
        const referenceId = String(tx.transactionId || "").trim();
        if (!referenceId) {
            increment(skipReasons, "missing_transaction_id");
            continue;
        }

        if (existingRefs.has(referenceId)) {
            skippedExisting += 1;
            continue;
        }

        const mapped = buildSavingsLedgerEntries(tx);
        if (!mapped.entries || mapped.entries.length === 0) {
            increment(skipReasons, mapped.skipReason || "unmapped_savings_transaction");
            continue;
        }

        const journalId = tx.transactionId;
        const description = `Backfilled: savings ${tx.type}`;

        docsToInsert.push(
            ...buildLedgerDocs({
                journalId,
                referenceType: "savings_transaction",
                referenceId,
                description,
                sourceCreatedAt: tx.createdAt,
                entries: mapped.entries,
                metadata: {
                    source: "legacy_backfill",
                    originalCollection: "savingstransactions",
                    originalStatus: tx.status || null
                }
            })
        );

        existingRefs.add(referenceId);
    }

    if (!dryRun && docsToInsert.length > 0) {
        await LedgerEntryModel.insertMany(docsToInsert, { ordered: false });
    }

    return {
        scanned: savingsTransactions.length,
        insertedLedgerRows: docsToInsert.length,
        insertedReferences: docsToInsert.length / 2,
        skippedExisting,
        skippedByReason: skipReasons
    };
};

const printReport = ({ dryRun, includeFailed, txReport, savingsReport }) => {
    const formatSkipReasons = (skipReasonMap) => {
        const entries = Object.entries(skipReasonMap || {});
        if (entries.length === 0) {
            return "none";
        }

        return entries.map(([reason, count]) => `${reason}: ${count}`).join(", ");
    };

    console.log("\n=== Ledger Backfill Report ===");
    console.log(`Mode: ${dryRun ? "DRY RUN" : "WRITE"}`);
    console.log(`Include failed statuses: ${includeFailed ? "yes" : "no"}`);

    console.log("\n[transaction]");
    console.log(`scanned: ${txReport.scanned}`);
    console.log(`inserted references: ${txReport.insertedReferences}`);
    console.log(`inserted ledger rows: ${txReport.insertedLedgerRows}`);
    console.log(`skipped existing: ${txReport.skippedExisting}`);
    console.log(`skipped reasons: ${formatSkipReasons(txReport.skippedByReason)}`);

    console.log("\n[savings_transaction]");
    console.log(`scanned: ${savingsReport.scanned}`);
    console.log(`inserted references: ${savingsReport.insertedReferences}`);
    console.log(`inserted ledger rows: ${savingsReport.insertedLedgerRows}`);
    console.log(`skipped existing: ${savingsReport.skippedExisting}`);
    console.log(`skipped reasons: ${formatSkipReasons(savingsReport.skippedByReason)}`);

    console.log("\n[investment_trade]");
    console.log("skipped: historical investment trades cannot be deterministically reconstructed from current schema.");
    console.log("reason: buy/sell events are not persisted as independent trade records with stable reference IDs.");
};

const run = async () => {
    const { dryRun, includeFailed } = parseArgs();

    try {
        await connectToDatabase();

        const txReport = await backfillTransactions({ dryRun, includeFailed });
        const savingsReport = await backfillSavingsTransactions({ dryRun, includeFailed });

        printReport({ dryRun, includeFailed, txReport, savingsReport });
    } catch (error) {
        console.error("Backfill failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

run();