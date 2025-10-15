const express = require('express');
const router = express.Router();
const Receipt = require('../../models/retailer/Receipt'); // Adjust the path as necessary

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Account = require('../../models/retailer/Account');
const Company = require('../../models/Company');
const CompanyGroup = require('../../models/retailer/CompanyGroup')
const Transaction = require('../../models/retailer/Transaction')
const NepaliDate = require('nepali-date');
// const BillCounter = require('../../models/retailer/receiptBillCounter');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const FiscalYear = require('../../models/FiscalYear');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');


// GET - Show list of receipt vouchers (JSON API for React)
router.get('/receipts/register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompany = await Company.findById(new ObjectId(companyId));
            const currentCompanyName = req.session.currentCompanyName;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const companyDateFormat = currentCompany ? currentCompany.dateFormat : '';
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

            // Extract dates from query parameters
            let fromDate = req.query.fromDate ? req.query.fromDate : null;
            let toDate = req.query.toDate ? req.query.toDate : null;

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, use company's fiscal year
            if (!currentFiscalYear && company.fiscalYear) {
                currentFiscalYear = company.fiscalYear;
                fiscalYear = currentFiscalYear._id.toString();
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // If no date range provided, return basic info
            if (!fromDate || !toDate) {
                return res.json({
                    success: true,
                    data: {
                        company,
                        currentFiscalYear: currentFiscalYear,
                        nepaliDate,
                        companyDateFormat,
                        currentCompany,
                        receipts: [],
                        fromDate: req.query.fromDate || '',
                        toDate: req.query.toDate || '',
                        currentCompanyName,
                        user: req.user,
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                    },
                    meta: {
                        title: 'Receipt Register',
                        theme: req.user.preferences?.theme || 'light'
                    }
                });
            }

            // Build the query based on the company's date format
            let query = { company: companyId, fiscalYear: fiscalYear };

            if (fromDate && toDate) {
                query.date = { $gte: fromDate, $lte: toDate };
            } else if (fromDate) {
                query.date = { $gte: fromDate };
            } else if (toDate) {
                query.date = { $lte: toDate };
            }

            const receipts = await Receipt.find(query)
                .sort({ date: 1 })
                .populate('account', 'name uniqueNumber')
                .populate('user', 'name')
                .populate('receiptAccount', 'name')
                .lean()
                .exec();

            return res.json({
                success: true,
                data: {
                    company,
                    currentFiscalYear,
                    receipts,
                    companyDateFormat,
                    nepaliDate,
                    currentCompany,
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName,
                    user: req.user,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'Purchase VAT Report',
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
        console.error('Error in receipts-list endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Get payment form
router.get('/receipts', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
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
        return res.status(400).json({ error: 'No fiscal year found in session or company.' });
    }

    try {
        // Fetch company group IDs for 'Cash in Hand' and 'Bank Accounts'
        const cashGroups = await CompanyGroup.find({ name: 'Cash in Hand' }).exec();
        const bankGroups = await CompanyGroup.find({ name: { $in: ['Bank Accounts', 'Bank O/D Account'] } }).exec();

        // Convert bank group IDs to an array of ObjectIds
        const bankGroupIds = bankGroups.map(group => group._id);
        const cashGroupIds = cashGroups.map(group => group._id);

        // Fetch only the required company groups: Cash in Hand, Sundry Debtors, Sundry Creditors
        const relevantGroups = await CompanyGroup.find({
            name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
        }).exec();

        // Convert relevant group IDs to an array of ObjectIds
        const relevantGroupIds = relevantGroups.map(group => group._id);

        const accounts = await Account.find({
            company: companyId,
            // fiscalYear: fiscalYear,
            isActive: true,
            $or: [
                { originalFiscalYear: fiscalYear }, // Created here
                {
                    fiscalYear: fiscalYear,
                    originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
                }
            ],
            companyGroups: { $in: relevantGroupIds }
        });
        // Fetch accounts for 'Cash in Hand' and 'Bank Accounts'
        const cashAccounts = cashGroups
            ? await Account.find({
                companyGroups: { $in: cashGroupIds },
                company: companyId,
                isActive: true,
                fiscalYear: fiscalYear
            }).exec()
            : [];
        const bankAccounts = bankGroups.length > 0
            ? await Account.find({
                companyGroups: { $in: bankGroupIds },
                company: companyId,
                isActive: true,
                fiscalYear: fiscalYear
            }).exec()
            : [];

        // Get last counter without incrementing
        const lastCounter = await BillCounter.findOne({
            company: companyId,
            fiscalYear: fiscalYear,
            transactionType: 'receipt'
        });

        // Calculate next number for display only
        const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
        const fiscalYears = await FiscalYear.findById(fiscalYear);
        const prefix = fiscalYears.billPrefixes.receipt;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        // Return JSON response for React components
        res.json({
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
                accounts,
                cashAccounts: cashAccounts.map(account => ({
                    _id: account._id,
                    name: account.name,
                    code: account.code,
                    // include other necessary account fields
                })),
                bankAccounts: bankAccounts.map(account => ({
                    _id: account._id,
                    name: account.name,
                    code: account.code,
                    // include other necessary account fields
                })),
                nextBillNumber,
                nepaliDate,
                companyDateFormat,
                currentCompanyName: req.session.currentCompanyName,
                date: new Date().toISOString().split('T')[0],
                user: {
                    _id: req.user._id,
                    name: req.user.name,
                    isAdmin: req.user.isAdmin,
                    role: req.user.role,
                    preferences: req.user.preferences
                },
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        });
    } catch (error) {
        console.error('Error fetching data for receipts form:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// // Create a new receipt
// router.post('/receipts', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
//     if (req.tradeType !== 'retailer') {
//         return res.status(403).json({
//             success: false,
//             message: 'Unauthorized trade type.'
//         });
//     }

//     try {
//         const { billDate, nepaliDate, receiptAccount, accountId, credit, InstType, bankAcc, InstNo, description } = req.body;
//         const companyId = req.session.currentCompany;
//         const currentFiscalYear = req.session.currentFiscalYear.id;
//         const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
//         const userId = req.user._id;

//         // Validation
//         if (!accountId || !credit || !receiptAccount) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'All fields are required'
//             });
//         }

//         if (!mongoose.Types.ObjectId.isValid(accountId) || !mongoose.Types.ObjectId.isValid(receiptAccount)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid account ID.'
//             });
//         }

//         if (isNaN(credit) || credit <= 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Credit amount must be a positive number.'
//             });
//         }

//         // Get bill number
//         const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'receipt');

//         // Verify accounts exist
//         const creditedAccount = await Account.findById(accountId);
//         if (!creditedAccount) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Credited account not found.'
//             });
//         }

//         const debitAccount = await Account.findById(receiptAccount);
//         if (!debitAccount) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Receipt account not found.'
//             });
//         }

//         // Get previous balances
//         let previousCreditBalance = 0;
//         const lastCreditTransaction = await Transaction.findOne({ accountId }).sort({ transactionDate: -1 });
//         if (lastCreditTransaction) {
//             previousCreditBalance = lastCreditTransaction.balance;
//         }

//         let previousDebitBalance = 0;
//         const lastDebitTransaction = await Transaction.findOne({ account: debitAccount._id }).sort({ transactionDate: -1 });
//         if (lastDebitTransaction) {
//             previousDebitBalance = lastDebitTransaction.balance;
//         }

//         // Create receipt record
//         const receipt = new Receipt({
//             billNumber: billNumber,
//             date: nepaliDate ? nepaliDate : new Date(billDate),
//             account: accountId,
//             InstType,
//             InstNo,
//             credit,
//             debit: 0,
//             receiptAccount,
//             description,
//             bankAcc,
//             isActive: true,
//             user: userId,
//             fiscalYear: currentFiscalYear,
//             company: companyId
//         });

//         // Create credit transaction
//         const creditTransaction = new Transaction({
//             account: accountId,
//             type: 'Rcpt',
//             receiptAccountId: receipt._id,
//             drCrNoteAccountTypes: 'Credit',
//             billNumber: billNumber,
//             accountType: receiptAccount,
//             credit,
//             debit: 0,
//             paymentMode: 'Receipt',
//             paymentReceiptType: 'Receipt',
//             balance: previousCreditBalance + credit,
//             date: nepaliDate ? nepaliDate : new Date(billDate),
//             isActive: true,
//             company: companyId,
//             user: userId,
//             fiscalYear: currentFiscalYear,
//         });

//         await creditTransaction.save();
//         await Account.findByIdAndUpdate(accountId, { $push: { transactions: creditTransaction._id } });

//         // Create debit transaction
//         const debitTransaction = new Transaction({
//             paymentAccount: receiptAccount,
//             account: receiptAccount,
//             type: 'Rcpt',
//             receiptAccountId: receipt._id,
//             drCrNoteAccountTypes: 'Debit',
//             billNumber: billNumber,
//             accountType: accountId,
//             credit: 0,
//             debit: credit,
//             paymentMode: 'Receipt',
//             paymentReceiptType: 'Payment',
//             balance: previousDebitBalance - credit,
//             date: nepaliDate ? nepaliDate : new Date(billDate),
//             isActive: true,
//             company: companyId,
//             user: userId,
//             fiscalYear: currentFiscalYear,
//         });

//         await debitTransaction.save();
//         await Account.findByIdAndUpdate(receiptAccount, { $push: { transactions: debitTransaction._id } });
//         await receipt.save();

//         // Prepare response data
//         const responseData = {
//             success: true,
//             message: 'Receipt saved successfully!',
//             data: {
//                 receipt: {
//                     _id: receipt._id,
//                     billNumber: receipt.billNumber,
//                     date: receipt.date,
//                     account: receipt.account,
//                     credit: receipt.credit,
//                     receiptAccount: receipt.receiptAccount,
//                     description: receipt.description
//                 },
//                 transactions: {
//                     credit: {
//                         _id: creditTransaction._id,
//                         account: creditTransaction.account,
//                         amount: creditTransaction.credit,
//                         balance: creditTransaction.balance
//                     },
//                     debit: {
//                         _id: debitTransaction._id,
//                         account: debitTransaction.account,
//                         amount: debitTransaction.debit,
//                         balance: debitTransaction.balance
//                     }
//                 },
//                 printUrl: `/api/retailer/receipts/${receipt._id}/direct-print`
//             }
//         };

//         if (req.query.print === 'true') {
//             responseData.redirectUrl = `/api/retailer/receipts/${receipt._id}/direct-print`;
//             return res.json(responseData);
//         }

//         res.json(responseData);

//     } catch (error) {
//         console.error('Error creating receipt:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// });

// Create a new receipt
router.post('/receipts', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            message: 'Unauthorized trade type.'
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { billDate, nepaliDate, receiptAccount, accountId, credit, InstType, bankAcc, InstNo, description } = req.body;
        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        // Validation
        if (!accountId || !credit || !receiptAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(accountId) || !mongoose.Types.ObjectId.isValid(receiptAccount)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Invalid account ID.'
            });
        }

        if (isNaN(credit) || credit <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Credit amount must be a positive number.'
            });
        }

        // Get bill number
        const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'receipt', session);

        // Verify accounts exist
        const creditedAccount = await Account.findById(accountId).session(session);
        if (!creditedAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Credited account not found.'
            });
        }

        const debitAccount = await Account.findById(receiptAccount).session(session);
        if (!debitAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Receipt account not found.'
            });
        }

        // Get previous balances
        let previousCreditBalance = 0;
        const lastCreditTransaction = await Transaction.findOne({ accountId })
            .sort({ transactionDate: -1 })
            .session(session);
        if (lastCreditTransaction) {
            previousCreditBalance = lastCreditTransaction.balance;
        }

        let previousDebitBalance = 0;
        const lastDebitTransaction = await Transaction.findOne({ account: debitAccount._id })
            .sort({ transactionDate: -1 })
            .session(session);
        if (lastDebitTransaction) {
            previousDebitBalance = lastDebitTransaction.balance;
        }

        // Create receipt record
        const receipt = new Receipt({
            billNumber: billNumber,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            account: accountId,
            InstType,
            InstNo,
            credit,
            debit: 0,
            receiptAccount,
            description,
            bankAcc,
            isActive: true,
            user: userId,
            fiscalYear: currentFiscalYear,
            company: companyId
        });

        // Create credit transaction
        const creditTransaction = new Transaction({
            account: accountId,
            type: 'Rcpt',
            receiptAccountId: receipt._id,
            drCrNoteAccountTypes: 'Credit',
            billNumber: billNumber,
            accountType: receiptAccount,
            credit,
            debit: 0,
            paymentMode: 'Receipt',
            paymentReceiptType: 'Receipt',
            balance: previousCreditBalance + credit,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            isActive: true,
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear,
        });

        await creditTransaction.save({ session });
        await Account.findByIdAndUpdate(
            accountId,
            { $push: { transactions: creditTransaction._id } },
            { session }
        );

        // Create debit transaction
        const debitTransaction = new Transaction({
            paymentAccount: receiptAccount,
            account: receiptAccount,
            type: 'Rcpt',
            receiptAccountId: receipt._id,
            drCrNoteAccountTypes: 'Debit',
            billNumber: billNumber,
            accountType: accountId,
            credit: 0,
            debit: credit,
            paymentMode: 'Receipt',
            paymentReceiptType: 'Payment',
            balance: previousDebitBalance - credit,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            isActive: true,
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear,
        });

        await debitTransaction.save({ session });
        await Account.findByIdAndUpdate(
            receiptAccount,
            { $push: { transactions: debitTransaction._id } },
            { session }
        );
        await receipt.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Prepare response data
        const responseData = {
            success: true,
            message: 'Receipt saved successfully!',
            data: {
                receipt: {
                    _id: receipt._id,
                    billNumber: receipt.billNumber,
                    date: receipt.date,
                    account: receipt.account,
                    credit: receipt.credit,
                    receiptAccount: receipt.receiptAccount,
                    description: receipt.description
                },
                transactions: {
                    credit: {
                        _id: creditTransaction._id,
                        account: creditTransaction.account,
                        amount: creditTransaction.credit,
                        balance: creditTransaction.balance
                    },
                    debit: {
                        _id: debitTransaction._id,
                        account: debitTransaction.account,
                        amount: debitTransaction.debit,
                        balance: debitTransaction.balance
                    }
                },
                printUrl: `/api/retailer/receipts/${receipt._id}/direct-print`
            }
        };

        if (req.query.print === 'true') {
            responseData.redirectUrl = `/api/retailer/receipts/${receipt._id}/direct-print`;
            return res.json(responseData);
        }

        res.json(responseData);

    } catch (error) {
        console.error('Error creating receipt:', error);
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

router.get('/receipts/finds', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

            // Fetch the latest saved receipt (without modifying it)
            const latestReceipt = await Receipt.findOne({
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
                    billNumber: latestReceipt?.billNumber || '',
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
            console.error('Error in /receipts/finds:', error);
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

// Get receipt form data
router.get('/receipts/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const receiptId = req.params.id;
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat name address ward city country phone email pan')
                .populate('fiscalYear');

            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

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

            // Find the receipt document by ID
            const receipt = await Receipt.findById(receiptId)
                .populate('account', 'name pan address')
                .populate('receiptAccount', 'name code uniqueNumber')
                .populate('user', 'name email')
                .lean();

            if (!receipt) {
                return res.status(404).json({
                    success: false,
                    error: 'Receipt not found'
                });
            }

            // Fetch company group IDs for 'Cash in Hand' and 'Bank Accounts'
            const cashGroups = await CompanyGroup.find({ name: 'Cash in Hand' }).exec();
            const bankGroups = await CompanyGroup.find({ name: { $in: ['Bank Accounts', 'Bank O/D Account'] } }).exec();

            // Convert bank group IDs to an array of ObjectIds
            const bankGroupIds = bankGroups.map(group => group._id);
            const cashGroupIds = cashGroups.map(group => group._id);

            // Fetch only the required company groups: Cash in Hand, Sundry Debtors, Sundry Creditors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
            }).exec();

            // Convert relevant group IDs to an array of ObjectIds
            const relevantGroupIds = relevantGroups.map(group => group._id);

            const accounts = await Account.find({
                company: companyId,
                // fiscalYear: fiscalYear,
                isActive: true,
                $or: [
                    { originalFiscalYear: fiscalYear }, // Created here
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
                    }
                ],
                companyGroups: { $in: relevantGroupIds }
            });

            // Fetch cash accounts
            const cashAccounts = cashGroups.length > 0
                ? await Account.find({
                    companyGroups: { $in: cashGroupIds },
                    company: companyId,
                    fiscalYear: fiscalYear,
                    isActive: true
                }).lean()
                : [];

            // Fetch bank accounts
            const bankAccounts = bankGroups.length > 0
                ? await Account.find({
                    companyGroups: { $in: bankGroupIds },
                    company: companyId,
                    fiscalYear: fiscalYear,
                    isActive: true
                }).lean()
                : [];

            // Combine cash and bank accounts for receipt accounts
            const receiptAccounts = [...cashAccounts, ...bankAccounts];

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
                        name: company.name,
                        address: company.address,
                        ward: company.ward,
                        city: company.city,
                        country: company.country,
                        phone: company.phone,
                        email: company.email,
                        pan: company.pan,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    receipt: {
                        ...receipt,
                        date: formatDate(receipt.date),
                        createdAt: formatDate(receipt.createdAt),
                        updatedAt: formatDate(receipt.updatedAt),
                        account: receipt.account || { name: 'N/A', pan: 'N/A', address: 'N/A' },
                        receiptAccount: receipt.receiptAccount || { name: 'N/A', code: 'N/A', uniqueNumber: 'N/A' },
                        user: receipt.user || { name: 'N/A', email: 'N/A' }
                    },
                    currentFiscalYear: currentFiscalYear ? {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    } : null,
                    accounts,
                    receiptAccounts: receiptAccounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        code: acc.code,
                        uniqueNumber: acc.uniqueNumber,
                        companyGroups: acc.companyGroups
                    })),
                    cashAccounts: cashAccounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        code: acc.code,
                        uniqueNumber: acc.uniqueNumber,
                        companyGroups: acc.companyGroups
                    })),
                    bankAccounts: bankAccounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        code: acc.code,
                        uniqueNumber: acc.uniqueNumber,
                        companyGroups: acc.companyGroups
                    })),
                    nepaliDate,
                    companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    date: formatDate(new Date()),
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
            console.error('Error fetching data for receipts form:', error);
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

