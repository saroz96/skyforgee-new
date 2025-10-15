const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../middleware/auth');
const { ensureTradeType } = require('../middleware/tradeType');
const Company = require('../models/Company');
const NepaliDate = require('nepali-date');
const FiscalYear = require('../models/FiscalYear');
const ensureFiscalYear = require('../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../middleware/checkFiscalYearDateRange');
const Item = require('../models/retailer/Item');
const Transaction = require('../models/retailer/Transaction');
const Account = require('../models/retailer/Account');
const BillCounter = require('../models/retailer/billCounter');
const CompanyGroup = require('../models/retailer/CompanyGroup');
const Settings = require('../models/retailer/Settings');
const itemsCompany = require('../models/retailer/itemsCompany');
const SalesQuotation = require('../models/retailer/SalesQuotation');
const Category = require('../models/retailer/Category');
const MainUnit = require('../models/retailer/MainUnit');
const Unit = require('../models/retailer/Unit');
const User = require('../models/User');
const Composition = require('../models/retailer/Composition');

let progress = 0; // 0 to 100

// Route to get all fiscal years for the current company as JSON
router.get('/switch-fiscal-year', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

        // Fetch all fiscal years for the company
        const fiscalYears = await FiscalYear.find({ company: companyId });
        const initialCurrentFiscalYear = company.fiscalYear;

        // If no current fiscal year is set in session, set the last one as current
        let currentFiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;

        if (!currentFiscalYear && fiscalYears.length > 0) {
            const lastFiscalYear = fiscalYears[fiscalYears.length - 1];
            currentFiscalYear = lastFiscalYear._id.toString();
            req.session.currentFiscalYear = {
                id: currentFiscalYear,
                startDate: lastFiscalYear.startDate,
                endDate: lastFiscalYear.endDate,
                name: lastFiscalYear.name,
                dateFormat: lastFiscalYear.dateFormat,
                isActive: lastFiscalYear.isActive
            };
        }

        // Return JSON response for React components
        res.json({
            success: true,
            data: {
                company: {
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    fiscalYear: company.fiscalYear
                },
                currentFiscalYear,
                initialCurrentFiscalYear,
                fiscalYears,
                currentCompanyName,
                user: {
                    id: req.user._id,
                    preferences: {
                        theme: req.user.preferences?.theme || 'light'
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            }
        });
    } catch (err) {
        console.error('Error fetching fiscal years:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to fetch fiscal years data'
        });
    }
});

// Route to change the current fiscal year
router.post('/switch-fiscal-year', ensureAuthenticated, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
    try {
        const { fiscalYearId } = req.body;
        const companyId = req.session.currentCompany;

        // Validate request body
        if (!fiscalYearId) {
            return res.status(400).json({
                success: false,
                error: 'Fiscal Year ID is required'
            });
        }

        // Fetch the selected fiscal year
        const fiscalYear = await FiscalYear.findOne({
            _id: fiscalYearId,
            company: companyId
        });

        if (!fiscalYear) {
            return res.status(404).json({
                success: false,
                error: 'Fiscal Year not found'
            });
        }

        // // Check if fiscal year is active
        // if (!fiscalYear.isActive) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Cannot switch to an inactive fiscal year'
        //     });
        // }

        // Update the session with the new fiscal year
        req.session.currentFiscalYear = {
            id: fiscalYear._id.toString(),
            startDate: fiscalYear.startDate,
            endDate: fiscalYear.endDate,
            name: fiscalYear.name,
            dateFormat: fiscalYear.dateFormat,
            isActive: fiscalYear.isActive
        };

        // Save the session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update session'
                });
            }

            // Return success response
            res.status(200).json({
                success: true,
                message: 'Fiscal year switched successfully',
                data: {
                    fiscalYear: {
                        _id: fiscalYear._id,
                        name: fiscalYear.name,
                        startDate: fiscalYear.startDate,
                        endDate: fiscalYear.endDate,
                        dateFormat: fiscalYear.dateFormat,
                        isActive: fiscalYear.isActive
                    },
                    sessionUpdated: true
                }
            });
        });

    } catch (err) {
        console.error('Error switching fiscal year:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: err.message
        });
    }
});

