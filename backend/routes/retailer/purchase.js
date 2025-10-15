const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require("../../middleware/auth");
const { ensureTradeType } = require("../../middleware/tradeType");
const Account = require("../../models/retailer/Account");
const Item = require("../../models/retailer/Item");
const PurchaseBill = require("../../models/retailer/PurchaseBill");
const Company = require("../../models/Company");
const NepaliDate = require('nepali-date');
const Settings = require('../../models/retailer/Settings');
const Transaction = require('../../models/retailer/Transaction');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');
const FiscalYear = require('../../models/FiscalYear');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const CompanyGroup = require('../../models/retailer/CompanyGroup');
const { default: Store } = require('../../models/retailer/Store');
const { default: Rack } = require('../../models/retailer/Rack');
const { checkStoreManagement } = require('../../middleware/storeManagement');

// In your backend routes (e.g., routes/retailer.js)
router.get('/fetchlatest/accounts', isLoggedIn, ensureAuthenticated, ensureCompanySelected, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const fiscalYear = req.session.currentFiscalYear?.id;

        // Fetch relevant company groups
        const relevantGroups = await CompanyGroup.find({
            name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
        }).exec();

        const relevantGroupIds = relevantGroups.map(group => group._id);

        const accounts = await Account.find({
            company: companyId,
            isActive: true,
            $or: [
                { originalFiscalYear: fiscalYear },
                {
                    fiscalYear: fiscalYear,
                    originalFiscalYear: { $lt: fiscalYear }
                }
            ],
            companyGroups: { $in: relevantGroupIds }
        }).sort({ name: 1 }); // Sort alphabetically

        res.json(accounts);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Purchase Bill routes
router.get('/purchase', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkStoreManagement, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            // Fetch all required data in parallel for better performance
            const [
                items,
                purchasebills,
                company,
                stores,
                racks,
                // accounts,
                lastCounter
            ] = await Promise.all([
                Item.find({ company: companyId, status: 'active' }).populate('category').populate('unit').populate('mainUnit').populate('stockEntries').lean(),
                PurchaseBill.find({ company: companyId }).populate('account').populate('items.item').populate('items.unit'),
                Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear'),
                req.storeManagementEnabled ? Store.find({ company: companyId, isActive: true }) : [],
                Rack.find({ company: companyId }).populate('store'),
                // Account.find({}).lean().exec(),
                BillCounter.findOne({
                    company: companyId,
                    fiscalYear: req.session.currentFiscalYear?.id,
                    transactionType: 'purchase'
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
                fiscalYear = currentFiscalYear._id.toString();
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
                const latestStockEntry = sortedStockEntries[0] || null;

                // Get the latest puPrice and multiply by WSUnit (default to 1 if not available)
                const puPrice = latestStockEntry?.puPrice
                    ? Math.round(latestStockEntry.puPrice * (latestStockEntry.WSUnit || 1) * 100) / 100
                    : item.puPrice
                        ? Math.round(item.puPrice * (item.WSUnit || 1) * 100) / 100
                        : 0;

                return {
                    ...item,
                    stock: totalStock,
                    latestPuPrice: puPrice,  // This now includes WSUnit multiplication
                    latestStockEntry: latestStockEntry,
                };
            });

            // Calculate next bill number
            const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
            const fiscalYears = await FiscalYear.findById(fiscalYear);
            const prefix = fiscalYears.billPrefixes.purchase;
            const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

            // Group racks by store
            const racksByStore = {};
            racks.forEach(rack => {
                if (!racksByStore[rack.store._id]) {
                    racksByStore[rack.store._id] = [];
                }
                racksByStore[rack.store._id].push({
                    _id: rack._id,
                    name: rack.name,
                    description: rack.description
                });
            });

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
                    accounts,
                    purchaseBills: purchasebills.map(bill => ({
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
                    nextPurchaseBillNumber: nextBillNumber,
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
                    stores: stores.map(store => ({
                        _id: store._id,
                        name: store.name,
                        code: store.code,
                        location: store.location
                    })),
                    racksByStore,
                    userPreferences: {
                        theme: req.user.preferences?.theme || 'light'
                    },
                    permissions: {
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor',
                        storeManagementEnabled: req.storeManagementEnabled
                    }
                }
            };

            return res.json(responseData);
        }
    } catch (error) {
        console.error('Error in /purchase-bills route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.get('/purchase/check-invoice', isLoggedIn, ensureAuthenticated, ensureCompanySelected, async (req, res) => {
    try {
        const { partyBillNumber } = req.query;

        if (!partyBillNumber) {
            return res.json({ exists: false, partyName: '', date: null });
        }

        const existingBill = await PurchaseBill.findOne({
            company: req.session.currentCompany,
            partyBillNumber: partyBillNumber.trim()
        }).populate('account', 'name');

        if (existingBill) {
            return res.json({
                exists: true,
                partyName: existingBill.account?.name || 'another party',
                date: existingBill.date
            });
        }

        return res.json({ exists: false, partyName: '', date: null });
    } catch (error) {
        console.error('Error checking duplicate invoice:', error);
        return res.status(500).json({ error: 'Error checking invoice number' });
    }
});

// Fetch all purchase bills
router.get('/purchase-register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompany = await Company.findById(new ObjectId(companyId));
            const currentCompanyName = req.session.currentCompanyName;
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
                        fromDate: fromDate || '',
                        toDate: toDate || ''
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

            const bills = await PurchaseBill.find(query)
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
                    currentCompanyName,
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
        console.error('Error fetching purchase bills:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

router.post('/purchase', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkDemoPeriod, checkFiscalYearDateRange, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // Destructure all required fields including calculated values
            const {
                accountId,
                items,
                vatPercentage,
                transactionDateNepali,
                transactionDateRoman,
                billDate,
                partyBillNumber,
                nepaliDate,
                isVatExempt,
                discountPercentage,
                discountAmount,
                paymentMode,
                roundOffAmount,
                subTotal,
                taxableAmount,
                nonTaxableAmount,
                vatAmount,
                totalAmount,
                totalCCAmount
            } = req.body;

            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear');
            const userId = req.user._id;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';

            // Basic validation checks
            if (!companyId) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Company ID is required." });
            }
            if (!isVatExempt) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Invalid VAT selection." });
            }
            if (!paymentMode) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Invalid payment mode." });
            }

            // Date format validation
            const companyDateFormat = company ? company.dateFormat : 'english';
            if (companyDateFormat === 'nepali') {
                if (!transactionDateNepali) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: "Invalid transaction date." });
                }
                if (!nepaliDate) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: "Invalid invoice date." });
                }
            } else {
                if (!transactionDateRoman) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: "Invalid transaction date." });
                }
                if (!billDate) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: "Invalid invoice date." });
                }
            }

            // Validate account exists
            const account = await Account.findOne({ _id: accountId, company: companyId }).session(session);
            if (!account) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Invalid account for this company" });
            }

            // Validate items structure
            if (!items || !Array.isArray(items) || items.length === 0) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "At least one item is required." });
            }

            // Validate each item and group by product ID to handle duplicates
            let hasVatableItems = false;
            let hasNonVatableItems = false;
            const validatedItems = [];
            const productMap = new Map(); // To track products and avoid duplicate validation

            for (const item of items) {
                // Check if we've already validated this product
                if (!productMap.has(item.item)) {
                    const product = await Item.findById(item.item).session(session);
                    if (!product) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
                    }
                    productMap.set(item.item, product);
                }

                const product = productMap.get(item.item);

                if (!item.batchNumber || !item.batchNumber.trim()) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Batch number is required for item ${product.name}` });
                }

                if (!item.expiryDate) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Expiry date is required for item ${product.name}` });
                }

                // // Validate numeric fields
                // if (isNaN(parseFloat(item.puPrice))) {
                //     await session.abortTransaction();
                //     return res.status(400).json({ success: false, message: `Invalid price for item ${product.name}` });
                // }

                // if (isNaN(parseFloat(item.quantity))) {
                //     await session.abortTransaction();
                //     return res.status(400).json({ success: false, message: `Invalid quantity for item ${product.name}` });
                // }

                // Track VAT status for validation
                if (product.vatStatus === 'vatable') {
                    hasVatableItems = true;
                } else {
                    hasNonVatableItems = true;
                }

                validatedItems.push({
                    ...item,
                    product // Attach full product document for later use
                });
            }

            // Validate VAT consistency
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

            // Validate calculated amounts are numbers
            if (isNaN(parseFloat(subTotal)) || isNaN(parseFloat(taxableAmount)) ||
                isNaN(parseFloat(nonTaxableAmount)) || isNaN(parseFloat(totalAmount))) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: 'Invalid calculated amounts' });
            }

            // Get next bill number
            const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'purchase', session);

            // Create new purchase bill with frontend-calculated values
            const newBill = new PurchaseBill({
                billNumber: billNumber,
                partyBillNumber,
                account: accountId,
                purchaseSalesType: 'Purchase',
                items: [],
                isVatExempt: isVatExemptBool,
                isVatAll,
                vatPercentage: isVatExemptBool ? 0 : vatPercentage,
                subTotal: parseFloat(subTotal),
                discountPercentage: parseFloat(discountPercentage) || 0,
                discountAmount: parseFloat(discountAmount) || 0,
                nonVatPurchase: parseFloat(nonTaxableAmount),
                taxableAmount: parseFloat(taxableAmount),
                totalCCAmount: parseFloat(totalCCAmount) || 0,
                vatAmount: parseFloat(vatAmount) || 0,
                totalAmount: parseFloat(totalAmount),
                roundOffAmount: parseFloat(roundOffAmount) || 0,
                paymentMode,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });

            // Get previous balance for transactions
            let previousBalance = 0;
            const lastTransaction = await Transaction.findOne({ account: accountId })
                .sort({ transactionDate: -1 })
                .session(session);
            if (lastTransaction) {
                previousBalance = lastTransaction.balance;
            }

            const uniqueId = uuidv4();

            // Process items and add to stock - FIRST VALIDATE ALL ITEMS, THEN UPDATE PRODUCTS
            const billItems = [];
            const productUpdates = new Map(); // Track product updates to avoid version conflicts

            // First pass: collect all stock entries for each product
            for (const item of validatedItems) {
                const { product, ...itemData } = item;

                // Calculate values needed for stock entry
                const quantityNumber = Number(itemData.quantity) + Number(itemData.bonus || 0);
                const WSUnitNumber = itemData.WSUnit || 1;
                const netQuantity = quantityNumber * WSUnitNumber;
                const puPriceWithOutBonus = itemData.puPrice * itemData.quantity;
                const netPuPrice = itemData.puPrice - (itemData.puPrice * (discountPercentage || 0) / 100);
                const mrpForStock = itemData.currency === 'INR' ? itemData.mrp * 1.6 : itemData.mrp;

                // Create stock entry
                const stockEntry = {
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    WSUnit: WSUnitNumber,
                    quantity: netQuantity,
                    bonus: (itemData.bonus || 0) * WSUnitNumber,
                    batchNumber: itemData.batchNumber,
                    expiryDate: itemData.expiryDate,
                    price: itemData.price / WSUnitNumber,
                    puPrice: puPriceWithOutBonus / (itemData.quantity * WSUnitNumber) || 0,
                    itemCCAmount: itemData.itemCCAmount || 0,
                    discountPercentagePerItem: discountPercentage || 0,
                    discountAmountPerItem: (itemData.puPrice * itemData.quantity * (discountPercentage || 0)) / 100,
                    netPuPrice: netPuPrice,
                    mainUnitPuPrice: itemData.puPrice,
                    mrp: mrpForStock / WSUnitNumber,
                    marginPercentage: itemData.marginPercentage || 0,
                    currency: itemData.currency || 'NPR',
                    purchaseBillId: newBill._id,
                    store: itemData.store,
                    rack: itemData.rack,
                    uniqueUuId: uniqueId,
                    fiscalYear: currentFiscalYear,
                };

                // Add to product updates map
                if (!productUpdates.has(product._id.toString())) {
                    productUpdates.set(product._id.toString(), {
                        product,
                        stockEntries: [],
                        totalNetQuantity: 0,
                        newWSUnit: WSUnitNumber,
                    });
                }

                const productUpdate = productUpdates.get(product._id.toString());
                productUpdate.stockEntries.push(stockEntry);
                productUpdate.totalNetQuantity += netQuantity;
                productUpdate.newWSUnit = WSUnitNumber;

                // Add to bill items
                billItems.push({
                    item: product._id,
                    batchNumber: itemData.batchNumber,
                    expiryDate: itemData.expiryDate,
                    WSUnit: WSUnitNumber,
                    quantity: itemData.quantity,
                    bonus: itemData.bonus || 0,
                    Altbonus: itemData.bonus || 0,
                    price: itemData.price,
                    puPrice: itemData.puPrice || 0,
                    discountPercentagePerItem: discountPercentage || 0,
                    discountAmountPerItem: (itemData.puPrice * itemData.quantity * (discountPercentage || 0)) / 100,
                    netPuPrice: netPuPrice || 0,
                    Altquantity: itemData.quantity,
                    Altprice: itemData.price,
                    AltpuPrice: itemData.puPrice,
                    mainUnitPuPrice: itemData.puPrice,
                    mrp: itemData.mrp,
                    CCPercentage: itemData.CCPercentage || 0,
                    itemCCAmount: itemData.itemCCAmount || 0,
                    marginPercentage: itemData.marginPercentage || 0,
                    currency: itemData.currency || 'NPR',
                    store: itemData.store,
                    rack: itemData.rack,
                    unit: itemData.unit,
                    vatStatus: product.vatStatus,
                    uniqueUuId: uniqueId
                });
            }

            // Second pass: update all products (this avoids version conflicts)
            for (const [productId, update] of productUpdates) {
                update.product.stockEntries.push(...update.stockEntries);
                update.product.stock = (update.product.stock || 0) + update.totalNetQuantity;
                update.product.WSUnit = update.product.WSUnit || 1; // Ensure WSUnit exists

                // Use findByIdAndUpdate to avoid version conflicts
                await Item.findByIdAndUpdate(
                    productId,
                    {
                        $push: { stockEntries: { $each: update.stockEntries } },
                        $inc: { stock: update.totalNetQuantity },
                        // $set: { WSUnit: update.product.WSUnit }
                        $set: { WSUnit: update.newWSUnit, }
                    },
                    { session }
                );
            }

            // Update bill with items
            newBill.items = billItems;

            // Create transactions (rest of your transaction code remains the same)
            // 1. Party account transaction
            // Create transactions for each item
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                const partyTransaction = new Transaction({
                    item: product,
                    unit: item.unit,
                    WSUnit: item.WSUnit,
                    price: item.price,
                    puPrice: item.puPrice || 0,
                    quantity: item.quantity || 0,
                    bonus: item.bonus || 0,
                    account: accountId,
                    billNumber: billNumber,
                    partyBillNumber,
                    type: 'Purc',
                    purchaseBillId: newBill._id,
                    purchaseSalesType: 'Purchase',
                    debit: 0,
                    credit: newBill.totalAmount,
                    paymentMode: paymentMode,
                    balance: 0,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await partyTransaction.save({ session });
            }
            // 2. Purchase account transaction
            const purchaseAccount = await Account.findOne({ name: 'Purchase', company: companyId }).session(session);
            if (purchaseAccount) {
                const purchaseAmount = taxableAmount + nonTaxableAmount;
                const purchaseTransaction = new Transaction({
                    account: purchaseAccount._id,
                    billNumber: billNumber,
                    partyBillNumber,
                    type: 'Purc',
                    purchaseBillId: newBill._id,
                    purchaseSalesType: account.name,
                    debit: purchaseAmount,
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: 0,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await purchaseTransaction.save({ session });
            }

            // 3. VAT transaction if applicable
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: billNumber,
                        partyBillNumber,
                        isType: 'VAT',
                        type: 'Purc',
                        purchaseBillId: newBill._id,
                        purchaseSalesType: account.name,
                        debit: vatAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save({ session });
                }
            }

            // 4. Round-off transaction if applicable
            if (roundOffAmount !== 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        partyBillNumber,
                        isType: 'RoundOff',
                        type: 'Purc',
                        purchaseBillId: newBill._id,
                        purchaseSalesType: account.name,
                        debit: roundOffAmount > 0 ? roundOffAmount : 0,
                        credit: roundOffAmount < 0 ? Math.abs(roundOffAmount) : 0,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                }
            }

            // 5. Cash transaction if payment mode is cash
            if (paymentMode === 'cash') {
                const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashAccount) {
                    const cashTransaction = new Transaction({
                        account: cashAccount._id,
                        billNumber: billNumber,
                        partyBillNumber,
                        isType: 'Purc',
                        type: 'Purc',
                        purchaseBillId: newBill._id,
                        purchaseSalesType: 'Purchase',
                        debit: 0,
                        credit: totalAmount,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await cashTransaction.save({ session });
                }
            }

            // Save the bill
            await newBill.save({ session });

            // Commit transaction
            await session.commitTransaction();
            session.endSession();

            // Return response
            const response = {
                success: true,
                message: 'Purchase bill saved successfully!',
                billId: newBill._id
            };

            if (req.query.print === 'true') {
                response.redirectUrl = `/purchase-bills/${newBill._id}/direct-print`;
            } else {
                response.redirectUrl = '/purchase-bills';
            }

            return res.status(200).json(response);

        } catch (error) {
            console.error("Error creating purchase bill:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                message: 'Error creating purchase bill',
                error: error.message
            });
        }
    }
});

