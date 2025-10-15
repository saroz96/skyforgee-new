const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const StockAdjustment = require('../../models/retailer/StockAdjustment');
const Item = require('../../models/retailer/Item');
const NepaliDate = require('nepali-date');
const Company = require('../../models/Company');
// const BillCounter = require('../../models/retailer/stockAdjustmentBillCounter');
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const FiscalYear = require('../../models/FiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');

// Get all stock adjustments for the current company (JSON response for React)
router.get('/stockAdjustments/register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompany = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat name').populate('fiscalYear');

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                // Fetch the fiscal year from the database if available in the session
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, use company's fiscal year
            if (!currentFiscalYear && currentCompany.fiscalYear) {
                currentFiscalYear = currentCompany.fiscalYear;

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

            const stockAdjustments = await StockAdjustment.find({
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate('items.item')
                .populate('items.unit') // Populate unit details
                .populate('user')
                .lean();

            // Sort adjustments by date in ascending order
            stockAdjustments.sort((a, b) => new Date(a.date) - new Date(b.date));

            const formattedAdjustments = stockAdjustments.map(adjustment => {
                return adjustment.items.map(item => ({
                    date: adjustment.date,
                    billNumber: adjustment.billNumber,
                    itemId: item.item?._id,
                    itemName: item.item ? item.item.name : 'N/A',
                    quantity: item.quantity,
                    unitId: item.unit?._id,
                    unitName: item.unit?.name || 'N/A',
                    puPrice: item.puPrice,
                    adjustmentType: adjustment.adjustmentType,
                    reason: item.reason.join(' '),
                    vatStatus: item.vatStatus,
                    userId: adjustment.user?._id,
                    userName: adjustment.user?.name || 'N/A',
                    adjustmentId: adjustment._id,
                }));
            }).flat(); // Flatten the nested array of items

            const items = await Item.find({ company: companyId }).select('name _id');

            return res.json({
                success: true,
                data: {
                    company: {
                        _id: currentCompany._id,
                        name: currentCompany.name,
                        dateFormat: currentCompany.dateFormat || 'english'
                    },
                    fiscalYear: currentFiscalYear ? {
                        _id: currentFiscalYear._id,
                        name: currentFiscalYear.name,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        isActive: currentFiscalYear.isActive
                    } : null,
                    stockAdjustments: formattedAdjustments,
                    items: items,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }
    } catch (error) {
        console.error('Error fetching stock adjustments:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get form data to create a new stock adjustment (JSON response for React)
router.get('/stockAdjustments/new', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled name')
                .populate('fiscalYear');

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or company, use company's fiscal year
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

            // Get items with necessary population
            const items = await Item.find({ company: companyId, status: 'active' }).populate('category').populate('unit').populate('mainUnit').populate('stockEntries').lean(),

                itemsWithStock = items.map(item => {
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

            // Get last counter without incrementing
            const lastCounter = await BillCounter.findOne({
                company: companyId,
                fiscalYear: fiscalYear,
                transactionType: 'stockAdjustment'
            });

            // Calculate next number for display only
            const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
            const fiscalYearData = await FiscalYear.findById(fiscalYear);
            const prefix = fiscalYearData.billPrefixes.stockAdjustment;
            const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

            // Get current date in both formats
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const transactionDateNepali = new NepaliDate(today).format('YYYY-MM-DD');

            return res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        name: company.name,
                        dateFormat: company.dateFormat || 'english',
                        vatEnabled: company.vatEnabled
                    },
                    fiscalYear: currentFiscalYear ? {
                        _id: currentFiscalYear._id,
                        name: currentFiscalYear.name,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate
                    } : null,
                    items: itemsWithStock,
                    nextBillNumber,
                    dates: {
                        nepaliDate,
                        transactionDateNepali
                    },
                    user: {
                        _id: req.user._id,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                    }
                }
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }
    } catch (error) {
        console.error('Error fetching new stock adjustment form data:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


router.post('/stockAdjustments/new', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }

    const session = await mongoose.startSession();
    try {
        const result = await session.withTransaction(async () => {
            const {
                items,
                adjustmentType,
                note,
                nepaliDate,
                billDate,
                isVatExempt,
                vatPercentage,
                discountPercentage,
            } = req.body;

            const companyId = req.session.currentCompany;
            const userId = req.user._id;
            const currentFiscalYear = req.session.currentFiscalYear.id;

            const company = await Company.findById(companyId).session(session);
            if (!company) {
                throw new Error('Company not found');
            }

            const dateFormat = company.dateFormat;
            const date = dateFormat === 'nepali' ? nepaliDate : new Date(billDate);

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let subTotal = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            const itemsArray = [];

            // Validate and process each item
            for (const itemData of items) {
                const {
                    item,
                    unit,
                    batchNumber,
                    expiryDate,
                    marginPercentage,
                    mrp,
                    price,
                    quantity,
                    puPrice,
                    reason,
                    vatStatus,
                } = itemData;

                const product = await Item.findById(item).session(session);
                if (!product) {
                    throw new Error(`Item not found: ${item}`);
                }

                const itemTotal = parseFloat(puPrice) * parseFloat(quantity);
                subTotal += itemTotal;

                if (product.vatStatus === 'vatable') {
                    hasVatableItems = true;
                    totalTaxableAmount += itemTotal;
                } else {
                    hasNonVatableItems = true;
                    totalNonTaxableAmount += itemTotal;
                }

                const itemToAdjust = await Item.findById(item).session(session);
                const parsedQuantity = parseInt(quantity);
                const uniqueId = uuidv4();

                // Handle excess adjustment
                if (adjustmentType === 'xcess') {
                    itemToAdjust.stock += parsedQuantity;
                    let batchEntry = itemToAdjust.stockEntries.find(
                        (entry) => entry.batchNumber === batchNumber
                    );
                    if (batchEntry) {
                        batchEntry.quantity += parsedQuantity;
                    } else {
                        itemToAdjust.stockEntries.push({
                            date,
                            batchNumber,
                            expiryDate,
                            quantity: parsedQuantity,
                            price,
                            puPrice,
                            mrp,
                            marginPercentage,
                            uniqueUuId: uniqueId,
                            fiscalYear: currentFiscalYear
                        });
                    }
                }

                // Handle short adjustment
                if (adjustmentType === 'short') {
                    let remainingQuantity = parsedQuantity;
                    for (const batch of itemToAdjust.stockEntries) {
                        if (batch.batchNumber === batchNumber && batch.uniqueUuId === itemData.uniqueUuId && remainingQuantity > 0) {
                            const deductAmount = Math.min(batch.quantity, remainingQuantity);
                            batch.quantity -= deductAmount;
                            remainingQuantity -= deductAmount;

                            if (batch.quantity < 0) {
                                throw new Error('Insufficient batch stock');
                            }
                        }
                    }
                    itemToAdjust.stock -= parsedQuantity;
                    if (itemToAdjust.stock < 0) {
                        throw new Error('Insufficient total stock');
                    }
                }

                await itemToAdjust.save({ session });
                itemsArray.push({
                    item,
                    unit,
                    quantity: parsedQuantity,
                    puPrice,
                    batchNumber,
                    expiryDate,
                    reason: Array.isArray(reason) ? reason : [reason],
                    vatStatus
                });
            }

            // Calculate financials
            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;
            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            const vatAmount = (!isVatExemptBool || isVatAll)
                ? (finalTaxableAmount * vatPercentage) / 100
                : 0;

            const totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;

            // Generate bill number and create adjustment
            const billNumber = await getNextBillNumber(companyId, currentFiscalYear, 'stockAdjustment', session);
            const newStockAdjustment = new StockAdjustment({
                items: itemsArray,
                billNumber,
                note,
                date,
                isVatAll,
                isVatExempt: isVatExemptBool,
                adjustmentType,
                vatPercentage: isVatExemptBool ? 0 : vatPercentage,
                subTotal,
                discountPercentage: discount,
                discountAmount: discountForTaxable + discountForNonTaxable,
                nonVatAdjustment: finalNonTaxableAmount,
                taxableAmount: finalTaxableAmount,
                vatAmount,
                totalAmount,
                isActive: true,
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear,
            });

            const savedAdjustment = await newStockAdjustment.save({ session });

            return {
                adjustment: savedAdjustment,
                billNumber,
                totalAmount,
                vatAmount,
                discountAmount: discountForTaxable + discountForNonTaxable
            };
        });

        await session.commitTransaction();

        return res.json({
            success: true,
            data: {
                adjustmentId: result.adjustment._id,
                billNumber: result.billNumber,
                totalAmount: result.totalAmount,
                vatAmount: result.vatAmount,
                discountAmount: result.discountAmount,
                message: 'Stock adjustment recorded successfully'
            }
        });
    } catch (err) {
        await session.abortTransaction();
        console.error('Error recording stock adjustment:', err);

        return res.status(400).json({
            success: false,
            error: err.message || 'Error recording stock adjustment',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    } finally {
        session.endSession();
    }
});


module.exports = router;