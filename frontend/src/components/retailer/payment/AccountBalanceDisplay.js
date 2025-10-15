import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../../../stylesheet/retailer/AccountBalanceDisplay.css'

const AccountBalanceDisplay = ({ accountId, api, newTransactionAmount = 0, originalTransactionAmount = 0, compact = false, transactionType = 'payment', dateFormat = 'nepali', isEditMode = false  }) => {
    const [balance, setBalance] = useState(0);
    const [balanceType, setBalanceType] = useState('');
    const [rawBalance, setRawBalance] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [previousAccountId, setPreviousAccountId] = useState(null);

    // Currency formatting function
    const formatCurrency = useCallback((num) => {
        const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
        if (dateFormat === 'nepali') {
            // Indian grouping, two decimals, English digits
            return number.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        // English (US) grouping by default
        return number.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }, [dateFormat]);

    // Fetch account balance
    const fetchAccountBalance = useCallback(async () => {
        if (!accountId) {
            setBalance(0);
            setBalanceType('');
            setRawBalance(0);
            setError('');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await api.get(`/api/retailer/accounts/${accountId}/balance`);

            if (response.data.success) {
                const currentBalance = response.data.data.balance;
                const currentBalanceType = response.data.data.balanceType;
                const currentRawBalance = response.data.data.rawBalance;

                setBalance(currentBalance);
                setBalanceType(currentBalanceType);
                setRawBalance(currentRawBalance);
                setPreviousAccountId(accountId);
            } else {
                setError('Failed to fetch balance');
            }
        } catch (err) {
            console.error('Error fetching account balance:', err);
            setError('Error fetching balance');
        } finally {
            setIsLoading(false);
        }
    }, [accountId, api]);

    // Fetch account balance when accountId changes
    useEffect(() => {
        // Only fetch if accountId has changed and is not null
        if (accountId && accountId !== previousAccountId) {
            fetchAccountBalance();
        } else if (!accountId) {
            // Clear data if accountId is null
            setBalance(0);
            setBalanceType('');
            setRawBalance(0);
            setError('');
            setPreviousAccountId(null);
        }
    }, [accountId, previousAccountId, fetchAccountBalance]);

    // Calculate projected balance using useMemo
    const { projectedBalance, projectedBalanceType } = useMemo(() => {
        if (newTransactionAmount > 0 && rawBalance !== 0) {
            let newRawBalance;

            if (isEditMode) {
                // For edit mode: subtract original amount and add new amount
                if (transactionType === 'payment') {
                    newRawBalance = rawBalance - originalTransactionAmount + newTransactionAmount;
                } else {
                    newRawBalance = rawBalance + originalTransactionAmount - newTransactionAmount;
                }
            } else {
                // For new mode: just add/subtract the new amount
                if (transactionType === 'payment') {
                    newRawBalance = rawBalance + newTransactionAmount;
                } else {
                    newRawBalance = rawBalance - newTransactionAmount;
                }
            }

            return {
                projectedBalance: Math.abs(newRawBalance),
                projectedBalanceType: newRawBalance >= 0 ? 'Dr' : 'Cr'
            };
        } else {
            return {
                projectedBalance: null,
                projectedBalanceType: null
            };
        }
    }, [newTransactionAmount, originalTransactionAmount, rawBalance, transactionType, isEditMode]);


    // Show loading state when fetching new account data
    if (isLoading) {
        return (
            <div className="account-balance-loading">
                <div className="text-muted small">
                    <i className="fas fa-spinner fa-spin me-1"></i>
                    Bal: ...
                </div>
            </div>
        );
    }

    // Show error state if there's an error
    if (error) {
        return (
            <div className="account-balance-error">
                <div className="text-danger small">
                    <i className="fas fa-exclamation-triangle me-1"></i>
                    {error}
                </div>
            </div>
        );
    }

    // Show zero balance state when account has no balance
    if (balance === 0 && balanceType === '') {
        return (
            <div className="account-balance-zero">
                <div className="text-muted small">
                    <i className="fas fa-info-circle me-1"></i>
                    Bal: {formatCurrency(0)}
                </div>
            </div>
        );
    }

    // Compact view for inline display
    if (compact) {
        return (
            <span className="account-balance-compact">
                <span className={`ms-2 ${balanceType === 'Dr' ? 'text-danger' : 'text-success'}`}>
                    <i className={`fas ${balanceType === 'Dr' ? 'fa-arrow-down text-danger' : 'fa-arrow-up text-success'} me-1`}></i>
                    Bal: {formatCurrency(balance)} {balanceType}
                </span>
                {projectedBalance !== null && (
                    <span className={`ms-2 ${projectedBalanceType === 'Dr' ? 'text-danger' : 'text-success'}`}>
                        <i className={`fas ${projectedBalanceType === 'Dr' ? 'fa-arrow-down text-danger' : 'fa-arrow-up text-success'} me-1`}></i>
                        Proj: {formatCurrency(projectedBalance)} {projectedBalanceType}
                    </span>
                )}
            </span>
        );
    }

    // Full view
    return (
        <div className="account-balance-display">
            <div className="balance-header">
                <small className="text-muted">Current Balance:</small>
                <button
                    className="btn btn-sm btn-outline-secondary refresh-btn"
                    onClick={fetchAccountBalance}
                    title="Refresh balance"
                >
                    <i className="fas fa-sync-alt"></i>
                </button>
            </div>
            <div className={`fw-bold ${balanceType === 'Dr' ? 'text-danger' : 'text-success'}`}>
                <i className={`fas ${balanceType === 'Dr' ? 'fa-arrow-down text-danger' : 'fa-arrow-up text-success'} me-1`}></i>
                {formatCurrency(balance)} {balanceType}
            </div>

            {projectedBalance !== null && (
                <>
                    <small className="text-muted">Projected Balance:</small>
                    <div className={`fw-bold ${projectedBalanceType === 'Dr' ? 'text-danger' : 'text-success'}`}>
                        <i className={`fas ${projectedBalanceType === 'Dr' ? 'fa-arrow-down text-danger' : 'fa-arrow-up text-success'} me-1`}></i>
                        {formatCurrency(projectedBalance)} {projectedBalanceType}
                    </div>
                </>
            )}
        </div>
    );
};

export default React.memo(AccountBalanceDisplay);