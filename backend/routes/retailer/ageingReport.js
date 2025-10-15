const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Account = require('../../models/retailer/Account');
const Transaction = require('../../models/retailer/Transaction');
const FiscalYear = require('../../models/FiscalYear');
const Company = require('../../models/Company');
const NepaliDate = require('nepali-date');
const { ensureCompanySelected, ensureAuthenticated, isLoggedIn } = require('../../middleware/auth');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const { ensureTradeType } = require('../../middleware/tradeType');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const CompanyGroup = require('../../models/retailer/CompanyGroup');
const SalesBill = require('../../models/retailer/SalesBill');
const SalesReturn = require('../../models/retailer/SalesReturn');
const Payment = require('../../models/retailer/Payment');
const Receipt = require('../../models/retailer/Receipt');
const CreditNote = require('../../models/retailer/CreditNote');

// // Ageing Receivables/Payables Report
// router.get('/ageing-report/all-accounts', isLoggedIn, async (req, res) => {
//     try {
//         const companyId = req.session.currentCompany;
//         const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
//         const currentCompany = await Company.findById(companyId);
//         const today = new Date();
//         const nepaliDate = new NepaliDate(today);
//         const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';

//         // Get Sundry Debtors and Creditors groups
//         const [debtorGroup, creditorGroup] = await Promise.all([
//             CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }),
//             CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId })
//         ]);

//         if (!debtorGroup || !creditorGroup) {
//             return res.status(400).json({ error: 'Required account groups not found.' });
//         }

//         // Fetch current fiscal year
//         let currentFiscalYear = req.session.currentFiscalYear?.id
//             ? await FiscalYear.findById(req.session.currentFiscalYear.id)
//             : company.fiscalYear;

//         if (!currentFiscalYear) {
//             return res.status(400).json({ error: 'No fiscal year found in session or company.' });
//         }

//         // Get the company's initial fiscal year (oldest fiscal year)
//         const initialFiscalYear = await FiscalYear.findOne({ company: companyId })
//             .sort({ startDate: 1 })
//             .limit(1);

//         if (!initialFiscalYear) {
//             return res.status(400).json({ error: 'No initial fiscal year found for company.' });
//         }

//         // Get all debtor and creditor accounts with opening balances populated
//         const [debtorAccounts, creditorAccounts] = await Promise.all([
//             Account.find({
//                 company: companyId,
//                 companyGroups: debtorGroup._id
//             }).populate('openingBalanceByFiscalYear.fiscalYear'),
//             Account.find({
//                 company: companyId,
//                 companyGroups: creditorGroup._id
//             }).populate('openingBalanceByFiscalYear.fiscalYear')
//         ]);

//         const allAccounts = [...debtorAccounts, ...creditorAccounts];
//         const accountIds = allAccounts.map(a => a._id);

//         // Query ALL relevant transactions (without fiscal year filter) and exclude duplicates
//         const allTransactions = await Transaction.aggregate([
//             {
//                 $match: {
//                     company: new mongoose.Types.ObjectId(companyId),
//                     account: { $in: accountIds.map(id => new mongoose.Types.ObjectId(id)) },
//                     isActive: true,
//                     $or: [
//                         { billId: { $exists: true }, paymentMode: { $ne: 'cash' } },
//                         { purchaseBillId: { $exists: true }, paymentMode: { $ne: 'cash' } },
//                         { purchaseReturnBillId: { $exists: true }, paymentMode: { $ne: 'cash' } },
//                         { salesReturnBillId: { $exists: true }, paymentMode: { $ne: 'cash' } },
//                         { paymentAccountId: { $exists: true } },
//                         { receiptAccountId: { $exists: true } },
//                         { journalBillId: { $exists: true } },
//                         { debitNoteId: { $exists: true } },
//                         { creditNoteId: { $exists: true } },
//                     ],
//                 }
//             },
//             {
//                 $group: {
//                     _id: {
//                         account: "$account",
//                         billId: "$billId",
//                         purchaseBillId: "$purchaseBillId",
//                         purchaseReturnBillId: "$purchaseReturnBillId",
//                         salesReturnBillId: "$salesReturnBillId",
//                         paymentAccountId: "$paymentAccountId",
//                         receiptAccountId: "$receiptAccountId",
//                         journalBillId: "$journalBillId",
//                         debitNoteId: "$debitNoteId",
//                         creditNoteId: "$creditNoteId",
//                         date: "$date",
//                         debit: "$debit",
//                         credit: "$credit"
//                     },
//                     doc: { $first: "$$ROOT" }
//                 }
//             },
//             {
//                 $replaceRoot: { newRoot: "$doc" }
//             },
//             {
//                 $sort: { date: 1 }
//             }
//         ]);

//         // Populate the necessary references
//         await Transaction.populate(allTransactions, [
//             { path: 'billId', select: 'billNumber date' },
//             { path: 'purchaseBillId', select: 'billNumber date' },
//             { path: 'purchaseReturnBillId', select: 'billNumber date' },
//             { path: 'salesReturnBillId', select: 'billNumber date' },
//             { path: 'paymentAccountId', select: 'paymentNumber date' },
//             { path: 'receiptAccountId', select: 'receiptNumber date' },
//             { path: 'journalBillId', select: 'voucherNumber date' },
//             { path: 'debitNoteId', select: 'noteNumber date' },
//             { path: 'creditNoteId', select: 'noteNumber date' },
//             { path: 'fiscalYear', select: 'name startDate endDate' }
//         ]);

//         // Process ageing
//         const report = [];
//         const receivableTotals = createBucketTemplate();
//         const payableTotals = createBucketTemplate();
//         const netTotals = createBucketTemplate();

//         for (const account of allAccounts) {
//             // Calculate opening balance from account's openingBalanceByFiscalYear
//             let openingBalance = 0;

//             // Find the opening balance entry for the initial fiscal year
//             const initialFyOpeningBalance = account.openingBalanceByFiscalYear.find(
//                 ob => ob.fiscalYear && ob.fiscalYear._id.toString() === initialFiscalYear._id.toString()
//             );

//             if (initialFyOpeningBalance) {
//                 openingBalance = initialFyOpeningBalance.type === 'Dr'
//                     ? initialFyOpeningBalance.amount
//                     : -initialFyOpeningBalance.amount;
//             }

//             // Get all transactions for the account
//             const accountTransactions = allTransactions.filter(t => 
//                 t.account && t.account.toString() === account._id.toString()
//             );

//             // Calculate current net balance from ALL transactions (all fiscal years)
//             const currentNetBalance = accountTransactions.reduce((sum, txn) => {
//                 return sum + (txn.debit - txn.credit);
//             }, openingBalance);

//             // Skip accounts with zero balance in both opening and current
//             if (Math.abs(openingBalance) < 0.01 && Math.abs(currentNetBalance) < 0.01) continue;

//             const isReceivable = currentNetBalance > 0;
//             const buckets = createBucketTemplate();

//             // Add opening balance to the 'over-120' bucket
//             buckets['over-120'] += openingBalance;

//             // Separate transactions into receivables and payables (from all fiscal years)
//             const receivableItems = [];
//             const payableItems = [];

