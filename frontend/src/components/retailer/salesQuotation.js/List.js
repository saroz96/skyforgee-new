import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../Header';
import NepaliDate from 'nepali-date-converter';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import '../../../stylesheet/retailer/salesQuotation/List.css';
import '../../../stylesheet/noDateIcon.css'
import Loader from '../../Loader';
import ProductModal from '../dashboard/modals/ProductModal';

const SalesQuotationList = () => {
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];

    const { salesQuotationDraftSave, setSalesQuotationDraftSave, clearSalesQuotationDraft } = usePageNotRefreshContext();

    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        isVatExempt: '',
        vatEnabled: true,
        fiscalYear: {},
    });

    const [data, setData] = useState(() => {
        if (salesQuotationDraftSave && salesQuotationDraftSave.salesQuotationData) {
            return salesQuotationDraftSave.salesQuotationData;
        }
        return {
            company: null,
            currentFiscalYear: null,
            salesQuotations: [],
            fromDate: '',
            toDate: company.dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate
        };
    });

    const [searchQuery, setSearchQuery] = useState(() => {
        if (salesQuotationDraftSave && salesQuotationDraftSave.salesQuotationSearch) {
            return salesQuotationDraftSave.salesQuotationSearch.searchQuery || '';
        }
        return '';
    });

    const [paymentModeFilter, setPaymentModeFilter] = useState(() => {
        if (salesQuotationDraftSave && salesQuotationDraftSave.salesQuotationSearch) {
            return salesQuotationDraftSave.salesQuotationSearch.paymentModeFilter || '';
        }
        return '';
    });

    const [selectedRowIndex, setSelectedRowIndex] = useState(() => {
        if (salesQuotationDraftSave && salesQuotationDraftSave.salesQuotationSearch) {
            return salesQuotationDraftSave.salesQuotationSearch.selectedRowIndex || 0;
        }
        return 0;
    });

    const [showProductModal, setShowProductModal] = useState(false);

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

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totals, setTotals] = useState({
        subTotal: 0,
        discount: 0,
        taxable: 0,
        vat: 0,
        roundOff: 0,
        amount: 0
    });
    const [filteredQuotations, setFilteredQuotations] = useState([]);

    const fromDateRef = useRef(null);
    const toDateRef = useRef(null);
    const searchInputRef = useRef(null);
    const paymentModeFilterRef = useRef(null);
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
        setSalesQuotationDraftSave({
            ...salesQuotationDraftSave,
            salesQuotationData: data,
            salesQuotationSearch: {
                searchQuery,
                paymentModeFilter,
                selectedRowIndex
            }
        });
    }, [data, searchQuery, paymentModeFilter, selectedRowIndex]);

    // Fetch data when generate report is clicked
    useEffect(() => {
        const fetchData = async () => {
            if (!shouldFetch) return;

            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (data.fromDate) params.append('fromDate', data.fromDate);
                if (data.toDate) params.append('toDate', data.toDate);

                const response = await api.get(`/api/retailer/sales-quotation/register?${params.toString()}`);
                setData(response.data.data);
                setError(null);
                // Don't reset selection when new data loads if we have a saved position
                if (!salesQuotationDraftSave?.salesQuotationSearch?.selectedRowIndex) {
                    setSelectedRowIndex(0);
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch sales quotations');
            } finally {
                setLoading(false);
                setShouldFetch(false);
            }
        };

        fetchData();
    }, [shouldFetch, data.fromDate, data.toDate]);

    // Filter quotations based on search and payment mode
    useEffect(() => {
        const filtered = data.salesQuotations.filter(quotation => {
            const matchesSearch =
                quotation.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (quotation.account?.name || 'N/A')?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                quotation.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesPaymentMode =
                paymentModeFilter === '' ||
                quotation.paymentMode?.toLowerCase() === paymentModeFilter.toLowerCase();

            return matchesSearch && matchesPaymentMode;
        });

        setFilteredQuotations(filtered);

        // Reset selected row when filters change, but only if we don't have a saved position
        if (!salesQuotationDraftSave?.salesQuotationSearch?.selectedRowIndex) {
            setSelectedRowIndex(0);
        }
    }, [data.salesQuotations, searchQuery, paymentModeFilter]);

    useEffect(() => {
        // Add F9 key handler here
        const handF9leKeyDown = (e) => {
            if (e.key === 'F9') {
                e.preventDefault();
                setShowProductModal(prev => !prev); // Toggle modal visibility
            }
        };
        window.addEventListener('keydown', handF9leKeyDown);
        return () => {
            window.removeEventListener('keydown', handF9leKeyDown);
        };
    }, []);

    // Calculate totals when filtered quotations change
    useEffect(() => {
        if (filteredQuotations.length === 0) {
            setTotals({
                subTotal: 0,
                discount: 0,
                taxable: 0,
                vat: 0,
                roundOff: 0,
                amount: 0
            });
            return;
        }

        const newTotals = filteredQuotations.reduce((acc, quotation) => {
            return {
                subTotal: acc.subTotal + (quotation.subTotal || 0),
                discount: acc.discount + (quotation.discountAmount || 0),
                taxable: acc.taxable + (quotation.taxableAmount || 0),
                vat: acc.vat + (quotation.vatAmount || 0),
                roundOff: acc.roundOff + (quotation.roundOffAmount || 0),
                amount: acc.amount + (quotation.totalAmount || 0)
            };
        }, {
            subTotal: 0,
            discount: 0,
            taxable: 0,
            vat: 0,
            roundOff: 0,
            amount: 0
        });

        setTotals(newTotals);
    }, [filteredQuotations]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (filteredQuotations.length === 0) return;

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
                    setSelectedRowIndex(prev => Math.min(filteredQuotations.length - 1, prev + 1));
                    break;
                case 'Enter':
                    if (selectedRowIndex >= 0 && selectedRowIndex < filteredQuotations.length) {
                        navigate(`/retailer/sales-quotation/${filteredQuotations[selectedRowIndex]._id}/print`);
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredQuotations, selectedRowIndex, navigate]);

    // Scroll to selected row
    useEffect(() => {
        if (tableBodyRef.current && filteredQuotations.length > 0) {
            const rows = tableBodyRef.current.querySelectorAll('tr');
            if (rows.length > selectedRowIndex) {
                const selectedRow = rows[selectedRowIndex];
                const tableContainer = tableBodyRef.current.parentElement;
                const rowTop = selectedRow.offsetTop;
                const rowHeight = selectedRow.offsetHeight;
                const containerHeight = tableContainer.offsetHeight;
                const scrollTop = tableContainer.scrollTop;

                // Calculate if the row is out of view
                if (rowTop < scrollTop || rowTop + rowHeight > scrollTop + containerHeight) {
                    // Smooth scroll to the row
                    tableContainer.scrollTo({
                        top: rowTop - containerHeight / 2 + rowHeight / 2,
                        behavior: 'smooth'
                    });
                }
            }
        }
    }, [selectedRowIndex, filteredQuotations]);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handlePaymentModeFilterChange = (e) => {
        setPaymentModeFilter(e.target.value);
    };

    const handleGenerateReport = () => {
        if (!data.fromDate || !data.toDate) {
            setError('Please select both from and to dates');
            return;
        }
        setShouldFetch(true);
    };

    const handlePrint = (filtered = false) => {
        const rowsToPrint = filtered ? filteredQuotations : data.salesQuotations;
        const vatEnabled = data.company?.vatEnabled || false;
        const isVatExempt = data.company?.isVatExempt || false;
        const showVatColumns = vatEnabled && !isVatExempt;

        if (rowsToPrint.length === 0) {
            alert("No quotations to print");
            return;
        }

        const printWindow = window.open("", "_blank");
        const printHeader = `
           <div class="print-header">
            <h1>${data.currentCompanyName || 'Company Name'}</h1>
            <p>
                ${data.currentCompany?.address || ''}-${data.currentCompany?.ward || ''}, ${data.currentCompany?.city || ''},
                TPIN: ${data.currentCompany?.pan || ''}<br>
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
        </style>
        ${printHeader}
        <h1 style="text-align:center;text-decoration:underline;">Sales Quotation Register</h1>
        <table>
            <thead>
                <tr>
                    <th class="nowrap">Date</th>
                    <th class="nowrap">Quot. No.</th>
                    <th class="nowrap">Party Name</th>
                    <th class="nowrap">Pay Mode</th>
                    <th class="nowrap">Sub Total</th>
                    <th class="nowrap">Discount</th>
                    ${showVatColumns ? `
                    <th class="nowrap">Taxable</th>
                    <th class="nowrap">VAT</th>
                    ` : ''}
                    <th class="nowrap">Round Off</th>
                    <th class="nowrap">Total</th>
                    <th class="nowrap">User</th>
                </tr>
            </thead>
            <tbody>
        `;

        let totals = {
            subTotal: 0,
            discount: 0,
            taxable: 0,
            vat: 0,
            roundOff: 0,
            amount: 0
        };

        rowsToPrint.forEach(quotation => {
            tableContent += `
            <tr>
                <td class="nowrap">${new Date(quotation.date).toLocaleDateString()}</td>
                <td class="nowrap">${quotation.billNumber}</td>
                <td class="nowrap">${quotation.account?.name || 'N/A'}</td>
                <td class="nowrap">${quotation.paymentMode}</td>
                <td class="nowrap">${quotation.subTotal?.toFixed(2)}</td>
                <td class="nowrap">${quotation.discountPercentage?.toFixed(2)}% - ${quotation.discountAmount?.toFixed(2)}</td>
                ${showVatColumns ? `
                <td class="nowrap">${quotation.taxableAmount?.toFixed(2)}</td>
                <td class="nowrap">${quotation.vatAmount?.toFixed(2)}</td>
                ` : ''}
                <td class="nowrap">${quotation.roundOffAmount?.toFixed(2)}</td>
                <td class="nowrap">${quotation.totalAmount?.toFixed(2)}</td>
                <td class="nowrap">${quotation.user?.name || 'N/A'}</td>
            </tr>
            `;

            totals.subTotal += parseFloat(quotation.subTotal || 0);
            totals.discount += parseFloat(quotation.discountAmount || 0);
            totals.taxable += parseFloat(quotation.taxableAmount || 0);
            totals.vat += parseFloat(quotation.vatAmount || 0);
            totals.roundOff += parseFloat(quotation.roundOffAmount || 0);
            totals.amount += parseFloat(quotation.totalAmount || 0);
        });

        // Add final totals row
        tableContent += `
            <tr style="font-weight:bold; border-top: 2px solid #000;">
                <td colspan="4">Grand Totals</td>
                <td>${totals.subTotal.toFixed(2)}</td>
                <td>${totals.discount.toFixed(2)}</td>
                ${showVatColumns ? `
                <td>${totals.taxable.toFixed(2)}</td>
                <td>${totals.vat.toFixed(2)}</td>
                ` : ''}
                <td>${totals.roundOff.toFixed(2)}</td>
                <td>${totals.amount.toFixed(2)}</td>
                <td></td>
            </tr>
            </tbody>
        </table>
        `;

        printWindow.document.write(`
        <html>
            <head>
                <title>Sales Quotation Register</title>
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

    const handleRowDoubleClick = (quotationId) => {
        navigate(`/retailer/sales-quotation/${quotationId}/print`);
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
        <div className="container-fluid">
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-3">
                    <h1 className="h3 mb-0 text-center text-primary">Sales Quotation Register</h1>
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
                                        type={company.dateFormat === 'nepali' ? 'text' : 'text'}
                                        name="fromDate"
                                        id="fromDate"
                                        className="form-control datepicker no-date-icon"
                                        value={data.fromDate}
                                        onChange={handleDateChange}
                                        required
                                        autoComplete="off"
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
                                        className="form-control no-date-icon"
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
                                            placeholder="Search quotations..."
                                            value={searchQuery}
                                            onChange={handleSearchChange}
                                            disabled={data.salesQuotations.length === 0}
                                            autoComplete='off'
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            disabled={data.salesQuotations.length === 0}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>

                                {/* Payment Mode Filter Row */}
                                <div className="col">
                                    <label htmlFor="paymentModeFilter" className="form-label">Payment Mode</label>
                                    <select
                                        className="form-select"
                                        id="paymentModeFilter"
                                        ref={paymentModeFilterRef}
                                        value={paymentModeFilter}
                                        onChange={handlePaymentModeFilterChange}
                                        disabled={data.salesQuotations.length === 0}
                                    >
                                        <option value="">All</option>
                                        <option value="cash">Cash</option>
                                        <option value="credit">Credit</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="col-md-4 d-flex align-items-end justify-content-end gap-2">
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/retailer/sales-quotation')}
                            >
                                <i className="fas fa-receipt me-2"></i>New Quotation
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(false)}
                                disabled={data.salesQuotations.length === 0}
                            >
                                <i className="fas fa-print"></i>Print All
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(true)}
                                disabled={data.salesQuotations.length === 0}
                            >
                                <i className="fas fa-filter"></i>Print Filtered
                            </button>
                        </div>
                    </div>

                    {data.salesQuotations.length === 0 ? (
                        <div className="alert alert-info text-center py-3">
                            <i className="fas fa-info-circle me-2"></i>
                            Please select date range and click "Generate Report" to view data
                        </div>
                    ) : (
                        <>
                            {/* Quotations Table */}
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Quot. No.</th>
                                            <th>Party Name</th>
                                            <th>Pay Mode</th>
                                            <th className="text-end">Sub Total</th>
                                            <th className="text-end">Discount</th>
                                            {data.company.vatEnabled && !data.company.isVatExempt && (
                                                <>
                                                    <th className="text-end">Taxable</th>
                                                    <th className="text-end">VAT</th>
                                                </>
                                            )}
                                            <th className="text-end">Round Off</th>
                                            <th className="text-end">Total</th>
                                            <th>User</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody ref={tableBodyRef}>
                                        {filteredQuotations.map((quotation, index) => (
                                            <tr
                                                key={quotation._id}
                                                className={`quotation-row ${selectedRowIndex === index ? 'highlighted-row' : ''}`}
                                                onClick={() => handleRowClick(index)}
                                                onDoubleClick={() => handleRowDoubleClick(quotation._id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td className="compact-cell">{new NepaliDate(quotation.date).format('YYYY-MM-DD')}</td>
                                                <td className="compact-cell">{quotation.billNumber}</td>
                                                <td className="compact-cell">{quotation.account?.name || 'N/A'}</td>
                                                <td className="compact-cell">{quotation.paymentMode}</td>
                                                <td className="compact-cell text-end">{formatCurrency(quotation.subTotal)}</td>
                                                <td className="compact-cell text-end">
                                                    {formatCurrency(quotation.discountPercentage)}% - {formatCurrency(quotation.discountAmount)}
                                                </td>
                                                {data.company.vatEnabled && !data.company.isVatExempt && (
                                                    <>
                                                        <td className="compact-cell text-end">{formatCurrency(quotation.taxableAmount)}</td>
                                                        <td className="compact-cell text-end">
                                                            {formatCurrency(quotation.vatAmount)}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="compact-cell text-end">{formatCurrency(quotation.roundOffAmount)}</td>
                                                <td className="compact-cell text-end">{formatCurrency(quotation.totalAmount)}</td>
                                                <td>{quotation.user?.name || 'N/A'}</td>
                                                <td className='compact-cell'>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            className="btn btn-sm btn-info"
                                                            onClick={() => navigate(`/retailer/sales-quotation/${quotation._id}/print`)}
                                                        >
                                                            <i className="fas fa-eye"></i>View
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-warning"
                                                            onClick={() => navigate(`/retailer/sales-quotation/edit/${quotation._id}`)}
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
                                            <td colSpan="4">Total:</td>
                                            <td className="text-end">{formatCurrency(totals.subTotal)}</td>
                                            <td className="text-end">{formatCurrency(totals.discount)}</td>
                                            {data.company.vatEnabled && !data.company.isVatExempt && (
                                                <>
                                                    <td className="text-end">{formatCurrency(totals.taxable)}</td>
                                                    <td className="text-end">{formatCurrency(totals.vat)}</td>
                                                </>
                                            )}
                                            <td className="text-end">{formatCurrency(totals.roundOff)}</td>
                                            <td className="text-end">{formatCurrency(totals.amount)}</td>
                                            <td colSpan="2"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Product modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}
        </div>
    );
};

export default SalesQuotationList;