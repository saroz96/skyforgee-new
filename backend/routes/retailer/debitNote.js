const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const DebitNote = require('../../models/retailer/DebitNote');
const Account = require('../../models/retailer/Account');
const NepaliDate = require('nepali-date');
const { ensureAuthenticated, ensureCompanySelected } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const Company = require('../../models/Company');
const Transaction = require('../../models/retailer/Transaction');
// const BillCounter = require('../../models/retailer/debitNoteBillCounter');
const FiscalYear = require('../../models/FiscalYear');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');

// GET - Show list of debit notes (JSON API for React)
router.get('/debit-note/register', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const currentCompany = await Company.findById(new ObjectId(companyId));
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            let fromDate = req.query.fromDate ? req.query.fromDate : null;
            let toDate = req.query.toDate ? req.query.toDate : null;
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

            // If no date range provided, return empty response with company info
            if (!fromDate || !toDate) {
                return res.json({
                    success: true,
                    data: {
                        company: company,
                        currentFiscalYear: currentFiscalYear,
                        debitNotes: [],
                        fromDate: fromDate || '',
                        toDate: toDate || ''
                    }
                });
            }

            // Build the query
            let query = { company: companyId };

            if (fromDate && toDate) {
                query.date = { $gte: fromDate, $lte: toDate };
            } else if (fromDate) {
                query.date = { $gte: fromDate };
            } else if (toDate) {
                query.date = { $lte: toDate };
            }

            const debitNotes = await DebitNote.find(query)
                .populate('debitAccounts.account creditAccounts.account')
                .sort({ date: 1 }) // Sort by date and bill number descending
                .lean()
                .exec();

            // Format the response data
            const formattedDebitNotes = debitNotes.map(note => ({
                _id: note._id,
                billNumber: note.billNumber,
                date: note.date,
                description: note.description,
                totalDebit: note.debitAccounts.reduce((sum, acc) => sum + (acc.debit || 0), 0),
                totalCredit: note.creditAccounts.reduce((sum, acc) => sum + (acc.credit || 0), 0),
                debitAccounts: note.debitAccounts.map(acc => ({
                    account: acc.account ? {
                        _id: acc.account._id,
                        name: acc.account.name,
                        code: acc.account.code
                    } : null,
                    debit: acc.debit
                })),
                creditAccounts: note.creditAccounts.map(acc => ({
                    account: acc.account ? {
                        _id: acc.account._id,
                        name: acc.account.name,
                        code: acc.account.code
                    } : null,
                    credit: acc.credit
                })),
                user: note.user,
                company: note.company,
                fiscalYear: note.fiscalYear,
                isActive: note.isActive, // Add this line
                status: note.status,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt
            }));

            return res.json({
                success: true,
                data: {
                    company,
                    currentFiscalYear,
                    debitNotes: formattedDebitNotes,
                    currentCompanyName,
                    currentCompany,
                    user: req.user,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'View Debit Notes',
                    body: 'retailer >> debit-note >> view debit notes',
                    theme: req.user.preferences?.theme || 'light' // Default to light if not set
                }
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }
    } catch (error) {
        console.error('Error in debit-note-list endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// GET - Get debit note form data
router.get('/debit-note', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, use company's fiscal year
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

            // Fetch all active accounts for the company and fiscal year
            const accounts = await Account.find({
                company: companyId,
                fiscalYear: fiscalYear,
                isActive: true
            });

            // Get last counter without incrementing
            const lastCounter = await BillCounter.findOne({
                company: companyId,
                fiscalYear: fiscalYear,
                transactionType: 'debitNote'
            });

            // Calculate next number for display only
            const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
            const fiscalYears = await FiscalYear.findById(fiscalYear);
            const prefix = fiscalYears.billPrefixes.debitNote;
            const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

            // Prepare response data
            const responseData = {
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        name: currentFiscalYear.name,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    accounts: accounts.map(account => ({
                        _id: account._id,
                        name: account.name,
                        code: account.uniqueNumber,
                        companyGroups: account.companyGroups,
                        openingBalance: account.openingBalance,
                        balanceType: account.balanceType,
                        isActive: account.isActive
                    })),
                    nextBillNumber,
                    nepaliDate,
                    companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    currentDate: new Date().toISOString().split('T')[0],
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
            console.error('Error fetching data for debit note form:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied for this trade type'
        });
    }
});

// POST - Create a new debit note with multiple debit and credit accounts
router.post('/debit-note', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const { nepaliDate, billDate, debitAccounts, creditAccounts, description } = req.body;
        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        try {
            // Validate required fields
            if (!debitAccounts || !creditAccounts || debitAccounts.length === 0 || creditAccounts.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debit and credit accounts are required'
                });
            }

            // Validate debit and credit amounts match
            const totalDebit = debitAccounts.reduce((sum, account) => sum + parseFloat(account.debit || 0), 0);
            const totalCredit = creditAccounts.reduce((sum, account) => sum + parseFloat(account.credit || 0), 0);

            if (totalDebit !== totalCredit) {
                return res.status(400).json({
                    success: false,
                    message: 'Total debit amount must equal total credit amount'
                });
            }

            const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'debitNote');

            // Create the Debit Note
            const debitNote = new DebitNote({
                billNumber: billNumber,
                date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
                debitAccounts,
                creditAccounts,
                description,
                user: userId,
                company: companyId,
                fiscalYear: currentFiscalYear,
            });

            await debitNote.save();

            // Process Debit Accounts
            const debitTransactions = [];
            for (let debit of debitAccounts) {
                let previousDebitBalance = 0;
                const lastDebitTransaction = await Transaction.findOne({ account: debit.account }).sort({ transactionDate: -1 });
                if (lastDebitTransaction) {
                    previousDebitBalance = lastDebitTransaction.balance;
                }

                const creditAccountNames = await Promise.all(
                    creditAccounts.map(async (credit) => {
                        const account = await Account.findById(credit.account);
                        return account ? account.name : 'Debit Note';
                    })
                );

                const debitTransaction = new Transaction({
                    account: debit.account,
                    type: 'DrNt',
                    debitNoteId: debitNote._id,
                    billNumber: billNumber,
                    drCrNoteAccountTypes: 'Debit',
                    drCrNoteAccountType: creditAccountNames.join(', '),
                    debit: debit.debit,
                    credit: 0,
                    paymentMode: 'Dr Note',
                    balance: previousDebitBalance + debit.debit,
                    date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear,
                });

                await debitTransaction.save();
                debitTransactions.push(debitTransaction._id);
                await Account.findByIdAndUpdate(debit.account, { $push: { transactions: debitTransaction._id } });
            }

            // Process Credit Accounts
            const creditTransactions = [];
            for (let credit of creditAccounts) {
                let previousCreditBalance = 0;
                const lastCreditTransaction = await Transaction.findOne({ account: credit.account }).sort({ transactionDate: -1 });
                if (lastCreditTransaction) {
                    previousCreditBalance = lastCreditTransaction.balance;
                }

                const debitAccountNames = await Promise.all(
                    debitAccounts.map(async (debit) => {
                        const account = await Account.findById(debit.account);
                        return account ? account.name : 'Credit Note';
                    })
                );

                const creditTransaction = new Transaction({
                    account: credit.account,
                    type: 'DrNt',
                    debitNoteId: debitNote._id,
                    billNumber: billNumber,
                    drCrNoteAccountTypes: 'Credit',
                    drCrNoteAccountType: debitAccountNames.join(', '),
                    debit: 0,
                    credit: credit.credit,
                    paymentMode: 'Dr Note',
                    balance: previousCreditBalance - credit.credit,
                    date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear,
                });

                await creditTransaction.save();
                creditTransactions.push(creditTransaction._id);
                await Account.findByIdAndUpdate(credit.account, { $push: { transactions: creditTransaction._id } });
            }

            // Prepare success response
            const responseData = {
                success: true,
                message: 'Debit Note saved successfully!',
                data: {
                    debitNote: {
                        _id: debitNote._id,
                        billNumber: debitNote.billNumber,
                        date: debitNote.date,
                        description: debitNote.description,
                        debitAccounts: debitNote.debitAccounts,
                        creditAccounts: debitNote.creditAccounts,
                        totalDebit: totalDebit,
                        totalCredit: totalCredit
                    },
                    transactions: {
                        debitTransactions: debitTransactions,
                        creditTransactions: creditTransactions
                    },
                    redirectUrl: req.query.print === 'true'
                        ? `/debit-note/${debitNote._id}/direct-print`
                        : '/debit-note/new'
                }
            };

            res.status(201).json(responseData);

        } catch (err) {
            console.error('Error saving debit note:', err);
            res.status(500).json({
                success: false,
                message: 'Error saving debit note!',
                error: err.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied for this trade type'
        });
    }
});

