const express = require('express');
const router = express.Router();

const { v4: uuidv4 } = require('uuid');

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Item = require('../../models/retailer/Item');
const SalesReturn = require('../../models/retailer/SalesReturn');
const Transaction = require('../../models/retailer/Transaction');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
// const BillCounter = require('../../models/retailer/salesReturnBillCounter');
const Account = require('../../models/retailer/Account');
const Settings = require('../../models/retailer/Settings');
const Company = require('../../models/Company');
const NepaliDate = require('nepali-date');
const { ensureTradeType } = require('../../middleware/tradeType');
const SalesBill = require('../../models/retailer/SalesBill');
const Category = require('../../models/retailer/Category');
const Unit = require('../../models/retailer/Unit');
const FiscalYear = require('../../models/FiscalYear');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');
const CompanyGroup = require('../../models/retailer/CompanyGroup');

// Sales return Bill routes
router.get('/sales-return', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;

            // Fetch all required data in parallel for better performance
            const [
                items,
                bills,
                salesInvoices,
                company,
                lastCounter
            ] = await Promise.all([
                Item.find({ company: companyId, status: 'active' }).populate('category').populate('unit').populate('mainUnit').populate('stockEntries').lean(),
                SalesReturn.find({ company: companyId }).populate('account').populate('items.item'),
                SalesBill.find({ company: companyId }),
                Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear'),
                BillCounter.findOne({
                    company: companyId,
                    fiscalYear: req.session.currentFiscalYear?.id,
                    transactionType: 'salesReturn'
                })
            ]);

            // Date handling
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const transactionDateNepali = new NepaliDate(today).format('YYYY-MM-DD');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Fiscal year handling
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

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

                fiscalYear = req.session.currentFiscalYear.id;
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            const itemsWithStock = items.map(item => {
                const totalStock = item.stockEntries.reduce((sum, entry) => {
                    return sum + (entry.quantity || 0);
                }, 0);

                // Sort stock entries by date in descending order (newest first)
                const sortedStockEntries = [...item.stockEntries].sort((a, b) => {
                    return new Date(b.date) - new Date(a.date);
                });

                // Get the latest stock entry (first item after sorting)
                const latestStockEntry = sortedStockEntries[item.stockEntries.length - 1]
                // Get the latest price (rounded to 2 decimal places)
                const price = latestStockEntry?.price
                    ? Math.round(latestStockEntry.price * 100) / 100
                    : item.price
                        ? Math.round(item.price * 100) / 100
                        : 0;

                return {
                    ...item,
                    stock: totalStock,
                    latestPrice: price,
                    latestStockEntry: latestStockEntry,

                };
            });

            // Calculate next bill number
            const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
            const fiscalYears = await FiscalYear.findById(fiscalYear);
            const prefix = fiscalYears.billPrefixes.salesReturn;
            const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

            // Fetch only the required company groups: Cash in Hand, Sundry Debtors, Sundry Creditors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
            }).exec();

            // Convert relevant group IDs to an array of ObjectIds
            const relevantGroupIds = relevantGroups.map(group => group._id);

            const accounts = await Account.find({
                company: companyId,
                // fiscalYear: fiscalYear,
                isActive: true,
                $or: [
                    { originalFiscalYear: fiscalYear }, // Created here
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
                    }
                ],
                companyGroups: { $in: relevantGroupIds }
            });

            // Prepare response data
            const responseData = {
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        vatEnabled: company.vatEnabled,
                        fiscalYear: company.fiscalYear
                    },
                    items: itemsWithStock,
                    accounts: accounts,
                    salesReturns: bills.map(bill => ({
                        _id: bill._id,
                        billNumber: bill.billNumber,
                        account: bill.account,
                        items: bill.items,
                        totalAmount: bill.totalAmount,
                        discount: bill.discount,
                        taxableAmount: bill.taxableAmount,
                        vatAmount: bill.vatAmount,
                        grandTotal: bill.grandTotal,
                        transactionDate: bill.transactionDate
                    })),
                    salesInvoices: salesInvoices,
                    nextSalesReturnNumber: nextBillNumber,
                    dates: {
                        nepaliDate,
                        transactionDateNepali
                    },
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        name: currentFiscalYear.name,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        isActive: currentFiscalYear.isActive
                    },
                    userPreferences: {
                        theme: req.user.preferences?.theme || 'light'
                    },
                    permissions: {
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                    }
                }
            };

            return res.json(responseData);
        }
    } catch (error) {
        console.error('Error in /sales-return route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Fetch all sales return bills
router.get('/sales-return/register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const currentCompany = await Company.findById(new ObjectId(companyId));
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled isVatExempt').populate('fiscalYear');
            const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';
            const vatEnabled = currentCompany.vatEnabled || false;
            const isVatExempt = currentCompany.isVatExempt || false;

            // Extract dates from query parameters
            let fromDate = req.query.fromDate ? req.query.fromDate : null;
            let toDate = req.query.toDate ? req.query.toDate : null;

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, use company's fiscal year
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

                fiscalYear = currentFiscalYear._id.toString();
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // If no date range provided, return empty response with company info
            if (!fromDate || !toDate) {
                return res.json({
                    success: true,
                    data: {
                        company: company,
                        currentFiscalYear: currentFiscalYear,
                        bills: [],
                        currentCompany: currentCompany,
                        currentCompanyName: currentCompanyName,
                        companyDateFormat: companyDateFormat,
                        fromDate: fromDate || '',
                        toDate: toDate || '',
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                    }
                });
            }

            // Build the query
            let query = { company: companyId };

            if (fromDate && toDate) {
                query.date = { $gte: fromDate, $lte: toDate };
            } else if (fromDate) {
                query.date = { $gte: fromDate };
            } else if (toDate) {
                query.date = { $lte: toDate };
            }

            const bills = await SalesReturn.find(query)
                .sort({ date: 1, billNumber: 1 })
                .populate('account')
                .populate('items.item')
                .populate('user');

            // Format response for React
            return res.json({
                success: true,
                data: {
                    company: company,
                    currentFiscalYear: currentFiscalYear,
                    bills: bills,
                    currentCompany: currentCompany,
                    currentCompanyName: currentCompanyName,
                    companyDateFormat: companyDateFormat,
                    fromDate: fromDate,
                    toDate: toDate,
                    vatEnabled,
                    isVatExempt,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized trade type'
            });
        }
    } catch (error) {
        console.error('Error fetching sales return bills:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

router.post('/sales-return', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { accountId, items, vatPercentage, transactionDateNepali, transactionDateRoman, billDate, nepaliDate, isVatExempt, discountPercentage, paymentMode, roundOffAmount: manualRoundOffAmount } = req.body;
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            const userId = req.user._id;

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let subTotal = 0;
            let vatAmount = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            // Validation checks
            if (!companyId) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Company ID is required." });
            }

            const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
            if (!accounts) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Invalid account for this company" });
            }

            // Validate each item before processing
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
                }

                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity, 10);
                subTotal += itemTotal;

                if (product.vatStatus === 'vatable') {
                    hasVatableItems = true;
                    totalTaxableAmount += itemTotal;
                } else {
                    hasNonVatableItems = true;
                    totalNonTaxableAmount += itemTotal;
                }
            }

            // Check validation conditions after processing all items
            if (isVatExempt !== 'all') {
                if (isVatExemptBool && hasVatableItems) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: 'Cannot save VAT exempt bill with vatable items' });
                }

                if (!isVatExemptBool && hasNonVatableItems) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: 'Cannot save bill with non-vatable items when VAT is applied' });
                }
            }

            // Apply discount and calculate amounts
            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;
            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            // Calculate VAT
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (finalTaxableAmount * vatPercentage) / 100;
            } else {
                vatAmount = 0;
            }

            let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
            let finalAmount = totalAmount;

            // Handle round off settings
            let roundOffForSalesReturn = await Settings.findOne({ company: companyId, userId, fiscalYear: currentFiscalYear }).session(session);
            if (!roundOffForSalesReturn) {
                roundOffForSalesReturn = { roundOffSalesReturn: false };
            }

            let roundOffAmount = 0;
            if (roundOffForSalesReturn.roundOffSalesReturn) {
                finalAmount = Math.round(finalAmount.toFixed(2));
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForSalesReturn.roundOffSalesReturn) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            // Generate bill number only after all validations pass
            const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'salesReturn', session);

            // Create new sales return
            const newBill = new SalesReturn({
                billNumber: billNumber,
                account: accountId,
                purchaseSalesReturnType: 'Sales Return',
                items: [],
                isVatExempt: isVatExemptBool,
                isVatAll,
                vatPercentage: isVatExemptBool ? 0 : vatPercentage,
                subTotal,
                discountPercentage: discount,
                discountAmount: discountForTaxable + discountForNonTaxable,
                nonVatSalesReturn: finalNonTaxableAmount,
                taxableAmount: finalTaxableAmount,
                vatAmount,
                totalAmount: finalAmount,
                roundOffAmount: roundOffAmount,
                paymentMode,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear,
            });

            // Get previous balance
            let previousBalance = 0;
            const accountTransaction = await Transaction.findOne({ account: accountId })
                .sort({ transactionDate: -1 })
                .session(session);
            if (accountTransaction) {
                previousBalance = accountTransaction.balance;
            }

            // Generate a unique ID for the stock entry
            const uniqueId = uuidv4();

            // FIFO stock addition function
            async function addStock(product, quantity, price, batchNumber, expiryDate, uniqueId) {
                const quantityNumber = Number(quantity);

                // Calculate discount values
                const itemTotal = price * quantityNumber;
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = price - (price * discount / 100);

                product.stockEntries.push({
                    quantity: quantityNumber,
                    price: price,
                    puPrice: price,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    batchNumber: batchNumber,
                    expiryDate: expiryDate,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    mrp: price,
                    uniqueUuId: uniqueId,
                    salesReturnBillId: newBill._id,
                    fiscalYear: currentFiscalYear,
                });

                product.stock = (product.stock || 0) + quantityNumber;
                await product.save({ session });
            }

            const billItems = [];

            // Process all items to update stock and build bill items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
                }

                // Calculate discount values
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                await addStock(
                    product, item.quantity, item.price, item.batchNumber, item.expiryDate, uniqueId
                );

                billItems.push({
                    item: product._id,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    quantity: item.quantity,
                    price: item.price,
                    netPrice: netPuPrice,
                    puPrice: item.price,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    unit: item.unit,
                    vatStatus: product.vatStatus,
                    uniqueUuId: uniqueId,
                    fiscalYear: currentFiscalYear,
                });
            }

            // Create transactions for each item
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                // Calculate discount values
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                const transaction = new Transaction({
                    item: product,
                    account: accountId,
                    billNumber: billNumber,
                    purchaseSalesReturnType: 'Sales Return',
                    quantity: items[0].quantity,
                    price: items[0].price,
                    netPrice: netPuPrice,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    isType: 'SlRt',
                    type: 'SlRt',
                    salesReturnBillId: newBill._id,
                    debit: 0,
                    credit: newBill.totalAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + newBill.totalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    fiscalYear: currentFiscalYear,
                    company: companyId,
                    user: userId
                });

                await transaction.save({ session });
            }

            // Create transaction for Sales Account
            const salesRtnAmount = finalTaxableAmount + finalNonTaxableAmount;
            if (salesRtnAmount > 0) {
                const salesRtnAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
                if (salesRtnAccount) {
                    const partyAccount = await Account.findById(accountId).session(session);
                    if (!partyAccount) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, message: 'Party account not found.' });
                    }
                    const salesRtnTransaction = new Transaction({
                        account: salesRtnAccount._id,
                        billNumber: billNumber,
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: partyAccount.name,
                        debit: salesRtnAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + salesRtnAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await salesRtnTransaction.save({ session });
                }
            }

            // Create transaction for VAT amount
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const partyAccount = await Account.findById(accountId).session(session);
                    if (!partyAccount) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, message: 'Party account not found.' });
                    }
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: billNumber,
                        isType: 'VAT',
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: partyAccount.name,
                        debit: vatAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + vatAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save({ session });
                }
            }

            // Create transaction for round-off amount
            if (roundOffAmount !== 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const partyAccount = await Account.findById(accountId).session(session);
                    if (!partyAccount) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, message: 'Party account not found.' });
                    }

                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        isType: 'RoundOff',
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: partyAccount.name,
                        debit: roundOffAmount > 0 ? 0 : Math.abs(roundOffAmount),
                        credit: roundOffAmount > 0 ? roundOffAmount : 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + roundOffAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                }
            }

            // Create cash transaction if payment mode is cash
            if (paymentMode === 'cash') {
                const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashAccount) {
                    const cashTransaction = new Transaction({
                        account: cashAccount._id,
                        billNumber: billNumber,
                        isType: 'SlRt',
                        type: 'SlRt',
                        salesReturnBillId: newBill._id,
                        purchaseSalesReturnType: 'Sales Return',
                        debit: 0,
                        credit: finalAmount,
                        paymentMode: paymentMode,
                        balance: previousBalance + finalAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear,
                    });
                    await cashTransaction.save({ session });
                }
            }

            // Update bill with items and save
            newBill.items = billItems;
            await newBill.save({ session });

            // Commit the transaction if everything succeeds
            await session.commitTransaction();
            session.endSession();

            if (req.query.print === 'true') {
                return res.status(200).json({
                    success: true,
                    message: 'Sales Return saved successfully!',
                    billId: newBill._id,
                    redirectUrl: `/sales-return/${newBill._id}/direct-print`
                });
            } else {
                return res.status(200).json({
                    success: true,
                    message: 'Sales Return saved successfully!',
                    billId: newBill._id,
                    redirectUrl: '/sales-return'
                });
            }
        } catch (error) {
            console.error("Error creating sales return:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                message: 'Error creating sales return',
                error: error.message
            });
        }
    }
});

