import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import NepaliDate from 'nepali-date-converter';
import NotificationToast from '../../NotificationToast';
import Header from '../Header';
import Loader from '../../Loader';
import AccountBalanceDisplay from '../payment/AccountBalanceDisplay';

const EditDebitNote = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const accountSearchRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');

    const [formData, setFormData] = useState({
        billDate: new Date().toISOString().split('T')[0],
        nepaliDate: currentNepaliDate,
        description: '',
        entries: []
    });

    const [debitNote, setDebitNote] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [companyDateFormat, setCompanyDateFormat] = useState('english');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [filteredAccounts, setFilteredAccounts] = useState([]);
    const [currentRow, setCurrentRow] = useState({ type: '', index: -1, field: '' });
    const searchRef = useRef(null);
    const lastRowRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        const fetchDebitNoteData = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/api/retailer/debit-note/${id}`);
                const { data } = response;

                setDebitNote(data.data.debitNote);
                setAccounts(data.data.accounts);
                setCompanyDateFormat(data.data.companyDateFormat);

                // Convert debit/credit accounts to entries format
                const entries = [];

                // Get the maximum length between debit and credit accounts
                const maxLength = Math.max(
                    data.data.debitNote.debitAccounts.length,
                    data.data.debitNote.creditAccounts.length
                );

                // Pair debit and credit entries in the same row
                for (let i = 0; i < maxLength; i++) {
                    const debitAccount = data.data.debitNote.debitAccounts[i];
                    const creditAccount = data.data.debitNote.creditAccounts[i];

                    entries.push({
                        id: Date.now() + Math.random(),
                        debitAccountId: debitAccount ? debitAccount.account._id : '',
                        debitAccountName: debitAccount ? `${debitAccount.account.uniqueNumber} - ${debitAccount.account.name}` : '',
                        debitAmount: debitAccount ? debitAccount.debit : '',
                        debitOriginalAmount: debitAccount ? debitAccount.debit : 0,
                        creditAccountId: creditAccount ? creditAccount.account._id : '',
                        creditAccountName: creditAccount ? `${creditAccount.account.uniqueNumber} - ${creditAccount.account.name}` : '',
                        creditAmount: creditAccount ? creditAccount.credit : '',
                        creditOriginalAmount: creditAccount ? creditAccount.credit : 0
                    });
                }

                // Populate form data
                setFormData({
                    billDate: data.data.debitNote.date ? data.data.debitNote.date : new Date().toISOString().split('T')[0],
                    nepaliDate: new NepaliDate(data.data.debitNote.date).format('YYYY-MM-DD') || currentNepaliDate,
                    description: data.data.debitNote.description || '',
                    entries: entries
                });

                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load debit note');
                setLoading(false);
            }
        };

        fetchDebitNoteData();
    }, [id]);

    // Auto-add new row when user types in the last row
    useEffect(() => {
        if (lastRowRef.current) {
            lastRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [formData.entries]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRowChange = (index, field, value) => {
        setFormData(prev => {
            const newEntries = [...prev.entries];
            newEntries[index] = {
                ...newEntries[index],
                [field]: value,
                // Preserve original amounts when changing other fields
                debitOriginalAmount: newEntries[index].debitOriginalAmount || 0,
                creditOriginalAmount: newEntries[index].creditOriginalAmount || 0
            };

            // If this is the last row and user is entering data in the last amount field, add a new row
            if (index === newEntries.length - 1 && value !== '' &&
                (field === 'debitAmount' || field === 'creditAmount')) {
                newEntries.push({
                    id: Date.now() + Math.random(),
                    debitAccountId: '',
                    debitAccountName: '',
                    debitAmount: '',
                    debitOriginalAmount: 0,
                    creditAccountId: '',
                    creditAccountName: '',
                    creditAmount: '',
                    creditOriginalAmount: 0
                });
            }

            return { ...prev, entries: newEntries };
        });
    };

    const removeRow = (index) => {
        if (formData.entries.length <= 1) return;

        setFormData(prev => {
            const newEntries = [...prev.entries];
            newEntries.splice(index, 1);
            return { ...prev, entries: newEntries };
        });
    };

    const calculateTotal = (type) => {
        return formData.entries.reduce((total, entry) => {
            const amount = type === 'debit' ? entry.debitAmount : entry.creditAmount;
            return total + (parseFloat(amount) || 0);
        }, 0);
    };

    const openAccountModal = (type, index, field) => {
        setCurrentRow({ type, index, field });
        setShowAccountModal(true);
        setFilteredAccounts(accounts);
        setTimeout(() => searchRef.current?.focus(), 100);
    };

    const handleAccountSearch = (e) => {
        const searchText = e.target.value.toLowerCase();
        const filtered = accounts.filter(account =>
            account.name.toLowerCase().includes(searchText) ||
            (account.code && account.code.toString().toLowerCase().includes(searchText)) ||
            (account.uniqueNumber && account.uniqueNumber.toString().toLowerCase().includes(searchText))
        );
        setFilteredAccounts(filtered);
    };

    const selectAccount = (account) => {
        const { type, index, field } = currentRow;
        const accountField = field === 'debit' ? 'debitAccount' : 'creditAccount';

        // Format account name with uniqueNumber
        const accountName = `${account.uniqueNumber || account.code || 'N/A'} - ${account.name}`;

        handleRowChange(index, `${accountField}Id`, account._id);
        handleRowChange(index, `${accountField}Name`, accountName);
        setShowAccountModal(false);

        // Focus on the amount field of the selected account
        setTimeout(() => {
            document.getElementById(`${field}-amount-${index}`)?.focus();
        }, 100);
    };

    const validateAmounts = () => {
        const totalDebit = calculateTotal('debit');
        const totalCredit = calculateTotal('credit');
        return totalDebit === totalCredit;
    };

    const handleSubmit = async (print = false) => {
        // Filter out empty rows and validate
        const nonEmptyEntries = formData.entries.filter(entry =>
            (entry.debitAccountId && entry.debitAmount) ||
            (entry.creditAccountId && entry.creditAmount)
        );

        // Validate we have at least one debit and one credit entry
        const hasDebit = nonEmptyEntries.some(entry => entry.debitAccountId && entry.debitAmount);
        const hasCredit = nonEmptyEntries.some(entry => entry.creditAccountId && entry.creditAmount);

        if (!hasDebit || !hasCredit) {
            setNotification({
                show: true,
                message: 'At least one debit and one credit entry is required',
                type: 'error'
            });
            return;
        }

        // Validate totals
        const totalDebit = calculateTotal('debit');
        const totalCredit = calculateTotal('credit');

        if (totalDebit !== totalCredit) {
            setNotification({
                show: true,
                message: 'Total debit and credit amounts must be equal',
                type: 'error'
            });
            return;
        }

        setIsSaving(true);

        try {
            // Prepare debit and credit arrays for submission
            const debitAccounts = [];
            const creditAccounts = [];

            formData.entries.forEach(entry => {
                if (entry.debitAccountId && entry.debitAmount) {
                    debitAccounts.push({
                        account: entry.debitAccountId,
                        debit: parseFloat(entry.debitAmount)
                    });
                }

                if (entry.creditAccountId && entry.creditAmount) {
                    creditAccounts.push({
                        account: entry.creditAccountId,
                        credit: parseFloat(entry.creditAmount)
                    });
                }
            });

            const payload = {
                billDate: formData.billDate,
                nepaliDate: formData.nepaliDate,
                description: formData.description,
                debitAccounts,
                creditAccounts,
                print
            };

            const response = await api.put(`/api/retailer/debit-note/${id}`, payload);

            setNotification({
                show: true,
                message: 'Debit note updated successfully!',
                type: 'success'
            });

            // If print was requested, fetch print data and print immediately
            if (print && response.data.data?.debitNote?._id) {
                try {
                    const printResponse = await api.get(`/api/retailer/debit-note/${response.data.data.debitNote._id}/print`);
                    printVoucherImmediately(printResponse.data.data);
                } catch (printError) {
                    console.error('Error fetching print data:', printError);
                    setNotification({
                        show: true,
                        message: 'Debit note updated but failed to load print data',
                        type: 'warning'
                    });
                }
            } else {
                // Navigate back to view page after a short delay
                setTimeout(() => {
                    navigate(`/retailer/debit-note/${id}`);
                }, 1500);
            }
        } catch (err) {
            setNotification({
                show: true,
                message: err.response?.data?.message || 'Failed to update debit note',
                type: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelVoucher = async () => {
        if (window.confirm("Are you sure you want to cancel this voucher?")) {
            try {
                await api.post(`/api/retailer/debit-note/cancel/${debitNote.billNumber}`);
                setNotification({
                    show: true,
                    message: 'Voucher canceled successfully',
                    type: 'success'
                });
                // Refresh the data
                const response = await api.get(`/api/retailer/debit-note/${id}`);
                setDebitNote(response.data.data.debitNote);
            } catch (err) {
                setNotification({
                    show: true,
                    message: err.response?.data?.message || 'Failed to cancel voucher',
                    type: 'error'
                });
            }
        }
    };

    const handleReactivateVoucher = async () => {
        if (window.confirm("Are you sure you want to reactivate this voucher?")) {
            try {
                await api.post(`/api/retailer/debit-note/reactivate/${debitNote.billNumber}`);
                setNotification({
                    show: true,
                    message: 'Voucher reactivated successfully',
                    type: 'success'
                });
                // Refresh the data
                const response = await api.get(`/api/retailer/debit-note/${id}`);
                setDebitNote(response.data.data.debitNote);
            } catch (err) {
                setNotification({
                    show: true,
                    message: err.response?.data?.message || 'Failed to reactivate voucher',
                    type: 'error'
                });
            }
        }
    };

    const handleKeyDown = (e, currentFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = e.target.form;
            const inputs = Array.from(form.querySelectorAll('input, select, textarea')).filter(
                el => !el.hidden && !el.disabled && el.offsetParent !== null
            );
            const currentIndex = inputs.findIndex(input => input.id === currentFieldId);

            if (currentIndex > -1 && currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
            }
        }
    };

    // Calculate total original and new amounts for each account
    const accountTotals = useMemo(() => {
        const amounts = {};

        formData.entries.forEach(entry => {
            // Debit accounts
            if (entry.debitAccountId) {
                const accountId = entry.debitAccountId;
                if (!amounts[accountId]) {
                    amounts[accountId] = {
                        originalTotal: 0,
                        newTotal: 0,
                        type: 'debit'
                    };
                }
                amounts[accountId].originalTotal += parseFloat(entry.debitOriginalAmount) || 0;
                amounts[accountId].newTotal += parseFloat(entry.debitAmount) || 0;
            }

            // Credit accounts
            if (entry.creditAccountId) {
                const accountId = entry.creditAccountId;
                if (!amounts[accountId]) {
                    amounts[accountId] = {
                        originalTotal: 0,
                        newTotal: 0,
                        type: 'credit'
                    };
                }
                amounts[accountId].originalTotal += parseFloat(entry.creditOriginalAmount) || 0;
                amounts[accountId].newTotal += parseFloat(entry.creditAmount) || 0;
            }
        });

        return amounts;
    }, [formData.entries]);

    const printVoucherImmediately = (printData) => {
        // Create a temporary div to hold the print content
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        // Create the printable content
        tempDiv.innerHTML = `
        <div id="printableContent">
            <div class="print-voucher-container">
                <div class="print-voucher-header">
                    <div class="print-company-name">${printData.currentCompanyName}</div>
                    <div class="print-company-details">
                        ${printData.currentCompany.address}-${printData.currentCompany.ward}, ${printData.currentCompany.city},
                        ${printData.currentCompany.country}
                        <br />
                        VAT NO.: ${printData.currentCompany.pan || 'N/A'}
                    </div>
                    <div class="print-voucher-title">DEBIT NOTE</div>
                </div>

                <div class="print-voucher-details">
                    <div>
                        <div><strong>Vch. No:</strong> ${printData.debitNote.billNumber}</div>
                    </div>
                    <div>
                        <div><strong>Date:</strong> ${new Date(printData.debitNote.date).toLocaleDateString()}</div>
                    </div>
                </div>

                <table class="print-voucher-table">
                    <thead>
                        <tr>
                            <th>S.N</th>
                            <th>Particular</th>
                            <th>Debit Amount</th>
                            <th>Credit Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${printData.debitTransactions.map((transaction, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${transaction.account?.name || 'N/A'}</td>
                                <td>${transaction.debit?.toFixed(2)}</td>
                                <td>0.00</td>
                            </tr>
                        `).join('')}
                        ${printData.creditTransactions.map((transaction, index) => `
                            <tr>
                                <td>${printData.debitTransactions.length + index + 1}</td>
                                <td>${transaction.account?.name || 'N/A'}</td>
                                <td>0.00</td>
                                <td>${transaction.credit?.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colSpan="2">Total</th>
                            <th>${printData.debitTransactions.reduce((sum, trans) => sum + (trans.debit || 0), 0).toFixed(2)}</th>
                            <th>${printData.creditTransactions.reduce((sum, trans) => sum + (trans.credit || 0), 0).toFixed(2)}</th>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 3mm;">
                    <strong>Note:</strong> ${printData.debitNote.description || 'N/A'}
                </div>

                <div class="print-signature-area">
                    <div class="print-signature-box">
                        Prepared By
                    </div>
                    <div class="print-signature-box">
                        Checked By
                    </div>
                    <div class="print-signature-box">
                        Approved By
                    </div>
                </div>
            </div>
        </div>
    `;

        // Add print styles
        const styles = `
        @page {
            size: A4;
            margin: 5mm;
        }
        body {
            font-family: 'Arial Narrow', Arial, sans-serif;
            font-size: 9pt;
            line-height: 1.2;
            color: #000;
            background: white;
            margin: 0;
            padding: 0;
        }
        .print-voucher-container {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            padding: 2mm;
        }
        .print-voucher-header {
            text-align: center;
            margin-bottom: 3mm;
            border-bottom: 1px dashed #000;
            padding-bottom: 2mm;
        }
        .print-voucher-title {
            font-size: 12pt;
            font-weight: bold;
            margin: 2mm 0;
            text-transform: uppercase;
            text-decoration: underline;
            letter-spacing: 1px;
        }
        .print-company-name {
            font-size: 16pt;
            font-weight: bold;
        }
        .print-company-details {
            font-size: 8pt;
            margin: 1mm 0;
        }
        .print-voucher-details {
            display: flex;
            justify-content: space-between;
            margin: 2mm 0;
            font-size: 8pt;
        }
        .print-voucher-table {
            width: 100%;
            border-collapse: collapse;
            margin: 3mm 0;
            font-size: 8pt;
        }
        .print-voucher-table thead {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
        }
        .print-voucher-table th {
            background-color: transparent;
            border: 1px solid #000;
            padding: 1mm;
            text-align: left;
            font-weight: bold;
            background-color: #f0f0f0;
        }
        .print-voucher-table td {
            border: 1px solid #000;
            padding: 1mm;
        }
        .print-text-right {
            text-align: right;
        }
        .print-text-center {
            text-align: center;
        }
        .print-signature-area {
            display: flex;
            justify-content: space-between;
            margin-top: 5mm;
            font-size: 8pt;
        }
        .print-signature-box {
            text-align: center;
            width: 30%;
            border-top: 1px dashed #000;
            padding-top: 1mm;
            font-weight: bold;
        }
    `;

        // Create print window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
        <html>
            <head>
                <title>Debit_Note_${printData.debitNote.billNumber}</title>
                <style>${styles}</style>
            </head>
            <body>
                ${tempDiv.innerHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 200);
                    };
                </script>
            </body>
        </html>
    `);
        printWindow.document.close();

        // Clean up
        document.body.removeChild(tempDiv);
    };

    if (loading) return <Loader />;

    if (error) return <div className="alert alert-danger mt-5">{error}</div>;
    if (!debitNote) return <div className="alert alert-danger mt-5">Debit note not found</div>;

    const isCanceled = debitNote.status === 'canceled';

    return (
        <div className='Container-fluid'>
            <Header />
            <div className="container mt-4">
                <div className="card shadow-lg p-4">
                    <div className="card-header bg-primary text-white">
                        <div className="row">
                            <div className="col-6">
                                <h5 className="card-title mb-0">Edit Debit Note</h5>
                            </div>
                            <div className="col-6 text-end">
                                {isCanceled && (
                                    <span className="text-warning">
                                        <strong>Voucher is canceled. All related transactions are inactive.</strong>
                                    </span>
                                )}
                                {!isCanceled ? (
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={handleCancelVoucher}
                                        disabled={isSaving}
                                    >
                                        Cancel Voucher
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-success btn-sm"
                                        onClick={handleReactivateVoucher}
                                        disabled={isSaving}
                                    >
                                        Reactivate Voucher
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="card-body">
                        <form id='debitNoteForm' onSubmit={(e) => {
                            e.preventDefault();
                            handleSubmit(false);
                        }}>
                            {/* Header Section */}
                            <div className="form-group row mb-3">
                                {companyDateFormat === 'nepali' ? (
                                    <div className="col-md-3">
                                        <label htmlFor="nepaliDate">Date:</label>
                                        <input
                                            type="text"
                                            name="nepaliDate"
                                            id="nepaliDate"
                                            className="form-control"
                                            required
                                            autoComplete='off'
                                            value={formData.nepaliDate}
                                            onChange={handleInputChange}
                                            autoFocus
                                            disabled={isCanceled}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'nepaliDate');
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="col-md-3">
                                        <label htmlFor="billDate">Date:</label>
                                        <input
                                            type="date"
                                            name="billDate"
                                            id="billDate"
                                            className="form-control"
                                            value={formData.billDate}
                                            onChange={handleInputChange}
                                            autoFocus
                                            disabled={isCanceled}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'billDate');
                                                }
                                            }}
                                        />
                                    </div>
                                )}

                                <div className="col-md-3">
                                    <label htmlFor="billNumber">Vch. No:</label>
                                    <input
                                        type="text"
                                        name="billNumber"
                                        id="billNumber"
                                        className="form-control"
                                        value={debitNote.billNumber}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleKeyDown(e, 'billNumber');
                                            }
                                        }}
                                        readOnly
                                    />
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="description">Description:</label>
                                    <input
                                        type="text"
                                        name="description"
                                        id="description"
                                        className="form-control"
                                        placeholder="Enter description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        disabled={isCanceled}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleKeyDown(e, 'description');
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Debit Note Entries Table */}
                            <div className="mb-4">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <h6 className="text-primary">Debit Note Entries</h6>
                                    <span className="badge bg-info">
                                        {formData.entries.filter(entry =>
                                            (entry.debitAccountId && entry.debitAmount) ||
                                            (entry.creditAccountId && entry.creditAmount)
                                        ).length} entries
                                    </span>
                                </div>

                                <div className="table-responsive">
                                    <table className="table table-sm">
                                        <thead>
                                            <tr>
                                                <th width="30%">Debit Account</th>
                                                <th width="15%">Debit Amount (Rs.)</th>
                                                <th width="30%">Credit Account</th>
                                                <th width="15%">Credit Amount (Rs.)</th>
                                                <th width="10%"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.entries.map((entry, index) => (
                                                <tr
                                                    key={entry.id}
                                                    ref={index === formData.entries.length - 1 ? lastRowRef : null}
                                                    className="hover-row"
                                                >
                                                    {/* Debit Account */}
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm"
                                                            placeholder="Select debit account"
                                                            value={entry.debitAccountName}
                                                            onFocus={() => openAccountModal('debit', index, 'debit')}
                                                            readOnly
                                                            disabled={isCanceled}
                                                        />
                                                        {entry.debitAccountId && (
                                                            <div className="mt-1">
                                                                <AccountBalanceDisplay
                                                                    accountId={entry.debitAccountId}
                                                                    api={api}
                                                                    newTransactionAmount={accountTotals[entry.debitAccountId]?.newTotal || 0}
                                                                    originalTransactionAmount={accountTotals[entry.debitAccountId]?.originalTotal || 0}
                                                                    compact={true}
                                                                    transactionType="payment"
                                                                    dateFormat={companyDateFormat}
                                                                    isEditMode={true}
                                                                />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            id={`debit-amount-${index}`}
                                                            className="form-control form-control-sm"
                                                            placeholder="0.00"
                                                            value={entry.debitAmount}
                                                            onChange={(e) => handleRowChange(index, 'debitAmount', e.target.value)}
                                                            min="0"
                                                            step="0.01"
                                                            disabled={isCanceled}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleKeyDown(e, `debit-amount-${index}`);
                                                                }
                                                            }}
                                                        />
                                                    </td>

                                                    {/* Credit Account */}
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm"
                                                            placeholder="Select credit account"
                                                            value={entry.creditAccountName}
                                                            onFocus={() => openAccountModal('credit', index, 'credit')}
                                                            readOnly
                                                            disabled={isCanceled}
                                                        />
                                                        {entry.creditAccountId && (
                                                            <div className="mt-1">
                                                                <AccountBalanceDisplay
                                                                    accountId={entry.creditAccountId}
                                                                    api={api}
                                                                    newTransactionAmount={accountTotals[entry.creditAccountId]?.newTotal || 0}
                                                                    originalTransactionAmount={accountTotals[entry.creditAccountId]?.originalTotal || 0}
                                                                    compact={true}
                                                                    transactionType="receipt"
                                                                    dateFormat={companyDateFormat}
                                                                    isEditMode={true}
                                                                />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            id={`credit-amount-${index}`}
                                                            className="form-control form-control-sm"
                                                            placeholder="0.00"
                                                            value={entry.creditAmount}
                                                            onChange={(e) => handleRowChange(index, 'creditAmount', e.target.value)}
                                                            min="0"
                                                            step="0.01"
                                                            disabled={isCanceled}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    // If this is the last row's credit amount, focus on save button
                                                                    if (index === formData.entries.length - 1) {
                                                                        document.getElementById('saveBill')?.focus();
                                                                    } else {
                                                                        handleKeyDown(e, `credit-amount-${index}`);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="text-center">
                                                        {formData.entries.length > 1 && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() => removeRow(index)}
                                                                title="Remove row"
                                                                disabled={isCanceled}
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <th className="text-end" colSpan="1">Total Debit:</th>
                                                <th className="text-primary">Rs. {calculateTotal('debit').toFixed(2)}</th>
                                                <th className="text-end" colSpan="1">Total Credit:</th>
                                                <th className="text-primary">Rs. {calculateTotal('credit').toFixed(2)}</th>
                                                <th></th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Validation Messages */}
                            {calculateTotal('debit') !== calculateTotal('credit') && (
                                <div className="alert alert-warning">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    Total debit and credit amounts must be equal
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="d-flex justify-content-between mt-4">
                                <div className="text-muted small">
                                    <i className="fas fa-info-circle me-1"></i>
                                </div>
                                <div>
                                    <button
                                        type="submit"
                                        id='saveBill'
                                        className="btn btn-primary me-2"
                                        disabled={isSaving || isCanceled || calculateTotal('debit') !== calculateTotal('credit')}
                                    >
                                        {isSaving ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Updating...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-save me-2"></i>
                                                Update Debit Note
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => handleSubmit(true)}
                                        disabled={isSaving || isCanceled || calculateTotal('debit') !== calculateTotal('credit')}
                                    >
                                        <i className="fas fa-print me-2"></i> Update & Print
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Account Modal */}
            {showAccountModal && (
                <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content" style={{ height: '400px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title" id="accountModalLabel">Select an Account</h5>
                                <button type="button" className="btn-close" onClick={() => setShowAccountModal(false)}></button>
                            </div>
                            <div className="p-3 bg-white sticky-top">
                                <input
                                    type="text"
                                    id="searchAccount"
                                    className="form-control form-control-sm"
                                    placeholder="Search Account"
                                    autoFocus
                                    autoComplete='off'
                                    onChange={handleAccountSearch}
                                    onKeyDown={(e) => {
                                        // Handle arrow keys and Enter in search input
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item');
                                            if (firstAccountItem) {
                                                firstAccountItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            // Move focus to next input field and hide modal
                                            setShowAccountModal(false);
                                            // Focus on the amount field
                                            setTimeout(() => {
                                                const amountField = document.getElementById(`${currentRow.field}-amount-${currentRow.index}`);
                                                if (amountField) {
                                                    amountField.focus();
                                                }
                                            }, 100);
                                        }
                                    }}
                                    ref={accountSearchRef}
                                />
                            </div>
                            <div className="modal-body p-0">
                                <div className="overflow-auto" style={{ height: 'calc(400px - 120px)' }}>
                                    <ul id="accountList" className="list-group">
                                        {filteredAccounts.length > 0 ? (
                                            filteredAccounts
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((account, index) => (
                                                    <li
                                                        key={account._id}
                                                        data-account-id={account._id}
                                                        className="list-group-item account-item py-2"
                                                        onClick={() => {
                                                            selectAccount(account);
                                                        }}
                                                        style={{ cursor: 'pointer' }}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            // Handle keyboard navigation
                                                            if (e.key === 'ArrowDown') {
                                                                e.preventDefault();
                                                                const nextItem = e.target.nextElementSibling;
                                                                if (nextItem) {
                                                                    e.target.classList.remove('active');
                                                                    nextItem.classList.add('active');
                                                                    nextItem.focus();
                                                                }
                                                            } else if (e.key === 'ArrowUp') {
                                                                e.preventDefault();
                                                                const prevItem = e.target.previousElementSibling;
                                                                if (prevItem) {
                                                                    e.target.classList.remove('active');
                                                                    prevItem.classList.add('active');
                                                                    prevItem.focus();
                                                                } else {
                                                                    // If at top, go back to search input
                                                                    accountSearchRef.current.focus();
                                                                }
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                selectAccount(account);
                                                            } else if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                setShowAccountModal(false);
                                                            }
                                                        }}
                                                        onFocus={(e) => {
                                                            // Remove active class from all items and add to focused one
                                                            document.querySelectorAll('.account-item').forEach(item => {
                                                                item.classList.remove('active');
                                                            });
                                                            e.target.classList.add('active');
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            // Highlight on hover but don't set as active for keyboard navigation
                                                            e.target.classList.add('hover');
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.target.classList.remove('hover');
                                                        }}
                                                    >
                                                        <div className="d-flex justify-content-between small">
                                                            <strong>{account.uniqueNumber || account.code || 'N/A'} - {account.name}</strong>
                                                            <span>📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}</span>
                                                        </div>
                                                    </li>
                                                ))
                                        ) : (
                                            // If search is active and no result found
                                            accountSearchRef.current?.value ? (
                                                <li className="list-group-item text-center text-muted small py-2">No accounts found</li>
                                            ) : (
                                                accounts
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((account) => (
                                                        <li
                                                            key={account._id}
                                                            data-account-id={account._id}
                                                            className="list-group-item account-item py-2"
                                                            onClick={() => {
                                                                selectAccount(account);
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                            tabIndex={0}
                                                            onKeyDown={(e) => {
                                                                // Handle keyboard navigation
                                                                if (e.key === 'ArrowDown') {
                                                                    e.preventDefault();
                                                                    const nextItem = e.target.nextElementSibling;
                                                                    if (nextItem) {
                                                                        e.target.classList.remove('active');
                                                                        nextItem.classList.add('active');
                                                                        nextItem.focus();
                                                                    }
                                                                } else if (e.key === 'ArrowUp') {
                                                                    e.preventDefault();
                                                                    const prevItem = e.target.previousElementSibling;
                                                                    if (prevItem) {
                                                                        e.target.classList.remove('active');
                                                                        prevItem.classList.add('active');
                                                                        prevItem.focus();
                                                                    } else {
                                                                        // If at top, go back to search input
                                                                        accountSearchRef.current.focus();
                                                                    }
                                                                } else if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    selectAccount(account);
                                                                } else if (e.key === 'Escape') {
                                                                    e.preventDefault();
                                                                    setShowAccountModal(false);
                                                                }
                                                            }}
                                                            onFocus={(e) => {
                                                                // Remove active class from all items and add to focused one
                                                                document.querySelectorAll('.account-item').forEach(item => {
                                                                    item.classList.remove('active');
                                                                });
                                                                e.target.classList.add('active');
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                // Highlight on hover but don't set as active for keyboard navigation
                                                                e.target.classList.add('hover');
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.target.classList.remove('hover');
                                                            }}
                                                        >
                                                            <div className="d-flex justify-content-between small">
                                                                <strong>{account.uniqueNumber || account.code || 'N/A'} - {account.name}</strong>
                                                                <span>📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}</span>
                                                            </div>
                                                        </li>
                                                    ))
                                            )
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />

            <style jsx>{`
                .hover-row:hover {
                    background-color: #f8f9fa;
                }
                .table th {
                    border-top: none;
                    border-bottom: 2px solid #dee2e6;
                }
            `}</style>
        </div>
    );
};

export default EditDebitNote;