router.get('/purchase/finds', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
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
                return res.status(400).json({ error: 'No fiscal year found in session or company.' });
            }

            // Fetch the latest saved bill number (without modifying it)
            const latestBill = await PurchaseBill.findOne({
                company: companyId,
                fiscalYear: fiscalYear
            })
                .sort({ date: -1, billNumber: -1 }) // Sort by date descending, then billNumber descending
                .select('billNumber date')
                .lean();
            console.log('Latest bill query result:', latestBill);

            // Return JSON response instead of rendering
            return res.json({
                success: true,
                data: {
                    company: company,
                    billNumber: latestBill?.billNumber || '',
                    currentFiscalYear: currentFiscalYear,
                    companyDateFormat: companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    date: new Date().toISOString().split('T')[0],
                    title: '',
                    body: '',
                    user: req.user,
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error in /purchase/finds:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        return res.status(400).json({ error: 'Invalid trade type' });
    }
});

// Get payment form by billNumber
router.get('/purchase/edit/billNumber', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.query;
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

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

            // Find the payment document by billNumber
            const purchaseInvoice = await PurchaseBill.findOne({
                billNumber: billNumber,
                company: companyId,
                fiscalYear: fiscalYear
            }).populate({
                path: 'items.item',
                select: 'name hscode uniqueNumber vatStatus unit price category',
                populate: [
                    {
                        path: 'unit',
                        select: 'name _id'
                    },
                    {
                        path: 'category',
                        select: 'name _id'
                    }
                ]
            })
                .populate({
                    path: 'items.unit',
                    select: 'name _id'
                })
                .populate({
                    path: 'account',
                    select: 'name address pan _id uniqueNumber'
                })
                .lean()
                .exec();

            if (!purchaseInvoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Voucher number not found'
                });
            }

            // Fetch only the required company groups: Cash in Hand, Sundry Debtors, Sundry Creditors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
            }).exec();

            // Convert relevant group IDs to an array of ObjectIds
            const relevantGroupIds = relevantGroups.map(group => group._id);

            // Fetch accounts excluding 'Cash in Hand' and 'Bank Accounts'
            const accounts = await Account.find({
                company: companyId,
                isActive: true,
                $or: [
                    { originalFiscalYear: fiscalYear },
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear }
                    }
                ],
                companyGroups: { $in: relevantGroupIds }
            }).exec();

            res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    purchaseInvoice,
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    accounts,
                    nepaliDate,
                    companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    date: new Date().toISOString().split('T')[0],
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error fetching data for purchase form:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});

