const express = require('express');
const router = express.Router();
const Payment = require('../../models/retailer/Payment'); // Adjust the path as necessary

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Account = require('../../models/retailer/Account');
const Company = require('../../models/Company');
const CompanyGroup = require('../../models/retailer/CompanyGroup')
const Transaction = require('../../models/retailer/Transaction')
const NepaliDate = require('nepali-date');
// const BillCounter = require('../../models/retailer/paymentBillCounter');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const FiscalYear = require('../../models/FiscalYear');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');


// GET - Show list of journal vouchers (JSON API for React)
router.get('/payments/register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
                        payments: [],
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
            }

            // Build the query based on the company's date format
            let query = { company: companyId };

            if (fromDate && toDate) {
                query.date = { $gte: fromDate, $lte: toDate };
            } else if (fromDate) {
                query.date = { $gte: fromDate };
            } else if (toDate) {
                query.date = { $lte: toDate };
            }

            const payments = await Payment.find(query)
                .sort({ date: 1 })
                .populate('account', 'name')
                .populate('user', 'name')
                .populate('paymentAccount', 'name')
                .lean()
                .exec();

            return res.json({
                success: true,
                data: {
                    company,
                    currentFiscalYear,
                    payments,
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
                    title: '',
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
        console.error('Error in payments-list endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});


// Add this route to your backend
router.get('/accounts/:accountId/balance', isLoggedIn, ensureAuthenticated, async (req, res) => {
    try {
        const { accountId } = req.params;
        const companyId = req.session.currentCompany;
        const fiscalYear = req.session.currentFiscalYear?.id;

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year selected'
            });
        }

        // Fetch the account details
        const account = await Account.findOne({
            _id: accountId,
            company: companyId,
            isActive: true,
            $or: [
                { originalFiscalYear: fiscalYear },
                {
                    fiscalYear: fiscalYear,
                    originalFiscalYear: { $lt: fiscalYear }
                }
            ]
        }).populate('companyGroups', 'name').lean();

        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found for the current fiscal year'
            });
        }
        let openingBalance = 0;

        // Calculate opening balance using the same logic as your statement
        openingBalance = account.initialOpeningBalance && account.initialOpeningBalance.type === 'Dr'
            ? account.initialOpeningBalance.amount
            : (account.initialOpeningBalance ? -account.initialOpeningBalance.amount : 0);

        // Query all transactions for this account
        const query = {
            company: companyId,
            isActive: true,
            $or: [
                { account: accountId },
                { paymentAccount: accountId },
                { receiptAccount: accountId },
                { debitAccount: accountId },
                { creditAccount: accountId },
            ]
        };

        const allTransactions = await Transaction.find(query)
            .sort({ date: 1, createdAt: 1 })
            .lean();

        // Use a Set to track processed transactions and avoid duplicates
        const processedTransactions = new Set();
        let balance = openingBalance;

        // Calculate running balance from all transactions
        allTransactions.forEach(tx => {
            // Create a unique identifier for this transaction to avoid duplicates
            const txIdentifier = `${tx.date}-${tx.type}-${tx.billNumber}-${tx.debit}-${tx.credit}`;

            if (!processedTransactions.has(txIdentifier)) {
                processedTransactions.add(txIdentifier);

                // Determine if this transaction affects the selected account as debit or credit
                let amount = 0;

                if (tx.account && tx.account.toString() === accountId) {
                    // Standard transaction
                    amount = (tx.debit || 0) - (tx.credit || 0);
                } else if (tx.paymentAccount && tx.paymentAccount.toString() === accountId) {
                    // Payment transaction
                    amount = -(tx.debit || 0); // Payment account is credited
                } else if (tx.receiptAccount && tx.receiptAccount.toString() === accountId) {
                    // Receipt transaction
                    amount = (tx.credit || 0); // Receipt account is debited
                } else if (tx.debitAccount && tx.debitAccount.toString() === accountId) {
                    // Journal debit
                    amount = (tx.debit || 0);
                } else if (tx.creditAccount && tx.creditAccount.toString() === accountId) {
                    // Journal credit
                    amount = -(tx.credit || 0);
                }

                balance += amount;
            }
        });

        // Determine balance type
        const balanceType = balance >= 0 ? 'Dr' : 'Cr';
        const absoluteBalance = Math.abs(balance);

        res.json({
            success: true,
            data: {
                balance: absoluteBalance,
                balanceType,
                rawBalance: balance
            }
        });
    } catch (error) {
        console.error('Error calculating account balance:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Get payment form
router.get('/payments', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
                transactionType: 'payment'
            });

            // Calculate next number for display only
            const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
            const fiscalYears = await FiscalYear.findById(fiscalYear);
            const prefix = fiscalYears.billPrefixes.payment;
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
                    currentFiscalYear: currentFiscalYear,
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
            console.error('Error fetching data for payments form:', error);
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

// Create a new payment
router.post('/payments', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkDemoPeriod, checkFiscalYearDateRange, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            message: 'Unauthorized trade type.'
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { billDate, nepaliDate, paymentAccount, accountId, debit, InstType, InstNo, description } = req.body;
        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        // Validation
        if (!accountId || !debit || !paymentAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(accountId) || !mongoose.Types.ObjectId.isValid(paymentAccount)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Invalid account ID.'
            });
        }

        if (isNaN(debit) || debit <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Debit amount must be a positive number.'
            });
        }

        // Get bill number
        const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'payment', session);

        // Verify accounts exist
        const debitedAccount = await Account.findById(accountId).session(session);
        if (!debitedAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Debited account not found.'
            });
        }

        const creditAccount = await Account.findById(paymentAccount).session(session);
        if (!creditAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Payment account not found.'
            });
        }

        // Get previous balances
        let previousDebitBalance = 0;
        const lastDebitTransaction = await Transaction.findOne({ accountId })
            .sort({ transactionDate: -1 })
            .session(session);
        if (lastDebitTransaction) {
            previousDebitBalance = lastDebitTransaction.balance;
        }

        // Create payment record
        const payment = new Payment({
            billNumber: billNumber,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            account: accountId,
            InstType,
            InstNo,
            debit,
            credit: 0,
            paymentAccount,
            description,
            isActive: true,
            user: userId,
            companyGroups: companyId,
            fiscalYear: currentFiscalYear,
            company: companyId
        });

        // Create debit transaction
        const debitTransaction = new Transaction({
            account: accountId,
            type: 'Pymt',
            paymentAccountId: payment._id,
            drCrNoteAccountTypes: 'Debit',
            billNumber: billNumber,
            accountType: paymentAccount,
            debit,
            credit: 0,
            paymentMode: 'Payment',
            paymentReceiptType: 'Payment',
            balance: previousDebitBalance + debit,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            isActive: true,
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear,
        });

        await debitTransaction.save({ session });
        await Account.findByIdAndUpdate(
            accountId,
            { $push: { transactions: debitTransaction._id } },
            { session }
        );

        // Create credit transaction
        let previousCreditBalance = 0;
        const lastCreditTransaction = await Transaction.findOne({ account: creditAccount._id })
            .sort({ transactionDate: -1 })
            .session(session);
        if (lastCreditTransaction) {
            previousCreditBalance = lastCreditTransaction.balance;
        }

        const creditTransaction = new Transaction({
            receiptAccount: paymentAccount,
            account: paymentAccount,
            type: 'Pymt',
            paymentAccountId: payment._id,
            drCrNoteAccountTypes: 'Credit',
            billNumber: billNumber,
            accountType: accountId,
            debit: 0,
            credit: debit,
            paymentMode: 'Payment',
            paymentReceiptType: 'Receipt',
            balance: previousCreditBalance - debit,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            isActive: true,
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear,
        });

        await creditTransaction.save({ session });
        await Account.findByIdAndUpdate(
            paymentAccount,
            { $push: { transactions: creditTransaction._id } },
            { session }
        );
        await payment.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Prepare response data
        const responseData = {
            success: true,
            message: 'Payment saved successfully!',
            data: {
                payment: {
                    _id: payment._id,
                    billNumber: payment.billNumber,
                    date: payment.date,
                    account: payment.account,
                    debit: payment.debit,
                    paymentAccount: payment.paymentAccount,
                    description: payment.description
                },
                transactions: {
                    debit: {
                        _id: debitTransaction._id,
                        account: debitTransaction.account,
                        amount: debitTransaction.debit,
                        balance: debitTransaction.balance
                    },
                    credit: {
                        _id: creditTransaction._id,
                        account: creditTransaction.account,
                        amount: creditTransaction.credit,
                        balance: creditTransaction.balance
                    }
                },
                printUrl: `/api/retailer/payments/${payment._id}/direct-print`
            }
        };

        if (req.query.print === 'true') {
            responseData.redirectUrl = `/api/retailer/payments/${payment._id}/direct-print`;
            return res.json(responseData);
        }
        res.json(responseData);

    } catch (error) {
        console.error('Error creating payment:', error);
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

router.get('/payments/finds', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

            // Fetch the latest saved bill number (without modifying it)
            const latestBill = await Payment.findOne({
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
                    billNumber: latestBill?.billNumber || '',
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
            console.error('Error in /payments/finds:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        return res.status(400).json({ error: 'Invalid trade type' });
    }
});


// Get payment form data
router.get('/payments/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const paymentId = req.params.id;
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

            // Find the payment document by ID
            const payment = await Payment.findById(paymentId)
                .populate('account')
                .populate('paymentAccount');

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
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

            const paymentAccounts = [...cashAccounts, ...bankAccounts];

            res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    payment,
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    accounts,
                    paymentAccounts: paymentAccounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        code: acc.code,
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
            console.error('Error fetching data for payments form:', error);
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

// Get payment form by billNumber
router.get('/payments/edit/billNumber', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

            // Find the payment document by billNumber
            const payment = await Payment.findOne({
                billNumber: billNumber,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate('account')
                .populate('paymentAccount');

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment voucher number not found'
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

            const paymentAccounts = [...cashAccounts, ...bankAccounts];

            res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    payment,
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
                    paymentAccounts: paymentAccounts.map(acc => ({
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
            console.error('Error fetching data for payments form:', error);
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

// // PUT - Update an existing payment voucher by ID (JSON response for React)
// router.put('/payments/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
//     if (req.tradeType === 'retailer') {
//         try {
//             const { billDate, nepaliDate, paymentAccount, accountId, debit, InstType, InstNo, description } = req.body;
//             const { id } = req.params;
//             const companyId = req.session.currentCompany;
//             const userId = req.user._id;

//             const currentFiscalYear = req.session.currentFiscalYear.id;
//             const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;


//             // Validation
//             if (!accountId || !debit || !paymentAccount) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'All fields are required'
//                 });
//             }

//             if (!mongoose.Types.ObjectId.isValid(accountId) || !mongoose.Types.ObjectId.isValid(paymentAccount)) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Invalid account ID.'
//                 });
//             }

//             if (isNaN(debit) || debit <= 0) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Debit amount must be a positive number.'
//                 });
//             }

//             // Find the existing payment voucher
//             const existingPayment = await Payment.findById(id);
//             if (!existingPayment) {
//                 return res.status(404).json({
//                     success: false,
//                     message: 'Payment voucher not found.'
//                 });
//             }

//             // Delete outdated transactions
//             await Transaction.deleteMany({
//                 paymentAccountId: existingPayment._id,
//                 $or: [
//                     { account: existingPayment.account },
//                     { receiptAccount: existingPayment.paymentAccount }
//                 ]
//             });

//             // Fetch the new debited and credited accounts
//             const debitedAccount = await Account.findById(accountId);
//             if (!debitedAccount) {
//                 return res.status(404).json({
//                     success: false,
//                     message: 'Debited account not found.'
//                 });
//             }

//             const creditAccount = await Account.findById(paymentAccount);
//             if (!creditAccount) {
//                 return res.status(404).json({
//                     success: false,
//                     message: 'Payment account not found.'
//                 });
//             }

//             // Get the bill number
//             const billNumber = existingPayment.billNumber || await getNextBillNumber(companyId, currentFiscalYear, 'Payment');

//             // Update payment voucher
//             existingPayment.billNumber = billNumber;
//             existingPayment.date = nepaliDate ? nepaliDate : new Date(billDate);
//             existingPayment.account = accountId;
//             existingPayment.paymentAccount = paymentAccount;
//             existingPayment.debit = debit;
//             existingPayment.InstType = InstType;
//             existingPayment.InstNo = InstNo;
//             existingPayment.description = description;
//             await existingPayment.save();

//             // Get last balances for both accounts
//             const [lastDebitTransaction, lastCreditTransaction] = await Promise.all([
//                 Transaction.findOne({ account: accountId }).sort({ transactionDate: -1 }),
//                 Transaction.findOne({ receiptAccount: paymentAccount }).sort({ transactionDate: -1 })
//             ]);

//             // Create debit transaction
//             const debitTransaction = new Transaction({
//                 account: accountId,
//                 type: 'Pymt',
//                 paymentAccountId: existingPayment._id,
//                 billNumber: billNumber,
//                 accountType: paymentAccount,
//                 debit,
//                 credit: 0,
//                 paymentMode: 'Payment',
//                 drCrNoteAccountTypes: 'Debit',
//                 balance: (lastDebitTransaction?.balance || 0) + debit,
//                 date: nepaliDate ? nepaliDate : new Date(billDate),
//                 isActive: true,
//                 company: companyId,
//                 user: userId,
//                 fiscalYear: currentFiscalYear,
//             });

//             // Create credit transaction
//             const creditTransaction = new Transaction({
//                 receiptAccount: paymentAccount,
//                 type: 'Pymt',
//                 paymentAccountId: existingPayment._id,
//                 billNumber: billNumber,
//                 accountType: accountId,
//                 debit: 0,
//                 credit: debit,
//                 paymentMode: 'Payment',
//                 drCrNoteAccountTypes: 'Credit',
//                 balance: (lastCreditTransaction?.balance || 0) - debit,
//                 date: nepaliDate ? nepaliDate : new Date(billDate),
//                 isActive: true,
//                 company: companyId,
//                 user: userId,
//                 fiscalYear: currentFiscalYear,
//             });

//             // Save transactions and update account references
//             await Promise.all([
//                 debitTransaction.save(),
//                 creditTransaction.save(),
//                 Account.findByIdAndUpdate(accountId, { $push: { transactions: debitTransaction._id } }),
//                 Account.findByIdAndUpdate(paymentAccount, { $push: { transactions: creditTransaction._id } })
//             ]);

//             // Response for React frontend
//             const response = {
//                 success: true,
//                 message: 'Payment updated successfully',
//                 data: {
//                     payment: existingPayment,
//                     printUrl: `/payments/${existingPayment._id}/direct-print-edit`
//                 }
//             };

//             if (req.query.print === 'true') {
//                 response.print = true;
//             }

//             res.json(response);

//         } catch (error) {
//             console.error('Error updating payment:', error);
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

// PUT - Update an existing payment voucher by ID (JSON response for React)
router.put('/payments/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            message: 'Unauthorized trade type.'
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { billDate, nepaliDate, paymentAccount, accountId, debit, InstType, InstNo, description } = req.body;
        const { id } = req.params;
        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const userId = req.user._id;

        // Validation
        if (!accountId || !debit || !paymentAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(accountId) || !mongoose.Types.ObjectId.isValid(paymentAccount)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Invalid account ID.'
            });
        }

        if (isNaN(debit) || debit <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Debit amount must be a positive number.'
            });
        }

        // Find the existing payment voucher
        const existingPayment = await Payment.findById(id).session(session);
        if (!existingPayment) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Payment voucher not found.'
            });
        }

        // Delete outdated transactions
        await Transaction.deleteMany({
            paymentAccountId: existingPayment._id
        }).session(session);

        // Fetch the new debited and credited accounts
        const debitedAccount = await Account.findById(accountId).session(session);
        if (!debitedAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Debited account not found.'
            });
        }

        const creditAccount = await Account.findById(paymentAccount).session(session);
        if (!creditAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Payment account not found.'
            });
        }

        // Get the bill number (keep the existing one)
        const billNumber = existingPayment.billNumber;

        // Update payment voucher
        existingPayment.date = nepaliDate ? nepaliDate : new Date(billDate);
        existingPayment.account = accountId;
        existingPayment.paymentAccount = paymentAccount;
        existingPayment.debit = debit;
        existingPayment.InstType = InstType;
        existingPayment.InstNo = InstNo;
        existingPayment.description = description;
        await existingPayment.save({ session });

        // Get previous balances
        let previousDebitBalance = 0;
        const lastDebitTransaction = await Transaction.findOne({ account: accountId })
            .sort({ date: -1 })
            .session(session);
        if (lastDebitTransaction) {
            previousDebitBalance = lastDebitTransaction.balance;
        }

        let previousCreditBalance = 0;
        const lastCreditTransaction = await Transaction.findOne({ account: paymentAccount })
            .sort({ date: -1 })
            .session(session);
        if (lastCreditTransaction) {
            previousCreditBalance = lastCreditTransaction.balance;
        }

        // Create debit transaction
        const debitTransaction = new Transaction({
            account: accountId,
            type: 'Pymt',
            paymentAccountId: existingPayment._id,
            drCrNoteAccountTypes: 'Debit',
            billNumber: billNumber,
            accountType: paymentAccount,
            debit,
            credit: 0,
            paymentMode: 'Payment',
            paymentReceiptType: 'Payment',
            balance: previousDebitBalance + debit,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            isActive: true,
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear,
        });

        await debitTransaction.save({ session });
        await Account.findByIdAndUpdate(
            accountId,
            { $push: { transactions: debitTransaction._id } },
            { session }
        );

        // Create credit transaction
        const creditTransaction = new Transaction({
            account: paymentAccount,
            type: 'Pymt',
            paymentAccountId: existingPayment._id,
            drCrNoteAccountTypes: 'Credit',
            billNumber: billNumber,
            accountType: accountId,
            debit: 0,
            credit: debit,
            paymentMode: 'Payment',
            paymentReceiptType: 'Receipt',
            balance: previousCreditBalance - debit,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            isActive: true,
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear,
        });

        await creditTransaction.save({ session });
        await Account.findByIdAndUpdate(
            paymentAccount,
            { $push: { transactions: creditTransaction._id } },
            { session }
        );

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Prepare response data
        const responseData = {
            success: true,
            message: 'Payment updated successfully!',
            data: {
                payment: {
                    _id: existingPayment._id,
                    billNumber: existingPayment.billNumber,
                    date: existingPayment.date,
                    account: existingPayment.account,
                    debit: existingPayment.debit,
                    paymentAccount: existingPayment.paymentAccount,
                    description: existingPayment.description
                },
                printUrl: `/api/retailer/payments/${existingPayment._id}/direct-print`
            }
        };

        if (req.query.print === 'true') {
            responseData.redirectUrl = `/api/retailer/payments/${existingPayment._id}/direct-print`;
        }

        res.json(responseData);

    } catch (error) {
        console.error('Error updating payment:', error);
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Route to cancel the payment and related transactions
router.post('/payments/cancel/:billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.params;

            // Update the payment status to 'canceled'
            const updatePaymentStatus = await Payment.updateOne(
                { billNumber },
                { status: 'canceled', isActive: false }
            );
            console.log('Payment status update result:', updatePaymentStatus);

            // Mark related transactions as 'canceled' and set isActive to false
            const updateTransactionsStatus = await Transaction.updateMany(
                { billNumber, type: 'Pymt' },
                { status: 'canceled', isActive: false }
            );
            console.log('Related transactions update result:', updateTransactionsStatus);

            return res.json({
                success: true,
                message: 'Payment and related transactions have been canceled.',
                billNumber: billNumber
            });
        } catch (error) {
            console.error("Error canceling payment:", error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while canceling the payment.'
            });
        }
    }
});

