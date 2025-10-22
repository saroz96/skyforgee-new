const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const JournalVoucher = require('../../models/retailer/JournalVoucher');
const Account = require('../../models/retailer/Account');

const NepaliDate = require('nepali-date');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const Company = require('../../models/Company');
const Transaction = require('../../models/retailer/Transaction');
// const BillCounter = require('../../models/retailer/journalVoucherBillCounter');
const FiscalYear = require('../../models/FiscalYear');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');

// // GET - Show list of journal vouchers (JSON API for React)
// router.get('/journal/register', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     try {
//         if (req.tradeType === 'retailer') {
//             const companyId = req.session.currentCompany;
//             const currentCompanyName = req.session.currentCompanyName;
//             const currentCompany = await Company.findById(new ObjectId(companyId));
//             const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

//             // Check if fiscal year is already in the session or available in the company
//             let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
//             let currentFiscalYear = null;

//             if (fiscalYear) {
//                 // Fetch the fiscal year from the database if available in the session
//                 currentFiscalYear = await FiscalYear.findById(fiscalYear);
//             }

//             // If no fiscal year is found in session or currentCompany, throw an error
//             if (!currentFiscalYear && company.fiscalYear) {
//                 currentFiscalYear = company.fiscalYear;

//                 // Set the fiscal year in the session for future requests
//                 req.session.currentFiscalYear = {
//                     id: currentFiscalYear._id.toString(),
//                     startDate: currentFiscalYear.startDate,
//                     endDate: currentFiscalYear.endDate,
//                     name: currentFiscalYear.name,
//                     dateFormat: currentFiscalYear.dateFormat,
//                     isActive: currentFiscalYear.isActive
//                 };

//                 // Assign fiscal year ID for use
//                 fiscalYear = req.session.currentFiscalYear.id;
//             }

//             if (!fiscalYear) {
//                 return res.status(400).json({
//                     success: false,
//                     error: 'No fiscal year found in session or company.'
//                 });
//             }

//             const journalVouchers = await JournalVoucher.find({ company: req.session.currentCompany })
//                 .populate('debitAccounts.account creditAccounts.account')
//                 .lean()
//                 .exec();

//             return res.json({
//                 success: true,
//                 data: {
//                     company,
//                     currentFiscalYear,
//                     journalVouchers,
//                     currentCompanyName,
//                     currentCompany,
//                     user: req.user,
//                     isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
//                 },
//                 meta: {
//                     title: 'View Journal',
//                     body: 'retailer >> journal >> view journal',
//                     theme: req.user.preferences?.theme || 'light' // Default to light if not set
//                 }
//             });
//         } else {
//             return res.status(403).json({
//                 success: false,
//                 error: 'Access denied for this trade type'
//             });
//         }
//     } catch (error) {
//         console.error('Error in journal-list endpoint:', error);
//         return res.status(500).json({
//             success: false,
//             error: 'Internal server error',
//             details: error.message
//         });
//     }
// });

