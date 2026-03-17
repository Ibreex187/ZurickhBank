const TransactionModel = require('../models/transaction.model');
const SavingsTransactionModel = require('../models/savings.transaction.model');
const InvestmentModel = require('../models/investment.model');

const THRESHOLDS = {
  MINIMUM_BALANCE: 100000,          // ₦100,000 main balance
  MINIMUM_SAVINGS: 10000,           // ₦10,000 savings balance
  MINIMUM_TRANSACTIONS: 10,         // 10 completed main transactions
  MINIMUM_SAVINGS_TRANSACTIONS: 5,  // 5 completed savings transactions
  MINIMUM_BENEFICIARIES: 1,         // at least 1 saved beneficiary
  HAS_ACTIVE_INVESTMENT: true       // at least one active investment
};

/**
 * Calculate whether a user qualifies for Premium Member status
 * based on their live bank activity.
 * @param {Object} user - Mongoose user document
 * @returns {Promise<Object>} premiumStatus
 */
const calculatePremiumStatus = async (user) => {
  const userId = user._id;

  const [completedTxCount, completedSavingsTxCount, activeInvestmentCount] = await Promise.all([
    TransactionModel.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }],
      status: 'completed'
    }),
    SavingsTransactionModel.countDocuments({
      userId,
      status: 'completed'
    }),
    InvestmentModel.countDocuments({
      userId,
      status: 'active'
    })
  ]);

  const qualifications = {
    sufficientBalance: (user.balance || 0) >= THRESHOLDS.MINIMUM_BALANCE,
    sufficientSavings: (user.savingsBalance || 0) >= THRESHOLDS.MINIMUM_SAVINGS,
    sufficientTransactions: completedTxCount >= THRESHOLDS.MINIMUM_TRANSACTIONS,
    sufficientSavingsTransactions: completedSavingsTxCount >= THRESHOLDS.MINIMUM_SAVINGS_TRANSACTIONS,
    hasBeneficiaries: (user.beneficiaries ? user.beneficiaries.length : 0) >= THRESHOLDS.MINIMUM_BENEFICIARIES,
    hasActiveInvestment: activeInvestmentCount > 0
  };

  const passCount = Object.values(qualifications).filter(Boolean).length;

  // Must meet at least 3 of 6 criteria AND have at minimum either sufficient balance or savings
  const isPremium =
    passCount >= 3 &&
    (qualifications.sufficientBalance || qualifications.sufficientSavings);

  return {
    isPremium,
    qualifications,
    metrics: {
      balance: user.balance || 0,
      savingsBalance: user.savingsBalance || 0,
      completedTransactions: completedTxCount,
      completedSavingsTransactions: completedSavingsTxCount,
      beneficiariesCount: user.beneficiaries ? user.beneficiaries.length : 0,
      activeInvestments: activeInvestmentCount
    },
    thresholds: THRESHOLDS
  };
};

module.exports = { calculatePremiumStatus };