router.get('/cash/sales-return', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const companyId = req.session.currentCompany;

        // Fetch all required data in parallel for better performance
        const [
            company,
            items,
            bills,
            salesInvoice,
            lastCounter,
            fiscalYears,
            categories,
            units,
            companyGroups,
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            Item.find({ company: companyId, status: 'active' }).populate('category').populate('unit').populate('mainUnit').populate('stockEntries'),
            SalesReturn.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            SalesBill.find({ company: companyId }),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'salesReturn'
            }),
            FiscalYear.findById(req.session.currentFiscalYear?.id),
            Category.find({ company: companyId }),
            Unit.find({ company: companyId }),
            CompanyGroup.find({ company: companyId }),
        ]);

        // Date handling
        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const transactionDateNepali = new NepaliDate(today).format('YYYY-MM-DD');
        const companyDateFormat = company ? company.dateFormat : 'english';

        // Fiscal year handling
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;
            fiscalYear = currentFiscalYear._id.toString();
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company.'
            });
        }

        // Process items with stock information
        const itemsWithStock = items.map(item => {
            const totalStock = item.stockEntries.reduce((sum, entry) => {
                return sum + (entry.quantity || 0);
            }, 0);

            // Sort stock entries by date in descending order (newest first)
            const sortedStockEntries = [...item.stockEntries].sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });

            // Get the latest stock entry (first item after sorting)
            const latestStockEntry = sortedStockEntries[0] || null;

            // Get the latest puPrice (rounded to 2 decimal places)
            const puPrice = latestStockEntry?.puPrice
                ? Math.round(latestStockEntry.puPrice * 100) / 100
                : item.puPrice
                    ? Math.round(item.puPrice * 100) / 100
                    : 0;

            return {
                ...item.toObject(),
                stock: totalStock,
                latestPuPrice: puPrice,
                latestStockEntry: latestStockEntry
            };
        });

        // Calculate next bill number
        const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
        const prefix = fiscalYears.billPrefixes.salesReturn;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        // 1. Fetch active cash accounts from Account collection
        const relevantGroups = await CompanyGroup.find({
            name: { $in: ['Cash in Hand'] }
        }).exec();

        const relevantGroupIds = relevantGroups.map(group => group._id);

        const activeAccounts = await Account.find({
            company: companyId,
            fiscalYear: fiscalYear,
            isActive: true,
            companyGroups: { $in: relevantGroupIds }
        }).select('name address pan phone email defaultCashAccount');

        // 2. Fetch previously used cash accounts from SalesBill collection
        const usedCashAccounts = await SalesBill.aggregate([
            {
                $match: {
                    company: new mongoose.Types.ObjectId(companyId),
                    cashAccount: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: "$cashAccount",
                    address: { $first: "$cashAccountAddress" },
                    pan: { $first: "$cashAccountPan" },
                    phone: { $first: "$cashAccountPhone" },
                    email: { $first: "$cashAccountEmail" }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    address: 1,
                    pan: 1,
                    phone: 1,
                    email: 1,
                    isHistorical: true // Flag to identify historical accounts
                }
            }
        ]);

        // Combine both results, ensuring no duplicates
        const combinedAccounts = [...activeAccounts.map(acc => ({
            ...acc.toObject(),
            isHistorical: false
        }))];

        usedCashAccounts.forEach(usedAccount => {
            // Only add if not already in activeAccounts
            if (!activeAccounts.some(acc => acc.name === usedAccount.name)) {
                combinedAccounts.push({
                    _id: null, // No ID since it's from SalesBill
                    name: usedAccount.name,
                    address: usedAccount.address,
                    pan: usedAccount.pan,
                    phone: usedAccount.phone,
                    email: usedAccount.email,
                    isHistorical: true
                });
            }
        });

        // Sort combined accounts alphabetically by name
        combinedAccounts.sort((a, b) => a.name.localeCompare(b.name));

        // Prepare response data
        const responseData = {
            success: true,
            data: {
                company: {
                    _id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    vatEnabled: company.vatEnabled,
                    fiscalYear: company.fiscalYear
                },
                items: itemsWithStock,
                accounts: combinedAccounts,
                salesReturnBills: bills.map(bill => ({
                    _id: bill._id,
                    billNumber: bill.billNumber,
                    account: bill.account,
                    items: bill.items,
                    totalAmount: bill.totalAmount,
                    discount: bill.discount,
                    taxableAmount: bill.taxableAmount,
                    vatAmount: bill.vatAmount,
                    grandTotal: bill.grandTotal,
                    transactionDate: bill.transactionDate
                })),
                salesInvoices: salesInvoice.map(invoice => ({
                    _id: invoice._id,
                    billNumber: invoice.billNumber,
                    account: invoice.account,
                    grandTotal: invoice.grandTotal,
                    transactionDate: invoice.transactionDate
                })),
                nextSalesReturnBillNumber: nextBillNumber,
                dates: {
                    nepaliDate,
                    transactionDateNepali
                },
                currentFiscalYear: {
                    _id: currentFiscalYear._id,
                    name: currentFiscalYear.name,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    isActive: currentFiscalYear.isActive
                },
                categories: categories.map(cat => ({
                    _id: cat._id,
                    name: cat.name
                })),
                units: units.map(unit => ({
                    _id: unit._id,
                    name: unit.name
                })),
                companyGroups: companyGroups.map(group => ({
                    _id: group._id,
                    name: group.name
                })),
                userPreferences: {
                    theme: req.user.preferences?.theme || 'light'
                },
                permissions: {
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            }
        };

        return res.json(responseData);

    } catch (error) {
        console.error('Error in /cash/sales-return/add route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.post('/cash/sales-return', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { cashAccount, cashAccountAddress, cashAccountPan, cashAccountEmail, cashAccountPhone, items, vatPercentage, transactionDateNepali, transactionDateRoman, billDate, nepaliDate, isVatExempt, discountPercentage, paymentMode, roundOffAmount: manualRoundOffAmount } = req.body;
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            const userId = req.user._id;

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let subTotal = 0;
            let vatAmount = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            // Validation
            if (!companyId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, error: 'Company ID is required' });
            }

            if (!cashAccount) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, error: 'Invalid account for this company' });
            }

            if (!items || items.length === 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, error: 'No items provided' });
            }

            // Validate each item before processing
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, error: `Item with id ${item.item} not found` });
                }

                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity, 10);
                subTotal += itemTotal;

                if (product.vatStatus === 'vatable') {
                    hasVatableItems = true;
                    totalTaxableAmount += itemTotal;
                } else {
                    hasNonVatableItems = true;
                    totalNonTaxableAmount += itemTotal;
                }
            }

            // Check validation conditions after processing all items
            if (isVatExempt !== 'all') {
                if (isVatExemptBool && hasVatableItems) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, error: 'Cannot save VAT exempt bill with vatable items' });
                }

                if (!isVatExemptBool && hasNonVatableItems) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, error: 'Cannot save bill with non-vatable items when VAT is applied' });
                }
            }

            // Apply discount and calculate amounts
            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;
            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            // Calculate VAT
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (finalTaxableAmount * vatPercentage) / 100;
            } else {
                vatAmount = 0;
            }

            let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
            let finalAmount = totalAmount;

            // Handle round off settings
            let roundOffForSalesReturn = await Settings.findOne({
                company: companyId,
                userId,
                fiscalYear: currentFiscalYear
            }).session(session);
            if (!roundOffForSalesReturn) {
                roundOffForSalesReturn = { roundOffSalesReturn: false };
            }

            let roundOffAmount = 0;
            if (roundOffForSalesReturn.roundOffSalesReturn) {
                finalAmount = Math.round(finalAmount.toFixed(2));
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForSalesReturn.roundOffSalesReturn) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            // Generate bill number only after all validations pass
            const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'salesReturn', session);

            // Create new sales return
            const newBill = new SalesReturn({
                billNumber: billNumber,
                cashAccount: cashAccount,
                cashAccountAddress,
                cashAccountPan,
                cashAccountEmail,
                cashAccountPhone,
                purchaseSalesReturnType: 'Sales Return',
                items: [],
                isVatExempt: isVatExemptBool,
                isVatAll,
                vatPercentage: isVatExemptBool ? 0 : vatPercentage,
                subTotal,
                discountPercentage: discount,
                discountAmount: discountForTaxable + discountForNonTaxable,
                nonVatSalesReturn: finalNonTaxableAmount,
                taxableAmount: finalTaxableAmount,
                vatAmount,
                totalAmount: finalAmount,
                roundOffAmount: roundOffAmount,
                paymentMode,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear,
            });

            // Get previous balance
            let previousBalance = 0;
            const accountTransaction = await Transaction.findOne({ cashAccount: cashAccount })
                .sort({ transactionDate: -1 })
                .session(session);
            if (accountTransaction) {
                previousBalance = accountTransaction.balance;
            }

            // Generate a unique ID for the stock entry
            const uniqueId = uuidv4();

            // FIFO stock addition function
            async function addStock(product, quantity, price, batchNumber, expiryDate, uniqueId) {
                const quantityNumber = Number(quantity);

                // Calculate discount values
                const itemTotal = price * quantityNumber;
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = price - (price * discount / 100);

                product.stockEntries.push({
                    quantity: quantityNumber,
                    price: price,
                    puPrice: price,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    batchNumber: batchNumber,
                    expiryDate: expiryDate,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    mrp: price,
                    uniqueUuId: uniqueId,
                    salesReturnBillId: newBill._id,
                    fiscalYear: currentFiscalYear,
                });

                product.stock = (product.stock || 0) + quantityNumber;
                await product.save({ session });
            }

            const billItems = [];

            // Process all items to update stock and build bill items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, error: `Item with id ${item.item} not found` });
                }

                // Calculate discount values
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                await addStock(
                    product, item.quantity, item.price, item.batchNumber, item.expiryDate, uniqueId
                );

                billItems.push({
                    item: product._id,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    quantity: item.quantity,
                    price: item.price,
                    netPrice: netPuPrice,
                    puPrice: item.price,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    unit: item.unit,
                    vatStatus: product.vatStatus,
                    uniqueUuId: uniqueId,
                    fiscalYear: currentFiscalYear,
                });
            }

            // Create transactions for each item
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                const transaction = new Transaction({
                    item: product,
                    cashAccount: cashAccount,
                    billNumber: billNumber,
                    purchaseSalesReturnType: 'Sales Return',
                    quantity: items[0].quantity,
                    price: items[0].price,
                    netPrice: netPuPrice,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    isType: 'SlRt',
                    type: 'SlRt',
                    salesReturnBillId: newBill._id,
                    debit: 0,
                    credit: newBill.totalAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + newBill.totalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    fiscalYear: currentFiscalYear,
                    company: companyId,
                    user: userId
                });

                await transaction.save({ session });
            }

            // Create transaction for Sales Account
            const salesRtnAmount = finalTaxableAmount + finalNonTaxableAmount;
            if (salesRtnAmount > 0) {
                const salesRtnAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
                if (salesRtnAccount) {
                    const salesTransaction = new Transaction({
                        account: salesRtnAccount._id,
                        billNumber: billNumber,
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: cashAccount,
                        debit: salesRtnAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + salesRtnAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await salesTransaction.save({ session });
                }
            }

            // Create transaction for VAT amount
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: billNumber,
                        isType: 'VAT',
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: cashAccount,
                        debit: vatAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + vatAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save({ session });
                }
            }

            // Create transaction for round-off amount
            if (roundOffAmount !== 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        isType: 'RoundOff',
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: cashAccount,
                        debit: roundOffAmount > 0 ? 0 : Math.abs(roundOffAmount),
                        credit: roundOffAmount > 0 ? roundOffAmount : 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + roundOffAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                }
            }

            // Create cash transaction if payment mode is cash
            if (paymentMode === 'cash') {
                const cashInHandAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashInHandAccount) {
                    const cashTransaction = new Transaction({
                        account: cashInHandAccount._id,
                        cashAccount: cashAccount,
                        billNumber: billNumber,
                        isType: 'SlRt',
                        type: 'SlRt',
                        salesReturnBillId: newBill._id,
                        purchaseSalesReturnType: 'Sales Return',
                        debit: 0,
                        credit: finalAmount,
                        paymentMode: paymentMode,
                        balance: previousBalance + finalAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear,
                    });
                    await cashTransaction.save({ session });
                }
            }

            // Update bill with items and save
            newBill.items = billItems;
            await newBill.save({ session });

            // Commit the transaction if everything succeeds
            await session.commitTransaction();
            session.endSession();

            return res.status(201).json({
                success: true,
                message: 'Sales Return saved successfully!',
                bill: {
                    id: newBill._id,
                    billNumber: newBill.billNumber,
                    totalAmount: newBill.totalAmount,
                    date: newBill.date,
                    items: newBill.items.map(item => ({
                        itemId: item.item,
                        quantity: item.quantity,
                        price: item.price,
                        amount: item.quantity * item.price
                    }))
                },
                printUrl: `/sales-return/${newBill._id}/cash/direct-print`
            });

        } catch (error) {
            console.error("Error creating sales return:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                error: 'Error creating sales return',
                details: error.message
            });
        }
    } else {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});

