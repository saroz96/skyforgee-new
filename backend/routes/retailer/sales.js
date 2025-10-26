const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require("../../middleware/auth");
const { ensureTradeType } = require("../../middleware/tradeType");
const Account = require("../../models/retailer/Account");
const Item = require("../../models/retailer/Item");
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
const itemsCompany = require('../../models/retailer/itemsCompany');
const Unit = require('../../models/retailer/Unit');
const Composition = require('../../models/retailer/Composition')
const MainUnit = require('../../models/retailer/MainUnit');
const Category = require('../../models/retailer/Category');
const SalesBill = require('../../models/retailer/SalesBill');
const PurchaseBill = require('../../models/retailer/PurchaseBill');
const SalesReturn = require('../../models/retailer/SalesReturn');
const PurchaseReturn = require('../../models/retailer/PurchaseReturns');
const Payment = require('../../models/retailer/Payment');
const Receipt = require('../../models/retailer/Receipt');
const JournalVoucher = require('../../models/retailer/JournalVoucher');
const DebitNote = require('../../models/retailer/DebitNote');
const CreditNote = require('../../models/retailer/CreditNote');
const checkCreditLimit = require('../../middleware/checkCreditLimit');


// Credit Sales routes
router.get('/credit-sales', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            bills,
            items,
            lastCounter,
            fiscalYears,
            categories,
            units,
            itemsCompanies,
            composition,
            mainUnits,
            companyGroups
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            SalesBill.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            Item.find({ company: companyId, status: 'active' }).populate('category').populate('unit').populate('mainUnit').populate('stockEntries'),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'sales'
            }),
            FiscalYear.findById(req.session.currentFiscalYear?.id),
            Category.find({ company: companyId }),
            Unit.find({ company: companyId }),
            itemsCompany.find({ company: companyId }),
            Composition.find({ company: companyId }),
            MainUnit.find({ company: companyId }),
            CompanyGroup.find({ company: companyId })
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
        const prefix = fiscalYears.billPrefixes.sales;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        // Fetch only the required company groups: Sundry Debtors
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
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    vatEnabled: company.vatEnabled,
                    fiscalYear: company.fiscalYear
                },
                items: itemsWithStock,
                accounts,
                salesBills: bills.map(bill => ({
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
                nextSalesBillNumber: nextBillNumber,
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
                itemsCompanies: itemsCompanies.map(ic => ({
                    _id: ic._id,
                    name: ic.name
                })),
                compositions: composition.map(comp => ({
                    _id: comp._id,
                    name: comp.name
                })),
                mainUnits: mainUnits.map(mu => ({
                    _id: mu._id,
                    name: mu.name
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
        console.error('Error in /credit-sales route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Fetch all sales bills
router.get('/sales-register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
                        currentCompany: currentCompany,
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

            const bills = await SalesBill.find(query)
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
        console.error('Error fetching sales bills:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// router.post('/credit-sales', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, checkCreditLimit, async (req, res) => {
//     if (req.tradeType !== 'retailer') {
//         return res.status(403).json({
//             success: false,
//             error: 'Access forbidden for this trade type'
//         });
//     }

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const {
//             accountId,
//             items,
//             vatPercentage,
//             transactionDateRoman,
//             transactionDateNepali,
//             billDate,
//             nepaliDate,
//             isVatExempt,
//             discountPercentage,
//             paymentMode,
//             roundOffAmount: manualRoundOffAmount,
//         } = req.body;

//         const companyId = req.session.currentCompany;
//         const currentFiscalYear = req.session.currentFiscalYear.id;
//         const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
//         const userId = req.user._id;

//         // Validation checks
//         if (!companyId) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(400).json({
//                 success: false,
//                 error: 'Company ID is required.'
//             });
//         }
//         if (!isVatExempt) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(400).json({
//                 success: false,
//                 error: 'Invalid vat selection.'
//             });
//         }
//         if (!paymentMode) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(400).json({
//                 success: false,
//                 error: 'Invalid payment mode.'
//             });
//         }

//         const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
//         const isVatAll = isVatExempt === 'all';
//         const discount = parseFloat(discountPercentage) || 0;

//         let subTotal = 0;
//         let vatAmount = 0;
//         let totalTaxableAmount = 0;
//         let totalNonTaxableAmount = 0;
//         let hasVatableItems = false;
//         let hasNonVatableItems = false;

//         const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
//         if (!accounts) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(400).json({
//                 success: false,
//                 error: 'Invalid account for this company'
//             });
//         }

//         // Validate items and calculate amounts
//         for (let i = 0; i < items.length; i++) {
//             const item = items[i];
//             const product = await Item.findById(item.item).session(session);

//             if (!product) {
//                 await session.abortTransaction();
//                 session.endSession();
//                 return res.status(404).json({
//                     success: false,
//                     error: `Item with id ${item.item} not found`
//                 });
//             }

//             const itemTotal = parseFloat(item.price) * parseFloat(item.quantity, 10);
//             subTotal += itemTotal;

//             if (product.vatStatus === 'vatable') {
//                 hasVatableItems = true;
//                 totalTaxableAmount += itemTotal;
//             } else {
//                 hasNonVatableItems = true;
//                 totalNonTaxableAmount += itemTotal;
//             }

//             const availableStock = product.stockEntries.reduce((acc, entry) => acc + entry.quantity, 0);
//             if (availableStock < item.quantity) {
//                 await session.abortTransaction();
//                 session.endSession();
//                 return res.status(400).json({
//                     success: false,
//                     error: `Not enough stock for item: ${product.name}. Available: ${availableStock}, Required: ${item.quantity}`
//                 });
//             }
//         }

//         // VAT validation
//         if (isVatExempt !== 'all') {
//             if (isVatExemptBool && hasVatableItems) {
//                 await session.abortTransaction();
//                 session.endSession();
//                 return res.status(400).json({
//                     success: false,
//                     error: 'Cannot save VAT exempt bill with vatable items'
//                 });
//             }

//             if (!isVatExemptBool && hasNonVatableItems) {
//                 await session.abortTransaction();
//                 session.endSession();
//                 return res.status(400).json({
//                     success: false,
//                     error: 'Cannot save bill with non-vatable items when VAT is applied'
//                 });
//             }
//         }

//         // Calculate amounts
//         const discountForTaxable = (totalTaxableAmount * discount) / 100;
//         const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

//         const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
//         const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

//         if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
//             vatAmount = (finalTaxableAmount * vatPercentage) / 100;
//         } else {
//             vatAmount = 0;
//         }

//         let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
//         let finalAmount = totalAmount;

//         // Round off handling
//         let roundOffForSales = await Settings.findOne({
//             company: companyId,
//             userId,
//             fiscalYear: currentFiscalYear
//         }).session(session);

//         if (!roundOffForSales) {
//             roundOffForSales = { roundOffSales: false };
//         }

//         let roundOffAmount = 0;
//         if (roundOffForSales.roundOffSales) {
//             finalAmount = Math.round(finalAmount.toFixed(2));
//             roundOffAmount = finalAmount - totalAmount;
//         } else if (manualRoundOffAmount && !roundOffForSales.roundOffSales) {
//             roundOffAmount = parseFloat(manualRoundOffAmount);
//             finalAmount = totalAmount + roundOffAmount;
//         }

//         // Create bill number
//         const newBillNumber = await getNextBillNumber(companyId, fiscalYearId, 'sales', session);

//         // Create new bill
//         const newBill = new SalesBill({
//             billNumber: newBillNumber,
//             account: accountId,
//             purchaseSalesType: 'Sales',
//             items: [],
//             isVatExempt: isVatExemptBool,
//             isVatAll,
//             vatPercentage: isVatExemptBool ? 0 : vatPercentage,
//             subTotal,
//             discountPercentage: discount,
//             discountAmount: discountForTaxable + discountForNonTaxable,
//             nonVatSales: finalNonTaxableAmount,
//             taxableAmount: finalTaxableAmount,
//             vatAmount,
//             totalAmount: finalAmount,
//             roundOffAmount: roundOffAmount,
//             paymentMode,
//             date: nepaliDate ? nepaliDate : new Date(billDate),
//             transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
//             company: companyId,
//             user: userId,
//             fiscalYear: currentFiscalYear
//         });

//         // Get previous balance
//         let previousBalance = 0;
//         const accountTransaction = await Transaction.findOne({ account: accountId }).sort({ transactionDate: -1 }).session(session);
//         if (accountTransaction) {
//             previousBalance = accountTransaction.balance;
//         }

//         // Group items by (product, batchNumber)
//         const groupedItems = {};
//         for (const item of items) {
//             const key = `${item.item}-${item.batchNumber || 'N/A'}`;
//             if (!groupedItems[key]) {
//                 groupedItems[key] = { ...item, quantity: 0 };
//             }
//             groupedItems[key].quantity += Number(item.quantity);
//         }

//         // Stock reduction function
//         async function reduceStock(product, quantity) {
//             product.stock -= quantity;
//             let remainingQuantity = quantity;
//             const batchesUsed = [];

//             product.stockEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

//             for (let i = 0; i < product.stockEntries.length && remainingQuantity > 0; i++) {
//                 let entry = product.stockEntries[i];
//                 const quantityUsed = Math.min(entry.quantity, remainingQuantity);
//                 batchesUsed.push({
//                     batchNumber: entry.batchNumber,
//                     quantity: quantityUsed,
//                     uniqueUuId: entry.uniqueUuId,
//                 });

//                 remainingQuantity -= quantityUsed;
//                 entry.quantity -= quantityUsed;
//             }

//             product.stockEntries = product.stockEntries.filter(entry => entry.quantity > 0);
//             await product.save({ session });

//             if (remainingQuantity > 0) {
//                 throw new Error(`Not enough stock for item: ${product.name}. Required: ${quantity}, Available: ${quantity - remainingQuantity}`);
//             }

//             return batchesUsed;
//         }

//         // Process stock reduction
//         const billItems = [];
//         const transactions = [];

//         for (const item of items) {
//             const product = await Item.findById(item.item).session(session);
//             const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
//             const itemDiscountPercentage = discount;
//             const itemDiscountAmount = (itemTotal * discount) / 100;
//             const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

//             const batchesUsed = await reduceStock(product, item.quantity);

//             const itemsForBill = batchesUsed.map(batch => ({
//                 item: product._id,
//                 quantity: batch.quantity,
//                 price: item.price,
//                 netPrice: netPrice,
//                 puPrice: item.puPrice,
//                 netPuPrice: item.netPuPrice,
//                 discountPercentagePerItem: itemDiscountPercentage,
//                 discountAmountPerItem: itemDiscountAmount,
//                 unit: item.unit,
//                 batchNumber: batch.batchNumber,
//                 expiryDate: item.expiryDate,
//                 vatStatus: product.vatStatus,
//                 fiscalYear: fiscalYearId,
//                 uniqueUuId: batch.uniqueUuId
//             }));

//             billItems.push(...itemsForBill);
//         }

//         // Create transactions for items
//         for (let i = 0; i < items.length; i++) {
//             const item = items[i];
//             const product = await Item.findById(item.item).session(session);
//             const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
//             const itemDiscountPercentage = discount;
//             const itemDiscountAmount = (itemTotal * discount) / 100;
//             const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

//             const transaction = new Transaction({
//                 item: product,
//                 unit: item.unit,
//                 WSUnit: item.WSUnit,
//                 price: item.price,
//                 puPrice: item.puPrice,
//                 netPuPrice: item.netPuPrice,
//                 discountPercentagePerItem: itemDiscountPercentage,
//                 discountAmountPerItem: itemDiscountAmount,
//                 netPrice: netPrice,
//                 quantity: item.quantity,
//                 account: accountId,
//                 billNumber: newBillNumber,
//                 isType: 'Sale',
//                 type: 'Sale',
//                 billId: newBill._id,
//                 purchaseSalesType: 'Sales',
//                 debit: finalAmount,
//                 credit: 0,
//                 paymentMode: paymentMode,
//                 balance: previousBalance - finalAmount,
//                 date: nepaliDate ? nepaliDate : new Date(billDate),
//                 company: companyId,
//                 user: userId,
//                 fiscalYear: currentFiscalYear
//             });
//             await transaction.save({ session });
//             transactions.push(transaction);
//         }

//         // Flatten bill items
//         const flattenedBillItems = billItems.flat();

//         // Create sales account transaction
//         const salesAmount = finalTaxableAmount + finalNonTaxableAmount;
//         if (salesAmount > 0) {
//             const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
//             if (salesAccount) {
//                 const partyAccount = await Account.findById(accountId).session(session);
//                 if (!partyAccount) {
//                     await session.abortTransaction();
//                     session.endSession();
//                     return res.status(400).json({
//                         success: false,
//                         error: 'Party account not found.'
//                     });
//                 }
//                 const salesTransaction = new Transaction({
//                     account: salesAccount._id,
//                     billNumber: newBillNumber,
//                     type: 'Sale',
//                     billId: newBill._id,
//                     purchaseSalesType: partyAccount.name,
//                     debit: 0,
//                     credit: salesAmount,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + salesAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     company: companyId,
//                     user: userId,
//                     fiscalYear: currentFiscalYear
//                 });
//                 await salesTransaction.save({ session });
//             }
//         }

//         // Create VAT transaction
//         if (vatAmount > 0) {
//             const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
//             if (vatAccount) {
//                 const partyAccount = await Account.findById(accountId).session(session);
//                 if (!partyAccount) {
//                     await session.abortTransaction();
//                     session.endSession();
//                     return res.status(400).json({
//                         success: false,
//                         error: 'Party account not found.'
//                     });
//                 }
//                 const vatTransaction = new Transaction({
//                     account: vatAccount._id,
//                     billNumber: newBillNumber,
//                     isType: 'VAT',
//                     type: 'Sale',
//                     billId: newBill._id,
//                     purchaseSalesType: partyAccount.name,
//                     debit: 0,
//                     credit: vatAmount,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + vatAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     company: companyId,
//                     user: userId,
//                     fiscalYear: currentFiscalYear
//                 });
//                 await vatTransaction.save({ session });
//             }
//         }

//         // Create round-off transactions
//         if (roundOffAmount > 0) {
//             const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
//             if (roundOffAccount) {
//                 const partyAccount = await Account.findById(accountId).session(session);
//                 if (!partyAccount) {
//                     await session.abortTransaction();
//                     session.endSession();
//                     return res.status(400).json({
//                         success: false,
//                         error: 'Party account not found.'
//                     });
//                 }
//                 const roundOffTransaction = new Transaction({
//                     account: roundOffAccount._id,
//                     billNumber: newBillNumber,
//                     isType: 'RoundOff',
//                     type: 'Sale',
//                     billId: newBill._id,
//                     purchaseSalesType: partyAccount.name,
//                     debit: 0,
//                     credit: roundOffAmount,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + roundOffAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     company: companyId,
//                     user: userId,
//                     fiscalYear: currentFiscalYear
//                 });
//                 await roundOffTransaction.save({ session });
//             }
//         }

//         if (roundOffAmount < 0) {
//             const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
//             if (roundOffAccount) {
//                 const partyAccount = await Account.findById(accountId).session(session);
//                 if (!partyAccount) {
//                     await session.abortTransaction();
//                     session.endSession();
//                     return res.status(400).json({
//                         success: false,
//                         error: 'Party account not found.'
//                     });
//                 }
//                 const roundOffTransaction = new Transaction({
//                     account: roundOffAccount._id,
//                     billNumber: newBillNumber,
//                     isType: 'RoundOff',
//                     type: 'Sale',
//                     billId: newBill._id,
//                     purchaseSalesType: partyAccount.name,
//                     debit: Math.abs(roundOffAmount),
//                     credit: 0,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + roundOffAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     company: companyId,
//                     user: userId,
//                     fiscalYear: currentFiscalYear
//                 });
//                 await roundOffTransaction.save({ session });
//             }
//         }

//         // Cash payment handling
//         if (paymentMode === 'cash') {
//             const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
//             if (cashAccount) {
//                 const cashTransaction = new Transaction({
//                     account: cashAccount._id,
//                     billNumber: newBillNumber,
//                     isType: 'Sale',
//                     type: 'Sale',
//                     billId: newBill._id,
//                     purchaseSalesType: 'Sales',
//                     debit: finalAmount,
//                     credit: 0,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + finalAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     company: companyId,
//                     user: userId,
//                     fiscalYear: currentFiscalYear
//                 });
//                 await cashTransaction.save({ session });
//             }
//         }

//         // Update bill with items
//         newBill.items = flattenedBillItems;
//         await newBill.save({ session });

//         // Commit transaction
//         await session.commitTransaction();
//         session.endSession();

//         // Prepare response
//         const response = {
//             success: true,
//             message: 'Bill created successfully',
//             bill: {
//                 _id: newBill._id,
//                 billNumber: newBill.billNumber,
//                 account: newBill.account,
//                 totalAmount: newBill.totalAmount,
//                 date: newBill.date,
//                 transactionDate: newBill.transactionDate,
//                 items: newBill.items.map(item => ({
//                     item: item.item,
//                     quantity: item.quantity,
//                     price: item.price,
//                     batchNumber: item.batchNumber
//                 })),
//                 vatAmount: newBill.vatAmount,
//                 discountAmount: newBill.discountAmount,
//                 roundOffAmount: newBill.roundOffAmount,
//                 paymentMode: newBill.paymentMode
//             },
//             printUrl: `/bills/${newBill._id}/direct-print`
//         };

//         if (req.query.print === 'true') {
//             response.redirect = `/bills/${newBill._id}/direct-print`;
//             return res.json(response);
//         }

//         return res.json(response);

//     } catch (error) {
//         await session.abortTransaction();
//         session.endSession();
//         console.error('Error while creating sales bill:', error);
//         return res.status(500).json({
//             success: false,
//             error: 'An error occurred while processing the bill.',
//             details: error.message
//         });
//     }
// });

router.post('/credit-sales', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, checkCreditLimit, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access forbidden for this trade type'
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Destructure all required fields including calculated values from frontend
        const {
            accountId,
            items,
            vatPercentage,
            transactionDateNepali,
            transactionDateRoman,
            billDate,
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
            totalAmount
        } = req.body;

        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        // Validation checks
        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Company ID is required.'
            });
        }
        if (!isVatExempt) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid VAT selection.'
            });
        }
        if (!paymentMode) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid payment mode.'
            });
        }

        const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
        const isVatAll = isVatExempt === 'all';

        // Validate account exists
        const account = await Account.findOne({ _id: accountId, company: companyId }).session(session);
        if (!account) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid account for this company'
            });
        }

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'At least one item is required.'
            });
        }

        // Validate calculated amounts are numbers
        if (isNaN(parseFloat(subTotal)) || isNaN(parseFloat(taxableAmount)) ||
            isNaN(parseFloat(nonTaxableAmount)) || isNaN(parseFloat(totalAmount))) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid calculated amounts'
            });
        }

        // Validate stock availability for each item
        let hasVatableItems = false;
        let hasNonVatableItems = false;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);

            if (!product) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    error: `Item with id ${item.item} not found`
                });
            }

            // Track VAT status for validation
            if (product.vatStatus === 'vatable') {
                hasVatableItems = true;
            } else {
                hasNonVatableItems = true;
            }

            const availableStock = product.stockEntries.reduce((acc, entry) => acc + entry.quantity, 0);
            if (availableStock < item.quantity) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: `Not enough stock for item: ${product.name}. Available: ${availableStock}, Required: ${item.quantity}`
                });
            }
        }

        // VAT validation
        if (isVatExempt !== 'all') {
            if (isVatExemptBool && hasVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot save VAT exempt bill with vatable items'
                });
            }

            if (!isVatExemptBool && hasNonVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot save bill with non-vatable items when VAT is applied'
                });
            }
        }

        // Get next bill number
        const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'sales', session);

        // Create new sales bill with frontend-calculated values
        const newBill = new SalesBill({
            billNumber: billNumber,
            account: accountId,
            purchaseSalesType: 'Sales',
            items: [],
            isVatExempt: isVatExemptBool,
            isVatAll,
            vatPercentage: isVatExemptBool ? 0 : vatPercentage,
            subTotal: parseFloat(subTotal),
            discountPercentage: parseFloat(discountPercentage) || 0,
            discountAmount: parseFloat(discountAmount) || 0,
            nonVatSales: parseFloat(nonTaxableAmount),
            taxableAmount: parseFloat(taxableAmount),
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

        // Stock reduction function
        async function reduceStock(product, quantity) {
            product.stock -= quantity;
            let remainingQuantity = quantity;
            const batchesUsed = [];

            product.stockEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

            for (let i = 0; i < product.stockEntries.length && remainingQuantity > 0; i++) {
                let entry = product.stockEntries[i];
                const quantityUsed = Math.min(entry.quantity, remainingQuantity);
                batchesUsed.push({
                    batchNumber: entry.batchNumber,
                    quantity: quantityUsed,
                    uniqueUuId: entry.uniqueUuId,
                });

                remainingQuantity -= quantityUsed;
                entry.quantity -= quantityUsed;
            }

            product.stockEntries = product.stockEntries.filter(entry => entry.quantity > 0);
            await product.save({ session });

            if (remainingQuantity > 0) {
                throw new Error(`Not enough stock for item: ${product.name}. Required: ${quantity}, Available: ${quantity - remainingQuantity}`);
            }

            return batchesUsed;
        }

        // Process items and reduce stock
        const billItems = [];
        const transactions = [];

        for (const item of items) {
            const product = await Item.findById(item.item).session(session);

            // Reduce stock
            const batchesUsed = await reduceStock(product, item.quantity);

            const itemsForBill = batchesUsed.map(batch => ({
                item: product._id,
                quantity: batch.quantity,
                price: item.price,
                netPrice: item.price - (item.price * (discountPercentage || 0) / 100),
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: discountPercentage || 0,
                discountAmountPerItem: (item.price * item.quantity * (discountPercentage || 0)) / 100,
                unit: item.unit,
                batchNumber: batch.batchNumber,
                expiryDate: item.expiryDate,
                vatStatus: product.vatStatus,
                fiscalYear: fiscalYearId,
                uniqueUuId: batch.uniqueUuId
            }));

            billItems.push(...itemsForBill);

            // Create item transaction
            const transaction = new Transaction({
                item: product,
                unit: item.unit,
                WSUnit: item.WSUnit,
                price: item.price,
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: discountPercentage || 0,
                discountAmountPerItem: (item.price * item.quantity * (discountPercentage || 0)) / 100,
                netPrice: item.price - (item.price * (discountPercentage || 0) / 100),
                quantity: item.quantity,
                account: accountId,
                billNumber: billNumber,
                isType: 'Sale',
                type: 'Sale',
                billId: newBill._id,
                purchaseSalesType: 'Sales',
                debit: totalAmount,
                credit: 0,
                paymentMode: paymentMode,
                balance: previousBalance - totalAmount,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });
            await transaction.save({ session });
            transactions.push(transaction);
        }

        // Update bill with items
        newBill.items = billItems.flat();

        // Create sales account transaction
        const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
        if (salesAccount) {
            const salesTransaction = new Transaction({
                account: salesAccount._id,
                billNumber: billNumber,
                type: 'Sale',
                billId: newBill._id,
                purchaseSalesType: account.name,
                debit: 0,
                credit: parseFloat(taxableAmount) + parseFloat(nonTaxableAmount),
                paymentMode: paymentMode,
                balance: previousBalance + (parseFloat(taxableAmount) + parseFloat(nonTaxableAmount)),
                date: nepaliDate ? nepaliDate : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });
            await salesTransaction.save({ session });
        }

        // Create VAT transaction if applicable
        if (vatAmount > 0) {
            const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
            if (vatAccount) {
                const vatTransaction = new Transaction({
                    account: vatAccount._id,
                    billNumber: billNumber,
                    isType: 'VAT',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: account.name,
                    debit: 0,
                    credit: parseFloat(vatAmount),
                    paymentMode: paymentMode,
                    balance: previousBalance + parseFloat(vatAmount),
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await vatTransaction.save({ session });
            }
        }

        // Create round-off transaction if applicable
        if (roundOffAmount !== 0) {
            const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
            if (roundOffAccount) {
                const roundOffTransaction = new Transaction({
                    account: roundOffAccount._id,
                    billNumber: billNumber,
                    isType: 'RoundOff',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: account.name,
                    debit: roundOffAmount > 0 ? 0 : Math.abs(roundOffAmount),
                    credit: roundOffAmount > 0 ? roundOffAmount : 0,
                    paymentMode: paymentMode,
                    balance: previousBalance + parseFloat(roundOffAmount),
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await roundOffTransaction.save({ session });
            }
        }

        // Cash payment handling
        if (paymentMode === 'cash') {
            const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
            if (cashAccount) {
                const cashTransaction = new Transaction({
                    account: cashAccount._id,
                    billNumber: billNumber,
                    isType: 'Sale',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: 'Sales',
                    debit: parseFloat(totalAmount),
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: previousBalance + parseFloat(totalAmount),
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
            message: 'Sales bill saved successfully!',
            data: {
                bill: {
                    _id: newBill._id,
                    billNumber: newBill.billNumber,
                    account: newBill.account,
                    totalAmount: newBill.totalAmount,
                    date: newBill.date,
                    transactionDate: newBill.transactionDate,
                    items: newBill.items.map(item => ({
                        item: item.item,
                        quantity: item.quantity,
                        price: item.price,
                        batchNumber: item.batchNumber
                    })),
                    vatAmount: newBill.vatAmount,
                    discountAmount: newBill.discountAmount,
                    roundOffAmount: newBill.roundOffAmount,
                    paymentMode: newBill.paymentMode
                }
            }
        };

        if (req.query.print === 'true') {
            response.redirectUrl = `/bills/${newBill._id}/direct-print`;
        } else {
            response.redirectUrl = '/bills';
        }

        return res.status(200).json(response);

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating sales bill:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating sales bill',
            error: error.message
        });
    }
});


router.get('/credit-sales/open', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const companyId = req.session.currentCompany;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company not selected'
            });
        }

        // Fetch all required data in parallel for better performance
        const [
            company,
            bills,
            items,
            lastCounter,
            fiscalYears,
            categories,
            units,
            companyGroups
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            SalesBill.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            Item.find({ company: companyId, status: 'active' }).populate('category').populate('unit').populate('mainUnit').populate('stockEntries'),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'sales'
            }),
            FiscalYear.findById(req.session.currentFiscalYear?.id),
            Category.find({ company: companyId }),
            Unit.find({ company: companyId }),
            CompanyGroup.find({ company: companyId })
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
                latestStockEntry: latestStockEntry,
                stockEntries: sortedStockEntries // Include all sorted stock entries
            };
        });

        // Calculate next bill number
        const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
        const prefix = fiscalYears.billPrefixes.sales;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        // Fetch only the required company groups: Sundry Debtors
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
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat || 'english',
                    vatEnabled: company.vatEnabled,
                    fiscalYear: company.fiscalYear
                },
                items: itemsWithStock,
                accounts: accounts.map(account => ({
                    _id: account._id,
                    name: account.name,
                    uniqueNumber: account.uniqueNumber,
                    address: account.address,
                    pan: account.pan,
                    companyGroups: account.companyGroups
                })),
                salesBills: bills.map(bill => ({
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
                nextBillNumber,
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
                    name: unit.name,
                    shortName: unit.shortName
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
        console.error('Error in /credit-sales/open route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// router.post('/credit-sales/open', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, checkCreditLimit, async (req, res) => {
//     if (req.tradeType !== 'retailer') {
//         return res.status(403).json({ error: 'Access denied for this trade type' });
//     }

//     const session = await mongoose.startSession();
//     session.startTransaction();
//     try {
//         const {
//             accountId,
//             items,
//             vatPercentage,
//             transactionDateRoman,
//             transactionDateNepali,
//             billDate,
//             nepaliDate,
//             isVatExempt,
//             discountPercentage,
//             paymentMode,
//             roundOffAmount: manualRoundOffAmount,
//         } = req.body;
//         const companyId = req.session.currentCompany;
//         const currentFiscalYear = req.session.currentFiscalYear.id;
//         const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
//         const userId = req.user._id;

//         // Validation checks
//         if (!companyId) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(400).json({ error: 'Company ID is required.' });
//         }
//         if (!isVatExempt) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(400).json({ error: 'Invalid VAT selection.' });
//         }
//         if (!paymentMode) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(400).json({ error: 'Invalid payment mode.' });
//         }

//         const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
//         const isVatAll = isVatExempt === 'all';
//         const discount = parseFloat(discountPercentage) || 0;

//         let subTotal = 0;
//         let vatAmount = 0;
//         let totalTaxableAmount = 0;
//         let totalNonTaxableAmount = 0;
//         let hasVatableItems = false;
//         let hasNonVatableItems = false;

//         // Validate account
//         const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
//         if (!accounts) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(400).json({ error: 'Invalid account for this company' });
//         }

//         // Validate items
//         for (let i = 0; i < items.length; i++) {
//             const item = items[i];
//             const product = await Item.findById(item.item).session(session);

//             if (!product) {
//                 await session.abortTransaction();
//                 session.endSession();
//                 return res.status(404).json({ error: `Item with id ${item.item} not found` });
//             }

//             const itemTotal = parseFloat(item.price) * parseFloat(item.quantity, 10);
//             subTotal += itemTotal;

//             if (product.vatStatus === 'vatable') {
//                 hasVatableItems = true;
//                 totalTaxableAmount += itemTotal;
//             } else {
//                 hasNonVatableItems = true;
//                 totalNonTaxableAmount += itemTotal;
//             }

//             // Validate batch entry
//             const batchEntry = product.stockEntries.find(entry => entry.batchNumber === item.batchNumber && entry.uniqueUuId === item.uniqueUuId);
//             if (!batchEntry) {
//                 await session.abortTransaction();
//                 session.endSession();
//                 return res.status(400).json({ error: `Batch number ${item.batchNumber} not found for item: ${product.name}` });
//             }

//             // Check stock quantity
//             if (batchEntry.quantity < item.quantity) {
//                 await session.abortTransaction();
//                 session.endSession();
//                 return res.status(400).json({
//                     error: `Not enough stock for item: ${product.name}`,
//                     details: {
//                         available: batchEntry.quantity,
//                         required: item.quantity
//                     }
//                 });
//             }
//         }

//         // VAT validation
//         if (isVatExempt !== 'all') {
//             if (isVatExemptBool && hasVatableItems) {
//                 await session.abortTransaction();
//                 session.endSession();
//                 return res.status(400).json({ error: 'Cannot save VAT exempt bill with vatable items' });
//             }

//             if (!isVatExemptBool && hasNonVatableItems) {
//                 await session.abortTransaction();
//                 session.endSession();
//                 return res.status(400).json({ error: 'Cannot save bill with non-vatable items when VAT is applied' });
//             }
//         }

//         const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'sales', session);

//         // Calculate amounts
//         const discountForTaxable = (totalTaxableAmount * discount) / 100;
//         const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

//         const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
//         const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

//         if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
//             vatAmount = (finalTaxableAmount * vatPercentage) / 100;
//         } else {
//             vatAmount = 0;
//         }

//         let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
//         let finalAmount = totalAmount;

//         // Handle round off
//         let roundOffForSales = await Settings.findOne({
//             company: companyId, userId, fiscalYear: currentFiscalYear
//         }).session(session);

//         if (!roundOffForSales) {
//             roundOffForSales = { roundOffSales: false };
//         }

//         let roundOffAmount = 0;
//         if (roundOffForSales.roundOffSales) {
//             finalAmount = Math.round(finalAmount.toFixed(2));
//             roundOffAmount = finalAmount - totalAmount;
//         } else if (manualRoundOffAmount && !roundOffForSales.roundOffSales) {
//             roundOffAmount = parseFloat(manualRoundOffAmount);
//             finalAmount = totalAmount + roundOffAmount;
//         }

//         // Create new bill
//         const newBill = new SalesBill({
//             billNumber: billNumber,
//             account: accountId,
//             purchaseSalesType: 'Sales',
//             items: [],
//             isVatExempt: isVatExemptBool,
//             isVatAll,
//             vatPercentage: isVatExemptBool ? 0 : vatPercentage,
//             subTotal,
//             discountPercentage: discount,
//             discountAmount: discountForTaxable + discountForNonTaxable,
//             nonVatSales: finalNonTaxableAmount,
//             taxableAmount: finalTaxableAmount,
//             vatAmount,
//             totalAmount: finalAmount,
//             roundOffAmount: roundOffAmount,
//             paymentMode,
//             date: nepaliDate ? nepaliDate : new Date(billDate),
//             transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
//             company: companyId,
//             user: userId,
//             fiscalYear: currentFiscalYear
//         });

//         // Stock reduction function
//         async function reduceStockBatchWise(product, batchNumber, quantity, uniqueUuId) {
//             let remainingQuantity = quantity;
//             const batchEntries = product.stockEntries.filter(entry =>
//                 entry.batchNumber === batchNumber &&
//                 entry.uniqueUuId === uniqueUuId
//             );

//             if (batchEntries.length === 0) {
//                 throw new Error(`Batch number ${batchNumber} with ID ${uniqueUuId} not found for product: ${product.name}`);
//             }

//             const selectedBatchEntry = batchEntries[0];
//             if (selectedBatchEntry.quantity <= remainingQuantity) {
//                 remainingQuantity -= selectedBatchEntry.quantity;
//                 selectedBatchEntry.quantity = 0;
//                 product.stockEntries = product.stockEntries.filter(entry =>
//                     !(entry.batchNumber === batchNumber &&
//                         entry.uniqueUuId === uniqueUuId &&
//                         entry.quantity === 0)
//                 );
//             } else {
//                 selectedBatchEntry.quantity -= remainingQuantity;
//                 remainingQuantity = 0;
//             }

//             if (remainingQuantity > 0) {
//                 throw new Error(`Not enough stock in the selected stock entry for batch number ${batchNumber} of product: ${product.name}`);
//             }

//             product.stock = product.stockEntries.reduce((sum, entry) => sum + entry.quantity, 0);
//             await product.save({ session });
//         }

//         // Process items
//         const billItems = [];
//         for (let i = 0; i < items.length; i++) {
//             const item = items[i];
//             const product = await Item.findById(item.item).session(session);

//             if (!product) {
//                 await session.abortTransaction();
//                 session.endSession();
//                 return res.status(404).json({ error: `Item with id ${item.item} not found` });
//             }

//             const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
//             const itemDiscountPercentage = discount;
//             const itemDiscountAmount = (itemTotal * discount) / 100;
//             const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

//             await reduceStockBatchWise(product, item.batchNumber, item.quantity, item.uniqueUuId);
//             product.stock -= item.quantity;
//             await product.save({ session });

//             billItems.push({
//                 item: product._id,
//                 quantity: item.quantity,
//                 price: item.price,
//                 netPrice: netPrice,
//                 puPrice: item.puPrice,
//                 netPuPrice: item.netPuPrice,
//                 discountPercentagePerItem: itemDiscountPercentage,
//                 discountAmountPerItem: itemDiscountAmount,
//                 unit: item.unit,
//                 batchNumber: item.batchNumber,
//                 expiryDate: item.expiryDate,
//                 vatStatus: product.vatStatus,
//                 fiscalYear: fiscalYearId,
//                 uniqueUuId: item.uniqueUuId,
//             });
//         }

//         // Create transactions
//         let previousBalance = 0;
//         const accountTransaction = await Transaction.findOne({ account: accountId }).sort({ transactionDate: -1 }).session(session);
//         if (accountTransaction) {
//             previousBalance = accountTransaction.balance;
//         }

//         const correctTotalAmount = newBill.totalAmount;

//         for (let i = 0; i < items.length; i++) {
//             const item = items[i];
//             const product = await Item.findById(item.item).session(session);
//             if (!product) continue;
//             const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
//             const itemDiscountPercentage = discount;
//             const itemDiscountAmount = (itemTotal * discount) / 100;
//             const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

//             const transaction = new Transaction({
//                 item: product,
//                 account: accountId,
//                 billNumber: billNumber,
//                 quantity: item.quantity,
//                 price: item.price,
//                 puPrice: item.puPrice,
//                 netPuPrice: item.netPuPrice,
//                 discountPercentagePerItem: itemDiscountPercentage,
//                 discountAmountPerItem: itemDiscountAmount,
//                 netPrice: netPrice,
//                 unit: items[0].unit,
//                 isType: 'Sale',
//                 type: 'Sale',
//                 billId: newBill._id,
//                 purchaseSalesType: 'Sales',
//                 debit: correctTotalAmount,
//                 credit: 0,
//                 paymentMode: paymentMode,
//                 balance: previousBalance - correctTotalAmount,
//                 date: nepaliDate ? nepaliDate : new Date(billDate),
//                 company: companyId,
//                 user: userId,
//                 fiscalYear: currentFiscalYear
//             });

//             await transaction.save({ session });
//         }

//         // Sales account transaction
//         const salesAmount = finalTaxableAmount + finalNonTaxableAmount;
//         if (salesAmount > 0) {
//             const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
//             if (salesAccount) {
//                 const partyAccount = await Account.findById(accountId).session(session);
//                 if (!partyAccount) {
//                     await session.abortTransaction();
//                     session.endSession();
//                     return res.status(400).json({ error: 'Party account not found.' });
//                 }
//                 const salesTransaction = new Transaction({
//                     account: salesAccount._id,
//                     billNumber: billNumber,
//                     type: 'Sale',
//                     billId: newBill._id,
//                     purchaseSalesType: partyAccount.name,
//                     debit: 0,
//                     credit: salesAmount,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + salesAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     company: companyId,
//                     user: userId,
//                     fiscalYear: currentFiscalYear
//                 });
//                 await salesTransaction.save({ session });
//             }
//         }

//         // VAT transaction
//         if (vatAmount > 0) {
//             const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
//             if (vatAccount) {
//                 const partyAccount = await Account.findById(accountId).session(session);
//                 if (!partyAccount) {
//                     await session.abortTransaction();
//                     session.endSession();
//                     return res.status(400).json({ error: 'Party account not found.' });
//                 }
//                 const vatTransaction = new Transaction({
//                     account: vatAccount._id,
//                     billNumber: billNumber,
//                     isType: 'VAT',
//                     type: 'Sale',
//                     billId: newBill._id,
//                     purchaseSalesType: partyAccount.name,
//                     debit: 0,
//                     credit: vatAmount,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + vatAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     company: companyId,
//                     user: userId,
//                     fiscalYear: currentFiscalYear
//                 });
//                 await vatTransaction.save({ session });
//             }
//         }

//         // Round-off transactions
//         if (roundOffAmount > 0) {
//             const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
//             if (roundOffAccount) {
//                 const partyAccount = await Account.findById(accountId).session(session);
//                 if (!partyAccount) {
//                     await session.abortTransaction();
//                     session.endSession();
//                     return res.status(400).json({ error: 'Party account not found.' });
//                 }
//                 const roundOffTransaction = new Transaction({
//                     account: roundOffAccount._id,
//                     billNumber: billNumber,
//                     isType: 'RoundOff',
//                     type: 'Sale',
//                     billId: newBill._id,
//                     purchaseSalesType: partyAccount.name,
//                     debit: 0,
//                     credit: roundOffAmount,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + roundOffAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     company: companyId,
//                     user: userId,
//                     fiscalYear: currentFiscalYear
//                 });
//                 await roundOffTransaction.save({ session });
//             }
//         }

//         if (roundOffAmount < 0) {
//             const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
//             if (roundOffAccount) {
//                 const partyAccount = await Account.findById(accountId).session(session);
//                 if (!partyAccount) {
//                     await session.abortTransaction();
//                     session.endSession();
//                     return res.status(400).json({ error: 'Party account not found.' });
//                 }
//                 const roundOffTransaction = new Transaction({
//                     account: roundOffAccount._id,
//                     billNumber: billNumber,
//                     isType: 'RoundOff',
//                     type: 'Sale',
//                     billId: newBill._id,
//                     purchaseSalesType: partyAccount.name,
//                     debit: Math.abs(roundOffAmount),
//                     credit: 0,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + roundOffAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     company: companyId,
//                     user: userId,
//                     fiscalYear: currentFiscalYear
//                 });
//                 await roundOffTransaction.save({ session });
//             }
//         }

//         // Cash payment transaction
//         if (paymentMode === 'cash') {
//             const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
//             if (cashAccount) {
//                 const cashTransaction = new Transaction({
//                     account: cashAccount._id,
//                     billNumber: billNumber,
//                     type: 'Sale',
//                     billId: newBill._id,
//                     purchaseSalesType: 'Sales',
//                     debit: finalAmount,
//                     credit: 0,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + finalAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     company: companyId,
//                     user: userId,
//                     fiscalYear: currentFiscalYear
//                 });
//                 await cashTransaction.save({ session });
//             }
//         }

//         // Update bill with items
//         newBill.items = billItems;
//         await newBill.save({ session });

//         // Commit transaction
//         await session.commitTransaction();
//         session.endSession();

//         // Return success response
//         return res.status(201).json({
//             success: true,
//             message: 'Bill created successfully',
//             bill: {
//                 _id: newBill._id,
//                 billNumber: newBill.billNumber,
//                 account: newBill.account,
//                 totalAmount: newBill.totalAmount,
//                 date: newBill.date,
//                 transactionDate: newBill.transactionDate
//             },
//             printUrl: req.query.print === 'true' ? `/bills/${newBill._id}/direct-print/credit-open` : null
//         });

//     } catch (error) {
//         console.error("Error creating bill:", error);
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(500).json({
//             error: 'Error creating bill',
//             details: error.message
//         });
//     }
// });

router.post('/credit-sales/open', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, checkCreditLimit, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({ error: 'Access denied for this trade type' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Destructure all required fields including calculated values from frontend
        const {
            accountId,
            items,
            vatPercentage,
            transactionDateNepali,
            transactionDateRoman,
            billDate,
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
            totalAmount
        } = req.body;

        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        // Validation checks
        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Company ID is required.' });
        }
        if (!isVatExempt) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Invalid VAT selection.' });
        }
        if (!paymentMode) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Invalid payment mode.' });
        }

        const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
        const isVatAll = isVatExempt === 'all';

        // Validate account
        const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
        if (!accounts) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Invalid account for this company' });
        }

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'At least one item is required.' });
        }

        // Validate calculated amounts are numbers
        if (isNaN(parseFloat(subTotal)) || isNaN(parseFloat(taxableAmount)) ||
            isNaN(parseFloat(nonTaxableAmount)) || isNaN(parseFloat(totalAmount))) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Invalid calculated amounts' });
        }

        // Validate stock availability and track VAT status
        let hasVatableItems = false;
        let hasNonVatableItems = false;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);

            if (!product) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ error: `Item with id ${item.item} not found` });
            }

            // Track VAT status for validation
            if (product.vatStatus === 'vatable') {
                hasVatableItems = true;
            } else {
                hasNonVatableItems = true;
            }

            // Validate batch entry
            const batchEntry = product.stockEntries.find(entry => entry.batchNumber === item.batchNumber && entry.uniqueUuId === item.uniqueUuId);
            if (!batchEntry) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: `Batch number ${item.batchNumber} not found for item: ${product.name}` });
            }

            // Check stock quantity
            if (batchEntry.quantity < item.quantity) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    error: `Not enough stock for item: ${product.name}`,
                    details: {
                        available: batchEntry.quantity,
                        required: item.quantity
                    }
                });
            }
        }

        // VAT validation
        if (isVatExempt !== 'all') {
            if (isVatExemptBool && hasVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: 'Cannot save VAT exempt bill with vatable items' });
            }

            if (!isVatExemptBool && hasNonVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: 'Cannot save bill with non-vatable items when VAT is applied' });
            }
        }

        const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'sales', session);

        // Create new bill with frontend-calculated values
        const newBill = new SalesBill({
            billNumber: billNumber,
            account: accountId,
            purchaseSalesType: 'Sales',
            items: [],
            isVatExempt: isVatExemptBool,
            isVatAll,
            vatPercentage: isVatExemptBool ? 0 : vatPercentage,
            subTotal: parseFloat(subTotal),
            discountPercentage: parseFloat(discountPercentage) || 0,
            discountAmount: parseFloat(discountAmount) || 0,
            nonVatSales: parseFloat(nonTaxableAmount),
            taxableAmount: parseFloat(taxableAmount),
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

        // Stock reduction function
        async function reduceStockBatchWise(product, batchNumber, quantity, uniqueUuId) {
            let remainingQuantity = quantity;
            const batchEntries = product.stockEntries.filter(entry =>
                entry.batchNumber === batchNumber &&
                entry.uniqueUuId === uniqueUuId
            );

            if (batchEntries.length === 0) {
                throw new Error(`Batch number ${batchNumber} with ID ${uniqueUuId} not found for product: ${product.name}`);
            }

            const selectedBatchEntry = batchEntries[0];
            if (selectedBatchEntry.quantity <= remainingQuantity) {
                remainingQuantity -= selectedBatchEntry.quantity;
                selectedBatchEntry.quantity = 0;
                product.stockEntries = product.stockEntries.filter(entry =>
                    !(entry.batchNumber === batchNumber &&
                        entry.uniqueUuId === uniqueUuId &&
                        entry.quantity === 0)
                );
            } else {
                selectedBatchEntry.quantity -= remainingQuantity;
                remainingQuantity = 0;
            }

            if (remainingQuantity > 0) {
                throw new Error(`Not enough stock in the selected stock entry for batch number ${batchNumber} of product: ${product.name}`);
            }

            product.stock = product.stockEntries.reduce((sum, entry) => sum + entry.quantity, 0);
            await product.save({ session });
        }

        // Process items
        const billItems = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);

            if (!product) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ error: `Item with id ${item.item} not found` });
            }

            await reduceStockBatchWise(product, item.batchNumber, item.quantity, item.uniqueUuId);

            billItems.push({
                item: product._id,
                quantity: item.quantity,
                price: item.price,
                netPrice: item.price - (item.price * (discountPercentage || 0) / 100),
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: discountPercentage || 0,
                discountAmountPerItem: (item.price * item.quantity * (discountPercentage || 0)) / 100,
                unit: item.unit,
                batchNumber: item.batchNumber,
                expiryDate: item.expiryDate,
                vatStatus: product.vatStatus,
                fiscalYear: fiscalYearId,
                uniqueUuId: item.uniqueUuId,
            });
        }

        // Create transactions
        let previousBalance = 0;
        const accountTransaction = await Transaction.findOne({ account: accountId }).sort({ transactionDate: -1 }).session(session);
        if (accountTransaction) {
            previousBalance = accountTransaction.balance;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);
            if (!product) continue;

            const transaction = new Transaction({
                item: product,
                account: accountId,
                billNumber: billNumber,
                quantity: item.quantity,
                price: item.price,
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: discountPercentage || 0,
                discountAmountPerItem: (item.price * item.quantity * (discountPercentage || 0)) / 100,
                netPrice: item.price - (item.price * (discountPercentage || 0) / 100),
                unit: items[0].unit,
                isType: 'Sale',
                type: 'Sale',
                billId: newBill._id,
                purchaseSalesType: 'Sales',
                debit: parseFloat(totalAmount),
                credit: 0,
                paymentMode: paymentMode,
                balance: previousBalance - parseFloat(totalAmount),
                date: nepaliDate ? nepaliDate : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });

            await transaction.save({ session });
        }

        // Sales account transaction
        const salesAmount = parseFloat(taxableAmount) + parseFloat(nonTaxableAmount);
        if (salesAmount > 0) {
            const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
            if (salesAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ error: 'Party account not found.' });
                }
                const salesTransaction = new Transaction({
                    account: salesAccount._id,
                    billNumber: billNumber,
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: 0,
                    credit: salesAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + salesAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await salesTransaction.save({ session });
            }
        }

        // VAT transaction
        if (parseFloat(vatAmount) > 0) {
            const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
            if (vatAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ error: 'Party account not found.' });
                }
                const vatTransaction = new Transaction({
                    account: vatAccount._id,
                    billNumber: billNumber,
                    isType: 'VAT',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: 0,
                    credit: parseFloat(vatAmount),
                    paymentMode: paymentMode,
                    balance: previousBalance + parseFloat(vatAmount),
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await vatTransaction.save({ session });
            }
        }

        // Round-off transactions
        if (parseFloat(roundOffAmount) !== 0) {
            const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
            if (roundOffAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ error: 'Party account not found.' });
                }
                const roundOffTransaction = new Transaction({
                    account: roundOffAccount._id,
                    billNumber: billNumber,
                    isType: 'RoundOff',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: parseFloat(roundOffAmount) > 0 ? 0 : Math.abs(parseFloat(roundOffAmount)),
                    credit: parseFloat(roundOffAmount) > 0 ? parseFloat(roundOffAmount) : 0,
                    paymentMode: paymentMode,
                    balance: previousBalance + parseFloat(roundOffAmount),
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await roundOffTransaction.save({ session });
            }
        }

        // Cash payment transaction
        if (paymentMode === 'cash') {
            const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
            if (cashAccount) {
                const cashTransaction = new Transaction({
                    account: cashAccount._id,
                    billNumber: billNumber,
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: 'Sales',
                    debit: parseFloat(totalAmount),
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: previousBalance + parseFloat(totalAmount),
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await cashTransaction.save({ session });
            }
        }

        // Update bill with items
        newBill.items = billItems;
        await newBill.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Return success response
        return res.status(201).json({
            success: true,
            message: 'Bill created successfully',
            bill: {
                _id: newBill._id,
                billNumber: newBill.billNumber,
                account: newBill.account,
                totalAmount: newBill.totalAmount,
                date: newBill.date,
                transactionDate: newBill.transactionDate
            },
            printUrl: req.query.print === 'true' ? `/bills/${newBill._id}/direct-print/credit-open` : null
        });

    } catch (error) {
        console.error("Error creating bill:", error);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
            error: 'Error creating bill',
            details: error.message
        });
    }
});

