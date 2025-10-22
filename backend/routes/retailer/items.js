const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const multer = require('multer');
const readXlsxFile = require('read-excel-file/node');
const path = require('path');
const bwipjs = require('bwip-js');

const Item = require('../../models/retailer/Item');
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const NepaliDate = require('nepali-date');
const SalesBill = require('../../models/retailer/SalesBill');
const SalesReturn = require('../../models/retailer/SalesReturn');
const PurchaseBill = require('../../models/retailer/PurchaseBill');
const PurchaseReturn = require('../../models/retailer/PurchaseReturns');
const StockAdjustment = require('../../models/retailer/StockAdjustment');
const moment = require('moment');
const Company = require('../../models/Company');
const Category = require('../../models/retailer/Category');
const itemsCompany = require('../../models/retailer/itemsCompany');
const Unit = require('../../models/retailer/Unit');
const MainUnit = require('../../models/retailer/MainUnit');
const Composition = require('../../models/retailer/Composition');
const Transaction = require('../../models/retailer/Transaction');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const { ensureTradeType } = require('../../middleware/tradeType');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const FiscalYear = require('../../models/FiscalYear');
const BarcodePreference = require('../../models/retailer/barcodePreference');
// const { createCanvas, loadImage } = require('canvas');


// router.get('/items', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
//     try {
//         const companyId = req.session.currentCompany;

//         // Parallelize all independent queries
//         const [
//             company,
//             items,
//             categories,
//             itemsCompanies,
//             units,
//             mainUnits,
//             composition
//         ] = await Promise.all([
//             Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').lean(),
//             Item.find({ company: companyId })
//                 .populate('category', 'name')
//                 .populate('itemsCompany', 'name')
//                 .populate('unit', 'name')
//                 .populate('mainUnit', 'name')
//                 .populate('composition', 'name uniqueNumber')
//                 .populate({
//                     path: 'stockEntries',
//                     select: 'quantity' // Include relevant stock fields
//                 })
//                 .lean(),
//             Category.find({ company: companyId }).lean(),
//             itemsCompany.find({ company: companyId }).lean(),
//             Unit.find({ company: companyId }).lean(),
//             MainUnit.find({ company: companyId }).lean(),
//             Composition.find({ company: companyId }).lean()
//         ]);

//         // Get transaction existence in a single query
//         const itemIds = items.map(item => item._id);
//         const transactions = await Transaction.find({
//             item: { $in: itemIds },
//             company: companyId
//         }).select('item').lean();

//         const transactionItemIds = new Set(transactions.map(t => t.item.toString()));

//         // Add hasTransactions flag
//         const itemsWithFlags = items.map(item => ({
//             ...item,
//             hasTransactions: transactionItemIds.has(item._id.toString()) ? 'true' : 'false',
//              currentStock: item.stockEntries && item.stockEntries.length > 0
//                 ? item.stockEntries[0].quantity
//                 : 0,
//             // Or get all stock entries if needed
//             stockEntries: item.stockEntries || []
//         }));

//         // Get current fiscal year
//         let currentFiscalYear = req.session.currentFiscalYear;
//         if (!currentFiscalYear && company.fiscalYear) {
//             currentFiscalYear = await FiscalYear.findById(company.fiscalYear).lean();
//         }

//         // Nepali date calculation
//         const today = new Date();
//         const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');

//         console.log('Session data:', {
//             currentCompany: req.session.currentCompany,
//             currentFiscalYear: req.session.currentFiscalYear,
//             user: req.user
//         });


//         res.json({
//             success: true,
//             items: itemsWithFlags,
//             company,
//             currentFiscalYear,
//             vatEnabled: company?.vatEnabled || false,
//             categories,
//             itemsCompanies,
//             units,
//             mainUnits,
//             composition,
//             companyId,
//             currentCompanyName: req.session.currentCompanyName || '',
//             companyDateFormat: company?.dateFormat || 'english',
//             nepaliDate,
//             fiscalYear: currentFiscalYear?._id || null,
//             user: req.user,
//             theme: req.user.preferences?.theme || 'light',
//             isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
//         });
//     } catch (error) {
//         console.error("Error fetching items:", error);
//         res.status(500).json({ error: 'Failed to fetch items' });
//     }
// });