router.get('/sales-return/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const currentCompanyName = req.session.currentCompanyName;
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const transactionDateNepali = new NepaliDate(today).format('YYYY-MM-DD');

            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, use company's fiscal year
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

                fiscalYear = req.session.currentFiscalYear.id;
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            const currentCompany = await Company.findById(new ObjectId(companyId));
            if (!currentCompany) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            const billId = req.params.id;
            const bill = await SalesReturn.findById(billId)
                .populate({ path: 'account', select: 'name pan address email phone openingBalance' })
                .populate('items.item')
                .populate('user');

            if (!bill) {
                return res.status(404).json({
                    success: false,
                    error: 'Sales return bill not found'
                });
            }

            // Populate unit for each item in the bill
            for (const item of bill.items) {
                await item.item.populate('unit');
            }

            let finalBalance = null;
            let balanceLabel = '';

            // Fetch the latest transaction for the current company and bill
            if (bill.paymentMode === 'credit') {
                const latestTransaction = await Transaction.findOne({
                    company: new ObjectId(companyId),
                    billId: new ObjectId(billId)
                }).sort({ transactionDate: -1 });

                let lastBalance = 0;

                if (latestTransaction) {
                    lastBalance = Math.abs(latestTransaction.balance || 0);
                    if (latestTransaction.debit) {
                        balanceLabel = 'Dr';
                    } else if (latestTransaction.credit) {
                        balanceLabel = 'Cr';
                    }
                }

                // Retrieve the opening balance from the account
                const openingBalance = bill.account ? bill.account.openingBalance : null;

                if (openingBalance) {
                    lastBalance += (openingBalance.type === 'Dr' ? openingBalance.amount : -openingBalance.amount);
                    balanceLabel = openingBalance.type;
                }

                finalBalance = lastBalance;
            }

            // Prepare the response data
            const responseData = {
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    currentFiscalYear,
                    bill: {
                        ...bill._doc,
                        items: bill.items.map(item => ({
                            ...item._doc,
                            item: {
                                ...item.item._doc,
                                unit: item.item.unit
                            }
                        })),
                        account: bill.account,
                        user: bill.user
                    },
                    currentCompanyName,
                    currentCompany: {
                        _id: currentCompany._id,
                        name: currentCompany.name,
                        phone: currentCompany.phone,
                        pan: currentCompany.pan,
                        address: currentCompany.address,
                    },
                    lastBalance: finalBalance,
                    balanceLabel,
                    paymentMode: bill.paymentMode,
                    nepaliDate,
                    transactionDateNepali,
                    englishDate: bill.englishDate,
                    companyDateFormat,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            };

            res.json(responseData);
        } catch (error) {
            console.error("Error fetching sales return bill for printing:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching sales return bill for printing',
                details: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});