//             for (const txn of accountTransactions.sort((a, b) => new Date(a.date) - new Date(b.date))) {
//                 if (txn.debit > 0) {
//                     receivableItems.push({
//                         date: txn.date,
//                         amount: txn.debit,
//                         originalDate: txn.date,
//                         fiscalYear: txn.fiscalYear,
//                     });
//                 }
//                 if (txn.credit > 0) {
//                     payableItems.push({
//                         date: txn.date,
//                         amount: txn.credit,
//                         originalDate: txn.date,
//                         fiscalYear: txn.fiscalYear
//                     });
//                 }
//             }

//             // Process receivables (FIFO) across all fiscal years
//             const unpaidReceivables = [...receivableItems];
//             for (const payment of accountTransactions
//                 .filter(t => t.credit > 0)
//                 .sort((a, b) => new Date(a.date) - new Date(b.date))) {

//                 let remaining = payment.credit;
//                 while (remaining > 0 && unpaidReceivables.length > 0) {
//                     const oldest = unpaidReceivables[0];
//                     if (oldest.amount <= remaining) {
//                         remaining -= oldest.amount;
//                         unpaidReceivables.shift();
//                     } else {
//                         oldest.amount -= remaining;
//                         remaining = 0;
//                     }
//                 }
//             }

//             // Process payables (FIFO) across all fiscal years
//             const unpaidPayables = [...payableItems];
//             for (const payment of accountTransactions
//                 .filter(t => t.debit > 0)
//                 .sort((a, b) => new Date(a.date) - new Date(b.date))) {

//                 let remaining = payment.debit;
//                 while (remaining > 0 && unpaidPayables.length > 0) {
//                     const oldest = unpaidPayables[0];
//                     if (oldest.amount <= remaining) {
//                         remaining -= oldest.amount;
//                         unpaidPayables.shift();
//                     } else {
//                         oldest.amount -= remaining;
//                         remaining = 0;
//                     }
//                 }
//             }

//             // Calculate ageing for remaining items
//             const calculateAgeing = (items, isReceivable) => {
//                 for (const item of items) {
//                     let ageInDays;
//                     if (companyDateFormat === 'nepali') {
//                         try {
//                             const transactionDate = new Date(item.date);
//                             const currentDateObj = new Date(nepaliDate);
//                             ageInDays = Math.floor((currentDateObj - transactionDate) / (1000 * 60 * 60 * 24));
//                         } catch (error) {
//                             console.error('Error calculating Nepali date difference:', error);
//                             ageInDays = 0;
//                         }
//                     } else {
//                         try {
//                             const transactionDate = new Date(item.date);
//                             ageInDays = Math.floor((today - transactionDate) / (1000 * 60 * 60 * 24));
//                         } catch (error) {
//                             console.error('Error calculating English date difference:', error);
//                             ageInDays = 0;
//                         }
//                     }

//                     // Determine bucket
//                     let bucketKey;
//                     if (ageInDays <= 30) bucketKey = '0-30';
//                     else if (ageInDays <= 60) bucketKey = '30-60';
//                     else if (ageInDays <= 90) bucketKey = '60-90';
//                     else if (ageInDays <= 120) bucketKey = '90-120';
//                     else bucketKey = 'over-120';

//                     // Add to appropriate bucket
//                     if (isReceivable) {
//                         buckets[bucketKey] += item.amount;
//                     } else {
//                         buckets[bucketKey] -= item.amount; // Negative for payables
//                     }
//                 }
//             };

//             calculateAgeing(unpaidReceivables, true);
//             calculateAgeing(unpaidPayables, false);

//             // Calculate account total from buckets
//             buckets.total = Object.values(buckets).reduce((a, b) => a + b, 0);

//             // Add to appropriate totals
//             if (isReceivable) {
//                 updateBucketTotals(receivableTotals, buckets);
//             } else {
//                 // For payables, we need to store positive amounts in the totals
//                 updateBucketTotals(payableTotals, negateBuckets(buckets));
//             }
//             updateBucketTotals(netTotals, buckets);

//             report.push({
//                 accountName: account.name,
//                 buckets: formatBuckets(buckets),
//                 isReceivable: isReceivable,
//                 netBalance: Math.abs(buckets.total),
//                 openingBalance: openingBalance
//             });
//         }

//         res.json({
//             success: true,
//             data: {
//                 report,
//                 receivableTotals,
//                 payableTotals,
//                 netTotals,
//                 company: {
//                     _id: company._id,
//                     renewalDate: company.renewalDate,
//                     fiscalYear: company.fiscalYear,
//                     dateFormat: company.dateFormat
//                 },
//                 currentCompany: currentCompany,
//                 companyDateFormat: companyDateFormat,
//                 currentFiscalYear: currentFiscalYear,
//                 initialFiscalYear: initialFiscalYear,
//                 currentCompanyName: req.session.currentCompanyName
//             }
//         });

//     } catch (err) {
//         console.error(err);
//         res.status(500).json({
//             success: false,
//             error: 'Server Error',
//             message: err.message
//         });
//     }
// });

// // Helper functions
// function createBucketTemplate() {
//     return { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 };
// }

// function formatBuckets(buckets) {
//     return Object.fromEntries(
//         Object.entries(buckets).map(([key, val]) => [key, val])
//     );
// }

// function updateBucketTotals(totals, buckets) {
//     for (const key in buckets) {
//         if (key !== 'total') totals[key] += buckets[key];
//     }
//     totals.total += buckets.total;
// }

// function negateBuckets(buckets) {
//     const negated = {};
//     for (const key in buckets) {
//         negated[key] = -buckets[key];
//     }
//     return negated;
// }