router.get('/purchase/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { id: billId } = req.params;
            const companyId = req.session.currentCompany;

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            const company = await Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear');

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

            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            const companyDateFormat = company.dateFormat || 'english';
            if (!currentFiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'Fiscal year not found'
                });
            }

            // Fetch purchase bill with proper population
            const purchaseInvoice = await PurchaseBill.findOne({
                _id: billId,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate({
                    path: 'items.item',
                    select: 'name hscode uniqueNumber vatStatus unit PuPrice quantity bonus batchNumber expiryDate stockEntries category',
                    populate: [
                        {
                            path: 'unit',
                            select: 'name _id'
                        },
                        {
                            path: 'category',
                            select: 'name _id'
                        }
                    ]
                })
                .populate({
                    path: 'items.unit',
                    select: 'name _id'
                })
                .populate({
                    path: 'account',
                    select: 'name address pan _id'
                })
                .lean()
                .exec();

            if (!purchaseInvoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase invoice not found or does not belong to the selected company'
                });
            }

            const processedItems = purchaseInvoice.items.map(item => {
                // Get fields from the referenced item document
                const itemData = item.item || {};

                // Calculate stock and latest puPrice
                const totalStock = itemData.stockEntries?.reduce((sum, entry) => {
                    return sum + (entry.quantity || 0);
                }, 0) || 0;

                // Sort stock entries by date to get the latest one
                const sortedStockEntries = itemData.stockEntries
                    ? [...itemData.stockEntries].sort((a, b) => new Date(b.date) - new Date(a.date))
                    : [];

                const latestStockEntry = sortedStockEntries[0] || {};
                const latestPuPrice = latestStockEntry.puPrice || itemData.PuPrice || 0;

                const unit = item.unit || (itemData.unit ? {
                    _id: itemData.unit._id,
                    name: itemData.unit.name
                } : null);

                return {
                    ...item,
                    // Item details from the Item model
                    name: itemData.name || '',
                    hscode: itemData.hscode || '',
                    uniqueNumber: itemData.uniqueNumber || '',
                    vatStatus: itemData.vatStatus || 'vatable',
                    category: itemData.category || null,
                    stock: totalStock,
                    latestPuPrice: Math.round(latestPuPrice * 100) / 100,
                    // Unit details (either from direct unit reference or item's unit)
                    unit: unit,
                    // Other fields from the purchase item
                    puPrice: item.puPrice,
                    quantity: item.quantity,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate?.toISOString().split('T')[0] || '',
                    WSUnit: item.WSUnit || 1,
                    bonus: item.bonus || 0,
                    amount: (item.quantity * item.puPrice).toFixed(2),
                    uniqueUuId: item.uniqueUuId || '',

                    // Include the original item reference ID
                    item: item.item?._id || null
                };
            });

            // Fetch all items for the company (for dropdown) with stock and latest price
            const allItems = await Item.find({ company: companyId, status: 'active' })
                .populate([
                    { path: 'unit', select: 'name _id' },
                    { path: 'category', select: 'name _id' },
                    { path: 'stockEntries', select: 'quantity puPrice date' }
                ])
                .select('name hscode uniqueNumber vatStatus unit puPrice quantity stockEntries category')
                .lean();

            // Process all items to include stock and latest price
            const processedAllItems = allItems.map(item => {
                const totalStock = item.stockEntries.reduce((sum, entry) => {
                    return sum + (entry.quantity || 0);
                }, 0);

                // Sort stock entries by date to get the latest one
                const sortedStockEntries = [...item.stockEntries].sort((a, b) => {
                    return new Date(b.date) - new Date(a.date);
                });

                const latestStockEntry = sortedStockEntries[0] || {};
                const latestPuPrice = latestStockEntry.puPrice || item.puPrice || 0;

                return {
                    ...item,
                    stock: totalStock,
                    latestPuPrice: Math.round(latestPuPrice * 100) / 100,
                    category: item.category || null
                };
            }).sort((a, b) => a.name.localeCompare(b.name));

            // Fetch only the required company groups: Cash in Hand, Sundry Debtors, Sundry Creditors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
            }).exec();

            // Convert relevant group IDs to an array of ObjectIds
            const relevantGroupIds = relevantGroups.map(group => group._id);

            const accounts = await Account.find({
                company: companyId,
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
                        vatEnabled: company.vatEnabled,
                        dateFormat: companyDateFormat,
                        name: req.session.currentCompanyName,
                        fiscalYear: currentFiscalYear
                    },
                    purchaseInvoice: {
                        ...purchaseInvoice,
                        items: processedItems
                    },
                    items: processedAllItems,
                    accounts: accounts.map(account => ({
                        _id: account._id,
                        name: account.name,
                        address: account.address,
                        pan: account.pan,
                        uniqueNumber: account.uniqueNumber
                    })),
                    user: {
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: {
                            theme: req.user.preferences?.theme || 'light'
                        }
                    }
                }
            };

            res.json(responseData);
        } catch (error) {
            console.error('Error fetching bill for edit:', error);
            res.status(500).json({
                success: false,
                error: 'Error fetching bill for edit',
                details: error.message
            });
        }
    }
});