// Get receipt form by billNumber
router.get('/receipts/edit/billNumber', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

            // Find the receipt document by billNumber
            const receipt = await Receipt.findOne({
                billNumber: billNumber,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate('account')
                .populate('receiptAccount');

            if (!receipt) {
                return res.status(404).json({
                    success: false,
                    error: 'Receipt voucher number not found'
                });
            }

            // Fetch company group IDs for 'Cash in Hand' and 'Bank Accounts'
            const cashGroups = await CompanyGroup.find({ name: 'Cash in Hand' }).exec();
            const bankGroups = await CompanyGroup.find({ name: { $in: ['Bank Accounts', 'Bank O/D Account'] } }).exec();

            // Convert bank group IDs to an array of ObjectIds
            const bankGroupIds = bankGroups.map(group => group._id);
            const cashGroupIds = cashGroups.map(group => group._id);

            // Fetch only the required company groups: Cash in Hand, Sundry Debtors, Sundry Creditors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
            }).exec();

            // Convert relevant group IDs to an array of ObjectIds
            const relevantGroupIds = relevantGroups.map(group => group._id);

            // Fetch accounts excluding 'Cash in Hand' and 'Bank Accounts'
            const accounts = await Account.find({
                company: companyId,
                isActive: true,
                $or: [
                    { originalFiscalYear: fiscalYear },
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear }
                    }
                ],
                companyGroups: { $in: relevantGroupIds }
            }).exec();

            // Fetch accounts for 'Cash in Hand' and 'Bank Accounts'
            const cashAccounts = cashGroups
                ? await Account.find({
                    companyGroups: { $in: cashGroupIds },
                    company: companyId,
                    fiscalYear: fiscalYear
                }).exec()
                : [];

            const bankAccounts = bankGroups.length > 0
                ? await Account.find({
                    companyGroups: { $in: bankGroupIds },
                    company: companyId,
                    fiscalYear: fiscalYear
                }).exec()
                : [];

            const receiptAccounts = [...cashAccounts, ...bankAccounts];

            res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    receipt,
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
                    receiptAccounts: receiptAccounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        code: acc.code,
                        uniqueNumber: acc.uniqueNumber,
                        // include other necessary account fields
                    })),
                    cashAccounts: cashAccounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        uniqueNumber: acc.uniqueNumber,
                        // include other necessary account fields
                    })),
                    bankAccounts: bankAccounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
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
            console.error('Error fetching data for receipts form:', error);
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