//route to get for change new fiscalyear
router.get('/change-fiscal-year', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Fiscal year logic (your existing code remains the same)
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

            let nextFiscalYearStartDate = null;
            if (currentFiscalYear) {
                const currentEndDate = currentFiscalYear.endDate;
                if (currentEndDate instanceof Date) {
                    const nextDate = new Date(currentEndDate);
                    nextDate.setDate(nextDate.getDate() + 1);
                    nextFiscalYearStartDate = nextDate.toISOString().split('T')[0];
                } else if (typeof currentEndDate === 'string') {
                    const [year, month, day] = currentEndDate.split('-').map(Number);
                    nextFiscalYearStartDate = `${year}-${String(month).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}`;
                } else {
                    throw new Error('Unsupported date format for currentFiscalYear.endDate');
                }
            }

            // Return JSON response instead of rendering template
            return res.status(200).json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    nextFiscalYearStartDate,
                    currentFiscalYear: currentFiscalYear ? {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    } : null,
                    currentCompanyName,
                    nepaliDate,
                    companyDateFormat,
                    user: {
                        _id: req.user._id,
                        username: req.user.username,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences
                    },
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });

        } catch (err) {
            console.error('Error fetching fiscal year:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to load fiscal year data.',
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


router.get('/change-fiscal-year-stream', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized access' })}\n\n`);
        return res.end();
    }

    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    // Function to send events
    const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    const session = await mongoose.startSession();
    let transactionCommitted = false;
    let transactionAborted = false;

    // Helper function to safely abort transaction
    const safeAbortTransaction = async () => {
        if (!transactionCommitted && !transactionAborted && session.inTransaction()) {
            try {
                await session.abortTransaction();
                transactionAborted = true;
            } catch (abortError) {
                // Ignore errors when aborting already aborted transaction
                if (!abortError.message.includes('abortTransaction twice')) {
                    console.error('Error aborting transaction:', abortError);
                }
            }
        }
    };

    try {
        // Start transaction with extended timeout and retry options
        const transactionOptions = {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
            maxTimeMS: 600000, // 10 minute timeout
            retryWrites: true
        };

        await session.withTransaction(async () => {
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;

            // Get parameters from query string
            const { startDateEnglish, endDateEnglish, startDateNepali, endDateNepali, dateFormat } = req.query;

            let startDate, endDate;
            if (dateFormat === 'nepali') {
                startDate = startDateNepali;
                endDate = endDateNepali;
            } else if (dateFormat === 'english') {
                startDate = startDateEnglish;
                endDate = endDateEnglish;
            } else {
                sendEvent('error', { message: 'Invalid date format' });
                throw new Error('Invalid date format');
            }

            if (!endDate) {
                endDate = new Date(startDate);
                endDate.setFullYear(endDate.getFullYear() + 1);
                endDate.setDate(endDate.getDate() - 1);
            }

            const startDateObject = new Date(startDate);
            const endDateObject = new Date(endDate);
            const startYear = startDateObject.getFullYear();
            const endYear = endDateObject.getFullYear();
            const fiscalYearName = `${startYear}/${endYear.toString().slice(-2)}`;

            // Step 1: Create fiscal year
            sendEvent('log', { message: `Creating new fiscal year ${fiscalYearName}...` });
            sendEvent('progress', { value: 10 });

            const existingFiscalYear = await FiscalYear.findOne({
                name: fiscalYearName,
                company: companyId
            }).session(session);

            if (existingFiscalYear) {
                sendEvent('error', { message: `Fiscal Year ${fiscalYearName} already exists.` });
                throw new Error('Fiscal year already exists');
            }

            // Process in batches to avoid transaction timeouts
            const processInBatches = async (items, processFn, batchSize = 50) => {
                for (let i = 0; i < items.length; i += batchSize) {
                    const batch = items.slice(i, i + batchSize);
                    await Promise.all(batch.map(item => processFn(item)));

                    // Send progress updates
                    const progress = 33 + (i / items.length * 33);
                    sendEvent('progress', { value: Math.min(progress, 66) });
                }
            };

            const newFiscalYear = (await FiscalYear.create([{
                name: fiscalYearName,
                startDate: startDateObject,
                endDate: endDateObject,
                dateFormat,
                company: companyId
            }], { session }))[0];

            sendEvent('log', { message: `Created new fiscal year: ${fiscalYearName}` });
            sendEvent('progress', { value: 33 });

            // Step 1.5: Clone settings to new fiscal year - FIXED DUPLICATE KEY ISSUE
            sendEvent('log', { message: 'Cloning settings to new fiscal year...' });

            // Check if settings already exist for this user and company in new fiscal year
            const existingSettings = await Settings.findOne({
                company: companyId,
                fiscalYear: newFiscalYear._id,
                userId: req.user.id
            }).session(session);

            if (existingSettings) {
                sendEvent('log', { message: 'Settings already exist for new fiscal year, skipping creation' });
            } else {
                const currentSettings = await Settings.findOne({
                    company: companyId,
                    fiscalYear: currentFiscalYear,
                    userId: req.user.id
                }).session(session);

                if (currentSettings) {
                    // Create new settings with unique _id and proper fiscal year reference
                    const newSettingsData = {
                        ...currentSettings.toObject(),
                        _id: new mongoose.Types.ObjectId(), // Generate new unique ID
                        fiscalYear: newFiscalYear._id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    // Remove any existing _id to ensure new one is used
                    delete newSettingsData._id;

                    await Settings.create([newSettingsData], { session });
                    sendEvent('log', { message: 'Settings cloned successfully' });
                } else {
                    // Create default settings
                    await Settings.create([{
                        company: companyId,
                        userId: req.user.id,
                        fiscalYear: newFiscalYear._id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }], { session });
                    sendEvent('log', { message: 'Created default settings for new fiscal year' });
                }
            }

            // Step 2: Process items in batches
            sendEvent('log', { message: 'Creating items for new fiscal year...' });
            const items = await Item.find({
                company: companyId,
                fiscalYear: { $in: [currentFiscalYear] }
            }).session(session);

            await processInBatches(items, async (item) => {
                try {
                    // Get ALL transactions that affect stock for this item
                    const stockTransactions = await Transaction.find({
                        item: item._id,
                        company: companyId,
                        fiscalYear: currentFiscalYear,
                        type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'StockAdjustment'] }
                    }).sort({ date: 1 }).session(session);

                    // Calculate current stock by processing all transactions
                    let currentStock = item.openingStockByFiscalYear?.find(f => f.fiscalYear.equals(currentFiscalYear))?.openingStock || 0;
                    let totalPurchases = 0;
                    let totalSales = 0;
                    let totalPurchaseReturns = 0;
                    let totalSalesReturns = 0;
                    let totalAdjustments = 0;

                    for (const transaction of stockTransactions) {
                        switch (transaction.type) {
                            case 'Purc': // Purchase
                                currentStock += transaction.quantity;
                                totalPurchases += transaction.quantity;
                                break;
                            case 'Sale': // Sale
                                currentStock -= transaction.quantity;
                                totalSales += transaction.quantity;
                                break;
                            case 'PrRt': // Purchase Return
                                currentStock -= transaction.quantity;
                                totalPurchaseReturns += transaction.quantity;
                                break;
                            case 'SlRt': // Sales Return
                                currentStock += transaction.quantity;
                                totalSalesReturns += transaction.quantity;
                                break;
                            case 'StockAdjustment': // Stock Adjustment
                                currentStock += transaction.adjustmentQuantity;
                                totalAdjustments += transaction.adjustmentQuantity;
                                break;
                        }
                    }

                    // Calculate weighted average purchase price from stockEntries
                    let totalQuantityFromEntries = 0;
                    let totalPriceFromEntries = 0;
                    let totalSalesPriceFromEntries = 0;

                    for (const entry of item.stockEntries) {
                        if (entry.puPrice && entry.quantity) {
                            totalQuantityFromEntries += entry.quantity;
                            totalPriceFromEntries += entry.quantity * entry.puPrice;
                            totalSalesPriceFromEntries += entry.quantity * entry.price;
                        }
                    }

                    let purchasePrice = 0;
                    let salesPrice = 0;
                    if (totalQuantityFromEntries > 0) {
                        purchasePrice = totalPriceFromEntries / totalQuantityFromEntries;
                        salesPrice = totalSalesPriceFromEntries / totalQuantityFromEntries;
                    } else {
                        // Fallback to transaction-based calculation
                        const purchases = await Transaction.find({
                            item: item._id,
                            company: companyId,
                            type: 'Purc',
                            fiscalYear: currentFiscalYear
                        }).session(session);

                        let totalQuantity = 0;
                        let totalPrice = 0;
                        for (let purchase of purchases) {
                            totalQuantity += purchase.quantity;
                            totalPrice += purchase.quantity * purchase.puPrice;
                        }
                        purchasePrice = totalQuantity > 0 ? (totalPrice / totalQuantity) : item.puPrice;

                        const salesTransactions = await Transaction.find({
                            item: item._id,
                            company: companyId,
                            type: 'Sale',
                            fiscalYear: currentFiscalYear
                        }).session(session);

                        let totalSalesQuantity = 0;
                        let totalSalesPrice = 0;
                        for (let sale of salesTransactions) {
                            if (sale.salesPrice && sale.quantity) {
                                totalSalesQuantity += sale.quantity;
                                totalSalesPrice += sale.quantity * sale.salesPrice;
                            }
                        }
                        if (totalSalesQuantity > 0) {
                            salesPrice = totalSalesPrice / totalSalesQuantity;
                        }
                    }

                    const openingStockFromEntries = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
                    const openingStock = openingStockFromEntries > 0 ? openingStockFromEntries : currentStock;
                    const openingStockValue = purchasePrice * openingStock;

                    sendEvent('log', {
                        message: `Item ${item.name} - ` +
                            `Stock from Entries: ${openingStockFromEntries}, ` +
                            `Purchases: ${totalPurchases}, ` +
                            `Sales: ${totalSales}, ` +
                            `Purchase Returns: ${totalPurchaseReturns}, ` +
                            `Sales Returns: ${totalSalesReturns}, ` +
                            `Adjustments: ${totalAdjustments},` +
                            `Purchase Price: ${purchasePrice} (from ${totalQuantityFromEntries > 0 ? 'stock entries' : 'transactions'})`
                    });

                    if (!item.fiscalYear.includes(newFiscalYear._id)) {
                        item.fiscalYear.push(newFiscalYear._id);
                    }

                    // Remove existing opening stock entry for this fiscal year if it exists
                    item.openingStockByFiscalYear = item.openingStockByFiscalYear.filter(
                        f => !f.fiscalYear.equals(newFiscalYear._id)
                    );

                    item.openingStockByFiscalYear.push({
                        fiscalYear: newFiscalYear._id,
                        openingStock: openingStock,
                        openingStockValue: openingStockValue,
                        purchasePrice: purchasePrice,
                        salesPrice: salesPrice,
                    });

                    // Remove existing closing stock entry for current fiscal year if it exists
                    item.closingStockByFiscalYear = item.closingStockByFiscalYear.filter(
                        f => !f.fiscalYear.equals(currentFiscalYear)
                    );

                    item.closingStockByFiscalYear.push({
                        fiscalYear: currentFiscalYear,
                        closingStock: openingStock,
                        closingStockValue: openingStockValue,
                        purchasePrice: purchasePrice,
                        salesPrice: salesPrice,
                    });

                    item.stock = openingStock;
                    item.openingStock = openingStock;

                    await item.save({ session });
                    sendEvent('log', { message: `Created item: ${item.name} with stock: ${item.stock}` });
                } catch (saveError) {
                    console.error(`Error processing item ${item.name}:`, saveError);
                    throw saveError;
                }
            });

            // Step 3: Process accounts in batches
            sendEvent('log', { message: 'Updating accounts for new fiscal year...' });
            const accounts = await Account.find({
                company: companyId,
                fiscalYear: { $in: [currentFiscalYear] }
            }).session(session);

            // Define account groups that should have zero opening balance (except cash accounts)
            const zeroBalanceGroups = await CompanyGroup.find({
                name: {
                    $in: ['Purchase', 'Sale', 'Fixed Assets',
                        'Reserves & Surplus',
                        'Secured Loans',
                        'Securities & Deposits',
                        'Stock in hand',
                        'Unsecured Loans',
                        'Expenses (Direct/Mfg.)',
                        'Expenses (Indirect/Admn.)',
                        'Income (Direct/Opr.)',
                        'Income (Indirect)',
                        'Loans & Advances',
                        'Provisions/Expenses Payable',
                        'Profit & Loss',
                        'Current Assets',
                    ]
                },
                company: companyId
            }).select('_id').session(session);

            const zeroBalanceGroupIds = zeroBalanceGroups.map(g => g._id);

            // Get special account group IDs
            const [cashInHandGroup, sundryDebtorsGroup, sundryCreditorsGroup] = await Promise.all([
                CompanyGroup.findOne({ name: 'Cash in Hand', company: companyId }).select('_id').session(session),
                CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }).select('_id').session(session),
                CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId }).select('_id').session(session)
            ]);

            const cashInHandGroupId = cashInHandGroup?._id;
            const sundryDebtorsGroupId = sundryDebtorsGroup?._id;
            const sundryCreditorsGroupId = sundryCreditorsGroup?._id;

            const processAccountBatch = async (batch) => {
                return Promise.all(batch.map(async (account) => {
                    try {
                        // Determine account type
                        const isCashAccount = account.companyGroups?.equals(cashInHandGroupId) ||
                            account.name === 'Cash in Hand';
                        const isSundryAccount = account.companyGroups?.equals(sundryDebtorsGroupId) ||
                            account.companyGroups?.equals(sundryCreditorsGroupId);
                        const isZeroBalanceAccount = account.companyGroups &&
                            zeroBalanceGroupIds.some(id => id.equals(account.companyGroups));

                        // Build transaction query
                        let transactionQuery = {
                            account: account._id,
                            company: companyId,
                            fiscalYear: currentFiscalYear,
                            type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] }
                        };

                        if (isSundryAccount) {
                            transactionQuery.$or = [
                                { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: { $ne: 'cash' } },
                                { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] } }
                            ];
                        }

                        // Get transactions for balance calculation
                        const transactions = await Transaction.find(transactionQuery).session(session);

                        // Calculate new opening balance - USING openingBalanceByFiscalYear
                        let newOpeningBalance;
                        if (isZeroBalanceAccount) {
                            newOpeningBalance = {
                                amount: 0,
                                type: 'Dr',
                                fiscalYear: newFiscalYear._id
                            };
                            sendEvent('log', { message: `Resetting balance to zero for ${account.name} (special account)` });
                        } else {
                            // Get opening balance from openingBalanceByFiscalYear for current fiscal year
                            const currentFiscalYearOpeningBalance = account.openingBalanceByFiscalYear?.find(
                                f => f.fiscalYear.equals(currentFiscalYear)
                            );

                            let runningBalance = 0;
                            let startingBalanceType = 'Dr';

                            if (currentFiscalYearOpeningBalance) {
                                runningBalance = currentFiscalYearOpeningBalance.amount;
                                startingBalanceType = currentFiscalYearOpeningBalance.type;
                                if (startingBalanceType === 'Cr') {
                                    runningBalance = -runningBalance;
                                }
                                sendEvent('log', { message: `Using opening balance from openingBalanceByFiscalYear for ${account.name}: ${currentFiscalYearOpeningBalance.amount} ${currentFiscalYearOpeningBalance.type}` });
                            } else {
                                // Fallback to current openingBalance if no fiscal year entry found
                                runningBalance = account.openingBalance.amount;
                                startingBalanceType = account.openingBalance.type;
                                if (startingBalanceType === 'Cr') {
                                    runningBalance = -runningBalance;
                                }
                                sendEvent('log', { message: `Using current openingBalance for ${account.name}: ${account.openingBalance.amount} ${account.openingBalance.type} (fallback)` });
                            }

                            // Process all transactions to calculate running balance
                            for (const transaction of transactions) {
                                if (transaction.debit > 0) runningBalance += transaction.debit;
                                if (transaction.credit > 0) runningBalance -= transaction.credit;
                            }

                            newOpeningBalance = {
                                amount: Math.abs(runningBalance),
                                type: runningBalance >= 0 ? 'Dr' : 'Cr',
                                fiscalYear: newFiscalYear._id
                            };
                        }

                        // Update account for new fiscal year
                        if (!account.fiscalYear.includes(newFiscalYear._id)) {
                            account.fiscalYear.push(newFiscalYear._id);
                        }

                        // Remove existing opening balance entry for this fiscal year if it exists
                        account.openingBalanceByFiscalYear = account.openingBalanceByFiscalYear.filter(
                            f => !f.fiscalYear.equals(newFiscalYear._id)
                        );

                        account.openingBalanceByFiscalYear.push({
                            fiscalYear: newFiscalYear._id,
                            amount: newOpeningBalance.amount,
                            type: newOpeningBalance.type,
                            date: new Date()
                        });

                        account.openingBalance = {
                            fiscalYear: newFiscalYear._id,
                            amount: newOpeningBalance.amount,
                            type: newOpeningBalance.type
                        };

                        // Remove existing closing balance entry for current fiscal year if it exists
                        account.closingBalanceByFiscalYear = account.closingBalanceByFiscalYear.filter(
                            f => !f.fiscalYear.equals(currentFiscalYear)
                        );

                        account.closingBalanceByFiscalYear.push({
                            fiscalYear: currentFiscalYear,
                            amount: newOpeningBalance.amount,
                            type: newOpeningBalance.type,
                            date: new Date()
                        });

                        await account.save({ session });
                        sendEvent('log', {
                            message: `Updated account: ${account.name} with new balance: ${newOpeningBalance.amount} ${newOpeningBalance.type}` +
                                (isZeroBalanceAccount ? ' (reset to zero)' : '') +
                                (isCashAccount ? ' (cash account)' : '') +
                                (isSundryAccount ? ' (sundry account)' : '')
                        });
                    } catch (saveError) {
                        console.error(`Error processing account ${account.name}:`, saveError);
                        throw saveError;
                    }
                }));
            };

            // Process accounts in batches of 50
            const BATCH_SIZE = 50;
            let accountsProcessed = 0;
            const totalAccounts = accounts.length;

            for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
                const batch = accounts.slice(i, i + BATCH_SIZE);
                await processAccountBatch(batch);
                accountsProcessed += batch.length;

                // Update progress
                const progress = 66 + (accountsProcessed / totalAccounts * 34);
                sendEvent('progress', { value: Math.min(progress, 100) });
            }

            sendEvent('log', { message: `Completed updating ${accountsProcessed} accounts` });

            // Initialize bill counters - Check for existing ones first
            sendEvent('log', { message: 'Initializing bill counters...' });
            const transactionTypes = [
                'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
                'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment'
            ];

            for (const transactionType of transactionTypes) {
                const existingCounter = await BillCounter.findOne({
                    company: companyId,
                    fiscalYear: newFiscalYear._id,
                    transactionType
                }).session(session);

                if (!existingCounter) {
                    await BillCounter.create([{
                        company: companyId,
                        fiscalYear: newFiscalYear._id,
                        transactionType,
                        currentBillNumber: 0
                    }], { session });
                }
            }

            // Update session
            req.session.currentFiscalYear = {
                id: newFiscalYear._id.toString(),
                startDate: newFiscalYear.startDate,
                endDate: newFiscalYear.endDate,
                name: newFiscalYear.name,
                dateFormat: newFiscalYear.dateFormat,
                isActive: true
            };

            // Mark transaction as committed
            transactionCommitted = true;

            sendEvent('progress', { value: 100 });
            sendEvent('complete', { message: `Fiscal year ${fiscalYearName} created successfully!` });
        }, transactionOptions);

    } catch (err) {
        console.error('Error in fiscal year creation:', err);

        // Only abort if transaction wasn't committed
        await safeAbortTransaction();

        sendEvent('error', {
            message: `Failed to create fiscal year: ${err.message}`,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    } finally {
        try {
            await session.endSession();
        } catch (sessionError) {
            console.error('Error ending session:', sessionError);
        }
        res.end();
    }

    // Handle client disconnect
    req.on('close', async () => {
        await safeAbortTransaction();
        try {
            await session.endSession();
        } catch (sessionError) {
            console.error('Error ending session on close:', sessionError);
        }
    });
});

