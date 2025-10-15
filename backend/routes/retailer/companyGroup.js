const express = require('express');
const router = express.Router();

const companyGroup = require('../../models/retailer/CompanyGroup');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const Company = require('../../models/Company');
const FiscalYear = require('../../models/FiscalYear');
const Account = require('../../models/retailer/Account');

router.get('/account-group', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({ error: 'Access forbidden for this trade type' });
        }

        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;

        // Fetch data in parallel for better performance
        const [companiesGroups, company] = await Promise.all([
            companyGroup.find({ company: companyId }),
            Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear')
        ]);

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // If no fiscal year is found in session but available in company
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
            return res.status(400).json({ error: 'No fiscal year found in session or company.' });
        }

        // Prepare response data
        const responseData = {
            company: {
                _id: company._id,
                renewalDate: company.renewalDate,
                dateFormat: company.dateFormat,
                fiscalYear: company.fiscalYear ? {
                    _id: company.fiscalYear._id,
                    startDate: company.fiscalYear.startDate,
                    endDate: company.fiscalYear.endDate,
                    name: company.fiscalYear.name,
                    dateFormat: company.fiscalYear.dateFormat,
                    isActive: company.fiscalYear.isActive
                } : null
            },
            currentFiscalYear: currentFiscalYear ? {
                _id: currentFiscalYear._id,
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            } : null,
            companiesGroups: companiesGroups.map(group => ({
                _id: group._id,
                name: group.name,
                type: group.type,
            })),
            companyId,
            currentCompanyName,
            user: {
                _id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                isAdmin: req.user.isAdmin,
                role: req.user.role,
                preferences: req.user.preferences || {}
            },
            isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error in /account-group:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

router.post('/account-group', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const { name, type } = req.body;
        const companyId = req.session.currentCompany;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        if (!name || !type) {
            return res.status(400).json({
                success: false,
                error: 'Both name and type are required fields'
            });
        }

        const newCompanyGroup = new companyGroup({
            name,
            type,
            company: companyId
        });

        const savedGroup = await newCompanyGroup.save();

        // Return the created group in the response
        res.status(201).json({
            success: true,
            message: 'Account group created successfully',
            group: {
                _id: savedGroup._id,
                name: savedGroup.name,
                type: savedGroup.type,
                company: savedGroup.company,
                createdAt: savedGroup.createdAt,
                updatedAt: savedGroup.updatedAt
            }
        });

    } catch (err) {
        console.error('Error creating account group:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'An account group with this name already exists within the selected company.'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: err.message
        });
    }
});

router.put('/account-group/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const { id } = req.params;
        const { name, type } = req.body;

        if (!name || !type) {
            return res.status(400).json({
                success: false,
                error: 'Both name and type are required fields'
            });
        }

        // Check if the group exists and belongs to the current company
        const existingGroup = await companyGroup.findOne({
            _id: id,
            company: req.session.currentCompany
        });

        if (!existingGroup) {
            return res.status(404).json({
                success: false,
                error: 'Account group not found or does not belong to your company'
            });
        }

        // Check for duplicate name (excluding current document)
        const duplicateGroup = await companyGroup.findOne({
            name,
            company: req.session.currentCompany,
            _id: { $ne: id } // Exclude current document from duplicate check
        });

        if (duplicateGroup) {
            return res.status(409).json({
                success: false,
                error: 'An account group with this name already exists within your company'
            });
        }

        const updatedGroup = await companyGroup.findByIdAndUpdate(
            id,
            { name, type },
            { new: true, runValidators: true } // Return updated doc and run schema validators
        );

        res.json({
            success: true,
            message: 'Account group updated successfully',
            group: {
                _id: updatedGroup._id,
                name: updatedGroup.name,
                type: updatedGroup.type,
                company: updatedGroup.company,
                updatedAt: updatedGroup.updatedAt
            }
        });

    } catch (err) {
        console.error('Error updating account group:', err);

        if (err.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid account group ID format'
            });
        }

        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: err.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: err.message
        });
    }
});

router.delete(
    '/account-group/:id',
    ensureAuthenticated,
    ensureCompanySelected,
    ensureTradeType,
    ensureFiscalYear,
    async (req, res) => {
        try {
            if (req.tradeType !== 'retailer') {
                return res.status(403).json({
                    success: false,
                    error: 'Access forbidden for this trade type'
                });
            }

            const { id } = req.params;
            const companyId = req.session.currentCompany;

            // Validate the ID format
            if (!id.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid account group ID format'
                });
            }

            // Verify the group exists and belongs to the current company
            const groupToDelete = await companyGroup.findOne({
                _id: id,
                company: companyId
            });

            if (!groupToDelete) {
                return res.status(404).json({
                    success: false,
                    error: 'Account group not found or does not belong to your company'
                });
            }

            // Check if the group is associated with any accounts
            const isGroupAssociated = await Account.exists({
                companyGroups: id,
                company: companyId
            });

            if (isGroupAssociated) {
                return res.status(409).json({
                    success: false,
                    error: 'This group is associated with accounts and cannot be deleted'
                });
            }

            // Delete the group
            await companyGroup.findByIdAndDelete(id);

            res.json({
                success: true,
                message: 'Account group deleted successfully',
                deletedGroupId: id
            });

        } catch (err) {
            console.error('Error deleting account group:', err);

            if (err.name === 'CastError') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid account group ID'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Internal server error while deleting account group',
                details: err.message
            });
        }
    }
);

module.exports = router;