router.get('/credit-sales/finds', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

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
                return res.status(400).json({ error: 'No fiscal year found in session or company.' });
            }

            // Fetch the latest saved bill number (without modifying it)
            const latestBill = await SalesBill.findOne({
                company: companyId,
                fiscalYear: fiscalYear,
                cashAccount: { $exists: false } // Exclude documents where cashAccount exists
            })
                .sort({ date: -1, billNumber: -1 }) // Sort by date descending, then billNumber descending
                .select('billNumber date')
                .lean();

            // Return JSON response instead of rendering
            return res.json({
                success: true,
                data: {
                    company: company,
                    currentFiscalYear: currentFiscalYear,
                    latestBillNumber: latestBill ? latestBill.billNumber : '',
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
            console.error('Error in /sales-bills/finds:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        return res.status(400).json({ error: 'Invalid trade type' });
    }
});

router.get('/cash-sales/finds', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
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
                return res.status(400).json({ error: 'No fiscal year found in session or company.' });
            }

            // Fetch the latest saved bill number (without modifying it)
            const latestBill = await SalesBill.findOne({
                company: companyId,
                fiscalYear: fiscalYear,
                account: { $exists: false }
            })
                .sort({ date: -1, billNumber: -1 }) // Sort by date descending, then billNumber descending
                .select('billNumber date')
                .lean();

            // Return JSON response instead of rendering
            return res.json({
                success: true,
                data: {
                    company: company,
                    currentFiscalYear: currentFiscalYear,
                    currentCompanyName: req.session.currentCompanyName,
                    latestBillNumber: latestBill ? latestBill.billNumber : '',
                    date: new Date().toISOString().split('T')[0],
                    title: '',
                    body: '',
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error in /cash-sales/sales-bills/finds:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        return res.status(400).json({ error: 'Invalid trade type' });
    }
});


router.get('/credit-sales/edit/billNumber', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.query;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

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

            const salesBill = await SalesBill.findOne({ billNumber: billNumber, company: companyId, fiscalYear: fiscalYear })
                .populate('items.item')
                .populate('items.unit')
                .populate('account')
                .populate('company')
                .populate('user')
                .populate('fiscalYear')
                .lean()
                .exec();

            if (!salesBill || !salesBill.items) {
                return res.status(404).json({
                    success: false,
                    error: 'Sales invoice not found!'
                });
            }

            // Check if the bill has an account field populated
            if (!salesBill.account) {
                return res.status(400).json({
                    success: false,
                    error: 'This bill is not associated with a credit account. Please search for a valid credit sales bill number.'
                });
            }

            // Fetch only the required company groups: Sundry Debtors, Sundry Creditors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
            }).exec();

            // Convert relevant group IDs to an array of ObjectIds
            const relevantGroupIds = relevantGroups.map(group => group._id);

            // Fetch accounts for the relevant groups
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
            })
                .populate('transactions')
                .populate('companyGroups')
                .exec();

            res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        vatEnabled: company.vatEnabled,
                        fiscalYear: company.fiscalYear
                    },
                    salesBill,
                    accounts,
                    items: salesBill.items,
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    fiscalYear: fiscalYear,
                    currentCompanyName: currentCompanyName,
                    companyDateFormat: companyDateFormat,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences
                    },
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error fetching data for sales bill form:', error);
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

