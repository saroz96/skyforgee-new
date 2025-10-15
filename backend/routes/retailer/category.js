const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const multer = require('multer');
const readXlsxFile = require('read-excel-file/node');
const path = require('path');
const bwipjs = require('bwip-js');

const Item = require('../../models/retailer/Item');
// const Unit = require('../../models/retailer/Unit');
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
// const FiscalYear = require('../../models/FiscalYear');
// const Company = require('../../models/Company');
const NepaliDate = require('nepali-date');
// const SalesBill = require('../../models/retailer/SalesBill');
// const SalesReturn = require('../../models/retailer/SalesReturn');
// const PurchaseBill = require('../../models/retailer/PurchaseBill');
// const PurchaseReturn = require('../../models/retailer/PurchaseReturns');
// const Transaction = require('../../models/retailer/Transaction');
// const StockAdjustment = require('../../models/retailer/StockAdjustment');
const moment = require('moment');
const Company = require('../../models/Company');
const Category = require('../../models/retailer/Category');
const itemsCompany = require('../../models/retailer/itemsCompany');
const Unit = require('../../models/retailer/Unit');
const MainUnit = require('../../models/retailer/MainUnit');
// const MainUnit = require('../../models/retailer/MainUnit');
const Composition = require('../../models/retailer/Composition');
const Transaction = require('../../models/retailer/Transaction');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const { ensureTradeType } = require('../../middleware/tradeType');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const FiscalYear = require('../../models/FiscalYear');
// const BarcodePreference = require('../../models/retailer/barcodePreference');
// const { createCanvas, loadImage } = require('canvas');
// const itemsCompany = require('../../models/retailer/itemsCompany');


// Category routes
router.get('/categories', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const categories = await Category.find({ company: companyId });
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                // Fetch the fiscal year from the database if available in the session
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

                // Assign fiscal year ID for use
                fiscalYear = req.session.currentFiscalYear.id;
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Prepare response data
            const responseData = {
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat
                    },
                    currentFiscalYear: currentFiscalYear ? {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    } : null,
                    categories: categories.map(cat => ({
                        _id: cat._id,
                        name: cat.name,
                        description: cat.description,
                        company: cat.company,
                        // include other category fields as needed
                    })),
                    currentCompanyName,
                    companyId,
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
            };

            res.json(responseData);
        } else {
            res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

router.post('/categories', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }

    try {
        const { name } = req.body;
        const companyId = req.session.currentCompany;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Category name is required'
            });
        }

        const newCategory = new Category({
            name: name.trim(),
            company: companyId
        });

        await newCategory.save();

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: {
                _id: newCategory._id,
                name: newCategory.name,
                company: newCategory.company
            }
        });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A category with this name already exists within the selected company'
            });
        }

        console.error('Error creating category:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.put('/categories/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }

    try {
        const { name } = req.body;
        const categoryId = req.params.id;
        const companyId = req.session.currentCompany;

        // Input validation
        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Category name is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid category ID'
            });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            {
                name: name.trim(),
                company: companyId
            },
            { new: true, runValidators: true } // Return updated doc and run schema validators
        );

        if (!updatedCategory) {
            return res.status(404).json({
                success: false,
                error: 'Category not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: {
                _id: updatedCategory._id,
                name: updatedCategory.name,
                company: updatedCategory.company
            }
        });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A category with this name already exists'
            });
        }

        console.error('Error updating category:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.delete('/categories/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }

    try {
        const { id } = req.params;

        // Validate category ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid category ID'
            });
        }

        // Check if category exists
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                error: 'Category not found'
            });
        }

        // Prevent deletion of default "General" category
        if (category.name.toLowerCase() === 'general') {
            return res.status(403).json({
                success: false,
                error: 'The default "General" category cannot be deleted'
            });
        }

        // Check for associated items
        const associatedItems = await Item.findOne({ category: id });
        if (associatedItems) {
            return res.status(409).json({
                success: false,
                error: 'Category cannot be deleted because it is associated with items'
            });
        }

        // Delete the category
        await Category.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully',
            data: {
                _id: id
            }
        });

    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

module.exports = router;