router.get('/progress', (req, res) => {
    res.status(200).json({ progress });
});

router.get('/split-fiscal-year', ensureAuthenticated, ensureCompanySelected, async (req, res) => {
    console.log('Split fiscal year SSE endpoint hit');

    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    const session = await mongoose.startSession();

    try {
        // Get parameters from query string (GET request)
        const {
            sourceCompanyId,
            fiscalYearId,
            newCompanyName,
            deleteAfterSplit = 'false'
        } = req.query;

        console.log('SSE Split request params:', { sourceCompanyId, fiscalYearId, newCompanyName, deleteAfterSplit });

        // Validate input
        if (!sourceCompanyId || !fiscalYearId || !newCompanyName) {
            res.write(`data: ${JSON.stringify({
                type: 'error',
                error: 'Source company ID, fiscal year ID, and new company name are required'
            })}\n\n`);
            res.end();
            return;
        }

        // Convert deleteAfterSplit to boolean
        const shouldDeleteAfterSplit = deleteAfterSplit === 'true';

        await session.withTransaction(async () => {
            const userId = req.user.id;

            // Send initial progress
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 5, message: 'Starting company split process...' })}\n\n`);

            // Get source company
            const sourceCompany = await Company.findById(sourceCompanyId).session(session);
            if (!sourceCompany) {
                res.write(`data: ${JSON.stringify({ type: 'error', error: 'Source company not found' })}\n\n`);
                res.end();
                return;
            }

            // Get fiscal year to split
            const splitFiscalYear = await FiscalYear.findOne({
                _id: fiscalYearId,
                company: sourceCompanyId
            }).session(session);

            if (!splitFiscalYear) {
                res.write(`data: ${JSON.stringify({ type: 'error', error: 'Fiscal year not found in source company' })}\n\n`);
                res.end();
                return;
            }

            // Check if new company name already exists for this user
            const existingCompany = await Company.findOne({
                name: newCompanyName,
                owner: userId
            }).session(session);

            if (existingCompany) {
                res.write(`data: ${JSON.stringify({ type: 'error', error: 'Company with this name already exists' })}\n\n`);
                res.end();
                return;
            }

            // Step 1: Create new company
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 10, message: 'Creating new company...' })}\n\n`);
            // Convert the start date to YYYY-MM-DD format
            const startDateObj = new Date(splitFiscalYear.startDate);
            const formattedStartDate = startDateObj.toISOString().split('T')[0];

            const newCompany = await Company.create([{
                name: newCompanyName,
                owner: userId,
                tradeType: sourceCompany.tradeType,
                address: sourceCompany.address,
                country: sourceCompany.country,
                state: sourceCompany.state,
                city: sourceCompany.city,
                ward: sourceCompany.ward,
                phone: sourceCompany.phone,
                pan: sourceCompany.pan,
                email: sourceCompany.email,
                users: [],
                currency: sourceCompany.currency,
                vatEnabled: sourceCompany.vatEnabled,
                dateFormat: sourceCompany.dateFormat,
                fiscalYearStartDate: formattedStartDate,
                createdAt: new Date(splitFiscalYear.startDate),
                updatedAt: new Date()
            }], { session });

            const newCompanyId = newCompany[0]._id;

            // Step 2: Create fiscal years for new company
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 15, message: 'Setting up fiscal years...' })}\n\n`);

            const newFiscalYear = await FiscalYear.create([{
                name: splitFiscalYear.name,
                startDate: splitFiscalYear.startDate,
                endDate: splitFiscalYear.endDate,
                dateFormat: splitFiscalYear.dateFormat,
                company: newCompanyId,
                isActive: true
            }], { session });

            const newFiscalYearId = newFiscalYear[0]._id;

            // Step 3: Clone settings
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 20, message: 'Cloning settings...' })}\n\n`);

            const sourceSettings = await Settings.findOne({
                company: sourceCompanyId,
                fiscalYear: splitFiscalYear._id
            }).session(session);

            if (sourceSettings) {
                await Settings.create([{
                    ...sourceSettings.toObject(),
                    _id: new mongoose.Types.ObjectId(),
                    company: newCompanyId,
                    fiscalYear: newFiscalYearId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }], { session });
            }

            // Step 4: Clone users from source company
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 21, message: 'Cloning users with roles and permissions...' })}\n\n`);

            const sourceUsers = await User.find({
                company: sourceCompanyId
            }).session(session);

            let usersProcessed = 0;
            const userBatchSize = 20;

            // Create user mapping for grantedBy references
            const userMap = new Map();

            for (let i = 0; i < sourceUsers.length; i += userBatchSize) {
                const batch = sourceUsers.slice(i, i + userBatchSize);

                const userCreationPromises = batch.map(async (user) => {
                    try {
                        // Skip if this is the current user (owner) since they're already the owner of new company
                        if (user._id.toString() === userId.toString()) {
                            userMap.set(user._id.toString(), userId);
                            usersProcessed++;
                            return userId;
                        }

                        // Check if user with same email already exists
                        const existingUser = await User.findOne({
                            email: user.email
                        }).session(session);

                        let newUserId;

                        if (existingUser) {
                            // User exists, check if they need to be added to the new company
                            const userInNewCompany = existingUser.company && existingUser.company.toString() === newCompanyId.toString();

                            if (!userInNewCompany) {
                                // Add existing user to new company
                                await User.findByIdAndUpdate(
                                    existingUser._id,
                                    {
                                        $set: { company: newCompanyId },
                                        fiscalYear: newFiscalYearId,
                                        updatedAt: new Date()
                                    },
                                    { session }
                                );
                            }
                            newUserId = existingUser._id;
                            console.log(`User "${user.email}" added to new company with role: ${user.role}`);
                        } else {
                            // Create new user with hashed password and all permissions
                            const newUserData = {
                                name: user.name,
                                email: user.email,
                                password: user.password, // Already hashed in source
                                company: newCompanyId,
                                fiscalYear: newFiscalYearId,
                                isActive: user.isActive,
                                isAdmin: user.isAdmin,
                                role: user.role,
                                isEmailVerified: user.isEmailVerified,
                                menuPermissions: user.menuPermissions ? new Map(user.menuPermissions) : new Map(),
                                preferences: user.preferences ? { ...user.preferences } : { theme: 'light' },
                                createdAt: new Date(),
                                updatedAt: new Date()
                            };

                            // Handle grantedBy mapping if it exists
                            if (user.grantedBy && user.grantedBy._id) {
                                const grantedByNewId = userMap.get(user.grantedBy._id.toString());
                                if (grantedByNewId) {
                                    newUserData.grantedBy = grantedByNewId;
                                } else {
                                    // If grantedBy user not cloned yet, set to current user (owner)
                                    newUserData.grantedBy = userId;
                                }
                            }

                            const newUser = await User.create([newUserData], { session });
                            newUserId = newUser[0]._id;
                            console.log(`Created new user: ${user.name} (${user.email}) with role: ${user.role}`);
                        }

                        // Store mapping for user references
                        userMap.set(user._id.toString(), newUserId);
                        usersProcessed++;
                        return newUserId;
                    } catch (error) {
                        console.error(`Error cloning user ${user.email}:`, error);

                        // If it's a duplicate key error, try to find the existing user
                        if (error.code === 11000) {
                            const existingUser = await User.findOne({
                                email: user.email
                            }).session(session);

                            if (existingUser) {
                                // Add existing user to new company
                                await User.findByIdAndUpdate(
                                    existingUser._id,
                                    {
                                        $set: { company: newCompanyId },
                                        fiscalYear: newFiscalYearId,
                                        updatedAt: new Date()
                                    },
                                    { session }
                                );
                                userMap.set(user._id.toString(), existingUser._id);
                                usersProcessed++;
                                return existingUser._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(userCreationPromises);

                const progress = 21 + (usersProcessed / sourceUsers.length * 1);
                res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 22), message: `Cloned ${usersProcessed}/${sourceUsers.length} users with roles and permissions...` })}\n\n`);
            }

            // Update grantedBy references for all users in a second pass
            if (userMap.size > 0) {
                res.write(`data: ${JSON.stringify({ type: 'progress', value: 21.8, message: 'Updating user permissions references...' })}\n\n`);

                const updateGrantedByPromises = [];
                userMap.forEach((newUserId, oldUserId) => {
                    updateGrantedByPromises.push(
                        User.updateMany(
                            {
                                company: newCompanyId,
                                grantedBy: oldUserId
                            },
                            {
                                $set: {
                                    grantedBy: newUserId,
                                    lastPermissionUpdate: new Date()
                                }
                            },
                            { session }
                        )
                    );
                });

                await Promise.all(updateGrantedByPromises);
            }

            // Update company with all cloned users
            const clonedUserIds = Array.from(userMap.values());
            // Add current user (owner) to the list if not already included
            if (!clonedUserIds.includes(userId)) {
                clonedUserIds.push(userId);
            }

            await Company.findByIdAndUpdate(
                newCompanyId,
                {
                    $set: { users: clonedUserIds },
                    updatedAt: new Date()
                },
                { session }
            );

            res.write(`data: ${JSON.stringify({ type: 'progress', value: 22, message: 'User cloning completed successfully' })}\n\n`);

            // Step 5: Clone company groups from source company
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 23, message: 'Cloning account groups...' })}\n\n`);

            const sourceCompanyGroups = await CompanyGroup.find({
                company: sourceCompanyId
            }).session(session);

            let companyGroupsProcessed = 0;
            const companyGroupBatchSize = 50;

            // Create company group mapping for account cloning
            const companyGroupMap = new Map();

            for (let i = 0; i < sourceCompanyGroups.length; i += companyGroupBatchSize) {
                const batch = sourceCompanyGroups.slice(i, i + companyGroupBatchSize);

                const companyGroupCreationPromises = batch.map(async (companyGroup) => {
                    try {
                        // Check if company group with same name already exists in new company
                        const existingCompanyGroup = await CompanyGroup.findOne({
                            name: companyGroup.name,
                            company: newCompanyId
                        }).session(session);

                        let newCompanyGroupId;

                        if (existingCompanyGroup) {
                            // Use existing company group
                            newCompanyGroupId = existingCompanyGroup._id;
                            console.log(`CompanyGroup "${companyGroup.name}" already exists in new company, using existing company group`);
                        } else {
                            // Create new company group
                            const newCompanyGroup = await CompanyGroup.create([{
                                name: companyGroup.name,
                                type: companyGroup.type,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });

                            newCompanyGroupId = newCompanyGroup[0]._id;
                            console.log(`Created new company group: ${companyGroup.name} with type: ${companyGroup.type} in new company`);
                        }

                        // Store mapping for account company group reference updates
                        companyGroupMap.set(companyGroup._id.toString(), newCompanyGroupId);
                        return newCompanyGroupId;
                    } catch (error) {
                        console.error(`Error cloning company group ${companyGroup.name}:`, error);

                        // If it's a duplicate key error, try to find the existing company group
                        if (error.code === 11000) {
                            const existingCompanyGroup = await CompanyGroup.findOne({
                                name: companyGroup.name,
                                company: newCompanyId
                            }).session(session);

                            if (existingCompanyGroup) {
                                companyGroupMap.set(companyGroup._id.toString(), existingCompanyGroup._id);
                                return existingCompanyGroup._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(companyGroupCreationPromises);
                companyGroupsProcessed += batch.length;

                const progress = 23 + (companyGroupsProcessed / sourceCompanyGroups.length * 1);
                res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 24), message: `Cloned ${companyGroupsProcessed}/${sourceCompanyGroups.length} account groups...` })}\n\n`);
            }

            // Step 6: Clone categories from source company
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 24, message: 'Cloning categories...' })}\n\n`);

            const sourceCategories = await Category.find({
                company: sourceCompanyId
            }).session(session);

            let categoriesProcessed = 0;
            const categoryBatchSize = 50;

            // Create category mapping for item cloning
            const categoryMap = new Map();

            for (let i = 0; i < sourceCategories.length; i += categoryBatchSize) {
                const batch = sourceCategories.slice(i, i + categoryBatchSize);

                const categoryCreationPromises = batch.map(async (category) => {
                    try {
                        // Check if category with same name already exists in new company
                        const existingCategory = await Category.findOne({
                            name: category.name,
                            company: newCompanyId
                        }).session(session);

                        let newCategoryId;

                        if (existingCategory) {
                            // Use existing category
                            newCategoryId = existingCategory._id;
                            console.log(`Category "${category.name}" already exists in new company, using existing category`);
                        } else {
                            // Create new category
                            const newCategory = await Category.create([{
                                name: category.name,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });

                            newCategoryId = newCategory[0]._id;
                            console.log(`Created new category: ${category.name} in new company`);
                        }

                        // Store mapping for item category reference updates
                        categoryMap.set(category._id.toString(), newCategoryId);
                        return newCategoryId;
                    } catch (error) {
                        console.error(`Error cloning category ${category.name}:`, error);

                        // If it's a duplicate key error, try to find the existing category
                        if (error.code === 11000) {
                            const existingCategory = await Category.findOne({
                                name: category.name,
                                company: newCompanyId
                            }).session(session);

                            if (existingCategory) {
                                categoryMap.set(category._id.toString(), existingCategory._id);
                                return existingCategory._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(categoryCreationPromises);
                categoriesProcessed += batch.length;

                const progress = 24 + (categoriesProcessed / sourceCategories.length * 1);
                res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 25), message: `Cloned ${categoriesProcessed}/${sourceCategories.length} categories...` })}\n\n`);
            }

            // Step 7: Clone itemsCompany from source company
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 25, message: 'Cloning items companies...' })}\n\n`);

            const sourceItemsCompanies = await itemsCompany.find({
                company: sourceCompanyId
            }).session(session);

            let itemsCompaniesProcessed = 0;
            const itemsCompanyBatchSize = 50;

            // Create itemsCompany mapping for item cloning
            const itemsCompanyMap = new Map();

            for (let i = 0; i < sourceItemsCompanies.length; i += itemsCompanyBatchSize) {
                const batch = sourceItemsCompanies.slice(i, i + itemsCompanyBatchSize);

                const itemsCompanyCreationPromises = batch.map(async (itemsComp) => {
                    try {
                        // Check if itemsCompany with same name already exists in new company
                        const existingItemsCompany = await itemsCompany.findOne({
                            name: itemsComp.name,
                            company: newCompanyId
                        }).session(session);

                        let newItemsCompanyId;

                        if (existingItemsCompany) {
                            // Use existing itemsCompany
                            newItemsCompanyId = existingItemsCompany._id;
                            console.log(`ItemsCompany "${itemsComp.name}" already exists in new company, using existing itemsCompany`);
                        } else {
                            // Create new itemsCompany
                            const newItemsCompany = await itemsCompany.create([{
                                name: itemsComp.name,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });

                            newItemsCompanyId = newItemsCompany[0]._id;
                            console.log(`Created new itemsCompany: ${itemsComp.name} in new company`);
                        }

                        // Store mapping for item itemsCompany reference updates
                        itemsCompanyMap.set(itemsComp._id.toString(), newItemsCompanyId);
                        return newItemsCompanyId;
                    } catch (error) {
                        console.error(`Error cloning itemsCompany ${itemsComp.name}:`, error);

                        // If it's a duplicate key error, try to find the existing itemsCompany
                        if (error.code === 11000) {
                            const existingItemsCompany = await itemsCompany.findOne({
                                name: itemsComp.name,
                                company: newCompanyId
                            }).session(session);

                            if (existingItemsCompany) {
                                itemsCompanyMap.set(itemsComp._id.toString(), existingItemsCompany._id);
                                return existingItemsCompany._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(itemsCompanyCreationPromises);
                itemsCompaniesProcessed += batch.length;

                const progress = 25 + (itemsCompaniesProcessed / sourceItemsCompanies.length * 1);
                res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 26), message: `Cloned ${itemsCompaniesProcessed}/${sourceItemsCompanies.length} items companies...` })}\n\n`);
            }

            // Step 8: Clone mainUnit from source company
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 26, message: 'Cloning main units...' })}\n\n`);

            const sourceMainUnits = await MainUnit.find({
                company: sourceCompanyId
            }).session(session);

            let mainUnitsProcessed = 0;
            const mainUnitBatchSize = 50;

            // Create mainUnit mapping for item cloning
            const mainUnitMap = new Map();

            for (let i = 0; i < sourceMainUnits.length; i += mainUnitBatchSize) {
                const batch = sourceMainUnits.slice(i, i + mainUnitBatchSize);

                const mainUnitCreationPromises = batch.map(async (mainUnit) => {
                    try {
                        // Check if mainUnit with same name already exists in new company
                        const existingMainUnit = await MainUnit.findOne({
                            name: mainUnit.name,
                            company: newCompanyId
                        }).session(session);

                        let newMainUnitId;

                        if (existingMainUnit) {
                            // Use existing mainUnit
                            newMainUnitId = existingMainUnit._id;
                            console.log(`MainUnit "${mainUnit.name}" already exists in new company, using existing mainUnit`);
                        } else {
                            // Create new mainUnit
                            const newMainUnit = await MainUnit.create([{
                                name: mainUnit.name,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });

                            newMainUnitId = newMainUnit[0]._id;
                            console.log(`Created new mainUnit: ${mainUnit.name} in new company`);
                        }

                        // Store mapping for item unit reference updates
                        mainUnitMap.set(mainUnit._id.toString(), newMainUnitId);
                        return newMainUnitId;
                    } catch (error) {
                        console.error(`Error cloning mainUnit ${mainUnit.name}:`, error);

                        // If it's a duplicate key error, try to find the existing mainUnit
                        if (error.code === 11000) {
                            const existingMainUnit = await MainUnit.findOne({
                                name: mainUnit.name,
                                company: newCompanyId
                            }).session(session);

                            if (existingMainUnit) {
                                mainUnitMap.set(mainUnit._id.toString(), existingMainUnit._id);
                                return existingMainUnit._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(mainUnitCreationPromises);
                mainUnitsProcessed += batch.length;

                const progress = 26 + (mainUnitsProcessed / sourceMainUnits.length * 1);
                res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 27), message: `Cloned ${mainUnitsProcessed}/${sourceMainUnits.length} main units...` })}\n\n`);
            }

            // Step 9: Clone unit from source company
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 27, message: 'Cloning units...' })}\n\n`);

            const sourceUnits = await Unit.find({
                company: sourceCompanyId
            }).session(session);

            let unitsProcessed = 0;
            const unitBatchSize = 50;

            // Create unit mapping for item cloning
            const unitMap = new Map();

            for (let i = 0; i < sourceUnits.length; i += unitBatchSize) {
                const batch = sourceUnits.slice(i, i + unitBatchSize);

                const unitCreationPromises = batch.map(async (unit) => {
                    try {
                        // Check if unit with same name already exists in new company
                        const existingUnit = await Unit.findOne({
                            name: unit.name,
                            company: newCompanyId
                        }).session(session);

                        let newUnitId;

                        if (existingUnit) {
                            // Use existing unit
                            newUnitId = existingUnit._id;
                            console.log(`Unit "${unit.name}" already exists in new company, using existing unit`);
                        } else {
                            // Create new unit
                            const newUnit = await Unit.create([{
                                name: unit.name,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });

                            newUnitId = newUnit[0]._id;
                            console.log(`Created new unit: ${unit.name} in new company`);
                        }

                        // Store mapping for item unit reference updates
                        unitMap.set(unit._id.toString(), newUnitId);
                        return newUnitId;
                    } catch (error) {
                        console.error(`Error cloning unit ${unit.name}:`, error);

                        // If it's a duplicate key error, try to find the existing unit
                        if (error.code === 11000) {
                            const existingUnit = await Unit.findOne({
                                name: unit.name,
                                company: newCompanyId
                            }).session(session);

                            if (existingUnit) {
                                unitMap.set(unit._id.toString(), existingUnit._id);
                                return existingUnit._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(unitCreationPromises);
                unitsProcessed += batch.length;

                const progress = 27 + (unitsProcessed / sourceUnits.length * 1);
                res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 28), message: `Cloned ${unitsProcessed}/${sourceUnits.length} units...` })}\n\n`);
            }

            // Step 10: Clone compositions from source company
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 28, message: 'Cloning compositions...' })}\n\n`);

            const sourceCompositions = await Composition.find({
                company: sourceCompanyId
            }).session(session);

            let compositionsProcessed = 0;
            const compositionBatchSize = 50;

            // Create composition mapping for item cloning
            const compositionMap = new Map();

            for (let i = 0; i < sourceCompositions.length; i += compositionBatchSize) {
                const batch = sourceCompositions.slice(i, i + compositionBatchSize);

                const compositionCreationPromises = batch.map(async (composition) => {
                    try {
                        // Check if composition with same name already exists in new company
                        const existingComposition = await Composition.findOne({
                            name: composition.name,
                            company: newCompanyId
                        }).session(session);

                        let newCompositionId;

                        if (existingComposition) {
                            // Use existing composition
                            newCompositionId = existingComposition._id;
                            console.log(`Composition "${composition.name}" already exists in new company, using existing composition`);
                        } else {
                            // Create new composition - let the pre-save hook generate uniqueNumber
                            const newComposition = await Composition.create([{
                                name: composition.name,
                                company: newCompanyId,
                                // uniqueNumber will be auto-generated by pre-save hook
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });

                            newCompositionId = newComposition[0]._id;
                            console.log(`Created new composition: ${composition.name} with uniqueNumber: ${newComposition[0].uniqueNumber} in new company`);
                        }

                        // Store mapping for item composition reference updates
                        compositionMap.set(composition._id.toString(), newCompositionId);
                        return newCompositionId;
                    } catch (error) {
                        console.error(`Error cloning composition ${composition.name}:`, error);

                        // If it's a duplicate key error, try to find the existing composition
                        if (error.code === 11000) {
                            const existingComposition = await Composition.findOne({
                                name: composition.name,
                                company: newCompanyId
                            }).session(session);

                            if (existingComposition) {
                                compositionMap.set(composition._id.toString(), existingComposition._id);
                                return existingComposition._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(compositionCreationPromises);
                compositionsProcessed += batch.length;

                const progress = 28 + (compositionsProcessed / sourceCompositions.length * 1);
                res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 29), message: `Cloned ${compositionsProcessed}/${sourceCompositions.length} compositions...` })}\n\n`);
            }

            // // Step 10: Process items in batches - WITH PROPER STOCK ENTRIES CLONING
            // res.write(`data: ${JSON.stringify({ type: 'progress', value: 28, message: 'Cloning items with stock data...' })}\n\n`);

            // const sourceItems = await Item.find({
            //     company: sourceCompanyId,
            //     fiscalYear: splitFiscalYear._id
            // }).session(session);

            // let itemsProcessed = 0;
            // const itemBatchSize = 50;

            // for (let i = 0; i < sourceItems.length; i += itemBatchSize) {
            //     const batch = sourceItems.slice(i, i + itemBatchSize);

            //     const itemCreationPromises = batch.map(async (item) => {
            //         try {
            //             // Get the specific opening and closing stock data for the split fiscal year
            //             const openingStockData = item.openingStockByFiscalYear?.find(
            //                 os => os.fiscalYear.equals(splitFiscalYear._id)
            //             );

            //             const closingStockData = item.closingStockByFiscalYear?.find(
            //                 cs => cs.fiscalYear.equals(splitFiscalYear._id)
            //             );

            //             // Use the existing stock values from the source item
            //             const currentStock = item.stock || 0;
            //             const currentOpeningStock = item.openingStock || 0;

            //             // Use purchase price from opening stock data or fallback to item's puPrice
            //             const purchasePrice = openingStockData?.purchasePrice || item.puPrice || 0;
            //             const openingStockBalance = purchasePrice * currentOpeningStock;

            //             console.log(`Cloning item: ${item.name}, Stock: ${currentStock}, Opening Stock: ${currentOpeningStock}, Purchase Price: ${purchasePrice}`);

            //             // Clone ALL stock entries (no fiscalYear filtering since it doesn't exist in schema)
            //             const clonedStockEntries = item.stockEntries.map(entry => {
            //                 const clonedEntry = {
            //                     ...entry.toObject(),
            //                     _id: new mongoose.Types.ObjectId() // Generate new ID for each entry
            //                 };

            //                 // Remove any purchaseBillId reference since it belongs to source company
            //                 if (clonedEntry.purchaseBillId) {
            //                     clonedEntry.purchaseBillId = undefined;
            //                 }

            //                 // Remove any sourceTransfer references
            //                 if (clonedEntry.sourceTransfer) {
            //                     clonedEntry.sourceTransfer = undefined;
            //                 }

            //                 // Recalculate expiry status for the new entry
            //                 if (clonedEntry.expiryDate) {
            //                     const today = new Date();
            //                     const expiryDate = new Date(clonedEntry.expiryDate);
            //                     const timeDiff = expiryDate.getTime() - today.getTime();
            //                     const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

            //                     clonedEntry.daysUntilExpiry = daysUntilExpiry;

            //                     if (daysUntilExpiry <= 0) {
            //                         clonedEntry.expiryStatus = 'expired';
            //                     } else if (daysUntilExpiry <= 30) {
            //                         clonedEntry.expiryStatus = 'danger';
            //                     } else if (daysUntilExpiry <= 90) {
            //                         clonedEntry.expiryStatus = 'warning';
            //                     } else {
            //                         clonedEntry.expiryStatus = 'safe';
            //                     }
            //                 }

            //                 return clonedEntry;
            //             });

            //             console.log(`Cloning ${clonedStockEntries.length} stock entries for item: ${item.name}`);

            //             // Create new item in new company WITH CLONED STOCK DATA
            //             const newItem = await Item.create([{
            //                 name: item.name,
            //                 code: item.code,
            //                 barcode: item.barcode,
            //                 itemsCompany: item.itemsCompany,
            //                 category: item.category,
            //                 unit: item.unit,
            //                 mainUnit: item.mainUnit,
            //                 puPrice: item.puPrice,
            //                 price: item.price,
            //                 WSUnit: item.WSUnit,
            //                 company: newCompanyId,
            //                 fiscalYear: [newFiscalYearId],
            //                 originalFiscalYear: newFiscalYearId,
            //                 stock: currentStock, // Clone existing stock
            //                 openingStock: currentOpeningStock, // Clone existing opening stock
            //                 minStock: item.minStock,
            //                 maxStock: item.maxStock,
            //                 reorderLevel: item.reorderLevel,
            //                 isActive: item.isActive,
            //                 vatStatus: item.vatStatus,
            //                 vatRate: item.vatRate || 0,
            //                 discount: item.discount || 0,
            //                 description: item.description,
            //                 hscode: item.hscode,
            //                 manufacturer: item.manufacturer,
            //                 brand: item.brand,
            //                 // Clone opening stock data for the new fiscal year
            //                 openingStockByFiscalYear: [{
            //                     fiscalYear: newFiscalYearId,
            //                     openingStock: currentOpeningStock,
            //                     openingStockBalance: openingStockBalance.toString(),
            //                     purchasePrice: purchasePrice.toString(),
            //                     salesPrice: item.price || 0,
            //                 }],
            //                 // Clone closing stock data if it exists
            //                 closingStockByFiscalYear: closingStockData ? [{
            //                     fiscalYear: newFiscalYearId,
            //                     closingStock: closingStockData.closingStock,
            //                     openingStockValue: closingStockData.openingStockValue
            //                 }] : [],
            //                 // Clone initial opening stock if it exists
            //                 initialOpeningStock: item.initialOpeningStock ? {
            //                     initialFiscalYear: newFiscalYearId,
            //                     openingStock: item.initialOpeningStock.openingStock,
            //                     openingStockBalance: item.initialOpeningStock.openingStockBalance,
            //                     purchasePrice: item.initialOpeningStock.purchasePrice,
            //                     salesPrice: item.initialOpeningStock.salesPrice,
            //                     date: new Date()
            //                 } : undefined,
            //                 // Clone ALL stock entries with new IDs
            //                 stockEntries: clonedStockEntries,
            //                 status: item.status || 'active',
            //                 createdAt: new Date(),
            //                 updatedAt: new Date()
            //             }], { session });

            //             return newItem[0]._id;
            //         } catch (error) {
            //             console.error(`Error cloning item ${item.name}:`, error);
            //             throw error;
            //         }
            //     });

            //     await Promise.all(itemCreationPromises);
            //     itemsProcessed += batch.length;

            //     const progress = 28 + (itemsProcessed / sourceItems.length * 30);
            //     res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 58), message: `Cloned ${itemsProcessed}/${sourceItems.length} items with ${itemsProcessed > 0 ? sourceItems[0].stockEntries?.length || 0 : 0} stock entries each...` })}\n\n`);
            // }

            // Step 11: Process items in batches - WITH PROPER COMPOSITION ASSOCIATION
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 29, message: 'Cloning items with composition data...' })}\n\n`);

            const sourceItems = await Item.find({
                company: sourceCompanyId,
                fiscalYear: splitFiscalYear._id
            }).populate('composition').session(session); // Populate composition to access the data

            let itemsProcessed = 0;
            const itemBatchSize = 50;

            for (let i = 0; i < sourceItems.length; i += itemBatchSize) {
                const batch = sourceItems.slice(i, i + itemBatchSize);

                const itemCreationPromises = batch.map(async (item) => {
                    try {
                        // Map composition references from old to new composition IDs
                        const newCompositionIds = [];
                        if (item.composition && item.composition.length > 0) {
                            for (const comp of item.composition) {
                                if (comp && comp._id) {
                                    const newCompId = compositionMap.get(comp._id.toString());
                                    if (newCompId) {
                                        newCompositionIds.push(newCompId);
                                        console.log(`Mapping composition for item ${item.name}: ${comp._id} -> ${newCompId} (${comp.name})`);
                                    } else {
                                        console.warn(`No mapping found for composition ${comp._id} in item ${item.name}`);
                                    }
                                }
                            }
                        }

                        // Safe reference mapping function
                        const getSafeReference = (oldId, mapping, fieldName) => {
                            if (!oldId) {
                                console.warn(`Item ${item.name} has undefined ${fieldName}`);
                                return undefined;
                            }

                            const oldIdString = oldId.toString ? oldId.toString() : String(oldId);
                            const newId = mapping.get(oldIdString);

                            if (!newId) {
                                console.warn(`No mapping found for ${fieldName}: ${oldIdString} in item ${item.name}`);
                                return undefined;
                            }

                            return newId;
                        };

                        // Safely get all references
                        const newItemsCompany = getSafeReference(item.itemsCompany, itemsCompanyMap, 'itemsCompany');
                        const newCategory = getSafeReference(item.category, categoryMap, 'category');
                        const newUnit = getSafeReference(item.unit, unitMap, 'unit');
                        const newMainUnit = getSafeReference(item.mainUnit, mainUnitMap, 'mainUnit');

                        // Validate required fields
                        if (!newItemsCompany || !newCategory || !newUnit) {
                            console.error(`Skipping item ${item.name} - missing required references:`, {
                                itemsCompany: !!newItemsCompany,
                                category: !!newCategory,
                                unit: !!newUnit
                            });
                            return null; // Skip this item but don't break the process
                        }

                        // Get the specific opening and closing stock data for the split fiscal year
                        const openingStockData = item.openingStockByFiscalYear?.find(
                            os => os.fiscalYear.equals(splitFiscalYear._id)
                        );

                        const closingStockData = item.closingStockByFiscalYear?.find(
                            cs => cs.fiscalYear.equals(splitFiscalYear._id)
                        );

                        // Use the existing stock values from the source item
                        const currentStock = item.stock || 0;
                        const currentOpeningStock = item.openingStock || 0;

                        // Use purchase price from opening stock data or fallback to item's puPrice
                        const purchasePrice = openingStockData?.purchasePrice || item.puPrice || 0;
                        const salesPrice = openingStockData?.salesPrice || item.price || 0;
                        const openingStockValue = purchasePrice * currentOpeningStock;

                        console.log(`Cloning item: ${item.name}, Composition: ${newCompositionIds.length > 0 ? 'Yes' : 'No'}, Stock: ${currentStock}`);

                        // Clone ALL stock entries (no fiscalYear filtering since it doesn't exist in schema)
                        const clonedStockEntries = item.stockEntries.map(entry => {
                            const clonedEntry = {
                                ...entry.toObject(),
                                _id: new mongoose.Types.ObjectId() // Generate new ID for each entry
                            };

                            // Remove any purchaseBillId reference since it belongs to source company
                            if (clonedEntry.purchaseBillId) {
                                clonedEntry.purchaseBillId = undefined;
                            }

                            // Remove any sourceTransfer references
                            if (clonedEntry.sourceTransfer) {
                                clonedEntry.sourceTransfer = undefined;
                            }

                            // Recalculate expiry status for the new entry
                            if (clonedEntry.expiryDate) {
                                const today = new Date();
                                const expiryDate = new Date(clonedEntry.expiryDate);
                                const timeDiff = expiryDate.getTime() - today.getTime();
                                const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

                                clonedEntry.daysUntilExpiry = daysUntilExpiry;

                                if (daysUntilExpiry <= 0) {
                                    clonedEntry.expiryStatus = 'expired';
                                } else if (daysUntilExpiry <= 30) {
                                    clonedEntry.expiryStatus = 'danger';
                                } else if (daysUntilExpiry <= 90) {
                                    clonedEntry.expiryStatus = 'warning';
                                } else {
                                    clonedEntry.expiryStatus = 'safe';
                                }
                            }

                            return clonedEntry;
                        });

                        console.log(`Cloning ${clonedStockEntries.length} stock entries for item: ${item.name}`);

                        // Create new item in new company WITH CLONED COMPOSITION DATA
                        const newItemData = {
                            name: item.name,
                            code: item.code,
                            barcode: item.barcode,
                            itemsCompany: newItemsCompany,
                            category: newCategory,
                            unit: newUnit,
                            mainUnit: newMainUnit,
                            composition: newCompositionIds, // Use the mapped composition IDs
                            puPrice: item.puPrice,
                            price: item.price,
                            WSUnit: item.WSUnit,
                            company: newCompanyId,
                            fiscalYear: [newFiscalYearId],
                            originalFiscalYear: newFiscalYearId,
                            stock: currentStock, // Clone existing stock
                            openingStock: currentOpeningStock, // Clone existing opening stock
                            minStock: item.minStock,
                            maxStock: item.maxStock,
                            reorderLevel: item.reorderLevel,
                            isActive: item.isActive,
                            vatStatus: item.vatStatus,
                            vatRate: item.vatRate || 0,
                            discount: item.discount || 0,
                            description: item.description,
                            hscode: item.hscode,
                            manufacturer: item.manufacturer,
                            brand: item.brand,
                            // Clone opening stock data for the new fiscal year
                            openingStockByFiscalYear: [{
                                fiscalYear: newFiscalYearId,
                                openingStock: currentOpeningStock,
                                openingStockValue: openingStockValue,
                                purchasePrice: purchasePrice,
                                salesPrice: salesPrice,
                            }],
                            // Clone closing stock data if it exists
                            closingStockByFiscalYear: closingStockData ? [{
                                fiscalYear: newFiscalYearId,
                                closingStock: closingStockData.closingStock,
                                openingStockValue: closingStockData.closingStockValue,
                                purchasePrice: purchasePrice,
                                salesPrice: salesPrice,
                            }] : [],
                            // Clone initial opening stock if it exists
                            initialOpeningStock: item.initialOpeningStock ? {
                                initialFiscalYear: newFiscalYearId,
                                openingStock: item.initialOpeningStock.openingStock || currentOpeningStock,
                                openingStockValue: item.initialOpeningStock.openingStockValue || openingStockValue,
                                purchasePrice: item.initialOpeningStock.purchasePrice || purchasePrice,
                                salesPrice: item.initialOpeningStock.salesPrice || salesPrice,
                                date: new Date()
                            } : undefined,
                            // Clone ALL stock entries with new IDs
                            stockEntries: clonedStockEntries,
                            status: item.status || 'active',
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };

                        const newItem = await Item.create([newItemData], { session });

                        console.log(`Created item "${item.name}" with ${newCompositionIds.length} composition associations`);
                        return newItem[0]._id;
                    } catch (error) {
                        console.error(`Error cloning item ${item.name}:`, error);
                        // Return null instead of throwing to continue processing other items
                        return null;
                    }
                });

                const batchResults = await Promise.all(itemCreationPromises);
                const validResults = batchResults.filter(id => id !== null);
                itemsProcessed += validResults.length;

                const progress = 29 + (itemsProcessed / sourceItems.length * 29);
                res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 58), message: `Cloned ${itemsProcessed}/${sourceItems.length} items with compositions...` })}\n\n`);
            }

            // // Step 11: Process accounts in batches - CLONE DIRECTLY FROM SOURCE ACCOUNTS
            // res.write(`data: ${JSON.stringify({ type: 'progress', value: 58, message: 'Cloning accounts with balance data...' })}\n\n`);

            // const sourceAccounts = await Account.find({
            //     company: sourceCompanyId,
            //     fiscalYear: splitFiscalYear._id
            // }).session(session);

            // let accountsProcessed = 0;
            // const accountBatchSize = 50;

            // for (let i = 0; i < sourceAccounts.length; i += accountBatchSize) {
            //     const batch = sourceAccounts.slice(i, i + accountBatchSize);

            //     const accountCreationPromises = batch.map(async (account) => {
            //         try {
            //             // Get the specific opening and closing balance data for the split fiscal year
            //             const openingBalanceData = account.openingBalanceByFiscalYear?.find(
            //                 ob => ob.fiscalYear.equals(splitFiscalYear._id)
            //             );

            //             const closingBalanceData = account.closingBalanceByFiscalYear?.find(
            //                 cb => cb.fiscalYear.equals(splitFiscalYear._id)
            //             );

            //             // Use existing balance values from the source account
            //             const currentOpeningBalance = account.openingBalance || { amount: 0, type: 'Dr' };

            //             console.log(`Cloning account: ${account.name}, Balance: ${currentOpeningBalance.amount} ${currentOpeningBalance.type}`);

            //             // Create new account in new company WITH CLONED BALANCE DATA
            //             const newAccount = await Account.create([{
            //                 name: account.name,
            //                 address: account.address,
            //                 ward: account.ward,
            //                 phone: account.phone,
            //                 pan: account.pan,
            //                 contactperson: account.contactperson,
            //                 email: account.email,
            //                 type: account.type,
            //                 companyGroups: account.companyGroups,
            //                 company: newCompanyId,
            //                 fiscalYear: [newFiscalYearId],
            //                 originalFiscalYear: newFiscalYearId,
            //                 creditLimit: account.creditLimit,
            //                 // Clone opening balance
            //                 openingBalance: {
            //                     fiscalYear: newFiscalYearId,
            //                     amount: currentOpeningBalance.amount,
            //                     type: currentOpeningBalance.type,
            //                     date: new Date()
            //                 },
            //                 // Clone opening balance by fiscal year
            //                 openingBalanceByFiscalYear: [{
            //                     fiscalYear: newFiscalYearId,
            //                     amount: currentOpeningBalance.amount,
            //                     type: currentOpeningBalance.type,
            //                     date: new Date()
            //                 }],
            //                 // Clone closing balance data if it exists
            //                 closingBalanceByFiscalYear: [{
            //                     fiscalYear: newFiscalYearId,
            //                     amount: currentOpeningBalance.amount,
            //                     type: currentOpeningBalance.type,
            //                     date: new Date()
            //                 }],
            //                 // Clone initial opening balance if it exists
            //                 initialOpeningBalance: account.initialOpeningBalance ? {
            //                     initialFiscalYear: newFiscalYearId,
            //                     amount: currentOpeningBalance.amount,
            //                     type: currentOpeningBalance.type,
            //                     date: new Date()
            //                 } : undefined,
            //                 openingBalanceDate: new Date(),
            //                 isActive: account.isActive,
            //                 defaultCashAccount: account.defaultCashAccount,
            //                 createdAt: new Date(),
            //                 updatedAt: new Date()
            //             }], { session });

            //             return newAccount[0]._id;
            //         } catch (error) {
            //             console.error(`Error cloning account ${account.name}:`, error);
            //             throw error;
            //         }
            //     });

            //     await Promise.all(accountCreationPromises);
            //     accountsProcessed += batch.length;

            //     const progress = 58 + (accountsProcessed / sourceAccounts.length * 25);
            //     res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 83), message: `Cloned ${accountsProcessed}/${sourceAccounts.length} accounts with balance data...` })}\n\n`);
            // }

            // Step 11: Process accounts in batches - CLONE DIRECTLY FROM SOURCE ACCOUNTS
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 58, message: 'Cloning accounts with balance data...' })}\n\n`);

            // Convert the start date to YYYY-MM-DD format
            // const startDateObj = new Date(splitFiscalYear.startDate);

            const sourceAccounts = await Account.find({
                company: sourceCompanyId,
                fiscalYear: splitFiscalYear._id
            }).session(session);

            let accountsProcessed = 0;
            const accountBatchSize = 50;

            for (let i = 0; i < sourceAccounts.length; i += accountBatchSize) {
                const batch = sourceAccounts.slice(i, i + accountBatchSize);

                const accountCreationPromises = batch.map(async (account) => {
                    try {
                        // Get the specific opening and closing balance data for the split fiscal year
                        const openingBalanceData = account.openingBalanceByFiscalYear?.find(
                            ob => ob.fiscalYear.equals(splitFiscalYear._id)
                        );

                        const closingBalanceData = account.closingBalanceByFiscalYear?.find(
                            cb => cb.fiscalYear.equals(splitFiscalYear._id)
                        );

                        // Use existing balance values from the source account
                        const currentOpeningBalance = account.openingBalance || { amount: 0, type: 'Dr' };

                        // 🔥 FIX: Get the new company group ID from the mapping
                        const newCompanyGroupId = companyGroupMap.get(account.companyGroups?.toString());

                        console.log(`Cloning account: ${account.name}, CompanyGroup: ${account.companyGroups} -> ${newCompanyGroupId}, Balance: ${currentOpeningBalance.amount} ${currentOpeningBalance.type}`);

                        // Create new account in new company WITH CLONED BALANCE DATA
                        const newAccount = await Account.create([{
                            name: account.name,
                            address: account.address,
                            ward: account.ward,
                            phone: account.phone,
                            pan: account.pan,
                            contactperson: account.contactperson,
                            email: account.email,
                            type: account.type,
                            // 🔥 FIX: Use the new company group ID instead of the old one
                            companyGroups: newCompanyGroupId || account.companyGroups,
                            company: newCompanyId,
                            fiscalYear: [newFiscalYearId],
                            originalFiscalYear: newFiscalYearId,
                            creditLimit: account.creditLimit,
                            // Clone opening balance
                            openingBalance: {
                                fiscalYear: newFiscalYearId,
                                amount: currentOpeningBalance.amount,
                                type: currentOpeningBalance.type,
                                date: startDateObj
                            },
                            // Clone opening balance by fiscal year
                            openingBalanceByFiscalYear: [{
                                fiscalYear: newFiscalYearId,
                                amount: currentOpeningBalance.amount,
                                type: currentOpeningBalance.type,
                                date: startDateObj
                            }],
                            // Clone closing balance data if it exists
                            closingBalanceByFiscalYear: [{
                                fiscalYear: newFiscalYearId,
                                amount: currentOpeningBalance.amount,
                                type: currentOpeningBalance.type,
                                date: startDateObj
                            }],
                            // Clone initial opening balance if it exists
                            initialOpeningBalance: account.initialOpeningBalance ? {
                                initialFiscalYear: newFiscalYearId,
                                amount: currentOpeningBalance.amount,
                                type: currentOpeningBalance.type,
                                date: startDateObj
                            } : undefined,
                            openingBalanceDate: startDateObj,
                            isActive: account.isActive,
                            defaultCashAccount: account.defaultCashAccount,
                            createdAt: startDateObj,
                            updatedAt: startDateObj
                        }], { session });

                        return newAccount[0]._id;
                    } catch (error) {
                        console.error(`Error cloning account ${account.name}:`, error);
                        throw error;
                    }
                });

                await Promise.all(accountCreationPromises);
                accountsProcessed += batch.length;

                const progress = 58 + (accountsProcessed / sourceAccounts.length * 25);
                res.write(`data: ${JSON.stringify({ type: 'progress', value: Math.min(progress, 83), message: `Cloned ${accountsProcessed}/${sourceAccounts.length} accounts with balance data...` })}\n\n`);
            }

            // Step 12: Copy transactions
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 83, message: 'Copying transactions...' })}\n\n`);

            const sourceTransactions = await Transaction.find({
                company: sourceCompanyId,
                fiscalYear: splitFiscalYear._id
            }).populate('item account contraAccount').session(session);

            // Step 13: Initialize bill counters
            res.write(`data: ${JSON.stringify({ type: 'progress', value: 90, message: 'Initializing counters...' })}\n\n`);

            const transactionTypes = [
                'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
                'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment'
            ];

            await Promise.all(transactionTypes.map(async (transactionType) => {
                await BillCounter.create([{
                    company: newCompanyId,
                    fiscalYear: newFiscalYearId,
                    transactionType,
                    currentBillNumber: 0
                }], { session });
            }));

            // Step 14: Clean up source company if requested
            if (shouldDeleteAfterSplit) {
                res.write(`data: ${JSON.stringify({ type: 'progress', value: 95, message: 'Cleaning up source company...' })}\n\n`);

                // Track deletion statistics
                const deletionStats = {
                    itemsDeleted: 0,
                    accountsDeleted: 0,
                    transactionsDeleted: 0
                };

                // 14.1: Prevent deletion of current fiscal year
                if (splitFiscalYear._id.equals(req.session.currentFiscalYear?.id)) {
                    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Cannot delete the current active fiscal year. Switch to another fiscal year first.' })}\n\n`);
                    res.end();
                    return;
                }

                // 14.2: Check if it's the only fiscal year in source company
                const fiscalYearCount = await FiscalYear.countDocuments({
                    company: sourceCompanyId
                }).session(session);

                if (fiscalYearCount === 1) {
                    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Cannot delete the only fiscal year in source company.' })}\n\n`);
                    res.end();
                    return;
                }

                res.write(`data: ${JSON.stringify({ type: 'progress', value: 96, message: 'Deleting transactions...' })}\n\n`);

                // 14.3: Delete transactions for this fiscal year
                const transactionResult = await Transaction.deleteMany({
                    company: sourceCompanyId,
                    fiscalYear: splitFiscalYear._id
                }).session(session);
                deletionStats.transactionsDeleted += transactionResult.deletedCount;

                res.write(`data: ${JSON.stringify({ type: 'progress', value: 97, message: 'Cleaning up items...' })}\n\n`);

                // 14.4: Delete items originally created in this fiscal year
                const itemsToDelete = await Item.find({
                    company: sourceCompanyId,
                    originalFiscalYear: splitFiscalYear._id
                }).session(session);

                if (itemsToDelete.length > 0) {
                    const itemIds = itemsToDelete.map(item => item._id);

                    // Delete related transactions for these items
                    const itemTransactionResult = await Transaction.deleteMany({
                        company: sourceCompanyId,
                        item: { $in: itemIds }
                    }).session(session);
                    deletionStats.transactionsDeleted += itemTransactionResult.deletedCount;

                    // Delete the items themselves
                    const itemResult = await Item.deleteMany({
                        _id: { $in: itemIds }
                    }).session(session);
                    deletionStats.itemsDeleted = itemResult.deletedCount;
                }

                // 14.5: Remove fiscal year references from remaining items
                await Item.updateMany(
                    {
                        company: sourceCompanyId,
                        fiscalYear: splitFiscalYear._id
                    },
                    {
                        $pull: {
                            fiscalYear: splitFiscalYear._id,
                            openingStockByFiscalYear: { fiscalYear: splitFiscalYear._id },
                            closingStockByFiscalYear: { fiscalYear: splitFiscalYear._id },
                            stockEntries: { fiscalYear: splitFiscalYear._id }
                        }
                    },
                    { session }
                );

                res.write(`data: ${JSON.stringify({ type: 'progress', value: 98, message: 'Cleaning up accounts...' })}\n\n`);

                // 14.6: Delete accounts created in this fiscal year
                const accountsToDelete = await Account.find({
                    company: sourceCompanyId,
                    $or: [
                        { originalFiscalYear: splitFiscalYear._id },
                        { fiscalYear: { $eq: [splitFiscalYear._id] } } // Accounts only belonging to this FY
                    ]
                }).session(session);

                if (accountsToDelete.length > 0) {
                    const accountIds = accountsToDelete.map(acc => acc._id);

                    // Delete related transactions for these accounts
                    const accountTransactionResult = await Transaction.deleteMany({
                        company: sourceCompanyId,
                        $or: [
                            { account: { $in: accountIds } },
                            { contraAccount: { $in: accountIds } }
                        ]
                    }).session(session);
                    deletionStats.transactionsDeleted += accountTransactionResult.deletedCount;

                    // Delete the accounts themselves
                    const accountResult = await Account.deleteMany({
                        _id: { $in: accountIds }
                    }).session(session);
                    deletionStats.accountsDeleted = accountResult.deletedCount;
                }

                // 14.7: Remove references from remaining accounts
                const latestFiscalYear = await FiscalYear.findOne({
                    company: sourceCompanyId,
                    _id: { $ne: splitFiscalYear._id }
                }).sort({ endDate: -1 }).session(session);

                await Account.updateMany(
                    { company: sourceCompanyId },
                    {
                        $pull: {
                            fiscalYear: splitFiscalYear._id,
                            openingBalanceByFiscalYear: { fiscalYear: splitFiscalYear._id },
                            closingBalanceByFiscalYear: { fiscalYear: splitFiscalYear._id }
                        },
                        $set: {
                            'openingBalance.amount': 0,
                            'openingBalance.type': 'Dr'
                        }
                    },
                    { session }
                );

                res.write(`data: ${JSON.stringify({ type: 'progress', value: 99, message: 'Removing supporting records...' })}\n\n`);

                // 14.8: Delete supporting records
                await BillCounter.deleteMany({
                    company: sourceCompanyId,
                    fiscalYear: splitFiscalYear._id
                }).session(session);

                await Settings.deleteMany({
                    company: sourceCompanyId,
                    fiscalYear: splitFiscalYear._id
                }).session(session);

                // 14.9: Finally delete the fiscal year itself
                await FiscalYear.findByIdAndDelete(splitFiscalYear._id).session(session);

                // 14.10: Update session if needed
                if (req.session.currentFiscalYear && req.session.currentFiscalYear.id === splitFiscalYear._id.toString()) {
                    if (latestFiscalYear) {
                        req.session.currentFiscalYear = {
                            id: latestFiscalYear._id.toString(),
                            startDate: latestFiscalYear.startDate,
                            endDate: latestFiscalYear.endDate,
                            name: latestFiscalYear.name,
                            dateFormat: latestFiscalYear.dateFormat,
                            isActive: latestFiscalYear.isActive
                        };
                    }
                }

                console.log('Cleanup completed:', deletionStats);
                res.write(`data: ${JSON.stringify({ type: 'progress', value: 99, message: `Cleanup completed: ${deletionStats.itemsDeleted} items, ${deletionStats.accountsDeleted} accounts, ${deletionStats.transactionsDeleted} transactions removed` })}\n\n`);
            }

            // Final response
            const result = {
                success: true,
                message: `Company split successfully. New company "${newCompanyName}" created with cloned balances and stocks.`,
                data: {
                    newCompany: {
                        _id: newCompanyId,
                        name: newCompanyName
                    },
                    newFiscalYear: {
                        _id: newFiscalYearId,
                        name: splitFiscalYear.name
                    },
                    statistics: {
                        usersCopied: usersProcessed,
                        companyGroupsCopied: companyGroupsProcessed,
                        categoriesCopied: categoriesProcessed,
                        itemsCompaniesCopied: itemsCompaniesProcessed,
                        mainUnitsCopied: mainUnitsProcessed,
                        compositionsCopied: compositionsProcessed,
                        unitsCopied: unitsProcessed,
                        itemsCopied: itemsProcessed,
                        accountsCopied: accountsProcessed,
                        transactionsCount: sourceTransactions.length
                    }
                }
            };

            res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);
            res.end();
        });
    } catch (error) {
        console.error('Error splitting company:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    } finally {
        await session.endSession();
    }

    // Handle client disconnect
    req.on('close', () => {
        console.log('Client disconnected from SSE');
        session.endSession().catch(err => console.error('Error ending session:', err));
    });
});


