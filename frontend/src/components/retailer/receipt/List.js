import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../Header';
import NepaliDate from 'nepali-date-converter';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import Loader from '../../Loader';

const ReceiptsList = () => {
    const { draftSave, setDraftSave, clearDraft } = usePageNotRefreshContext();
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];

    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });

    const [data, setData] = useState(() => {
        if (draftSave && draftSave.receiptsData) {
            return draftSave.receiptsData;
        }
        return {
            company: null,
            currentFiscalYear: null,
            receipts: [],
            fromDate: '',
            toDate: '',
            userPreferences: {
                theme: 'light'
            },
            userRoles: {
                isAdminOrSupervisor: false
            }
        };
    });

    const [searchQuery, setSearchQuery] = useState(() => {
        if (draftSave && draftSave.receiptsSearch) {
            return draftSave.receiptsSearch.searchQuery || '';
        }
        return '';
    });

    const [receiptAccountFilter, setReceiptAccountFilter] = useState(() => {
        if (draftSave && draftSave.receiptsSearch) {
            return draftSave.receiptsSearch.receiptAccountFilter || '';
        }
        return '';
    });

    const [selectedRowIndex, setSelectedRowIndex] = useState(() => {
        if (draftSave && draftSave.receiptsSearch) {
            return draftSave.receiptsSearch.selectedRowIndex || 0;
        }
        return 0;
    });

    // Fetch company and fiscal year info when component mounts
    // useEffect(() => {
    //     const fetchInitialData = async () => {
    //         try {
    //             const response = await api.get('/api/my-company');
    //             if (response.data.success) {
    //                 const { company: companyData, currentFiscalYear } = response.data;

    //                 // Set company info
    //                 const dateFormat = companyData.dateFormat || 'english';
    //                 setCompany({
    //                     dateFormat,
    //                     isVatExempt: companyData.isVatExempt || false,
    //                     vatEnabled: companyData.vatEnabled !== false, // default true
    //                     fiscalYear: currentFiscalYear || {}
    //                 });

    //                 // Set dates based on fiscal year
    //                 if (currentFiscalYear?.startDate) {
    //                     setData(prev => ({
    //                         ...prev,
    //                         fromDate: dateFormat === 'nepali'
    //                             ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
    //                             : new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD'),
    //                         toDate: dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
    //                         company: companyData,
    //                         currentFiscalYear
    //                     }));
    //                 }
    //             }
    //         } catch (err) {
    //             console.error('Error fetching initial data:', err);
    //         }
    //     };

    //     fetchInitialData();
    // }, []);

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
                        isVatExempt: companyData.isVatExempt || false,
                        vatEnabled: companyData.vatEnabled !== false, // default true
                        fiscalYear: currentFiscalYear || {}
                    });

                    // Check if we have draft dates
                    const hasDraftDates = draftSave?.receiptsData?.fromDate && draftSave?.receiptsData?.toDate;

                    if (!hasDraftDates && currentFiscalYear?.startDate) {
                        // Only set default dates if we don't have draft dates
                        setData(prev => ({
                            ...prev,
                            fromDate: dateFormat === 'nepali'
                                ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
                                : new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD'),
                            toDate: dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
                            company: companyData,
                            currentFiscalYear
                        }));
                    } else {
                        // If we have draft data, ensure company info is updated
                        setData(prev => ({
                            ...prev,
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

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalCredit, setTotalCredit] = useState(0);
    const [filteredReceipts, setFilteredReceipts] = useState([]);

    const fromDateRef = useRef(null);
    const toDateRef = useRef(null);
    const searchInputRef = useRef(null);
    const receiptAccountFilterRef = useRef(null);
    const generateReportRef = useRef(null);
    const tableBodyRef = useRef(null);
    const [shouldFetch, setShouldFetch] = useState(false);
    const navigate = useNavigate();

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Save data and search state to draft context
    useEffect(() => {
        setDraftSave({
            ...draftSave,
            receiptsData: data,
            receiptsSearch: {
                searchQuery,
                receiptAccountFilter,
                selectedRowIndex,
                fromDate: data.fromDate,
                toDate: data.toDate
            }
        });
    }, [data, searchQuery, receiptAccountFilter, selectedRowIndex, data.fromDate, data.toDate]);

    // Fetch data when generate report is clicked
    // useEffect(() => {
    //     const fetchData = async () => {
    //         if (!shouldFetch) return;

    //         try {
    //             setLoading(true);
    //             const params = new URLSearchParams();
    //             if (data.fromDate) params.append('fromDate', data.fromDate);
    //             if (data.toDate) params.append('toDate', data.toDate);

    //             const response = await api.get(`/api/retailer/receipts/register?${params.toString()}`);
    //             setData(response.data.data);
    //             setError(null);
    //             // Don't reset selection when new data loads if we have a saved position
    //             if (!draftSave?.receiptsSearch?.selectedRowIndex) {
    //                 setSelectedRowIndex(0);
    //             }
    //         } catch (err) {
    //             setError(err.response?.data?.error || 'Failed to fetch receipts');
    //         } finally {
    //             setLoading(false);
    //             setShouldFetch(false);
    //         }
    //     };

    //     fetchData();
    // }, [shouldFetch, data.fromDate, data.toDate]);

    // Fetch data when generate report is clicked
    useEffect(() => {
        const fetchData = async () => {
            if (!shouldFetch) return;

            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (data.fromDate) params.append('fromDate', data.fromDate);
                if (data.toDate) params.append('toDate', data.toDate);

                const response = await api.get(`/api/retailer/receipts/register?${params.toString()}`);
                setData(response.data.data);
                setError(null);
                // Don't reset selection when new data loads if we have a saved position
                if (!draftSave?.receiptsSearch?.selectedRowIndex) {
                    setSelectedRowIndex(0);
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch receipts');
            } finally {
                setLoading(false);
                setShouldFetch(false);
            }
        };

        fetchData();
    }, [shouldFetch, data.fromDate, data.toDate]);

    // Filter receipts based on search and receipt account
    // useEffect(() => {
    //     const filtered = data.receipts.filter(receipt => {
    //         const matchesSearch =
    //             receipt.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    //             receipt.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    //             receipt.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    //         const matchesReceiptAccount =
    //             receiptAccountFilter === '' ||
    //             (receipt.receiptAccount?.name?.toLowerCase() === receiptAccountFilter.toLowerCase());

    //         return matchesSearch && matchesReceiptAccount;
    //     });

    //     setFilteredReceipts(filtered);
    //     // Reset selected row when filters change, but only if we don't have a saved position
    //     if (!draftSave?.receiptsSearch?.selectedRowIndex) {
    //         setSelectedRowIndex(0);
    //     }
    // }, [data.receipts, searchQuery, receiptAccountFilter]);

    // Filter receipts based on search and receipt account
    useEffect(() => {
        const filtered = data.receipts.filter(receipt => {
            const matchesSearch =
                receipt.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                receipt.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                receipt.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesReceiptAccount =
                receiptAccountFilter === '' ||
                (receipt.receiptAccount?.name?.toLowerCase() === receiptAccountFilter.toLowerCase());

            return matchesSearch && matchesReceiptAccount;
        });

        setFilteredReceipts(filtered);

        // Reset selected row when filters change, but only if we don't have a saved position
        if (!draftSave?.receiptsSearch?.selectedRowIndex) {
            setSelectedRowIndex(0);
        }
    }, [data.receipts, searchQuery, receiptAccountFilter]);

    // Calculate totals when filtered receipts change
    useEffect(() => {
        if (filteredReceipts.length === 0) {
            setTotalCredit(0);
            return;
        }

        const newTotal = filteredReceipts.reduce((acc, receipt) => {
            return receipt.isActive ? acc + (receipt.credit || 0) : acc;
        }, 0);

        setTotalCredit(newTotal);
    }, [filteredReceipts]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (filteredReceipts.length === 0) return;

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
                    setSelectedRowIndex(prev => Math.min(filteredReceipts.length - 1, prev + 1));
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredReceipts, selectedRowIndex, navigate]);

    // Scroll to selected row
    useEffect(() => {
        if (tableBodyRef.current && filteredReceipts.length > 0) {
            const rows = tableBodyRef.current.querySelectorAll('tr');
            if (rows.length > selectedRowIndex) {
                rows[selectedRowIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, filteredReceipts]);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleReceiptAccountFilterChange = (e) => {
        setReceiptAccountFilter(e.target.value);
    };

    const handleGenerateReport = () => {
        if (!data.fromDate || !data.toDate) {
            setError('Please select both from and to dates');
            return;
        }
        setShouldFetch(true);
    };

    const handlePrint = (filtered = false) => {
        const rowsToPrint = filtered ?
            filteredReceipts :
            data.receipts;

        if (rowsToPrint.length === 0) {
            alert("No receipts to print");
            return;
        }

        const printWindow = window.open("", "_blank");
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
                padding: 2px; 
                font-size: 2px
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
        </style>
        ${printHeader}
        <h1 style="text-align:center;text-decoration:underline;">Receipt Voucher's Register</h1>
        <table>
            <thead>
                <tr>
                    <th class="nowrap">Date</th>
                    <th class="nowrap">Vch. No.</th>
                    <th class="nowrap">Account</th>
                    <th class="nowrap">Credit</th>
                    <th class="nowrap">Receipt Account</th>
                    <th class="nowrap">User</th>
                </tr>
            </thead>
            <tbody>
        `;

        let totalCredit = 0;

        rowsToPrint.forEach(receipt => {
            const isCanceled = !receipt.isActive;

            tableContent += `
            <tr>
                <td class="nowrap">${new NepaliDate(receipt.date).format('YYYY-MM-DD')}</td>
                <td class="nowrap">${receipt.billNumber}</td>
                <td class="nowrap">${isCanceled ? '<span class="text-danger">Canceled</span>' : (receipt.account?.name || 'N/A')}</td>
                <td class="nowrap">${isCanceled ? '<span class="text-danger">0.00</span>' : (receipt.credit?.toFixed(2) || '0.00')}</td>
                <td class="nowrap">${isCanceled ? '<span class="text-danger">Canceled</span>' : (receipt.receiptAccount?.name || 'N/A')}</td>
                <td class="nowrap">${receipt.user?.name || 'N/A'}</td>
            </tr>
            `;

            if (!isCanceled) {
                totalCredit += parseFloat(receipt.credit || 0);
            }
        });

        // Add totals row
        tableContent += `
            <tr style="font-weight:bold;">
                <td colspan="3">Total:</td>
                <td>${totalCredit.toFixed(2)}</td>
                <td colspan="2"></td>
            </tr>
            </tbody>
        </table>
        `;

        printWindow.document.write(`
        <html>
            <head>
                <title>Receipt Voucher's Register</title>
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

    const handleRowClick = (index) => {
        setSelectedRowIndex(index);
    };

    const handleRowDoubleClick = (receiptId) => {
        navigate(`/retailer/receipts/${filteredReceipts[selectedRowIndex]._id}/print`);
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

    // Get unique receipt accounts for filter dropdown
    const receiptAccounts = [...new Set(data.receipts
        .map(receipt => receipt.receiptAccount?.name)
        .filter(name => name !== undefined && name !== null))];

    if (loading) return <Loader />;

    if (error) {
        return <div className="alert alert-danger text-center py-5">{error}</div>;
    }

    return (
        <div className='container-fluid'>
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-3">
                    <h1 className="h3 mb-0 text-center text-primary">Receipt Voucher's Register</h1>
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
                                <div className="col-md-4">
                                    <label htmlFor="searchInput" className="form-label">Search</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="searchInput"
                                            ref={searchInputRef}
                                            placeholder="Search by voucher number, account or user..."
                                            value={searchQuery}
                                            onChange={handleSearchChange}
                                            disabled={data.receipts.length === 0}
                                            autoComplete='off'
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            disabled={data.receipts.length === 0}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>

                                {/* Receipt Account Filter Row */}
                                <div className="col-md-2">
                                    <label htmlFor="receiptAccountFilter" className="form-label">Receipt Account</label>
                                    <select
                                        className="form-select"
                                        id="receiptAccountFilter"
                                        ref={receiptAccountFilterRef}
                                        value={receiptAccountFilter}
                                        onChange={handleReceiptAccountFilterChange}
                                        disabled={data.receipts.length === 0}
                                    >
                                        <option value="">All</option>
                                        {receiptAccounts.map(account => (
                                            <option key={account} value={account}>{account}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="col-md-4 d-flex align-items-end justify-content-end gap-2">
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/retailer/receipts')}
                            >
                                <i className="fas fa-receipt me-2"></i>New Voucher
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(false)}
                                disabled={data.receipts.length === 0}
                            >
                                <i className="fas fa-print"></i>Print All
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(true)}
                                disabled={data.receipts.length === 0}
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

                    {data.receipts.length === 0 ? (
                        <div className="alert alert-info text-center py-3">
                            <i className="fas fa-info-circle me-2"></i>
                            Please select date range and click "Generate Report" to view data
                        </div>
                    ) : (
                        <>
                            {/* Receipts Table */}
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Vch. No.</th>
                                            <th>Account</th>
                                            <th className="text-end">Credit</th>
                                            <th>Receipt Account</th>
                                            <th>User</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody ref={tableBodyRef}>
                                        {filteredReceipts.map((receipt, index) => (
                                            <tr
                                                key={receipt._id}
                                                className={`receipt-row ${selectedRowIndex === index ? 'highlighted-row' : ''}`}
                                                onClick={() => handleRowClick(index)}
                                                onDoubleClick={() => handleRowDoubleClick(receipt._id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td>{new NepaliDate(receipt.date).format('YYYY-MM-DD')}</td>
                                                <td>{receipt.billNumber}</td>
                                                <td>
                                                    {receipt.isActive ?
                                                        (receipt.account?.name || 'N/A') :
                                                        <span className="text-danger">Canceled</span>}
                                                </td>
                                                <td className="text-end">
                                                    {receipt.isActive ?
                                                        formatCurrency(receipt.credit) :
                                                        <span className="text-danger">0.00</span>}
                                                </td>
                                                <td>
                                                    {receipt.isActive ?
                                                        (receipt.receiptAccount?.name || 'N/A') :
                                                        <span className="text-danger">Canceled</span>}
                                                </td>
                                                <td>{receipt.user?.name || 'N/A'}</td>
                                                <td>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            className="btn btn-sm btn-info"
                                                            onClick={() => navigate(`/retailer/receipts/${receipt._id}/print`)}
                                                        >
                                                            <i className="fas fa-eye"></i>View
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-warning"
                                                            onClick={() => navigate(`/retailer/receipts/${receipt._id}`)}
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
                                            <td className="text-end">{formatCurrency(totalCredit)}</td>
                                            <td colSpan="3"></td>
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

export default ReceiptsList;