// Ageing Receivables/Payables Report
router.get('/ageing-report/all-accounts', isLoggedIn, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
        const currentCompany = await Company.findById(companyId);
        const today = new Date();
        const nepaliDate = new NepaliDate(today);
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';

        // Get Sundry Debtors and Creditors groups
        const [debtorGroup, creditorGroup] = await Promise.all([
            CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }),
            CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId })
        ]);

        if (!debtorGroup || !creditorGroup) {
            return res.status(400).json({ error: 'Required account groups not found.' });
        }

        // Fetch current fiscal year
        let currentFiscalYear = req.session.currentFiscalYear?.id
            ? await FiscalYear.findById(req.session.currentFiscalYear.id)
            : company.fiscalYear;

        if (!currentFiscalYear) {
            return res.status(400).json({ error: 'No fiscal year found in session or company.' });
        }

        // Get the company's initial fiscal year (oldest fiscal year)
        const initialFiscalYear = await FiscalYear.findOne({ company: companyId })
            .sort({ startDate: 1 })
            .limit(1);

        if (!initialFiscalYear) {
            return res.status(400).json({ error: 'No initial fiscal year found for company.' });
        }

        // Get all debtor and creditor accounts with opening balances populated
        const [debtorAccounts, creditorAccounts] = await Promise.all([
            Account.find({
                company: companyId,
                companyGroups: debtorGroup._id
            }).populate('openingBalanceByFiscalYear.fiscalYear'),
            Account.find({
                company: companyId,
                companyGroups: creditorGroup._id
            }).populate('openingBalanceByFiscalYear.fiscalYear')
        ]);

        const allAccounts = [...debtorAccounts, ...creditorAccounts];
        const accountIds = allAccounts.map(a => a._id);

        // Query ALL relevant transactions (without fiscal year filter) and exclude duplicates
        const allTransactions = await Transaction.aggregate([
            {
                $match: {
                    company: new mongoose.Types.ObjectId(companyId),
                    account: { $in: accountIds.map(id => new mongoose.Types.ObjectId(id)) },
                    isActive: true,
                    $or: [
                        { billId: { $exists: true }, paymentMode: { $ne: 'cash' } },
                        { purchaseBillId: { $exists: true }, paymentMode: { $ne: 'cash' } },
                        { purchaseReturnBillId: { $exists: true }, paymentMode: { $ne: 'cash' } },
                        { salesReturnBillId: { $exists: true }, paymentMode: { $ne: 'cash' } },
                        { paymentAccountId: { $exists: true } },
                        { receiptAccountId: { $exists: true } },
                        { journalBillId: { $exists: true } },
                        { debitNoteId: { $exists: true } },
                        { creditNoteId: { $exists: true } },
                    ],
                }
            },
            {
                $group: {
                    _id: {
                        account: "$account",
                        billId: "$billId",
                        purchaseBillId: "$purchaseBillId",
                        purchaseReturnBillId: "$purchaseReturnBillId",
                        salesReturnBillId: "$salesReturnBillId",
                        paymentAccountId: "$paymentAccountId",
                        receiptAccountId: "$receiptAccountId",
                        journalBillId: "$journalBillId",
                        debitNoteId: "$debitNoteId",
                        creditNoteId: "$creditNoteId",
                        date: "$date",
                        debit: "$debit",
                        credit: "$credit"
                    },
                    doc: { $first: "$$ROOT" }
                }
            },
            {
                $replaceRoot: { newRoot: "$doc" }
            },
            {
                $sort: { date: 1 }
            }
        ]);

        // Populate the necessary references
        await Transaction.populate(allTransactions, [
            { path: 'billId', select: 'billNumber date' },
            { path: 'purchaseBillId', select: 'billNumber date' },
            { path: 'purchaseReturnBillId', select: 'billNumber date' },
            { path: 'salesReturnBillId', select: 'billNumber date' },
            { path: 'paymentAccountId', select: 'paymentNumber date' },
            { path: 'receiptAccountId', select: 'receiptNumber date' },
            { path: 'journalBillId', select: 'voucherNumber date' },
            { path: 'debitNoteId', select: 'noteNumber date' },
            { path: 'creditNoteId', select: 'noteNumber date' },
            { path: 'fiscalYear', select: 'name startDate endDate' }
        ]);

        // Process ageing
        const report = [];
        const receivableTotals = createBucketTemplate();
        const payableTotals = createBucketTemplate();
        const netTotals = createBucketTemplate();

        for (const account of allAccounts) {
            // Calculate opening balance from account's openingBalanceByFiscalYear
            let openingBalance = 0;

            // Find the opening balance entry for the initial fiscal year
            const initialFyOpeningBalance = account.openingBalanceByFiscalYear.find(
                ob => ob.fiscalYear && ob.fiscalYear._id.toString() === initialFiscalYear._id.toString()
            );

            if (initialFyOpeningBalance) {
                openingBalance = initialFyOpeningBalance.type === 'Dr'
                    ? initialFyOpeningBalance.amount
                    : -initialFyOpeningBalance.amount;
            }

            // Get all transactions for the account
            const accountTransactions = allTransactions.filter(t => 
                t.account && t.account.toString() === account._id.toString()
            );

            const buckets = createBucketTemplate();
            let remainingOpeningBalance = openingBalance;

            // FIRST: Use transactions to settle the opening balance
            // Only transactions that couldn't settle against opening balance will be displayed
            const unsettledReceivables = [];
            const unsettledPayables = [];

            // Sort transactions by date for proper settlement
            const sortedTransactions = [...accountTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));

            for (const txn of sortedTransactions) {
                if (remainingOpeningBalance > 0) {
                    // Positive opening balance (receivable) - settle with credit transactions
                    if (txn.credit > 0) {
                        const settlementAmount = Math.min(txn.credit, remainingOpeningBalance);
                        remainingOpeningBalance -= settlementAmount;
                        
                        // If there's remaining credit after settling opening balance, add to unsettled payables
                        const remainingCredit = txn.credit - settlementAmount;
                        if (remainingCredit > 0.01) {
                            unsettledPayables.push({
                                date: txn.date,
                                amount: remainingCredit,
                                originalDate: txn.date,
                                fiscalYear: txn.fiscalYear
                            });
                        }
                    } else if (txn.debit > 0) {
                        // Debit transactions add to receivables (increase the balance)
                        unsettledReceivables.push({
                            date: txn.date,
                            amount: txn.debit,
                            originalDate: txn.date,
                            fiscalYear: txn.fiscalYear
                        });
                    }
                } else if (remainingOpeningBalance < 0) {
                    // Negative opening balance (payable) - settle with debit transactions
                    if (txn.debit > 0) {
                        const settlementAmount = Math.min(txn.debit, Math.abs(remainingOpeningBalance));
                        remainingOpeningBalance += settlementAmount;
                        
                        // If there's remaining debit after settling opening balance, add to unsettled receivables
                        const remainingDebit = txn.debit - settlementAmount;
                        if (remainingDebit > 0.01) {
                            unsettledReceivables.push({
                                date: txn.date,
                                amount: remainingDebit,
                                originalDate: txn.date,
                                fiscalYear: txn.fiscalYear
                            });
                        }
                    } else if (txn.credit > 0) {
                        // Credit transactions add to payables (increase the balance)
                        unsettledPayables.push({
                            date: txn.date,
                            amount: txn.credit,
                            originalDate: txn.date,
                            fiscalYear: txn.fiscalYear
                        });
                    }
                } else {
                    // Opening balance is zero - all transactions go to unsettled
                    if (txn.debit > 0) {
                        unsettledReceivables.push({
                            date: txn.date,
                            amount: txn.debit,
                            originalDate: txn.date,
                            fiscalYear: txn.fiscalYear
                        });
                    }
                    if (txn.credit > 0) {
                        unsettledPayables.push({
                            date: txn.date,
                            amount: txn.credit,
                            originalDate: txn.date,
                            fiscalYear: txn.fiscalYear
                        });
                    }
                }
            }

            // Add remaining opening balance to over-120 bucket
            if (Math.abs(remainingOpeningBalance) > 0.01) {
                buckets['over-120'] += remainingOpeningBalance;
            }

            // Process remaining unsettled receivables and payables with FIFO
            const unpaidReceivables = [...unsettledReceivables];
            const unpaidPayables = [...unsettledPayables];

            // Settle receivables with payables using FIFO
            for (const payable of unpaidPayables.sort((a, b) => new Date(a.date) - new Date(b.date))) {
                let remainingPayable = payable.amount;
                let payableIndex = 0;
                
                while (remainingPayable > 0 && payableIndex < unpaidReceivables.length) {
                    const receivable = unpaidReceivables[payableIndex];
                    const settlementAmount = Math.min(receivable.amount, remainingPayable);
                    
                    receivable.amount -= settlementAmount;
                    remainingPayable -= settlementAmount;
                    
                    if (receivable.amount < 0.01) {
                        unpaidReceivables.splice(payableIndex, 1);
                    } else {
                        payableIndex++;
                    }
                }
                
                payable.amount = remainingPayable;
            }

            // Remove fully settled payables
            const finalUnpaidPayables = unpaidPayables.filter(p => p.amount > 0.01);
            const finalUnpaidReceivables = unpaidReceivables.filter(r => r.amount > 0.01);

            // Calculate ageing for remaining items
            const calculateAgeing = (items, isReceivable) => {
                for (const item of items) {
                    let ageInDays;
                    if (companyDateFormat === 'nepali') {
                        try {
                            const transactionDate = new Date(item.date);
                            const currentDateObj = new Date(nepaliDate);
                            ageInDays = Math.floor((currentDateObj - transactionDate) / (1000 * 60 * 60 * 24));
                        } catch (error) {
                            console.error('Error calculating Nepali date difference:', error);
                            ageInDays = 0;
                        }
                    } else {
                        try {
                            const transactionDate = new Date(item.date);
                            ageInDays = Math.floor((today - transactionDate) / (1000 * 60 * 60 * 24));
                        } catch (error) {
                            console.error('Error calculating English date difference:', error);
                            ageInDays = 0;
                        }
                    }

                    // Determine bucket
                    let bucketKey;
                    if (ageInDays <= 30) bucketKey = '0-30';
                    else if (ageInDays <= 60) bucketKey = '30-60';
                    else if (ageInDays <= 90) bucketKey = '60-90';
                    else if (ageInDays <= 120) bucketKey = '90-120';
                    else bucketKey = 'over-120';

                    // Add to appropriate bucket
                    if (isReceivable) {
                        buckets[bucketKey] += item.amount;
                    } else {
                        buckets[bucketKey] -= item.amount; // Negative for payables
                    }
                }
            };

            calculateAgeing(finalUnpaidReceivables, true);
            calculateAgeing(finalUnpaidPayables, false);

            // Calculate account total from buckets
            buckets.total = Object.values(buckets).reduce((a, b) => a + b, 0);

            const isReceivable = buckets.total > 0;

            // Skip accounts with zero balance
            if (Math.abs(buckets.total) < 0.01) continue;

            // Add to appropriate totals
            if (isReceivable) {
                updateBucketTotals(receivableTotals, buckets);
            } else {
                // For payables, we need to store positive amounts in the totals
                updateBucketTotals(payableTotals, negateBuckets(buckets));
            }
            updateBucketTotals(netTotals, buckets);

            report.push({
                accountName: account.name,
                buckets: formatBuckets(buckets),
                isReceivable: isReceivable,
                netBalance: Math.abs(buckets.total),
                openingBalance: openingBalance
            });
        }

        res.json({
            success: true,
            data: {
                report,
                receivableTotals,
                payableTotals,
                netTotals,
                company: {
                    _id: company._id,
                    renewalDate: company.renewalDate,
                    fiscalYear: company.fiscalYear,
                    dateFormat: company.dateFormat
                },
                currentCompany: currentCompany,
                companyDateFormat: companyDateFormat,
                currentFiscalYear: currentFiscalYear,
                initialFiscalYear: initialFiscalYear,
                currentCompanyName: req.session.currentCompanyName
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: err.message
        });
    }
});

