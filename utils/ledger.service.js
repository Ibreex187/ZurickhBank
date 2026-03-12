const { randomUUID } = require("crypto");
const LedgerEntryModel = require("../models/ledger.entry.model");

const EPSILON = 0.000001;

const roundMoney = (value) => {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
};

const postJournal = async ({
    session,
    referenceType,
    referenceId,
    description,
    entries,
    currency = "NGN",
    metadata = {}
}) => {
    if (!Array.isArray(entries) || entries.length < 2) {
        throw new Error("Ledger journal must contain at least 2 entries");
    }

    const journalId = randomUUID();

    let totalDebits = 0;
    let totalCredits = 0;

    const normalizedEntries = entries.map((entry) => {
        const debit = roundMoney(entry.debit || 0);
        const credit = roundMoney(entry.credit || 0);

        if (debit < 0 || credit < 0) {
            throw new Error("Ledger amounts cannot be negative");
        }

        if ((debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
            throw new Error("Each ledger entry must be either a debit or a credit");
        }

        totalDebits += debit;
        totalCredits += credit;

        return {
            journalId,
            referenceType,
            referenceId,
            description,
            accountType: entry.accountType,
            userId: entry.userId || null,
            debit,
            credit,
            currency,
            metadata: {
                ...metadata,
                ...(entry.metadata || {})
            }
        };
    });

    if (Math.abs(roundMoney(totalDebits) - roundMoney(totalCredits)) > EPSILON) {
        throw new Error("Unbalanced ledger journal: total debits must equal total credits");
    }

    await LedgerEntryModel.insertMany(normalizedEntries, { session });

    return {
        journalId,
        totalDebits: roundMoney(totalDebits),
        totalCredits: roundMoney(totalCredits)
    };
};

module.exports = {
    postJournal
};
