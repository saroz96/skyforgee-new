const express = require('express')
const router = express.Router()
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Account = require('../../models/retailer/Account');
const CompanyGroup = require('../../models/retailer/CompanyGroup');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth')
const { ensureTradeType } = require('../../middleware/tradeType')
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear')
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange')
const FiscalYear = require('../../models/FiscalYear')
const Company = require('../../models/Company')
const Transaction = require('../../models/retailer/Transaction')

const path = require('path');
const fs = require('fs');
const exceljs = require('exceljs');
const multer = require('multer');

router.get('/contacts', async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat')
            .populate('fiscalYear');

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

        const relevantGroups = await CompanyGroup.find({
            name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
        }).exec();

        const relevantGroupIds = relevantGroups.map(group => group._id);

        const accountContacts = await Account.find({
            company: companyId,
            fiscalYear: fiscalYear,
            isActive: true,
            companyGroups: { $in: relevantGroupIds }
        })
            .select('name address phone email contactperson')
            .sort({ name: 1 });

        res.json(accountContacts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

router.get('/companies', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;

        // Fetch the company and populate the fiscalYear
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat')
            .populate('fiscalYear')
            .lean();

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            // Fetch the fiscal year from the database if available in the session
            currentFiscalYear = await FiscalYear.findById(fiscalYear).lean();
        }

        // If no fiscal year is found in session but exists in company
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
                error: 'No fiscal year found in session or company'
            });
        }

        // Get initial fiscal year
        const initialFiscalYear = await FiscalYear.findOne({ company: companyId })
            .sort({ startDate: 1 })
            .limit(1)
            .lean();

        // Check if current fiscal year is initial
        const isInitialFiscalYear = currentFiscalYear._id.toString() === initialFiscalYear._id.toString();

        // Get accounts
        const accounts = await Account.find({
            company: companyId,
            $or: [
                { originalFiscalYear: fiscalYear }, // Created here
                {
                    fiscalYear: fiscalYear,
                    originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
                }
            ]
        })
            .populate('companyGroups')
            .populate('originalFiscalYear')
            .lean();

        const companyGroups = await CompanyGroup.find({ company: companyId }).lean();

        // Prepare response
        const responseData = {
            success: true,
            data: {
                company: {
                    _id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    fiscalYear: company.fiscalYear
                },
                accounts,
                companyGroups,
                companyId,
                currentCompanyName,
                currentFiscalYear,
                isInitialFiscalYear,
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

    } catch (error) {
        console.error('Error in /companies route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.get('/companies/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access restricted to retailer accounts'
        });
    }

    try {
        const accountId = req.params.id;
        const currentCompanyName = req.session.currentCompanyName;
        const companyId = req.session.currentCompany;

        // Fetch company groups and company data in parallel
        const [companyGroups, company] = await Promise.all([
            CompanyGroup.find({ company: companyId }),
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

            // Update session with fiscal year details
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

        const account = await Account.findOne({ _id: accountId, fiscalYear: fiscalYear })
            .populate('companyGroups')
            .populate('company')
            .populate('openingBalanceByFiscalYear.fiscalYear');

        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        // Ensure the account belongs to the current company
        if (!account.company._id.equals(companyId)) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized access to this account'
            });
        }

        // Find the opening balance for the current fiscal year
        const currentOpeningBalance = account.openingBalanceByFiscalYear.find(
            balance => balance.fiscalYear && balance.fiscalYear._id.toString() === fiscalYear
        );

        // Prepare response data
        // Modify the account response preparation
        const responseData = {
            success: true,
            data: {
                company: {
                    id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat
                },
                account: {
                    ...account.toObject(),
                    // Handle case where companyGroups might be a single object or array
                    companyGroups: Array.isArray(account.companyGroups)
                        ? account.companyGroups.map(group => ({
                            id: group._id,
                            name: group.name
                        }))
                        : account.companyGroups
                            ? [{
                                id: account.companyGroups._id,
                                name: account.companyGroups.name
                            }]
                            : []
                },
                financialInfo: {
                    currentOpeningBalance: currentOpeningBalance || null,
                    fiscalYear: {
                        id: currentFiscalYear._id,
                        name: currentFiscalYear.name,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate
                    }
                },
                companyGroups: companyGroups.map(group => ({
                    id: group._id,
                    name: group.name
                })),
                currentCompanyName,
                user: {
                    id: req.user._id,
                    role: req.user.role,
                    isAdmin: req.user.isAdmin,
                    preferences: req.user.preferences || {}
                },
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        };

        res.json(responseData);

    } catch (err) {
        console.error('Error fetching company:', err);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching company data',
            message: err.message
        });
    }
});