// Helper functions
function createBucketTemplate() {
    return { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 };
}

function formatBuckets(buckets) {
    return Object.fromEntries(
        Object.entries(buckets).map(([key, val]) => [key, val])
    );
}

function updateBucketTotals(totals, buckets) {
    for (const key in buckets) {
        if (key !== 'total') totals[key] += buckets[key];
    }
    totals.total += buckets.total;
}

function negateBuckets(buckets) {
    const negated = {};
    for (const key in buckets) {
        negated[key] = -buckets[key];
    }
    return negated;
}
// router.get('/day-count-aging', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, ensureTradeType, async (req, res) => {
//     try {
//         const { accountId, fromDate, toDate } = req.query;
//         const companyId = req.session.currentCompany;
//         const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
//         const currentCompany = await Company.findById(companyId);
//         const currentCompanyName = req.session.currentCompanyName;
//         const today = new Date();
//         const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
//         const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';

//         let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
//         let currentFiscalYear = null;

//         if (fiscalYear) {
//             currentFiscalYear = await FiscalYear.findById(fiscalYear);
//         }

//         if (!currentFiscalYear && company.fiscalYear) {
//             currentFiscalYear = company.fiscalYear;
//             req.session.currentFiscalYear = {
//                 id: currentFiscalYear._id.toString(),
//                 startDate: currentFiscalYear.startDate,
//                 endDate: currentFiscalYear.endDate,
//                 name: currentFiscalYear.name,
//                 dateFormat: currentFiscalYear.dateFormat,
//                 isActive: currentFiscalYear.isActive
//             };
//             fiscalYear = req.session.currentFiscalYear.id;
//         }

//         if (!fiscalYear) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: 'No fiscal year found in session or company.' 
//             });
//         }

//         // Helper functions - define them inside the route handler
//         const getTransactionDescription = (transaction) => {
//             if (transaction.billId) return `Sales Bill - ${transaction.billId?.billNumber || ''}`;
//             if (transaction.purchaseBillId) return `Purchase Bill - ${transaction.purchaseBillId?.billNumber || ''}`;
//             if (transaction.salesReturnBillId) return `Sales Return - ${transaction.salesReturnBillId?.billNumber || ''}`;
//             if (transaction.purchaseReturnBillId) return `Purchase Return - ${transaction.purchaseReturnBillId?.billNumber || ''}`;
//             if (transaction.paymentAccountId) return `Payment - ${transaction.paymentAccountId?.name || ''}`;
//             if (transaction.receiptAccountId) return `Receipt - ${transaction.receiptAccountId?.name || ''}`;
//             if (transaction.journalBillId) return `Journal Entry - ${transaction.journalBillId?.billNumber || ''}`;
//             if (transaction.debitNoteId) return `Debit Note - ${transaction.debitNoteId?.billNumber || ''}`;
//             if (transaction.creditNoteId) return `Credit Note - ${transaction.creditNoteId?.billNumber || ''}`;
//             return 'Other Transaction';
//         };

//         const getReferenceNumber = (transaction) => {
//             if (transaction.billId) return transaction.billId?.billNumber;
//             if (transaction.purchaseBillId) return transaction.purchaseBillId?.billNumber;
//             if (transaction.salesReturnBillId) return transaction.salesReturnBillId?.billNumber;
//             if (transaction.purchaseReturnBillId) return transaction.purchaseReturnBillId?.billNumber;
//             if (transaction.journalBillId) return transaction.journalBillId?.billNumber;
//             if (transaction.debitNoteId) return transaction.debitNoteId?.billNumber;
//             if (transaction.creditNoteId) return transaction.creditNoteId?.billNumber;
//             if (transaction.billNumber) return transaction.billNumber;
//             if (transaction.partyBillNumber) return transaction.partyBillNumber;
//             if (transaction.salesBillNumber) return transaction.salesBillNumber;
//             return 'N/A';
//         };

