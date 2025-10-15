const express = require('express');
const router = express.Router();
const Settings = require('../../models/retailer/Settings');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const FiscalYear = require('../../models/FiscalYear');
const Company = require('../../models/Company');

// Fetch settings and return JSON for React frontend
router.get('/roundoff-sales', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

            // Fiscal year handling (unchanged)
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

            // Get settings
            let settings = await Settings.findOne({ company: companyId, userId, fiscalYear: fiscalYear });

            if (!settings) {
                settings = { roundOffSales: false, roundOffPurchase: false, displayTransactions: false, storeManagement: false };
            }

            // JSON response for React
            res.json({
                success: true,
                data: {
                    company: {
                        renewalDate: company.renewalDate,
                        fiscalYear: company.fiscalYear,
                        dateFormat: company.dateFormat
                    },
                    currentFiscalYear,
                    settings,
                    currentCompanyName,
                    user: {
                        _id: req.user._id,
                        role: req.user.role,
                        isAdmin: req.user.isAdmin,
                        preferences: req.user.preferences
                    },
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });

        } catch (error) {
            console.error("Error fetching settings:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching settings'
            });
        }
    }
});

// Update roundOff setting - JSON response for React
router.post('/roundoff-sales', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const { roundOffSales } = req.body;
        const roundOffBoolean = roundOffSales === true || roundOffSales === 'true' || roundOffSales === 'on';

        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId).populate('fiscalYear');

            // Fiscal year handling (unchanged)
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

            let settingsForSales = await Settings.findOne({ company: companyId, userId, fiscalYear: fiscalYear });

            if (!settingsForSales) {
                settingsForSales = new Settings({
                    company: companyId,
                    userId,
                    fiscalYear: fiscalYear,
                    roundOffSales: roundOffBoolean
                });
            } else {
                settingsForSales.roundOffSales = roundOffBoolean;
            }

            await settingsForSales.save();

            // JSON response for React
            res.json({
                success: true,
                message: 'Settings updated successfully',
                data: {
                    roundOffSales: settingsForSales.roundOffSales
                }
            });

        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }
});

// Fetch settings and render the settings page
router.get('/roundoff-sales-return', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;

            const company = await Company.findById(companyId).populate('fiscalYear');

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

            let settingsForSalesReturn = await Settings.findOne({ company: companyId, userId, fiscalYear: fiscalYear });
            if (!settingsForSalesReturn) {
                settingsForSalesReturn = {
                    roundOffSales: false,
                    roundOffPurchase: false,
                    roundOffSalesReturn: false,
                    displayTransactions: false,
                    displayTransactionsForSalesReturn: false,
                    displayTransactionsForPurchase: false
                }; // Provide default settings
            }

            // Return JSON response for React components
            res.json({
                success: true,
                data: {
                    settingsForSalesReturn,
                    currentCompanyName,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role
                    },
                    preferences: {
                        theme: req.user.preferences?.theme || 'light'
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error("Error fetching settings:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching settings',
                message: error.message
            });
        }
    }
});

// Update roundOff setting - JSON response for React
router.post('/roundoff-sales-return', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const { roundOffSalesReturn } = req.body;
        const roundOffBoolean = roundOffSalesReturn === true || roundOffSalesReturn === 'true' || roundOffSalesReturn === 'on';

        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId).populate('fiscalYear');

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
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            let settingsForSalesReturn = await Settings.findOne({ company: companyId, userId, fiscalYear: fiscalYear });

            if (!settingsForSalesReturn) {
                settingsForSalesReturn = new Settings({
                    company: companyId,
                    userId,
                    fiscalYear: fiscalYear,
                    roundOffSalesReturn: roundOffBoolean
                });
            } else {
                settingsForSalesReturn.roundOffSalesReturn = roundOffBoolean;
            }

            await settingsForSalesReturn.save();

            // JSON response for React
            res.json({
                success: true,
                message: 'Settings updated successfully',
                data: {
                    roundOffSalesReturn: settingsForSalesReturn.roundOffSalesReturn
                }
            });

        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }
});