router.get('/debit-note/finds', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
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

                fiscalYear = req.session.currentFiscalYear.id;
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Fetch the latest saved debit note entry (without modifying it)
            const latestDebitNote = await DebitNote.findOne({
                company: companyId,
                fiscalYear: fiscalYear
            })
                .sort({ date: -1, billNumber: -1 }) // Sort by date descending, then billNumber descending
                .select('billNumber date')
                .lean();

            // Return JSON response instead of rendering
            return res.json({
                success: true,
                data: {
                    company: company,
                    billNumber: latestDebitNote?.billNumber || '',
                    currentFiscalYear: currentFiscalYear,
                    companyDateFormat: companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    date: new Date().toISOString().split('T')[0],
                    title: '',
                    body: '',
                    user: req.user,
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error in /debitnote/finds:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    } else {
        return res.status(400).json({
            success: false,
            error: 'Invalid trade type'
        });
    }
});

router.get('/debit-note/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const debitNoteId = req.params.id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
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

            // Find the debit note document by ID
            const debitNote = await DebitNote.findById(debitNoteId)
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company');

            if (!debitNote) {
                return res.status(404).json({
                    success: false,
                    error: 'Debit note not found'
                });
            }

            // Fetch accounts
            const accounts = await Account.find({
                company: companyId,
                fiscalYear: fiscalYear,
                isActive: true
            }).exec();

            // Format dates safely
            const formatDate = (date) => {
                if (!date) return null;
                try {
                    return new Date(date).toISOString().split('T')[0];
                } catch (e) {
                    return null;
                }
            };

            res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    debitNote: {
                        ...debitNote.toObject(),
                        date: formatDate(debitNote.date),
                        createdAt: formatDate(debitNote.createdAt),
                        updatedAt: formatDate(debitNote.updatedAt),
                        debitAccounts: debitNote.debitAccounts || [],
                        creditAccounts: debitNote.creditAccounts || [],
                        user: debitNote.user || null,
                        company: debitNote.company || null
                    },
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    accounts: accounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        code: acc.uniqueNumber,
                        uniqueNumber: acc.uniqueNumber,
                        accountType: acc.accountType,
                        isActive: acc.isActive
                        // include other necessary account fields
                    })),
                    nepaliDate,
                    companyDateFormat,
                    currentCompanyName,
                    date: new Date().toISOString().split('T')[0],
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
            });

        } catch (error) {
            console.error('Error fetching data for debit note form:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});


router.get('/debit-note/edit/billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.query;
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
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

            // Find the debit note document by billNumber
            const debitNote = await DebitNote.findOne({
                billNumber: billNumber,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company');

            if (!debitNote) {
                return res.status(404).json({
                    success: false,
                    error: 'Debit note not found'
                });
            }

            // Fetch accounts excluding 'Cash in Hand' and 'Bank Accounts'
            const accounts = await Account.find({
                company: companyId,
                fiscalYear: fiscalYear,
            }).exec();

            // Return JSON response instead of rendering
            return res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    debitNote: {
                        _id: debitNote._id,
                        billNumber: debitNote.billNumber,
                        date: debitNote.date,
                        description: debitNote.description,
                        debitAccounts: debitNote.debitAccounts.map(da => ({
                            account: {
                                _id: da.account._id,
                                name: da.account.name,
                                code: da.account.code,
                                uniqueNumber: da.account.uniqueNumber
                            },
                            debit: da.debit,
                            description: da.description
                        })),
                        creditAccounts: debitNote.creditAccounts.map(ca => ({
                            account: {
                                _id: ca.account._id,
                                name: ca.account.name,
                                code: ca.account.code,
                                uniqueNumber: ca.account.uniqueNumber
                            },
                            credit: ca.credit,
                            description: ca.description
                        })),
                        user: debitNote.user ? {
                            _id: debitNote.user._id,
                            name: debitNote.user.name
                        } : null,
                        company: debitNote.company ? {
                            _id: debitNote.company._id,
                            name: debitNote.company.name
                        } : null
                    },
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    accounts: accounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        code: acc.code,
                        uniqueNumber: acc.uniqueNumber,
                        // include other necessary account fields
                    })),
                    nepaliDate,
                    companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    date: new Date().toISOString().split('T')[0],
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
            });
        } catch (error) {
            console.error('Error fetching data for debit note form:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});

// PUT - Update an existing debit note by ID with multiple debit and credit accounts (JSON response for React)
router.put('/debit-note/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { nepaliDate, billDate, debitAccounts, creditAccounts, description } = req.body;
            const { id } = req.params;
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear._id;
            const userId = req.user._id;

            // Validation
            if (!debitAccounts || !creditAccounts || debitAccounts.length === 0 || creditAccounts.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debit and credit accounts are required'
                });
            }

            // Validate debit and credit amounts match
            const totalDebit = debitAccounts.reduce((sum, debit) => sum + parseFloat(debit.debit || 0), 0);
            const totalCredit = creditAccounts.reduce((sum, credit) => sum + parseFloat(credit.credit || 0), 0);

            if (totalDebit !== totalCredit) {
                return res.status(400).json({
                    success: false,
                    message: 'Total debit and credit amounts must match'
                });
            }

            // Validate ObjectId
            if (!mongoose.isValidObjectId(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Debit Note ID.'
                });
            }

            // Find the existing debit note by ID
            const debitNote = await DebitNote.findById(id);
            if (!debitNote) {
                return res.status(404).json({
                    success: false,
                    message: 'Debit note not found'
                });
            }

            // List of current debit and credit accounts from the request
            const updatedDebitAccountIds = debitAccounts.map(debit => debit.account);
            const updatedCreditAccountIds = creditAccounts.map(credit => credit.account);

            // Remove outdated debit transactions
            await Transaction.deleteMany({
                debitNoteId: debitNote._id,
                drCrNoteAccountTypes: 'Debit',
                account: { $nin: updatedDebitAccountIds }
            });

            // Remove outdated credit transactions
            await Transaction.deleteMany({
                debitNoteId: debitNote._id,
                drCrNoteAccountTypes: 'Credit',
                account: { $nin: updatedCreditAccountIds }
            });

            // Update the debit note fields
            debitNote.date = nepaliDate ? new Date(nepaliDate) : new Date(billDate);
            debitNote.debitAccounts = debitAccounts;
            debitNote.creditAccounts = creditAccounts;
            debitNote.description = description;
            await debitNote.save();

            // Update or create Debit Transactions
            for (const debit of debitAccounts) {
                const existingDebitTransaction = await Transaction.findOne({
                    debitNoteId: debitNote._id,
                    account: debit.account,
                    drCrNoteAccountTypes: 'Debit'
                });

                let previousDebitBalance = 0;
                const lastDebitTransaction = await Transaction.findOne({ account: debit.account }).sort({ transactionDate: -1 });
                if (lastDebitTransaction) {
                    previousDebitBalance = lastDebitTransaction.balance;
                }

                const creditAccountNames = await Promise.all(
                    creditAccounts.map(async credit => {
                        const account = await Account.findById(credit.account);
                        return account ? account.name : 'Credit Note';
                    })
                );

                if (existingDebitTransaction) {
                    // Update existing transaction
                    existingDebitTransaction.debit = debit.debit;
                    existingDebitTransaction.balance = previousDebitBalance + debit.debit;
                    existingDebitTransaction.date = debitNote.date;
                    existingDebitTransaction.drCrNoteAccountType = creditAccountNames.join(', ');
                    await existingDebitTransaction.save();
                } else {
                    // Create new transaction if it doesn't exist
                    const debitTransaction = new Transaction({
                        account: debit.account,
                        type: 'DrNt',
                        debitNoteId: debitNote._id,
                        billNumber: debitNote.billNumber,
                        drCrNoteAccountTypes: 'Debit',
                        drCrNoteAccountType: creditAccountNames.join(', '),
                        debit: debit.debit,
                        credit: 0,
                        paymentMode: 'Dr Note',
                        balance: previousDebitBalance + debit.debit,
                        date: debitNote.date,
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear,
                    });

                    await debitTransaction.save();
                    await Account.findByIdAndUpdate(debit.account, { $push: { transactions: debitTransaction._id } });
                }
            }

            // Update or create Credit Transactions
            for (const credit of creditAccounts) {
                const existingCreditTransaction = await Transaction.findOne({
                    debitNoteId: debitNote._id,
                    account: credit.account,
                    drCrNoteAccountTypes: 'Credit'
                });

                let previousCreditBalance = 0;
                const lastCreditTransaction = await Transaction.findOne({ account: credit.account }).sort({ transactionDate: -1 });
                if (lastCreditTransaction) {
                    previousCreditBalance = lastCreditTransaction.balance;
                }

                const debitAccountNames = await Promise.all(
                    debitAccounts.map(async debit => {
                        const account = await Account.findById(debit.account);
                        return account ? account.name : 'Debit Note';
                    })
                );

                if (existingCreditTransaction) {
                    // Update existing transaction
                    existingCreditTransaction.credit = credit.credit;
                    existingCreditTransaction.balance = previousCreditBalance - credit.credit;
                    existingCreditTransaction.date = debitNote.date;
                    existingCreditTransaction.drCrNoteAccountType = debitAccountNames.join(', ');
                    await existingCreditTransaction.save();
                } else {
                    // Create new transaction if it doesn't exist
                    const creditTransaction = new Transaction({
                        account: credit.account,
                        type: 'DrNt',
                        debitNoteId: debitNote._id,
                        billNumber: debitNote.billNumber,
                        drCrNoteAccountTypes: 'Credit',
                        drCrNoteAccountType: debitAccountNames.join(', '),
                        debit: 0,
                        credit: credit.credit,
                        paymentMode: 'Dr Note',
                        balance: previousCreditBalance - credit.credit,
                        date: debitNote.date,
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear,
                    });

                    await creditTransaction.save();
                    await Account.findByIdAndUpdate(credit.account, { $push: { transactions: creditTransaction._id } });
                }
            }

            // Populate the updated debit note for response
            const updatedDebitNote = await DebitNote.findById(debitNote._id)
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company');

            // Response for React frontend
            const response = {
                success: true,
                message: 'Debit note updated successfully!',
                data: {
                    debitNote: updatedDebitNote,
                    printUrl: `/debit-note/${debitNote._id}/direct-print-edit`
                }
            };

            if (req.query.print === 'true') {
                response.print = true;
            }

            res.json(response);

        } catch (error) {
            console.error('Error updating debit note:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            message: 'Unauthorized trade type.'
        });
    }
});

