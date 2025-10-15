import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Select from 'react-select';
import Header from '../Header';
import NepaliDate from 'nepali-date-converter';
import Loader from '../../Loader';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';

const DayWiseAgeing = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];
    const { draftSave, setDraftSave } = usePageNotRefreshContext();

    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        fiscalYear: {}
    });

    const [formData, setFormData] = useState(() => {
        if (draftSave && draftSave.dayWiseAgeingData) {
            return draftSave.dayWiseAgeingData;
        }
        return {
            accountId: '',
            fromDate: '',
            toDate: '',
            companyDateFormat: 'english'
        };
    });

    const [selectedRowIndex, setSelectedRowIndex] = useState(0);
    const tableBodyRef = useRef(null);

    const fromDateRef = useRef(null);
    const toDateRef = useRef(null);

    // Fetch company and fiscal year info when component mounts
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await axios.get('/api/my-company');
                if (response.data.success) {
                    const { company: companyData, currentFiscalYear } = response.data;

                    // Set company info
                    const dateFormat = companyData.dateFormat || 'english';
                    setCompany({
                        dateFormat,
                        fiscalYear: currentFiscalYear || {}
                    });

                    // Set dates based on fiscal year
                    if (currentFiscalYear?.startDate) {
                        setFormData(prev => ({
                            ...prev,
                            fromDate: dateFormat === 'nepali'
                                ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
                                : new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD'),
                            toDate: dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
                            companyDateFormat: dateFormat
                        }));
                    }
                }
            } catch (err) {
                console.error('Error fetching initial data:', err);
            }
        };

        fetchInitialData();
    }, []);

    // Save draft data
    useEffect(() => {
        if (formData.accountId || formData.fromDate || formData.toDate) {
            setDraftSave({
                ...draftSave,
                dayWiseAgeingData: formData
            });
        }
    }, [formData]);

    const formatDisplayDate = (dateString) => {
        if (!dateString) return '';

        if (company.dateFormat === 'nepali') {
            // Custom formatting for Nepali date display
            return dateString; // or format as needed
        }

        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Fetch accounts on component mount
    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/retailer/day-count-aging');
            if (response.data.success) {
                setData(response.data.data);
            }
        } catch (err) {
            setError('Failed to fetch accounts');
            console.error('Error fetching accounts:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.accountId || !formData.fromDate || !formData.toDate) {
            setError('Please fill all required fields');
            return;
        }

        try {
            setLoading(true);
            setError('');
            const response = await axios.get('/api/retailer/day-count-aging', {
                params: formData
            });

            if (response.data.success) {
                setData(response.data.data);
                setSelectedRowIndex(0);
            } else {
                setError(response.data.error || 'Failed to generate report');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate report');
            console.error('Error generating report:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!data?.agingData?.transactions?.length) return;

            const activeElement = document.activeElement;
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(activeElement.tagName)) return;

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.max(0, prev - 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.min(data.agingData.transactions.length - 1, prev + 1));
                    break;
                case 'Enter':
                    // Handle enter action if needed
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [data?.agingData?.transactions]);

    // Scroll to selected row
    useEffect(() => {
        if (tableBodyRef.current && data?.agingData?.transactions?.length > 0) {
            const rows = tableBodyRef.current.querySelectorAll('tr');
            if (rows.length > selectedRowIndex) {
                rows[selectedRowIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, data?.agingData?.transactions]);

    const printReport = () => {
        if (!data?.agingData?.transactions?.length) {
            alert('No data available to print');
            return;
        }

        const printWindow = window.open("", "_blank");

        const getMonthName = (dateString, dateFormat) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            const month = date.getMonth();

            const englishMonths = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

            const nepaliMonths = ["Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
                "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];

            return dateFormat === "nepali" ? nepaliMonths[month] : englishMonths[month];
        };

        const getYear = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.getFullYear();
        };

        const getOpeningBalance = () => {
            const openingBalance = data?.account?.initialOpeningBalance?.amount || data?.agingData?.openingBalance;
            const balanceType = data?.account?.initialOpeningBalance?.type || data?.agingData?.openingBalanceType;

            if (openingBalance === undefined || openingBalance === null) return 'N/A';

            const formattedAmount = formatCurrency(Math.abs(openingBalance));
            return balanceType === 'credit' || openingBalance >= 0
                ? `${formattedAmount} Cr`
                : `${formattedAmount} Dr`;
        };

        const printContent = `
        <style>
            @page { 
                size: A4 landscape; 
                margin: 10mm; 
            }
            body { 
                font-family: Arial, sans-serif; 
                font-size: 10px; 
                margin: 0; 
                padding: 5mm; 
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                page-break-inside: auto;
                font-size: 12px 
            }
            th, td { 
                border: 1px solid #000; 
                padding: 4px; 
                text-align: left; 
            }
            th { 
                background-color: #f2f2f2; 
            }
            .print-header { 
                text-align: center; 
                margin-bottom: 15px; 
            }
            .text-end { 
                text-align: right; 
            }
            .report-period {
                display: flex;
                justify-content: space-between;
                margin-bottom: 15px;
            }
            .report-title {
                text-align: center;
                text-decoration: underline;
                margin-bottom: 10px;
            }
        </style>
        
        <div class="print-header">
            <h1>${data.currentCompanyName}</h1>
            <h2 class="report-title">Ageing Report</h2>
            <div class="report-period">
                <div><strong>Account:</strong> ${data.account.name}
            </div>
            <div>
                    <strong>From:</strong> ${formatDisplayDate(formData.fromDate)} 
                    <strong>To:</strong> ${formatDisplayDate(formData.toDate)}
            </div>
            <div>
                    <strong>Printed:</strong> ${new Date().toLocaleString()}
            </div>
        </div>
                <div class="text-end"><strong>Opening:</strong> ${getOpeningBalance()}</div>        
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Age (Days)</th>
                    <th>Vch. No.</th>
                    <th>Particulars</th>
                    <th class="text-end">Debit</th>
                    <th class="text-end">Credit</th>
                    <th class="text-end">Balance</th>
                </tr>
            </thead>
            <tbody>
                ${data.agingData.transactions.map(transaction => `
                    <tr>
                        <td>${formatDate(transaction.date)}</td>
                        <td>${transaction.age} days</td>
                        <td>${transaction.referenceNumber}</td>
                        <td>${getTransactionTypeLabel(transaction.type)}</td>
                        <td class="text-end">${formatCurrency(transaction.debit)}</td>
                        <td class="text-end">${formatCurrency(transaction.credit)}</td>
                        <td class="text-end">${formatBalance(transaction.balance)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

        printWindow.document.write(`
        <html>
            <head>
                <title>Ageing Report - ${data.account.name}</title>
            </head>
            <body>
                ${printContent}
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        };
                    }
                </script>
            </body>
        </html>
    `);
        printWindow.document.close();
    };

    const exportToExcel = () => {
        alert('Excel export functionality');
    };

    const exportToPDF = () => {
        alert('PDF export functionality');
    };

    const exportToCSV = () => {
        alert('CSV export functionality');
    };

    const getTransactionIcon = (type) => {
        const icons = {
            sales: 'fas fa-file-invoice-dollar text-primary',
            purchase: 'fas fa-shopping-cart text-info',
            purchase_return: 'fas fa-undo text-warning',
            sales_return: 'fas fa-exchange-alt text-danger',
            payment: 'fas fa-money-bill-wave text-success',
            receipt: 'fas fa-hand-holding-usd text-success',
            debit_note: 'fas fa-file-alt text-danger',
            credit_note: 'fas fa-file-alt text-success',
            journal: 'fas fa-book text-secondary'
        };
        return icons[type] || 'fas fa-file-alt text-secondary';
    };

    const getTransactionTypeLabel = (type) => {
        const labels = {
            sales: 'Sale',
            purchase: 'Purchase',
            purchase_return: 'Purchase Return',
            sales_return: 'Sales Return',
            payment: 'Payment',
            receipt: 'Receipt',
            debit_note: 'Debit Note',
            credit_note: 'Credit Note',
            journal: 'Journal'
        };
        return labels[type] || 'Transaction';
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';

        if (company.dateFormat === 'nepali') {
            try {
                // For Nepali dates, you might want to convert or display differently
                // This is a simple implementation
                return new NepaliDate(dateString).format('YYYY-MM-DD');
            } catch (error) {
                return dateString;
            }
        }

        // For English dates
        return new Date(dateString).toISOString().split('T')[0];
    };

    const formatCurrency = (num) => {
        const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
        if (company.dateFormat === 'nepali') {
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
    };

    const formatBalance = (balance) => {
        const formattedBalance = formatCurrency(Math.abs(balance));
        return balance >= 0
            ? `${formattedBalance} Cr`
            : `${formattedBalance} Dr`;
    };

    // Calculate aging summary
    const getAgingSummary = () => {
        if (!data?.agingData?.transactions) return [];

        const transactions = data.agingData.transactions;
        return [
            {
                range: '0-30 days',
                count: transactions.filter(t => t.age <= 30).length,
                variant: 'primary'
            },
            {
                range: '31-60 days',
                count: transactions.filter(t => t.age > 30 && t.age <= 60).length,
                variant: 'info'
            },
            {
                range: '61-90 days',
                count: transactions.filter(t => t.age > 60 && t.age <= 90).length,
                variant: 'warning'
            },
            {
                range: '90+ days',
                count: transactions.filter(t => t.age > 90).length,
                variant: 'danger'
            }
        ];
    };

    const handleRowClick = (index) => {
        setSelectedRowIndex(index);
    };

    const handleKeyDown = (e, nextFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextFieldId) {
                document.getElementById(nextFieldId)?.focus();
            }
        }
    };

    if (loading) return <Loader />;

    return (
        <div className="container-fluid">
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-3">
                    <h1 className="h3 mb-0 text-center text-primary">Ageing Receivables/Payables</h1>
                </div>
                <div className="card shadow-lg">
                    <div className="card-body">
                        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-light rounded">
                            <div className="row">
                                {/* Account Selection */}
                                <div className="col-md-3">
                                    <div className="form-group">
                                        <label className="form-label">Account:</label>
                                        <Select
                                            options={data?.accounts?.map(acc => ({
                                                value: acc._id,
                                                label: acc.name
                                            })) || []}
                                            value={data?.accounts?.find(acc => acc._id === formData.accountId)
                                                ? { value: formData.accountId, label: data.accounts.find(acc => acc._id === formData.accountId).name }
                                                : null
                                            }
                                            onChange={(selected) => handleInputChange('accountId', selected?.value || '')}
                                            placeholder="Select Account"
                                            isClearable
                                            isLoading={loading}
                                        />
                                    </div>
                                </div>

                                {/* Date Range */}
                                <div className="col-md-2">
                                    <div className="form-group">
                                        <label className="form-label">From Date:</label>
                                        <input
                                            type="text"
                                            className="form-control no-date-icon"
                                            value={formData.fromDate}
                                            onChange={(e) => handleInputChange('fromDate', e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, 'toDate')}
                                            ref={company.dateFormat === 'nepali' ? fromDateRef : null}
                                            required
                                            autoComplete='off'
                                        />
                                    </div>
                                </div>

                                <div className="col-md-2">
                                    <div className="form-group">
                                        <label className="form-label">To Date:</label>
                                        <input
                                            type="text"
                                            id="toDate"
                                            className="form-control no-date-icon"
                                            value={formData.toDate}
                                            onChange={(e) => handleInputChange('toDate', e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, 'generateReport')}
                                            ref={toDateRef}
                                            required
                                            autoComplete='off'
                                        />
                                    </div>
                                </div>

                                <div className="col-md-2">
                                    <div className="form-group" style={{ marginTop: '25px' }}>
                                        <button
                                            id="generateReport"
                                            type="submit"
                                            className="btn btn-primary w-100"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-chart-line me-2" />
                                                    Generate Report
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="col-md-2">
                                    <div className="form-group" style={{ marginTop: '25px' }}>
                                        <button
                                            type="button"
                                            className="btn btn-info w-100"
                                            onClick={printReport}
                                            disabled={!data?.agingData?.transactions?.length}
                                        >
                                            <i className="fas fa-print me-2" /> Print Report
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                        {error && (
                            <div className="alert alert-danger text-center">
                                <i className="fas fa-exclamation-circle me-2" /> {error}
                            </div>
                        )}

                        {!formData.accountId && (
                            <div className="alert alert-info text-center">
                                <i className="fas fa-info-circle me-2" /> Please select an account and date range to generate report
                            </div>
                        )}

                        {formData.accountId && (!formData.fromDate || !formData.toDate) && (
                            <div className="alert alert-info text-center">
                                <i className="fas fa-info-circle me-2" /> Please select date range to generate report
                            </div>
                        )}

                        {data?.agingData?.transactions?.length === 0 && formData.fromDate && formData.toDate && (
                            <div className="alert alert-warning text-center">
                                <i className="fas fa-exclamation-circle me-2" /> No transactions found for the selected account and date range
                            </div>
                        )}

                        {data?.agingData?.transactions?.length > 0 && (
                            <div id="printableContent">

                                {/* Account Info */}
                                <div className="mb-4">
                                    <h4 className="text-primary no-print">
                                        <i className="fas fa-user-circle me-2" /> Account: {data.account.name}
                                    </h4>
                                    <div className="d-flex justify-content-between no-print">
                                        <div>
                                            <strong>Report Period:</strong>{' '}
                                            {formatDate(data.fromDate)} to {formatDate(data.toDate)}
                                        </div>
                                        <div>
                                            <strong>Opening:</strong>{' '}
                                            <span className="font-weight-bold">
                                                {data?.account?.initialOpeningBalance?.amount?.toFixed(2) || data?.agingData?.openingBalance?.toFixed(2)}
                                                {' '}
                                                {data?.account?.initialOpeningBalance?.type || data?.agingData?.openingBalanceType}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Transactions Table */}
                                <div className="table-responsive">
                                    <table className="table table-striped table-hover">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Date</th>
                                                <th>Age (Days)</th>
                                                <th>Vch. No.</th>
                                                <th>Particulars</th>
                                                <th className="text-end">Debit</th>
                                                <th className="text-end">Credit</th>
                                                <th className="text-end">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody ref={tableBodyRef}>
                                            {data.agingData.transactions.map((transaction, index) => (
                                                <tr
                                                    key={transaction._id}
                                                    className={selectedRowIndex === index ? 'highlighted-row' : ''}
                                                    onClick={() => handleRowClick(index)}
                                                >
                                                    <td>{formatDate(transaction.date)}</td>
                                                    <td>{transaction.age} days</td>
                                                    <td>{transaction.referenceNumber}</td>
                                                    <td>
                                                        <i className={getTransactionIcon(transaction.type)} />{' '}
                                                        {getTransactionTypeLabel(transaction.type)}
                                                        {transaction.referenceNumber !== 'N/A'}
                                                    </td>
                                                    <td className="text-end text-danger">
                                                        {formatCurrency(transaction.debit)}
                                                    </td>
                                                    <td className="text-end text-success">
                                                        {formatCurrency(transaction.credit)}
                                                    </td>
                                                    <td className="text-end font-weight-bold">
                                                        {formatBalance(transaction.balance)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Summary and Export Options */}
                                <div className="mt-4 no-print">
                                    <div className="row">
                                        <div className="col-md-4">
                                            <div className="card bg-light">
                                                <div className="card-body">
                                                    <h5 className="card-title">Aging Summary</h5>
                                                    <div className="list-group list-group-flush">
                                                        {getAgingSummary().map((item, index) => (
                                                            <div
                                                                key={index}
                                                                className="list-group-item d-flex justify-content-between align-items-center"
                                                            >
                                                                {item.range}
                                                                <span className={`badge bg-${item.variant} rounded-pill`}>
                                                                    {item.count}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-md-8">
                                            <div className="card">
                                                <div className="card-body">
                                                    <h5 className="card-title">Export Options</h5>
                                                    <button
                                                        className="btn btn-outline-success me-2"
                                                        onClick={exportToExcel}
                                                    >
                                                        <i className="fas fa-file-excel me-2" /> Export to Excel
                                                    </button>
                                                    <button
                                                        className="btn btn-outline-danger me-2"
                                                        onClick={exportToPDF}
                                                    >
                                                        <i className="fas fa-file-pdf me-2" /> Export to PDF
                                                    </button>
                                                    <button
                                                        className="btn btn-outline-secondary"
                                                        onClick={exportToCSV}
                                                    >
                                                        <i className="fas fa-file-csv me-2" /> Export to CSV
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DayWiseAgeing;