router.get('/salesReturn-vat-report', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const companyId = req.session.currentCompany;
        const currentCompany = await Company.findById(new ObjectId(companyId));
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : '';

        if (!currentCompany) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Extract dates from query parameters
        let fromDate = req.query.fromDate ? req.query.fromDate : null;
        let toDate = req.query.toDate ? req.query.toDate : null;

        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat')
            .populate('fiscalYear');

        // Check fiscal year
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
                message: 'No fiscal year found in session or company.'
            });
        }

        if (!fromDate || !toDate) {
            return res.json({
                success: true,
                data: {
                    company,
                    currentFiscalYear,
                    companyDateFormat,
                    nepaliDate,
                    currentCompany,
                    salesReturnVatReport: [],
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName: req.session.currentCompanyName,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'Sales Return VAT Report',
                    theme: req.user.preferences?.theme || 'light'
                }
            });
        }

        // Build query
        let query = { company: companyId };
        if (fromDate && toDate) {
            query.date = { $gte: fromDate, $lte: toDate };
        } else if (fromDate) {
            query.date = { $gte: fromDate };
        } else if (toDate) {
            query.date = { $lte: toDate };
        }

        const salesReturns = await SalesReturn.find(query)
            .populate('account')
            .populate('cashAccount')
            .sort({ date: 1 });

        // const Bills = await SalesBill.find(query)
        //     .populate('account')
        //     .populate('cashAccount')
        //     .sort({ billNumber: 1 });

        // Prepare VAT report data
        const salesReturnVatReport = await Promise.all(salesReturns.map(async returnBill => {
            if (returnBill.account) {
                const account = await Account.findById(returnBill.account);
                return {
                    billNumber: returnBill.billNumber,
                    date: returnBill.date,
                    accountName: account ? account.name : 'N/A',
                    panNumber: account ? account.pan : 'N/A',
                    totalAmount: returnBill.totalAmount,
                    discountAmount: returnBill.discountAmount,
                    nonVatSales: returnBill.nonVatSalesReturn,
                    taxableAmount: returnBill.taxableAmount,
                    vatAmount: returnBill.vatAmount,
                };
            } else {
                return {
                    billNumber: returnBill.billNumber,
                    date: returnBill.date,
                    accountName: returnBill.cashAccount || 'Cash Sale',
                    panNumber: returnBill.cashAccountPan || 'N/A',
                    totalAmount: returnBill.totalAmount,
                    discountAmount: returnBill.discountAmount,
                    nonVatSales: returnBill.nonVatSalesReturn,
                    taxableAmount: returnBill.taxableAmount,
                    vatAmount: returnBill.vatAmount,
                    isCash: true
                }
            }
        }));

        res.json({
            success: true,
            data: {
                company,
                currentFiscalYear,
                salesReturnVatReport,
                companyDateFormat,
                nepaliDate,
                currentCompany,
                fromDate: req.query.fromDate,
                toDate: req.query.toDate,
                currentCompanyName: req.session.currentCompanyName,
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            },
            meta: {
                title: 'Sales Return VAT Report',
                theme: req.user.preferences?.theme || 'light'
            }
        });

    } catch (error) {
        console.error('Error in salesReturn-vat-report:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
module.exports = router;