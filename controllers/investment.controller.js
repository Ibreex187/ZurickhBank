const UserModel = require("../models/user.model");
const InvestmentModel = require("../models/investment.model");
const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const { postJournal } = require("../utils/ledger.service");

// Mock stock data - in real app, this would come from a stock API
const MOCK_STOCKS = {
    'AAPL': { name: 'Apple Inc.', basePrice: 150.00 },
    'GOOGL': { name: 'Alphabet Inc.', basePrice: 2800.00 },
    'MSFT': { name: 'Microsoft Corp.', basePrice: 300.00 },
    'TSLA': { name: 'Tesla Inc.', basePrice: 200.00 },
    'AMZN': { name: 'Amazon.com Inc.', basePrice: 3200.00 },
    'META': { name: 'Meta Platforms Inc.', basePrice: 250.00 },
    'NFLX': { name: 'Netflix Inc.', basePrice: 400.00 },
    'NVDA': { name: 'NVIDIA Corp.', basePrice: 800.00 }
};

// Simulate real-time stock price fluctuations
function getCurrentStockPrice(symbol) {
    const stock = MOCK_STOCKS[symbol];
    if (!stock) return null;
    
    // Simulate price fluctuation between -5% to +5%
    const fluctuation = (Math.random() - 0.5) * 0.1; // -5% to +5%
    const currentPrice = stock.basePrice * (1 + fluctuation);
    return Math.round(currentPrice * 100) / 100; // Round to 2 decimal places
}

// Get all available stocks
exports.getAvailableStocks = async (req, res) => {
    try {
        const stocks = Object.keys(MOCK_STOCKS).map(symbol => ({
            symbol,
            name: MOCK_STOCKS[symbol].name,
            currentPrice: getCurrentStockPrice(symbol),
            basePrice: MOCK_STOCKS[symbol].basePrice
        }));

        res.status(200).send({
            success: true,
            message: "Available stocks retrieved successfully",
            data: stocks
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving stocks"
        });
    }
};

// Buy stocks
exports.buyStock = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const { stockSymbol, quantity } = req.body;
        const userId = req.user.userId;
        const parsedQuantity = Number(quantity);

        if (!stockSymbol || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).send({
                success: false,
                message: "Valid stock symbol and quantity are required"
            });
        }

        const stock = MOCK_STOCKS[stockSymbol.toUpperCase()];

        if (!stock) {
            return res.status(400).send({
                success: false,
                message: "Invalid stock symbol"
            });
        }

        const currentPrice = getCurrentStockPrice(stockSymbol.toUpperCase());
        const totalCost = currentPrice * parsedQuantity;
        const tradeReferenceId = `INV_BUY_${randomUUID()}`;

        let user;
        await session.withTransaction(async () => {
            user = await UserModel.findById(userId).session(session);
            if (!user) {
                const error = new Error("User not found");
                error.statusCode = 404;
                throw error;
            }

            if (user.balance < totalCost) {
                const error = new Error("Insufficient balance to buy stocks");
                error.statusCode = 400;
                error.details = {
                    required: totalCost,
                    available: user.balance
                };
                throw error;
            }

            const existingInvestment = await InvestmentModel.findOne({
                userId,
                stockSymbol: stockSymbol.toUpperCase(),
                status: 'active'
            }).session(session);

            if (existingInvestment) {
                const newTotalQuantity = existingInvestment.quantity + parsedQuantity;
                const newTotalInvested = existingInvestment.totalInvested + totalCost;
                const newAveragePrice = newTotalInvested / newTotalQuantity;

                existingInvestment.quantity = newTotalQuantity;
                existingInvestment.totalInvested = newTotalInvested;
                existingInvestment.purchasePrice = Math.round(newAveragePrice * 100) / 100;
                await existingInvestment.save({ session });
            } else {
                const newInvestment = new InvestmentModel({
                    userId,
                    stockSymbol: stockSymbol.toUpperCase(),
                    stockName: stock.name,
                    quantity: parsedQuantity,
                    purchasePrice: currentPrice,
                    totalInvested: totalCost
                });
                await newInvestment.save({ session });
            }

            user.balance -= totalCost;
            await user.save({ session });

            await postJournal({
                session,
                referenceType: "investment_trade",
                referenceId: tradeReferenceId,
                description: "Buy investment asset with main balance",
                entries: [
                    {
                        accountType: "system_investment_reserve",
                        debit: totalCost,
                        metadata: {
                            stockSymbol: stockSymbol.toUpperCase(),
                            quantity: parsedQuantity,
                            side: "buy"
                        }
                    },
                    {
                        accountType: "user_main",
                        userId,
                        credit: totalCost,
                        metadata: {
                            stockSymbol: stockSymbol.toUpperCase(),
                            quantity: parsedQuantity,
                            side: "buy"
                        }
                    }
                ]
            });
        });

        res.status(200).send({
            success: true,
            message: "Stock purchased successfully",
            data: {
                stockSymbol: stockSymbol.toUpperCase(),
                stockName: stock.name,
                quantity: parsedQuantity,
                pricePerShare: currentPrice,
                totalCost,
                tradeReferenceId,
                remainingBalance: user.balance
            }
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).send({
                success: false,
                message: error.message,
                ...(error.details || {})
            });
        }
        res.status(500).send({
            success: false,
            message: "Error buying stock"
        });
    } finally {
        await session.endSession();
    }
};

