const express = require('express');
const router = express.Router();
const Transaction = require('../../models/retailer/Transaction');
const Setting = require('../../models/retailer/Settings');
const Company = require('../../models/Company');
const NepaliDate = require('nepali-date');
const { ensureAuthenticated, ensureCompanySelected } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');

// router.get('/transactions/:itemId/:accountId/:purchaseSalesType', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     if (req.tradeType === 'retailer') {
//         const { itemId, accountId, purchaseSalesType } = req.params;
//         console.log(`Fetching transactions for item: ${itemId} and account: ${accountId} and purchaseSalesType:${purchaseSalesType}`);
//         const companyId = req.session.currentCompany;
//         console.log(`Current company in session: ${companyId}`);
//         const currentFiscalYear = req.session.currentFiscalYear;
//         console.log('Current fiscal year in session:', JSON.stringify(currentFiscalYear, null, 2));
//         console.log('company date format in session:', JSON.stringify(companyId, null, 2));
//         const userId = req.user._id;
//         const today = new Date();
//         const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD'); // Format the Nepali date as needed

//         const company = await Company.findById(companyId);
//         if (!company) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: 'Company not found' 
//             });
//         }

//         const companyDateFormat = company ? company.dateFormat : 'english'; // Default to 'english'

//         try {
//             if (!companyId || !userId) {
//                 return res.status(400).json({ 
//                     success: false,
//                     error: 'Current company or user not found in session' 
//                 });
//             }

//             // Fetch the user's settings to check if display transactions is enabled
//             const settings = await Setting.findOne({ company: companyId, userId });
//             if (!settings) {
//                 return res.status(400).json({ 
//                     success: false,
//                     error: 'User settings not found' 
//                 });
//             }

//             // Specific checks for transaction types
//             const displayConditions = {
//                 'Sales': settings.displayTransactions,
//                 'Purchase': settings.displayTransactionsForPurchase,
//                 'SalesReturn': settings.displayTransactionsForSalesReturn,
//                 'PurchaseReturn': settings.displayTransactionsForPurchaseReturn
//             };

//             if (!displayConditions[purchaseSalesType]) {
//                 return res.json({
//                     success: true,
//                     data: [],
//                     message: 'Transaction display is disabled for this type'
//                 });
//             }

//             const transactions = await Transaction.find({
//                 item: itemId,
//                 account: accountId,
//                 purchaseSalesType: purchaseSalesType,
//                 company: companyId
//             })
//                 .populate('billId') // Assuming 'billId' is a valid field to populate
//                 .populate('purchaseBillId')
//                 .populate('unit', 'name')
//                 .sort({ date: -1 })
//                 .limit(20); // Limit to last 20 transactions, adjust as needed

//             res.json({
//                 success: true,
//                 data: {
//                     transactions: transactions,
//                     dateFormat: companyDateFormat,
//                     nepaliDate: nepaliDate,
//                     displayEnabled: displayConditions[purchaseSalesType]
//                 },
//                 message: 'Transactions fetched successfully'
//             });
//         } catch (err) {
//             console.error('Error fetching transactions:', err);
//             res.status(500).json({ 
//                 success: false,
//                 error: 'Internal server error',
//                 message: err.message 
//             });
//         }
//     } else {
//         return res.status(403).json({ 
//             success: false,
//             error: 'Access denied for this trade type' 
//         });
//     }
// });