router.get('/items', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;

        // Parallelize all independent queries
        const [
            company,
            items,
            categories,
            itemsCompanies,
            units,
            mainUnits,
            composition
        ] = await Promise.all([
            Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').lean(),
            Item.find({ company: companyId })
                .populate('category', 'name')
                .populate('itemsCompany', 'name')
                .populate('unit', 'name')
                .populate('mainUnit', 'name')
                .populate('composition', 'name uniqueNumber')
                // Remove the populate for stockEntries since it's a subdocument array
                .lean(),
            Category.find({ company: companyId }).lean(),
            itemsCompany.find({ company: companyId }).lean(),
            Unit.find({ company: companyId }).lean(),
            MainUnit.find({ company: companyId }).lean(),
            Composition.find({ company: companyId }).lean()
        ]);

        // Get transaction existence in a single query
        const itemIds = items.map(item => item._id);
        const transactions = await Transaction.find({
            item: { $in: itemIds },
            company: companyId
        }).select('item').lean();

        const transactionItemIds = new Set(transactions.map(t => t.item.toString()));

        // Add hasTransactions flag and calculate current stock from stockEntries
        const itemsWithFlags = items.map(item => {
            // Calculate current stock from stockEntries subdocuments
            let currentStock = 0;

            if (item.stockEntries && item.stockEntries.length > 0) {
                // Sum all quantities from stockEntries subdocuments
                currentStock = item.stockEntries.reduce((total, entry) => {
                    // Since stockEntries is a subdocument array, we can directly access quantity
                    const quantity = parseFloat(entry.quantity) || 0;
                    return total + quantity;
                }, 0);
            } else {
                // Fallback to the item's openingStock field if no stockEntries
                currentStock = parseFloat(item.openingStock) || 0;
            }

            return {
                ...item,
                hasTransactions: transactionItemIds.has(item._id.toString()) ? 'true' : 'false',
                currentStock: currentStock,
                // Include stockEntries count for debugging
                stockEntriesCount: item.stockEntries ? item.stockEntries.length : 0
            };
        });

        // Get current fiscal year
        let currentFiscalYear = req.session.currentFiscalYear;
        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(company.fiscalYear).lean();
        }

        // Nepali date calculation
        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');

        console.log('Session data:', {
            currentCompany: req.session.currentCompany,
            currentFiscalYear: req.session.currentFiscalYear,
            user: req.user
        });

        // Debug: Log first few items with stock data
        console.log('Stock calculation debug - First 3 items:', itemsWithFlags.slice(0, 3).map(item => ({
            name: item.name,
            currentStock: item.currentStock,
            stockEntriesCount: item.stockEntriesCount,
            openingStock: item.openingStock,
            stockEntries: item.stockEntries ? item.stockEntries.map(se => ({ quantity: se.quantity })) : 'none'
        })));

        res.json({
            success: true,
            items: itemsWithFlags,
            company,
            currentFiscalYear,
            vatEnabled: company?.vatEnabled || false,
            categories,
            itemsCompanies,
            units,
            mainUnits,
            composition,
            companyId,
            currentCompanyName: req.session.currentCompanyName || '',
            companyDateFormat: company?.dateFormat || 'english',
            nepaliDate,
            fiscalYear: currentFiscalYear?._id || null,
            user: req.user,
            theme: req.user.preferences?.theme || 'light',
            isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
        });
    } catch (error) {
        console.error("Error fetching items:", error);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

// const NodeCache = require('node-cache');
// const myCache = new NodeCache({ 
//   stdTTL: 300,      // 5 minutes default TTL
//   checkperiod: 60,   // Check for expired keys every 60 seconds
//   useClones: false   // ⭐ Crucial: Disable cloning for Mongoose docs
// });

// router.get('/items', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
//     try {
//         const companyId = req.session.currentCompany;

//         // Create a unique cache key based on request parameters
//         const cacheKey = `items_${companyId}_${req.session.currentFiscalYear || 'noFY'}`;

//         // Check if data exists in cache
//         const cachedData = myCache.get(cacheKey);
//         if (cachedData) {
//             console.log('Serving from cache');
//             return res.json(cachedData);
//         }

//         // Parallelize all independent queries
//         const [
//             company,
//             items,
//             categories,
//             itemsCompanies,
//             units,
//             mainUnits,
//             composition
//         ] = await Promise.all([
//             Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').lean(),
//             Item.find({ company: companyId })
//                 .populate('category', 'name')
//                 .populate('itemsCompany', 'name')
//                 .populate('unit', 'name')
//                 .populate('mainUnit', 'name')
//                 .populate('composition', 'name uniqueNumber')
//                 .populate({
//                     path: 'stockEntries',
//                     select: 'quantity'
//                 })
//                 .lean(),
//             Category.find({ company: companyId }).lean(),
//             itemsCompany.find({ company: companyId }).lean(),
//             Unit.find({ company: companyId }).lean(),
//             MainUnit.find({ company: companyId }).lean(),
//             Composition.find({ company: companyId }).lean()
//         ]);

//         // Get transaction existence in a single query
//         const itemIds = items.map(item => item._id);
//         const transactions = await Transaction.find({
//             item: { $in: itemIds },
//             company: companyId
//         }).select('item').lean();

//         const transactionItemIds = new Set(transactions.map(t => t.item.toString()));

//         // Add hasTransactions flag
//         const itemsWithFlags = items.map(item => ({
//             ...item,
//             hasTransactions: transactionItemIds.has(item._id.toString()) ? 'true' : 'false',
//             currentStock: item.stockEntries && item.stockEntries.length > 0
//                 ? item.stockEntries[0].quantity
//                 : 0,
//             stockEntries: item.stockEntries || []
//         }));

//         // Get current fiscal year
//         let currentFiscalYear = req.session.currentFiscalYear;
//         if (!currentFiscalYear && company.fiscalYear) {
//             currentFiscalYear = await FiscalYear.findById(company.fiscalYear).lean();
//         }

//         // Nepali date calculation
//         const today = new Date();
//         const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');

//         // Prepare response data
//         const responseData = {
//             success: true,
//             items: itemsWithFlags,
//             company,
//             currentFiscalYear,
//             vatEnabled: company?.vatEnabled || false,
//             categories,
//             itemsCompanies,
//             units,
//             mainUnits,
//             composition,
//             companyId,
//             currentCompanyName: req.session.currentCompanyName || '',
//             companyDateFormat: company?.dateFormat || 'english',
//             nepaliDate,
//             fiscalYear: currentFiscalYear?._id || null,
//             user: req.user,
//             theme: req.user.preferences?.theme || 'light',
//             isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
//         };

//         // Store data in cache
//         myCache.set(cacheKey, responseData);

//         console.log('Data cached with key:', cacheKey);
//         res.json(responseData);
//     } catch (error) {
//         console.error("Error fetching items:", error);
//         res.status(500).json({ error: 'Failed to fetch items' });
//     }
// });

// Route to get items with reorder level, current stock, and needed stock
router.get('/items/reorder', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;
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

        // Fetch items and calculate current stock from stockEntries
        const items = await Item.find({ company: companyId })
            .populate('unit')
            .populate('stockEntries') // Optional: populate stockEntries if you need details
            .select('name reorderLevel stockEntries unit maxStock'); // Select only the fields you need

        ("Items fetched:", items);

        const itemsWithNeededStock = items.map(item => {
            // Calculate current stock by summing the quantity from stockEntries
            const currentStock = item.stockEntries.reduce((total, entry) => total + (entry.quantity || 0), 0);

            return {
                name: item.name,
                currentStock,
                reorderLevel: item.reorderLevel,
                maxStock: item.maxStock,
                neededStock: Math.max(0, item.reorderLevel - currentStock), // Prevents negative needed stock values
                unit: item.unit ? item.unit.name : 'N/A', // Fetch the unit name, or 'N/A' if not available
                fiscalYear: fiscalYear
            };
        }).filter(item => item.currentStock < item.reorderLevel || item.currentStock > item.maxStock); // Filter to show items where current stock is below reorder level

        // Set the neededStock for the overstock scenario
        itemsWithNeededStock.forEach(item => {
            item.overStock = item.currentStock - item.maxStock; // Calculate over stock
        });

        // Return JSON response for React components
        res.json({
            success: true,
            data: {
                company,
                items: itemsWithNeededStock,
                currentCompanyName,
                currentFiscalYear,
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        });
    }
});