//         const getTransactionType = (transaction) => {
//             if (transaction.billId) return 'sales';
//             if (transaction.purchaseBillId) return 'purchase';
//             if (transaction.salesReturnBillId) return 'sales_return';
//             if (transaction.purchaseReturnBillId) return 'purchase_return';
//             if (transaction.paymentAccountId) return 'payment';
//             if (transaction.receiptAccountId) return 'receipt';
//             if (transaction.journalBillId) return 'journal';
//             if (transaction.debitNoteId) return 'debit_note';
//             if (transaction.creditNoteId) return 'credit_note';
            
//             // Fallback to type field from transaction schema
//             const typeMap = {
//                 'Sale': 'sales',
//                 'Purc': 'purchase',
//                 'SlRt': 'sales_return',
//                 'PrRt': 'purchase_return',
//                 'Pymt': 'payment',
//                 'Rcpt': 'receipt',
//                 'Jrnl': 'journal',
//                 'DrNt': 'debit_note',
//                 'CrNt': 'credit_note'
//             };
            
//             return typeMap[transaction.type] || 'other';
//         };

//         // Fetch the account if accountId is provided
//         const account = accountId ? await Account.findById(accountId) : null;

//         // Fetch only the required company groups: Sundry Debtors, Sundry Creditors
//         const relevantGroups = await CompanyGroup.find({
//             name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
//         }).exec();

//         // Convert relevant group IDs to an array of ObjectIds
//         const relevantGroupIds = relevantGroups.map(group => group._id);

//         const accounts = await Account.find({
//             company: companyId,
//             fiscalYear: fiscalYear,
//             isActive: true,
//             companyGroups: { $in: relevantGroupIds }
//         }).sort({ name: 1 });

//         // If no accountId provided, return accounts list
//         if (!accountId) {
//             return res.json({
//                 success: true,
//                 data: {
//                     accounts: accounts.map(acc => ({
//                         _id: acc._id,
//                         name: acc.name,
//                         address: acc.address,
//                         phone: acc.phone,
//                         email: acc.email,
//                         type: acc.type,
//                         companyGroups: acc.companyGroups
//                     })),
//                     company: {
//                         _id: company._id,
//                         name: company.name,
//                         dateFormat: company.dateFormat
//                     },
//                     currentFiscalYear: currentFiscalYear ? {
//                         _id: currentFiscalYear._id,
//                         name: currentFiscalYear.name,
//                         startDate: currentFiscalYear.startDate,
//                         endDate: currentFiscalYear.endDate
//                     } : null,
//                     currentCompanyName,
//                     fromDate: fromDate || '',
//                     toDate: toDate || '',
//                     hasDateFilter: false
//                 }
//             });
//         }

//         // Validate account exists
//         if (!account) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Account not found'
//             });
//         }

//         // Fetch opening balance for the current fiscal year
//         const openingBalance = account.openingBalance && account.openingBalance.fiscalYear.equals(currentFiscalYear._id)
//             ? account.openingBalance
//             : { amount: 0, type: 'Cr' };

//         // Initialize empty aging data
//         const agingData = {
//             totalOutstanding: 0,
//             current: 0,
//             oneToThirty: 0,
//             thirtyOneToSixty: 0,
//             sixtyOneToNinety: 0,
//             ninetyPlus: 0,
//             openingBalance: openingBalance.amount,
//             openingBalanceType: openingBalance.type,
//             transactions: []
//         };

//         // Only process transactions if both fromDate and toDate are provided
//         if (fromDate && toDate) {
//             // Calculate initial running balance from opening balance
//             let initialRunningBalance = openingBalance.type === 'Cr' ? openingBalance.amount : -openingBalance.amount;

//             // Get transactions before the date range to calculate correct initial balance
//             const transactionsBeforeRange = await Transaction.find({
//                 company: companyId,
//                 account: accountId,
//                 isActive: true,
//                 date: { $lt: new Date(fromDate) },
//                 $or: [
//                     {
//                         billId: { $exists: true },
//                         paymentMode: { $ne: 'cash' }
//                     },
//                     {
//                         purchaseBillId: { $exists: true },
//                         paymentMode: { $ne: 'cash' }
//                     },
//                     {
//                         purchaseReturnBillId: { $exists: true },
//                         paymentMode: { $ne: 'cash' }
//                     },
//                     {
//                         salesReturnBillId: { $exists: true },
//                         paymentMode: { $ne: 'cash' }
//                     },
//                     { paymentAccountId: { $exists: true } },
//                     { receiptAccountId: { $exists: true } },
//                     { journalBillId: { $exists: true } },
//                     { debitNoteId: { $exists: true } },
//                     { creditNoteId: { $exists: true } },
//                 ],
//             })
//                 .sort({ date: 1 })
//                 .lean()
//                 .exec();

//             // Calculate running balance up to the start of the date range
//             for (const transaction of transactionsBeforeRange) {
//                 if (transaction.billId) {
//                     initialRunningBalance -= transaction.debit;
//                 } else if (transaction.salesReturnBillId) {
//                     initialRunningBalance += transaction.credit;
//                 } else if (transaction.purchaseBillId) {
//                     initialRunningBalance += transaction.credit;
//                 } else if (transaction.purchaseReturnBillId) {
//                     initialRunningBalance -= transaction.debit;
//                 } else if (transaction.paymentAccountId) {
//                     if (transaction.debit > 0) initialRunningBalance -= transaction.debit;
//                     if (transaction.credit > 0) initialRunningBalance += transaction.credit;
//                 } else if (transaction.receiptAccountId) {
//                     if (transaction.debit > 0) initialRunningBalance -= transaction.debit;
//                     if (transaction.credit > 0) initialRunningBalance += transaction.credit;
//                 } else if (transaction.debitNoteId || transaction.creditNoteId || transaction.journalBillId) {
//                     if (transaction.debit > 0) initialRunningBalance -= transaction.debit;
//                     if (transaction.credit > 0) initialRunningBalance += transaction.credit;
//                 }
//             }

//             // Get transactions within the date range
//             const startDate = new Date(fromDate);
//             const endDate = new Date(toDate);
//             endDate.setHours(23, 59, 59, 999);

//             const transactions = await Transaction.find({
//                 company: companyId,
//                 account: accountId,
//                 isActive: true,
//                 date: {
//                     $gte: startDate,
//                     $lte: endDate
//                 },
//                 $or: [
//                     {
//                         billId: { $exists: true },
//                         paymentMode: { $ne: 'cash' }
//                     },
//                     {
//                         purchaseBillId: { $exists: true },
//                         paymentMode: { $ne: 'cash' }
//                     },
//                     {
//                         purchaseReturnBillId: { $exists: true },
//                         paymentMode: { $ne: 'cash' }
//                     },
//                     {
//                         salesReturnBillId: { $exists: true },
//                         paymentMode: { $ne: 'cash' }
//                     },
//                     { paymentAccountId: { $exists: true } },
//                     { receiptAccountId: { $exists: true } },
//                     { journalBillId: { $exists: true } },
//                     { debitNoteId: { $exists: true } },
//                     { creditNoteId: { $exists: true } },
//                 ],
//             })
//                 .populate('billId', 'billNumber')
//                 .populate('purchaseBillId', 'billNumber')
//                 .populate('purchaseReturnBillId', 'billNumber')
//                 .populate('salesReturnBillId', 'billNumber')
//                 .populate('paymentAccountId', 'name')
//                 .populate('receiptAccountId', 'name')
//                 .populate('journalBillId', 'billNumber')
//                 .populate('debitNoteId', 'billNumber')
//                 .populate('creditNoteId', 'billNumber')
//                 .sort({ date: 1 })
//                 .lean()
//                 .exec();

