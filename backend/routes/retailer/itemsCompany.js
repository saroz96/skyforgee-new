const express = require('express');
const router = express.Router();

const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const Company = require('../../models/Company');
const FiscalYear = require('../../models/FiscalYear');
const Item = require('../../models/retailer/Item');
const itemsCompany = require('../../models/retailer/itemsCompany');


router.get('/items-company', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }

    try {
        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        // Fetch data in parallel
        const [itemsCompanies, company] = await Promise.all([
            itemsCompany.find({ company: companyId }),
            Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear')
        ]);

        // Check fiscal year
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // Fallback to company's fiscal year
        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;

            // Update session
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
                error: 'No fiscal year found in session or company'
            });
        }

        // Prepare response data
        const responseData = {
            success: true,
            data: {
                itemsCompanies: itemsCompanies.map(company => ({
                    _id: company._id,
                    name: company.name,
                    // include other relevant fields
                })),
                company: {
                    _id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    // include other relevant fields
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
                companyId,
                user: {
                    _id: req.user._id,
                    name: req.user.name,
                    email: req.user.email,
                    preferences: req.user.preferences,
                    isAdmin: req.user.isAdmin,
                    role: req.user.role
                },
                theme: req.user.preferences?.theme || 'light',
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error fetching items companies:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

router.post('/items-company', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { name } = req.body;
            const companyId = req.session.currentCompany;

            if (!companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company ID is required'
                });
            }

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }

            const newItemsCompany = new itemsCompany({ name, company: companyId });
            await newItemsCompany.save();

            return res.status(201).json({
                success: true,
                message: 'Successfully saved a company',
                data: newItemsCompany
            });

        } catch (err) {
            if (err.code === 11000) {
                return res.status(409).json({
                    success: false,
                    error: 'A company with this name already exists within the selected company.'
                });
            }

            console.error(err);
            return res.status(500).json({
                success: false,
                error: 'Server error occurred while processing your request'
            });
        }
    } else {
        return res.status(403).json({
            success: false,
            error: 'Access forbidden for this trade type'
        });
    }
});

router.put('/items-company/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access forbidden for this trade type'
        });
    }

    try {
        const { name } = req.body;
        const companyId = req.session.currentCompany;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Company name is required'
            });
        }

        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        if (!req.params.id) {
            return res.status(400).json({
                success: false,
                error: 'Item company ID is required'
            });
        }

        const updatedCompany = await itemsCompany.findByIdAndUpdate(
            req.params.id,
            { name, company: companyId },
            { new: true, runValidators: true }
        );

        if (!updatedCompany) {
            return res.status(404).json({
                success: false,
                error: 'Item company not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Company updated successfully',
            data: updatedCompany
        });

    } catch (err) {
        console.error('Error updating company:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A company with this name already exists'
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
            error: 'Server error occurred while updating company'
        });
    }
});

router.delete('/items-company/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access forbidden for this trade type'
        });
    }

    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        // Check if the company exists
        const companyToDelete = await itemsCompany.findById(id);
        if (!companyToDelete) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // Check if it's the default "General" company
        if (companyToDelete.name === 'General') {
            return res.status(403).json({
                success: false,
                error: 'The default "General" company cannot be deleted'
            });
        }

        // Check for associated items
        const associatedItems = await Item.findOne({ itemsCompany: id });
        if (associatedItems) {
            return res.status(409).json({
                success: false,
                error: 'Company cannot be deleted because it is associated with items'
            });
        }

        // Proceed with deletion
        await itemsCompany.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: 'Company deleted successfully',
            data: { id }
        });

    } catch (error) {
        console.error('Error deleting company:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while deleting the company'
        });
    }
});


module.exports = router;