router.get('/items/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, async (req, res) => {
    // First validate the ID parameter
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid item ID format'
        });
    }
    const companyId = req.session.currentCompany;
    const currentCompanyName = req.session.currentCompanyName;

    if (!companyId) {
        return res.status(400).json({
            success: false,
            error: 'Company ID is required'
        });
    }

    try {
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

        // Check if fiscal year is already in the session
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // If no fiscal year found in session but available in company
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

        // Fetch the item details
        // Update the select fields to include all necessary data
        const item = await Item.findOne({ _id: req.params.id, company: companyId })
            .populate('category', 'name')
            .populate('unit', 'name')
            .populate('mainUnit', 'name')
            .populate('WSUnit', 'name')
            .populate({
                path: 'composition',
                select: 'name uniqueNumber'
            })
            .select('name hscode vatStatus status barcodeNumber uniqueNumber reorderLevel createdAt stockEntries openingStockByFiscalYear')
            .lean();

        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found'
            });
        }

        // Initialize opening stock values with defaults
        let openingStock = 0;
        let openingStockValue = 0;
        let salesPrice = 0;
        let purchasePrice = 0;

        // Check if item has openingStockByFiscalYear array
        if (item.openingStockByFiscalYear && Array.isArray(item.openingStockByFiscalYear)) {
            const openingStockForFiscalYear = item.openingStockByFiscalYear.find(stockEntry =>
                stockEntry.fiscalYear && stockEntry.fiscalYear.toString() === fiscalYear
            );

            if (openingStockForFiscalYear) {
                openingStock = openingStockForFiscalYear.openingStock || 0;
                openingStockValue = openingStockForFiscalYear.openingStockValue || 0;
                salesPrice = openingStockForFiscalYear.salesPrice || 0;
                purchasePrice = openingStockForFiscalYear.purchasePrice || 0;
            }
        }

        // Process stock entries with null checks
        const stockEntries = (item.stockEntries || []).map(entry => ({
            ...entry,
            expiryDate: entry.expiryDate ? entry.expiryDate.toISOString().split('T')[0] : null,
            barcodeData: `${currentCompanyName}|${item.uniqueNumber}|${entry.mrp || 0}|${entry.batchNumber || 'N/A'}|${entry.expiryDate ? entry.expiryDate.toISOString().split('T')[0] : 'N/A'}`
        }));

        // Get user's barcode preferences or use defaults
        const barcodePreferences = await BarcodePreference.findOne({
            user: req.user._id
        });

        const printPreferences = barcodePreferences || {
            labelWidth: 70,
            labelHeight: 40,
            labelsPerRow: 3,
            barcodeType: 'code128',
            defaultQuantity: 1
        };

        const hasTransactions = await Transaction.exists({ item: req.params.id });

        // Prepare the response
        const responseData = {
            success: true,
            data: {
                company,
                currentFiscalYear,
                item,
                hasTransactions: hasTransactions,
                stockInfo: {
                    openingStock,
                    openingStockValue,
                    salesPrice,
                    purchasePrice
                },
                stockEntries,
                printPreferences,
                barcodeBaseUrl: `/item/${item._id}/barcode`,
                fiscalYear,
                currentCompanyName,
                user: req.user,
                theme: req.user.preferences?.theme || 'light',
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        };

        res.json(responseData);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});

