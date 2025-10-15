const express = require('express');
const router = express.Router();
const Unit = require('../../models/retailer/Unit');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const Company = require('../../models/Company');
const FiscalYear = require('../../models/FiscalYear');
const Item = require('../../models/retailer/Item');


router.get('/units', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
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

        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat')
            .populate('fiscalYear');

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear?.id || null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // If no fiscal year is found in session but available in company
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
                error: 'No fiscal year found in session or company',
                redirectTo: '/select-fiscal-year' // Optional: suggest where to redirect
            });
        }

        const units = await Unit.find({ company: companyId });

        return res.status(200).json({
            success: true,
            data: {
                units,
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
        });

    } catch (err) {
        console.error('Error fetching units:', err);
        return res.status(500).json({
            success: false,
            error: 'Server error occurred while fetching units'
        });
    }
});

router.post('/units', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const { name } = req.body;
        const companyId = req.session.currentCompany;

        // Validate inputs
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Unit name is required'
            });
        }

        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        // Create new unit
        const newUnit = new Unit({ name, company: companyId });
        await newUnit.save();

        return res.status(201).json({
            success: true,
            message: 'Unit created successfully',
            data: {
                _id: newUnit._id,
                name: newUnit.name,
                company: newUnit.company
            }
        });

    } catch (err) {
        console.error('Error creating unit:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A unit with this name already exists within the selected company'
            });
        }

        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Server error occurred while creating unit'
        });
    }
});

router.put('/units/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const { id } = req.params;
        const { name } = req.body;
        const companyId = req.session.currentCompany;

        // Validate inputs
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Unit ID is required'
            });
        }

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Unit name is required'
            });
        }

        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        // Update the unit
        const updatedUnit = await Unit.findByIdAndUpdate(
            id,
            { name, company: companyId },
            { new: true, runValidators: true }
        );

        if (!updatedUnit) {
            return res.status(404).json({
                success: false,
                error: 'Unit not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Unit updated successfully',
            data: updatedUnit
        });

    } catch (err) {
        console.error('Error updating unit:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A unit with this name already exists within the selected company'
            });
        }

        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }

        if (err.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid unit ID'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Server error occurred while updating unit'
        });
    }
});

router.delete('/units/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const { id } = req.params;
        const companyId = req.session.currentCompany;

        // Validate inputs
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Unit ID is required'
            });
        }

        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        // Check if unit exists and belongs to the company
        const unit = await Unit.findOne({ _id: id, company: companyId });
        if (!unit) {
            return res.status(404).json({
                success: false,
                error: 'Unit not found or does not belong to your company'
            });
        }

        // Check if any items are using this unit
        const itemsUsingUnit = await Item.findOne({ unit: id });
        if (itemsUsingUnit) {
            return res.status(409).json({
                success: false,
                error: 'Cannot delete unit as it is being used by one or more items'
            });
        }

        // Proceed with deletion
        await Unit.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: 'Unit deleted successfully',
            data: { id }
        });

    } catch (err) {
        console.error('Error deleting unit:', err);

        if (err.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid unit ID format'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Server error occurred while deleting unit'
        });
    }
});

module.exports = router;