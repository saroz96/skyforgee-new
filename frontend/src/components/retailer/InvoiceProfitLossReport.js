import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Loader from '../Loader';
import 'bootstrap/dist/css/bootstrap.min.css';
import Header from './Header';
import NepaliDate from 'nepali-date-converter';

const InvoiceWiseProfitLossReport = () => {
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredResults, setFilteredResults] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [results, setResults] = useState([]);
    const [filters, setFilters] = useState({
        fromDate: '',
        toDate: '',
        billNumber: ''
    });
    const [company, setCompany] = useState({
        dateFormat: 'english',
        fiscalYear: {}
    });
    const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
    const [shouldFetch, setShouldFetch] = useState(false);
    const navigate = useNavigate();
    const tableBodyRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Fetch company info only
    useEffect(() => {
        const fetchCompanyData = async () => {
            try {
                // Fetch company info
                const companyResponse = await api.get('/api/my-company');
                if (companyResponse.data.success) {
                    const { company: companyData, currentFiscalYear } = companyResponse.data;

                    // Set company info
                    const dateFormat = companyData.dateFormat || 'english';
                    setCompany({
                        dateFormat,
                        fiscalYear: currentFiscalYear || {}
                    });

                    // Set default dates based on fiscal year
                    let fromDate, toDate;

                    if (dateFormat === 'nepali') {
                        fromDate = currentFiscalYear?.startDate
                            ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
                            : currentNepaliDate;
                        toDate = currentFiscalYear?.endDate
                            ? new NepaliDate(currentFiscalYear.endDate).format('YYYY-MM-DD')
                            : currentNepaliDate;
                    } else {
                        fromDate = currentFiscalYear?.startDate
                            ? new Date(currentFiscalYear.startDate).toISOString().split('T')[0]
                            : currentEnglishDate;
                        toDate = currentFiscalYear?.endDate
                            ? new Date(currentFiscalYear.endDate).toISOString().split('T')[0]
                            : currentEnglishDate;
                    }

                    setFilters(prev => ({
                        ...prev,
                        fromDate,
                        toDate
                    }));
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch company data');
            }
        };

        fetchCompanyData();
    }, []);

    // Fetch report data only when shouldFetch is true
    useEffect(() => {
        const fetchReportData = async () => {
            if (!shouldFetch) return;

            try {
                setLoading(true);
                const response = await api.get('/api/retailer/invoice-wise-profit-loss', { params: filters });
                setResults(response.data.data.results || []);
                setError(null);
                setSelectedRowIndex(-1);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch report data');
            } finally {
                setLoading(false);
                setShouldFetch(false);
            }
        };

        fetchReportData();
    }, [shouldFetch, filters]);

    // Filter results based on search query
    useEffect(() => {
        if (results.length === 0) {
            setFilteredResults([]);
            return;
        }

        const filtered = results.filter(bill => {
            const matchesSearch =
                bill.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (bill.accountDetails?.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (bill.cashAccount?.toLowerCase().includes(searchQuery.toLowerCase()));

            return matchesSearch;
        });

        setFilteredResults(filtered);
        setSelectedRowIndex(filtered.length > 0 ? 0 : -1); // Reset selection when filters change
    }, [results, searchQuery]);

    // Handle filter changes
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    // Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!filters.fromDate || !filters.toDate) {
            setError('Please select both from and to dates');
            return;
        }
        setShouldFetch(true);
        setSearchQuery(''); // Clear search when generating new results
    };

    // Reset form
    const resetForm = () => {
        let fromDate, toDate;

        if (company.dateFormat === 'nepali') {
            fromDate = company.fiscalYear?.startDate
                ? new NepaliDate(company.fiscalYear.startDate).format('YYYY-MM-DD')
                : currentNepaliDate;
            toDate = company.fiscalYear?.endDate
                ? new NepaliDate(company.fiscalYear.endDate).format('YYYY-MM-DD')
                : currentNepaliDate;
        } else {
            fromDate = company.fiscalYear?.startDate
                ? new Date(company.fiscalYear.startDate).toISOString().split('T')[0]
                : currentEnglishDate;
            toDate = company.fiscalYear?.endDate
                ? new Date(company.fiscalYear.endDate).toISOString().split('T')[0]
                : currentEnglishDate;
        }

        setFilters({
            fromDate,
            toDate,
            billNumber: ''
        });

        // Don't fetch data automatically on reset
        setResults([]);
        setSearchQuery('');
        setError(null);
    };

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (filteredResults.length === 0) return;

            // Check if focus is inside an input element
            const activeElement = document.activeElement;
            if (activeElement.tagName === 'INPUT') {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    moveToNextVisibleInput(activeElement);
                }
                return;
            }

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.max(0, prev - 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.min(filteredResults.length - 1, prev + 1));
                    break;
                case 'Enter':
                    if (selectedRowIndex >= 0 && selectedRowIndex < filteredResults.length) {
                        toggleItemDetails(filteredResults[selectedRowIndex]._id);
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    setSelectedRowIndex(0);
                    break;
                case 'End':
                    e.preventDefault();
                    setSelectedRowIndex(filteredResults.length - 1);
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredResults, selectedRowIndex]);

    // Toggle item details manually instead of using Bootstrap collapse
    const toggleItemDetails = (billId) => {
        const detailsElement = document.getElementById(`details-${billId}`);
        if (detailsElement) {
            const isCollapsed = detailsElement.classList.contains('show');
            if (isCollapsed) {
                detailsElement.classList.remove('show');
            } else {
                detailsElement.classList.add('show');
            }
        }
    };

    // Scroll to selected row
    useEffect(() => {
        if (tableBodyRef.current && filteredResults.length > 0 && selectedRowIndex >= 0) {
            const rows = tableBodyRef.current.querySelectorAll('tr.data-row');
            if (rows.length > selectedRowIndex) {
                rows[selectedRowIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, filteredResults]);

    // Move to next visible input field
    const moveToNextVisibleInput = (currentElement) => {
        const formElements = Array.from(document.querySelectorAll('input, select, textarea, button'));
        const currentIndex = formElements.indexOf(currentElement);

        for (let i = currentIndex + 1; i < formElements.length; i++) {
            if (formElements[i].offsetParent !== null) {
                formElements[i].focus();
                break;
            }
        }
    };

    // Handle row click
    const handleRowClick = (index) => {
        setSelectedRowIndex(index);
    };

    // Clear search
    const clearSearch = () => {
        setSearchQuery('');
        setSelectedRowIndex(0);
    };

    // Calculate totals
    const calculateTotals = () => {
        const totals = filteredResults.reduce((acc, bill) => {
            return {
                totalCost: acc.totalCost + bill.totalCost,
                totalSales: acc.totalSales + bill.totalSales,
                totalProfit: acc.totalProfit + bill.totalProfit
            };
        }, { totalCost: 0, totalSales: 0, totalProfit: 0 });

        const cpPercentage = totals.totalCost !== 0
            ? (totals.totalProfit / totals.totalCost * 100)
            : 0;
        const spPercentage = totals.totalSales !== 0
            ? (totals.totalProfit / totals.totalSales * 100)
            : 0;

        return {
            ...totals,
            cpPercentage,
            spPercentage
        };
    };

    const totals = calculateTotals();

    // Format currency based on company date format
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

    // Format date based on company date format
    const formatDate = (dateString) => {
        if (company.dateFormat === 'nepali') {
            return new NepaliDate(dateString).format('YYYY-MM-DD');
        }
        return new Date(dateString).toLocaleDateString();
    };

    // Handle key navigation in form fields
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

    // Print function - opens in new window
    const handlePrint = () => {
        if (filteredResults.length === 0) {
            alert('No data to print');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=1000,height=600');
        const printContent = document.querySelector('.print-section').innerHTML;
        const companyName = document.querySelector('.card-header h1').textContent;
        
        const printDocument = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${companyName}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                    }
                    .print-header {
                        text-align: center;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #333;
                        padding-bottom: 10px;
                    }
                    .print-header h2 {
                        margin: 0;
                        color: #0d6efd;
                    }
                    .print-info {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 15px;
                    }
                    .table {
                        width: 100%;
                        font-size: 12px;
                        border-collapse: collapse;
                    }
                    .table th {
                        background-color: #f8f9fa !important;
                        padding: 8px;
                        border: 1px solid #dee2e6;
                    }
                    .table td {
                        padding: 6px;
                        border: 1px solid #dee2e6;
                    }
                    .text-end {
                        text-align: right;
                    }
                    .profit-positive {
                        color: rgb(23, 214, 23);
                        font-weight: bold;
                    }
                    .profit-negative {
                        color: red;
                        font-weight: bold;
                    }
                    .compact-cell {
                        white-space: nowrap;
                    }
                    .table-footer {
                        font-weight: bold;
                        background-color: #f8f9fa;
                    }
                    .print-date {
                        text-align: right;
                        margin-bottom: 10px;
                        font-size: 14px;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 15px;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h2>${companyName}</h2>
                </div>
                <div class="print-date">
                    Printed on: ${new Date().toLocaleString()}
                </div>
                <div class="print-info">
                    <div><strong>From Date:</strong> ${filters.fromDate}</div>
                    <div><strong>To Date:</strong> ${filters.toDate}</div>
                </div>
                ${printContent
                    .replace(/<div class="alert[^>]*>.*?<\/div>/g, '')
                    .replace(/<button[^>]*>.*?<\/button>/g, '')
                    .replace(/no-print/g, '')
                    .replace(/<div class="d-flex[^>]*>.*?<\/div>/g, '')
                }
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 500);
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(printDocument);
        printWindow.document.close();
    };

    if (loading) return <Loader />;

    return (
        <div className="container-fluid">
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                    <h1 className="h3 mb-0 text-center text-primary">Invoice Wise Profit/Loss Report</h1>
                    <button className="btn btn-primary btn-sm no-print" onClick={handlePrint}>
                        <i className="fas fa-print me-2"></i> Print Report
                    </button>
                </div>

                {/* Filter Section */}
                <div className="card-body no-print">
                    <div className="row">
                        <div className="col">
                            <div className="row g-3">
                                <div className="col">
                                    <label htmlFor="fromDate" className="form-label">From Date</label>
                                    <input
                                        type={company.dateFormat === 'nepali' ? 'text' : 'date'}
                                        name="fromDate"
                                        id="fromDate"
                                        className="form-control"
                                        value={filters.fromDate}
                                        onChange={handleFilterChange}
                                        autoComplete="off"
                                        onKeyDown={(e) => handleKeyDown(e, 'toDate')}
                                    />
                                </div>
                                <div className="col">
                                    <label htmlFor="toDate" className="form-label">To Date</label>
                                    <input
                                        type={company.dateFormat === 'nepali' ? 'text' : 'date'}
                                        name="toDate"
                                        id="toDate"
                                        className="form-control"
                                        value={filters.toDate}
                                        onChange={handleFilterChange}
                                        autoComplete="off"
                                        onKeyDown={(e) => handleKeyDown(e, 'searchInput')}
                                    />
                                </div>
                                <div className="col">
                                    <label htmlFor="searchInput" className="form-label">Search</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="searchInput"
                                            placeholder="Search invoices..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            autoComplete='off'
                                            onKeyDown={(e) => handleKeyDown(e, 'filterButton')}
                                        />
                                        {searchQuery && (
                                            <button
                                                id="searchClearBtn"
                                                className="btn btn-outline-secondary"
                                                type="button"
                                                onClick={clearSearch}
                                                title="Clear search"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="col-md-2 d-flex align-items-end">
                                    <button
                                        type="button"
                                        id="filterButton"
                                        className="btn btn-primary w-100 me-2"
                                        onClick={handleSubmit}
                                    >
                                        <i className="fas fa-filter me-2"></i>Generate
                                    </button>
                                </div>
                                <div className="col-md-2 d-flex align-items-end">
                                    <button
                                        type="button"
                                        className="btn btn-secondary w-100"
                                        onClick={resetForm}
                                    >
                                        <i className="fas fa-sync me-2"></i>Reset
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                <div className="card-body print-section">
                    {error && (
                        <div className="alert alert-danger">{error}</div>
                    )}

                    {!error && results.length === 0 && !shouldFetch ? (
                        <div className="alert alert-info text-center py-3">
                            <i className="fas fa-info-circle me-2"></i>
                            Please select date range and click "Generate" to view data
                        </div>
                    ) : !error && results.length === 0 && shouldFetch ? (
                        <Loader />
                    ) : (
                        <>
                            {searchQuery && filteredResults.length === 0 && (
                                <div className="alert alert-warning text-center py-2">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    No invoices found matching your search criteria
                                </div>
                            )}
                            
                            {filteredResults.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mb-2 no-print">
                                    <div>
                                        Showing {filteredResults.length} of {results.length} invoices
                                        {searchQuery && (
                                            <span> matching "<strong>{searchQuery}</strong>"</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            <div className="table-responsive">
                                <table className="table table-hover table-striped">
                                    <thead className="table-light">
                                        <tr>
                                            <th>S.N</th>
                                            <th>Date</th>
                                            <th>Invoice #</th>
                                            <th>Account</th>
                                            <th className="text-end">Cost</th>
                                            <th className="text-end">Sales</th>
                                            <th className="text-end">C.P(%)</th>
                                            <th className="text-end">S.P(%)</th>
                                            <th className="text-end">Profit</th>
                                            <th className="no-print">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody ref={tableBodyRef}>
                                        {filteredResults.map((bill, index) => (
                                            <React.Fragment key={bill._id}>
                                                <tr
                                                    className={`data-row ${selectedRowIndex === index ? 'highlighted-row' : ''}`}
                                                    data-index={index}
                                                    tabIndex={0}
                                                    onClick={() => handleRowClick(index)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <td>{index + 1}</td>
                                                    <td className="compact-cell">{formatDate(bill.date)}</td>
                                                    <td className="compact-cell">{bill.billNumber}</td>
                                                    <td className="compact-cell">
                                                        {bill.accountDetails && bill.accountDetails.name
                                                            ? bill.accountDetails.name
                                                            : (bill.cashAccount || 'N/A')}
                                                    </td>
                                                    <td className="compact-cell text-end">{formatCurrency(bill.totalCost)}</td>
                                                    <td className="compact-cell text-end">{formatCurrency(bill.totalSales)}</td>
                                                    <td className="compact-cell text-end">
                                                        {bill.isReturn
                                                            ? bill.totalCost === 0 ? '0.00' :
                                                                (-Math.abs(bill.totalProfit) / Math.abs(bill.totalCost) * 100).toFixed(2)
                                                            : bill.totalCost === 0 ? '0.00' :
                                                                ((bill.totalProfit / bill.totalCost) * 100).toFixed(2)
                                                        }
                                                    </td>
                                                    <td className="compact-cell text-end">
                                                        {bill.isReturn
                                                            ? bill.totalSales === 0 ? '0.00' :
                                                                (-Math.abs(bill.totalProfit) / Math.abs(bill.totalSales) * 100).toFixed(2)
                                                            : bill.totalSales === 0 ? '0.00' :
                                                                ((bill.totalProfit / bill.totalSales) * 100).toFixed(2)
                                                        }
                                                    </td>
                                                    <td className={`compact-cell text-end ${bill.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                                                        {formatCurrency(bill.totalProfit)}
                                                    </td>
                                                    <td className="no-print compact-cell">
                                                        <button
                                                            className="btn btn-sm btn-outline-primary view-items-btn"
                                                            type="button"
                                                            onClick={() => toggleItemDetails(bill._id)}
                                                        >
                                                            <i className="fas fa-eye me-1"></i>View Items
                                                        </button>
                                                    </td>
                                                </tr>
                                                {/* Item Details Row */}
                                                <tr
                                                    id={`details-${bill._id}`}
                                                    className="collapse-details no-print"
                                                    style={{ display: 'none' }}
                                                >
                                                    <td colSpan="10">
                                                        <div className="accordion">
                                                            <div className="accordion-item">
                                                                <h2 className="accordion-header">
                                                                    <button
                                                                        className="accordion-button"
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const itemsElement = document.getElementById(`items-${bill._id}`);
                                                                            if (itemsElement) {
                                                                                itemsElement.style.display =
                                                                                    itemsElement.style.display === 'none' ? 'block' : 'none';
                                                                            }
                                                                        }}
                                                                    >
                                                                        Item-wise Profit Details
                                                                    </button>
                                                                </h2>
                                                                <div id={`items-${bill._id}`} className="accordion-body p-0" style={{ display: 'none' }}>
                                                                    <table className="table table-sm">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>S.N</th>
                                                                                <th>Item</th>
                                                                                <th>Qty</th>
                                                                                <th className="text-end">Cost Price</th>
                                                                                <th className="text-end">Sale Price</th>
                                                                                <th className="text-end">Profit/Unit</th>
                                                                                <th className="text-end">Total Profit</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {bill.items && bill.items.map((item, itemIndex) => {
                                                                                const profitPerUnit = item.price - (item.puPrice || 0);
                                                                                const itemProfit = profitPerUnit * item.quantity;

                                                                                return (
                                                                                    <tr key={itemIndex}>
                                                                                        <td>{itemIndex + 1}</td>
                                                                                        <td className="compact-cell">{item.itemName || 'N/A'}</td>
                                                                                        <td className="compact-cell">{item.quantity}</td>
                                                                                        <td className="compact-cell text-end">{formatCurrency(item.puPrice)}</td>
                                                                                        <td className="compact-cell text-end">{formatCurrency(item.price)}</td>
                                                                                        <td className={`compact-cell text-end ${profitPerUnit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                                                                                            {formatCurrency(profitPerUnit)}
                                                                                        </td>
                                                                                        <td className={`compact-cell text-end ${itemProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                                                                                            {formatCurrency(itemProfit)}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                    {filteredResults.length > 0 && (
                                        <tfoot className="table-group-divider">
                                            <tr className="fw-bold">
                                                <td colSpan="4">Grand Total</td>
                                                <td className="text-end">{formatCurrency(totals.totalCost)}</td>
                                                <td className="text-end">{formatCurrency(totals.totalSales)}</td>
                                                <td className="text-end">{totals.cpPercentage.toFixed(2)}</td>
                                                <td className="text-end">{totals.spPercentage.toFixed(2)}</td>
                                                <td className={`text-end ${totals.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                                                    {formatCurrency(totals.totalProfit)}
                                                </td>
                                                <td className="no-print"></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style>{`
                .profit-positive {
                    color: rgb(23, 214, 23);
                    font-weight: bold;
                }

                .profit-negative {
                    color: red;
                    font-weight: bold;
                }

                .table-hover tbody tr:hover {
                    background-color: rgba(0, 0, 0, 0.05);
                }

                .accordion-button:not(.collapsed) {
                    background-color: #c1d0d8;
                }

                .highlighted-row {
                    background-color: #cdd8dd !important;
                }

                .compact-cell {
                    white-space: nowrap;
                }

                .collapse-details.show {
                    display: table-row !important;
                }

                /* Improved accordion styling */
                .accordion-button:after {
                    margin-left: 10px;
                }

                .accordion-header button {
                    padding: 0.5rem 1rem;
                }

                /* Make the entire accordion header clickable */
                .accordion-header {
                    cursor: pointer;
                }

                /* Print-specific styles */
                @media print {
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default InvoiceWiseProfitLossReport;