router.post('/items/:id/status', isLoggedIn, ensureCompanySelected, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('category', 'name')
            .populate('unit', 'name')
            .populate('mainUnit', 'name')
            .populate('WSUnit', 'name');

        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found',
                data: null
            });
        }

        // Check stock before deactivation
        if (req.body.status === 'inactive') {
            const totalStock = item.stockEntries.reduce((acc, entry) => acc + entry.quantity, 0);
            if (totalStock > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Item has stock and cannot be deactivated',
                    data: {
                        item: {
                            _id: item._id,
                            name: item.name,
                            currentStock: totalStock
                        }
                    }
                });
            }
        }

        item.status = req.body.status;
        await item.save();

        // Get updated fiscal year data if needed
        const currentFiscalYear = await FiscalYear.findById(item.fiscalYear);
        const currentOpeningStock = item.openingStockByFiscalYear?.find(
            stock => stock.fiscalYear && stock.fiscalYear.toString() === item.fiscalYear.toString()
        );

        res.status(200).json({
            success: true,
            message: `Item status updated to ${req.body.status}`,
            data: {
                item: {
                    _id: item._id,
                    name: item.name,
                    status: item.status,
                    hscode: item.hscode,
                    vatStatus: item.vatStatus,
                    barcodeNumber: item.barcodeNumber,
                    uniqueNumber: item.uniqueNumber,
                    category: item.category,
                    unit: item.unit,
                    mainUnit: item.mainUnit,
                    WSUnit: item.WSUnit,
                    reorderLevel: item.reorderLevel,
                    currentOpeningStock: currentOpeningStock || {
                        openingStock: 0,
                        openingStockBalance: '0.00',
                        salesPrice: 0,
                        purchasePrice: '0.00'
                    },
                    stockEntries: item.stockEntries,
                    createdAt: item.createdAt
                },
                fiscalYear: currentFiscalYear
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            data: null,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

router.post('/items/create', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({ error: 'This operation is only available for retailers' });
    }

    try {
        const { name, hscode, category, itemsCompany, compositionIds, mainUnit, WSUnit, unit, price, puPrice, vatStatus, openingStock, reorderLevel, openingStockBalance } = req.body;
        const companyId = req.session.currentCompany;

        if (!companyId) {
            return res.status(400).json({ error: 'Company ID is required' });
        }

        // Process composition IDs
        let compositions = [];
        if (compositionIds) {
            compositions = compositionIds.split(',')
                .map(id => id.trim())
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));
        }

        // Validate compositions exist
        if (compositions.length > 0) {
            const existingCompositions = await Composition.countDocuments({
                _id: { $in: compositions },
                company: companyId
            });

            if (existingCompositions !== compositions.length) {
                return res.status(400).json({ error: 'One or more invalid compositions' });
            }
        }

        // Fetch company and fiscal year
        const company = await Company.findById(companyId).populate('fiscalYear');
        let fiscalYear = req.session.currentFiscalYear?.id;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;
            fiscalYear = currentFiscalYear._id;
        }

        if (!fiscalYear) {
            return res.status(400).json({ error: 'No fiscal year found' });
        }

        // Validate category, unit, and main unit
        const [categories, units, mainUnits] = await Promise.all([
            Category.findOne({ _id: category, company: companyId }),
            Unit.findOne({ _id: unit, company: companyId }),
            MainUnit.findOne({ _id: mainUnit, company: companyId })
        ]);

        if (!categories) return res.status(400).json({ error: 'Invalid category' });
        if (!units) return res.status(400).json({ error: 'Invalid unit' });
        if (!mainUnits) return res.status(400).json({ error: 'Invalid main unit' });

        // Check for existing item
        const existingItem = await Item.findOne({ name, company: companyId, fiscalYear: { $in: [fiscalYear] } });
        if (existingItem) {
            return res.status(400).json({ error: 'Item already exists for this fiscal year' });
        }

        // Create new item
        const newItem = new Item({
            name,
            hscode,
            category,
            itemsCompany,
            composition: compositions,
            mainUnit,
            WSUnit,
            unit,
            price,
            puPrice,
            vatStatus,
            openingStock,
            stock: openingStock,
            company: companyId,
            reorderLevel,
            maxStock: reorderLevel,
            initialOpeningStock: {
                fiscalYear,
                salesPrice: price,
                purchasePrice: puPrice,
                openingStock,
                openingStockBalance,
                date: currentFiscalYear.startDate,
            },
            openingStockByFiscalYear: [{
                fiscalYear,
                salesPrice: price,
                purchasePrice: puPrice,
                openingStock,
                openingStockBalance
            }],
            stockEntries: openingStock > 0 ? [{
                quantity: openingStock,
                price,
                puPrice,
                netPuPrice: puPrice,
                date: new Date(),
                uniqueUuId: uuidv4(),
                fiscalYear
            }] : [],
            fiscalYear: [fiscalYear],
            originalFiscalYear: currentFiscalYear._id,
            createdAt: currentFiscalYear.startDate,
        });

        await newItem.save();

        return res.status(201).json({
            success: true,
            message: 'Item created successfully',
            item: {
                _id: newItem._id,
                name: newItem.name,
                category: newItem.category,
                itemsCompany: newItem.itemsCompany,
                price: newItem.price,
                stock: newItem.stock
            }
        });

    } catch (error) {
        console.error('Error creating item:', error);
        return res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
});

