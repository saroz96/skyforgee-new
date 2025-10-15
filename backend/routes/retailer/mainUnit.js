const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const Company = require('../../models/Company');
const FiscalYear = require('../../models/FiscalYear');
const MainUnit = require('../../models/retailer/MainUnit');
const Item = require('../../models/retailer/Item');

router.get('/mainUnits', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
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

            const mainUnits = await MainUnit.find({ company: companyId });

            return res.json({
                success: true,
                data: {
                    company,
                    currentFiscalYear,
                    mainUnits,
                    companyId,
                    currentCompanyName,
                    user: {
                        id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences || { theme: 'light' }
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
        console.error('Error in /mainUnits route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

router.post('/mainUnits', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { name } = req.body;
        const companyId = req.session.currentCompany;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Main unit name is required'
            });
        }

        const newUnit = new MainUnit({ name, company: companyId });
        await newUnit.save();

        return res.status(201).json({
            success: true,
            message: 'Main unit created successfully',
            data: {
                mainUnit: {
                    id: newUnit._id,
                    name: newUnit.name,
                    company: newUnit.company
                }
            }
        });

    } catch (err) {
        console.error('Error creating main unit:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A main unit with this name already exists within the selected company'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Internal server error while creating main unit'
        });
    }
});

router.put('/mainUnits/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
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

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Main unit name is required'
            });
        }

        // Check if the main unit exists
        const existingUnit = await MainUnit.findById(id);
        if (!existingUnit) {
            return res.status(404).json({
                success: false,
                error: 'Main unit not found'
            });
        }

        // Check if the new name would create a duplicate
        const duplicateUnit = await MainUnit.findOne({
            name,
            company: companyId,
            _id: { $ne: id } // Exclude current document from the check
        });

        if (duplicateUnit) {
            return res.status(409).json({
                success: false,
                error: 'A main unit with this name already exists in your company'
            });
        }

        const updatedUnit = await MainUnit.findByIdAndUpdate(
            id,
            { name, company: companyId },
            { new: true, runValidators: true } // Return the updated document and run validators
        );

        return res.json({
            success: true,
            message: 'Main unit updated successfully',
            data: {
                mainUnit: {
                    id: updatedUnit._id,
                    name: updatedUnit.name,
                    company: updatedUnit.company
                }
            }
        });

    } catch (err) {
        console.error('Error updating main unit:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A main unit with this name already exists'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Internal server error while updating main unit'
        });
    }
});

router.delete('/mainUnits/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { id } = req.params;
        const companyId = req.session.currentCompany;

        // Check if the main unit exists and belongs to the company
        const mainUnit = await MainUnit.findOne({ _id: id, company: companyId });

        if (!mainUnit) {
            return res.status(404).json({
                success: false,
                error: 'Main unit not found or does not belong to your company'
            });
        }

        // Check if any items are using this unit
        const itemsUsingUnit = await Item.findOne({ mainUnit: id });
        if (itemsUsingUnit) {
            return res.status(409).json({
                success: false,
                error: 'Cannot delete - this main unit as it is being used'
            });
        }
        const deletedUnit = await MainUnit.findByIdAndDelete(id);

        if (!deletedUnit) {
            return res.status(404).json({
                success: false,
                error: 'Main unit not found'
            });
        }

        return res.json({
            success: true,
            message: 'Main unit deleted successfully',
            data: {
                deletedUnit: {
                    id: deletedUnit._id,
                    name: deletedUnit.name
                }
            }
        });

    } catch (err) {
        console.error('Error deleting main unit:', err);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while deleting main unit'
        });
    }
});
module.exports = router;