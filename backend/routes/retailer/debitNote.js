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
                .sort({ date: -1, billNumber: -1 }) // Sort by date and bill number descending
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

module.exports = router;