// Route to handle editing an item
router.put('/items/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const {
                name,
                hscode,
                category,
                itemsCompany,
                compositionIds,
                price,
                puPrice,
                vatStatus,
                openingStock,
                reorderLevel,
                mainUnit,
                WSUnit,
                unit
            } = req.body;

            const companyId = req.session.currentCompany;

            // Calculate opening stock balance
            const calculatedBalance = (parseFloat(puPrice || 0) * parseFloat(openingStock || 0)).toFixed(2);

            // Process composition IDs
            const compositions = compositionIds
                ? compositionIds.split(',').filter(id => mongoose.Types.ObjectId.isValid(id))
                : [];

            // Validate compositions exist
            if (compositions.length > 0) {
                const existingCompositions = await Composition.countDocuments({
                    _id: { $in: compositions },
                    company: companyId
                });

                if (existingCompositions !== compositions.length) {
                    return res.status(400).json({ error: 'One or more invalid compositions' });
                }
            }

            // Fetch the company and populate the fiscalYear
            const company = await Company.findById(companyId).populate('fiscalYear');

            // Get current fiscal year
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
                return res.status(400).json({ error: 'No fiscal year found in session or company.' });
            }

            // Validate the category and unit
            const [categoryExists, unitExists] = await Promise.all([
                Category.findOne({ _id: category, company: companyId }),
                Unit.findOne({ _id: unit, company: companyId })
            ]);

            if (!categoryExists) {
                return res.status(400).json({ error: 'Invalid item category for this company' });
            }

            if (!unitExists) {
                return res.status(400).json({ error: 'Invalid item unit for this company' });
            }

            // Fetch the current item details
            const item = await Item.findById(req.params.id);
            if (!item) {
                return res.status(404).json({ error: 'Item not found' });
            }

            // Check if item has transactions
            const hasTransactions = await Transaction.exists({ item: req.params.id });

            // Prepare stock updates
            let updatedStockEntries = item.stockEntries;
            let updatedOpeningStock = item.openingStock;
            let updatedOpeningStockBalance = item.openingStockBalance;

            if (!hasTransactions) {
                const newOpeningStock = Number(openingStock) || 0;
                updatedOpeningStock = newOpeningStock;
                updatedOpeningStockBalance = calculatedBalance;

                if (newOpeningStock > 0) {
                    updatedStockEntries = [{
                        quantity: newOpeningStock,
                        price: price,
                        puPrice: puPrice,
                        date: new Date(),
                        fiscalYear: fiscalYear,
                        uniqueUuId: uuidv4()
                    }];
                } else {
                    updatedStockEntries = [];
                }
            }

            // Calculate total stock from stockEntries
            const calculatedStock = updatedStockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);

            // Build update object
            const updateData = {
                name,
                hscode,
                category,
                itemsCompany,
                composition: compositions,
                mainUnit,
                WSUnit,
                unit,
                price,
                puPrice,
                vatStatus,
                reorderLevel,
                maxStock: reorderLevel,
                stock: calculatedStock,  // Now derived from stockEntries
                openingStock: updatedOpeningStock,
                openingStockBalance: updatedOpeningStockBalance,
                stockEntries: updatedStockEntries,
                company: companyId,
                fiscalYear: [fiscalYear],
            };

            // Add opening stock data if no transactions exist
            if (!hasTransactions) {
                updateData.openingStockByFiscalYear = [{
                    fiscalYear: fiscalYear,
                    salesPrice: price,
                    purchasePrice: puPrice,
                    openingStock: updatedOpeningStock,
                    openingStockBalance: updatedOpeningStockBalance
                }];

                updateData.initialOpeningStock = {
                    fiscalYear: fiscalYear,
                    salesPrice: price,
                    purchasePrice: puPrice,
                    openingStock: updatedOpeningStock,
                    openingStockBalance: updatedOpeningStockBalance,
                    date: currentFiscalYear?.startDate || new Date(),
                };
            }

            // Update the item
            const updatedItem = await Item.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true }
            );

            req.flash('success', 'Item updated successfully');
            res.json({
                success: true,
                item: updatedItem,
                hasTransactions,
                openingStockBalance: updatedOpeningStockBalance
            });

        } catch (err) {
            console.error('Error updating item:', err);

            if (err.code === 11000) {
                return res.status(400).json({
                    error: 'An item with this name already exists within the selected company.'
                });
            }

            res.status(500).json({
                error: 'Error updating item',
                details: err.message
            });
        }
    } else {
        res.status(403).json({ error: 'Unauthorized trade type' });
    }
});