router.get('/transactions/:itemId/:accountId/:purchaseSalesType', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const { itemId, accountId, purchaseSalesType } = req.params;
        const companyId = req.session.currentCompany;
        const userId = req.user._id;

        try {
            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Current company or user not found in session'
                });
            }

            // Fetch settings and check display condition in parallel with other operations
            const [settings, company] = await Promise.all([
                Setting.findOne({ company: companyId, userId }).select('displayTransactions displayTransactionsForPurchase displayTransactionsForSalesReturn displayTransactionsForPurchaseReturn'),
                Company.findById(companyId).select('dateFormat')
            ]);

            if (!settings) {
                return res.status(400).json({
                    success: false,
                    error: 'User settings not found'
                });
            }

            // Specific checks for transaction types
            const displayConditions = {
                'Sales': settings.displayTransactions,
                'Purchase': settings.displayTransactionsForPurchase,
                'SalesReturn': settings.displayTransactionsForSalesReturn,
                'PurchaseReturn': settings.displayTransactionsForPurchaseReturn
            };

            if (!displayConditions[purchaseSalesType]) {
                return res.json({
                    success: true,
                    data: {
                        transactions: [],
                        dateFormat: company?.dateFormat || 'english',
                        nepaliDate: new NepaliDate().format('YYYY-MM-DD'),
                        displayEnabled: false
                    },
                    message: 'Transaction display is disabled for this type'
                });
            }

            // Optimized query with only necessary fields and lean()
            const transactions = await Transaction.find({
                item: itemId,
                account: accountId,
                purchaseSalesType: purchaseSalesType,
                company: companyId
            })
                .select('date billNumber type purchaseSalesType paymentMode quantity bonus price puPrice amount unit billId purchaseBillId')
                .populate('billId', 'billNumber') // Only get billNumber
                .populate('purchaseBillId', 'billNumber') // Only get billNumber
                .populate('unit', 'name')
                .sort({ date: -1, billNumber: -1 })
                .limit(20)
                .lean(); // Use lean() for faster queries

            res.json({
                success: true,
                data: {
                    transactions: transactions,
                    dateFormat: company?.dateFormat || 'english',
                    nepaliDate: new NepaliDate().format('YYYY-MM-DD'),
                    displayEnabled: true
                },
                message: 'Transactions fetched successfully'
            });
        } catch (err) {
            console.error('Error fetching transactions:', err);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: err.message
            });
        }
    } else {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});

router.get('/transactions/sales-by-item-account', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const { itemId, accountId } = req.query; // Now using query parameters
        const companyId = req.session.currentCompany;

        if (!itemId || !accountId) {
            return res.status(400).json({ 
                success: false,
                message: 'Both itemId and accountId are required',
                data: null 
            });
        }

        try {
            const transactions = await Transaction.find({
                item: itemId,
                account: accountId,
                purchaseSalesType: 'Sales',
                company: companyId
            })
                .populate('billId')
                .populate('item', 'name')
                .populate('unit', 'name')
                .sort({ date: -1 })
                .limit(20);

            // Check if transactions were found
            if (transactions && transactions.length > 0) {
                return res.status(200).json({
                    success: true,
                    message: 'Transactions retrieved successfully',
                    data: {
                        transactions: transactions,
                        count: transactions.length
                    }
                });
            } else {
                return res.status(200).json({
                    success: true,
                    message: 'No transactions found for the specified criteria',
                    data: {
                        transactions: [],
                        count: 0
                    }
                });
            }
        } catch (err) {
            console.error('Error fetching sales transactions:', err);
            return res.status(500).json({ 
                success: false,
                message: 'Internal server error',
                data: null,
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    } else {
        return res.status(403).json({ 
            success: false,
            message: 'Access denied for this trade type',
            data: null 
        });
    }
});

router.get('/transactions/purchase-by-item-account', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const { itemId, accountId } = req.query; // Now using query parameters
        const companyId = req.session.currentCompany;

        if (!itemId || !accountId) {
            return res.status(400).json({ 
                success: false,
                message: 'Both itemId and accountId are required',
                data: null 
            });
        }

        try {
            const transactions = await Transaction.find({
                item: itemId,
                account: accountId,
                purchaseSalesType: 'Purchase',
                company: companyId
            })
                .populate('purchaseBillId')
                .populate('item', 'name')
                .populate('unit', 'name')
                .sort({ date: -1 })
                .limit(20);

            // Check if transactions were found
            if (transactions && transactions.length > 0) {
                return res.status(200).json({
                    success: true,
                    message: 'Purchase transactions retrieved successfully',
                    data: {
                        transactions: transactions,
                        count: transactions.length
                    }
                });
            } else {
                return res.status(200).json({
                    success: true,
                    message: 'No purchase transactions found for the specified criteria',
                    data: {
                        transactions: [],
                        count: 0
                    }
                });
            }
        } catch (err) {
            console.error('Error fetching purchase transactions:', err);
            return res.status(500).json({ 
                success: false,
                message: 'Internal server error',
                data: null,
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    } else {
        return res.status(403).json({ 
            success: false,
            message: 'Access denied for this trade type',
            data: null 
        });
    }
});

module.exports = router;