router.put('/purchase/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const billId = req.params.id;
            const {
                accountId,
                items,
                vatPercentage,
                transactionDateRoman,
                transactionDateNepali,
                partyBillNumber,
                billDate,
                nepaliDate,
                isVatExempt,
                discountPercentage,
                paymentMode,
                roundOffAmount,
                // Frontend-calculated values
                subTotal,
                taxableAmount,
                nonTaxableAmount,
                vatAmount,
                totalAmount,
                totalCCAmount
            } = req.body;

            // Validate required fields
            if (!req.body.accountId || !req.body.items || !Array.isArray(req.body.items)) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: accountId or items'
                });
            }

            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear');
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const userId = req.user._id;

            // Validation checks
            if (!companyId) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Company ID is required'
                });
            }

            if (!isVatExempt) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid VAT selection'
                });
            }

            if (!paymentMode) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid payment mode'
                });
            }

            const companyDateFormat = company ? company.dateFormat : 'english';
            if (companyDateFormat === 'nepali') {
                if (!transactionDateNepali) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid transaction date'
                    });
                }
                if (!nepaliDate) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid invoice date'
                    });
                }
            } else {
                if (!transactionDateRoman) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid transaction date'
                    });
                }
                if (!billDate) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid invoice date'
                    });
                }
            }

            // Process items - ensure they have required fields
            const processedItems = req.body.items.map(item => {
                if (!item.item) {
                    throw new Error(`Item missing required field: item ID`);
                }
                if (!item.uniqueUuId) {
                    // For new items, generate a uniqueUuId
                    item.uniqueUuId = uuidv4();
                }
                return {
                    ...item,
                    unit: item.unit || null // Ensure unit is properly set
                };
            });

            const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
            if (!accounts) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid account for this company'
                });
            }

            const existingBill = await PurchaseBill.findOne({ _id: billId, company: companyId }).session(session);
            if (!existingBill) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Purchase not found'
                });
            }

            // Check if stock is used
            let isStockUsed = false;
            for (const existingItem of existingBill.items) {
                const product = await Item.findById(existingItem.item).session(session);
                if (!product) continue;

                const stockEntry = product.stockEntries.find(entry =>
                    entry.batchNumber === existingItem.batchNumber &&
                    new Date(entry.date).toDateString() === new Date(existingBill.date).toDateString() &&
                    entry.uniqueUuId === existingItem.uniqueUuId
                );

                if (!stockEntry || stockEntry.quantity < existingItem.quantity * (existingItem.WSUnit || 1)) {
                    isStockUsed = true;
                    break;
                }
            }

            if (isStockUsed) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Could not edit, Stock is used!'
                });
            }

            // Process stock updates - FIRST COLLECT ALL UPDATES, THEN APPLY THEM
            const productUpdates = new Map();

            // Process existing items to reverse stock
            for (const existingItem of existingBill.items) {
                const product = await Item.findById(existingItem.item).session(session);
                if (!product) continue;

                const stockEntryIndex = product.stockEntries.findIndex(entry =>
                    entry.batchNumber === existingItem.batchNumber &&
                    entry.uniqueUuId === existingItem.uniqueUuId
                );

                if (stockEntryIndex !== -1) {
                    const stockEntry = product.stockEntries[stockEntryIndex];
                    const convertedQuantity = existingItem.quantity * (existingItem.WSUnit || 1);
                    const convertedBonus = (existingItem.bonus || 0) * (existingItem.WSUnit || 1);

                    // Track the reverse update
                    if (!productUpdates.has(product._id.toString())) {
                        productUpdates.set(product._id.toString(), {
                            product,
                            stockDelta: 0,
                            entriesToRemove: [],
                            entriesToUpdate: []
                        });
                    }

                    const update = productUpdates.get(product._id.toString());
                    update.stockDelta -= (convertedQuantity + convertedBonus);
                    update.entriesToRemove.push(stockEntryIndex);
                }
            }

            // Process removed items
            const removedItems = existingBill.items.filter(existingItem => {
                return !items.some(item =>
                    item.item === existingItem.item.toString() &&
                    item.uniqueUuId === existingItem.uniqueUuId
                );
            });

            for (const removedItem of removedItems) {
                const product = await Item.findById(removedItem.item).session(session);
                if (!product) continue;

                const stockEntryIndex = product.stockEntries.findIndex(entry =>
                    entry.batchNumber === removedItem.batchNumber &&
                    entry.uniqueUuId === removedItem.uniqueUuId
                );

                if (stockEntryIndex !== -1) {
                    if (!productUpdates.has(product._id.toString())) {
                        productUpdates.set(product._id.toString(), {
                            product,
                            stockDelta: 0,
                            entriesToRemove: [],
                            entriesToUpdate: []
                        });
                    }

                    const update = productUpdates.get(product._id.toString());
                    const stockEntry = product.stockEntries[stockEntryIndex];
                    update.stockDelta -= (stockEntry.quantity + stockEntry.bonus);
                    update.entriesToRemove.push(stockEntryIndex);
                }
            }

            // Apply all reverse stock updates
            for (const [productId, update] of productUpdates) {
                // Remove entries in reverse order to avoid index issues
                update.entriesToRemove.sort((a, b) => b - a).forEach(index => {
                    update.product.stockEntries.splice(index, 1);
                });

                // Update stock
                update.product.stock += update.stockDelta;

                // Save the product
                await update.product.save({ session });
            }

            // Clear the existing bill items
            existingBill.items = [];

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';

            // Update bill with frontend-calculated values
            existingBill.account = accountId;
            existingBill.isVatExempt = isVatExemptBool;
            existingBill.vatPercentage = isVatExemptBool ? 0 : vatPercentage;
            existingBill.partyBillNumber = partyBillNumber;
            existingBill.subTotal = parseFloat(subTotal);
            existingBill.discountPercentage = parseFloat(discountPercentage) || 0;
            existingBill.discountAmount = (parseFloat(subTotal) * parseFloat(discountPercentage)) / 100 || 0;
            existingBill.nonVatSales = parseFloat(nonTaxableAmount);
            existingBill.taxableAmount = parseFloat(taxableAmount);
            existingBill.vatAmount = parseFloat(vatAmount);
            existingBill.isVatAll = isVatAll;
            existingBill.totalAmount = parseFloat(totalAmount);
            existingBill.roundOffAmount = parseFloat(roundOffAmount) || 0;
            existingBill.paymentMode = paymentMode;
            existingBill.totalCCAmount = parseFloat(totalCCAmount) || 0;
            existingBill.date = nepaliDate ? nepaliDate : new Date(billDate);
            existingBill.transactionDate = transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman);

            // Delete associated transactions
            await Transaction.deleteMany({ purchaseBillId: billId }).session(session);

            // Reset product updates map for adding new items
            productUpdates.clear();

            // Process items and add new stock - COLLECT ALL UPDATES FIRST
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);
                if (!product) {
                    req.flash('error', `Item with id ${item.item} not found`);
                    await session.abortTransaction();
                    return res.redirect('/purchase-bills');
                }

                // Calculate converted quantities
                const WSUnit = item.WSUnit || 1;
                const convertedQuantity = item.quantity * WSUnit;
                const convertedBonus = (item.bonus || 0) * WSUnit;
                const totalQuantity = convertedQuantity + convertedBonus;

                // Calculate purchase price per unit (including bonus)
                let calculatedPuPrice = 0;
                if (totalQuantity > 0) {
                    calculatedPuPrice = (item.puPrice * item.quantity) / totalQuantity;
                } else {
                    calculatedPuPrice = item.puPrice;
                }
                const puPriceWithOutBonus = item.puPrice * item.quantity;

                const mrpForStock = item.currency === 'INR' ? item.mrp * 1.6 : item.mrp;

                // Prepare stock entry
                const stockEntry = {
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    WSUnit: WSUnit,
                    quantity: totalQuantity,
                    bonus: convertedBonus,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    price: item.price !== undefined ? item.price / WSUnit : undefined,
                    puPrice: puPriceWithOutBonus / convertedQuantity || 0,
                    mainUnitPuPrice: item.puPrice || 0,
                    mrp: mrpForStock !== undefined ? mrpForStock / WSUnit : undefined,
                    marginPercentage: item.marginPercentage,
                    currency: item.currency,
                    purchaseBillId: existingBill._id,
                    uniqueUuId: item.uniqueUuId,
                    fiscalYear: currentFiscalYear
                };

                // Add to product updates
                if (!productUpdates.has(product._id.toString())) {
                    productUpdates.set(product._id.toString(), {
                        product,
                        stockDelta: 0,
                        entriesToAdd: []
                    });
                }

                const update = productUpdates.get(product._id.toString());
                update.stockDelta += totalQuantity;
                update.entriesToAdd.push(stockEntry);

                // Add to bill items
                existingBill.items.push({
                    item: product._id,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    WSUnit: WSUnit,
                    quantity: item.quantity,
                    Altbonus: item.bonus || 0,
                    Altquantity: item.quantity,
                    Altprice: item.price,
                    AltpuPrice: item.puPrice || 0,
                    bonus: item.bonus || 0,
                    price: item.price,
                    puPrice: item.puPrice || 0,
                    mrp: item.mrp,
                    marginPercentage: item.marginPercentage,
                    currency: item.currency,
                    unit: item.unit,
                    vatStatus: product.vatStatus,
                    uniqueUuId: item.uniqueUuId || uuidv4()
                });
            }

            // APPLY ALL PRODUCT UPDATES (AVOIDS VERSION CONFLICTS)
            for (const [productId, update] of productUpdates) {
                // Use atomic operations to avoid version conflicts
                await Item.findByIdAndUpdate(
                    productId,
                    {
                        $push: { stockEntries: { $each: update.entriesToAdd } },
                        $inc: { stock: update.stockDelta }
                    },
                    { session }
                );
            }

            // Create transactions
            // 1. Party account transaction
            const partyTransaction = new Transaction({
                account: accountId,
                billNumber: existingBill.billNumber,
                partyBillNumber: existingBill.partyBillNumber,
                type: 'Purc',
                purchaseBillId: existingBill._id,
                purchaseSalesType: 'Purchase',
                debit: 0,
                credit: existingBill.totalAmount,
                paymentMode: paymentMode,
                balance: 0,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });
            await partyTransaction.save({ session });

            // 2. Purchase account transaction
            const purchaseAccount = await Account.findOne({ name: 'Purchase', company: companyId }).session(session);
            if (purchaseAccount) {
                const purchaseAmount = taxableAmount + nonTaxableAmount;
                const purchaseTransaction = new Transaction({
                    account: purchaseAccount._id,
                    billNumber: existingBill.billNumber,
                    partyBillNumber: existingBill.partyBillNumber,
                    type: 'Purc',
                    purchaseBillId: existingBill._id,
                    purchaseSalesType: accounts.name,
                    debit: purchaseAmount,
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: 0,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await purchaseTransaction.save({ session });
            }

            // 3. VAT transaction if applicable
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: existingBill.billNumber,
                        partyBillNumber: existingBill.partyBillNumber,
                        isType: 'VAT',
                        type: 'Purc',
                        purchaseBillId: existingBill._id,
                        purchaseSalesType: accounts.name,
                        debit: vatAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save({ session });
                }
            }

            // 4. Round-off transaction if applicable
            if (roundOffAmount !== 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: existingBill.billNumber,
                        partyBillNumber: existingBill.partyBillNumber,
                        isType: 'RoundOff',
                        type: 'Purc',
                        purchaseBillId: existingBill._id,
                        purchaseSalesType: accounts.name,
                        debit: roundOffAmount > 0 ? roundOffAmount : 0,
                        credit: roundOffAmount < 0 ? Math.abs(roundOffAmount) : 0,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                }
            }

            // 5. Cash transaction if payment mode is cash
            if (paymentMode === 'cash') {
                const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashAccount) {
                    const cashTransaction = new Transaction({
                        account: cashAccount._id,
                        billNumber: existingBill.billNumber,
                        partyBillNumber: existingBill.partyBillNumber,
                        isType: 'Purc',
                        type: 'Purc',
                        purchaseBillId: existingBill._id,
                        purchaseSalesType: 'Purchase',
                        debit: 0,
                        credit: totalAmount,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await cashTransaction.save({ session });
                }
            }

            await existingBill.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(200).json({
                success: true,
                message: 'Purchase updated successfully',
                data: {
                    billId: existingBill._id,
                    billNumber: existingBill.billNumber,
                    print: req.query.print === 'true'
                }
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Error during edit:', error);
            return res.status(500).json({
                success: false,
                error: 'An error occurred while processing your request',
                details: error.message
            });
        }
    }
});