//             // Process transactions with the initial running balance
//             let runningBalance = initialRunningBalance;
//             agingData.transactions = [];

//             for (const transaction of transactions) {
//                 // Calculate age in days
//                 let age;
//                 if (companyDateFormat === 'nepali') {
//                     try {
//                         const nepaliTransactionDate = new Date(transaction.date);
//                         const nepaliCurrentDate = new Date(nepaliDate);
//                         age = (nepaliCurrentDate - nepaliTransactionDate) / (1000 * 60 * 60 * 24);
//                     } catch (error) {
//                         age = 0;
//                     }
//                 } else {
//                     try {
//                         age = (today - transaction.date) / (1000 * 60 * 60 * 24);
//                     } catch (error) {
//                         age = 0;
//                     }
//                 }

//                 const ageInDays = Math.round(age);

//                 // Update running balance based on transaction type
//                 if (transaction.billId) {
//                     runningBalance -= transaction.debit;
//                     agingData.totalOutstanding += transaction.debit;
//                 } else if (transaction.salesReturnBillId) {
//                     runningBalance += transaction.credit;
//                     agingData.totalOutstanding -= transaction.credit;
//                 } else if (transaction.purchaseBillId) {
//                     runningBalance += transaction.credit;
//                     agingData.totalOutstanding -= transaction.credit;
//                 } else if (transaction.purchaseReturnBillId) {
//                     runningBalance -= transaction.debit;
//                     agingData.totalOutstanding += transaction.debit;
//                 } else if (transaction.paymentAccountId) {
//                     if (transaction.debit > 0) runningBalance -= transaction.debit;
//                     if (transaction.credit > 0) runningBalance += transaction.credit;
//                 } else if (transaction.receiptAccountId) {
//                     if (transaction.debit > 0) {
//                         runningBalance -= transaction.debit;
//                         agingData.totalOutstanding += transaction.debit;
//                     }
//                     if (transaction.credit > 0) {
//                         runningBalance += transaction.credit;
//                         agingData.totalOutstanding -= transaction.credit;
//                     }
//                 } else if (transaction.debitNoteId || transaction.creditNoteId || transaction.journalBillId) {
//                     if (transaction.debit > 0) {
//                         runningBalance -= transaction.debit;
//                         agingData.totalOutstanding += transaction.debit;
//                     }
//                     if (transaction.credit > 0) {
//                         runningBalance += transaction.credit;
//                         agingData.totalOutstanding -= transaction.credit;
//                     }
//                 }

//                 // Categorize by age
//                 if (ageInDays <= 30) {
//                     agingData.oneToThirty += transaction.debit - transaction.credit;
//                 } else if (ageInDays <= 60) {
//                     agingData.thirtyOneToSixty += transaction.debit - transaction.credit;
//                 } else if (ageInDays <= 90) {
//                     agingData.sixtyOneToNinety += transaction.debit - transaction.credit;
//                 } else {
//                     agingData.ninetyPlus += transaction.debit - transaction.credit;
//                 }

//                 // Prepare transaction data for response
//                 const transactionData = {
//                     _id: transaction._id,
//                     date: transaction.date,
//                     debit: transaction.debit,
//                     credit: transaction.credit,
//                     balance: runningBalance,
//                     age: ageInDays,
//                     ageCategory: ageInDays <= 30 ? '0-30 days' :
//                                 ageInDays <= 60 ? '31-60 days' :
//                                 ageInDays <= 90 ? '61-90 days' : '90+ days',
//                     description: getTransactionDescription(transaction),
//                     referenceNumber: getReferenceNumber(transaction),
//                     type: getTransactionType(transaction)
//                 };

//                 agingData.transactions.push(transactionData);
//             }

//             // Include opening balance in the total outstanding calculation
//             agingData.totalOutstanding += agingData.openingBalance;
//         }

//         // Return JSON response
//         res.json({
//             success: true,
//             data: {
//                 account: {
//                     _id: account._id,
//                     name: account.name,
//                     address: account.address,
//                     phone: account.phone,
//                     email: account.email,
//                     type: account.type,
//                     companyGroups: account.companyGroups,
//                     openingBalance: agingData.openingBalance,
//                     openingBalanceType: agingData.openingBalanceType
//                 },
//                 agingData: {
//                     totalOutstanding: agingData.totalOutstanding,
//                     agingBreakdown: {
//                         current: agingData.current,
//                         oneToThirty: agingData.oneToThirty,
//                         thirtyOneToSixty: agingData.thirtyOneToSixty,
//                         sixtyOneToNinety: agingData.sixtyOneToNinety,
//                         ninetyPlus: agingData.ninetyPlus
//                     },
//                     transactions: agingData.transactions,
//                     summary: {
//                         totalTransactions: agingData.transactions.length,
//                         dateRange: {
//                             fromDate,
//                             toDate
//                         }
//                     }
//                 },
//                 company: {
//                     _id: company._id,
//                     name: company.name,
//                     dateFormat: company.dateFormat
//                 },
//                 currentFiscalYear: currentFiscalYear ? {
//                     _id: currentFiscalYear._id,
//                     name: currentFiscalYear.name,
//                     startDate: currentFiscalYear.startDate,
//                     endDate: currentFiscalYear.endDate
//                 } : null,
//                 accounts: accounts.map(acc => ({
//                     _id: acc._id,
//                     name: acc.name,
//                     address: acc.address,
//                     phone: acc.phone,
//                     email: acc.email,
//                     type: acc.type,
//                     companyGroups: acc.companyGroups
//                 })),
//                 currentCompanyName,
//                 fromDate: fromDate || '',
//                 toDate: toDate || '',
//                 hasDateFilter: !!fromDate && !!toDate
//             }
//         });

//     } catch (error) {
//         console.error('Error in day-count-aging:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Internal Server Error',
//             message: error.message
//         });
//     }
// });