// router.delete('/delete-fiscal-year/:id', ensureAuthenticated, ensureCompanySelected, async (req, res) => {
//     const fiscalYearId = req.params.id;
//     const companyId = req.session.currentCompany;

//     try {
//         // 1. Get the fiscal year to be deleted
//         const fiscalYearToDelete = await FiscalYear.findOne({
//             _id: fiscalYearId,
//             company: companyId
//         });

//         if (!fiscalYearToDelete) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Fiscal year not found.'
//             });
//         }

//         // 2. Prevent deletion of current fiscal year
//         if (fiscalYearToDelete._id.equals(req.session.currentFiscalYear.id)) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Cannot delete the current active fiscal year. Switch to another fiscal year first.'
//             });
//         }

//         // 3. Check if it's the only fiscal year
//         const fiscalYearCount = await FiscalYear.countDocuments({ company: companyId });
//         if (fiscalYearCount === 1) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Cannot delete the only fiscal year.'
//             });
//         }

//         // 4. Check if any transactions exist for this fiscal year
//         const transactionExists = await Transaction.exists({
//             company: companyId,
//             fiscalYear: fiscalYearId
//         });

//         if (transactionExists) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Cannot delete this fiscal year because it has transactions.'
//             });
//         }

//         // Track deletion statistics
//         const deletionStats = {
//             itemsDeleted: 0,
//             accountsDeleted: 0,
//             transactionsDeleted: 0
//         };