// // PUT - Update an existing receipt voucher by ID (JSON response for React)
// router.put('/receipts/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
//     if (req.tradeType === 'retailer') {
//         try {
//             const { billDate, nepaliDate, receiptAccount, accountId, credit, InstType, InstNo, description } = req.body;
//             const { id } = req.params;
//             const companyId = req.session.currentCompany;
//             const currentFiscalYear = req.session.currentFiscalYear.id;
//             const userId = req.user._id;

//             // Validation
//             if (!accountId || !credit || !receiptAccount) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'All fields are required'
//                 });
//             }

//             if (!mongoose.Types.ObjectId.isValid(accountId) || !mongoose.Types.ObjectId.isValid(receiptAccount)) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Invalid account ID.'
//                 });
//             }

//             if (isNaN(credit) || credit <= 0) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Credit amount must be a positive number.'
//                 });
//             }

//             // Find the existing receipt
//             const existingReceipt = await Receipt.findById(id);
//             if (!existingReceipt) {
//                 return res.status(404).json({
//                     success: false,
//                     message: 'Receipt not found.'
//                 });
//             }

//             // Fetch the accounts
//             const account = await Account.findById(accountId);
//             if (!account) {
//                 return res.status(404).json({
//                     success: false,
//                     message: 'Account not found.'
//                 });
//             }