router.get('/day-count-aging', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, ensureTradeType, async (req, res) => {
    try {
        const { accountId, fromDate, toDate } = req.query;
        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
        const currentCompany = await Company.findById(companyId);
        const currentCompanyName = req.session.currentCompanyName;
        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';

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

        // Helper functions - define them inside the route handler
        const getTransactionDescription = (transaction) => {
            if (transaction.billId) return `Sales Bill - ${transaction.billId?.billNumber || ''}`;
            if (transaction.purchaseBillId) return `Purchase Bill - ${transaction.purchaseBillId?.billNumber || ''}`;
            if (transaction.salesReturnBillId) return `Sales Return - ${transaction.salesReturnBillId?.billNumber || ''}`;
            if (transaction.purchaseReturnBillId) return `Purchase Return - ${transaction.purchaseReturnBillId?.billNumber || ''}`;
            if (transaction.paymentAccountId) return `Payment - ${transaction.paymentAccountId?.name || ''}`;
            if (transaction.receiptAccountId) return `Receipt - ${transaction.receiptAccountId?.name || ''}`;
            if (transaction.journalBillId) return `Journal Entry - ${transaction.journalBillId?.billNumber || ''}`;
            if (transaction.debitNoteId) return `Debit Note - ${transaction.debitNoteId?.billNumber || ''}`;
            if (transaction.creditNoteId) return `Credit Note - ${transaction.creditNoteId?.billNumber || ''}`;
            return 'Other Transaction';
        };

        const getReferenceNumber = (transaction) => {
            if (transaction.billId) return transaction.billId?.billNumber;
            if (transaction.purchaseBillId) return transaction.purchaseBillId?.billNumber;
            if (transaction.salesReturnBillId) return transaction.salesReturnBillId?.billNumber;
            if (transaction.purchaseReturnBillId) return transaction.purchaseReturnBillId?.billNumber;
            if (transaction.journalBillId) return transaction.journalBillId?.billNumber;
            if (transaction.debitNoteId) return transaction.debitNoteId?.billNumber;
            if (transaction.creditNoteId) return transaction.creditNoteId?.billNumber;
            if (transaction.billNumber) return transaction.billNumber;
            if (transaction.partyBillNumber) return transaction.partyBillNumber;
            if (transaction.salesBillNumber) return transaction.salesBillNumber;
            return 'N/A';
        };

        const getTransactionType = (transaction) => {
            if (transaction.billId) return 'sales';
            if (transaction.purchaseBillId) return 'purchase';
            if (transaction.salesReturnBillId) return 'sales_return';
            if (transaction.purchaseReturnBillId) return 'purchase_return';
            if (transaction.paymentAccountId) return 'payment';
            if (transaction.receiptAccountId) return 'receipt';
            if (transaction.journalBillId) return 'journal';
            if (transaction.debitNoteId) return 'debit_note';
            if (transaction.creditNoteId) return 'credit_note';
            
            // Fallback to type field from transaction schema
            const typeMap = {
                'Sale': 'sales',
                'Purc': 'purchase',
                'SlRt': 'sales_return',
                'PrRt': 'purchase_return',
                'Pymt': 'payment',
                'Rcpt': 'receipt',
                'Jrnl': 'journal',
                'DrNt': 'debit_note',
                'CrNt': 'credit_note'
            };
            
            return typeMap[transaction.type] || 'other';
        };

        // Fetch the account if accountId is provided
        const account = accountId ? await Account.findById(accountId) : null;

        // Fetch only the required company groups: Sundry Debtors, Sundry Creditors
        const relevantGroups = await CompanyGroup.find({
            name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
        }).exec();

        // Convert relevant group IDs to an array of ObjectIds
        const relevantGroupIds = relevantGroups.map(group => group._id);

        const accounts = await Account.find({
            company: companyId,
            fiscalYear: fiscalYear,
            isActive: true,
            companyGroups: { $in: relevantGroupIds }
        }).sort({ name: 1 });

        // If no accountId provided, return accounts list
        if (!accountId) {
            return res.json({
                success: true,
                data: {
                    accounts: accounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        address: acc.address,
                        phone: acc.phone,
                        email: acc.email,
                        type: acc.type,
                        companyGroups: acc.companyGroups,
                        initialOpeningBalance: acc.initialOpeningBalance || { amount: 0, type: 'Dr' }
                    })),
                    company: {
                        _id: company._id,
                        name: company.name,
                        dateFormat: company.dateFormat
                    },
                    currentFiscalYear: currentFiscalYear ? {
                        _id: currentFiscalYear._id,
                        name: currentFiscalYear.name,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate
                    } : null,
                    currentCompanyName,
                    fromDate: fromDate || '',
                    toDate: toDate || '',
                    hasDateFilter: false
                }
            });
        }

        // Validate account exists
        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        // Use initialOpeningBalance if available, otherwise use default values
        const initialOpeningBalance = account.initialOpeningBalance || { 
            amount: 0, 
            type: 'Dr',
            initialFiscalYear: currentFiscalYear?._id,
            date: new Date()
        };

        // Initialize aging data with initialOpeningBalance
        const agingData = {
            totalOutstanding: 0,
            current: 0,
            oneToThirty: 0,
            thirtyOneToSixty: 0,
            sixtyOneToNinety: 0,
            ninetyPlus: 0,
            openingBalance: initialOpeningBalance.amount,
            openingBalanceType: initialOpeningBalance.type,
            openingBalanceDate: initialOpeningBalance.date,
            initialFiscalYear: initialOpeningBalance.initialFiscalYear,
            transactions: []
        };

        // Only process transactions if both fromDate and toDate are provided
        if (fromDate && toDate) {
            // Calculate initial running balance from initialOpeningBalance
            let initialRunningBalance = initialOpeningBalance.type === 'Cr' 
                ? initialOpeningBalance.amount 
                : -initialOpeningBalance.amount;

            console.log(`Initial opening balance for ${account.name}: ${initialOpeningBalance.amount} ${initialOpeningBalance.type}`);
            console.log(`Initial running balance: ${initialRunningBalance}`);

            // Get transactions before the date range to calculate correct initial balance
            const transactionsBeforeRange = await Transaction.find({
                company: companyId,
                account: accountId,
                isActive: true,
                date: { $lt: new Date(fromDate) },
                $or: [
                    {
                        billId: { $exists: true },
                        paymentMode: { $ne: 'cash' }
                    },
                    {
                        purchaseBillId: { $exists: true },
                        paymentMode: { $ne: 'cash' }
                    },
                    {
                        purchaseReturnBillId: { $exists: true },
                        paymentMode: { $ne: 'cash' }
                    },
                    {
                        salesReturnBillId: { $exists: true },
                        paymentMode: { $ne: 'cash' }
                    },
                    { paymentAccountId: { $exists: true } },
                    { receiptAccountId: { $exists: true } },
                    { journalBillId: { $exists: true } },
                    { debitNoteId: { $exists: true } },
                    { creditNoteId: { $exists: true } },
                ],
            })
                .sort({ date: 1 })
                .lean()
                .exec();

            console.log(`Found ${transactionsBeforeRange.length} transactions before date range`);

            // Calculate running balance up to the start of the date range
            for (const transaction of transactionsBeforeRange) {
                if (transaction.billId) {
                    initialRunningBalance -= transaction.debit;
                } else if (transaction.salesReturnBillId) {
                    initialRunningBalance += transaction.credit;
                } else if (transaction.purchaseBillId) {
                    initialRunningBalance += transaction.credit;
                } else if (transaction.purchaseReturnBillId) {
                    initialRunningBalance -= transaction.debit;
                } else if (transaction.paymentAccountId) {
                    if (transaction.debit > 0) initialRunningBalance -= transaction.debit;
                    if (transaction.credit > 0) initialRunningBalance += transaction.credit;
                } else if (transaction.receiptAccountId) {
                    if (transaction.debit > 0) initialRunningBalance -= transaction.debit;
                    if (transaction.credit > 0) initialRunningBalance += transaction.credit;
                } else if (transaction.debitNoteId || transaction.creditNoteId || transaction.journalBillId) {
                    if (transaction.debit > 0) initialRunningBalance -= transaction.debit;
                    if (transaction.credit > 0) initialRunningBalance += transaction.credit;
                }
            }

            console.log(`Running balance after previous transactions: ${initialRunningBalance}`);

            // Get transactions within the date range
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);

            const transactions = await Transaction.find({
                company: companyId,
                account: accountId,
                isActive: true,
                date: {
                    $gte: startDate,
                    $lte: endDate
                },
                $or: [
                    {
                        billId: { $exists: true },
                        paymentMode: { $ne: 'cash' }
                    },
                    {
                        purchaseBillId: { $exists: true },
                        paymentMode: { $ne: 'cash' }
                    },
                    {
                        purchaseReturnBillId: { $exists: true },
                        paymentMode: { $ne: 'cash' }
                    },
                    {
                        salesReturnBillId: { $exists: true },
                        paymentMode: { $ne: 'cash' }
                    },
                    { paymentAccountId: { $exists: true } },
                    { receiptAccountId: { $exists: true } },
                    { journalBillId: { $exists: true } },
                    { debitNoteId: { $exists: true } },
                    { creditNoteId: { $exists: true } },
                ],
            })
                .populate('billId', 'billNumber')
                .populate('purchaseBillId', 'billNumber')
                .populate('purchaseReturnBillId', 'billNumber')
                .populate('salesReturnBillId', 'billNumber')
                .populate('paymentAccountId', 'name')
                .populate('receiptAccountId', 'name')
                .populate('journalBillId', 'billNumber')
                .populate('debitNoteId', 'billNumber')
                .populate('creditNoteId', 'billNumber')
                .sort({ date: 1 })
                .lean()
                .exec();

            console.log(`Found ${transactions.length} transactions in date range`);

            // Process transactions with the initial running balance
            let runningBalance = initialRunningBalance;
            agingData.transactions = [];

            for (const transaction of transactions) {
                // Calculate age in days
                let age;
                if (companyDateFormat === 'nepali') {
                    try {
                        const nepaliTransactionDate = new Date(transaction.date);
                        const nepaliCurrentDate = new Date(nepaliDate);
                        age = (nepaliCurrentDate - nepaliTransactionDate) / (1000 * 60 * 60 * 24);
                    } catch (error) {
                        age = 0;
                    }
                } else {
                    try {
                        age = (today - transaction.date) / (1000 * 60 * 60 * 24);
                    } catch (error) {
                        age = 0;
                    }
                }

                const ageInDays = Math.round(age);

                // Update running balance based on transaction type
                if (transaction.billId) {
                    runningBalance -= transaction.debit;
                    agingData.totalOutstanding += transaction.debit;
                } else if (transaction.salesReturnBillId) {
                    runningBalance += transaction.credit;
                    agingData.totalOutstanding -= transaction.credit;
                } else if (transaction.purchaseBillId) {
                    runningBalance += transaction.credit;
                    agingData.totalOutstanding -= transaction.credit;
                } else if (transaction.purchaseReturnBillId) {
                    runningBalance -= transaction.debit;
                    agingData.totalOutstanding += transaction.debit;
                } else if (transaction.paymentAccountId) {
                    if (transaction.debit > 0) runningBalance -= transaction.debit;
                    if (transaction.credit > 0) runningBalance += transaction.credit;
                } else if (transaction.receiptAccountId) {
                    if (transaction.debit > 0) {
                        runningBalance -= transaction.debit;
                        agingData.totalOutstanding += transaction.debit;
                    }
                    if (transaction.credit > 0) {
                        runningBalance += transaction.credit;
                        agingData.totalOutstanding -= transaction.credit;
                    }
                } else if (transaction.debitNoteId || transaction.creditNoteId || transaction.journalBillId) {
                    if (transaction.debit > 0) {
                        runningBalance -= transaction.debit;
                        agingData.totalOutstanding += transaction.debit;
                    }
                    if (transaction.credit > 0) {
                        runningBalance += transaction.credit;
                        agingData.totalOutstanding -= transaction.credit;
                    }
                }

                // Categorize by age
                if (ageInDays <= 30) {
                    agingData.oneToThirty += transaction.debit - transaction.credit;
                } else if (ageInDays <= 60) {
                    agingData.thirtyOneToSixty += transaction.debit - transaction.credit;
                } else if (ageInDays <= 90) {
                    agingData.sixtyOneToNinety += transaction.debit - transaction.credit;
                } else {
                    agingData.ninetyPlus += transaction.debit - transaction.credit;
                }

                // Prepare transaction data for response
                const transactionData = {
                    _id: transaction._id,
                    date: transaction.date,
                    debit: transaction.debit,
                    credit: transaction.credit,
                    balance: runningBalance,
                    age: ageInDays,
                    ageCategory: ageInDays <= 30 ? '0-30 days' :
                                ageInDays <= 60 ? '31-60 days' :
                                ageInDays <= 90 ? '61-90 days' : '90+ days',
                    description: getTransactionDescription(transaction),
                    referenceNumber: getReferenceNumber(transaction),
                    type: getTransactionType(transaction)
                };

                agingData.transactions.push(transactionData);
            }

            // Include initial opening balance in the total outstanding calculation
            agingData.totalOutstanding += initialOpeningBalance.amount;
            
            console.log(`Final total outstanding: ${agingData.totalOutstanding}`);
            console.log(`Final running balance: ${runningBalance}`);
        }

        // Return JSON response
        res.json({
            success: true,
            data: {
                account: {
                    _id: account._id,
                    name: account.name,
                    address: account.address,
                    phone: account.phone,
                    email: account.email,
                    type: account.type,
                    companyGroups: account.companyGroups,
                    openingBalance: agingData.openingBalance,
                    openingBalanceType: agingData.openingBalanceType,
                    openingBalanceDate: agingData.openingBalanceDate,
                    initialFiscalYear: agingData.initialFiscalYear,
                    initialOpeningBalance: account.initialOpeningBalance || null
                },
                agingData: {
                    totalOutstanding: agingData.totalOutstanding,
                    agingBreakdown: {
                        current: agingData.current,
                        oneToThirty: agingData.oneToThirty,
                        thirtyOneToSixty: agingData.thirtyOneToSixty,
                        sixtyOneToNinety: agingData.sixtyOneToNinety,
                        ninetyPlus: agingData.ninetyPlus
                    },
                    transactions: agingData.transactions,
                    summary: {
                        totalTransactions: agingData.transactions.length,
                        dateRange: {
                            fromDate,
                            toDate
                        },
                        initialBalanceUsed: {
                            amount: initialOpeningBalance.amount,
                            type: initialOpeningBalance.type,
                            date: initialOpeningBalance.date
                        }
                    }
                },
                company: {
                    _id: company._id,
                    name: company.name,
                    dateFormat: company.dateFormat
                },
                currentFiscalYear: currentFiscalYear ? {
                    _id: currentFiscalYear._id,
                    name: currentFiscalYear.name,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate
                } : null,
                accounts: accounts.map(acc => ({
                    _id: acc._id,
                    name: acc.name,
                    address: acc.address,
                    phone: acc.phone,
                    email: acc.email,
                    type: acc.type,
                    companyGroups: acc.companyGroups,
                    initialOpeningBalance: acc.initialOpeningBalance || { amount: 0, type: 'Dr' }
                })),
                currentCompanyName,
                fromDate: fromDate || '',
                toDate: toDate || '',
                hasDateFilter: !!fromDate && !!toDate
            }
        });

    } catch (error) {
        console.error('Error in day-count-aging:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

module.exports = router;