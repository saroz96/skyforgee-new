import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';
import NotificationToast from '../../NotificationToast';
import Header from '../Header';
import AccountBalanceDisplay from './AccountBalanceDisplay';

const AddPayment = () => {
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [printData, setPrintData] = useState(null);
    const printableRef = useRef();
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const [dateErrors, setDateErrors] = useState({
        transactionDateNepali: '',
        nepaliDate: ''
    });
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [formData, setFormData] = useState({
        billDate: new Date().toISOString().split('T')[0],
        nepaliDate: currentNepaliDate,
        paymentAccount: '',
        accountId: '',
        debit: '',
        InstType: 'N/A',
        InstNo: '',
        description: ''
    });
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success' // or 'error'
    });
    const [accounts, setAccounts] = useState([]);
    const accountSearchRef = useRef(null);
    const [cashAccounts, setCashAccounts] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [nextBillNumber, setNextBillNumber] = useState('');
    const [companyDateFormat, setCompanyDateFormat] = useState('nepali');
    const [showBankDetails, setShowBankDetails] = useState(false);
    const [error, setError] = useState(null);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [filteredAccounts, setFilteredAccounts] = useState([]);
    const [selectedAccountIndex, setSelectedAccountIndex] = useState(0);
    const searchRef = useRef(null);
    const accountListRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });


    useEffect(() => {
        const fetchPaymentFormData = async () => {
            try {
                const response = await api.get('/api/retailer/payments');
                const { data } = response;

                setAccounts(data.data.accounts);
                setCashAccounts(data.data.cashAccounts);
                setBankAccounts(data.data.bankAccounts);
                setNextBillNumber(data.data.nextBillNumber);
                setCompanyDateFormat(data.data.companyDateFormat);
                setFormData(prev => ({
                    ...prev,
                    paymentAccount: data.data.cashAccounts[0]?._id || '',
                    billNumber: data.data.nextBillNumber
                }));
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load payment form');
            }
        };

        fetchPaymentFormData();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePaymentAccountChange = (e) => {
        const selectedValue = e.target.value;
        const selectedOption = e.target.options[e.target.selectedIndex];
        const isBankAccount = selectedOption.getAttribute('data-group') === 'bank';

        setShowBankDetails(isBankAccount);
        setFormData(prev => ({ ...prev, paymentAccount: selectedValue }));
    };

    const resetForm = () => {
        // Get the current date values to preserve them
        const currentDate = new Date().toISOString().split('T')[0];
        // const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');

        // Reset form while preserving dates and payment mode
        setFormData({
            billDate: currentDate,
            nepaliDate: currentNepaliDate,
            paymentAccount: cashAccounts[0]?._id || '', // Reset to first cash account
            accountId: '',
            accountName: '',
            debit: '',
            InstType: 'N/A',
            InstNo: '',
            description: '',
            billNumber: nextBillNumber // Keep the current bill number
        });

        // Reset other UI states
        setShowBankDetails(false);
    };

    const handleSubmit = async (print = false) => {
        setIsSaving(true);

        try {
            const payload = {
                ...formData,
                print
            };

            const response = await api.post('/api/retailer/payments', payload);

            setNotification({
                show: true,
                message: 'Payment saved successfully!',
                type: 'success'
            });

            // After successful save, refetch the initial form data
            try {
                const formDataResponse = await api.get('/api/retailer/payments');
                const { data } = formDataResponse;

                setNextBillNumber(data.data.nextBillNumber);
                const currentDate = new Date().toISOString().split('T')[0];
                // const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');

                // Check if the selected payment account is a bank account
                const isBankAccount = data.data.bankAccounts.some(
                    account => account._id === formData.paymentAccount
                );

                setFormData(prev => ({
                    ...prev,
                    billDate: currentDate,
                    nepaliDate: currentNepaliDate,
                    billNumber: data.data.nextBillNumber,
                    accountId: '',
                    accountName: '',
                    debit: '',
                    InstType: 'N/A',
                    InstNo: '',
                    description: ''
                }));

                // Set showBankDetails based on payment account type
                setShowBankDetails(isBankAccount);

                // If print was requested, fetch print data and print immediately
                if (print && response.data.data?.payment?._id) {
                    try {
                        const printResponse = await api.get(`/api/retailer/payments/${response.data.data.payment._id}/print`);
                        printVoucherImmediately(printResponse.data.data);
                    } catch (printError) {
                        console.error('Error fetching print data:', printError);
                        setNotification({
                            show: true,
                            message: 'Payment saved but failed to load print data',
                            type: 'warning'
                        });
                    }
                } else {
                    // Move focus to date input field
                    setTimeout(() => {
                        const dateInputId = companyDateFormat === 'nepali' ? 'nepaliDate' : 'billDate';
                        document.getElementById(dateInputId)?.focus();
                    }, 0);
                }
            } catch (err) {
                console.error('Error refetching form data:', err);
                resetForm();
            }
        } catch (err) {
            setNotification({
                show: true,
                message: err.response?.data?.message || 'Failed to save payment',
                type: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Account modal functions
    const openAccountModal = () => {
        setShowAccountModal(true);
        setFilteredAccounts(accounts);
        setTimeout(() => searchRef.current?.focus(), 100);
    };

    const handleAccountSearch = (e) => {
        const searchText = e.target.value.toLowerCase();
        const filtered = accounts.filter(account =>
            account.name.toLowerCase().includes(searchText) ||
            (account.uniqueNumber && account.uniqueNumber.toString().toLowerCase().includes(searchText))
        );
        setFilteredAccounts(filtered);
        setSelectedAccountIndex(0);
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

    const handleAccountKeyDown = (e) => {
        if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
            e.preventDefault();

            if (e.key === 'ArrowDown' && selectedAccountIndex < filteredAccounts.length - 1) {
                setSelectedAccountIndex(prev => prev + 1);
            } else if (e.key === 'ArrowUp' && selectedAccountIndex > 0) {
                setSelectedAccountIndex(prev => prev - 1);
            } else if (e.key === 'Enter' && filteredAccounts.length > 0) {
                selectAccount(filteredAccounts[selectedAccountIndex]);
            }

            // Scroll to selected item
            if (accountListRef.current) {
                const selectedItem = accountListRef.current.children[selectedAccountIndex];
                if (selectedItem) {
                    selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    };

    const selectAccount = (account) => {
        setFormData(prev => ({
            ...prev,
            accountId: account._id,
            accountName: `${account.uniqueNumber || ''} ${account.name}`.trim(),
        }));
        setSelectedAccountId(account._id);
        setShowAccountModal(false);
        document.getElementById('debit')?.focus();
    };

    if (error) return <div className="alert alert-danger mt-5">{error}</div>;

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
                    <div class="print-voucher-title">PAYMENT VOUCHER</div>
                </div>

                <div class="print-voucher-details">
                    <div>
                        <div><strong>Vch. No:</strong> ${printData.payment.billNumber}</div>
                    </div>
                    <div>
                        <div><strong>Date:</strong> ${new Date(printData.payment.date).toLocaleDateString()}</div>
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
                        <tr>
                            <td>1</td>
                            <td>${printData.payment.account?.name || 'N/A'}</td>
                            <td>${printData.payment.debit?.toFixed(2)}</td>
                            <td>0.00</td>
                        </tr>
                        <tr>
                            <td>2</td>
                            <td>${printData.payment.paymentAccount?.name || 'N/A'}</td>
                            <td>0.00</td>
                            <td>${printData.payment.debit?.toFixed(2)}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colSpan="2">Total</th>
                            <th>${printData.payment.debit?.toFixed(2)}</th>
                            <th>${printData.payment.debit?.toFixed(2)}</th>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 3mm;">
                    <strong>Note:</strong> ${printData.payment.description || 'N/A'}
                </div>

                <div style="margin-top: 3mm;">
                    <div><strong>Mode of Payment:</strong> ${printData.payment.InstType || 'N/A'}</div>
                    <div><strong>Inst No:</strong> ${printData.payment.InstNo || 'N/A'}</div>
                </div>

                <div class="print-signature-area">
                    <div class="print-signature-box">
                        <div style="margin-bottom: 1mm;">
                            <strong>${printData.payment.user?.name || 'N/A'}</strong>
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
                <title>Payment_Voucher_${printData.payment.billNumber}</title>
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

    return (
        <div className='Container-fluid'>
            <Header />
            <div className="container mt-4 wow-form">
                <div className="card shadow-lg p-4 animate__animated animate__fadeInUp">
                    <div className="card-header">
                        <h5 className="card-title">Payment Entry</h5>
                    </div>
                    <div className="card-body">
                        <form className="wow-form" id='billForm' onSubmit={(e) => {
                            e.preventDefault();
                            handleSubmit(false); // Regular save
                        }}>
                            {/* Date Input */}
                            <div className="form-group row mb-3">
                                {companyDateFormat === 'nepali' ? (
                                    <div className="col">
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
                                    <div className="col">
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

                                <div className="col">
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

                                <div className="col">
                                    <label htmlFor="accountType">A/c Type:</label>
                                    <input
                                        type="text"
                                        name="accountType"
                                        id="accountType"
                                        className="form-control"
                                        value="Payment"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleKeyDown(e, 'accountType');
                                            }
                                        }}
                                        readOnly
                                    />
                                </div>
                            </div>

                            {/* Payment Mode Selector */}
                            <div className="form-group mb-3">
                                <label htmlFor="paymentAccount">Payment Mode:</label>
                                <select
                                    name="paymentAccount"
                                    id="paymentAccount"
                                    className="form-control"
                                    required
                                    value={formData.paymentAccount}
                                    onChange={handlePaymentAccountChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'paymentAccount');
                                        }
                                    }}
                                >
                                    <optgroup label="Cash">
                                        {cashAccounts.map(cashAccount => (
                                            <option
                                                key={cashAccount._id}
                                                value={cashAccount._id}
                                                data-group="cash"
                                            >
                                                {cashAccount.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Bank">
                                        {bankAccounts.map(bankAccount => (
                                            <option
                                                key={bankAccount._id}
                                                value={bankAccount._id}
                                                data-group="bank"
                                            >
                                                {bankAccount.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            {/* Dynamic Rows for Account and Amount */}
                            <div id="rowsContainer" className="mb-3">
                                <div className="row payment-row g-2 align-items-end">
                                    {/* Account Selection Input */}
                                    <div className="col-md-5 col-12">
                                        <label htmlFor="account" className="form-label">Party Name:</label>
                                        <input
                                            type="text"
                                            id="account"
                                            name="account"
                                            className="form-control"
                                            autoComplete='off'
                                            placeholder=""
                                            value={formData.accountName || ''}
                                            onFocus={openAccountModal}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'account');
                                                }
                                            }}
                                            readOnly
                                        />
                                        <input
                                            type="hidden"
                                            id="accountId"
                                            name="accountId"
                                            value={formData.accountId}
                                        />
                                    </div>

                                    {/* Amount Input */}
                                    <div className="col-md-2 col-6">
                                        <label htmlFor="debit" className="form-label">Amount:</label>
                                        <input
                                            type="number"
                                            name="debit"
                                            id="debit"
                                            className="form-control"
                                            placeholder="Debit Amount"
                                            value={formData.debit}
                                            onChange={handleInputChange}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'debit');
                                                }
                                            }}
                                            required
                                        />
                                    </div>

                                    {/* Institution Type and Number */}
                                    {showBankDetails && (
                                        <div className="bank-details col-md-5 col-12">
                                            <div className="row g-2">
                                                <div className="col-md-6 col-6">
                                                    <label htmlFor="InstType" className="form-label">Inst. Type</label>
                                                    <select
                                                        name="InstType"
                                                        id="InstType"
                                                        className="form-control"
                                                        value={formData.InstType}
                                                        onChange={handleInputChange}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleKeyDown(e, 'InstType');
                                                            }
                                                        }}
                                                    >
                                                        <option value="N/A">N/A</option>
                                                        <option value="RTGS">RTGS</option>
                                                        <option value="Fonepay">Fonepay</option>
                                                        <option value="Cheque">Cheque</option>
                                                        <option value="Connect-Ips">Connect-Ips</option>
                                                        <option value="Esewa">Esewa</option>
                                                        <option value="Khalti">Khalti</option>
                                                    </select>
                                                </div>

                                                <div className="col-md-6 col-6">
                                                    <label htmlFor="InstNo" className="form-label">Inst. No.</label>
                                                    <input
                                                        type="text"
                                                        name="InstNo"
                                                        id="InstNo"
                                                        className="form-control"
                                                        value={formData.InstNo}
                                                        onChange={handleInputChange}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleKeyDown(e, 'InstNo');
                                                            }
                                                        }}
                                                        autoComplete='off'
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {formData.accountId && (
                                <span className="input-group-text bg-light">
                                    <AccountBalanceDisplay
                                        accountId={formData.accountId}
                                        api={api}
                                        newTransactionAmount={parseFloat(formData.debit) || 0}
                                        compact={true}
                                        transactionType="payment" // Add this prop
                                        dateFormat={companyDateFormat}
                                    />
                                </span>
                            )}
                            <br/>
                            <div className="d-flex justify-content-between">
                                <div className="col">
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="description"
                                        id="description"
                                        placeholder="Description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                document.getElementById('saveBill')?.focus();
                                            }
                                        }}
                                        autoComplete='off'
                                    />
                                </div>
                                <div style={{ float: 'right' }}>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        onClick={() => handleSubmit(false)}
                                        disabled={isSaving}
                                        id="saveBill"
                                    >
                                        {isSaving ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Saving...
                                            </>
                                        ) : (
                                            <i className="bi bi-save"></i>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary ms-2"
                                        onClick={() => handleSubmit(true)}
                                        disabled={isSaving}
                                    >
                                        <i className="fas fa-print"></i> Save & Print
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
                                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item');
                                            if (firstAccountItem) {
                                                firstAccountItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item.active');
                                            if (firstAccountItem) {
                                                const accountId = firstAccountItem.getAttribute('data-account-id');
                                                const account = filteredAccounts.length > 0
                                                    ? filteredAccounts.find(a => a._id === accountId)
                                                    : accounts.find(a => a._id === accountId);
                                                if (account) {
                                                    selectAccount(account);
                                                    // document.getElementById('address').focus();
                                                }
                                            }
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
                                                        className={`list-group-item account-item py-2 ${index === 0 ? 'active' : ''}`}
                                                        onClick={() => {
                                                            selectAccount(account);
                                                            // document.getElementById('address').focus();
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
                                                                // document.getElementById('address').focus();
                                                            }
                                                        }}
                                                        onFocus={(e) => {
                                                            // Remove active class from all items and add to focused one
                                                            document.querySelectorAll('.account-item').forEach(item => {
                                                                item.classList.remove('active');
                                                            });
                                                            e.target.classList.add('active');
                                                        }}
                                                    >
                                                        <div className="d-flex justify-content-between small">
                                                            <strong>{account.uniqueNumber || 'N/A'} {account.name}</strong>
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
                                                    .map((account, index) => (
                                                        <li
                                                            key={account._id}
                                                            data-account-id={account._id}
                                                            className={`list-group-item account-item py-2 ${index === 0 ? 'active' : ''}`}
                                                            onClick={() => {
                                                                selectAccount(account);
                                                                // document.getElementById('address').focus();
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
                                                                    // document.getElementById('address').focus();
                                                                }
                                                            }}
                                                            onFocus={(e) => {
                                                                // Remove active class from all items and add to focused one
                                                                document.querySelectorAll('.account-item').forEach(item => {
                                                                    item.classList.remove('active');
                                                                });
                                                                e.target.classList.add('active');
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
        </div>
    );
};

export default AddPayment;