// Route to handle form submission and delete the company group
router.delete('/items/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access'
            });
        }

        const { id } = req.params;
        const companyId = req.session.currentCompany;

        // Check if the item has any related transactions
        const hasSales = await SalesBill.findOne({ 'items.item': id, company: companyId });
        const hasSalesReturn = await SalesReturn.findOne({ 'items.item': id, company: companyId });
        const hasPurchase = await PurchaseBill.findOne({ 'items.item': id, company: companyId });
        const hasPurchaseReturn = await PurchaseReturn.findOne({ 'items.item': id, company: companyId });
        const hasStockAdjustment = await StockAdjustment.findOne({ 'items.item': id, company: companyId });
        const hasTransaction = await Transaction.findOne({ item: id, company: companyId });

        if (hasSales || hasSalesReturn || hasPurchase || hasPurchaseReturn || hasStockAdjustment || hasTransaction) {
            return res.status(400).json({
                success: false,
                message: 'Item cannot be deleted as it has related transactions or entries.'
            });
        }

        // If no related transactions are found, proceed with deletion
        await Item.findByIdAndDelete(id, { company: companyId });

        return res.status(200).json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting item:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

router.get('/products', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId).populate('fiscalYear');

        // Get current fiscal year
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
            return res.status(400).json({ error: 'No fiscal year found in session or company.' });
        }
        try {
            // const products = await Item.find({
            //     company: companyId,
            //     status: 'active',
            //     $or: [
            //         { originalFiscalYear: fiscalYear },
            //         {
            //             fiscalYear: fiscalYear,
            //             originalFiscalYear: { $lt: fiscalYear }
            //         }
            //     ]
            // })
            //     .populate('category', 'name')
            //     .populate('itemsCompany', 'name')
            //     .populate('unit', 'name')
            //     .populate('composition', 'name uniqueNumber')
            //     .lean();

            const products = await Item.find({ company: companyId, status: 'active' })
                .populate('category')
                .populate('itemsCompany')
                .populate('unit')
                .populate('mainUnit')
                .populate('stockEntries')
                .populate('composition', 'name uniqueNumber')
                .lean();

            // Transform the data for better frontend consumption
            const transformedProducts = products.map(product => {
                const totalStock = product.stockEntries.reduce((acc, entry) => acc + entry.quantity, 0);
                const latestStockEntry = product.stockEntries[product.stockEntries.length - 1] || {};

                return {
                    id: product._id,
                    uniqueNumber: product.uniqueNumber,
                    name: product.name,
                    hscode: product.hscode,
                    company: product.itemsCompany?.name || 'N/A',
                    category: product.category?.name || 'No Category',
                    unit: product.unit?.name || 'N/A',
                    rate: latestStockEntry.price || 0,
                    stock: totalStock,
                    margin: latestStockEntry.marginPercentage || '',
                    vatStatus: product.vatStatus,
                    composition: product.composition?.map(comp => ({
                        id: comp._id,
                        name: comp.name,
                        uniqueNumber: comp.uniqueNumber
                    })) || [],
                    stockEntries: product.stockEntries.map(entry => ({
                        batchNumber: entry.batchNumber,
                        expiryDate: entry.expiryDate,
                        puPrice: entry.puPrice,
                        price: entry.price,
                        mrp: entry.mrp,
                        quantity: entry.quantity,
                        marginPercentage: entry.marginPercentage
                    }))
                };
            });

            res.json({
                success: true,
                data: transformedProducts,
                count: transformedProducts.length
            });
        } catch (error) {
            console.error('Error fetching products:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch products'
            });
        }
    }
});