// GET - Show list of journal vouchers (JSON API for React)
router.get('/journal/register', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const currentCompany = await Company.findById(new ObjectId(companyId));
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const companyDateFormat = currentCompany ? currentCompany.dateFormat : '';

            // Extract dates from query parameters
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

            // If no date range provided, return basic info with empty journal vouchers
            if (!fromDate || !toDate) {
                return res.json({
                    success: true,
                    data: {
                        company,
                        currentFiscalYear,
                        journalVouchers: [],
                        nepaliDate,
                        companyDateFormat,
                        currentCompany,
                        fromDate: req.query.fromDate || '',
                        toDate: req.query.toDate || '',
                        currentCompanyName,
                        user: req.user,
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                    },
                    meta: {
                        title: 'View Journal',
                        body: 'retailer >> journal >> view journal',
                        theme: req.user.preferences?.theme || 'light' // Default to light if not set
                    }
                });
            }

            // Build the query based on date range
            let query = {
                company: req.session.currentCompany,
                fiscalYear: fiscalYear
            };

            if (fromDate && toDate) {
                query.date = { $gte: fromDate, $lte: toDate };
            } else if (fromDate) {
                query.date = { $gte: fromDate };
            } else if (toDate) {
                query.date = { $lte: toDate };
            }

            const journalVouchers = await JournalVoucher.find(query)
                .sort({ date: 1 })
                .populate('debitAccounts.account creditAccounts.account')
                .lean()
                .exec();

            return res.json({
                success: true,
                data: {
                    company,
                    currentFiscalYear,
                    journalVouchers,
                    nepaliDate,
                    companyDateFormat,
                    currentCompany,
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName,
                    user: req.user,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'View Journal',
                    body: 'retailer >> journal >> view journal',
                    theme: req.user.preferences?.theme || 'light'
                }
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }
    } catch (error) {
        console.error('Error in journal-list endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// GET - Get journal voucher form data
router.get('/journal', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
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
                transactionType: 'journalVoucher'
            });

            // Calculate next number for display only
            const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
            const fiscalYears = await FiscalYear.findById(fiscalYear);
            const prefix = fiscalYears.billPrefixes.journalVoucher;
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
            console.error('Error fetching data for journal voucher form:', error);
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


// POST - Create a new journal voucher with multiple debit and credit accounts
router.post('/journal', ensureAuthenticated, ensureCompanySelected, ensureTradeType, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            message: 'Unauthorized trade type.'
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { nepaliDate, billDate, debitAccounts, creditAccounts, description } = req.body;
        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        // Validation
        if (!debitAccounts || !creditAccounts || debitAccounts.length === 0 || creditAccounts.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Debit and credit accounts are required'
            });
        }

        // Validate debit and credit amounts
        const totalDebit = debitAccounts.reduce((sum, account) => sum + (parseFloat(account.debit) || 0), 0);
        const totalCredit = creditAccounts.reduce((sum, account) => sum + (parseFloat(account.credit) || 0), 0);

        if (totalDebit !== totalCredit) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Total debit and credit amounts must be equal'
            });
        }

        // Get bill number
        const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'journalVoucher', session);

        // Create the Journal Voucher
        const journalVoucher = new JournalVoucher({
            billNumber: billNumber,
            date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
            debitAccounts,
            creditAccounts,
            description,
            user: userId,
            company: companyId,
            fiscalYear: currentFiscalYear,
        });

        await journalVoucher.save({ session });

        const debitTransactions = [];
        const creditTransactions = [];

        // Process Debit Accounts
        for (let debit of debitAccounts) {
            if (!mongoose.Types.ObjectId.isValid(debit.account)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Invalid debit account ID.'
                });
            }

            const debitAccount = await Account.findById(debit.account).session(session);
            if (!debitAccount) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    message: `Debit account not found: ${debit.account}`
                });
            }

            let previousDebitBalance = 0;
            const lastDebitTransaction = await Transaction.findOne({ account: debit.account })
                .sort({ transactionDate: -1 })
                .session(session);
            if (lastDebitTransaction) {
                previousDebitBalance = lastDebitTransaction.balance;
            }

            // Save credit accounts in the drCrNoteAccountType field for debit transactions
            const creditAccountNames = await Promise.all(
                creditAccounts.map(async (credit) => {
                    const account = await Account.findById(credit.account).session(session);
                    return account ? account.name : 'Credit Note';
                })
            );

            const debitTransaction = new Transaction({
                account: debit.account,
                type: 'Jrnl',
                journalBillId: journalVoucher._id,
                billNumber: billNumber,
                journalAccountDrCrType: 'Debit',
                journalAccountType: creditAccountNames.join(', '),
                debit: debit.debit,
                credit: 0,
                paymentMode: 'Journal',
                balance: previousDebitBalance + debit.debit,
                date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear,
            });

            await debitTransaction.save({ session });
            await Account.findByIdAndUpdate(
                debit.account,
                { $push: { transactions: debitTransaction._id } },
                { session }
            );

            debitTransactions.push({
                _id: debitTransaction._id,
                account: debitTransaction.account,
                amount: debitTransaction.debit,
                balance: debitTransaction.balance
            });
        }

        // Process Credit Accounts
        for (let credit of creditAccounts) {
            if (!mongoose.Types.ObjectId.isValid(credit.account)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Invalid credit account ID.'
                });
            }

            const creditAccount = await Account.findById(credit.account).session(session);
            if (!creditAccount) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    message: `Credit account not found: ${credit.account}`
                });
            }

            let previousCreditBalance = 0;
            const lastCreditTransaction = await Transaction.findOne({ account: credit.account })
                .sort({ transactionDate: -1 })
                .session(session);
            if (lastCreditTransaction) {
                previousCreditBalance = lastCreditTransaction.balance;
            }

            // Save debit accounts in the drCrNoteAccountType field for credit transactions
            const debitAccountNames = await Promise.all(
                debitAccounts.map(async (debit) => {
                    const account = await Account.findById(debit.account).session(session);
                    return account ? account.name : 'Debit Note';
                })
            );

            const creditTransaction = new Transaction({
                account: credit.account,
                type: 'Jrnl',
                journalBillId: journalVoucher._id,
                billNumber: billNumber,
                journalAccountDrCrType: 'Credit',
                journalAccountType: debitAccountNames.join(', '),
                debit: 0,
                credit: credit.credit,
                paymentMode: 'Journal',
                balance: previousCreditBalance - credit.credit,
                date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear,
            });

            await creditTransaction.save({ session });
            await Account.findByIdAndUpdate(
                credit.account,
                { $push: { transactions: creditTransaction._id } },
                { session }
            );

            creditTransactions.push({
                _id: creditTransaction._id,
                account: creditTransaction.account,
                amount: creditTransaction.credit,
                balance: creditTransaction.balance
            });
        }

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Prepare response data
        const responseData = {
            success: true,
            message: 'Journal voucher saved successfully!',
            data: {
                journalVoucher: {
                    _id: journalVoucher._id,
                    billNumber: journalVoucher.billNumber,
                    date: journalVoucher.date,
                    description: journalVoucher.description,
                    debitAccounts: journalVoucher.debitAccounts,
                    creditAccounts: journalVoucher.creditAccounts
                },
                transactions: {
                    debit: debitTransactions,
                    credit: creditTransactions
                },
                printUrl: `/retailer/journal/${journalVoucher._id}/direct-print`
            }
        };

        if (req.query.print === 'true') {
            responseData.redirectUrl = `/retailer/journal/${journalVoucher._id}/direct-print`;
            return res.json(responseData);
        }

        res.json(responseData);

    } catch (error) {
        console.error('Error creating journal voucher:', error);
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

router.get('/journal/finds', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
                return res.status(400).json({ error: 'No fiscal year found in session or company.' });
            }

            // Fetch the latest saved journal entry (without modifying it)
            const latestJournal = await JournalVoucher.findOne({
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
                    billNumber: latestJournal?.billNumber || '',
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
            console.error('Error in /journals/finds:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        return res.status(400).json({ error: 'Invalid trade type' });
    }
});

// Get journal voucher edit form data
router.get('/journal/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const journalId = req.params.id;
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

            // Find the journal voucher document by ID
            const journal = await JournalVoucher.findById(journalId)
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company');

            if (!journal) {
                return res.status(404).json({
                    success: false,
                    error: 'Journal voucher not found'
                });
            }

            // Fetch accounts
            const accounts = await Account.find({
                company: companyId,
                fiscalYear: fiscalYear,
                isActive: true
            }).exec();

            res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    journal,
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
            console.error('Error fetching data for journal voucher form:', error);
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

//get journal voucher edit for by bill number
router.get('/journal/edit/billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

            //find the journal voucher document by billNumber
            const journal = await JournalVoucher.findOne({
                billNumber: billNumber,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company');

            if (!journal) {
                return res.status(404).json({
                    success: false,
                    error: 'Journal voucher number not found'
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
                    journal: {
                        _id: journal._id,
                        billNumber: journal.billNumber,
                        date: journal.date,
                        narration: journal.narration,
                        debitAccounts: journal.debitAccounts.map(da => ({
                            account: {
                                _id: da.account._id,
                                name: da.account.name,
                                code: da.account.code,
                                uniqueNumber: da.account.uniqueNumber
                            },
                            amount: da.amount,
                            narration: da.narration
                        })),
                        creditAccounts: journal.creditAccounts.map(ca => ({
                            account: {
                                _id: ca.account._id,
                                name: ca.account.name,
                                code: ca.account.code,
                                uniqueNumber: ca.account.uniqueNumber
                            },
                            amount: ca.amount,
                            narration: ca.narration
                        })),
                        user: journal.user ? {
                            _id: journal.user._id,
                            name: journal.user.name
                        } : null,
                        company: journal.company ? {
                            _id: journal.company._id,
                            name: journal.company.name
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
            console.error('Error fetching data for journal form:', error);
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

// PUT - Update an existing journal voucher by ID with multiple debit and credit accounts (JSON response for React)
router.put('/journal/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
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

            // Find the existing journal voucher by ID
            const journalVoucher = await JournalVoucher.findById(id);
            if (!journalVoucher) {
                return res.status(404).json({
                    success: false,
                    message: 'Journal Voucher not found'
                });
            }

            // List of current debit and credit accounts from the request
            const updatedDebitAccountIds = debitAccounts.map(debit => debit.account);
            const updatedCreditAccountIds = creditAccounts.map(credit => credit.account);

            // Remove outdated debit transactions
            await Transaction.deleteMany({
                journalBillId: journalVoucher._id,
                journalAccountDrCrType: 'Debit',
                account: { $nin: updatedDebitAccountIds }
            });

            // Remove outdated credit transactions
            await Transaction.deleteMany({
                journalBillId: journalVoucher._id,
                journalAccountDrCrType: 'Credit',
                account: { $nin: updatedCreditAccountIds }
            });

            // Update the journal voucher fields
            journalVoucher.date = nepaliDate ? new Date(nepaliDate) : new Date(billDate);
            journalVoucher.debitAccounts = debitAccounts;
            journalVoucher.creditAccounts = creditAccounts;
            journalVoucher.description = description;
            await journalVoucher.save();

            // Update or create Debit Transactions
            for (const debit of debitAccounts) {
                const existingDebitTransaction = await Transaction.findOne({
                    journalBillId: journalVoucher._id,
                    account: debit.account,
                    journalAccountDrCrType: 'Debit'
                });

                let previousDebitBalance = 0;
                const lastDebitTransaction = await Transaction.findOne({ account: debit.account }).sort({ transactionDate: -1 });
                if (lastDebitTransaction) {
                    previousDebitBalance = lastDebitTransaction.balance;
                }

                const creditAccountNames = await Promise.all(
                    creditAccounts.map(async credit => {
                        const account = await Account.findById(credit.account);
                        return account ? account.name : 'Journal Note';
                    })
                );

                if (existingDebitTransaction) {
                    // Update existing transaction
                    existingDebitTransaction.debit = debit.debit;
                    existingDebitTransaction.balance = previousDebitBalance + debit.debit;
                    existingDebitTransaction.date = journalVoucher.date;
                    existingDebitTransaction.journalAccountType = creditAccountNames.join(', ');
                    await existingDebitTransaction.save();
                } else {
                    // Create new transaction if it doesn't exist
                    const debitTransaction = new Transaction({
                        account: debit.account,
                        type: 'Jrnl',
                        journalBillId: journalVoucher._id,
                        billNumber: journalVoucher.billNumber,
                        journalAccountDrCrType: 'Debit',
                        journalAccountType: creditAccountNames.join(', '),
                        debit: debit.debit,
                        credit: 0,
                        paymentMode: 'Journal',
                        balance: previousDebitBalance + debit.debit,
                        date: journalVoucher.date,
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
                    journalBillId: journalVoucher._id,
                    account: credit.account,
                    journalAccountDrCrType: 'Credit'
                });

                let previousCreditBalance = 0;
                const lastCreditTransaction = await Transaction.findOne({ account: credit.account }).sort({ transactionDate: -1 });
                if (lastCreditTransaction) {
                    previousCreditBalance = lastCreditTransaction.balance;
                }

                const debitAccountNames = await Promise.all(
                    debitAccounts.map(async debit => {
                        const account = await Account.findById(debit.account);
                        return account ? account.name : 'Journal Note';
                    })
                );

                if (existingCreditTransaction) {
                    // Update existing transaction
                    existingCreditTransaction.credit = credit.credit;
                    existingCreditTransaction.balance = previousCreditBalance - credit.credit;
                    existingCreditTransaction.date = journalVoucher.date;
                    existingCreditTransaction.journalAccountType = debitAccountNames.join(', ');
                    await existingCreditTransaction.save();
                } else {
                    // Create new transaction if it doesn't exist
                    const creditTransaction = new Transaction({
                        account: credit.account,
                        type: 'Jrnl',
                        journalBillId: journalVoucher._id,
                        billNumber: journalVoucher.billNumber,
                        journalAccountDrCrType: 'Credit',
                        journalAccountType: debitAccountNames.join(', '),
                        debit: 0,
                        credit: credit.credit,
                        paymentMode: 'Journal',
                        balance: previousCreditBalance - credit.credit,
                        date: journalVoucher.date,
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear,
                    });

                    await creditTransaction.save();
                    await Account.findByIdAndUpdate(credit.account, { $push: { transactions: creditTransaction._id } });
                }
            }

            // Populate the updated journal voucher for response
            const updatedJournal = await JournalVoucher.findById(journalVoucher._id)
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company');

            // Response for React frontend
            const response = {
                success: true,
                message: 'Journal voucher updated successfully!',
                data: {
                    journal: updatedJournal,
                    printUrl: `/journal/${journalVoucher._id}/direct-print-edit`
                }
            };

            if (req.query.print === 'true') {
                response.print = true;
            }

            res.json(response);

        } catch (error) {
            console.error('Error updating journal voucher:', error);
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

// Route to cancel the journal voucher and related transactions (JSON response)
router.post('/journals/cancel/:billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.params;

            // Update the journal Voucher status to 'canceled'
            const updateJournalVoucherStatus = await JournalVoucher.updateOne(
                { billNumber },
                { status: 'canceled', isActive: false }
            );

            console.log('Journal Voucher Canceled Update Result: ', updateJournalVoucherStatus);

            // Mark related transactions as 'canceled' and set isActive to false
            const updateTransactionsStatus = await Transaction.updateMany(
                { billNumber, type: 'Jrnl' },
                { status: 'canceled', isActive: false }
            );

            console.log('Related transaction update result: ', updateTransactionsStatus);

            // Return JSON response
            res.json({
                success: true,
                message: 'Journal and related transactions have been canceled successfully.',
                data: {
                    journalVoucher: updateJournalVoucherStatus,
                    transactions: updateTransactionsStatus
                }
            });

        } catch (error) {
            console.error('Error canceling journal:', error);

            // Return JSON error response
            res.status(500).json({
                success: false,
                message: 'An error occurred while canceling the journal.',
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

// Route to reactivate the journal and related transactions (JSON response)
router.post('/journals/reactivate/:billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.params;

            // Update the journal voucher status to 'active'
            const updateJournalVoucherStatus = await JournalVoucher.updateOne(
                { billNumber },
                { status: 'active', isActive: true }
            );

            console.log('Update journal voucher status:', updateJournalVoucherStatus);

            // Reactivate related transactions and set isActive to true
            const updateTransactionsStatus = await Transaction.updateMany(
                {
                    billNumber,
                    type: 'Jrnl'
                },
                { status: 'active', isActive: true }
            );

            console.log('Update Transactions Status:', updateTransactionsStatus);

            // Return JSON response
            res.json({
                success: true,
                message: 'Journal and related transactions have been reactivated successfully.',
                data: {
                    journalVoucher: updateJournalVoucherStatus,
                    transactions: updateTransactionsStatus
                }
            });

        } catch (error) {
            console.error("Error reactivating journal:", error);

            // Return JSON error response
            res.status(500).json({
                success: false,
                message: 'An error occurred while reactivating the journal.',
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

// View individual journal voucher (JSON API for React)
router.get('/journal/:id/print', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const journalId = req.params.id;
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

            // Validate journal voucher ID
            if (!mongoose.Types.ObjectId.isValid(journalId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid journal voucher ID.'
                });
            }

            // Find the journal voucher
            const journalVoucher = await JournalVoucher.findById(journalId)
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company')
                .lean()
                .exec();

            if (!journalVoucher) {
                return res.status(404).json({
                    success: false,
                    message: 'Journal voucher not found.'
                });
            }

            const debitTransactions = await Transaction.find({
                journalBillId: journalVoucher._id,
                type: 'Jrnl',
                journalAccountDrCrType: 'Debit'
            }).populate('account').lean().exec();

            const creditTransactions = await Transaction.find({
                journalBillId: journalVoucher._id,
                type: 'Jrnl',
                journalAccountDrCrType: 'Credit'
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
                    journalVoucher: {
                        ...journalVoucher,
                        date: formatDate(journalVoucher.date),
                        createdAt: formatDate(journalVoucher.createdAt),
                        updatedAt: formatDate(journalVoucher.updatedAt),
                        debitAccounts: journalVoucher.debitAccounts || [],
                        creditAccounts: journalVoucher.creditAccounts || [],
                        user: journalVoucher.user || { name: 'N/A' },
                        company: journalVoucher.company || { name: 'N/A' }
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
                    title: 'Print Journal Voucher',
                    body: 'retailer >> journal >> print'
                }
            };

            res.json(response);
        } catch (error) {
            console.error('Error retrieving journal voucher:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
});

module.exports = router;