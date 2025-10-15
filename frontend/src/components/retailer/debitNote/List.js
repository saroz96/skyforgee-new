import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../Header';
import NepaliDate from 'nepali-date-converter';
import Loader from '../../Loader';

const DebitNoteRegister = () => {
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];

    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        fiscalYear: {}
    });

    const [data, setData] = useState({
        company: null,
        currentFiscalYear: null,
        debitNotes: [],
        fromDate: '',
        toDate: '',
        currentCompanyName: '',
        currentCompany: null,
        user: null,
        isAdminOrSupervisor: false
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalDebit, setTotalDebit] = useState(0);
    const [totalCredit, setTotalCredit] = useState(0);
    const [selectedRowIndex, setSelectedRowIndex] = useState(0);
    const [filteredDebitNotes, setFilteredDebitNotes] = useState([]);

    const fromDateRef = useRef(null);
    const toDateRef = useRef(null);
    const searchInputRef = useRef(null);
    const generateReportRef = useRef(null);
    const tableBodyRef = useRef(null);
    const [shouldFetch, setShouldFetch] = useState(false);
    const navigate = useNavigate();

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Fetch company and fiscal year info when component mounts
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/my-company');
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
                        setData(prev => ({
                            ...prev,
                            fromDate: dateFormat === 'nepali'
                                ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
                                : new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD'),
                            toDate: dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
                            company: companyData,
                            currentFiscalYear
                        }));
                    }
                }
            } catch (err) {
                console.error('Error fetching initial data:', err);
            }
        };

        fetchInitialData();
    }, []);

    // Fetch data when generate report is clicked
    useEffect(() => {
        const fetchData = async () => {
            if (!shouldFetch) return;

            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (data.fromDate) params.append('fromDate', data.fromDate);
                if (data.toDate) params.append('toDate', data.toDate);

                const response = await api.get(`/api/retailer/debit-note/register?${params.toString()}`);
                setData(prev => ({
                    ...prev,
                    ...response.data.data,
                    debitNotes: response.data.data.debitNotes || []
                }));
                setError(null);
                setSelectedRowIndex(0); // Reset selection when new data loads
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch debit notes');
            } finally {
                setLoading(false);
                setShouldFetch(false);
            }
        };

        fetchData();
    }, [shouldFetch, data.fromDate, data.toDate]);

    // Filter debit notes based on search
    useEffect(() => {
        const filtered = data.debitNotes.filter(debitNote => {
            const matchesSearch =
                debitNote.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                debitNote.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                debitNote.debitAccounts.some(acc =>
                    acc.account?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                ) ||
                debitNote.creditAccounts.some(acc =>
                    acc.account?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                ) ||
                debitNote.debitAccounts.some(acc =>
                    acc.debit?.toString().includes(searchQuery)
                ) ||
                debitNote.creditAccounts.some(acc =>
                    acc.credit?.toString().includes(searchQuery)
                );

            return matchesSearch;
        });

        setFilteredDebitNotes(filtered);
        // Reset selected row when filters change
        setSelectedRowIndex(0);
    }, [data.debitNotes, searchQuery]);

    // Calculate totals when filtered debit notes change
    useEffect(() => {
        if (filteredDebitNotes.length === 0) {
            setTotalDebit(0);
            setTotalCredit(0);
            return;
        }

        const newTotalDebit = filteredDebitNotes.reduce((acc, debitNote) => {
            return debitNote.isActive ? acc + (debitNote.totalDebit || 0) : acc;
        }, 0);

        const newTotalCredit = filteredDebitNotes.reduce((acc, debitNote) => {
            return debitNote.isActive ? acc + (debitNote.totalCredit || 0) : acc;
        }, 0);

        setTotalDebit(newTotalDebit);
        setTotalCredit(newTotalCredit);
    }, [filteredDebitNotes]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (filteredDebitNotes.length === 0) return;

            // Check if focus is inside an input or select element
            const activeElement = document.activeElement;
            if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT') {
                return;
            }

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.max(0, prev - 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.min(filteredDebitNotes.length - 1, prev + 1));
                    break;
                case 'Enter':
                    if (selectedRowIndex >= 0 && selectedRowIndex < filteredDebitNotes.length) {
                        navigate(`/retailer/debit-note/${filteredDebitNotes[selectedRowIndex]._id}/print`);
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredDebitNotes, selectedRowIndex, navigate]);

    // Scroll to selected row
    useEffect(() => {
        if (tableBodyRef.current && filteredDebitNotes.length > 0) {
            const rows = tableBodyRef.current.querySelectorAll('tr');
            if (rows.length > selectedRowIndex) {
                rows[selectedRowIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, filteredDebitNotes]);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateReport = () => {
        if (!data.fromDate || !data.toDate) {
            setError('Please select both from and to dates');
            return;
        }
        setShouldFetch(true);
    };

    const handlePrint = (filtered = false) => {
        const rowsToPrint = filtered ? filteredDebitNotes : data.debitNotes;

        if (rowsToPrint.length === 0) {
            alert("No debit notes to print");
            return;
        }

        const printWindow = window.open("", "_blank");

        // Create print header
        const printHeader = `
            <div class="print-header" style="text-align: center; margin-bottom: 15px;">
                <h2>${data.currentCompanyName || 'Company Name'}</h2>
                <b>
                    <h4>
                        ${data.currentCompany?.address || ''}-${data.currentCompany?.ward || ''}, ${data.currentCompany?.city || ''},
                        ${data.currentCompany?.country || ''} <br>
                        Tel.: ${data.currentCompany?.phone || ''}, Email: ${data.currentCompany?.email || ''}
                        <br>
                        VAT NO.: ${data.currentCompany?.pan ? data.currentCompany.pan.split('').map(d => `<span class="bordered-digit">${d}</span>`).join('') : ''}
                    </h4>
                </b>
                <hr style="border: 0.5px solid;">
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
                white-space: nowrap;
            }
            th { 
                background-color: #f2f2f2 !important; 
                -webkit-print-color-adjust: exact; 
            }
            .print-header { 
                text-align: center; 
                margin-bottom: 15px; 
            }
            .nowrap {
                white-space: nowrap;
            }
            .text-danger {
                color: #dc3545 !important;
            }
            .bordered-digit {
                display: inline-block;
                border: 1px solid #000;
                padding: 2px;
                margin: 1px;
                min-width: 15px;
                text-align: center;
            }
        </style>
        ${printHeader}
        <h1 style="text-align:center;">Debit Note Register</h1>
        <table>
            <thead>
                <tr>
                    <th class="nowrap">Date</th>
                    <th class="nowrap">Vch.No</th>
                    <th class="nowrap">Debit Accounts</th>
                    <th class="nowrap">Debit (Rs.)</th>
                    <th class="nowrap">Credit Accounts</th>
                    <th class="nowrap">Credit (Rs.)</th>
                    <th class="nowrap">Description</th>
                </tr>
            </thead>
            <tbody>
        `;

        let totalDebit = 0;
        let totalCredit = 0;

        rowsToPrint.forEach(debitNote => {
            const isCanceled = !debitNote.isActive;

            // Format debit accounts
            const debitAccounts = isCanceled ?
                '<span class="text-danger">Canceled</span>' :
                debitNote.debitAccounts.map(acc =>
                    `<div>${acc.account?.name || 'N/A'}</div>`
                ).join('');

            // Format debit amounts
            const debitAmounts = isCanceled ?
                '<span class="text-danger">0.00</span>' :
                debitNote.debitAccounts.map(acc =>
                    `<span class="debit-amount">${acc.debit?.toFixed(2) || '0.00'}</span>`
                ).join('<br>');

            // Format credit accounts
            const creditAccounts = isCanceled ?
                '<span class="text-danger">Canceled</span>' :
                debitNote.creditAccounts.map(acc =>
                    `<div>${acc.account?.name || 'N/A'}</div>`
                ).join('');

            // Format credit amounts
            const creditAmounts = isCanceled ?
                '<span class="text-success">0.00</span>' :
                debitNote.creditAccounts.map(acc =>
                    `<span class="credit-amount">${acc.credit?.toFixed(2) || '0.00'}</span>`
                ).join('<br>');

            tableContent += `
            <tr>
                <td class="nowrap">${new NepaliDate(debitNote.date).format('YYYY-MM-DD')}</td>
                <td class="nowrap">${debitNote.billNumber}</td>
                <td class="nowrap">${debitAccounts}</td>
                <td class="nowrap">${debitAmounts}</td>
                <td class="nowrap">${creditAccounts}</td>
                <td class="nowrap">${creditAmounts}</td>
                <td class="nowrap">${debitNote.description || ''}</td>
            </tr>
            `;

            if (!isCanceled) {
                totalDebit += parseFloat(debitNote.totalDebit || 0);
                totalCredit += parseFloat(debitNote.totalCredit || 0);
            }
        });

        // Add totals row
        tableContent += `
            <tr style="font-weight:bold;">
                <td colspan="2">Total:</td>
                <td></td>
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
                <title>Debit Note Register</title>
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

    const handleRowDoubleClick = (debitNoteId) => {
        navigate(`/retailer/debit-note/${debitNoteId}/print`);
    };

    const handleKeyDown = (e, nextFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextFieldId) {
                const nextField = document.getElementById(nextFieldId);
                if (nextField) {
                    nextField.focus();
                }
            } else {
                // If no nextFieldId provided, try to find the next focusable element
                const focusableElements = Array.from(
                    document.querySelectorAll('input, select, button, [tabindex]:not([tabindex="-1"])')
                ).filter(el => !el.disabled && el.offsetParent !== null);

                const currentIndex = focusableElements.findIndex(el => el === e.target);

                if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
                    focusableElements[currentIndex + 1].focus();
                }
            }
        }
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
                    <h1 className="h3 mb-0 text-center text-primary">Debit Note Register</h1>
                </div>

                <div className="card-body">
                    {/* Search and Filter Section */}
                    <div className="row mb-4">
                        <div className="col-md-8">
                            <div className="row g-3">
                                {/* Date Range Row */}
                                <div className="col">
                                    <label htmlFor="fromDate" className="form-label">From Date</label>
                                    <input
                                        type="text"
                                        name="fromDate"
                                        id="fromDate"
                                        ref={company.dateFormat === 'nepali' ? fromDateRef : null}
                                        className="form-control"
                                        value={data.fromDate}
                                        onChange={handleDateChange}
                                        required
                                        autoComplete='off'
                                        onKeyDown={(e) => handleKeyDown(e, 'toDate')}
                                    />
                                </div>
                                <div className="col">
                                    <label htmlFor="toDate" className="form-label">To Date</label>
                                    <input
                                        type="text"
                                        name="toDate"
                                        id="toDate"
                                        ref={toDateRef}
                                        className="form-control"
                                        value={data.toDate}
                                        onChange={handleDateChange}
                                        required
                                        autoComplete='off'
                                        onKeyDown={(e) => handleKeyDown(e, 'generateReport')}
                                    />
                                </div>
                                <div className="col-md-2 d-flex align-items-end">
                                    <button
                                        type="button"
                                        id="generateReport"
                                        ref={generateReportRef}
                                        className="btn btn-primary w-100"
                                        onClick={handleGenerateReport}
                                    >
                                        <i className="fas fa-chart-line me-2"></i>Generate
                                    </button>
                                </div>

                                {/* Search Row */}
                                <div className="col-md-6">
                                    <label htmlFor="searchInput" className="form-label">Search</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="searchInput"
                                            ref={searchInputRef}
                                            placeholder="Search by vch no., amounts, description or account name..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            disabled={data.debitNotes.length === 0}
                                            autoComplete='off'
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            disabled={data.debitNotes.length === 0}
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
                                onClick={() => navigate('/retailer/debit-note/new')}
                            >
                                <i className="fas fa-receipt me-2"></i>New Debit Note
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(false)}
                                disabled={data.debitNotes.length === 0}
                            >
                                <i className="fas fa-print"></i>Print All
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(true)}
                                disabled={data.debitNotes.length === 0}
                            >
                                <i className="fas fa-filter"></i>Print Filtered
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => window.location.reload()}
                            >
                                <i className="fas fa-sync-alt me-2"></i>Refresh
                            </button>
                        </div>
                    </div>

                    {data.debitNotes.length === 0 ? (
                        <div className="alert alert-info text-center py-3">
                            <i className="fas fa-info-circle me-2"></i>
                            Please select date range and click "Generate Report" to view data
                        </div>
                    ) : (
                        <>
                            {/* Debit Notes Table */}
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Vch.No</th>
                                            <th>Debit Accounts</th>
                                            <th className="text-end">Debit (Rs.)</th>
                                            <th>Credit Accounts</th>
                                            <th className="text-end">Credit (Rs.)</th>
                                            <th>Description</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody ref={tableBodyRef}>
                                        {filteredDebitNotes.map((debitNote, index) => (
                                            <tr
                                                key={debitNote._id}
                                                className={`debitnote-row ${selectedRowIndex === index ? 'highlighted-row' : ''}`}
                                                onClick={() => handleRowClick(index)}
                                                onDoubleClick={() => handleRowDoubleClick(debitNote._id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td>{new NepaliDate(debitNote.date).format('YYYY-MM-DD')}</td>
                                                <td>{debitNote.billNumber}</td>
                                                <td>
                                                    {debitNote.isActive ? (
                                                        debitNote.debitAccounts.map((acc, i) => (
                                                            <div key={i}>{acc.account?.name || 'N/A'}</div>
                                                        ))
                                                    ) : (
                                                        <span className="text-danger">Canceled</span>
                                                    )}
                                                </td>
                                                <td className="text-end">
                                                    {debitNote.isActive ? (
                                                        debitNote.debitAccounts.map((acc, i) => (
                                                            <div key={i} className="text-danger">
                                                                {formatCurrency(acc.debit)}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-danger">0.00</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {debitNote.isActive ? (
                                                        debitNote.creditAccounts.map((acc, i) => (
                                                            <div key={i}>{acc.account?.name || 'N/A'}</div>
                                                        ))
                                                    ) : (
                                                        <span className="text-danger">Canceled</span>
                                                    )}
                                                </td>
                                                <td className="text-end">
                                                    {debitNote.isActive ? (
                                                        debitNote.creditAccounts.map((acc, i) => (
                                                            <div key={i} className="text-success">
                                                                {formatCurrency(acc.credit)}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-success">0.00</span>
                                                    )}
                                                </td>
                                                <td>{debitNote.description || ''}</td>
                                                <td>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            className="btn btn-sm btn-info"
                                                            onClick={() => navigate(`/retailer/debit-note/${debitNote._id}/print`)}
                                                        >
                                                            <i className="fas fa-eye"></i>View
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-warning"
                                                            onClick={() => navigate(`/retailer/debit-note/${debitNote._id}`)}
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
                                            <td colSpan="2">Total:</td>
                                            <td></td>
                                            <td className="text-end">{formatCurrency(totalDebit)}</td>
                                            <td></td>
                                            <td className="text-end">{formatCurrency(totalCredit)}</td>
                                            <td colSpan="2"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DebitNoteRegister;