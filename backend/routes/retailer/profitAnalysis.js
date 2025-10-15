const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const SalesBill = require('../../models/retailer/SalesBill');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const Company = require('../../models/Company');
const { ensureTradeType } = require('../../middleware/tradeType');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const FiscalYear = require('../../models/FiscalYear');
const SalesReturn = require('../../models/retailer/SalesReturn');
const Purchase = require('../../models/retailer/PurchaseBill');
const PurchaseReturnBill = require('../../models/retailer/PurchaseReturns')
const NepaliDate = require('nepali-date');
const moment = require('moment');


router.get('/invoice-wise-profit-loss', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { fromDate, toDate, billNumber } = req.query;
            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const currentCompanyName = req.session.currentCompanyName;
            const currentCompany = await Company.findById(new ObjectId(companyId));
            const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            if (!currentFiscalYear && company.fiscalYear) {
                currentFiscalYear = company.fiscalYear;
                req.session.currentFiscalYear = {
                    id: currentFiscalYear._id.toString(),
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    name: currentFiscalYear.name,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                };
                fiscalYear = req.session.currentFiscalYear.id;
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Return empty data if no date range provided
            if (!fromDate || !toDate) {
                return res.json({
                    success: true,
                    data: {
                        results: [],
                        fromDate: fromDate || '',
                        toDate: toDate || '',
                        billNumber: billNumber || '',
                        company: {
                            _id: company._id,
                            renewalDate: company.renewalDate,
                            dateFormat: company.dateFormat,
                            fiscalYear: company.fiscalYear
                        },
                        currentFiscalYear: {
                            _id: currentFiscalYear._id,
                            startDate: currentFiscalYear.startDate,
                            endDate: currentFiscalYear.endDate,
                            name: currentFiscalYear.name,
                            dateFormat: currentFiscalYear.dateFormat,
                            isActive: currentFiscalYear.isActive
                        },
                        currentCompany: {
                            _id: currentCompany._id,
                            name: currentCompany.name,
                            dateFormat: currentCompany.dateFormat
                        },
                        currentCompanyName,
                        companyDateFormat
                    },
                    message: 'No date range provided'
                });
            }

            // Build match criteria (same as your existing code)
            const matchCriteria = {
                company: new ObjectId(companyId),
                date: {
                    $gte: new Date(fromDate),
                    $lte: new Date(toDate)
                }
            };

            if (billNumber) {
                matchCriteria.billNumber = billNumber;
            }

            const salesReturnMatchCriteria = {
                company: new ObjectId(companyId),
                date: {
                    $gte: new Date(fromDate),
                    $lte: new Date(toDate)
                }
            };

            if (billNumber) {
                salesReturnMatchCriteria.billNumber = billNumber;
            }

            // Aggregation pipeline for profit calculation
            const salesResults = await SalesBill.aggregate([
                { $match: matchCriteria },
                { $unwind: "$items" },
                // Lookup for item details
                {
                    $lookup: {
                        from: "items",
                        localField: "items.item",
                        foreignField: "_id",
                        as: "items.itemDetails"
                    }
                },
                { $unwind: { path: "$items.itemDetails", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        billNumber: 1,
                        date: 1,
                        account: 1,
                        cashAccount: 1,
                        "items.quantity": 1,
                        "items.netPrice": 1,
                        "items.netPuPrice": 1,
                        "items.itemName": "$items.itemDetails.name", // Get item name
                        itemProfit: {
                            $multiply: [
                                { $subtract: ["$items.netPrice", { $ifNull: ["$items.netPuPrice", 0] }] },
                                "$items.quantity"
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: "$_id",
                        billNumber: { $first: "$billNumber" },
                        date: { $first: "$date" },
                        account: { $first: "$account" },
                        cashAccount: { $first: "$cashAccount" },
                        totalProfit: { $sum: "$itemProfit" },
                        totalSales: { $sum: { $multiply: ["$items.netPrice", "$items.quantity"] } },
                        totalCost: { $sum: { $multiply: ["$items.netPuPrice", "$items.quantity"] } },
                        items: {
                            $push: {
                                quantity: "$items.quantity",
                                price: "$items.netPrice",
                                puPrice: "$items.netPuPrice",
                                itemName: "$items.itemName"
                            }
                        }
                    }
                },
                { $sort: { date: 1, billNumber: 1 } },
                {
                    $lookup: {
                        from: "accounts",
                        localField: "account",
                        foreignField: "_id",
                        as: "accountDetails"
                    }
                },
                { $unwind: { path: "$accountDetails", preserveNullAndEmptyArrays: true } }
            ]);

            // Aggregation pipeline for SALES RETURNS (negative profit)
            const salesReturnResults = await SalesReturn.aggregate([
                { $match: salesReturnMatchCriteria },
                { $unwind: "$items" },
                {
                    $lookup: {
                        from: "items",
                        localField: "items.item",
                        foreignField: "_id",
                        as: "items.itemDetails"
                    }
                },
                { $unwind: { path: "$items.itemDetails", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        billNumber: 1,
                        date: 1,
                        account: 1,
                        cashAccount: 1,
                        "items.quantity": 1,
                        "items.netPrice": 1,
                        "items.netPuPrice": 1,
                        "items.itemName": "$items.itemDetails.name",
                        itemProfit: {
                            $multiply: [
                                { $subtract: ["$items.netPuPrice", { $ifNull: ["$items.netPrice", 0] }] },
                                -1,
                                "$items.quantity"
                            ]
                        },
                    }
                },
                {
                    $group: {
                        _id: "$_id",
                        billNumber: { $first: "$billNumber" },
                        date: { $first: "$date" },
                        account: { $first: "$account" },
                        cashAccount: { $first: "$cashAccount" },
                        totalProfit: { $sum: "$itemProfit" },
                        totalSales: { $sum: { $multiply: ["$items.netPrice", "$items.quantity", -1] } },
                        totalCost: { $sum: { $multiply: ["$items.netPuPrice", "$items.quantity", -1] } },
                        items: {
                            $push: {
                                quantity: "$items.quantity",
                                price: "$items.netPrice",
                                puPrice: "$items.netPuPrice",
                                itemName: "$items.itemName",
                                isReturn: true // Flag to identify returns
                            }
                        },
                        isReturn: { $first: true } // Flag the entire document as return
                    }
                },
                { $sort: { date: 1, billNumber: 1 } },
                {
                    $lookup: {
                        from: "accounts",
                        localField: "account",
                        foreignField: "_id",
                        as: "accountDetails"
                    }
                },
                { $unwind: { path: "$accountDetails", preserveNullAndEmptyArrays: true } }
            ]);

            // Combine and sort results
            const combinedResults = [...salesResults, ...salesReturnResults].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (dateA < dateB) return -1;
                if (dateA > dateB) return 1;
                return a.billNumber.localeCompare(b.billNumber, undefined, { numeric: true });
            });

            // Calculate totals for summary
            const summary = {
                totalProfit: combinedResults.reduce((sum, item) => sum + (item.totalProfit || 0), 0),
                totalSales: combinedResults.reduce((sum, item) => sum + (item.totalSales || 0), 0),
                totalCost: combinedResults.reduce((sum, item) => sum + (item.totalCost || 0), 0),
                totalInvoices: combinedResults.length
            };

            // Return JSON response
            return res.json({
                success: true,
                data: {
                    results: combinedResults,
                    summary,
                    fromDate,
                    toDate,
                    billNumber: billNumber || '',
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    currentCompany: {
                        _id: currentCompany._id,
                        name: currentCompany.name,
                        dateFormat: currentCompany.dateFormat
                    },
                    currentCompanyName,
                    companyDateFormat,
                    user: {
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor',
                        theme: req.user.preferences?.theme || 'light'
                    }
                }
            });

        } catch (err) {
            console.error('Error fetching profit report:', err);
            return res.status(500).json({
                success: false,
                error: 'Server Error',
                message: err.message
            });
        }
    } else {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});