//             const receiptAcc = await Account.findById(receiptAccount);
//             if (!receiptAcc) {
//                 return res.status(404).json({
//                     success: false,
//                     message: 'Receipt account not found.'
//                 });
//             }

//             // Delete outdated transactions
//             await Transaction.deleteMany({
//                 $or: [
//                     {
//                         account: existingReceipt.account,
//                         receiptAccountId: existingReceipt._id,
//                         drCrNoteAccountTypes: 'Credit'
//                     },
//                     {
//                         paymentAccount: existingReceipt.receiptAccount,
//                         receiptAccountId: existingReceipt._id,
//                         drCrNoteAccountTypes: 'Debit'
//                     }
//                 ]
//             });

//             // Get last balances for both accounts
//             const [lastCreditTransaction, lastDebitTransaction] = await Promise.all([
//                 Transaction.findOne({ account: accountId }).sort({ transactionDate: -1 }),
//                 Transaction.findOne({ account: receiptAccount }).sort({ transactionDate: -1 })
//             ]);

//             // Update the receipt document
//             existingReceipt.account = accountId;
//             existingReceipt.receiptAccount = receiptAccount;
//             existingReceipt.credit = credit;
//             existingReceipt.debit = 0;
//             existingReceipt.date = nepaliDate ? new Date(nepaliDate) : new Date(billDate);
//             existingReceipt.InstType = InstType;
//             existingReceipt.InstNo = InstNo;
//             existingReceipt.description = description;
//             existingReceipt.user = userId;
//             await existingReceipt.save();