router.put('/update-batch/:itemId/:batchIndex', ensureAuthenticated, async (req, res) => {
    try {
        const { itemId, batchIndex } = req.params;
        const { batchNumber, expiryDate, price } = req.body;

        // Validate input
        if (!batchNumber || !price) {
            return res.status(400).json({
                success: false,
                message: 'Batch number and price are required'
            });
        }

        // Find and update the item
        const item = await Item.findById(itemId);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        if (batchIndex < 0 || batchIndex >= item.stockEntries.length) {
            return res.status(400).json({
                success: false,
                message: 'Invalid batch index'
            });
        }

        // Update batch details
        item.stockEntries[batchIndex].batchNumber = batchNumber;
        item.stockEntries[batchIndex].expiryDate = expiryDate;
        item.stockEntries[batchIndex].price = parseFloat(price);

        await item.save();

        // Update batch details in all PurchaseBill documents
        await PurchaseBill.updateMany(
            { 'items.item': itemId },
            {
                $set: {
                    'items.$[elem].batchNumber': batchNumber,
                    'items.$[elem].expiryDate': expiryDate,
                    'items.$[elem].price': parseFloat(price)
                }
            },
            {
                arrayFilters: [{ 'elem.item': itemId }]
            }
        );

        res.json({
            success: true,
            message: 'Batch updated successfully',
            updatedItem: item
        });

    } catch (error) {
        console.error('Error updating batch:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;