router.get('/cash-sales/edit/billNumber', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.query;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

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

            const bill = await SalesBill.findOne({
                billNumber: billNumber,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate('items.item')
                .populate('items.unit')
                .populate('company')
                .populate('user')
                .populate('fiscalYear')
                .lean()
                .exec();

            if (!bill || !bill.items) {
                return res.status(404).json({
                    success: false,
                    error: 'Sales invoice not found!'
                });
            }

            // Check if the bill is associated with a cashAccount
            if (!bill.cashAccount) {
                return res.status(400).json({
                    success: false,
                    error: 'This bill is not associated with a cash account. Please search for a valid cash sales bill number.'
                });
            }

            // Return JSON response instead of rendering
            return res.json({
                success: true,
                data: {
                    bill: {
                        ...bill,
                        items: bill.items,
                        billNumber: bill.billNumber,
                        isVatExempt: bill.isVatExempt,
                        address: bill.address,
                        subTotal: bill.subTotal,
                        totalAmount: bill.totalAmount,
                        discountPercentage: bill.discountPercentage,
                        discountAmount: bill.discountAmount,
                        taxableAmount: bill.taxableAmount,
                        vatPercentage: bill.vatPercentage,
                        vatAmount: bill.vatAmount,
                        pan: bill.pan,
                        billDate: bill.date,
                        transactionDate: bill.transactionDate,
                        cashAccount: bill.cashAccount
                    },
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        vatEnabled: company.vatEnabled,
                        fiscalYear: company.fiscalYear
                    },
                    items: bill.items,
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    fiscalYear: fiscalYear,
                    currentCompanyName: currentCompanyName,
                    companyDateFormat: companyDateFormat,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences
                    },
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });

        } catch (error) {
            console.error('Error in /cash-sales/sales-bills/edit/billNumber:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    } else {
        return res.status(400).json({
            success: false,
            error: 'Invalid trade type'
        });
    }
});