// Fetch settings and return JSON for React frontend
router.get('/roundoff-purchase', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;

            // Get fiscal year from session or company
            const fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;

            let settingsForPurchase = await Settings.findOne({
                company: companyId,
                userId,
                fiscalYear: fiscalYear
            });

            if (!settingsForPurchase) {
                settingsForPurchase = {
                    roundOffSales: false,
                    roundOffPurchase: false,
                    displayTransactions: false
                }; // Provide default settings
            }

            // JSON response for React
            res.json({
                success: true,
                data: {
                    settingsForPurchase,
                    currentCompanyName,
                    user: {
                        _id: req.user._id,
                        role: req.user.role,
                        isAdmin: req.user.isAdmin,
                        preferences: req.user.preferences
                    },
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error("Error fetching settings:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching settings'
            });
        }
    }
});

// Update roundOff setting - JSON response for React
router.post('/roundoff-purchase', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const { roundOffPurchase } = req.body;
        const roundOffBoolean = roundOffPurchase === true || roundOffPurchase === 'true' || roundOffPurchase === 'on';

        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId).populate('fiscalYear');

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
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            let settingsForPurchase = await Settings.findOne({ company: companyId, userId, fiscalYear: fiscalYear });

            if (!settingsForPurchase) {
                settingsForPurchase = new Settings({
                    company: companyId,
                    userId,
                    fiscalYear: fiscalYear,
                    roundOffPurchase: roundOffBoolean
                });
            } else {
                settingsForPurchase.roundOffPurchase = roundOffBoolean;
            }

            await settingsForPurchase.save();

            // JSON response for React
            res.json({
                success: true,
                message: 'Settings updated successfully',
                data: {
                    roundOffPurchase: settingsForPurchase.roundOffPurchase
                }
            });

        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }
});

//Fetch settings and render the settings page
router.get('/roundoff-purchase-return', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;

            const company = await Company.findById(companyId).populate('fiscalYear');

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

            let settingsForPurchaseReturn = await Settings.findOne({ company: companyId, userId, fiscalYear: fiscalYear });
            if (!settingsForPurchaseReturn) {
                settingsForPurchaseReturn = { roundOffSales: false, roundOffPurchase: false, roundOffPurchaseReturn: false, displayTransactions: false }; // Provide default settings
            }

            // Return JSON response for React components
            res.json({
                success: true,
                data: {
                    settingsForPurchaseReturn,
                    currentCompanyName,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role
                    },
                    preferences: {
                        theme: req.user.preferences?.theme || 'light'
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error("Error fetching settings:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching settings',
                message: error.message
            });
        }
    }
});

// Update roundOff setting
router.post('/roundoff-purchase-return', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const { roundOffPurchaseReturn } = req.body;
        const roundOffBoolean = roundOffPurchaseReturn === true || roundOffPurchaseReturn === 'true' || roundOffPurchaseReturn === 'on';

        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;

            const company = await Company.findById(companyId).populate('fiscalYear');

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
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            let settingsForPurchaseReturn = await Settings.findOne({ company: companyId, userId, fiscalYear: fiscalYear });
            if (!settingsForPurchaseReturn) {
                settingsForPurchaseReturn = new Settings({
                    company: companyId,
                    userId,
                    fiscalYear: fiscalYear,
                    roundOffPurchaseReturn: roundOffBoolean
                });
            } else {
                settingsForPurchaseReturn.roundOffPurchaseReturn = roundOffBoolean;
            }

            await settingsForPurchaseReturn.save();

            // Return JSON response for React components
            res.json({
                success: true,
                message: 'Settings updated successfully',
                data: {
                    roundOffPurchaseReturn: settingsForPurchaseReturn.roundOffPurchaseReturn,
                    updatedSettings: settingsForPurchaseReturn
                }
            });

        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error',
                message: error.message
            });
        }
    }
});