router.get('/purchase/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

            const purchaseBillId = req.params.id;
            const bill = await PurchaseBill.findById(purchaseBillId)
                .populate({ path: 'account', select: 'name pan address email phone openingBalance' })
                .populate('items.item')
                .populate('user');

            if (!bill) {
                return res.status(404).json({
                    success: false,
                    error: 'Bill not found'
                });
            }

            // Populate unit for each item in the bill
            for (const item of bill.items) {
                await item.item.populate('unit');
            }

            const firstBill = !bill.firstPrinted;
            if (firstBill) {
                bill.firstPrinted = true;
                await bill.save();
            }

            let finalBalance = null;
            let balanceLabel = '';

            // Fetch the latest transaction for the current company and bill
            if (bill.paymentMode === 'credit') {
                const latestTransaction = await Transaction.findOne({
                    company: new ObjectId(companyId),
                    purchaseBillId: new ObjectId(purchaseBillId)
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
                    firstBill,
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
            console.error("Error fetching bill for printing:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching bill for printing',
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


router.get('/purchase-vat-report', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const companyId = req.session.currentCompany;
        const currentCompany = await Company.findById(new ObjectId(companyId));
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : '';

        // Extract dates from query parameters
        let fromDate = req.query.fromDate ? req.query.fromDate : null;
        let toDate = req.query.toDate ? req.query.toDate : null;

        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

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
                    purchaseVatReport: [],
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName: req.session.currentCompanyName,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'Purchase VAT Report',
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

        const Bills = await PurchaseBill.find(query).populate('account').sort({ date: 1 });

        // Prepare VAT report data
        const purchaseVatReport = await Promise.all(Bills.map(async bill => {
            const account = await Account.findById(bill.account);
            return {
                billNumber: bill.billNumber,
                partyBillNumber: bill.partyBillNumber,
                date: bill.date,
                account: account.name,
                panNumber: account.pan,
                totalAmount: bill.totalAmount,
                discountAmount: bill.discountAmount,
                nonVatPurchase: bill.nonVatPurchase,
                taxableAmount: bill.taxableAmount,
                vatAmount: bill.vatAmount,
            };
        }));

        res.json({
            success: true,
            data: {
                company,
                currentFiscalYear,
                purchaseVatReport,
                companyDateFormat,
                nepaliDate,
                currentCompany,
                fromDate: req.query.fromDate,
                toDate: req.query.toDate,
                currentCompanyName: req.session.currentCompanyName,
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            },
            meta: {
                title: 'Purchase VAT Report',
                theme: req.user.preferences?.theme || 'light'
            }
        });

    } catch (error) {
        console.error('Error in purchase-vat-report:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;