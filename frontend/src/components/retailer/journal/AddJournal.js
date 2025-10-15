import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NepaliDate from 'nepali-date-converter';
import NotificationToast from '../../NotificationToast';
import Header from '../Header';
import AccountBalanceDisplay from '../payment/AccountBalanceDisplay';

const AddJournalVoucher = () => {
    const navigate = useNavigate();
    const accountSearchRef = useRef(null);

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
        entries: [
            {
                id: Date.now() + Math.random(),
                debitAccountId: '',
                debitAccountName: '',
                debitAmount: '',
                creditAccountId: '',
                creditAccountName: '',
                creditAmount: ''
            }
        ]
    });

    const [accounts, setAccounts] = useState([]);
    const [nextBillNumber, setNextBillNumber] = useState('');
    const [companyDateFormat, setCompanyDateFormat] = useState('nepali');
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

    // Calculate total amounts for each account across all entries
    const accountTotals = useMemo(() => {
        const totals = {};

        formData.entries.forEach(entry => {
            // Calculate total debit amount for each account
            if (entry.debitAccountId && entry.debitAmount) {
                const amount = parseFloat(entry.debitAmount) || 0;
                totals[entry.debitAccountId] = (totals[entry.debitAccountId] || 0) + amount;
            }

            // Calculate total credit amount for each account
            if (entry.creditAccountId && entry.creditAmount) {
                const amount = parseFloat(entry.creditAmount) || 0;
                totals[entry.creditAccountId] = (totals[entry.creditAccountId] || 0) + amount;
            }
        });

        return totals;
    }, [formData.entries]);

    useEffect(() => {
        const fetchJournalFormData = async () => {
            try {
                const response = await api.get('/api/retailer/journal');
                const { data } = response;

                setAccounts(data.data.accounts);
                setNextBillNumber(data.data.nextBillNumber);
                setCompanyDateFormat(data.data.companyDateFormat);
                setIsLoading(false);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load journal voucher form');
                setIsLoading(false);
            }
        };

        fetchJournalFormData();
    }, []);

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
            newEntries[index] = { ...newEntries[index], [field]: value };

            // If this is the last row and user is entering data in the last amount field, add a new row
            if (index === newEntries.length - 1 && value !== '' &&
                (field === 'debitAmount' || field === 'creditAmount')) {
                newEntries.push({
                    id: Date.now() + Math.random(),
                    debitAccountId: '',
                    debitAccountName: '',
                    debitAmount: '',
                    creditAccountId: '',
                    creditAccountName: '',
                    creditAmount: ''
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
            (account.code && account.code.toString().toLowerCase().includes(searchText))
        );
        setFilteredAccounts(filtered);
    };

    const selectAccount = (account) => {
        const { type, index, field } = currentRow;
        const accountField = field === 'debit' ? 'debitAccount' : 'creditAccount';

        handleRowChange(index, `${accountField}Id`, account._id);
        handleRowChange(index, `${accountField}Name`, `${account.code} - ${account.name}`);
        setShowAccountModal(false);

        // Focus on the amount field of the selected account
        setTimeout(() => {
            document.getElementById(`${field}-amount-${index}`)?.focus();
        }, 100);
    };

    const resetForm = async () => {
        try {
            // Fetch fresh data from the backend
            const response = await api.get('/api/retailer/journal');
            const { data } = response;

            // Update the next bill number
            setNextBillNumber(data.data.nextBillNumber);

            // Reset form with fresh data
            const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
            setFormData({
                billDate: new Date().toISOString().split('T')[0],
                nepaliDate: currentNepaliDate,
                description: '',
                entries: [
                    {
                        id: Date.now() + Math.random(),
                        debitAccountId: '',
                        debitAccountName: '',
                        debitAmount: '',
                        creditAccountId: '',
                        creditAccountName: '',
                        creditAmount: ''
                    }
                ]
            });

            // Focus back to the date field
            setTimeout(() => {
                if (companyDateFormat === 'nepali') {
                    document.getElementById('nepaliDate')?.focus();
                } else {
                    document.getElementById('billDate')?.focus();
                }
            }, 100);

        } catch (err) {
            console.error('Error resetting form:', err);
            setNotification({
                show: true,
                message: 'Error refreshing form data',
                type: 'error'
            });
        }
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

            const response = await api.post('/api/retailer/journal', payload);

            setNotification({
                show: true,
                message: 'Journal voucher saved successfully!',
                type: 'success'
            });

            await resetForm();

            // If print was requested, fetch print data and print immediately
            if (print && response.data.data?.journalVoucher?._id) {
                try {
                    const printResponse = await api.get(`/api/retailer/journal/${response.data.data.journalVoucher._id}/print`);
                    printVoucherImmediately(printResponse.data.data);
                } catch (printError) {
                    console.error('Error fetching print data:', printError);
                    setNotification({
                        show: true,
                        message: 'Journal voucher saved but failed to load print data',
                        type: 'warning'
                    });
                }
            }
        } catch (err) {
            setNotification({
                show: true,
                message: err.response?.data?.message || 'Failed to save journal voucher',
                type: 'error'
            });
        } finally {
            setIsSaving(false);
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
                        ${printData.currentCompany.address}-${printData.currentCompany.ward}, ${printData.currentCompany.city}
                        <br />
                        Tel: ${printData.currentCompany.phone} | PAN: ${printData.currentCompany.pan || 'N/A'}
                    </div>
                    <div class="print-voucher-title">JOURNAL VOUCHER</div>
                </div>

                <div class="print-voucher-details">
                    <div>
                        <div><strong>Vch. No:</strong> ${printData.journalVoucher.billNumber}</div>
                    </div>
                    <div>
                        <div><strong>Date:</strong> ${new Date(printData.journalVoucher.date).toLocaleDateString()}</div>
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
                        ${printData.journalVoucher.debitAccounts.map((account, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${account.account?.name || 'N/A'}</td>
                                <td>${account.debit?.toFixed(2)}</td>
                                <td>0.00</td>
                            </tr>
                        `).join('')}
                        ${printData.journalVoucher.creditAccounts.map((account, index) => `
                            <tr>
                                <td>${printData.journalVoucher.debitAccounts.length + index + 1}</td>
                                <td>${account.account?.name || 'N/A'}</td>
                                <td>0.00</td>
                                <td>${account.credit?.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colSpan="2">Total</th>
                            <th>${printData.journalVoucher.debitAccounts.reduce((sum, acc) => sum + (acc.debit || 0), 0).toFixed(2)}</th>
                            <th>${printData.journalVoucher.creditAccounts.reduce((sum, acc) => sum + (acc.credit || 0), 0).toFixed(2)}</th>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 3mm;">
                    <strong>Note:</strong> ${printData.journalVoucher.description || 'N/A'}
                </div>

                <div class="print-signature-area">
                    <div class="print-signature-box">
                        <div style="margin-bottom: 1mm;">
                            <strong>${printData.journalVoucher.user?.name || 'N/A'}</strong>
                        </div>
                        Prepared By
                    </div>
                    <div class="print-signature-box">
                        <div style="margin-bottom: 1mm;">&nbsp;</div>
                        Checked By
                    </div>
                    <div class="print-signature-box">
                        <div style="margin-bottom: 1mm;">&nbsp;</div>
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
                <title>Journal_Voucher_${printData.journalVoucher.billNumber}</title>
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

    if (error) return <div className="alert alert-danger mt-5">{error}</div>;

    return (
        <div className='Container-fluid'>
            <Header />
            <div className="container mt-4 wow-form">
                <div className="card shadow-lg p-4 animate__animated animate__fadeInUp">
                    <div className="card-header bg-primary text-white">
                        <h5 className="card-title mb-0">Journal Voucher Entry</h5>
                    </div>
                    <div className="card-body">
                        <form id='journalForm' onSubmit={(e) => {
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
                                        value={nextBillNumber}
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
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleKeyDown(e, 'description');
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Journal Entries Table */}
                            <div className="mb-4">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <h6 className="text-primary">Journal Entries</h6>
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
                                                        />
                                                        {entry.debitAccountId && (
                                                            <div className="mt-1">
                                                                <AccountBalanceDisplay
                                                                    accountId={entry.debitAccountId}
                                                                    api={api}
                                                                    newTransactionAmount={accountTotals[entry.debitAccountId] || 0}
                                                                    compact={true}
                                                                    transactionType="payment" // Debit increases account balance
                                                                    dateFormat={companyDateFormat}
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
                                                        />
                                                        {entry.creditAccountId && (
                                                            <div className="mt-1">
                                                                <AccountBalanceDisplay
                                                                    accountId={entry.creditAccountId}
                                                                    api={api}
                                                                    newTransactionAmount={accountTotals[entry.creditAccountId] || 0}
                                                                    compact={true}
                                                                    transactionType="receipt" // Credit decreases account balance
                                                                    dateFormat={companyDateFormat}
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
                                        disabled={isSaving || calculateTotal('debit') !== calculateTotal('credit')}
                                    >
                                        {isSaving ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-save me-2"></i>
                                                Save Voucher
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => handleSubmit(true)}
                                        disabled={isSaving || calculateTotal('debit') !== calculateTotal('credit')}
                                    >
                                        <i className="fas fa-print me-2"></i> Save & Print
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Account Modal */}
            {showAccountModal && (
                <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block' }}>
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
                                                            <strong>{account.code || 'N/A'} {account.name}</strong>
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
                                                                <strong>{account.uniqueNumber || 'N/A'} {account.name}</strong>
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

export default AddJournalVoucher;