// Fetch displayTransactions setting
router.get('/get-display-sales-transactions', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;

            // Ensure companyId and userId are valid before querying the database
            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid company or user information.'
                });
            }

            const settings = await Settings.findOne({ company: companyId, userId });

            // If settings exist, return the displayTransactions setting; otherwise, return false
            const displayTransactions = settings ? settings.displayTransactions : false;

            res.json({
                success: true,
                data: {
                    displayTransactions,
                    currentCompanyName,
                    company: companyId,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error fetching display transactions setting:', error);
            res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }
});

// Update displayTransactions setting
router.post('/updateDisplayTransactionsForSales', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { displayTransactions } = req.body;
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId).populate('fiscalYear');

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
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Log the request body
            console.log('Request Body:', req.body);

            // Validate companyId and userId
            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company ID and User ID are required'
                });
            }

            // Find and update the settings
            const updatedSettings = await Settings.findOneAndUpdate(
                { company: companyId, userId },
                { displayTransactions: displayTransactions === true || displayTransactions === 'true' || displayTransactions === 'on' },
                { upsert: true, new: true, runValidators: true }
            );

            // Log the updated settings
            console.log('Updated Settings:', updatedSettings);

            // Return JSON response for React components
            res.json({
                success: true,
                message: 'Settings updated successfully',
                data: {
                    displayTransactions: updatedSettings.displayTransactions,
                    updatedSettings: updatedSettings
                }
            });
        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }
});

// Fetch displayTransactionsForSalesReturn setting
router.get('/get-display-sales-return-transactions', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;

            // Ensure companyId and userId are valid before querying the database
            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid company or user information.'
                });
            }

            const settings = await Settings.findOne({ company: companyId, userId });

            // If settings exist, return the displayTransactionsForSalesReturn setting; otherwise, return false
            const displayTransactionsForSalesReturn = settings ? settings.displayTransactionsForSalesReturn : false;

            res.json({
                success: true,
                data: {
                    displayTransactionsForSalesReturn,
                    currentCompanyName,
                    company: companyId,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error fetching display transactions setting:', error);
            res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }
});
// Update displayTransactions setting for sales return
router.post('/updateDisplayTransactionsForSalesReturn', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { displayTransactionsForSalesReturn } = req.body;
            const userId = req.user._id;
            const companyId = req.session.currentCompany;

            // Validate input
            if (displayTransactionsForSalesReturn === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'displayTransactionsForSalesReturn is required in request body'
                });
            }

            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID and User ID are required'
                });
            }

            const company = await Company.findById(companyId).populate('fiscalYear');

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
                return res.status(400).json({
                    success: false,
                    message: 'No fiscal year found in session or company.'
                });
            }

            // Find and update the settings
            const updatedSettings = await Settings.findOneAndUpdate(
                { company: companyId, userId, fiscalYear: fiscalYear },
                { displayTransactionsForSalesReturn: displayTransactionsForSalesReturn === 'on' || displayTransactionsForSalesReturn === true },
                { upsert: true, new: true, runValidators: true }
            );

            // Return success response with updated settings
            res.status(200).json({
                success: true,
                message: 'Settings updated successfully',
                data: {
                    displayTransactionsForSalesReturn: updatedSettings.displayTransactionsForSalesReturn,
                    settingsId: updatedSettings._id,
                    updatedAt: updatedSettings.updatedAt
                }
            });

        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied. Retailer trade type required.'
        });
    }
});

// Transactions display settings for Purchase
router.get('/get-display-purchase-transactions', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;

            // Ensure companyId and userId are valid before querying the database
            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid company or user information.'
                });
            }

            const company = await Company.findById(companyId).populate('fiscalYear');

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
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            const settings = await Settings.findOne({
                company: companyId,
                userId,
                fiscalYear: fiscalYear
            });

            // If settings exist, return the displayTransactionsForPurchase setting; otherwise, return false
            const displayTransactionsForPurchase = settings ? settings.displayTransactionsForPurchase : false;

            res.json({
                success: true,
                data: {
                    displayTransactionsForPurchase,
                    currentCompanyName,
                    company: companyId,
                    fiscalYear: {
                        id: fiscalYear,
                        name: currentFiscalYear?.name,
                        startDate: currentFiscalYear?.startDate,
                        endDate: currentFiscalYear?.endDate
                    },
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error fetching display transactions setting:', error);
            res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }
});