//         // 5. Delete items originally created in this fiscal year
//         const itemsToDelete = await Item.find({
//             company: companyId,
//             originalFiscalYear: fiscalYearId
//         });

//         // Delete items and their related data
//         if (itemsToDelete.length > 0) {
//             const itemIds = itemsToDelete.map(item => item._id);

//             // Delete related transactions
//             const transactionResult = await Transaction.deleteMany({
//                 company: companyId,
//                 item: { $in: itemIds }
//             });
//             deletionStats.transactionsDeleted += transactionResult.deletedCount;

//             // Delete the items themselves
//             const itemResult = await Item.deleteMany({
//                 _id: { $in: itemIds }
//             });
//             deletionStats.itemsDeleted = itemResult.deletedCount;
//         }

//         // 6. Remove fiscal year references from remaining items
//         await Item.updateMany(
//             { company: companyId, fiscalYear: fiscalYearId },
//             {
//                 $pull: {
//                     fiscalYear: fiscalYearId,
//                     openingStockByFiscalYear: { fiscalYear: fiscalYearId },
//                     closingStockByFiscalYear: { fiscalYear: fiscalYearId },
//                     stockEntries: { fiscalYear: fiscalYearId }
//                 }
//             }
//         );

//         // 7. Delete accounts created in this fiscal year
//         const accountsToDelete = await Account.find({
//             company: companyId,
//             $or: [
//                 { originalFiscalYear: fiscalYearId },
//                 { fiscalYear: { $eq: [fiscalYearId] } } // Accounts only belonging to this FY
//             ]
//         });