router.get('/cash-sales', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            bills,
            items,
            lastCounter,
            fiscalYears,
            categories,
            units,
            companyGroups,
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            SalesBill.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            Item.find({ company: companyId, status: 'active' }).populate('category').populate('unit').populate('mainUnit').populate('stockEntries'),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'sales'
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
        const prefix = fiscalYears.billPrefixes.sales;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        // 1. Fetch active cash accounts from Account collection
        const relevantGroups = await CompanyGroup.find({
            name: { $in: ['Cash in Hand', 'Cash Accounts'] }
        }).exec();

        const relevantGroupIds = relevantGroups.map(group => group._id);

        const activeAccounts = await Account.find({
            company: companyId,
            fiscalYear: fiscalYear,
            isActive: true,
            companyGroups: { $in: relevantGroupIds }
        }).select('name address pan phone email defaultCashAccount');

        // // 2. Fetch previously used cash accounts from SalesBill collection
        // const usedCashAccounts = await SalesBill.aggregate([
        //     {
        //         $match: {
        //             company: new mongoose.Types.ObjectId(companyId),
        //             cashAccount: { $exists: true, $ne: null }
        //         }
        //     },
        //     {
        //         $group: {
        //             _id: "$cashAccount",
        //             address: { $first: "$cashAccountAddress" },
        //             pan: { $first: "$cashAccountPan" },
        //             phone: { $first: "$cashAccountPhone" },
        //             email: { $first: "$cashAccountEmail" }
        //         }
        //     },
        //     {
        //         $project: {
        //             _id: 0,
        //             name: "$_id",
        //             address: 1,
        //             pan: 1,
        //             phone: 1,
        //             email: 1,
        //             isHistorical: true // Flag to identify historical accounts
        //         }
        //     }
        // ]);

        // // Combine both results, ensuring no duplicates
        // const combinedAccounts = [...activeAccounts.map(acc => ({
        //     ...acc.toObject(),
        //     isHistorical: false
        // }))];

        // usedCashAccounts.forEach(usedAccount => {
        //     // Only add if not already in activeAccounts
        //     if (!activeAccounts.some(acc => acc.name === usedAccount.name)) {
        //         combinedAccounts.push({
        //             _id: null, // No ID since it's from SalesBill
        //             name: usedAccount.name,
        //             address: usedAccount.address,
        //             pan: usedAccount.pan,
        //             phone: usedAccount.phone,
        //             email: usedAccount.email,
        //             isHistorical: true
        //         });
        //     }
        // });

        // // Sort combined accounts alphabetically by name
        // combinedAccounts.sort((a, b) => a.name.localeCompare(b.name));

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
                accounts: activeAccounts,
                salesBills: bills.map(bill => ({
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
                nextSalesBillNumber: nextBillNumber,
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
        console.error('Error in /cash/bills/add route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.post('/cash-sales', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access forbidden for this trade type'
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            cashAccount,
            cashAccountAddress,
            cashAccountPan,
            cashAccountEmail,
            cashAccountPhone,
            items,
            vatPercentage,
            transactionDateRoman,
            transactionDateNepali,
            billDate,
            nepaliDate,
            isVatExempt,
            discountPercentage,
            paymentMode,
            roundOffAmount: manualRoundOffAmount
        } = req.body;

        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        // Validation checks
        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Company ID is required.'
            });
        }

        if (!isVatExempt) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid vat selection.'
            });
        }

        if (!paymentMode) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid payment mode.'
            });
        }

        const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
        const isVatAll = isVatExempt === 'all';
        const discount = parseFloat(discountPercentage) || 0;

        let subTotal = 0;
        let vatAmount = 0;
        let totalTaxableAmount = 0;
        let totalNonTaxableAmount = 0;
        let hasVatableItems = false;
        let hasNonVatableItems = false;

        // Validate cash account
        if (!cashAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid account for this company'
            });
        }

        // Validate items and calculate amounts
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);

            if (!product) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    error: `Item with id ${item.item} not found`
                });
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

            // Check stock quantity
            const availableStock = product.stockEntries.reduce((acc, entry) => acc + entry.quantity, 0);
            if (availableStock < item.quantity) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: `Not enough stock for item: ${product.name}. Available: ${availableStock}, Required: ${item.quantity}`
                });
            }
        }

        // VAT validation
        if (isVatExempt !== 'all') {
            if (isVatExemptBool && hasVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot save VAT exempt bill with vatable items'
                });
            }

            if (!isVatExemptBool && hasNonVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot save bill with non-vatable items when VAT is applied'
                });
            }
        }

        // Calculate amounts
        const discountForTaxable = (totalTaxableAmount * discount) / 100;
        const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

        const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
        const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

        if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
            vatAmount = (finalTaxableAmount * vatPercentage) / 100;
        } else {
            vatAmount = 0;
        }

        let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
        let finalAmount = totalAmount;

        // Round off handling
        let roundOffForSales = await Settings.findOne({
            company: companyId,
            userId,
            fiscalYear: currentFiscalYear
        }).session(session);

        if (!roundOffForSales) {
            roundOffForSales = { roundOffSales: false };
        }

        let roundOffAmount = 0;
        if (roundOffForSales.roundOffSales) {
            finalAmount = Math.round(finalAmount.toFixed(2));
            roundOffAmount = finalAmount - totalAmount;
        } else if (manualRoundOffAmount && !roundOffForSales.roundOffSales) {
            roundOffAmount = parseFloat(manualRoundOffAmount);
            finalAmount = totalAmount + roundOffAmount;
        }

        // Create bill number
        const newBillNumber = await getNextBillNumber(companyId, fiscalYearId, 'sales', session);

        // Create new bill
        const newBill = new SalesBill({
            billNumber: newBillNumber,
            cashAccount: cashAccount,
            cashAccountAddress,
            cashAccountPan,
            cashAccountEmail,
            cashAccountPhone,
            purchaseSalesType: 'Sales',
            items: [],
            isVatExempt: isVatExemptBool,
            isVatAll,
            vatPercentage: isVatExemptBool ? 0 : vatPercentage,
            subTotal,
            discountPercentage: discount,
            discountAmount: discountForTaxable + discountForNonTaxable,
            nonVatSales: finalNonTaxableAmount,
            taxableAmount: finalTaxableAmount,
            vatAmount,
            totalAmount: finalAmount,
            roundOffAmount: roundOffAmount,
            paymentMode,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear
        });

        // Get previous balance
        let previousBalance = 0;
        const accountTransaction = await Transaction.findOne({ cashAccount: cashAccount }).sort({ transactionDate: -1 }).session(session);
        if (accountTransaction) {
            previousBalance = accountTransaction.balance;
        }

        // Group items by (product, batchNumber)
        const groupedItems = {};
        for (const item of items) {
            const key = `${item.item}-${item.batchNumber || 'N/A'}`;
            if (!groupedItems[key]) {
                groupedItems[key] = { ...item, quantity: 0 };
            }
            groupedItems[key].quantity += Number(item.quantity);
        }

        // Stock reduction function
        async function reduceStock(product, quantity) {
            product.stock -= quantity;
            let remainingQuantity = quantity;
            const batchesUsed = [];

            product.stockEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

            for (let i = 0; i < product.stockEntries.length && remainingQuantity > 0; i++) {
                let entry = product.stockEntries[i];
                const quantityUsed = Math.min(entry.quantity, remainingQuantity);
                batchesUsed.push({
                    batchNumber: entry.batchNumber,
                    quantity: quantityUsed,
                    uniqueUuId: entry.uniqueUuId,
                });

                remainingQuantity -= quantityUsed;
                entry.quantity -= quantityUsed;
            }

            product.stockEntries = product.stockEntries.filter(entry => entry.quantity > 0);
            await product.save({ session });

            if (remainingQuantity > 0) {
                throw new Error(`Not enough stock for item: ${product.name}. Required: ${quantity}, Available: ${quantity - remainingQuantity}`);
            }

            return batchesUsed;
        }

        // Process stock reduction
        const billItems = [];
        const transactions = [];

        for (const item of items) {
            const product = await Item.findById(item.item).session(session);
            const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
            const itemDiscountPercentage = discount;
            const itemDiscountAmount = (itemTotal * discount) / 100;
            const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

            const batchesUsed = await reduceStock(product, item.quantity);

            const itemsForBill = batchesUsed.map(batch => ({
                item: product._id,
                quantity: batch.quantity,
                price: item.price,
                netPrice: netPrice,
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: itemDiscountPercentage,
                discountAmountPerItem: itemDiscountAmount,
                unit: item.unit,
                batchNumber: batch.batchNumber,
                expiryDate: item.expiryDate,
                vatStatus: product.vatStatus,
                fiscalYear: fiscalYearId,
                uniqueUuId: batch.uniqueUuId
            }));

            billItems.push(...itemsForBill);
        }

        for (const item of items) {
            const product = await Item.findById(item.item).session(session);
            const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
            const itemDiscountPercentage = discount;
            const itemDiscountAmount = (itemTotal * discount) / 100;
            const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

            const transaction = new Transaction({
                item: product,
                unit: item.unit,
                WSUnit: item.WSUnit,
                price: item.price,
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: itemDiscountPercentage,
                discountAmountPerItem: itemDiscountAmount,
                netPrice: netPrice,
                quantity: item.quantity,
                cashAccount: cashAccount,
                billNumber: newBillNumber,
                isType: 'Sale',
                type: 'Sale',
                billId: newBill._id,
                purchaseSalesType: 'Sales',
                debit: finalAmount,
                credit: 0,
                paymentMode: paymentMode,
                balance: previousBalance - finalAmount,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });
            await transaction.save({ session });
            transactions.push(transaction);
        }

        // Flatten bill items
        const flattenedBillItems = billItems.flat();

        // Create sales account transaction
        const salesAmount = finalTaxableAmount + finalNonTaxableAmount;
        if (salesAmount > 0) {
            const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
            if (salesAccount) {
                const salesTransaction = new Transaction({
                    account: salesAccount._id,
                    billNumber: newBillNumber,
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: cashAccount,
                    debit: 0,
                    credit: salesAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + salesAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await salesTransaction.save({ session });
            }
        }

        // Create VAT transaction
        if (vatAmount > 0) {
            const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
            if (vatAccount) {
                const vatTransaction = new Transaction({
                    account: vatAccount._id,
                    billNumber: newBillNumber,
                    isType: 'VAT',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: cashAccount,
                    debit: 0,
                    credit: vatAmount,
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

        // Create round-off transactions
        if (roundOffAmount > 0) {
            const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
            if (roundOffAccount) {
                const roundOffTransaction = new Transaction({
                    account: roundOffAccount._id,
                    billNumber: newBillNumber,
                    isType: 'RoundOff',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: cashAccount,
                    debit: 0,
                    credit: roundOffAmount,
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

        if (roundOffAmount < 0) {
            const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
            if (roundOffAccount) {
                const roundOffTransaction = new Transaction({
                    account: roundOffAccount._id,
                    billNumber: newBillNumber,
                    isType: 'RoundOff',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: cashAccount,
                    debit: Math.abs(roundOffAmount),
                    credit: 0,
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

        // Cash payment handling
        if (paymentMode === 'cash') {
            const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
            if (cashAccount) {
                const cashTransaction = new Transaction({
                    account: cashAccount._id,
                    cashAccount: cashAccount,
                    billNumber: newBillNumber,
                    isType: 'Sale',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: 'Sales',
                    debit: finalAmount,
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: previousBalance + finalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await cashTransaction.save({ session });
            }
        }

        // Update bill with items
        newBill.items = flattenedBillItems;
        await newBill.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Prepare response
        const response = {
            success: true,
            message: 'Cash bill created successfully',
            bill: {
                _id: newBill._id,
                billNumber: newBill.billNumber,
                cashAccount: newBill.cashAccount,
                totalAmount: newBill.totalAmount,
                date: newBill.date,
                transactionDate: newBill.transactionDate,
                items: newBill.items.map(item => ({
                    item: item.item,
                    quantity: item.quantity,
                    price: item.price,
                    batchNumber: item.batchNumber
                })),
                vatAmount: newBill.vatAmount,
                discountAmount: newBill.discountAmount,
                roundOffAmount: newBill.roundOffAmount,
                paymentMode: newBill.paymentMode
            },
            printUrl: `/bills/${newBill._id}/cash/direct-print`
        };

        if (req.query.print === 'true') {
            response.redirect = `/bills/${newBill._id}/cash/direct-print`;
            return res.json(response);
        }

        return res.json(response);

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error while creating cash sales bill:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while processing the bill.',
            details: error.message
        });
    }
});


router.get('/cash-sales/open', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            bills,
            items,
            lastCounter,
            fiscalYears,
            categories,
            units,
            companyGroups,
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            SalesBill.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            Item.find({ company: companyId, status: 'active' }).populate('category').populate('unit').populate('mainUnit').populate('stockEntries'),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'sales'
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
        const prefix = fiscalYears.billPrefixes.sales;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        // 1. Fetch active cash accounts from Account collection
        const relevantGroups = await CompanyGroup.find({
            name: { $in: ['Cash in Hand', 'Cash Accounts'] }
        }).exec();

        const relevantGroupIds = relevantGroups.map(group => group._id);

        const activeAccounts = await Account.find({
            company: companyId,
            fiscalYear: fiscalYear,
            isActive: true,
            companyGroups: { $in: relevantGroupIds }
        }).select('name address pan phone email defaultCashAccount');

        // // 2. Fetch previously used cash accounts from SalesBill collection
        // const usedCashAccounts = await SalesBill.aggregate([
        //     {
        //         $match: {
        //             company: new mongoose.Types.ObjectId(companyId),
        //             cashAccount: { $exists: true, $ne: null }
        //         }
        //     },
        //     {
        //         $group: {
        //             _id: "$cashAccount",
        //             address: { $first: "$cashAccountAddress" },
        //             pan: { $first: "$cashAccountPan" },
        //             phone: { $first: "$cashAccountPhone" },
        //             email: { $first: "$cashAccountEmail" }
        //         }
        //     },
        //     {
        //         $project: {
        //             _id: 0,
        //             name: "$_id",
        //             address: 1,
        //             pan: 1,
        //             phone: 1,
        //             email: 1,
        //             isHistorical: true // Flag to identify historical accounts
        //         }
        //     }
        // ]);

        // // Combine both results, ensuring no duplicates
        // const combinedAccounts = [...activeAccounts.map(acc => ({
        //     ...acc.toObject(),
        //     isHistorical: false
        // }))];

        // usedCashAccounts.forEach(usedAccount => {
        //     // Only add if not already in activeAccounts
        //     if (!activeAccounts.some(acc => acc.name === usedAccount.name)) {
        //         combinedAccounts.push({
        //             _id: null, // No ID since it's from SalesBill
        //             name: usedAccount.name,
        //             address: usedAccount.address,
        //             pan: usedAccount.pan,
        //             phone: usedAccount.phone,
        //             email: usedAccount.email,
        //             isHistorical: true
        //         });
        //     }
        // });

        // // Sort combined accounts alphabetically by name
        // combinedAccounts.sort((a, b) => a.name.localeCompare(b.name));


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
                accounts: activeAccounts,
                salesBills: bills.map(bill => ({
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
                nextSalesBillNumber: nextBillNumber,
                dates: {
                    nepaliDate,
                    transactionDateNepali,
                    companyDateFormat
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
                },
                currentCompanyName: req.session.currentCompanyName
            }
        };

        return res.json(responseData);

    } catch (error) {
        console.error('Error in /cash/bills/addOpen route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// POST route to handle sales bill creation
router.post('/cash-sales/open', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const {
                cashAccount,
                cashAccountAddress,
                cashAccountPan,
                cashAccountEmail,
                cashAccountPhone,
                items,
                vatPercentage,
                transactionDateRoman,
                transactionDateNepali,
                billDate,
                nepaliDate,
                isVatExempt,
                discountPercentage,
                paymentMode,
                roundOffAmount: manualRoundOffAmount,
            } = req.body;
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            const userId = req.user._id;

            console.log('Request Body:', req.body);

            if (!companyId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: 'Company ID is required.' });
            }
            if (!isVatExempt) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: 'Invalid vat selection.' });
            }
            if (!paymentMode) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: 'Invalid payment mode.' });
            }

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let subTotal = 0;
            let vatAmount = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            if (!cashAccount) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: 'Invalid account for this company' });
            }

            // Validate each item before processing
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, message: `Item with id ${item.item} not found` });
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

                // Find the specific batch entry
                const batchEntry = product.stockEntries.find(entry => entry.batchNumber === item.batchNumber && entry.uniqueUuId === item.uniqueUuId);
                if (!batchEntry) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, message: `Batch number ${item.batchNumber} not found for item: ${product.name}` });
                }

                // Check stock quantity using FIFO
                if (batchEntry.quantity < item.quantity) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({
                        success: false,
                        message: `Not enough stock for item: ${product.name}`,
                        data: {
                            available: batchEntry.quantity,
                            required: item.quantity
                        }
                    });
                }
            }

            // Check validation conditions after processing all items
            if (isVatExempt !== 'all') {
                if (isVatExemptBool && hasVatableItems) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, message: 'Cannot save VAT exempt bill with vatable items' });
                }

                if (!isVatExemptBool && hasNonVatableItems) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, message: 'Cannot save bill with non-vatable items when VAT is applied' });
                }
            }

            const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'sales', session);

            // Apply discount proportionally to vatable and non-vatable items
            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            // Calculate VAT only for vatable items
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (finalTaxableAmount * vatPercentage) / 100;
            } else {
                vatAmount = 0;
            }

            let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
            let finalAmount = totalAmount;

            // Check if round off is enabled in settings
            let roundOffForSales = await Settings.findOne({
                company: companyId, userId, fiscalYear: currentFiscalYear
            }).session(session);

            // Handle case where settings is null
            if (!roundOffForSales) {
                console.log('No settings found, using default settings or handling as required');
                roundOffForSales = { roundOffSales: false };
            }
            let roundOffAmount = 0;
            if (roundOffForSales.roundOffSales) {
                finalAmount = Math.round(finalAmount.toFixed(2)); // Round off final amount
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForSales.roundOffSales) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            // Create new bill
            const newBill = new SalesBill({
                billNumber: billNumber,
                cashAccount: cashAccount,
                cashAccountAddress,
                cashAccountPan,
                cashAccountEmail,
                cashAccountPhone,
                purchaseSalesType: 'Sales',
                items: [], // We'll update this later
                isVatExempt: isVatExemptBool,
                isVatAll,
                vatPercentage: isVatExemptBool ? 0 : vatPercentage,
                subTotal,
                discountPercentage: discount,
                discountAmount: discountForTaxable + discountForNonTaxable,
                nonVatSales: finalNonTaxableAmount,
                taxableAmount: finalTaxableAmount,
                vatAmount,
                totalAmount: finalAmount,
                roundOffAmount: roundOffAmount,
                paymentMode,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });

            // Create transactions
            let previousBalance = 0;
            const accountTransaction = await Transaction.findOne({ cashAccount: cashAccount }).sort({ transactionDate: -1 }).session(session);
            if (accountTransaction) {
                previousBalance = accountTransaction.balance;
            }

            async function reduceStockBatchWise(product, batchNumber, quantity, uniqueUuId) {
                let remainingQuantity = quantity;

                // Find all batch entries with the specific batch number
                const batchEntries = product.stockEntries.filter(entry =>
                    entry.batchNumber === batchNumber &&
                    entry.uniqueUuId === uniqueUuId
                );

                if (batchEntries.length === 0) {
                    throw new Error(`Batch number ${batchNumber} with ID ${uniqueUuId} not found for product: ${product.name}`);
                }

                // Find the specific stock entry
                const selectedBatchEntry = batchEntries[0];

                // Reduce stock for the selected batch entry
                if (selectedBatchEntry.quantity <= remainingQuantity) {
                    remainingQuantity -= selectedBatchEntry.quantity;
                    selectedBatchEntry.quantity = 0;

                    // Remove the entry from stockEntries array if quantity is 0
                    product.stockEntries = product.stockEntries.filter(entry =>
                        !(entry.batchNumber === batchNumber &&
                            entry.uniqueUuId === uniqueUuId &&
                            entry.quantity === 0)
                    );
                } else {
                    selectedBatchEntry.quantity -= remainingQuantity;
                    remainingQuantity = 0;
                }

                if (remainingQuantity > 0) {
                    throw new Error(`Not enough stock in the selected stock entry for batch number ${batchNumber} of product: ${product.name}`);
                }

                // Recalculate total stock
                product.stock = product.stockEntries.reduce((sum, entry) => sum + entry.quantity, 0);

                // Save the product with the updated stock entries
                await product.save({ session });
            }

            // Process all items first to reduce stock and build bill items
            const billItems = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, message: `Item with id ${item.item} not found` });
                }

                // Calculate item's share of the discount
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const itemDiscountPercentage = discount; // Same percentage for all items
                const itemDiscountAmount = (itemTotal * discount) / 100;
                const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                // Reduce stock for the specific batch
                await reduceStockBatchWise(product, item.batchNumber, item.quantity, item.uniqueUuId);

                // Update product stock
                product.stock -= item.quantity;
                await product.save({ session });

                billItems.push({
                    item: product._id,
                    quantity: item.quantity,
                    price: item.price,
                    netPrice: netPrice,
                    puPrice: item.puPrice,
                    netPuPrice: item.netPuPrice,
                    discountPercentagePerItem: itemDiscountPercentage,
                    discountAmountPerItem: itemDiscountAmount,
                    unit: item.unit,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    vatStatus: product.vatStatus,
                    fiscalYear: fiscalYearId,
                    uniqueUuId: item.uniqueUuId,
                });
            }

            // Calculate the correct total amount from the bill (not from items)
            const correctTotalAmount = newBill.totalAmount; // This should be 14125 in your example

            // Validate each item before processing
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);
                // Calculate item's share of the discount
                if (!product) continue; // Skip if product not found
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const itemDiscountPercentage = discount; // Same percentage for all items
                const itemDiscountAmount = (itemTotal * discount) / 100;
                const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                // Now create a single transaction for the entire bill
                const transaction = new Transaction({
                    item: product,
                    cashAccount: cashAccount,
                    billNumber: billNumber,
                    quantity: item.quantity, // Total quantity
                    price: item.price, // Assuming same price for all items
                    unit: item.unit, // Assuming same unit for all items
                    netPuPrice: item.netPuPrice,
                    discountPercentagePerItem: itemDiscountPercentage,
                    discountAmountPerItem: itemDiscountAmount,
                    netPrice: netPrice,
                    isType: 'Sale',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: 'Sales',
                    debit: correctTotalAmount, // Use the bill's total amount directly
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: previousBalance - correctTotalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });

                await transaction.save({ session });
                console.log('Transaction amount:', correctTotalAmount);
            }

            // Update bill with items
            newBill.items = billItems;
            await newBill.save({ session });

            // Create a transaction for the default Sales Account
            const salesAmount = finalTaxableAmount + finalNonTaxableAmount;
            if (salesAmount > 0) {
                const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
                if (salesAccount) {
                    const salesTransaction = new Transaction({
                        account: salesAccount._id,
                        billNumber: billNumber,
                        type: 'Sale',
                        billId: newBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: 0,  // Debit the VAT account
                        credit: salesAmount,// Credit is 0 for VAT transactions
                        paymentMode: paymentMode,
                        balance: previousBalance + salesAmount, // Update the balance
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await salesTransaction.save({ session });
                    console.log('Sales Transaction: ', salesTransaction);
                }
            }

            // Create a transaction for the VAT amount
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: billNumber,
                        isType: 'VAT',
                        type: 'Sale',
                        billId: newBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: 0,  // Debit the VAT account
                        credit: vatAmount,         // Credit is 0 for VAT transactions
                        paymentMode: paymentMode,
                        balance: previousBalance + vatAmount, // Update the balance
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save({ session });
                    console.log('Vat Transaction: ', vatTransaction);
                }
            }

            // Create a transaction for the round-off amount
            if (roundOffAmount > 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        isType: 'RoundOff',
                        type: 'Sale',
                        billId: newBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: 0,  // Debit the VAT account
                        credit: roundOffAmount,         // Credit is 0 for VAT transactions
                        paymentMode: paymentMode,
                        balance: previousBalance + roundOffAmount, // Update the balance
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                    console.log('Round-off Transaction: ', roundOffTransaction);
                }
            }

            if (roundOffAmount < 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        isType: 'RoundOff',
                        type: 'Sale',
                        billId: newBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: Math.abs(roundOffAmount),  // Debit the VAT account
                        credit: 0, // Ensure roundOffAmount is not saved as a negative value
                        paymentMode: paymentMode,
                        balance: previousBalance + roundOffAmount, // Update the balance
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                    console.log('Round-off Transaction: ', roundOffTransaction);
                }
            }

            // If payment mode is cash, also create a transaction for the "Cash in Hand" account
            if (paymentMode === 'cash') {
                const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashAccount) {
                    const cashTransaction = new Transaction({
                        account: cashAccount._id,
                        cashAccount: cashAccount,
                        billNumber: billNumber,
                        isType: 'Sale',
                        type: 'Sale',
                        billId: newBill._id,  // Set billId to the new bill's ID
                        purchaseSalesType: 'Sales',
                        debit: finalAmount,  // Debit is 0 for cash-in-hand as we're receiving cash
                        credit: 0,  // Credit is the total amount since we're receiving cash
                        paymentMode: paymentMode,
                        balance: previousBalance + finalAmount, // Update the balance
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await cashTransaction.save({ session });
                }
            }

            // Update bill with items
            newBill.items = billItems;
            await newBill.save({ session });

            // If everything goes smoothly, commit the transaction
            await session.commitTransaction();
            session.endSession();

            if (req.query.print === 'true') {
                // Return print information
                return res.status(200).json({
                    success: true,
                    message: 'Bill created successfully',
                    data: {
                        billId: newBill._id,
                        printUrl: `/bills/${newBill._id}/direct-print/cash-open`
                    }
                });
            } else {
                // Return success response
                return res.status(200).json({
                    success: true,
                    message: 'Bill saved successfully!',
                    data: newBill
                });
            }
        } catch (error) {
            console.error("Error creating bill:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                message: 'Error creating bill',
                error: error.message
            });
        }
    }
});