// Route to cancel the debit note and related transactions (JSON response)
router.post('/debit-note/cancel/:billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.params;

            // Update the debit note status to 'canceled'
            const updateDebitNoteStatus = await DebitNote.updateOne(
                { billNumber },
                { status: 'canceled', isActive: false }
            );

            console.log('Debit Note Canceled Update Result: ', updateDebitNoteStatus);

            // Mark related transactions as 'canceled' and set isActive to false
            const updateTransactionsStatus = await Transaction.updateMany(
                { billNumber, type: 'DrNt' },
                { status: 'canceled', isActive: false }
            );

            console.log('Related transaction update result: ', updateTransactionsStatus);

            // Return JSON response
            res.json({
                success: true,
                message: 'Debit note and related transactions have been canceled successfully.',
                data: {
                    debitNote: updateDebitNoteStatus,
                    transactions: updateTransactionsStatus
                }
            });

        } catch (error) {
            console.error('Error canceling debit note:', error);

            // Return JSON error response
            res.status(500).json({
                success: false,
                message: 'An error occurred while canceling the debit note.',
                error: error.message
            });
        }
    } else {
        // Return unauthorized response for non-retailer trade types
        res.status(403).json({
            success: false,
            message: 'Unauthorized trade type. Only retailers can perform this action.'
        });
    }
});