//         if (accountsToDelete.length > 0) {
//             const accountIds = accountsToDelete.map(acc => acc._id);

//             // Delete related transactions
//             const accountTransactionResult = await Transaction.deleteMany({
//                 company: companyId,
//                 $or: [
//                     { account: { $in: accountIds } },
//                     { contraAccount: { $in: accountIds } }
//                 ]
//             });
//             deletionStats.transactionsDeleted += accountTransactionResult.deletedCount;

//             // Delete the accounts themselves
//             const accountResult = await Account.deleteMany({
//                 _id: { $in: accountIds }
//             });
//             deletionStats.accountsDeleted = accountResult.deletedCount;
//         }

//         // 8. Remove references from accounts
//         const latestFiscalYear = await FiscalYear.findOne({
//             company: companyId,
//             _id: { $ne: fiscalYearId }
//         }).sort({ endDate: -1 });

//         await Account.updateMany(
//             { company: companyId },
//             {
//                 $pull: {
//                     fiscalYear: fiscalYearId,
//                     openingBalanceByFiscalYear: { fiscalYear: fiscalYearId },
//                     closingBalanceByFiscalYear: {
//                         fiscalYear: latestFiscalYear ? latestFiscalYear._id : null
//                     }
//                 },
//                 $unset: {
//                     'openingBalance.fiscalYear': 1
//                 },
//                 $set: {
//                     'openingBalance.amount': 0,
//                     'openingBalance.type': 'Dr'
//                 }
//             }
//         );

