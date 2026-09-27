// One-off migration: re-issues every existing user a UK-format 8-digit account number, replacing
// the old 10-digit ones. Needed because the account number length changed (see
// utils/bankIdentity.js) and the Mongoose schema's own validation now rejects the old format, so
// existing users would otherwise be stuck with an accountNumber value the schema itself considers
// invalid the next time they're saved.
//
// Beneficiary relationships are stored by user ObjectId (see models/user.model.js), not by
// account number, so re-issuing account numbers does not break anyone's saved beneficiaries.
//
// Usage:
//   node scripts/migrate-account-numbers-to-uk-format.js --dry-run   (preview only, no writes)
//   node scripts/migrate-account-numbers-to-uk-format.js             (writes the new numbers)
require("dotenv").config();

const mongoose = require("mongoose");
const { connectToDatabase } = require("../utils/db");
const UserModel = require("../models/user.model");
const { ACCOUNT_NUMBER_MIN, ACCOUNT_NUMBER_MAX, ACCOUNT_NUMBER_LENGTH } = require("../utils/bankIdentity");

const parseArgs = () => {
    const args = new Set(process.argv.slice(2));
    return { dryRun: args.has("--dry-run") };
};

const isAlreadyNewFormat = (accountNumber) =>
    new RegExp(`^\\d{${ACCOUNT_NUMBER_LENGTH}}$`).test(String(accountNumber || ""));

const generateAccountNumber = () => {
    const generated = Math.floor(ACCOUNT_NUMBER_MIN + Math.random() * (ACCOUNT_NUMBER_MAX - ACCOUNT_NUMBER_MIN + 1));
    return String(generated).padStart(ACCOUNT_NUMBER_LENGTH, "0");
};

// Generates a number not already used by anyone (checked against both what's already in the
// database and what this run has already handed out to an earlier user in the same pass).
const generateUniqueAccountNumber = async (reservedInThisRun) => {
    const maxAttempts = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidate = generateAccountNumber();
        if (reservedInThisRun.has(candidate)) continue;

        // eslint-disable-next-line no-await-in-loop
        const collision = await UserModel.exists({ accountNumber: candidate });
        if (!collision) {
            reservedInThisRun.add(candidate);
            return candidate;
        }
    }

    throw new Error(`Could not generate a unique ${ACCOUNT_NUMBER_LENGTH}-digit account number after ${maxAttempts} attempts`);
};

const run = async () => {
    const { dryRun } = parseArgs();
    const reservedInThisRun = new Set();
    const changes = [];
    let alreadyCorrect = 0;

    try {
        await connectToDatabase();

        const users = await UserModel.find({}).select("_id email userName accountNumber");

        for (const user of users) {
            if (isAlreadyNewFormat(user.accountNumber)) {
                alreadyCorrect += 1;
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            const newAccountNumber = await generateUniqueAccountNumber(reservedInThisRun);
            changes.push({
                userName: user.userName,
                email: user.email,
                oldAccountNumber: user.accountNumber,
                newAccountNumber,
            });

            if (!dryRun) {
                // eslint-disable-next-line no-await-in-loop
                await UserModel.updateOne({ _id: user._id }, { $set: { accountNumber: newAccountNumber } });
            }
        }

        console.log("\n=== Account Number Migration Report ===");
        console.log(`Mode: ${dryRun ? "DRY RUN (no writes made)" : "WRITE"}`);
        console.log(`Total users: ${users.length}`);
        console.log(`Already ${ACCOUNT_NUMBER_LENGTH}-digit (skipped): ${alreadyCorrect}`);
        console.log(`Migrated: ${changes.length}`);

        if (changes.length > 0) {
            console.log("\nuserName | email | old -> new");
            for (const change of changes) {
                console.log(`${change.userName} | ${change.email} | ${change.oldAccountNumber} -> ${change.newAccountNumber}`);
            }
        }
    } catch (error) {
        console.error("Migration failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

run();