router.get('/credit-sales/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            const currentCompanyName = req.session.currentCompanyName;

            // Find the bill by ID and populate relevant data
            const salesBill = await SalesBill.findOne({
                _id: billId,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate({
                    path: 'items.item',
                    select: 'name hscode uniqueNumber vatStatus unit sellingPrice quantity stockEntries category',
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

            if (!salesBill || salesBill.company.toString() !== companyId) {
                return res.status(404).json({
                    success: false,
                    error: 'Bill not found or does not belong to the selected company'
                });
            }

            // Process bill items to include additional item details
            const processedItems = salesBill.items.map(item => {
                const itemData = item.item || {};

                // Calculate stock
                const totalStock = itemData.stockEntries?.reduce((sum, entry) => {
                    return sum + (entry.quantity || 0);
                }, 0) || 0;

                const unit = item.unit || (itemData.unit ? {
                    _id: itemData.unit._id,
                    name: itemData.unit.name
                } : null);

                return {
                    ...item,
                    name: itemData.name || '',
                    hscode: itemData.hscode || '',
                    uniqueNumber: itemData.uniqueNumber || '',
                    vatStatus: itemData.vatStatus || 'vatable',
                    category: itemData.category || null,
                    stock: totalStock,
                    sellingPrice: itemData.sellingPrice || 0,
                    unit: unit,
                    amount: (item.quantity * item.rate).toFixed(2),
                    uniqueUuId: item.uniqueUuId || '',
                    item: item.item ? item.item._id : null
                };
            });

            // Fetch all items for the company (for dropdown) with stock
            const allItems = await Item.find({ company: companyId, status: 'active' })
                .populate([
                    { path: 'unit', select: 'name _id' },
                    { path: 'category', select: 'name _id' },
                    { path: 'stockEntries', select: 'quantity' }
                ])
                .select('name hscode uniqueNumber vatStatus unit sellingPrice stockEntries category')
                .lean();

            // Process all items to include stock
            const processedAllItems = allItems.map(item => {
                const totalStock = item.stockEntries.reduce((sum, entry) => {
                    return sum + (entry.quantity || 0);
                }, 0);

                return {
                    ...item,
                    stock: totalStock,
                    category: item.category || null
                };
            }).sort((a, b) => a.name.localeCompare(b.name));

            // Fetch only the required company groups: Sundry Debtors
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
                        name: currentCompanyName,
                        fiscalYear: currentFiscalYear
                    },
                    salesBill: {
                        ...salesBill,
                        items: processedItems,
                        billDate: salesBill.date,
                        transactionDate: salesBill.transactionDate
                    },
                    items: processedAllItems,
                    accounts: accounts,
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
            console.error("Error fetching bill for edit:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching bill for edit',
                details: error.message
            });
        }
    }
});

router.get('/cash-sales/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const billId = req.params.id;
            const companyId = req.session.currentCompany;

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                // Fetch the fiscal year from the database if available in the session
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            const company = await Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear');

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

            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            const companyDateFormat = company.dateFormat || 'english';
            const currentCompanyName = req.session.currentCompanyName;

            // Find the bill by ID and populate relevant data
            const bill = await SalesBill.findOne({
                _id: billId,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate({
                    path: 'items.item',
                    select: 'name hscode uniqueNumber vatStatus unit price quantity stockEntries category',
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
                .lean()
                .exec();

            if (!bill || bill.company.toString() !== companyId) {
                return res.status(404).json({
                    success: false,
                    error: 'Bill not found or does not belong to the selected company'
                });
            }

            // Process bill items to include additional item details
            const processedItems = bill.items.map(item => {
                const itemData = item.item || {};

                // Calculate stock
                const totalStock = itemData.stockEntries?.reduce((sum, entry) => {
                    return sum + (entry.quantity || 0);
                }, 0) || 0;

                const unit = item.unit || (itemData.unit ? {
                    _id: itemData.unit._id,
                    name: itemData.unit.name
                } : null);

                return {
                    ...item,
                    name: itemData.name || '',
                    hscode: itemData.hscode || '',
                    uniqueNumber: itemData.uniqueNumber || '',
                    vatStatus: itemData.vatStatus || 'vatable',
                    category: itemData.category || null,
                    stock: totalStock,
                    sellingPrice: itemData.sellingPrice || 0,
                    unit: unit,
                    amount: (item.quantity * item.rate).toFixed(2),
                    uniqueUuId: item.uniqueUuId || '',
                    item: item.item ? item.item._id : null
                };
            });

            // Fetch all items for the company (for dropdown) with stock
            const allItems = await Item.find({ company: companyId, status: 'active' })
                .populate([
                    { path: 'unit', select: 'name _id' },
                    { path: 'category', select: 'name _id' },
                    { path: 'stockEntries', select: 'quantity' }
                ])
                .select('name hscode uniqueNumber vatStatus unit sellingPrice stockEntries category')
                .lean();

            // Process all items to include stock
            const processedAllItems = allItems.map(item => {
                const totalStock = item.stockEntries.reduce((sum, entry) => {
                    return sum + (entry.quantity || 0);
                }, 0);

                return {
                    ...item,
                    stock: totalStock,
                    category: item.category || null
                };
            }).sort((a, b) => a.name.localeCompare(b.name));

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
                        vatEnabled: company.vatEnabled,
                        dateFormat: companyDateFormat,
                        name: currentCompanyName,
                        fiscalYear: currentFiscalYear,
                        renewalDate: company.renewalDate
                    },
                    accounts: combinedAccounts,
                    bill: {
                        ...bill,
                        items: processedItems,
                        billDate: bill.date,
                        transactionDate: bill.transactionDate,
                        billId: bill._id,
                        billNumber: bill.billNumber,
                        paymentMode: bill.paymentMode,
                        isVatExempt: bill.isVatExempt,
                        cashAccountAddress: bill.cashAccountAddress,
                        subTotal: bill.subTotal,
                        totalAmount: bill.totalAmount,
                        discountPercentage: bill.discountPercentage,
                        discountAmount: bill.discountAmount,
                        taxableAmount: bill.taxableAmount,
                        vatPercentage: bill.vatPercentage,
                        vatAmount: bill.vatAmount,
                        cashAccount: bill.cashAccount,
                        cashAccountPan: bill.cashAccountPan
                    },
                    items: processedAllItems,
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
            console.error("Error fetching bill for edit:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching bill for edit',
                details: error.message
            });
        }
    }
});


router.put('/credit-sales/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        const billId = req.params.id;
        try {
            const {
                accountId,
                items,
                vatPercentage,
                transactionDateRoman,
                transactionDateNepali,
                billDate,
                nepaliDate,
                isVatExempt,
                discountPercentage,
                paymentMode,
                roundOffAmount: manualRoundOffAmount,
            } = req.body;

            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const userId = req.user._id;

            if (!companyId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Company ID is required'
                });
            }

            // Fetch the existing bill
            const existingBill = await SalesBill.findOne({ _id: billId, company: companyId }).session(session);
            if (!existingBill) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    error: 'Bill not found'
                });
            }

            const account = await Account.findById(accountId).session(session);
            if (!account) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    error: 'Account not found'
                });
            }
            // Step 1: Restore stock for all existing items (complete reversal)
            for (const existingItem of existingBill.items) {
                const product = await Item.findById(existingItem.item._id).session(session);
                if (!product) {
                    console.warn(`Product with ID ${existingItem.item._id} not found`);
                    continue;
                }

                // Find or create the batch entry
                let batchEntry = product.stockEntries.find(entry =>
                    entry.batchNumber === existingItem.batchNumber &&
                    entry.uniqueUuId === existingItem.uniqueUuId
                );

                if (batchEntry) {
                    batchEntry.quantity += existingItem.quantity;
                } else {
                    // If batch doesn't exist, create a new one (shouldn't happen for existing bills)
                    batchEntry = {
                        batchNumber: existingItem.batchNumber,
                        uniqueUuId: existingItem.uniqueUuId || uuidv4(),
                        quantity: existingItem.quantity,
                        date: existingItem.date || new Date(),
                        purchaseRate: existingItem.price // Using sale price as fallback
                    };
                    product.stockEntries.push(batchEntry);
                }

                // Update the total stock count
                product.stock += existingItem.quantity;
                await product.save({ session });
            }

            // Step 1: Identify removed items and restore stock
            const removedItems = existingBill.items.filter(existingItem =>
                !items.some(item =>
                    item.item === existingItem.item.toString() &&
                    item.batchNumber === existingItem.batchNumber &&
                    item.uniqueUuId === existingItem.uniqueUuId
                )
            );

            for (const removedItem of removedItems) {
                const product = await Item.findById(removedItem.item).session(session);
                if (!product) {
                    console.warn(`Product with ID ${removedItem.item} not found`);
                    continue;
                }

                const batchEntry = product.stockEntries.find(entry =>
                    entry.batchNumber === removedItem.batchNumber &&
                    entry.uniqueUuId === removedItem.uniqueUuId
                );
            }

            ('Stock successfully restored for removed items.');

            // Delete all associated transactions
            await Transaction.deleteMany({ billId: existingBill._id }).session(session);
            ('Existing transactions deleted successfully');


            // Calculate amounts based on the updated items
            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;

            for (const item of items) {
                const product = await Item.findById(item.item).session(session);
                if (!product) {
                    throw new Error(`Product with ID ${item.item} not found`);
                }

                if (product.vatStatus === 'vatable') {
                    totalTaxableAmount += item.quantity * item.price;
                } else {
                    totalNonTaxableAmount += item.quantity * item.price;
                }
            }

            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            let vatAmount = 0;
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (finalTaxableAmount * vatPercentage) / 100;
            }

            const totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;

            let finalAmount = totalAmount;

            // Check if round off is enabled in settings
            let roundOffForSales = await Settings.findOne({
                company: companyId, userId, fiscalYear: currentFiscalYear
            }).session(session);

            // Handle case where settings is null
            if (!roundOffForSales) {
                ('No settings found, using default settings or handling as required');
                roundOffForSales = { roundOffSales: false };
            }
            let roundOffAmount = 0;
            if (roundOffForSales.roundOffSales) {
                finalAmount = Math.round(finalAmount.toFixed(2)); // Round off final amount
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForSales.roundOffSales) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            // Update existing bill
            existingBill.account = accountId;
            existingBill.isVatExempt = isVatExemptBool;
            existingBill.vatPercentage = isVatExemptBool ? 0 : vatPercentage;
            existingBill.subTotal = totalTaxableAmount + totalNonTaxableAmount;
            existingBill.discountPercentage = discount;
            existingBill.discountAmount = discountForTaxable + discountForNonTaxable;
            existingBill.nonVatSales = finalNonTaxableAmount;
            existingBill.taxableAmount = finalTaxableAmount;
            existingBill.vatAmount = vatAmount;
            existingBill.totalAmount = finalAmount;
            existingBill.roundOffAmount = roundOffAmount;
            existingBill.isVatAll = isVatAll;
            existingBill.paymentMode = paymentMode;
            existingBill.date = nepaliDate || new Date(billDate);
            existingBill.transactionDate = transactionDateNepali || new Date(transactionDateRoman);

            // Group items by (product, batchNumber) to aggregate quantities
            const groupedItems = {};
            for (const item of items) {
                const key = `${item.item}-${item.batchNumber || 'N/A'}`; // Handle batch numbers
                if (!groupedItems[key]) {
                    groupedItems[key] = { ...item, quantity: 0 }; // Ensure numeric quantity
                }
                groupedItems[key].quantity += Number(item.quantity); // Convert quantity to number before summing
            }

            async function reduceStock(product, quantity) {

                // Update product stock
                product.stock -= quantity;

                let remainingQuantity = quantity;
                const batchesUsed = []; // Array to track batches and quantities used

                // Sort stock entries FIFO (oldest first)
                product.stockEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

                for (let i = 0; i < product.stockEntries.length && remainingQuantity > 0; i++) {
                    let entry = product.stockEntries[i];

                    const quantityUsed = Math.min(entry.quantity, remainingQuantity);
                    batchesUsed.push({
                        batchNumber: entry.batchNumber,
                        quantity: quantityUsed,
                        uniqueUuId: entry.uniqueUuId, // Include the uniqueUuId of the batch
                    });

                    remainingQuantity -= quantityUsed;
                    entry.quantity -= quantityUsed;
                }

                // Remove depleted stock entries
                product.stockEntries = product.stockEntries.filter(entry => entry.quantity > 0);
                await product.save({ session });

                // If remainingQuantity > 0, it means there isn't enough stock
                if (remainingQuantity > 0) {
                    throw new Error(`Not enough stock for item: ${product.name}. Required: ${quantity}, Available: ${quantity - remainingQuantity}`);
                }

                return batchesUsed; // Return the batches and quantities used
            }

            // Process stock reduction and transaction recording
            const billItems = [];
            const transactions = [];

            // First process all stock reductions
            for (const item of items) {
                const product = await Item.findById(item.item).session(session);
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const itemDiscountPercentage = discount;
                const itemDiscountAmount = (itemTotal * discount) / 100;
                const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                // Reduce stock using FIFO and get the batches used
                const batchesUsed = await reduceStock(product, item.quantity);

                // Create bill items for each batch used
                const itemsForBill = batchesUsed.map(batch => ({
                    item: product._id,
                    quantity: batch.quantity,
                    price: item.price,
                    netPrice: netPrice,
                    puPrice: item.puPrice,
                    netPuPrice: item.netPuPrice,
                    discountPercentagePerItem: itemDiscountPercentage,
                    discountAmountPerItem: itemDiscountAmount,
                    unit: item.unit,
                    batchNumber: batch.batchNumber, // Use the actual batch number from stock reduction
                    expiryDate: item.expiryDate,
                    vatStatus: product.vatStatus,
                    fiscalYear: currentFiscalYear,
                    uniqueUuId: batch.uniqueUuId
                }));

                billItems.push(...itemsForBill);
            }

            // Validate each item before processing
            for (const item of items) {
                const product = await Item.findById(item.item).session(session);
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const itemDiscountPercentage = discount;
                const itemDiscountAmount = (itemTotal * discount) / 100;
                const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                // Now create a single transaction for the entire bill
                const transaction = new Transaction({
                    item: product,
                    unit: item.unit,
                    WSUnit: item.WSUnit,
                    price: item.price,
                    puPrice: item.puPrice,
                    netPuPrice: item.netPuPrice,
                    discountPercentagePerItem: itemDiscountPercentage,
                    discountAmountPerItem: itemDiscountAmount,
                    netPrice: netPrice,
                    quantity: item.quantity,
                    account: accountId,
                    billNumber: existingBill.billNumber,
                    isType: 'Sale',
                    type: 'Sale',
                    billId: existingBill._id,
                    purchaseSalesType: 'Sales',
                    debit: finalAmount,
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: 0,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await transaction.save({ session });
                transactions.push(transaction);
            }

            // Flatten the bill items array (since each item may have multiple batches)
            const flattenedBillItems = billItems.flat();

            existingBill.items = flattenedBillItems;
            await existingBill.save({ session });

            // Create additional transactions (Sales, VAT, Round-off, Cash)
            const salesAmount = finalTaxableAmount + finalNonTaxableAmount;
            if (salesAmount > 0) {
                const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
                if (salesAccount) {
                    const salesTransaction = new Transaction({
                        account: salesAccount._id,
                        billNumber: existingBill.billNumber,
                        type: 'Sale',
                        billId: existingBill._id,
                        purchaseSalesType: account.name,
                        debit: 0,
                        credit: salesAmount,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await salesTransaction.save({ session });
                    ('Sales Transaction: ', salesTransaction);
                }
            }

            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: existingBill.billNumber,
                        isType: 'VAT',
                        type: 'Sale',
                        billId: existingBill._id,
                        purchaseSalesType: account.name,
                        debit: 0,
                        credit: vatAmount,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save({ session });
                    ('VAT Transaction: ', vatTransaction);
                }
            }

            if (roundOffAmount > 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: existingBill.billNumber,
                        isType: 'RoundOff',
                        type: 'Sale',
                        billId: existingBill._id,
                        purchaseSalesType: account.name,
                        debit: 0,
                        credit: roundOffAmount,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                    ('Round-off Transaction: ', roundOffTransaction);
                }
            }

            if (roundOffAmount < 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: existingBill.billNumber,
                        isType: 'RoundOff',
                        type: 'Sale',
                        billId: existingBill._id,
                        purchaseSalesType: account.name,
                        debit: roundOffAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                    ('Round-off Transaction: ', roundOffTransaction);
                }
            }

            if (paymentMode === 'cash') {
                const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashAccount) {
                    const cashTransaction = new Transaction({
                        account: cashAccount._id,
                        billNumber: existingBill.billNumber,
                        type: 'Sale',
                        billId: existingBill._id,
                        purchaseSalesType: 'Sales',
                        debit: finalAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await cashTransaction.save({ session });
                    ('Cash Transaction: ', cashTransaction);
                }
            }

            await session.commitTransaction();
            session.endSession();

            if (req.query.print === 'true') {
                return res.json({
                    success: true,
                    redirect: `/bills/${billId}/direct-print-edit`,
                    message: 'Bill updated successfully'
                });
            } else {
                return res.json({
                    success: true,
                    data: {
                        billId: existingBill._id,
                        billNumber: existingBill.billNumber,
                        account: {
                            _id: account._id,
                            name: account.name
                        },
                        totalAmount: existingBill.totalAmount,
                        items: existingBill.items.map(item => ({
                            itemId: item.item,
                            quantity: item.quantity,
                            price: item.price,
                            batchNumber: item.batchNumber
                        })),
                        vatAmount: existingBill.vatAmount,
                        discountAmount: existingBill.discountAmount,
                        roundOffAmount: existingBill.roundOffAmount
                    },
                    message: 'Bill updated successfully'
                });
            }
        } catch (error) {
            console.error("Error updating bill:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                error: 'Error updating bill',
                details: error.message
            });
        }
    }
});