//             // Create credit transaction
//             const creditTransaction = new Transaction({
//                 account: accountId,
//                 type: 'Rcpt',
//                 receiptAccountId: existingReceipt._id,
//                 billNumber: existingReceipt.billNumber,
//                 accountType: receiptAccount,
//                 drCrNoteAccountTypes: 'Credit',
//                 credit,
//                 debit: 0,
//                 paymentMode: 'Receipt',
//                 balance: (lastCreditTransaction?.balance || 0) + credit,
//                 date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
//                 company: companyId,
//                 user: userId,
//                 fiscalYear: currentFiscalYear,
//             });

//             // Create debit transaction
//             const debitTransaction = new Transaction({
//                 paymentAccount: receiptAccount,
//                 type: 'Rcpt',
//                 receiptAccountId: existingReceipt._id,
//                 billNumber: existingReceipt.billNumber,
//                 accountType: accountId,
//                 drCrNoteAccountTypes: 'Debit',
//                 credit: 0,
//                 debit: credit,
//                 paymentMode: 'Receipt',
//                 balance: (lastDebitTransaction?.balance || 0) - credit,
//                 date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
//                 company: companyId,
//                 user: userId,
//                 fiscalYear: currentFiscalYear,
//             });

//             // Save transactions and update account references
//             await Promise.all([
//                 creditTransaction.save(),
//                 debitTransaction.save(),
//                 Account.findByIdAndUpdate(accountId, { $push: { transactions: creditTransaction._id } }),
//                 Account.findByIdAndUpdate(receiptAccount, { $push: { transactions: debitTransaction._id } })
//             ]);

