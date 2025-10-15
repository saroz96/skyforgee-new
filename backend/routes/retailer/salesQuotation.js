
const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Item = require('../../models/retailer/Item');
const Unit = require('../../models/retailer/Unit');
const Transaction = require('../../models/retailer/Transaction');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const BillCounter = require('../../models/retailer/billCounter');
const Account = require('../../models/retailer/Account');
const Settings = require('../../models/retailer/Settings');
const Company = require('../../models/Company');
const NepaliDate = require('nepali-date');
const { ensureTradeType } = require('../../middleware/tradeType');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const FiscalYear = require('../../models/FiscalYear');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const CompanyGroup = require('../../models/retailer/CompanyGroup');
const Category = require('../../models/retailer/Category');
const itemsCompany = require('../../models/retailer/itemsCompany');
const Composition = require('../../models/retailer/Composition');
const MainUnit = require('../../models/retailer/MainUnit');
const SalesQuotation = require('../../models/retailer/SalesQuotation');

// Fetch all sales quotations
router.get('/sales-quotation/register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
                        salesQuotations: [],
                        currentCompany: currentCompany,
                        companyDateFormat: companyDateFormat,
                        fromDate: currentFiscalYear.startDate, // Set default to fiscal year start
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

            const salesQuotations = await SalesQuotation.find(query)
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
                    salesQuotations: salesQuotations,
                    currentCompany: currentCompany,
                    companyDateFormat: companyDateFormat,
                    currentCompanyName,
                    vatEnabled,
                    isVatExempt,
                    fromDate: fromDate,
                    toDate: toDate,
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
        console.error('Error fetching sales quotations:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

router.get('/sales-quotation', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            salesQuotations,
            items,
            lastCounter,
            fiscalYears,
            categories,
            units,
            itemsCompanies,
            composition,
            mainUnits,
            companyGroups,
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            SalesQuotation.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            Item.find({ company: companyId, status: 'active' }).populate('category').populate('unit').populate('mainUnit').populate('stockEntries'),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'salesQuotation'
            }),
            FiscalYear.findById(req.session.currentFiscalYear?.id),
            Category.find({ company: companyId }),
            Unit.find({ company: companyId }),
            itemsCompany.find({ company: companyId }),
            Composition.find({ company: companyId }),
            MainUnit.find({ company: companyId }),
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
        const prefix = fiscalYears.billPrefixes.salesQuotation;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        // Fetch only the required company groups: Sundry Debtors
        const relevantGroups = await CompanyGroup.find({
            name: { $in: ['Sundry Debtors', 'Sundry Creditors', 'Cash in Hand'] }
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
                salesQuotations: salesQuotations.map(quotation => ({
                    _id: quotation._id,
                    quotationNumber: quotation.quotationNumber,
                    account: quotation.account,
                    items: quotation.items,
                    totalAmount: quotation.totalAmount,
                    discount: quotation.discount,
                    taxableAmount: quotation.taxableAmount,
                    vatAmount: quotation.vatAmount,
                    grandTotal: quotation.grandTotal,
                    transactionDate: quotation.transactionDate
                })),
                nextQuotationNumber: nextBillNumber,
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
        console.error('Error in /sales-quotation route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.post('/sales-quotation', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
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
            description,
            roundOffAmount: manualRoundOffAmount
        } = req.body;

        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        // Validate required fields
        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Company ID is required.'
            });
        }

        if (isVatExempt === undefined || isVatExempt === null) {
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
        const discount = parseFloat(discountPercentage) || 0;

        let subTotal = 0;
        let vatAmount = 0;
        let totalTaxableAmount = 0;
        let totalNonTaxableAmount = 0;
        let hasVatableItems = false;
        let hasNonVatableItems = false;

        // Validate account
        const account = await Account.findOne({ _id: accountId, company: companyId }).session(session);
        if (!account) {
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
                return res.status(400).json({
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
        }

        // Validate VAT conditions
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

        // Calculate discounts and amounts
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

        // Handle round off
        let roundOffForSales = await Settings.findOne({
            company: companyId,
            userId,
            fiscalYear: currentFiscalYear
        }).session(session);

        let roundOffAmount = 0;
        if (roundOffForSales?.roundOffSales) {
            finalAmount = Math.round(finalAmount.toFixed(2));
            roundOffAmount = finalAmount - totalAmount;
        } else if (manualRoundOffAmount && !roundOffForSales?.roundOffSales) {
            roundOffAmount = parseFloat(manualRoundOffAmount);
            finalAmount = totalAmount + roundOffAmount;
        }

        // Generate bill number
        const newBillNumber = await getNextBillNumber(companyId, fiscalYearId, 'salesQuotation', session);

        // Prepare bill items
        const billItems = await Promise.all(items.map(async (item) => {
            const product = await Item.findById(item.item).session(session);
            return {
                item: product._id,
                quantity: item.quantity,
                price: item.price,
                unit: item.unit,
                vatStatus: product.vatStatus,
                description: item.description,
                fiscalYear: fiscalYearId,
            };
        }));

        // Create new quotation
        const newQuotation = new SalesQuotation({
            billNumber: newBillNumber,
            account: accountId,
            purchaseSalesType: 'SalesQuotation',
            items: billItems,
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
            description,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear
        });

        await newQuotation.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Prepare response
        const responseData = {
            success: true,
            data: {
                quotation: {
                    _id: newQuotation._id,
                    billNumber: newQuotation.billNumber,
                    account: newQuotation.account,
                    items: newQuotation.items,
                    subTotal: newQuotation.subTotal,
                    discountPercentage: newQuotation.discountPercentage,
                    discountAmount: newQuotation.discountAmount,
                    taxableAmount: newQuotation.taxableAmount,
                    vatAmount: newQuotation.vatAmount,
                    totalAmount: newQuotation.totalAmount,
                    roundOffAmount: newQuotation.roundOffAmount,
                    paymentMode: newQuotation.paymentMode,
                    description: newQuotation.description,
                    transactionDate: newQuotation.transactionDate,
                    date: newQuotation.date
                },
                printUrl: `/retailer/sales-quotation/${newQuotation._id}/direct-print`
            }
        };

        if (req.query.print === 'true') {
            responseData.print = true;
        }

        return res.status(201).json(responseData);

    } catch (error) {
        // Handle errors
        await session.abortTransaction();
        session.endSession();

        console.error('Error while creating sales quotation:', error);

        return res.status(500).json({
            success: false,
            error: 'An error occurred while processing the quotation',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


router.get('/sales-quotation/finds', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            const latestBill = await SalesQuotation.findOne({
                company: companyId,
                fiscalYear: fiscalYear
            })
                .sort({ date: -1, billNumber: -1 }) // Sort by date descending, then billNumber descending
                .select('billNumber date')
                .lean();


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
            console.error('Error in /payments/finds:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        return res.status(400).json({ error: 'Invalid trade type' });
    }
});


// Get payment form by billNumber
router.get('/sales-quotation/edit/billNumber', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            const salesQuotation = await SalesQuotation.findOne({
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

            if (!salesQuotation) {
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
                    salesQuotation,
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
            console.error('Error fetching data for payments form:', error);
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

router.get('/sales-quotation/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

            // Fetch sales quotation with proper population
            const salesQuotation = await SalesQuotation.findOne({
                _id: billId,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate({
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

            if (!salesQuotation) {
                return res.status(404).json({
                    success: false,
                    error: 'Sales quotation not found or does not belong to the selected company'
                });
            }

            const processedItems = salesQuotation.items.map(item => {
                // Get fields from the referenced item document
                const itemData = item.item || {};

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
                    // Unit details (either from direct unit reference or item's unit)
                    unit: unit,
                    // Other fields from the sales quotation item
                    price: item.price,
                    quantity: item.quantity,
                    amount: (item.quantity * item.price).toFixed(2),
                    // Include the original item reference ID
                    item: item.item?._id || null
                };
            });

            // Fetch all items for the company (for dropdown) with stock and latest price
            const allItems = await Item.find({ company: companyId, status: 'active' })
                .populate([
                    { path: 'unit', select: 'name _id' },
                    { path: 'category', select: 'name _id' },
                    { path: 'stockEntries', select: 'quantity price date' }
                ])
                .select('name hscode uniqueNumber vatStatus unit price quantity stockEntries category')
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
                const latestPrice = latestStockEntry.price || item.price || 0;

                return {
                    ...item,
                    stock: totalStock,
                    latestPrice: Math.round(latestPrice * 100) / 100,
                    category: item.category || null
                };
            }).sort((a, b) => a.name.localeCompare(b.name));


            // Fetch only the required company groups: Sundry Debtors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors', 'Cash in Hand'] }
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
                    salesQuotation: {
                        ...salesQuotation,
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
            console.error('Error fetching sales quotation for edit:', error);
            res.status(500).json({
                success: false,
                error: 'Error fetching sales quotation for edit',
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


router.put('/sales-quotation/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { id } = req.params;
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
                roundOffAmount: manualRoundOffAmount
            } = req.body;

            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const userId = req.user._id;

            // Basic validations
            if (!mongoose.Types.ObjectId.isValid(id)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid quotation ID.'
                });
            }

            if (!companyId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Company ID is required.'
                });
            }

            // Find the existing quotation
            const existingQuotation = await SalesQuotation.findById(id).session(session);
            if (!existingQuotation) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    error: 'Quotation not found.'
                });
            }

            // Verify the quotation belongs to the current company
            if (existingQuotation.company.toString() !== companyId.toString()) {
                await session.abortTransaction();
                session.endSession();
                return res.status(403).json({
                    success: false,
                    error: 'Unauthorized access to quotation.'
                });
            }

            // Validate account
            const account = await Account.findOne({ _id: accountId, company: companyId }).session(session);
            if (!account) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid account for this company'
                });
            }

            // Process new items and calculate amounts
            let subTotal = 0;
            let vatAmount = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;
            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            const billItems = [];

            // Validate and process each new item
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({
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

                billItems.push({
                    item: product._id,
                    description: item.description,
                    quantity: item.quantity,
                    price: item.price,
                    unit: item.unit,
                    vatStatus: product.vatStatus,
                    fiscalYear: currentFiscalYear,
                });
            }

            // Check validation conditions after processing all items
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

            // Handle round off settings
            let roundOffForSales = await Settings.findOne({
                companyId, userId, fiscalYear: currentFiscalYear
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

            // Update the existing quotation
            existingQuotation.account = accountId;
            existingQuotation.items = billItems;
            existingQuotation.isVatExempt = isVatExemptBool;
            existingQuotation.isVatAll = isVatAll;
            existingQuotation.vatPercentage = isVatExemptBool ? 0 : vatPercentage;
            existingQuotation.subTotal = subTotal;
            existingQuotation.discountPercentage = discount;
            existingQuotation.discountAmount = discountForTaxable + discountForNonTaxable;
            existingQuotation.nonVatSales = finalNonTaxableAmount;
            existingQuotation.taxableAmount = finalTaxableAmount;
            existingQuotation.vatAmount = vatAmount;
            existingQuotation.totalAmount = finalAmount;
            existingQuotation.roundOffAmount = roundOffAmount;
            existingQuotation.paymentMode = paymentMode;
            existingQuotation.date = nepaliDate ? nepaliDate : new Date(billDate);
            existingQuotation.transactionDate = transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman);
            existingQuotation.updatedAt = new Date();

            await existingQuotation.save({ session });

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            // Return the updated quotation data
            const updatedQuotation = await SalesQuotation.findById(id)
                .populate({ path: 'items.item' })
                .populate('items.unit')
                .populate('account');

            res.json({
                success: true,
                data: {
                    quotation: {
                        ...updatedQuotation._doc,
                        items: updatedQuotation.items.map(item => ({
                            ...item._doc,
                            item: item.item,
                            unit: item.unit
                        })),
                        account: updatedQuotation.account
                    },
                    message: 'Quotation updated successfully!'
                }
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Error while updating sales quotation:', error);
            res.status(500).json({
                success: false,
                error: 'An error occurred while updating the quotation.',
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

router.get('/sales-quotation/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            const salesQuotation = await SalesQuotation.findById(billId)
                .populate({ path: 'account', select: 'name pan address email phone openingBalance' })
                .populate('items.item')
                .populate('user');

            if (!salesQuotation) {
                return res.status(404).json({
                    success: false,
                    error: 'Sales Quotation not found'
                });
            }

            // Populate unit for each item in the bill
            for (const item of salesQuotation.items) {
                await item.item.populate('unit');
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
                    salesQuotation: {
                        ...salesQuotation._doc,
                        items: salesQuotation.items.map(item => ({
                            ...item._doc,
                            item: {
                                ...item.item._doc,
                                unit: item.item.unit
                            }
                        })),
                        account: salesQuotation.account,
                        user: salesQuotation.user
                    },
                    currentCompanyName,
                    currentCompany: {
                        _id: currentCompany._id,
                        name: currentCompany.name,
                        phone: currentCompany.phone,
                        pan: currentCompany.pan,
                        address: currentCompany.address,
                    },
                    paymentMode: salesQuotation.paymentMode,
                    nepaliDate,
                    transactionDateNepali,
                    englishDate: salesQuotation.englishDate,
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
            console.error("Error fetching sales quotation for printing:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching sales quotation for printing',
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


module.exports = router;