// Route to reactivate the payment and related transactions
router.post('/payments/reactivate/:billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.params;

            // Update the payment status to 'active'
            const updatePaymentStatus = await Payment.updateOne(
                { billNumber },
                { status: 'active', isActive: true }
            );
            console.log('Payment reactivation result:', updatePaymentStatus);

            // Reactivate related transactions and set isActive to true
            const updateTransactionsStatus = await Transaction.updateMany(
                { billNumber, type: 'Pymt' },
                { status: 'active', isActive: true }
            );
            console.log('Related transactions reactivation result:', updateTransactionsStatus);

            return res.json({
                success: true,
                message: 'Payment and related transactions have been reactivated.',
                billNumber: billNumber
            });
        } catch (error) {
            console.error("Error reactivating payment:", error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while reactivating the payment.'
            });
        }
    }
});

router.get('/payments/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const paymentId = req.params.id;
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

            // Validate payment ID
            if (!mongoose.Types.ObjectId.isValid(paymentId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment ID.'
                });
            }

            const currentCompany = await Company.findById(new ObjectId(companyId));
            if (!currentCompany) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Find the payment record with populated fields
            const payment = await Payment.findById(paymentId)
                .populate('account', 'name pan address')
                .populate('paymentAccount', 'name')
                .populate('user', 'name')
                .lean();

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment voucher not found.'
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
            const transactions = await Transaction.find({
                paymentAccountId: payment._id,
                type: 'Pymt'
            })
                .populate('account', 'name')
                .populate('receiptAccount', 'name')
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
                    payment: {
                        ...payment,
                        date: formatDate(payment.date),
                        createdAt: formatDate(payment.createdAt),
                        updatedAt: formatDate(payment.updatedAt),
                        account: payment.account || { name: 'N/A', pan: 'N/A', address: 'N/A' },
                        paymentAccount: payment.paymentAccount || { name: 'N/A' },
                        user: payment.user || { name: 'N/A' }
                    },
                    transactions: transactions,
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
            console.error('Error retrieving payment voucher:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
});

module.exports = router;