router.put('/cash-sales/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        const billId = req.params.id;
        try {
            const {
                cashAccount,
                cashAccountAddress,
                cashAccountPan,
                cashAccountEmail,
                cashAccountPhone,
                items,
                vatPercentage,
                transactionDateRoman,
                transactionDateNepali,
                billDate,
                nepaliDate,
                isVatExempt,
                discountPercentage,
                paymentMode,
                roundOffAmount: manualRoundOffAmount,
            } = req.body;

            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const userId = req.user._id;

            if (!companyId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Company ID is required'
                });
            }

            // Fetch the existing bill
            const existingBill = await SalesBill.findOne({ _id: billId, company: companyId }).session(session);
            if (!existingBill) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    error: 'Bill not found'
                });
            }

            // Step 1: Restore stock for all existing items (complete reversal)
            for (const existingItem of existingBill.items) {
                const product = await Item.findById(existingItem.item._id).session(session);
                if (!product) {
                    console.warn(`Product with ID ${existingItem.item._id} not found`);
                    continue;
                }

                // Find or create the batch entry
                let batchEntry = product.stockEntries.find(entry =>
                    entry.batchNumber === existingItem.batchNumber &&
                    entry.uniqueUuId === existingItem.uniqueUuId
                );

                if (batchEntry) {
                    batchEntry.quantity += existingItem.quantity;
                    batchEntry.batchNumber = existingItem.batchNumber;
                    batchEntry.expiryDate = existingItem.expiryDate;
                    batchEntry.uniqueUuId = existingItem.uniqueUuId;
                    batchEntry.price = existingItem.price;
                    batchEntry.puPrice = existingItem.puPrice;
                } else {
                    // If batch doesn't exist, create a new one (shouldn't happen for existing bills)
                    batchEntry = {
                        batchNumber: existingItem.batchNumber,
                        uniqueUuId: existingItem.uniqueUuId || uuidv4(),
                        quantity: existingItem.quantity,
                        date: existingItem.date || new Date(),
                        purchaseRate: existingItem.price // Using sale price as fallback
                    };
                    product.stockEntries.push(batchEntry);
                }

                // Update the total stock count
                product.stock += existingItem.quantity;
                await product.save({ session });
            }

            // Step 1: Identify removed items and restore stock
            const removedItems = existingBill.items.filter(existingItem =>
                !items.some(item =>
                    item.item === existingItem.item.toString() &&
                    item.batchNumber === existingItem.batchNumber &&
                    item.uniqueUuId === existingItem.uniqueUuId
                )
            );
            for (const removedItem of removedItems) {
                const product = await Item.findById(removedItem.item).session(session);
                if (!product) {
                    console.warn(`Product with ID ${removedItem.item} not found`);
                    continue;
                }

                const batchEntry = product.stockEntries.find(entry =>
                    entry.batchNumber === removedItem.batchNumber &&
                    entry.uniqueUuId === removedItem.uniqueUuId
                );
            }

            // Delete all associated transactions
            await Transaction.deleteMany({ billId: existingBill._id }).session(session);

            // Calculate amounts based on the updated POST route logic
            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;

            for (const item of items) {
                const product = await Item.findById(item.item).session(session);
                if (!product) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({
                        success: false,
                        error: `Product with ID ${item.item} not found`
                    });
                }

                if (product.vatStatus === 'vatable') {
                    totalTaxableAmount += item.quantity * item.price;
                } else {
                    totalNonTaxableAmount += item.quantity * item.price;
                }
            }

            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            let vatAmount = 0;
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (finalTaxableAmount * vatPercentage) / 100;
            }

            const totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;

            let finalAmount = totalAmount;
            let roundOffAmount = 0;

            const roundOffForSales = await Settings.findOne({ company: companyId, userId, fiscalYear: currentFiscalYear }).session(session) || { roundOffSales: false };

            if (roundOffForSales.roundOffSales) {
                finalAmount = Math.round(finalAmount.toFixed(2));
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForSales.roundOffSales) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            // Update existing bill
            existingBill.cashAccount = cashAccount;
            existingBill.cashAccountAddress = cashAccountAddress;
            existingBill.cashAccountPan = cashAccountPan;
            existingBill.cashAccountEmail = cashAccountEmail;
            existingBill.cashAccountPhone = cashAccountPhone;
            existingBill.isVatExempt = isVatExemptBool;
            existingBill.vatPercentage = isVatExemptBool ? 0 : vatPercentage;
            existingBill.subTotal = totalTaxableAmount + totalNonTaxableAmount;
            existingBill.discountPercentage = discount;
            existingBill.discountAmount = discountForTaxable + discountForNonTaxable;
            existingBill.nonVatSales = finalNonTaxableAmount;
            existingBill.taxableAmount = finalTaxableAmount;
            existingBill.vatAmount = vatAmount;
            existingBill.totalAmount = finalAmount;
            existingBill.roundOffAmount = roundOffAmount;
            existingBill.isVatAll = isVatAll;
            existingBill.paymentMode = paymentMode;
            existingBill.date = nepaliDate || new Date(billDate);
            existingBill.transactionDate = transactionDateNepali || new Date(transactionDateRoman);

            // Group items by (product, batchNumber) to aggregate quantities
            const groupedItems = {};
            for (const item of items) {
                const key = `${item.item}-${item.batchNumber || 'N/A'}`; // Handle batch numbers
                if (!groupedItems[key]) {
                    groupedItems[key] = { ...item, quantity: 0 }; // Ensure numeric quantity
                }
                groupedItems[key].quantity += Number(item.quantity); // Convert quantity to number before summing
            }

            async function reduceStock(product, quantity) {
                let remainingQuantity = quantity;
                const batchesUsed = []; // Array to track batches and quantities used

                // Sort stock entries FIFO (oldest first)
                product.stockEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

                for (let i = 0; i < product.stockEntries.length && remainingQuantity > 0; i++) {
                    let entry = product.stockEntries[i];

                    const quantityUsed = Math.min(entry.quantity, remainingQuantity);
                    batchesUsed.push({
                        batchNumber: entry.batchNumber,
                        quantity: quantityUsed,
                        uniqueUuId: entry.uniqueUuId, // Include the uniqueUuId of the batch
                    });

                    remainingQuantity -= quantityUsed;
                    entry.quantity -= quantityUsed;
                }

                // Remove depleted stock entries
                product.stockEntries = product.stockEntries.filter(entry => entry.quantity > 0);
                await product.save({ session });

                // If remainingQuantity > 0, it means there isn't enough stock
                if (remainingQuantity > 0) {
                    throw new Error(`Not enough stock for item: ${product.name}. Required: ${quantity}, Available: ${quantity - remainingQuantity}`);
                }

                return batchesUsed; // Return the batches and quantities used
            }

            // Process stock reduction and transaction recording
            const billItems = [];
            const transactions = [];

            // First process all stock reductions
            for (const item of items) {
                const product = await Item.findById(item.item).session(session);
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const itemDiscountPercentage = discount;
                const itemDiscountAmount = (itemTotal * discount) / 100;
                const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);


                // Reduce stock using FIFO and get the batches used
                const batchesUsed = await reduceStock(product, item.quantity);

                // Create bill items for each batch used
                const itemsForBill = batchesUsed.map(batch => ({
                    item: product._id,
                    quantity: batch.quantity,
                    price: item.price,
                    netPrice: netPrice,
                    puPrice: item.puPrice,
                    netPuPrice: item.netPuPrice,
                    discountPercentagePerItem: itemDiscountPercentage,
                    discountAmountPerItem: itemDiscountAmount,
                    unit: item.unit,
                    batchNumber: batch.batchNumber, // Use the actual batch number from stock reduction
                    expiryDate: item.expiryDate,
                    vatStatus: product.vatStatus,
                    fiscalYear: currentFiscalYear,
                    uniqueUuId: batch.uniqueUuId
                }));

                billItems.push(...itemsForBill);
            }

            // Validate each item before processing
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                // Calculate item's share of the discount
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const itemDiscountPercentage = discount; // Same percentage for all items
                const itemDiscountAmount = (itemTotal * discount) / 100;
                const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                // Now create a single transaction for the entire bill
                const transaction = new Transaction({
                    item: product,
                    unit: item.unit,
                    WSUnit: item.WSUnit,
                    price: item.price,
                    puPrice: item.puPrice,
                    netPuPrice: item.netPuPrice,
                    discountPercentagePerItem: itemDiscountPercentage,
                    discountAmountPerItem: itemDiscountAmount,
                    netPrice: netPrice,
                    quantity: item.quantity,
                    cashAccount: cashAccount,
                    billNumber: existingBill.billNumber,
                    isType: 'Sale',
                    type: 'Sale',
                    billId: existingBill._id,
                    purchaseSalesType: 'Sales',
                    debit: finalAmount,
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: 0,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await transaction.save({ session });
                transactions.push(transaction);
            }

            // Create a transaction for the default Purchase Account
            const salesAmount = finalTaxableAmount + finalNonTaxableAmount;
            if (salesAmount > 0) {
                const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
                if (salesAccount) {
                    const salesTransaction = new Transaction({
                        account: salesAccount._id,
                        billNumber: existingBill.billNumber,
                        type: 'Sale',
                        billId: existingBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: 0,  // Debit the VAT account
                        credit: salesAmount,// Credit is 0 for VAT transactions
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await salesTransaction.save({ session });
                }
            }

            // Create a transaction for the VAT amount
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: existingBill.billNumber,
                        isType: 'VAT',
                        type: 'Sale',
                        billId: existingBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: 0,  // Debit the VAT account
                        credit: vatAmount,         // Credit is 0 for VAT transactions
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

            // Create a transaction for the round-off amount
            if (roundOffAmount > 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: existingBill.billNumber,
                        isType: 'RoundOff',
                        type: 'Sale',
                        billId: existingBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: 0,  // Debit the VAT account
                        credit: roundOffAmount,         // Credit is 0 for VAT transactions
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

            if (roundOffAmount < 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: existingBill.billNumber,
                        isType: 'RoundOff',
                        type: 'Sale',
                        billId: existingBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: Math.abs(roundOffAmount),  // Debit the VAT account
                        credit: 0, // Ensure roundOffAmount is not saved as a negative value
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

            // If payment mode is cash, also create a transaction for the "Cash in Hand" account
            if (paymentMode === 'cash') {
                const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashAccount) {
                    const cashTransaction = new Transaction({
                        account: cashAccount._id,
                        cashAccount: cashAccount,
                        billNumber: existingBill.billNumber,
                        type: 'Sale',
                        billId: existingBill._id,
                        purchaseSalesType: 'Sales',
                        debit: finalAmount, // The cash amount received
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: 0, // Adjust with the correct balance logic
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });

                    await cashTransaction.save({ session });
                }
            }

            // Update bill with modified items
            // Flatten the bill items array (since each item may have multiple batches)
            const flattenedBillItems = billItems.flat();

            existingBill.items = flattenedBillItems;
            await existingBill.save({ session });

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            if (req.query.print === 'true') {
                return res.json({
                    success: true,
                    redirect: `/bills/${billId}/direct-print-edit`,
                    message: 'Bill updated successfully'
                });
            } else {
                return res.json({
                    success: true,
                    data: {
                        billId: existingBill._id,
                        billNumber: existingBill.billNumber,
                        cashAccount: {
                            name: cashAccount,
                            address: cashAccountAddress,
                            pan: cashAccountPan,
                            email: cashAccountEmail,
                            phone: cashAccountPhone
                        },
                        totalAmount: existingBill.totalAmount,
                        items: existingBill.items.map(item => ({
                            itemId: item.item,
                            quantity: item.quantity,
                            price: item.price,
                            batchNumber: item.batchNumber
                        })),
                        vatAmount: existingBill.vatAmount,
                        discountAmount: existingBill.discountAmount,
                        roundOffAmount: existingBill.roundOffAmount,
                        subTotal: existingBill.subTotal,
                        taxableAmount: existingBill.taxableAmount,
                        nonVatSales: existingBill.nonVatSales
                    },
                    message: 'Bill updated successfully'
                });
            }
        } catch (error) {
            console.error("Error updating bill:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                error: 'Error updating bill',
                details: error.message
            });
        }
    }
});