// Sell stocks
exports.sellStock = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const { stockSymbol, quantity } = req.body;
        const userId = req.user.userId;
        const parsedQuantity = Number(quantity);

        if (!stockSymbol || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).send({
                success: false,
                message: "Valid stock symbol and quantity are required"
            });
        }

        const currentPrice = getCurrentStockPrice(stockSymbol.toUpperCase());
        const tradeReferenceId = `INV_SELL_${randomUUID()}`;
        let saleValue;
        let profitLoss;
        let user;

        await session.withTransaction(async () => {
            const investment = await InvestmentModel.findOne({
                userId,
                stockSymbol: stockSymbol.toUpperCase(),
                status: 'active'
            }).session(session);

            if (!investment) {
                const error = new Error("No active investment found for this stock");
                error.statusCode = 404;
                throw error;
            }

            if (investment.quantity < parsedQuantity) {
                const error = new Error("Cannot sell more shares than owned");
                error.statusCode = 400;
                error.details = {
                    owned: investment.quantity,
                    requestedToSell: parsedQuantity
                };
                throw error;
            }

            saleValue = currentPrice * parsedQuantity;
            const avgPurchasePrice = investment.purchasePrice;
            profitLoss = (currentPrice - avgPurchasePrice) * parsedQuantity;

            user = await UserModel.findById(userId).session(session);
            if (!user) {
                const error = new Error("User not found");
                error.statusCode = 404;
                throw error;
            }

            user.balance += saleValue;
            await user.save({ session });

            if (investment.quantity === parsedQuantity) {
                investment.status = 'sold';
                await investment.save({ session });
            } else {
                const remainingQuantity = investment.quantity - parsedQuantity;
                const soldProportion = parsedQuantity / investment.quantity;
                const soldInvestment = investment.totalInvested * soldProportion;
                
                investment.quantity = remainingQuantity;
                investment.totalInvested -= soldInvestment;
                await investment.save({ session });
            }

            await postJournal({
                session,
                referenceType: "investment_trade",
                referenceId: tradeReferenceId,
                description: "Sell investment asset to main balance",
                entries: [
                    {
                        accountType: "user_main",
                        userId,
                        debit: saleValue,
                        metadata: {
                            stockSymbol: stockSymbol.toUpperCase(),
                            quantity: parsedQuantity,
                            side: "sell"
                        }
                    },
                    {
                        accountType: "system_investment_reserve",
                        credit: saleValue,
                        metadata: {
                            stockSymbol: stockSymbol.toUpperCase(),
                            quantity: parsedQuantity,
                            side: "sell"
                        }
                    }
                ]
            });
        });

        res.status(200).send({
            success: true,
            message: "Stock sold successfully",
            data: {
                stockSymbol: stockSymbol.toUpperCase(),
                quantity: parsedQuantity,
                pricePerShare: currentPrice,
                totalSaleValue: saleValue,
                tradeReferenceId,
                profitLoss: Math.round(profitLoss * 100) / 100,
                newBalance: user.balance
            }
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).send({
                success: false,
                message: error.message,
                ...(error.details || {})
            });
        }
        res.status(500).send({
            success: false,
            message: "Error selling stock"
        });
    } finally {
        await session.endSession();
    }
};