// Display date input form - JSON response for React
router.get('/daily-profit/sales-analysis', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;
        const currentCompany = await Company.findById(new ObjectId(companyId));
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : '';

        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            // Fetch the fiscal year from the database if available in the session
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // If no fiscal year is found in session or currentCompany, throw an error
        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;

            // Set the fiscal year in the session for future requests
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            };

            // Assign fiscal year ID for use
            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company.'
            });
        }

        // Return JSON response for React components
        res.json({
            success: true,
            data: {
                startDate: currentFiscalYear.startDate.toISOString().split('T')[0],
                endDate: currentFiscalYear.endDate.toISOString().split('T')[0],
                company: {
                    id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    fiscalYear: company.fiscalYear
                },
                currentFiscalYear: {
                    id: currentFiscalYear._id,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    name: currentFiscalYear.name,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                },
                companyDateFormat,
                nepaliDate,
                currentCompany: {
                    id: currentCompany._id,
                    name: currentCompany.name,
                    // Add other relevant company fields
                },
                fromDate: req.query.fromDate || '',
                toDate: req.query.toDate || '',
                currentCompanyName,
                showResults: false,
                user: {
                    id: req.user._id,
                    name: req.user.name,
                    isAdmin: req.user.isAdmin,
                    role: req.user.role,
                    preferences: req.user.preferences || { theme: 'light' }
                },
                theme: req.user.preferences?.theme || 'light',
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        });
    } catch (error) {
        console.error('Error fetching profit analysis data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load profit analysis data',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Process form submission and return JSON data for React
router.post('/daily-profit/sales-analysis', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, async (req, res) => {
    try {
        const { fromDate, toDate } = req.body;
        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;
        const currentCompany = await Company.findById(new ObjectId(companyId));
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : '';

        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            // Fetch the fiscal year from the database if available in the session
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // If no fiscal year is found in session or currentCompany, throw an error
        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;

            // Set the fiscal year in the session for future requests
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            };

            // Assign fiscal year ID for use
            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company.'
            });
        }

        // Validate dates
        if (!fromDate || !toDate) {
            return res.status(400).json({
                success: false,
                error: 'Both from date and to date are required'
            });
        }

        // Convert dates to proper format
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999); // Include entire end date

        // Get net sales (sales - sales returns)
        const netSales = await getNetSales({ companyId, fiscalYearId: currentFiscalYear._id, startDate, endDate });

        // Get net purchases (purchases - purchase returns)
        const netPurchases = await getNetPurchases({ companyId, fiscalYearId: currentFiscalYear._id, startDate, endDate });

        // Calculate daily profit
        const dailyProfit = await calculateDailyProfit({
            companyId,
            fiscalYearId: currentFiscalYear._id,
            startDate,
            endDate
        });

        // // Calculate summary statistics
        // const summary = {
        //     totalGrossSales: dailyProfit.reduce((sum, day) => sum + (day.grossSales || 0), 0),
        //     totalSalesReturns: dailyProfit.reduce((sum, day) => sum + (day.returns || 0), 0),
        //     totalNetSales: dailyProfit.reduce((sum, day) => sum + (day.netSales || 0), 0),
        //     totalGrossPurchases: dailyProfit.reduce((sum, day) => sum + (day.grossPurchases || 0), 0),
        //     totalPurchaseReturns: dailyProfit.reduce((sum, day) => sum + (day.costReturns || 0), 0),
        //     totalNetPurchases: dailyProfit.reduce((sum, day) => sum + (day.netPurchases || 0), 0),
        //     daysWithProfit: dailyProfit.filter(day => day.netProfit > 0).length,
        //     daysWithLoss: dailyProfit.filter(day => day.netProfit < 0).length
        // };

        // summary.totalGrossProfit = summary.totalNetSales - summary.totalNetPurchases;
        // summary.totalNetProfit = summary.totalNetSales - dailyProfit.reduce((sum, day) => sum + (day.netCost || 0), 0);

        // Calculate summary statistics
        const summary = {
            totalGrossSales: dailyProfit.reduce((sum, day) => sum + (day.grossSales || 0), 0),
            totalSalesReturns: dailyProfit.reduce((sum, day) => sum + (day.returns || 0), 0),
            totalNetSales: dailyProfit.reduce((sum, day) => sum + (day.netSales || 0), 0),
            totalGrossPurchases: dailyProfit.reduce((sum, day) => sum + (day.grossPurchases || 0), 0),
            totalPurchaseReturns: dailyProfit.reduce((sum, day) => sum + (day.purchaseReturns || 0), 0), // Add this line
            totalNetPurchases: dailyProfit.reduce((sum, day) => sum + (day.netPurchases || 0), 0),
            daysWithProfit: dailyProfit.filter(day => day.netProfit > 0).length,
            daysWithLoss: dailyProfit.filter(day => day.netProfit < 0).length
        };

        summary.totalGrossProfit = summary.totalNetSales - summary.totalNetPurchases;
        summary.totalNetProfit = summary.totalNetSales - dailyProfit.reduce((sum, day) => sum + (day.netCost || 0), 0);

        // Return JSON response for React
        res.json({
            success: true,
            data: {
                netSales,
                netPurchases,
                dailyProfit,
                summary,
                companyDateFormat,
                fromDate,
                toDate,
                company: {
                    id: currentCompany._id,
                    name: currentCompany.name,
                    renewalDate: currentCompany.renewalDate,
                    dateFormat: currentCompany.dateFormat
                },
                currentCompanyName,
                currentFiscalYear: {
                    id: currentFiscalYear._id,
                    name: currentFiscalYear.name,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                },
                user: {
                    id: req.user._id,
                    name: req.user.name,
                    isAdmin: req.user.isAdmin,
                    role: req.user.role,
                    preferences: req.user.preferences || { theme: 'light' }
                },
                theme: req.user.preferences?.theme || 'light',
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        });

    } catch (error) {
        console.error('Error in profit analysis:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate profit analysis',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Helper function to calculate net sales
async function getNetSales({ companyId, fiscalYearId, startDate, endDate }) {
    // Convert IDs to ObjectId
    const companyObjId = new ObjectId(companyId);
    const fiscalYearObjId = new ObjectId(fiscalYearId);

    // Get regular sales
    const sales = await SalesBill.aggregate([
        {
            $match: {
                company: companyObjId,
                fiscalYear: fiscalYearObjId,
                date: { $gte: startDate, $lte: endDate }
            }
        },
        { $unwind: "$items" },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                totalSales: { $sum: { $multiply: ["$items.quantity", "$items.netPrice"] } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Get sales returns
    const salesReturns = await SalesReturn.aggregate([
        {
            $match: {
                company: companyObjId,
                fiscalYear: fiscalYearObjId,
                date: { $gte: startDate, $lte: endDate }
            }
        },
        { $unwind: "$items" },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                totalReturns: { $sum: { $multiply: ["$items.quantity", "$items.netPrice"] } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Combine sales and returns
    const salesMap = new Map();

    // Add sales
    sales.forEach(day => {
        salesMap.set(day._id, {
            date: day._id,
            grossSales: day.totalSales,
            returns: 0,
            netSales: day.totalSales,
            salesCount: day.count,
            returnCount: 0
        });
    });

    // Subtract returns
    salesReturns.forEach(day => {
        if (salesMap.has(day._id)) {
            const existing = salesMap.get(day._id);
            existing.returns += day.totalReturns;
            existing.netSales -= day.totalReturns;
            existing.returnCount += day.count;
        } else {
            salesMap.set(day._id, {
                date: day._id,
                grossSales: 0,
                returns: day.totalReturns,
                netSales: -day.totalReturns,
                salesCount: 0,
                returnCount: day.count
            });
        }
    });

    return Array.from(salesMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Helper function to calculate net purchases
async function getNetPurchases({ companyId, fiscalYearId, startDate, endDate }) {
    // Convert IDs to ObjectId
    const companyObjId = new ObjectId(companyId);
    const fiscalYearObjId = new ObjectId(fiscalYearId);

    // Get regular purchases
    const purchases = await Purchase.aggregate([
        {
            $match: {
                company: companyObjId,
                fiscalYear: fiscalYearObjId,
                date: { $gte: startDate, $lte: endDate }
            }
        },
        { $unwind: "$items" },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                totalPurchases: { $sum: { $multiply: ["$items.quantity", "$items.netPuPrice"] } },
                totalCost: { $sum: { $multiply: ["$items.quantity", "$items.netPuPrice"] } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Get purchase returns
    const purchaseReturns = await PurchaseReturnBill.aggregate([
        {
            $match: {
                company: companyObjId,
                fiscalYear: fiscalYearObjId,
                date: { $gte: startDate, $lte: endDate }
            }
        },
        { $unwind: "$items" },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                totalReturns: { $sum: { $multiply: ["$items.quantity", "$items.puPrice"] } },
                totalCostReturns: { $sum: { $multiply: ["$items.quantity", "$items.puPrice"] } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Combine purchases and returns
    const purchaseMap = new Map();

    // Add purchases first
    purchases.forEach(day => {
        purchaseMap.set(day._id, {
            date: day._id,
            grossPurchases: day.totalPurchases,
            grossCost: day.totalCost,
            purchaseReturns: 0,  // Initialize returns to 0
            costReturns: 0,      // Initialize cost returns to 0
            netPurchases: day.totalPurchases, // Initialize net as gross
            netCost: day.totalCost,           // Initialize net cost as gross
            purchaseCount: day.count,
            returnCount: 0
        });
    });

    // Process purchase returns
    purchaseReturns.forEach(day => {
        if (purchaseMap.has(day._id)) {
            const existing = purchaseMap.get(day._id);
            // Add to returns totals
            existing.purchaseReturns += day.totalReturns;
            existing.costReturns += day.totalCostReturns;
            existing.returnCount += day.count;

            // Calculate net values by subtracting returns
            existing.netPurchases = existing.grossPurchases - existing.purchaseReturns;
            existing.netCost = existing.grossCost - existing.costReturns;
        } else {
            // If no purchases exist for this date, just record the returns
            purchaseMap.set(day._id, {
                date: day._id,
                grossPurchases: 0,
                grossCost: 0,
                purchaseReturns: day.totalReturns,
                costReturns: day.totalCostReturns,
                netPurchases: -day.totalReturns, // Negative since it's just returns
                netCost: -day.totalCostReturns,  // Negative since it's just returns
                purchaseCount: 0,
                returnCount: day.count
            });
        }
    });

    return Array.from(purchaseMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Helper function to get item costs using FIFO
async function getItemCosts(companyId, fiscalYearId, startDate, endDate) {
    const companyObjId = new ObjectId(companyId);
    const fiscalYearObjId = new ObjectId(fiscalYearId);

    // Get all purchases before or on each sales date
    const purchases = await Purchase.aggregate([
        {
            $match: {
                company: companyObjId,
                fiscalYear: fiscalYearObjId,
                date: { $lte: endDate }
            }
        },
        { $unwind: "$items" },
        {
            $project: {
                date: 1,
                itemId: "$items.item",
                quantity: "$items.quantity",
                price: "$items.price",
                puPrice: "$items.netPuPrice"
            }
        },
        { $sort: { date: 1 } } // FIFO - oldest first
    ]);

    // Get all sales in date range
    const sales = await SalesBill.aggregate([
        {
            $match: {
                company: companyObjId,
                fiscalYear: fiscalYearObjId,
                date: { $gte: startDate, $lte: endDate }
            }
        },
        { $unwind: "$items" },
        {
            $project: {
                date: 1,
                itemId: "$items.item",
                quantity: "$items.quantity",
                price: "$items.netPrice",
            }
        }
    ]);

    // Process FIFO cost calculation
    const itemCosts = {};
    purchases.forEach(purchase => {
        if (!itemCosts[purchase.itemId]) {
            itemCosts[purchase.itemId] = [];
        }
        itemCosts[purchase.itemId].push({
            date: purchase.date,
            quantity: purchase.quantity,
            cost: purchase.puPrice,
            remaining: purchase.quantity
        });
    });

    const salesWithCost = [];
    sales.forEach(sale => {
        if (!itemCosts[sale.itemId]) {
            // No purchase found for this item
            salesWithCost.push({
                ...sale,
                cost: 0,
                profit: sale.price * sale.quantity
            });
            return;
        }

        let remainingQty = sale.quantity;
        let totalCost = 0;
        const purchases = itemCosts[sale.itemId];

        for (let i = 0; i < purchases.length && remainingQty > 0; i++) {
            const available = Math.min(purchases[i].remaining, remainingQty);
            totalCost += available * purchases[i].cost;
            purchases[i].remaining -= available;
            remainingQty -= available;
        }

        salesWithCost.push({
            ...sale,
            cost: totalCost,
            profit: (sale.price * sale.quantity) - totalCost
        });
    });

    return salesWithCost;
}


// Modified calculateDailyProfit function to include purchaseReturns field
async function calculateDailyProfit({ companyId, fiscalYearId, startDate, endDate }) {
    // Convert IDs to ObjectId
    const companyObjId = new ObjectId(companyId);
    const fiscalYearObjId = new ObjectId(fiscalYearId);

    // Build match criteria
    const matchCriteria = {
        company: companyObjId,
        fiscalYear: fiscalYearObjId,
        date: {
            $gte: startDate,
            $lte: endDate
        }
    };

    // Aggregation pipeline for SALES profit calculation
    const salesResults = await SalesBill.aggregate([
        { $match: matchCriteria },
        { $unwind: "$items" },
        {
            $project: {
                date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                quantity: "$items.quantity",
                netPrice: "$items.netPrice",
                netPuPrice: "$items.netPuPrice",
                itemProfit: {
                    $multiply: [
                        { $subtract: ["$items.netPrice", { $ifNull: ["$items.netPuPrice", 0] }] },
                        "$items.quantity"
                    ]
                },
                salesAmount: { $multiply: ["$items.netPrice", "$items.quantity"] },
                costAmount: { $multiply: ["$items.netPuPrice", "$items.quantity"] }
            }
        },
        {
            $group: {
                _id: "$date",
                totalProfit: { $sum: "$itemProfit" },
                totalSales: { $sum: "$salesAmount" },
                totalCost: { $sum: "$costAmount" },
                salesCount: { $sum: 1 }
            }
        }
    ]);

    // Aggregation pipeline for SALES RETURNS (negative profit)
    const salesReturnResults = await SalesReturn.aggregate([
        { $match: matchCriteria },
        { $unwind: "$items" },
        {
            $project: {
                date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                quantity: "$items.quantity",
                netPrice: "$items.netPrice",
                netPuPrice: "$items.netPuPrice",
                itemProfit: {
                    $multiply: [
                        { $subtract: ["$items.netPuPrice", { $ifNull: ["$items.netPrice", 0] }] },
                        -1,
                        "$items.quantity"
                    ]
                },
                salesAmount: { $multiply: ["$items.netPrice", "$items.quantity", -1] },
                costAmount: { $multiply: ["$items.netPuPrice", "$items.quantity", -1] }
            }
        },
        {
            $group: {
                _id: "$date",
                totalProfit: { $sum: "$itemProfit" },
                totalSales: { $sum: "$salesAmount" },
                totalCost: { $sum: "$costAmount" },
                returnCount: { $sum: 1 }
            }
        }
    ]);

    // Get net purchases data (for display purposes and transaction count)
    const netPurchases = await getNetPurchases({ companyId, fiscalYearId, startDate, endDate });

    // Combine sales and returns data by date
    const profitByDate = {};

    // Process sales
    salesResults.forEach(day => {
        profitByDate[day._id] = {
            date: day._id,
            grossSales: day.totalSales,
            returns: 0,
            netSales: day.totalSales,
            netCost: day.totalCost,
            netProfit: day.totalProfit,
            salesCount: day.salesCount,
            returnCount: 0,
            purchaseCount: 0,
            grossPurchases: 0,
            purchaseReturns: 0, // Initialize purchaseReturns to 0
            netPurchases: 0,
            grossProfit: day.totalSales - day.totalCost,
            // Calculate CP percentage (Profit/Cost * 100) - same as invoice-wise
            cpPercentage: day.totalCost !== 0 ? (day.totalProfit / day.totalCost) * 100 : 0,
            // Calculate SP percentage (Profit/Sales * 100)
            spPercentage: day.totalSales !== 0 ? (day.totalProfit / day.totalSales) * 100 : 0
        };
    });

    // Process sales returns - CORRECTED CP PERCENTAGE CALCULATION
    salesReturnResults.forEach(day => {
        if (profitByDate[day._id]) {
            // Update existing day with returns data
            const existing = profitByDate[day._id];
            existing.returns += Math.abs(day.totalSales);
            existing.netSales = existing.grossSales - existing.returns;
            existing.netCost -= Math.abs(day.totalCost);
            existing.netProfit += day.totalProfit;
            existing.returnCount += day.returnCount;

            // Recalculate percentages - CORRECTED CP PERCENTAGE
            // For returns, we need to handle negative values like in invoice-wise code
            if (existing.netProfit < 0) {
                // For negative profit (returns), use absolute values like in invoice-wise
                existing.cpPercentage = Math.abs(existing.netCost) !== 0
                    ? (-Math.abs(existing.netProfit) / Math.abs(existing.netCost)) * 100
                    : 0;
            } else {
                existing.cpPercentage = existing.netCost !== 0
                    ? (existing.netProfit / existing.netCost) * 100
                    : 0;
            }

            existing.spPercentage = existing.netSales !== 0
                ? (existing.netProfit / existing.netSales) * 100
                : 0;
        } else {
            // Create new entry for returns-only day
            profitByDate[day._id] = {
                date: day._id,
                grossSales: 0,
                returns: Math.abs(day.totalSales),
                netSales: -Math.abs(day.totalSales),
                netCost: -Math.abs(day.totalCost),
                netProfit: day.totalProfit,
                salesCount: 0,
                returnCount: day.returnCount,
                purchaseCount: 0,
                grossPurchases: 0,
                purchaseReturns: 0, // Initialize purchaseReturns to 0
                netPurchases: 0,
                grossProfit: -Math.abs(day.totalSales - day.totalCost),
                // Calculate CP percentage for returns - same logic as invoice-wise
                cpPercentage: Math.abs(day.totalCost) !== 0
                    ? (-Math.abs(day.totalProfit) / Math.abs(day.totalCost)) * 100
                    : 0,
                // Calculate SP percentage for returns
                spPercentage: Math.abs(day.totalSales) !== 0
                    ? (-Math.abs(day.totalProfit) / Math.abs(day.totalSales)) * 100
                    : 0
            };
        }
    });

    // Add purchase data to the results - FIXED: Include purchaseReturns field
    netPurchases.forEach(purchase => {
        if (profitByDate[purchase.date]) {
            profitByDate[purchase.date].grossPurchases = purchase.grossPurchases;
            profitByDate[purchase.date].purchaseReturns = purchase.purchaseReturns; // This line was missing
            profitByDate[purchase.date].netPurchases = purchase.netPurchases;
            profitByDate[purchase.date].purchaseCount = purchase.purchaseCount;

            // Update total transaction count
            profitByDate[purchase.date].totalTransactions =
                (profitByDate[purchase.date].salesCount || 0) +
                (profitByDate[purchase.date].returnCount || 0) +
                (profitByDate[purchase.date].purchaseCount || 0);
        } else {
            profitByDate[purchase.date] = {
                date: purchase.date,
                grossSales: 0,
                returns: 0,
                netSales: 0,
                grossPurchases: purchase.grossPurchases,
                purchaseReturns: purchase.purchaseReturns, // This line was missing
                netPurchases: purchase.netPurchases,
                netCost: 0,
                netProfit: 0,
                salesCount: 0,
                returnCount: 0,
                purchaseCount: purchase.purchaseCount,
                totalTransactions: purchase.purchaseCount,
                grossProfit: 0,
                cpPercentage: 0,
                spPercentage: 0
            };
        }
    });

    // Ensure all days have totalTransactions field and purchaseReturns field
    Object.values(profitByDate).forEach(day => {
        if (!day.totalTransactions) {
            day.totalTransactions = (day.salesCount || 0) + (day.returnCount || 0) + (day.purchaseCount || 0);
        }

        // Ensure purchaseReturns field exists
        if (day.purchaseReturns === undefined) {
            day.purchaseReturns = 0;
        }

        // Final validation for CP percentage to match invoice-wise logic
        if (day.netProfit < 0 && day.netCost < 0) {
            // For returns with negative cost, use absolute values like in invoice-wise
            day.cpPercentage = Math.abs(day.netCost) !== 0
                ? (-Math.abs(day.netProfit) / Math.abs(day.netCost)) * 100
                : 0;
        } else if (day.netProfit < 0 && day.netCost > 0) {
            // For returns with positive cost but negative profit
            day.cpPercentage = day.netCost !== 0
                ? (day.netProfit / day.netCost) * 100
                : 0;
        }
    });

    return Object.values(profitByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
}

module.exports = router;