//         // 9. Delete supporting records
//         const fiscalYearTransactions = await Transaction.deleteMany({
//             company: companyId,
//             fiscalYear: fiscalYearId
//         });
//         deletionStats.transactionsDeleted += fiscalYearTransactions.deletedCount;

//         // 10. Delete bill counters for this fiscal year
//         await BillCounter.deleteMany({
//             company: companyId,
//             fiscalYear: fiscalYearId
//         });

//         // 11. Delete settings for this fiscal year
//         await Settings.deleteMany({
//             company: companyId,
//             fiscalYear: fiscalYearId
//         });

//         // 12. Delete the fiscal year
//         await FiscalYear.findByIdAndDelete(fiscalYearId);

//         // 13. Update company with new latest fiscal year
//         if (latestFiscalYear) {
//             await Company.findByIdAndUpdate(companyId, {
//                 fiscalYear: latestFiscalYear._id
//             });

//             // Update session with new fiscal year if needed
//             if (req.session.currentFiscalYear && req.session.currentFiscalYear.id === fiscalYearId) {
//                 req.session.currentFiscalYear = {
//                     id: latestFiscalYear._id.toString(),
//                     startDate: latestFiscalYear.startDate,
//                     endDate: latestFiscalYear.endDate,
//                     name: latestFiscalYear.name,
//                     dateFormat: latestFiscalYear.dateFormat,
//                     isActive: latestFiscalYear.isActive
//                 };
//             }
//         }

//         res.status(200).json({
//             success: true,
//             message: `Fiscal year "${fiscalYearToDelete.name}" deleted successfully`,
//             data: {
//                 deletedFiscalYear: {
//                     id: fiscalYearToDelete._id,
//                     name: fiscalYearToDelete.name,
//                     startDate: fiscalYearToDelete.startDate,
//                     endDate: fiscalYearToDelete.endDate
//                 },
//                 deletionStats: deletionStats,
//                 newActiveFiscalYear: latestFiscalYear ? {
//                     id: latestFiscalYear._id,
//                     name: latestFiscalYear.name,
//                     startDate: latestFiscalYear.startDate,
//                     endDate: latestFiscalYear.endDate
//                 } : null
//             }
//         });

//     } catch (err) {
//         console.error('Error deleting fiscal year:', err);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to delete fiscal year',
//             message: err.message
//         });
//     }
// });


module.exports = router;