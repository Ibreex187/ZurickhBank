// Single source of truth for "what does a Zurich Bank account number look like", so the
// generator, the Mongoose schema, every validator and every place that displays an account
// number all agree with each other instead of each hardcoding the same digit count separately.
//
// SORT_CODE is fixed and shared by every account: a real UK sort code identifies the bank/branch,
// not the individual customer, so - unlike the account number - it is not generated per user and
// does not need to be entered when adding a beneficiary or making a transfer within this single
// demo bank (there is no other bank to route to). It exists purely so the app looks and reads like
// a real UK account identity wherever one is displayed.
const SORT_CODE_DISPLAY = "04-00-04";
const SORT_CODE_DIGITS = "040004";

const ACCOUNT_NUMBER_LENGTH = 8;
const ACCOUNT_NUMBER_MIN = 10000000;
const ACCOUNT_NUMBER_MAX = 99999999;

const CURRENCY_CODE = "GBP";
const CURRENCY_SYMBOL = "£"; // £

module.exports = {
    SORT_CODE_DISPLAY,
    SORT_CODE_DIGITS,
    ACCOUNT_NUMBER_LENGTH,
    ACCOUNT_NUMBER_MIN,
    ACCOUNT_NUMBER_MAX,
    CURRENCY_CODE,
    CURRENCY_SYMBOL,
};