router.get('/sales/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            const bill = await SalesBill.findById(billId)
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

router.get('/sales-vat-report', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;
        const currentCompany = await Company.findById(new ObjectId(companyId));
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';

        // Extract dates from query parameters
        let fromDate = req.query.fromDate ? req.query.fromDate : null;
        let toDate = req.query.toDate ? req.query.toDate : null;

        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

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
                    salesVatReport: [],
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName,
                    user: req.user,
                    theme: req.user.preferences?.theme || 'light',
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

        const Bills = await SalesBill.find(query)
            .populate('account')
            .populate('cashAccount')
            .sort({ date: 1 });

        const salesVatReport = await Promise.all(Bills.map(async bill => {
            if (bill.account) {
                const account = await Account.findById(bill.account);
                return {
                    billNumber: bill.billNumber,
                    date: bill.date,
                    accountName: account ? account.name : 'N/A',
                    panNumber: account ? account.pan : 'N/A',
                    totalAmount: bill.totalAmount,
                    discountAmount: bill.discountAmount,
                    nonVatSales: bill.nonVatSales,
                    taxableAmount: bill.taxableAmount,
                    vatAmount: bill.vatAmount,
                    isCash: false
                };
            } else {
                return {
                    billNumber: bill.billNumber,
                    date: bill.date,
                    accountName: bill.cashAccount || 'Cash Sale',
                    panNumber: bill.cashAccountPan || 'N/A',
                    totalAmount: bill.totalAmount,
                    discountAmount: bill.discountAmount,
                    nonVatSales: bill.nonVatSales,
                    taxableAmount: bill.taxableAmount,
                    vatAmount: bill.vatAmount,
                    isCash: true
                };
            }
        }));

        res.json({
            success: true,
            data: {
                company,
                currentFiscalYear,
                salesVatReport,
                companyDateFormat,
                nepaliDate,
                currentCompany,
                fromDate: req.query.fromDate || '',
                toDate: req.query.toDate || '',
                currentCompanyName,
                user: req.user,
                theme: req.user.preferences?.theme || 'light',
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        });

    } catch (error) {
        console.error('Error in sales-vat-report:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

router.get('/statement', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const currentCompany = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat address ward pan city country email phone').populate('fiscalYear');
            const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';
            const selectedCompany = req.query.account || '';
            const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
            const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
            const paymentMode = req.query.paymentMode || 'all';
            const currentCompanyName = req.session.currentCompanyName;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');

            // Retrieve the fiscal year from the session
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            if (!currentFiscalYear && currentCompany.fiscalYear) {
                currentFiscalYear = currentCompany.fiscalYear;
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

            // Fetch accounts
            const accounts = await Account.find({
                company: companyId,
                isActive: true,
                $or: [
                    { originalFiscalYear: fiscalYear },
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear }
                    }
                ]
            }).sort({ name: 1 });

            if (!selectedCompany) {
                return res.json({
                    status: 'success',
                    data: {
                        company: currentCompany,
                        currentFiscalYear,
                        statement: [],
                        accounts,
                        selectedCompany: null,
                        fromDate: req.query.fromDate || '',
                        toDate: req.query.toDate || '',
                        paymentMode,
                        companyDateFormat,
                        nepaliDate,
                        currentCompanyName,
                        currentCompany,
                        user: {
                            preferences: req.user.preferences,
                            isAdmin: req.user.isAdmin,
                            role: req.user.role
                        },
                        totalDebit: 0,
                        totalCredit: 0,
                        openingBalance: 0
                    }
                });
            }

            // Fetch the selected account
            const account = await Account.findOne({
                _id: selectedCompany,
                company: companyId,
                isActive: true,
                $or: [
                    { originalFiscalYear: fiscalYear },
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear }
                    }
                ]
            }).populate('companyGroups', 'name').lean();

            if (!account) {
                return res.status(404).json({ error: 'Account not found for the current fiscal year' });
            }

            // Query to filter transactions
            let query = {
                company: companyId,
                isActive: true,
            };

            // Date filtering
            if (fromDate && toDate) {
                query.date = { $gte: fromDate, $lte: toDate };
            } else if (fromDate) {
                query.date = { $gte: fromDate };
            } else if (toDate) {
                query.date = { $lte: toDate };
            }

            if (selectedCompany) {
                query.$or = [
                    { account: selectedCompany },
                    { paymentAccount: selectedCompany },
                    { receiptAccount: selectedCompany },
                    { debitAccount: selectedCompany },
                    { creditAccount: selectedCompany },
                ];
            }

            if (paymentMode === 'exclude-cash') {
                query.paymentMode = { $ne: 'cash' };
            } else if (paymentMode !== 'all') {
                query.paymentMode = paymentMode;
            }

            // Define transaction-based groups
            // const transactionBasedGroups = [
            //     'Sundry Debtors',
            //     'Sundry Creditors',
            //     'Cash in Hand',
            //     'Bank Accounts',
            //     'Bank O/D Account',
            //     'Duties & Taxes',
            //     'Current Assets',
            //     'Expenses (Direct/Mfg.)',
            //     'Expenses (Indirect/Admn.)',
            //     'Fixed Assets',
            //     'Income (Direct/Opr.)',
            //     'Income (Indirect)',
            //     'Loans & Advances',
            //     'Profit & Loss',
            //     'Provisions/Expenses Payable',
            //     'Purchase',
            //     'Reserves & Surplus',
            //     'Sale',
            //     'Secured Loans',
            //     'Securities & Deposits',
            //     'Stock in hand',
            //     'Sundry Creditors',
            // ];

            // const isTransactionBased = account.companyGroups &&
            //     transactionBasedGroups.includes(account.companyGroups.name);

            let openingBalance = 0;

            // Calculate opening balance
            // if (isTransactionBased) {
            // Create a query for transactions before fromDate (for opening balance)
            const openingBalanceQuery = {
                company: companyId,
                isActive: true,
                $or: [
                    { account: selectedCompany },
                    { paymentAccount: selectedCompany },
                    { receiptAccount: selectedCompany },
                    { debitAccount: selectedCompany },
                    { creditAccount: selectedCompany },
                ],
                date: { $lt: fromDate }
            };

            // Don't apply payment mode filter for opening balance calculation
            // We need ALL transactions before the from date to calculate the correct opening balance

            const transactionsBeforeFromDate = await Transaction.find(openingBalanceQuery)
                .sort({ date: 1, createdAt: 1 })
                .lean();

            // Start with the initial opening balance from the account
            openingBalance = account.initialOpeningBalance.type === 'Dr'
                ? account.initialOpeningBalance.amount
                : -account.initialOpeningBalance.amount;

            // Use a Set to track processed transactions and avoid duplicates
            const processedTransactions = new Set();

            // Calculate running balance from all transactions before fromDate
            transactionsBeforeFromDate.forEach(tx => {
                // Create a unique identifier for this transaction to avoid duplicates
                const txIdentifier = `${tx.date}-${tx.type}-${tx.billNumber}-${tx.debit}-${tx.credit}`;

                if (!processedTransactions.has(txIdentifier)) {
                    processedTransactions.add(txIdentifier);

                    // Determine if this transaction affects the selected account as debit or credit
                    let amount = 0;

                    if (tx.account && tx.account.toString() === selectedCompany) {
                        // Standard transaction
                        amount = (tx.debit || 0) - (tx.credit || 0);
                    } else if (tx.paymentAccount && tx.paymentAccount.toString() === selectedCompany) {
                        // Payment transaction
                        amount = -(tx.amount || 0);
                    } else if (tx.receiptAccount && tx.receiptAccount.toString() === selectedCompany) {
                        // Receipt transaction
                        amount = (tx.amount || 0);
                    } else if (tx.debitAccount && tx.debitAccount.toString() === selectedCompany) {
                        // Journal debit
                        amount = (tx.amount || 0);
                    } else if (tx.creditAccount && tx.creditAccount.toString() === selectedCompany) {
                        // Journal credit
                        amount = -(tx.amount || 0);
                    }

                    openingBalance += amount;
                }
            });
            // } else {
            //     // For non-transaction based accounts, use the stored opening balance
            //     openingBalance = account.openingBalance.type === 'Dr'
            //         ? account.openingBalance.amount
            //         : -account.openingBalance.amount;
            // }

            const filteredTransactions = await Transaction.find(query)
                .sort({ date: 1 })
                .populate('paymentAccount', 'name')
                .populate('receiptAccount', 'name')
                .populate('debitAccount', 'name')
                .populate('creditAccount', 'name')
                .populate('account', 'name')
                .populate('accountType', 'name')
                .lean();

            const cleanTransactions = filteredTransactions.map(tx => ({
                ...tx,
                paymentAccount: tx.paymentAccount ? { name: tx.paymentAccount.name } : null,
                receiptAccount: tx.receiptAccount ? { name: tx.receiptAccount.name } : null,
                debitAccount: tx.debitAccount ? { name: tx.debitAccount.name } : null,
                creditAccount: tx.creditAccount ? { name: tx.creditAccount.name } : null,
                account: tx.account ? { name: tx.account.name } : null,
                accountType: tx.accountType ? { name: tx.accountType.name } : 'Opening Balance'
            }));

            const { statement, totalDebit, totalCredit } = prepareStatementWithOpeningBalanceAndTotals(
                openingBalance,
                cleanTransactions,
                fromDate,
                paymentMode,
                // isTransactionBased
            );

            const partyName = account.name;

            // Return JSON response instead of rendering template
            res.json({
                status: 'success',
                data: {
                    currentFiscalYear,
                    statement,
                    accounts,
                    partyName,
                    selectedCompany,
                    account,
                    fromDate: req.query.fromDate,
                    toDate: req.query.toDate,
                    paymentMode,
                    company: currentCompany,
                    totalDebit,
                    totalCredit,
                    openingBalance,
                    currentCompanyName,
                    companyDateFormat,
                    nepaliDate,
                    currentCompany,
                    user: {
                        preferences: req.user.preferences,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role
                    }
                }
            });

        } catch (error) {
            console.error("Error fetching statement:", error);
            res.status(500).json({ error: 'Error fetching statement' });
        }
    }
});


function prepareStatementWithOpeningBalanceAndTotals(openingBalance, transactions, fromDate, paymentMode, isTransactionBased) {
    let balance = openingBalance;
    let totalDebit = paymentMode !== 'cash' && 0 > 0 ? 0 : 0;
    let totalCredit = paymentMode !== 'cash' && 0 < 0 ? 0 : 0;

    const statement = paymentMode !== 'cash' ? [
        {
            date: fromDate ? fromDate.toISOString().split('T')[0] : '',
            type: '',
            billNumber: '',
            paymentMode: '',
            paymentAccount: '',
            receiptAccount: '',
            debitAccount: '',
            creditAccount: '',
            accountType: 'Opening Balance',
            purchaseSalesType: '',
            purchaseSalesReturnType: '',
            journalAccountType: '',
            drCrNoteAccountType: '',
            InstType: '',
            InstNo: '',
            account: '',
            debit: 0,
            credit: 0,
            balance: openingBalance,
            billId: '',
            purchaseBillId: '',
            purchaseReturnBillId: '',
            paymentAccountId: '',
            receiptAccountId: '',
            journalBillId: '',
            debitNoteId: ''
        }
    ] : [];

    const transactionsByBill = transactions.reduce((acc, tx) => {
        let billId = tx.billId || tx.purchaseBillId || tx.salesReturnBillId || tx.purchaseReturnBillId || tx.journalBillId || tx.debitNoteId || tx.creditNoteId || tx.paymentAccountId || tx.receiptAccountId;

        if (!acc[billId]) {
            acc[billId] = {
                date: tx.date,
                type: tx.type,
                billNumber: tx.billNumber,
                paymentMode: tx.paymentMode,
                partyBillNumber: tx.partyBillNumber,
                paymentAccount: tx.paymentAccount,
                receiptAccount: tx.receiptAccount,
                debitAccount: tx.debitAccount,
                creditAccount: tx.creditAccount,
                accountType: tx.accountType,
                purchaseSalesType: tx.purchaseSalesType,
                purchaseSalesReturnType: tx.purchaseSalesReturnType,
                journalAccountType: tx.journalAccountType,
                drCrNoteAccountType: tx.drCrNoteAccountType,
                InstType: tx.InstType,
                InstNo: tx.InstNo,
                account: tx.account,
                debit: 0,
                credit: 0,
                balance: 0,
                billId: tx.billId,
                purchaseBillId: tx.purchaseBillId,
                purchaseReturnBillId: tx.purchaseReturnBillId,
                paymentAccountId: tx.paymentAccountId,
                receiptAccountId: tx.receiptAccountId,
                journalBillId: tx.journalBillId,
                debitNoteId: tx.debitNoteId
            };
        }
        acc[billId].debit = tx.debit || 0;
        acc[billId].credit = tx.credit || 0;
        return acc;
    }, {});

    // Process grouped transactions
    Object.values(transactionsByBill).forEach(tx => {
        balance += (tx.debit || 0) - (tx.credit || 0);
        totalDebit += tx.debit || 0;
        totalCredit += tx.credit || 0;

        statement.push({
            date: tx.date,
            type: tx.type,
            billNumber: tx.billNumber,
            paymentMode: tx.paymentMode,
            partyBillNumber: tx.partyBillNumber,
            paymentAccount: tx.paymentAccount,
            receiptAccount: tx.receiptAccount,
            debitAccount: tx.debitAccount,
            creditAccount: tx.creditAccount,
            accountType: tx.accountType,
            purchaseSalesType: tx.purchaseSalesType,
            purchaseSalesReturnType: tx.purchaseSalesReturnType,
            journalAccountType: tx.journalAccountType,
            drCrNoteAccountType: tx.drCrNoteAccountType,
            InstType: tx.InstType,
            InstNo: tx.InstNo,
            account: tx.account,
            debit: tx.debit,
            credit: tx.credit,
            balance: balance,
            billId: tx.billId,
            purchaseBillId: tx.purchaseBillId,
            purchaseReturnBillId: tx.purchaseReturnBillId,
            paymentAccountId: tx.paymentAccountId,
            receiptAccountId: tx.receiptAccountId,
            journalBillId: tx.journalBillId,
            debitNoteId: tx.debitNoteId
        });
    });

    return { statement, totalDebit, totalCredit };
}


// router.get('/statement', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     if (req.tradeType === 'retailer') {
//         try {
//             const companyId = req.session.currentCompany;
//             const currentCompany = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat address ward pan city country email phone').populate('fiscalYear');
//             const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';
//             const selectedCompany = req.query.account || '';
//             const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
//             const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
//             const paymentMode = req.query.paymentMode || 'all';
//             const currentCompanyName = req.session.currentCompanyName;
//             const today = new Date();
//             const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');

//             // Retrieve the fiscal year from the session
//             let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
//             let currentFiscalYear = null;

//             if (fiscalYear) {
//                 currentFiscalYear = await FiscalYear.findById(fiscalYear);
//             }

//             if (!currentFiscalYear && currentCompany.fiscalYear) {
//                 currentFiscalYear = currentCompany.fiscalYear;
//                 req.session.currentFiscalYear = {
//                     id: currentFiscalYear._id.toString(),
//                     startDate: currentFiscalYear.startDate,
//                     endDate: currentFiscalYear.endDate,
//                     name: currentFiscalYear.name,
//                     dateFormat: currentFiscalYear.dateFormat,
//                     isActive: currentFiscalYear.isActive
//                 };
//                 fiscalYear = req.session.currentFiscalYear.id;
//             }

//             if (!fiscalYear) {
//                 return res.status(400).json({ error: 'No fiscal year found in session or company.' });
//             }

//             // Fetch accounts
//             const accounts = await Account.find({
//                 company: companyId,
//                 isActive: true,
//                 $or: [
//                     { originalFiscalYear: fiscalYear },
//                     {
//                         fiscalYear: fiscalYear,
//                         originalFiscalYear: { $lt: fiscalYear }
//                     }
//                 ]
//             }).sort({ name: 1 });

//             if (!selectedCompany) {
//                 return res.json({
//                     status: 'success',
//                     data: {
//                         company: currentCompany,
//                         currentFiscalYear,
//                         statement: [],
//                         accounts,
//                         selectedCompany: null,
//                         fromDate: req.query.fromDate || '',
//                         toDate: req.query.toDate || '',
//                         paymentMode,
//                         companyDateFormat,
//                         nepaliDate,
//                         currentCompanyName,
//                         currentCompany,
//                         user: {
//                             preferences: req.user.preferences,
//                             isAdmin: req.user.isAdmin,
//                             role: req.user.role
//                         },
//                         totalDebit: 0,
//                         totalCredit: 0,
//                         openingBalance: 0
//                     }
//                 });
//             }

//             // Fetch the selected account
//             const account = await Account.findOne({
//                 _id: selectedCompany,
//                 company: companyId,
//                 isActive: true,
//                 $or: [
//                     { originalFiscalYear: fiscalYear },
//                     {
//                         fiscalYear: fiscalYear,
//                         originalFiscalYear: { $lt: fiscalYear }
//                     }
//                 ]
//             }).populate('companyGroups', 'name').lean();

//             if (!account) {
//                 return res.status(404).json({ error: 'Account not found for the current fiscal year' });
//             }

//             // Define transaction-based groups
//             const transactionBasedGroups = [
//                 'Sundry Debtors',
//                 'Sundry Creditors',
//                 'Cash in Hand',
//                 'Bank Accounts',
//                 'Bank O/D Account',
//                 'Duties & Taxes'
//             ];

//             let query = {
//                 company: companyId,
//                 isActive: true,
//             };

//             const isTransactionBased = account.companyGroups &&
//                 transactionBasedGroups.includes(account.companyGroups.name);

//             let openingBalance = 0;

//             // In your route handler, modify the opening balance calculation section:
// if (isTransactionBased) {
//     if (paymentMode !== 'cash') {
//         // Get the initial opening balance for the account
//         openingBalance = account.initialOpeningBalance.type === 'Dr'
//             ? account.initialOpeningBalance.amount
//             : -account.initialOpeningBalance.amount;

//         // If we have a fromDate, calculate transactions before fromDate
//         if (fromDate) {
//             const openingBalanceQuery = {
//                 company: companyId,
//                 fiscalYear: fiscalYear,
//                 isActive: true,
//                 date: { $lt: fromDate }, // Only transactions before fromDate
//                 $or: [
//                     { account: selectedCompany },
//                     { paymentAccount: selectedCompany },
//                     { receiptAccount: selectedCompany }
//                 ]
//             };

//             if (paymentMode === 'exclude-cash') {
//                 openingBalanceQuery.paymentMode = { $ne: 'cash' };
//             } else if (paymentMode !== 'all') {
//                 openingBalanceQuery.paymentMode = paymentMode;
//             }

//             // Get transactions before fromDate
//             const transactionsBeforeFromDate = await getAllStatementEntries(
//                 companyId,
//                 selectedCompany,
//                 null, // No start date
//                 new Date(fromDate.getTime() - 1), // End date is day before fromDate
//                 paymentMode,
//                 fiscalYear
//             );

//             // Add transactions to the opening balance
//             transactionsBeforeFromDate.forEach(tx => {
//                 openingBalance += (tx.debit || 0) - (tx.credit || 0);
//             });
//         }
//     }
// } else {
//     // For non-transaction based accounts, just use the initial opening balance
//     openingBalance = account.initialOpeningBalance.type === 'Dr'
//         ? account.initialOpeningBalance.amount
//         : -account.initialOpeningBalance.amount;
// }

//             // Get transactions for the selected date range
//             const transactions = await getAllStatementEntries(
//                 companyId,
//                 selectedCompany,
//                 fromDate,
//                 toDate,
//                 paymentMode,
//                 fiscalYear
//             );

//             // Format transactions to match the expected frontend format
//             const formattedTransactions = transactions.map(tx => ({
//                 date: tx.date,
//                 type: tx.type,
//                 billNumber: tx.billNumber,
//                 paymentMode: tx.paymentMode,
//                 partyBillNumber: tx.partyBillNumber,
//                 paymentAccount: tx.paymentAccount ? { name: tx.paymentAccount } : null,
//                 receiptAccount: tx.receiptAccount ? { name: tx.receiptAccount } : null,
//                 debitAccount: tx.debitAccount ? { name: tx.debitAccount } : null,
//                 creditAccount: tx.creditAccount ? { name: tx.creditAccount } : null,
//                 account: tx.account ? { name: tx.account } : null,
//                 accountType: tx.accountType ? { name: tx.accountType } : 'Opening Balance',
//                 purchaseSalesType: tx.type,
//                 purchaseSalesReturnType: tx.type,
//                 journalAccountType: tx.type,
//                 drCrNoteAccountType: tx.type,
//                 paymentReceiptAccountType: tx.type,
//                 debit: tx.debit,
//                 credit: tx.credit,
//                 billId: tx.billNumber
//             }));

