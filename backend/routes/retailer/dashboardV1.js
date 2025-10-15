const express = require('express')
const router = express.Router()
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const SalesBill = require('../../models/retailer/SalesBill');
const PurchaseBill = require('../../models/retailer/PurchaseBill');
const Item = require('../../models/retailer/Item');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const Company = require('../../models/Company');
const companyGroup = require('../../models/retailer/CompanyGroup');
const Transaction = require('../../models/retailer/Transaction');
const Account = require('../../models/retailer/Account');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const FiscalYear = require('../../models/FiscalYear');
const SalesReturn = require('../../models/retailer/SalesReturn');
const PurchaseReturns = require('../../models/retailer/PurchaseReturns');

router.get('/retailerDashboard/indexv1', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;
        const currentFiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;

        // Fetch company data
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat vatEnabled')
            .populate('fiscalYear')
            .lean();

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        let currentFiscalYear = null;

        // Get current fiscal year
        if (currentFiscalYearId) {
            currentFiscalYear = await FiscalYear.findById(currentFiscalYearId).lean();
        }

        // Set default fiscal year if not set
        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: true
            };
        }

        if (!currentFiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year available'
            });
        }

        // Execute all financial queries in parallel
        const [
            totalSalesResult,
            totalSalesReturnResult,
            totalPurchaseResult,
            totalPurchaseReturnResult,
            totalStockValueResult,
            cashAccount,
            bankAccountsGroup
        ] = await Promise.all([
            SalesBill.aggregate([
                {
                    $match: {
                        company: new mongoose.Types.ObjectId(companyId),
                        date: { $gte: currentFiscalYear.startDate, $lte: currentFiscalYear.endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: { $add: ['$totalAmount'] } }
                    }
                }
            ]),
            SalesReturn.aggregate([
                {
                    $match: {
                        company: new mongoose.Types.ObjectId(companyId),
                        date: { $gte: currentFiscalYear.startDate, $lte: currentFiscalYear.endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: { $add: ['$totalAmount'] } }
                    }
                }
            ]),
            PurchaseBill.aggregate([
                {
                    $match: {
                        company: new mongoose.Types.ObjectId(companyId),
                        date: { $gte: currentFiscalYear.startDate, $lte: currentFiscalYear.endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: { $add: ['$taxableAmount', '$nonVatPurchase'] } }
                    }
                }
            ]),
            PurchaseReturns.aggregate([
                {
                    $match: {
                        company: new mongoose.Types.ObjectId(companyId),
                        date: { $gte: currentFiscalYear.startDate, $lte: currentFiscalYear.endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: { $add: ['$taxableAmount', '$nonVatPurchaseReturn'] } }
                    }
                }
            ]),
            Item.aggregate([
                {
                    $match: {
                        company: new mongoose.Types.ObjectId(companyId),
                        fiscalYear: currentFiscalYear._id
                    }
                },
                {
                    $unwind: '$stockEntries'
                },
                {
                    $project: {
                        stockValue: {
                            $multiply: ['$stockEntries.quantity', { $toDouble: '$stockEntries.puPrice' }]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalStockValue: { $sum: '$stockValue' }
                    }
                }
            ]),
            Account.findOne({
                company: companyId,
                defaultCashAccount: true,
                isActive: true,
            }),
            companyGroup.findOne({
                company: companyId,
                name: 'Bank Accounts'
            })
        ]);

        // // Calculate cash balance
        // let cashBalance = 0;
        // if (cashAccount) {
        //     const cashTransactions = await Transaction.find({
        //         account: cashAccount._id,
        //         date: { $lte: currentFiscalYear.endDate }
        //     });

        //     cashTransactions.forEach(txn => {
        //         cashBalance += (txn.debit || 0) - (txn.credit || 0);
        //     });

        //     const openingBalanceEntry = cashAccount.openingBalanceByFiscalYear.find(
        //         entry => entry.fiscalYear.equals(currentFiscalYear._id)
        //     );

        //     if (openingBalanceEntry) {
        //         cashBalance += openingBalanceEntry.type === 'Dr'
        //             ? openingBalanceEntry.amount
        //             : -openingBalanceEntry.amount;
        //     }
        // }

        // Calculate cash balance
let cashBalance = 0;
if (cashAccount) {
    const cashTransactions = await Transaction.find({
        account: cashAccount._id,
        date: { $lte: currentFiscalYear.endDate }
    });

    cashTransactions.forEach(txn => {
        cashBalance += (txn.debit || 0) - (txn.credit || 0);
    });

    // Use initialOpeningBalance instead of openingBalanceByFiscalYear
    if (cashAccount.initialOpeningBalance) {
        cashBalance += cashAccount.initialOpeningBalance.type === 'Dr'
            ? cashAccount.initialOpeningBalance.amount
            : -cashAccount.initialOpeningBalance.amount;
    }
}

        // Calculate bank balances
        let bankBalance = 0;
        if (bankAccountsGroup) {
            const bankAccounts = await Account.find({
                company: companyId,
                companyGroups: bankAccountsGroup._id,
                isActive: true,
                fiscalYear: currentFiscalYear._id
            });

            for (const account of bankAccounts) {
                const transactions = await Transaction.find({
                    account: account._id,
                    date: { $lte: currentFiscalYear.endDate }
                });

                let accountBalance = 0;
                transactions.forEach(txn => {
                    accountBalance += (txn.debit || 0) - (txn.credit || 0);
                });

                const openingBalance = account.openingBalance;
                if (openingBalance) {
                    accountBalance += openingBalance.type === 'Dr'
                        ? openingBalance.amount
                        : -openingBalance.amount;
                }

                bankBalance += accountBalance;
            }
        }

        // Calculate bank OD balance
        let bankODBalance = 0;
        const bankODGroup = await companyGroup.findOne({
            company: companyId,
            name: 'Bank O/D Account',
        });

        if (bankODGroup) {
            const odAccounts = await Account.find({
                company: companyId,
                companyGroups: bankODGroup._id,
                isActive: true,
                fiscalYear: currentFiscalYear._id
            });

            for (const account of odAccounts) {
                const transactions = await Transaction.find({
                    account: account._id,
                    date: { $lte: currentFiscalYear.endDate }
                });

                let accountBalance = 0;
                transactions.forEach(txn => {
                    accountBalance += (txn.debit || 0) - (txn.credit || 0);
                });

                const openingBalance = account.openingBalance;
                if (openingBalance) {
                    accountBalance += openingBalance.type === 'Dr'
                        ? openingBalance.amount
                        : -openingBalance.amount;
                }

                bankODBalance += accountBalance;
            }
        }

        const netBankBalance = bankBalance + bankODBalance;

        // Extract values from aggregation results
        const totalSales = totalSalesResult[0]?.totalAmount || 0;
        const totalPurchase = totalPurchaseResult[0]?.totalAmount || 0;
        const totalSalesReturn = totalSalesReturnResult[0]?.totalAmount || 0;
        const totalPurchaseReturn = totalPurchaseReturnResult[0]?.totalAmount || 0;
        const totalStockValue = totalStockValueResult[0]?.totalStockValue || 0;

        const netSales = totalSales - totalSalesReturn;
        const netPurchase = totalPurchase - totalPurchaseReturn;

        // Fetch monthly data for chart
        const [monthlySalesData, monthlyReturnsData] = await Promise.all([
            SalesBill.aggregate([
                {
                    $match: {
                        company: new mongoose.Types.ObjectId(companyId),
                        date: { $gte: currentFiscalYear.startDate, $lte: currentFiscalYear.endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$date" },
                            month: { $month: "$date" }
                        },
                        totalSales: { $sum: { $add: ["$totalAmount"] } }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),
            SalesReturn.aggregate([
                {
                    $match: {
                        company: new mongoose.Types.ObjectId(companyId),
                        date: { $gte: currentFiscalYear.startDate, $lte: currentFiscalYear.endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$date" },
                            month: { $month: "$date" }
                        },
                        totalReturns: { $sum: { $add: ["$totalAmount"] } }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ])
        ]);

        // Process chart data
        const categories = [];
        const netSalesData = [];
        const isNepaliFormat = company.dateFormat === 'nepali';
        const nepaliMonths = ['Baisakh', 'Jestha', 'Ashad', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];

        monthlySalesData.forEach(monthData => {
            const { year, month } = monthData._id;
            const returns = monthlyReturnsData.find(r =>
                r._id.year === year && r._id.month === month
            )?.totalReturns || 0;

            const formattedDate = isNepaliFormat
                ? `${nepaliMonths[(month + 8) % 12]} ${year}`
                : new Date(year, month - 1).toLocaleString('default', { month: 'numeric', year: 'numeric' });

            categories.push(formattedDate);
            netSalesData.push(monthData.totalSales - returns);
        });

        if (categories.length === 0) {
            categories.push(isNepaliFormat ? 'कुनै डाटा उपलब्ध छैन' : 'No Data Available');
            netSalesData.push(0);
        }

        // Prepare response
        const responseData = {
            success: true,
            data: {
                financialSummary: {
                    cashBalance,
                    bankBalance: netBankBalance,
                    totalStockValue,
                    netSales,
                    netPurchase,
                    grossSales: totalSales,
                    salesReturns: totalSalesReturn,
                    grossPurchases: totalPurchase,
                    purchaseReturns: totalPurchaseReturn
                },
                chartData: {
                    categories,
                    series: [{
                        name: 'Net Sales',
                        data: netSalesData
                    }]
                },
                company: {
                    id: company._id.toString(),
                    name: currentCompanyName,
                    dateFormat: company.dateFormat,
                    vatEnabled: company.vatEnabled,
                    renewalDate: company.renewalDate
                },
                fiscalYear: {
                    id: currentFiscalYear._id.toString(),
                    name: currentFiscalYear.name,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    isActive: currentFiscalYear.isActive
                },
                user: {
                    id: req.user._id.toString(),
                    name: req.user.name,
                    email: req.user.email,
                    isAdmin: req.user.isAdmin,
                    role: req.user.role,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            }
        };

        res.json(responseData);

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;