//             // Prepare response
//             const response = {
//                 success: true,
//                 message: 'Receipt updated successfully',
//                 data: {
//                     receipt: existingReceipt,
//                     printUrl: `/receipts/${existingReceipt._id}/direct-print-edit`,
//                     transactions: {
//                         credit: creditTransaction,
//                         debit: debitTransaction
//                     }
//                 }
//             };

//             if (req.query.print === 'true') {
//                 response.print = true;
//             }

//             res.json(response);

//         } catch (error) {
//             console.error('Error updating receipt:', error);
//             res.status(500).json({
//                 success: false,
//                 message: 'Internal server error',
//                 error: error.message
//             });
//         }
//     } else {
//         res.status(403).json({
//             success: false,
//             message: 'Unauthorized trade type.'
//         });
//     }
// });

// PUT - Update an existing receipt voucher by ID (JSON response for React)
router.put('/receipts/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            message: 'Unauthorized trade type.'
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { billDate, nepaliDate, receiptAccount, accountId, credit, InstType, bankAcc, InstNo, description } = req.body;
        const { id } = req.params;
        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const userId = req.user._id;

        // Validation
        if (!accountId || !credit || !receiptAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(accountId) || !mongoose.Types.ObjectId.isValid(receiptAccount)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Invalid account ID.'
            });
        }

        if (isNaN(credit) || credit <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Credit amount must be a positive number.'
            });
        }

        // Find the existing receipt
        const existingReceipt = await Receipt.findById(id).session(session);
        if (!existingReceipt) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Receipt not found.'
            });
        }

        // Fetch the accounts
        const account = await Account.findById(accountId).session(session);
        if (!account) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Account not found.'
            });
        }

        const receiptAcc = await Account.findById(receiptAccount).session(session);
        if (!receiptAcc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Receipt account not found.'
            });
        }

        // Delete outdated transactions
        await Transaction.deleteMany({
            receiptAccountId: existingReceipt._id
        }).session(session);

        // Get previous balances
        let previousCreditBalance = 0;
        const lastCreditTransaction = await Transaction.findOne({ account: accountId })
            .sort({ date: -1 })
            .session(session);
        if (lastCreditTransaction) {
            previousCreditBalance = lastCreditTransaction.balance;
        }

        let previousDebitBalance = 0;
        const lastDebitTransaction = await Transaction.findOne({ account: receiptAccount })
            .sort({ date: -1 })
            .session(session);
        if (lastDebitTransaction) {
            previousDebitBalance = lastDebitTransaction.balance;
        }

        // Update the receipt document
        existingReceipt.account = accountId;
        existingReceipt.receiptAccount = receiptAccount;
        existingReceipt.credit = credit;
        existingReceipt.debit = 0;
        existingReceipt.date = nepaliDate ? nepaliDate : new Date(billDate);
        existingReceipt.InstType = InstType;
        existingReceipt.InstNo = InstNo;
        existingReceipt.description = description;
        existingReceipt.bankAcc = bankAcc;
        existingReceipt.user = userId;
        await existingReceipt.save({ session });

        // Create credit transaction
        const creditTransaction = new Transaction({
            account: accountId,
            type: 'Rcpt',
            receiptAccountId: existingReceipt._id,
            drCrNoteAccountTypes: 'Credit',
            billNumber: existingReceipt.billNumber,
            accountType: receiptAccount,
            credit,
            debit: 0,
            paymentMode: 'Receipt',
            paymentReceiptType: 'Receipt',
            balance: previousCreditBalance + credit,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            isActive: true,
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear,
        });

        await creditTransaction.save({ session });
        await Account.findByIdAndUpdate(
            accountId,
            { $push: { transactions: creditTransaction._id } },
            { session }
        );

        // Create debit transaction
        const debitTransaction = new Transaction({
            account: receiptAccount,
            type: 'Rcpt',
            receiptAccountId: existingReceipt._id,
            drCrNoteAccountTypes: 'Debit',
            billNumber: existingReceipt.billNumber,
            accountType: accountId,
            credit: 0,
            debit: credit,
            paymentMode: 'Receipt',
            paymentReceiptType: 'Payment',
            balance: previousDebitBalance - credit,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            isActive: true,
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear,
        });

        await debitTransaction.save({ session });
        await Account.findByIdAndUpdate(
            receiptAccount,
            { $push: { transactions: debitTransaction._id } },
            { session }
        );

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Prepare response data
        const responseData = {
            success: true,
            message: 'Receipt updated successfully!',
            data: {
                receipt: {
                    _id: existingReceipt._id,
                    billNumber: existingReceipt.billNumber,
                    date: existingReceipt.date,
                    account: existingReceipt.account,
                    credit: existingReceipt.credit,
                    receiptAccount: existingReceipt.receiptAccount,
                    description: existingReceipt.description
                },
                printUrl: `/api/retailer/receipts/${existingReceipt._id}/direct-print`
            }
        };

        if (req.query.print === 'true') {
            responseData.redirectUrl = `/api/retailer/receipts/${existingReceipt._id}/direct-print`;
        }

        res.json(responseData);

    } catch (error) {
        console.error('Error updating receipt:', error);
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});