router.post('/companies', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { name, address, phone, ward, pan, email, contactperson, openingBalance, creditLimit, companyGroups } = req.body;
        const companyId = req.session.currentCompany;

        // Input validation
        if (!name || !companyGroups) {
            return res.status(400).json({
                success: false,
                error: 'Name and company group are required fields'
            });
        }

        // Fetch the company and populate the fiscalYear
        const company = await Company.findById(companyId).populate('fiscalYear');
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // Get the initial fiscal year
        const initialFiscalYear = await FiscalYear.findOne({ company: companyId })
            .sort({ startDate: 1 })
            .limit(1);

        if (!initialFiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'Initial fiscal year not found'
            });
        }

        // Check if fiscal year is in session or company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // Set current fiscal year if not in session
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
                error: 'No fiscal year found in session or company'
            });
        }

        // Validate company group
        const accountGroup = await CompanyGroup.findOne({ _id: companyGroups, company: companyId });
        if (!accountGroup) {
            return res.status(400).json({
                success: false,
                error: 'Invalid account group for this company'
            });
        }

        // Check if opening balance is only set in initial fiscal year
        const isInitialYear = currentFiscalYear._id.toString() === initialFiscalYear._id.toString();
        if (!isInitialYear && openingBalance?.amount && parseFloat(openingBalance.amount) !== 0) {
            return res.status(400).json({
                success: false,
                error: 'Opening balance can only be set in the initial fiscal year'
            });
        }

        // Prepare opening balance data
        const openingBalanceAmount = isInitialYear && openingBalance?.amount
            ? parseFloat(openingBalance.amount)
            : 0;
        const openingBalanceType = isInitialYear && openingBalance?.type
            ? openingBalance.type
            : 'Dr';

        // Create new account
        const newCompany = new Account({
            name,
            address,
            phone,
            ward,
            pan,
            email,
            contactperson,
            creditLimit,
            companyGroups,
            initialOpeningBalance: {
                date: currentFiscalYear.startDate,
                amount: openingBalanceAmount,
                type: openingBalanceType,
                initialFiscalYear: currentFiscalYear._id
            },
            openingBalance: {
                date: currentFiscalYear.startDate,
                amount: openingBalanceAmount,
                type: openingBalanceType,
                fiscalYear: fiscalYear
            },
            openingBalanceByFiscalYear: [{
                amount: openingBalanceAmount,
                type: openingBalanceType,
                date: currentFiscalYear.startDate,
                fiscalYear: fiscalYear
            }],
            openingBalanceDate: currentFiscalYear.startDate,
            company: companyId,
            fiscalYear: [fiscalYear],
            originalFiscalYear: currentFiscalYear,
            createdAt: new Date()
        });

        await newCompany.save();

        res.status(201).json({
            success: true,
            message: 'Successfully created a new account',
            data: {
                account: newCompany.toObject()
            }
        });

    } catch (err) {
        console.error('Error creating account:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'An account with this name already exists within the selected company'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error while creating account',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

router.put('/companies/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { id } = req.params;
        const { name, address, ward, phone, pan, contactperson, email, companyGroups, openingBalance, creditLimit } = req.body;
        const companyId = req.session.currentCompany;

        // Validate input
        if (!name || !companyGroups) {
            return res.status(400).json({
                success: false,
                error: 'Name and company group are required fields'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid company ID'
            });
        }

        // Fetch company and fiscal year data
        const company = await Company.findById(companyId).populate('fiscalYear');
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        const initialFiscalYear = await FiscalYear.findOne({ company: companyId })
            .sort({ startDate: 1 })
            .limit(1);

        if (!initialFiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'Initial fiscal year not found'
            });
        }

        // Get current fiscal year
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // Set current fiscal year if not in session
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
                error: 'No fiscal year found in session or company'
            });
        }

        // Validate company group
        const accountGroup = await CompanyGroup.findOne({ _id: companyGroups, company: companyId });
        if (!accountGroup) {
            return res.status(400).json({
                success: false,
                error: 'Invalid account group for this company'
            });
        }

        // Check if opening balance is only set in initial fiscal year
        const isInitialYear = currentFiscalYear._id.toString() === initialFiscalYear._id.toString();
        if (!isInitialYear && openingBalance?.amount && parseFloat(openingBalance.amount) !== 0) {
            return res.status(400).json({
                success: false,
                error: 'Opening balance can only be set in the initial fiscal year'
            });
        }

        // Prepare opening balance data
        const openingBalanceAmount = isInitialYear && openingBalance?.amount
            ? parseFloat(openingBalance.amount)
            : 0;
        const openingBalanceType = isInitialYear && openingBalance?.type
            ? openingBalance.type
            : 'Dr';

        // Update the account
        const updatedAccount = await Account.findByIdAndUpdate(
            id,
            {
                name,
                address,
                ward,
                phone,
                pan,
                contactperson,
                email,
                companyGroups,
                creditLimit,
                initialOpeningBalance: {
                    date: currentFiscalYear.startDate,
                    amount: openingBalanceAmount,
                    type: openingBalanceType,
                    initialFiscalYear: currentFiscalYear._id
                },
                openingBalance: {
                    amount: openingBalanceAmount,
                    type: openingBalanceType,
                    fiscalYear: currentFiscalYear._id
                },
                openingBalanceByFiscalYear: [{
                    amount: openingBalanceAmount,
                    type: openingBalanceType,
                    date: currentFiscalYear.startDate,
                    fiscalYear: currentFiscalYear._id
                }],
                company: companyId,
                fiscalYear: [currentFiscalYear._id]
            },
            { new: true, runValidators: true }
        );

        if (!updatedAccount) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        res.json({
            success: true,
            message: 'Account updated successfully',
            data: {
                account: updatedAccount.toObject()
            }
        });

    } catch (err) {
        console.error('Error updating account:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'An account with this name already exists within the selected company'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error while updating account',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

router.delete('/companies/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { id } = req.params;
        const companyId = req.session.currentCompany;

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid company ID'
            });
        }

        // Check if account exists and belongs to the company
        const account = await Account.findOne({ _id: id, company: companyId });
        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found or does not belong to your company'
            });
        }

        // Check if it's a default cash account
        if (account.defaultCashAccount) {
            return res.status(403).json({
                success: false,
                error: 'Cannot delete default cash account'
            });
        }

        // Check for associated transactions
        const transactions = await Transaction.find({ account: id });
        if (transactions.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete account with associated transactions'
            });
        }

        // Delete the account
        const deletedAccount = await Account.findByIdAndDelete(id);
        if (!deletedAccount) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        res.json({
            success: true,
            message: 'Account deleted successfully',
            data: {
                id: deletedAccount._id,
                name: deletedAccount.name
            }
        });

    } catch (err) {
        console.error('Error deleting account:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to delete account',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;