router.post('/PurchaseTransactionDisplayUpdate', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { displayTransactionsForPurchase } = req.body;
            const userId = req.user._id;
            const companyId = req.session.currentCompany;

            // Validate input
            if (displayTransactionsForPurchase === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'displayTransactionsForPurchase is required in request body'
                });
            }

            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID and User ID are required'
                });
            }

            const company = await Company.findById(companyId).populate('fiscalYear');

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
                return res.status(400).json({
                    success: false,
                    message: 'No fiscal year found in session or company.'
                });
            }

            // Find and update the settings
            const updatedSettings = await Settings.findOneAndUpdate(
                { company: companyId, userId, fiscalYear: fiscalYear },
                {
                    displayTransactionsForPurchase: displayTransactionsForPurchase === 'on' || displayTransactionsForPurchase === true
                },
                { upsert: true, new: true, runValidators: true }
            );

            // Return success response with updated settings
            res.status(200).json({
                success: true,
                message: 'Settings updated successfully',
                data: {
                    displayTransactionsForPurchase: updatedSettings.displayTransactionsForPurchase,
                    settingsId: updatedSettings._id,
                    updatedAt: updatedSettings.updatedAt,
                    fiscalYear: {
                        id: fiscalYear,
                        name: currentFiscalYear?.name
                    }
                }
            });

        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied. Retailer trade type required.'
        });
    }
});

// Display transactions for purchase return:
router.get('/get-display-purchase-return-transactions', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const userId = req.user._id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;

            // Ensure companyId and userId are valid before querying the database
            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid company or user information.'
                });
            }

            const company = await Company.findById(companyId).populate('fiscalYear');

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
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            const settings = await Settings.findOne({
                company: companyId,
                userId,
                fiscalYear: fiscalYear
            });

            // If settings exist, return the displayTransactionsForPurchaseReturn setting; otherwise, return false
            const displayTransactionsForPurchaseReturn = settings ? settings.displayTransactionsForPurchaseReturn : false;

            res.json({
                success: true,
                data: {
                    displayTransactionsForPurchaseReturn,
                    currentCompanyName,
                    company: companyId,
                    fiscalYear: {
                        id: fiscalYear,
                        name: currentFiscalYear?.name,
                        startDate: currentFiscalYear?.startDate,
                        endDate: currentFiscalYear?.endDate
                    },
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error fetching display transactions setting:', error);
            res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }
});

router.post('/PurchaseReturnTransactionDisplayUpdate', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { displayTransactionsForPurchaseReturn } = req.body;
            const userId = req.user._id;
            const companyId = req.session.currentCompany;

            // Validate input
            if (displayTransactionsForPurchaseReturn === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'displayTransactionsForPurchaseReturn is required in request body'
                });
            }

            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID and User ID are required'
                });
            }

            const company = await Company.findById(companyId).populate('fiscalYear');

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
                return res.status(400).json({
                    success: false,
                    message: 'No fiscal year found in session or company.'
                });
            }

            // Find and update the settings
            const updatedSettings = await Settings.findOneAndUpdate(
                { company: companyId, userId, fiscalYear: fiscalYear },
                {
                    displayTransactionsForPurchaseReturn: displayTransactionsForPurchaseReturn === 'on' || displayTransactionsForPurchaseReturn === true
                },
                { upsert: true, new: true, runValidators: true }
            );

            // Return success response with updated settings
            res.status(200).json({
                success: true,
                message: 'Settings updated successfully',
                data: {
                    displayTransactionsForPurchaseReturn: updatedSettings.displayTransactionsForPurchaseReturn,
                    settingsId: updatedSettings._id,
                    updatedAt: updatedSettings.updatedAt,
                    fiscalYear: {
                        id: fiscalYear,
                        name: currentFiscalYear?.name
                    }
                }
            });

        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied. Retailer trade type required.'
        });
    }
});

module.exports = router;