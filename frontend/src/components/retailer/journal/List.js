import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../Header';
import NepaliDate from 'nepali-date-converter';
import Loader from '../../Loader';

const JournalList = () => {
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];

    const [data, setData] = useState({
        company: null,
        currentFiscalYear: null,
        journalVouchers: [],
        currentCompanyName: '',
        user: null,
        isAdminOrSupervisor: false
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalDebit, setTotalDebit] = useState(0);
    const [totalCredit, setTotalCredit] = useState(0);
    const [selectedRowIndex, setSelectedRowIndex] = useState(0);
    const [filteredVouchers, setFilteredVouchers] = useState([]);

    const tableBodyRef = useRef(null);
    const navigate = useNavigate();

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Fetch data when component mounts
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await api.get('/api/retailer/journal/register');
                if (response.data.success) {
                    setData(response.data.data);
                    setError(null);
                } else {
                    setError(response.data.error || 'Failed to fetch journal vouchers');
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch journal vouchers');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter vouchers based on search query
    useEffect(() => {
        const filtered = data.journalVouchers.filter(voucher => {
            const matchesSearch =
                voucher.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                voucher.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                voucher.debitAccounts.some(da =>
                    da.account?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                ) ||
                voucher.creditAccounts.some(ca =>
                    ca.account?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                ) ||
                voucher.debitAccounts.some(da =>
                    da.debit?.toString().includes(searchQuery)
                ) ||
                voucher.creditAccounts.some(ca =>
                    ca.credit?.toString().includes(searchQuery)
                );

            return matchesSearch;
        });

        setFilteredVouchers(filtered);
        // Reset selected row when filters change
        setSelectedRowIndex(0);
    }, [data.journalVouchers, searchQuery]);

    // Calculate totals when filtered vouchers change
    useEffect(() => {
        if (filteredVouchers.length === 0) {
            setTotalDebit(0);
            setTotalCredit(0);
            return;
        }

        const newTotalDebit = filteredVouchers.reduce((acc, voucher) => {
            if (!voucher.isActive) return acc;
            return acc + voucher.debitAccounts.reduce((sum, da) => sum + (da.debit || 0), 0);
        }, 0);

        const newTotalCredit = filteredVouchers.reduce((acc, voucher) => {
            if (!voucher.isActive) return acc;
            return acc + voucher.creditAccounts.reduce((sum, ca) => sum + (ca.credit || 0), 0);
        }, 0);

        setTotalDebit(newTotalDebit);
        setTotalCredit(newTotalCredit);
    }, [filteredVouchers]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (filteredVouchers.length === 0) return;

            // Check if focus is inside an input element
            const activeElement = document.activeElement;
            if (activeElement.tagName === 'INPUT') {
                return;
            }

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.max(0, prev - 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.min(filteredVouchers.length - 1, prev + 1));
                    break;
                case 'Enter':
                    if (selectedRowIndex >= 0 && selectedRowIndex < filteredVouchers.length) {
                        navigate(`/retailer/journal/${filteredVouchers[selectedRowIndex]._id}/print`);
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredVouchers, selectedRowIndex, navigate]);

    // Scroll to selected row
    useEffect(() => {
        if (tableBodyRef.current && filteredVouchers.length > 0) {
            const rows = tableBodyRef.current.querySelectorAll('tr');
            if (rows.length > selectedRowIndex) {
                rows[selectedRowIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, filteredVouchers]);

    // Helper function to format account names with commas
    const formatAccountNames = (accounts) => {
        return accounts.map(account => account.account?.name || 'N/A').join(', ');
    };

    // Helper function to format amounts with commas
    const formatAmounts = (accounts, amountType) => {
        return accounts.map(account => account[amountType] || 0).join(', ');
    };

    const handlePrint = (filtered = false) => {
        const vouchersToPrint = filtered ? filteredVouchers : data.journalVouchers;

        if (vouchersToPrint.length === 0) {
            alert("No journal vouchers to print");
            return;
        }

        const printWindow = window.open("", "_blank");

        // Create PAN/VAT number display with bordered digits
        const panVatNo = data.company?.pan || '';
        let panVatHtml = '';
        for (let i = 0; i < panVatNo.length; i++) {
            panVatHtml += `<span style="border: 1px solid black; padding: 1px 2px; margin: 0 1px;">${panVatNo[i]}</span>`;
        }

        const printHeader = `
             <div class="print-header">
                <h1>${data.currentCompanyName || 'Company Name'}</h1>
                <p>
                    ${data.currentCompany?.address || ''}-${data.currentCompany?.ward || ''}, ${data.currentCompany?.city || ''},
                    ${data.currentCompany?.country || ''}<br>
                    TPIN: ${data.currentCompany?.pan || ''}
                </p>
                <hr>
            </div>
        `;

        let tableContent = `
        <style>
            @page {
                size: A4 landscape;
                margin: 10mm;
            }
            body { 
                font-family: Arial, sans-serif; 
                font-size: 10px; 
                margin: 0;
                padding: 10mm;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                page-break-inside: auto;
            }
            tr { 
                page-break-inside: avoid; 
                page-break-after: auto; 
            }
            th, td { 
                border: 1px solid #000; 
                padding: 4px; 
                text-align: left; 
            }
            th { 
                background-color: #f2f2f2 !important; 
                -webkit-print-color-adjust: exact; 
            }
            .print-header { 
                text-align: center; 
                margin-bottom: 15px; 
            }
            .badge-debit {
                background-color: #dc3545;
                color: white;
                padding: 2px 4px;
                border-radius: 3px;
            }
            .badge-credit {
                background-color: #28a745;
                color: white;
                padding: 2px 4px;
                border-radius: 3px;
            }
            .text-danger {
                color: #dc3545 !important;
            }
        </style>
        ${printHeader}
        <h1 style="text-align:center;">Journal Voucher Register's</h1>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Vch.No</th>
                    <th>Debit Accounts</th>
                    <th>Debit (Rs.)</th>
                    <th>Credit Accounts</th>
                    <th>Credit (Rs.)</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
        `;

        let totalDebit = 0;
        let totalCredit = 0;

        vouchersToPrint.forEach(voucher => {
            const isCanceled = !voucher.isActive;

            // Debit accounts HTML
            let debitAccountsHtml = '';
            if (isCanceled) {
                debitAccountsHtml = '<span class="text-danger">Canceled</span>';
            } else {
                debitAccountsHtml = formatAccountNames(voucher.debitAccounts);
            }

            // Debit amounts HTML
            let debitAmountsHtml = '';
            if (isCanceled) {
                debitAmountsHtml = '<span class="text-danger">0.00</span>';
            } else {
                debitAmountsHtml = formatAmounts(voucher.debitAccounts, 'debit');
                totalDebit += voucher.debitAccounts.reduce((sum, da) => sum + (da.debit || 0), 0);
            }

            // Credit accounts HTML
            let creditAccountsHtml = '';
            if (isCanceled) {
                creditAccountsHtml = '<span class="text-danger">Canceled</span>';
            } else {
                creditAccountsHtml = formatAccountNames(voucher.creditAccounts);
            }

            // Credit amounts HTML
            let creditAmountsHtml = '';
            if (isCanceled) {
                creditAmountsHtml = '<span class="text-danger">0.00</span>';
            } else {
                creditAmountsHtml = formatAmounts(voucher.creditAccounts, 'credit');
                totalCredit += voucher.creditAccounts.reduce((sum, ca) => sum + (ca.credit || 0), 0);
            }

            tableContent += `
            <tr>
                <td>${new NepaliDate(voucher.date).format('YYYY-MM-DD')}</td>
                <td>${voucher.billNumber}</td>
                <td>${debitAccountsHtml}</td>
                <td>${debitAmountsHtml}</td>
                <td>${creditAccountsHtml}</td>
                <td>${creditAmountsHtml}</td>
                <td>${voucher.description || ''}</td>
            </tr>
            `;
        });

        // Add totals row
        tableContent += `
            <tr style="font-weight:bold;">
                <td colspan="3">Total:</td>
                <td>${totalDebit.toFixed(2)}</td>
                <td></td>
                <td>${totalCredit.toFixed(2)}</td>
                <td></td>
            </tr>
            </tbody>
        </table>
        `;

        printWindow.document.write(`
        <html>
            <head>
                <title>Journal Voucher Register</title>
            </head>
            <body>
                ${tableContent}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 200);
                    };
                <\/script>
            </body>
        </html>
        `);
        printWindow.document.close();
    };

    const formatCurrency = (num) => {
        return (num || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const handleRowClick = (index) => {
        setSelectedRowIndex(index);
    };

    const handleRowDoubleClick = (voucherId) => {
        navigate(`/journal/${voucherId}/print`);
    };

    if (loading) return <Loader />;

    if (error) {
        return <div className="alert alert-danger text-center py-5">{error}</div>;
    }

    return (
        <div className='container-fluid'>
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-3">
                    <h1 className="h3 mb-0 text-center text-primary">Journal Voucher Register's</h1>
                </div>

                <div className="card-body">
                    {/* Search Section */}
                    <div className="row mb-4">
                        <div className="col-md-8">
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="searchInput" className="form-label">Search</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="searchInput"
                                            placeholder="Search by vch no., amounts, description or account name..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            disabled={data.journalVouchers.length === 0}
                                            autoComplete='off'
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            disabled={data.journalVouchers.length === 0}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="col-md-4 d-flex align-items-end justify-content-end gap-2">
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/retailer/journal')}
                            >
                                <i className="bi bi-receipt me-2"></i>New Voucher
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(false)}
                                disabled={data.journalVouchers.length === 0}
                            >
                                <i className="bi bi-printer me-2"></i>Print All
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(true)}
                                disabled={data.journalVouchers.length === 0}
                            >
                                <i className="bi bi-printer me-2"></i>Print Filtered
                            </button>
                        </div>
                    </div>

                    {data.journalVouchers.length === 0 ? (
                        <div className="alert alert-info text-center py-3">
                            <i className="fas fa-info-circle me-2"></i>
                            No journal vouchers found
                        </div>
                    ) : (
                        <>
                            {/* Journal Vouchers Table */}
                            <div className="table-responsive">
                                <table className="table table-bordered voucher-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Vch.No</th>
                                            <th>Debit Accounts</th>
                                            <th>Debit (Rs.)</th>
                                            <th>Credit Accounts</th>
                                            <th>Credit (Rs.)</th>
                                            <th>Description</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody ref={tableBodyRef}>
                                        {filteredVouchers.map((voucher, index) => (
                                            <tr
                                                key={voucher._id}
                                                className={`${selectedRowIndex === index ? 'highlighted-row' : ''}`}
                                                onClick={() => handleRowClick(index)}
                                                onDoubleClick={() => handleRowDoubleClick(voucher._id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td>{new NepaliDate(voucher.date).format('YYYY-MM-DD')}</td>
                                                <td>{voucher.billNumber}</td>
                                                <td>
                                                    {voucher.isActive ? (
                                                        formatAccountNames(voucher.debitAccounts)
                                                    ) : (
                                                        <span className="text-danger">Canceled</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {voucher.isActive ? (
                                                        formatAmounts(voucher.debitAccounts, 'debit')
                                                    ) : (
                                                        <span className="text-danger">0.00</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {voucher.isActive ? (
                                                        formatAccountNames(voucher.creditAccounts)
                                                    ) : (
                                                        <span className="text-danger">Canceled</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {voucher.isActive ? (
                                                        formatAmounts(voucher.creditAccounts, 'credit')
                                                    ) : (
                                                        <span className="text-success">0.00</span>
                                                    )}
                                                </td>
                                                <td>{voucher.description}</td>
                                                <td>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            className="btn btn-sm btn-info"
                                                            onClick={() => navigate(`/retailer/journal/${voucher._id}/print`)}
                                                        >
                                                            <i className="fas fa-eye"></i>View
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-warning"
                                                            onClick={() => navigate(`/retailer/journal/${voucher._id}`)}
                                                        >
                                                            <i className="fas fa-edit"></i>Edit
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="fw-bold">
                                            <td colSpan="3">Total:</td>
                                            <td>{formatCurrency(totalDebit)}</td>
                                            <td></td>
                                            <td>{formatCurrency(totalCredit)}</td>
                                            <td colSpan="2"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style jsx>{`
                .highlighted-row {
                    background-color: #f1f1f1 !important;
                }
                .voucher-table thead {
                    background-color: #007bff;
                    color: #fff;
                }
                .voucher-table tbody tr:hover {
                    background-color: #f8f9fa;
                }
            `}</style>
        </div>
    );
};

export default JournalList;