// Route to reactivate the debit note and related transactions (JSON response)
router.post('/debit-note/reactivate/:billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.params;

            // Update the debit note status to 'active'
            const updateDebitNoteStatus = await DebitNote.updateOne(
                { billNumber },
                { status: 'active', isActive: true }
            );

            console.log('Update debit note status:', updateDebitNoteStatus);

            // Reactivate related transactions and set isActive to true
            const updateTransactionsStatus = await Transaction.updateMany(
                {
                    billNumber,
                    type: 'DrNt'
                },
                { status: 'active', isActive: true }
            );

            console.log('Update Transactions Status:', updateTransactionsStatus);

            // Return JSON response
            res.json({
                success: true,
                message: 'Debit note and related transactions have been reactivated successfully.',
                data: {
                    debitNote: updateDebitNoteStatus,
                    transactions: updateTransactionsStatus
                }
            });

        } catch (error) {
            console.error("Error reactivating debit note:", error);

            // Return JSON error response
            res.status(500).json({
                success: false,
                message: 'An error occurred while reactivating the debit note.',
                error: error.message
            });
        }
    } else {
        // Return unauthorized response for non-retailer trade types
        res.status(403).json({
            success: false,
            message: 'Unauthorized trade type. Only retailers can perform this action.'
        });
    }
});

