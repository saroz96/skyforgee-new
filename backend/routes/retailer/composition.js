const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Composition = require('../../models/retailer/Composition');
const Company = require('../../models/Company');
const FiscalYear = require('../../models/FiscalYear');
const Item = require('../../models/retailer/Item');
const { isLoggedIn, ensureAuthenticated, ensureCompanySelected } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');

router.get('/compositions', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
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

            const compositions = await Composition.find({ company: companyId });

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
                    compositions: compositions.map(comp => comp.toObject()),
                    companyId,
                    currentCompanyName,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences || { theme: 'light' }
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
        console.error('Error in /compositions route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.post('/compositions', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { name } = req.body;
        const companyId = req.session.currentCompany;

        // Validate input
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Composition name is required and must be a non-empty string'
            });
        }

        const newComposition = new Composition({ name, company: companyId });
        await newComposition.save();

        res.status(201).json({
            success: true,
            message: 'Successfully created a new composition',
            data: {
                composition: newComposition.toObject()
            }
        });

    } catch (err) {
        console.error('Error creating composition:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A composition with this name already exists within the selected company'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

router.put('/compositions/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { id } = req.params;
        const { name } = req.body;
        const companyId = req.session.currentCompany;

        // Validate input
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Composition name is required and must be a non-empty string'
            });
        }

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid composition ID'
            });
        }

        const updatedComposition = await Composition.findByIdAndUpdate(
            id,
            { name, company: companyId },
            { new: true, runValidators: true }
        );

        if (!updatedComposition) {
            return res.status(404).json({
                success: false,
                error: 'Composition not found'
            });
        }

        res.json({
            success: true,
            message: 'Composition updated successfully',
            data: {
                composition: updatedComposition.toObject()
            }
        });

    } catch (err) {
        console.error('Error updating composition:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A composition with this name already exists within the selected company'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error while updating composition',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

router.delete('/compositions/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { id } = req.params;

        // Validate ID
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid composition ID'
            });
        }

        // Check if composition exists before deleting
        const composition = await Composition.findById(id);
        if (!composition) {
            return res.status(404).json({
                success: false,
                error: 'Composition not found'
            });
        }

        // Verify the composition belongs to the user's current company
        if (composition.company.toString() !== req.session.currentCompany) {
            return res.status(403).json({
                success: false,
                error: 'You can only delete compositions from your current company'
            });
        }

        // Check if any items are using this unit
        const itemsUsingComposition = await Item.findOne({ composition: id });
        if (itemsUsingComposition) {
            return res.status(409).json({
                success: false,
                error: 'Cannot delete - this composition as it is being used'
            });
        }

        const deletedComposition = await Composition.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Composition deleted successfully',
            data: {
                id: deletedComposition._id,
                name: deletedComposition.name
            }
        });

    } catch (err) {
        console.error('Error deleting composition:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to delete composition',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;