// Route to cancel the receipt and related transactions
router.post('/receipts/cancel/:billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.params;

            // Update the receipt status to 'canceled'
            const updateReceiptStatus = await Receipt.updateOne(
                { billNumber },
                { status: 'canceled', isActive: false }
            );
            console.log('Receipt status update result:', updateReceiptStatus);

            // Mark related transactions as 'canceled' and set isActive to false
            const updateTransactionsStatus = await Transaction.updateMany(
                { billNumber, type: 'Rcpt' },
                { status: 'canceled', isActive: false }
            );
            console.log('Related transactions update result:', updateTransactionsStatus);

            return res.json({
                success: true,
                message: 'Receipt and related transactions have been canceled.',
                billNumber: billNumber
            });
        } catch (error) {
            console.error("Error canceling receipt:", error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while canceling the receipt.'
            });
        }
    }
});

// Route to reactivate the receipt and related transactions
router.post('/receipts/reactivate/:billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.params;

            // Update the receipt status to 'active'
            const updateReceiptStatus = await Receipt.updateOne(
                { billNumber },
                { status: 'active', isActive: true }
            );
            console.log('Receipt reactivation result:', updateReceiptStatus);

            // Reactivate related transactions and set isActive to true
            const updateTransactionsStatus = await Transaction.updateMany(
                { billNumber, type: 'Rcpt' },
                { status: 'active', isActive: true }
            );
            console.log('Related transactions reactivation result:', updateTransactionsStatus);

            return res.json({
                success: true,
                message: 'Receipt and related transactions have been reactivated.',
                billNumber: billNumber
            });
        } catch (error) {
            console.error("Error reactivating receipt:", error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while reactivating the receipt.'
            });
        }
    }
});