//             const { statement, totalDebit, totalCredit } = prepareStatementWithOpeningBalanceAndTotals(
//                 openingBalance,
//                 formattedTransactions,
//                 fromDate,
//                 paymentMode,
//                 isTransactionBased
//             );

//             const partyName = account.name;

//             // Return JSON response instead of rendering template
//             res.json({
//                 status: 'success',
//                 data: {
//                     currentFiscalYear,
//                     statement,
//                     accounts,
//                     partyName,
//                     selectedCompany,
//                     account,
//                     fromDate: req.query.fromDate,
//                     toDate: req.query.toDate,
//                     paymentMode,
//                     company: currentCompany,
//                     totalDebit,
//                     totalCredit,
//                     openingBalance,
//                     currentCompanyName,
//                     companyDateFormat,
//                     nepaliDate,
//                     currentCompany,
//                     user: {
//                         preferences: req.user.preferences,
//                         isAdmin: req.user.isAdmin,
//                         role: req.user.role
//                     }
//                 }
//             });

//         } catch (error) {
//             console.error("Error fetching statement:", error);
//             res.status(500).json({ error: 'Error fetching statement' });
//         }
//     }
// });


// async function getAllStatementEntries(companyId, accountId, fromDate, toDate, paymentMode, fiscalYear) {
//     const entries = [];

//     // Date filter for queries
//     const dateFilter = {};
//     if (fromDate && toDate) {
//         dateFilter.date = { $gte: fromDate, $lte: toDate };
//     } else if (fromDate) {
//         dateFilter.date = { $gte: fromDate };
//     } else if (toDate) {
//         dateFilter.date = { $lte: toDate };
//     }

//     // Payment mode filter
//     if (paymentMode === 'exclude-cash') {
//         dateFilter.paymentMode = { $ne: 'cash' };
//     } else if (paymentMode !== 'all') {
//         dateFilter.paymentMode = paymentMode;
//     }

//     // Common query parameters
//     const commonQuery = {
//         company: companyId,
//         // fiscalYear: fiscalYear,
//         // isActive: true,
//         ...dateFilter
//     };

//     // 1. Sales Bills
//     const salesBills = await SalesBill.find({
//         ...commonQuery,
//         account: accountId,
//     }).populate('account', 'name').lean();

//     for (const bill of salesBills) {
//         entries.push({
//             date: bill.date,
//             type: 'Sale',
//             billNumber: bill.billNumber,
//             paymentMode: bill.paymentMode,
//             account: bill.account?.name,
//             accountType: bill.purchaseSalesType,
//             debit: bill.totalAmount,
//             credit: 0
//         });
//     }

//     // 2. Purchase Bills
//     // const purchaseBills = await PurchaseBill.find({
//     //     ...commonQuery,
//     //     account: accountId,
//     // }).populate('account', 'name').lean();

//     // for (const bill of purchaseBills) {
//     //     entries.push({
//     //         date: bill.date,
//     //         type: 'Purc',
//     //         billNumber: bill.billNumber,
//     //         partyBillNumber: bill.partyBillNumber,
//     //         paymentMode: bill.paymentMode,
//     //         account: bill.account?.name,
//     //         accountType: bill.purchaseSalesType,
//     //         debit: 0,
//     //         credit: bill.totalAmount
//     //     });
//     // }


//     // 2. Purchase Bills - Query for bills that affect the selected account
//     const purchaseBills = await PurchaseBill.find({
//         ...commonQuery,
//         $or: [
//             { account: accountId }, // Vendor account
//             { vatAccount: accountId }, // VAT account
//             { purchaseAccount: accountId }, // Purchase account
//             { roundOffAccount: accountId }
//         ]
//     }).populate('account', 'name')
//         .populate('vatAccount', 'name')
//         .populate('purchaseAccount', 'name')
//         .populate('roundOffAccount', 'name')
//         .lean();

//     for (const bill of purchaseBills) {
//         // Vendor account entry (credit)
//         if (bill.account && bill.account._id.toString() === accountId) {
//             entries.push({
//                 date: bill.date,
//                 type: 'Purc',
//                 billNumber: bill.billNumber,
//                 partyBillNumber: bill.partyBillNumber,
//                 paymentMode: bill.paymentMode,
//                 account: bill.account?.name,
//                 accountType: bill.purchaseSalesType,
//                 debit: 0,
//                 credit: bill.totalAmount
//             });
//         }

//         // VAT account entry (debit)
//         if (bill.vatAccount && bill.vatAccount._id.toString() === accountId && bill.vatAmount > 0) {
//             entries.push({
//                 date: bill.date,
//                 type: 'Purc',
//                 billNumber: bill.billNumber,
//                 partyBillNumber: bill.partyBillNumber,
//                 paymentMode: bill.paymentMode,
//                 account: bill.vatAccount?.name,
//                 accountType: bill.account?.name,
//                 debit: bill.vatAmount,
//                 credit: 0
//             });
//         }

//         // Purchase account entry (debit)
//         if (bill.purchaseAccount && bill.purchaseAccount._id.toString() === accountId) {
//             const purchaseAmount = (bill.taxableAmount || 0) + (bill.nonVatPurchase || 0);
//             if (purchaseAmount > 0) {
//                 entries.push({
//                     date: bill.date,
//                     type: 'Purc',
//                     billNumber: bill.billNumber,
//                     partyBillNumber: bill.partyBillNumber,
//                     paymentMode: bill.paymentMode,
//                     account: bill.purchaseAccount?.name,
//                     accountType: bill.account?.name,
//                     debit: purchaseAmount,
//                     credit: 0
//                 });
//             }
//         }
//         // Round Off account entry (debit or credit depending on the amount)
//         if (bill.roundOffAccount && bill.roundOffAccount._id.toString() === accountId && bill.roundOffAmount !== 0) {
//             // Determine if round off is debit or credit
//             // Typically, positive roundOffAmount is debit, negative is credit
//             // But this depends on your accounting logic
//             const isDebit = bill.roundOffAmount > 0;

//             entries.push({
//                 date: bill.date,
//                 type: 'Purc',
//                 billNumber: bill.billNumber,
//                 partyBillNumber: bill.partyBillNumber,
//                 paymentMode: bill.paymentMode,
//                 account: bill.roundOffAccount?.name,
//                 accountType: bill.account?.name,
//                 debit: isDebit ? Math.abs(bill.roundOffAmount) : 0,
//                 credit: isDebit ? 0 : Math.abs(bill.roundOffAmount)
//             });
//         }
//     }

//     // 3. Sales Returns
//     const salesReturns = await SalesReturn.find({
//         ...commonQuery,
//         account: accountId,
//     }).populate('account', 'name').lean();

//     for (const returnBill of salesReturns) {
//         entries.push({
//             date: returnBill.date,
//             type: 'SlRt',
//             billNumber: returnBill.billNumber,
//             paymentMode: returnBill.paymentMode,
//             account: returnBill.account?.name,
//             accountType: returnBill.purchaseSalesReturnType,
//             debit: 0,
//             credit: returnBill.totalAmount
//         });
//     }

//     // 4. Purchase Returns
//     const purchaseReturns = await PurchaseReturn.find({
//         ...commonQuery,
//         account: accountId,
//     }).populate('account', 'name').lean();

//     for (const returnBill of purchaseReturns) {
//         entries.push({
//             date: returnBill.date,
//             type: 'PrRt',
//             billNumber: returnBill.billNumber,
//             partyBillNumber: returnBill.partyBillNumber,
//             paymentMode: returnBill.paymentMode,
//             account: returnBill.account?.name,
//             accountType: returnBill.purchaseSalesReturnType,
//             debit: returnBill.totalAmount,
//             credit: 0
//         });
//     }

//     // // 5. Payments
//     // const payments = await Payment.find({
//     //     ...commonQuery,
//     //     account: accountId,
//     //     isActive: true,
//     // }).populate('account', 'name').populate('paymentAccount', 'name').lean();

//     // for (const payment of payments) {
//     //     entries.push({
//     //         date: payment.date,
//     //         type: 'Pymt',
//     //         billNumber: payment.billNumber,
//     //         paymentMode: 'Payment',
//     //         account: payment.account?.name,
//     //         accountType: payment.paymentAccount?.name,
//     //         debit: payment.debit,
//     //         credit: payment.credit
//     //     });
//     // }

//     // 5. Payments
//     const payments = await Payment.find({
//         ...commonQuery,
//         $or: [
//             { account: accountId }, // Payments where this account is the main account
//             { paymentAccount: accountId } // Payments where this account is the payment account
//         ],
//         isActive: true,
//     }).populate('account', 'name').populate('paymentAccount', 'name').lean();

//     for (const payment of payments) {
//         // If this account is the main account (receiving payment)
//         if (payment.account && payment.account._id.toString() === accountId) {
//             entries.push({
//                 date: payment.date,
//                 type: 'Pymt',
//                 billNumber: payment.billNumber,
//                 paymentMode: 'Payment',
//                 account: payment.account?.name,
//                 accountType: payment.paymentAccount?.name,
//                 debit: payment.debit,  // This account receives debit
//                 credit: payment.credit // This account receives credit
//             });
//         }

//         // If this account is the payment account (source of payment)
//         if (payment.paymentAccount && payment.paymentAccount._id.toString() === accountId) {
//             entries.push({
//                 date: payment.date,
//                 type: 'Pymt',
//                 billNumber: payment.billNumber,
//                 paymentMode: 'Payment',
//                 account: payment.paymentAccount?.name,
//                 accountType: payment.account?.name,
//                 debit: payment.credit,  // Reverse the transaction for payment account
//                 credit: payment.debit   // Reverse the transaction for payment account
//             });
//         }
//     }

//     // // 6. Receipts
//     // const receipts = await Receipt.find({
//     //     ...commonQuery,
//     //     account: accountId,
//     //     isActive: true,
//     // }).populate('account', 'name').populate('receiptAccount', 'name').lean();

//     // for (const receipt of receipts) {
//     //     entries.push({
//     //         date: receipt.date,
//     //         type: 'Rcpt',
//     //         billNumber: receipt.billNumber,
//     //         paymentMode: 'Receipt',
//     //         account: receipt.account?.name,
//     //         accountType: receipt.receiptAccount?.name,
//     //         debit: receipt.debit,
//     //         credit: receipt.credit
//     //     });
//     // }

//     // 6. Receipts
//     const receipts = await Receipt.find({
//         ...commonQuery,
//         $or: [
//             { account: accountId }, // Receipts where this account is the main account
//             { receiptAccount: accountId } // Receipts where this account is the receipt account
//         ],
//         isActive: true,
//     }).populate('account', 'name').populate('receiptAccount', 'name').lean();

//     for (const receipt of receipts) {
//         // If this account is the main account (receiving receipt)
//         if (receipt.account && receipt.account._id.toString() === accountId) {
//             entries.push({
//                 date: receipt.date,
//                 type: 'Rcpt',
//                 billNumber: receipt.billNumber,
//                 paymentMode: 'Receipt',
//                 account: receipt.account?.name,
//                 accountType: receipt.receiptAccount?.name,
//                 debit: receipt.debit,  // This account receives debit
//                 credit: receipt.credit // This account receives credit
//             });
//         }

//         // If this account is the receipt account (source of receipt)
//         if (receipt.receiptAccount && receipt.receiptAccount._id.toString() === accountId) {
//             entries.push({
//                 date: receipt.date,
//                 type: 'Rcpt',
//                 billNumber: receipt.billNumber,
//                 paymentMode: 'Receipt',
//                 account: receipt.receiptAccount?.name,
//                 accountType: receipt.account?.name,
//                 debit: receipt.credit,  // Reverse the transaction for receipt account
//                 credit: receipt.debit   // Reverse the transaction for receipt account
//             });
//         }
//     }

//     // 7. Journal Vouchers
//     const journalVouchers = await JournalVoucher.find({
//         ...commonQuery,
//         $or: [
//             { 'debitAccounts.account': accountId },
//             { 'creditAccounts.account': accountId }
//         ]
//     }).populate('debitAccounts.account', 'name').populate('creditAccounts.account', 'name').lean();

//     for (const journal of journalVouchers) {
//         // Check debit accounts
//         const debitEntry = journal.debitAccounts.find(acc => acc.account._id.toString() === accountId);
//         if (debitEntry) {
//             entries.push({
//                 date: journal.date,
//                 type: 'Jrnl',
//                 billNumber: journal.billNumber,
//                 paymentMode: 'Journal',
//                 accountType: 'Journal Entry',
//                 debit: debitEntry.debit,
//                 credit: 0
//             });
//         }

//         // Check credit accounts
//         const creditEntry = journal.creditAccounts.find(acc => acc.account._id.toString() === accountId);
//         if (creditEntry) {
//             entries.push({
//                 date: journal.date,
//                 type: 'Jrnl',
//                 billNumber: journal.billNumber,
//                 paymentMode: 'Journal',
//                 accountType: 'Journal Entry',
//                 debit: 0,
//                 credit: creditEntry.credit
//             });
//         }
//     }

//     // 8. Debit Notes
//     const debitNotes = await DebitNote.find({
//         ...commonQuery,
//         $or: [
//             { 'debitAccounts.account': accountId },
//             { 'creditAccounts.account': accountId }
//         ]
//     }).populate('debitAccounts.account', 'name').populate('creditAccounts.account', 'name').lean();

//     for (const note of debitNotes) {
//         // Check debit accounts
//         const debitEntry = note.debitAccounts.find(acc => acc.account._id.toString() === accountId);
//         if (debitEntry) {
//             entries.push({
//                 date: note.date,
//                 type: 'DrNt',
//                 billNumber: note.billNumber,
//                 paymentMode: 'Dr Note',
//                 accountType: 'Debit Note',
//                 debit: debitEntry.debit,
//                 credit: 0
//             });
//         }

//         // Check credit accounts
//         const creditEntry = note.creditAccounts.find(acc => acc.account._id.toString() === accountId);
//         if (creditEntry) {
//             entries.push({
//                 date: note.date,
//                 type: 'DrNt',
//                 billNumber: note.billNumber,
//                 paymentMode: 'Dr Note',
//                 accountType: 'Debit Note',
//                 debit: 0,
//                 credit: creditEntry.credit
//             });
//         }
//     }

//     // 9. Credit Notes
//     const creditNotes = await CreditNote.find({
//         ...commonQuery,
//         $or: [
//             { 'debitAccounts.account': accountId },
//             { 'creditAccounts.account': accountId }
//         ]
//     }).populate('debitAccounts.account', 'name').populate('creditAccounts.account', 'name').lean();

//     for (const note of creditNotes) {
//         // Check debit accounts
//         const debitEntry = note.debitAccounts.find(acc => acc.account._id.toString() === accountId);
//         if (debitEntry) {
//             entries.push({
//                 date: note.date,
//                 type: 'CrNt',
//                 billNumber: note.billNumber,
//                 paymentMode: 'Cr Note',
//                 accountType: 'Credit Note',
//                 debit: debitEntry.debit,
//                 credit: 0
//             });
//         }

//         // Check credit accounts
//         const creditEntry = note.creditAccounts.find(acc => acc.account._id.toString() === accountId);
//         if (creditEntry) {
//             entries.push({
//                 date: note.date,
//                 type: 'CrNt',
//                 billNumber: note.billNumber,
//                 paymentMode: 'Cr Note',
//                 accountType: 'Credit Note',
//                 debit: 0,
//                 credit: creditEntry.credit
//             });
//         }
//     }

//     return entries.sort((a, b) => new Date(a.date) - new Date(b.date));
// }

// function prepareStatementWithOpeningBalanceAndTotals(openingBalance, transactions, fromDate, paymentMode, isTransactionBased) {
//     let balance = openingBalance;
//     let totalDebit = paymentMode !== 'cash' && openingBalance > 0 ? openingBalance : 0;
//     let totalCredit = paymentMode !== 'cash' && openingBalance < 0 ? -openingBalance : 0;

//     const statement = paymentMode !== 'cash' ? [
//         {
//             date: fromDate ? fromDate.toISOString().split('T')[0] : '',
//             type: '',
//             billNumber: '',
//             paymentMode: '',
//             paymentAccount: '',
//             receiptAccount: '',
//             debitAccount: '',
//             creditAccount: '',
//             accountType: 'Opening Balance',
//             purchaseSalesType: '',
//             purchaseSalesReturnType: '',
//             journalAccountType: '',
//             drCrNoteAccountType: '',
//             account: '',
//             debit: 0,
//             credit: 0,
//             balance: openingBalance,
//             billId: ''
//         }
//     ] : [];

//     const transactionsByBill = transactions.reduce((acc, tx) => {
//         let billId = tx.billId || tx.billNumber;

//         if (!acc[billId]) {
//             acc[billId] = {
//                 date: tx.date,
//                 type: tx.type,
//                 billNumber: tx.billNumber,
//                 paymentMode: tx.paymentMode,
//                 partyBillNumber: tx.partyBillNumber,
//                 paymentAccount: tx.paymentAccount,
//                 receiptAccount: tx.receiptAccount,
//                 debitAccount: tx.debitAccount,
//                 creditAccount: tx.creditAccount,
//                 accountType: tx.accountType,
//                 purchaseSalesType: tx.purchaseSalesType,
//                 purchaseSalesReturnType: tx.purchaseSalesReturnType,
//                 journalAccountType: tx.journalAccountType,
//                 drCrNoteAccountType: tx.drCrNoteAccountType,
//                 account: tx.account,
//                 debit: 0,
//                 credit: 0,
//                 balance: 0,
//                 billId: tx.billId
//             };
//         }
//         acc[billId].debit += tx.debit || 0;
//         acc[billId].credit += tx.credit || 0;
//         return acc;
//     }, {});

//     // Process grouped transactions
//     Object.values(transactionsByBill).forEach(tx => {
//         balance += (tx.debit || 0) - (tx.credit || 0);
//         totalDebit += tx.debit || 0;
//         totalCredit += tx.credit || 0;

//         statement.push({
//             date: tx.date,
//             type: tx.type,
//             billNumber: tx.billNumber,
//             paymentMode: tx.paymentMode,
//             partyBillNumber: tx.partyBillNumber,
//             paymentAccount: tx.paymentAccount,
//             receiptAccount: tx.receiptAccount,
//             debitAccount: tx.debitAccount,
//             creditAccount: tx.creditAccount,
//             accountType: tx.accountType,
//             purchaseSalesType: tx.purchaseSalesType,
//             purchaseSalesReturnType: tx.purchaseSalesReturnType,
//             journalAccountType: tx.journalAccountType,
//             drCrNoteAccountType: tx.drCrNoteAccountType,
//             account: tx.account,
//             debit: tx.debit,
//             credit: tx.credit,
//             balance: balance,
//             billId: tx.billId,
//         });
//     });

//     return { statement, totalDebit, totalCredit };
// }

module.exports = router;