// View individual debit note (JSON API for React)
router.get('/debit-note/:id/print', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const debitNoteId = req.params.id;
            const currentCompanyName = req.session.currentCompanyName;
            const companyId = req.session.currentCompany;

            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat name address ward city country phone email pan').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
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

            // Validate the selectedDate
            if (!nepaliDate || isNaN(new Date(nepaliDate).getTime())) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid invoice date provided'
                });
            }

            const currentCompany = await Company.findById(new ObjectId(companyId));
            if (!currentCompany) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Validate debit note ID
            if (!mongoose.Types.ObjectId.isValid(debitNoteId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid debit note ID.'
                });
            }

            // Find the debit note
            const debitNote = await DebitNote.findById(debitNoteId)
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company')
                .lean()
                .exec();

            if (!debitNote) {
                return res.status(404).json({
                    success: false,
                    message: 'Debit note not found.'
                });
            }

            const debitTransactions = await Transaction.find({
                debitNoteId: debitNote._id,
                type: 'DrNt',
                drCrNoteAccountTypes: 'Debit'
            }).populate('account').lean().exec();

            const creditTransactions = await Transaction.find({
                debitNoteId: debitNote._id,
                type: 'DrNt',
                drCrNoteAccountTypes: 'Credit'
            }).populate('account').lean().exec();

            // Format dates safely
            const formatDate = (date) => {
                if (!date) return null;
                try {
                    return new Date(date).toISOString().split('T')[0];
                } catch (e) {
                    return null;
                }
            };

            // Prepare response
            const response = {
                success: true,
                data: {
                    company: {
                        ...company,
                        fiscalYear: company.fiscalYear
                    },
                    currentFiscalYear: currentFiscalYear,
                    debitNote: {
                        ...debitNote,
                        date: formatDate(debitNote.date),
                        createdAt: formatDate(debitNote.createdAt),
                        updatedAt: formatDate(debitNote.updatedAt),
                        debitAccounts: debitNote.debitAccounts || [],
                        creditAccounts: debitNote.creditAccounts || [],
                        user: debitNote.user || { name: 'N/A' },
                        company: debitNote.company || { name: 'N/A' }
                    },
                    debitTransactions: debitTransactions || [],
                    creditTransactions: creditTransactions || [],
                    currentCompanyName,
                    currentCompany: {
                        _id: currentCompany._id,
                        name: currentCompany.name,
                        phone: currentCompany.phone,
                        pan: currentCompany.pan,
                        address: currentCompany.address,
                        ward: currentCompany.ward,
                        city: currentCompany.city,
                        country: currentCompany.country,
                        email: currentCompany.email
                    },
                    currentDate: formatDate(new Date()),
                    nepaliDate,
                    user: req.user ? {
                        name: req.user.name,
                        email: req.user.email
                    } : null,
                    userPreferences: {
                        theme: req.user?.preferences?.theme || 'light'
                    },
                    userRoles: {
                        isAdminOrSupervisor: req.user?.isAdmin || req.user?.role === 'Supervisor'
                    }
                },
                meta: {
                    title: 'Print Debit Note',
                    body: 'retailer >> debit-note >> print'
                }
            };

            res.json(response);
        } catch (error) {
            console.error('Error retrieving debit note:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
});

module.exports = router;