router.get('/receipts/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const receiptId = req.params.id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');

            const company = await Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat name address ward city country phone email pan')
                .populate('fiscalYear');

            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Handle fiscal year
            let fiscalYear = req.session.currentFiscalYear?.id || null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear).lean();
            }

            if (!currentFiscalYear && company.fiscalYear) {
                currentFiscalYear = company.fiscalYear;
                fiscalYear = currentFiscalYear._id.toString();
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Validate receipt ID
            if (!mongoose.Types.ObjectId.isValid(receiptId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid receipt ID.'
                });
            }

            const currentCompany = await Company.findById(new ObjectId(companyId));
            if (!currentCompany) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Find the receipt record with populated fields
            const receipt = await Receipt.findById(receiptId)
                .populate('account', 'name pan address')
                .populate('receiptAccount', 'name')
                .populate('user', 'name')
                .lean();

            if (!receipt) {
                return res.status(404).json({
                    success: false,
                    message: 'Receipt voucher not found.'
                });
            }

            // Format dates safely
            const formatDate = (date) => {
                if (!date) return null;
                try {
                    return new Date(date).toISOString().split('T')[0];
                } catch (e) {
                    return null;
                }
            };

            // Get related transactions
            const debitTransaction = await Transaction.findOne({
                receiptAccountId: receipt._id,
                type: 'Rcpt'
            })
                .populate('account', 'name')
                .lean();

            const creditTransaction = await Transaction.findOne({
                receiptAccountId: receipt._id,
                type: 'Rcpt'
            })
                .populate('paymentAccount', 'name')
                .lean();

            // Prepare response
            const response = {
                success: true,
                data: {
                    company: {
                        ...company,
                        fiscalYear: company.fiscalYear
                    },
                    currentFiscalYear: currentFiscalYear,
                    currentCompanyName,
                    currentCompany: {
                        _id: currentCompany._id,
                        name: currentCompany.name,
                        phone: currentCompany.phone,
                        pan: currentCompany.pan,
                        address: currentCompany.address,
                        ward: currentCompany.ward,
                        city: currentCompany.city
                    },
                    receipt: {
                        ...receipt,
                        date: formatDate(receipt.date),
                        createdAt: formatDate(receipt.createdAt),
                        updatedAt: formatDate(receipt.updatedAt),
                        account: receipt.account || { name: 'N/A', pan: 'N/A', address: 'N/A' },
                        receiptAccount: receipt.receiptAccount || { name: 'N/A' },
                        user: receipt.user || { name: 'N/A' }
                    },
                    transactions: {
                        debit: debitTransaction,
                        credit: creditTransaction
                    },
                    currentDate: formatDate(new Date()),
                    nepaliDate: nepaliDate,
                    userPreferences: {
                        theme: req.user?.preferences?.theme || 'light'
                    },
                    userRoles: {
                        isAdminOrSupervisor: req.user?.isAdmin || req.user?.role === 'Supervisor'
                    }
                }
            };

            res.json(response);
        } catch (error) {
            console.error('Error retrieving receipt voucher:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
});

module.exports = router;