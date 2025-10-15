const mongoose = require('mongoose');
const Account = require("../models/retailer/Account"); // Adjust path as needed

const checkCreditLimit = async (req, res, next) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const {
            accountId,
            paymentMode,
            items = [],
            discountPercentage = 0,
            discountAmount = 0,
            vatPercentage = 13,
            isVatExempt
        } = req.body;

        const companyId = req.session.currentCompany;
        const fiscalYearId = req.session.currentFiscalYear?.id;

        // Only check for credit transactions
        if (paymentMode !== 'credit') {
            await session.commitTransaction();
            session.endSession();
            return next();
        }

        // Validate required fields
        if (!accountId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Account ID is required for credit limit check'
            });
        }

        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        // Fetch account with credit limit
        const account = await Account.findOne({
            _id: accountId,
            company: companyId,
            isActive: true
        }).session(session);

        if (!account) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        // Skip check if no credit limit is set
        if (!account.creditLimit || account.creditLimit <= 0) {
            await session.commitTransaction();
            session.endSession();
            return next();
        }

        // Calculate the transaction amount (similar to your sales route logic)
        let subTotal = 0;
        let taxableAmount = 0;
        let nonTaxableAmount = 0;

        // Calculate item totals
        for (const item of items) {
            const itemTotal = parseFloat(item.price || 0) * parseFloat(item.quantity || 0);
            subTotal += itemTotal;

            // For simplicity, assume we need to check vatStatus from database
            // In a real implementation, you might need to fetch item details
            if (item.vatStatus === 'vatable') {
                taxableAmount += itemTotal;
            } else {
                nonTaxableAmount += itemTotal;
            }
        }

        // Calculate discounts
        const discount = parseFloat(discountPercentage) || 0;
        const discountForTaxable = (taxableAmount * discount) / 100;
        const discountForNonTaxable = (nonTaxableAmount * discount) / 100;

        const finalTaxableAmount = taxableAmount - discountForTaxable;
        const finalNonTaxableAmount = nonTaxableAmount - discountForNonTaxable;

        // Calculate VAT
        let vatAmount = 0;
        if (isVatExempt === 'false' || isVatExempt === 'all') {
            vatAmount = (finalTaxableAmount * vatPercentage) / 100;
        }

        // Calculate final amount (without roundoff for conservative estimate)
        const transactionAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;

        // Get current account balance
        const balanceResponse = await calculateAccountBalance(accountId, companyId, fiscalYearId, session);

        if (!balanceResponse.success) {
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                error: 'Failed to calculate account balance'
            });
        }

        const currentBalance = balanceResponse.data.rawBalance;
        const creditLimit = account.creditLimit;

        // Check if transaction would exceed credit limit
        if (currentBalance + transactionAmount > creditLimit) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: `Credit limit exceeded. Available credit: Rs. ${(creditLimit - currentBalance).toFixed(2)}, Required: Rs. ${transactionAmount.toFixed(2)}`,
                details: {
                    creditLimit,
                    currentBalance,
                    transactionAmount,
                    availableCredit: creditLimit - currentBalance
                }
            });
        }

        await session.commitTransaction();
        session.endSession();
        next();
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error in checkCreditLimit middleware:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error during credit limit validation'
        });
    }
};

// Helper function to calculate account balance (reuse your existing logic)
async function calculateAccountBalance(accountId, companyId, fiscalYearId, session) {
    try {
        // Fetch the account details
        const account = await Account.findOne({
            _id: accountId,
            company: companyId,
            isActive: true,
            $or: [
                { originalFiscalYear: fiscalYearId },
                {
                    fiscalYear: fiscalYearId,
                    originalFiscalYear: { $lt: fiscalYearId }
                }
            ]
        }).populate('companyGroups', 'name').session(session).lean();

        if (!account) {
            return {
                success: false,
                error: 'Account not found for the current fiscal year'
            };
        }

        // Calculate opening balance
        let openingBalance = account.initialOpeningBalance && account.initialOpeningBalance.type === 'Dr'
            ? account.initialOpeningBalance.amount
            : (account.initialOpeningBalance ? -account.initialOpeningBalance.amount : 0);

        // Query all transactions for this account
        const Transaction = mongoose.model('Transaction');
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
            .session(session)
            .lean();

        // Calculate running balance
        const processedTransactions = new Set();
        let balance = openingBalance;

        allTransactions.forEach(tx => {
            const txIdentifier = `${tx.date}-${tx.type}-${tx.billNumber}-${tx.debit}-${tx.credit}`;

            if (!processedTransactions.has(txIdentifier)) {
                processedTransactions.add(txIdentifier);

                let amount = 0;
                if (tx.account && tx.account.toString() === accountId) {
                    amount = (tx.debit || 0) - (tx.credit || 0);
                } else if (tx.paymentAccount && tx.paymentAccount.toString() === accountId) {
                    amount = -(tx.debit || 0);
                } else if (tx.receiptAccount && tx.receiptAccount.toString() === accountId) {
                    amount = (tx.credit || 0);
                } else if (tx.debitAccount && tx.debitAccount.toString() === accountId) {
                    amount = (tx.debit || 0);
                } else if (tx.creditAccount && tx.creditAccount.toString() === accountId) {
                    amount = -(tx.credit || 0);
                }

                balance += amount;
            }
        });

        return {
            success: true,
            data: {
                balance: Math.abs(balance),
                balanceType: balance >= 0 ? 'Dr' : 'Cr',
                rawBalance: balance
            }
        };
    } catch (error) {
        console.error('Error calculating account balance:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = checkCreditLimit;