// Get user's portfolio
exports.getPortfolio = async (req, res) => {
    try {
        const userId = req.user.userId;

        const investments = await InvestmentModel.find({
            userId,
            status: 'active'
        }).sort({ createdAt: -1 });

        if (investments.length === 0) {
            return res.status(200).send({
                success: true,
                message: "No active investments found",
                data: {
                    investments: [],
                    totalInvested: 0,
                    currentValue: 0,
                    totalProfitLoss: 0
                }
            });
        }

        // Calculate current values and profit/loss
        const portfolioData = investments.map(investment => {
            const currentPrice = getCurrentStockPrice(investment.stockSymbol);
            const currentValue = currentPrice * investment.quantity;
            const profitLoss = currentValue - investment.totalInvested;
            const profitLossPercentage = (profitLoss / investment.totalInvested) * 100;

            return {
                _id: investment._id,
                stockSymbol: investment.stockSymbol,
                stockName: investment.stockName,
                quantity: investment.quantity,
                purchasePrice: investment.purchasePrice,
                currentPrice,
                totalInvested: investment.totalInvested,
                currentValue: Math.round(currentValue * 100) / 100,
                profitLoss: Math.round(profitLoss * 100) / 100,
                profitLossPercentage: Math.round(profitLossPercentage * 100) / 100,
                purchaseDate: investment.purchaseDate
            };
        });

        const totalInvested = portfolioData.reduce((sum, item) => sum + item.totalInvested, 0);
        const currentValue = portfolioData.reduce((sum, item) => sum + item.currentValue, 0);
        const totalProfitLoss = currentValue - totalInvested;

        res.status(200).send({
            success: true,
            message: "Portfolio retrieved successfully",
            data: {
                investments: portfolioData,
                totalInvested: Math.round(totalInvested * 100) / 100,
                currentValue: Math.round(currentValue * 100) / 100,
                totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
                profitLossPercentage: totalInvested > 0 ? Math.round((totalProfitLoss / totalInvested) * 100 * 100) / 100 : 0
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving portfolio"
        });
    }
};

// Get investment history (including sold investments)
exports.getInvestmentHistory = async (req, res) => {
    try {
        const userId = req.user.userId;

        const investments = await InvestmentModel.find({ userId })
            .sort({ createdAt: -1 });

        const history = investments.map(investment => {
            let currentPrice = null;
            let currentValue = null;
            let profitLoss = null;

            if (investment.status === 'active') {
                currentPrice = getCurrentStockPrice(investment.stockSymbol);
                currentValue = currentPrice * investment.quantity;
                profitLoss = currentValue - investment.totalInvested;
            }

            return {
                _id: investment._id,
                stockSymbol: investment.stockSymbol,
                stockName: investment.stockName,
                quantity: investment.quantity,
                purchasePrice: investment.purchasePrice,
                totalInvested: investment.totalInvested,
                status: investment.status,
                purchaseDate: investment.purchaseDate,
                ...(investment.status === 'active' && {
                    currentPrice,
                    currentValue: Math.round(currentValue * 100) / 100,
                    profitLoss: Math.round(profitLoss * 100) / 100
                })
            };
        });

        res.status(200).send({
            success: true,
            message: "Investment history retrieved successfully",
            data: history
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving investment history"
        });
    }
};

// Get stock details with price history simulation
exports.getStockDetails = async (req, res) => {
    try {
        const { symbol } = req.params;
        const stock = MOCK_STOCKS[symbol.toUpperCase()];

        if (!stock) {
            return res.status(404).send({
                success: false,
                message: "Stock not found"
            });
        }

        const currentPrice = getCurrentStockPrice(symbol.toUpperCase());
        
        // Generate mock price history for the last 30 days
        const priceHistory = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            // Generate mock historical price
            const randomFactor = (Math.random() - 0.5) * 0.08; // -4% to +4%
            const historicalPrice = stock.basePrice * (1 + randomFactor);
            
            priceHistory.push({
                date: date.toISOString().split('T')[0],
                price: Math.round(historicalPrice * 100) / 100
            });
        }

        // Add today's price
        priceHistory[priceHistory.length - 1].price = currentPrice;

        res.status(200).send({
            success: true,
            message: "Stock details retrieved successfully",
            data: {
                symbol: symbol.toUpperCase(),
                name: stock.name,
                currentPrice,
                basePrice: stock.basePrice,
                changeFromBase: Math.round((currentPrice - stock.basePrice) * 100) / 100,
                changeFromBasePercentage: Math.round(((currentPrice - stock.basePrice) / stock.basePrice) * 100 * 100) / 100,
                priceHistory
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving stock details"
        });
    }
};