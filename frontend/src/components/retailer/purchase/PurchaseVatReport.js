import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Header from '../Header';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import '../../../stylesheet/noDateIcon.css'
import Loader from '../../Loader';

const PurchaseVatReport = () => {
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];
    const { draftSave, setDraftSave } = usePageNotRefreshContext();

    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });

    const [data, setData] = useState(() => {
        if (draftSave && draftSave.purchaseVatData) {
            return draftSave.purchaseVatData;
        }
        return {
            company: null,
            currentFiscalYear: null,
            purchaseVatReport: [],
            fromDate: '',
            toDate: company.dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
            companyDateFormat: 'english',
            currentCompanyName: ''
        };
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [totals, setTotals] = useState({
        totalAmount: 0,
        discountAmount: 0,
        nonVatPurchase: 0,
        taxableAmount: 0,
        vatAmount: 0
    });

    const [selectedRowIndex, setSelectedRowIndex] = useState(0);
    const [filteredReports, setFilteredReports] = useState([]);

    const fromDateRef = useRef(null);
    const toDateRef = useRef(null);
    const searchInputRef = useRef(null);
    const generateReportRef = useRef(null);
    const tableBodyRef = useRef(null);
    const [shouldFetch, setShouldFetch] = useState(false);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Save draft data
    useEffect(() => {
        if (data.purchaseVatReport.length > 0 || data.fromDate || data.toDate) {
            setDraftSave({
                ...draftSave,
                purchaseVatData: data
            });
        }
    }, [data]);

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


    // Fetch VAT report data
    useEffect(() => {
        const fetchData = async () => {
            if (!shouldFetch) return;

            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (data.fromDate) params.append('fromDate', data.fromDate);
                if (data.toDate) params.append('toDate', data.toDate);

                const response = await api.get('/api/retailer/purchase-vat-report', { params });
                setData({
                    ...response.data.data,
                    fromDate: data.fromDate,
                    toDate: data.toDate
                });
                setError(null);
                setSelectedRowIndex(0);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to fetch purchase VAT report');
            } finally {
                setLoading(false);
                setShouldFetch(false);
            }
        };

        fetchData();
    }, [shouldFetch]);

    // Filter reports based on search
    // useEffect(() => {
    //     const filtered = data.purchaseVatReport.filter(report => {
    //         return (
    //             report.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    //             report.account?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    //             report.pan?.toLowerCase().includes(searchQuery.toLowerCase())
    //         );
    //     });

    //     setFilteredReports(filtered);
    //     setSelectedRowIndex(0);
    // }, [data.purchaseVatReport, searchQuery]);

    // Filter reports based on search
    useEffect(() => {
        const filtered = data.purchaseVatReport.filter(report => {
            const billNumber = report.billNumber ? report.billNumber.toString().toLowerCase() : '';
            const account = report.account ? report.account.toString().toLowerCase() : '';
            const pan = report.pan ? report.pan.toString().toLowerCase() : '';

            return (
                billNumber.includes(searchQuery.toLowerCase()) ||
                account.includes(searchQuery.toLowerCase()) ||
                pan.includes(searchQuery.toLowerCase())
            );
        });

        setFilteredReports(filtered);
        setSelectedRowIndex(0);
    }, [data.purchaseVatReport, searchQuery]);

    // Calculate totals
    useEffect(() => {
        const newTotals = filteredReports.reduce((acc, report) => {
            return {
                totalAmount: acc.totalAmount + (report.totalAmount || 0),
                discountAmount: acc.discountAmount + (report.discountAmount || 0),
                nonVatPurchase: acc.nonVatPurchase + (report.nonVatPurchase || 0),
                taxableAmount: acc.taxableAmount + (report.taxableAmount || 0),
                vatAmount: acc.vatAmount + (report.vatAmount || 0)
            };
        }, {
            totalAmount: 0,
            discountAmount: 0,
            nonVatPurchase: 0,
            taxableAmount: 0,
            vatAmount: 0
        });

        setTotals(newTotals);
    }, [filteredReports]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (filteredReports.length === 0) return;

            const activeElement = document.activeElement;
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(activeElement.tagName)) return;

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.max(0, prev - 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.min(filteredReports.length - 1, prev + 1));
                    break;
                case 'Enter':
                    if (filteredReports[selectedRowIndex]) {
                        // Handle view action if needed
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredReports, selectedRowIndex]);

    // Scroll to selected row
    useEffect(() => {
        if (tableBodyRef.current && filteredReports.length > 0) {
            const rows = tableBodyRef.current.querySelectorAll('tr');
            if (rows.length > selectedRowIndex) {
                rows[selectedRowIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, filteredReports]);

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

    const handlePrint = () => {
        if (filteredReports.length === 0) {
            alert("No data to print");
            return;
        }

        const printWindow = window.open("", "_blank");

        // Helper functions for date formatting
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

        const formatDisplayDate = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            if (data.companyDateFormat === 'nepali') {
                return `${date.getDate()} ${getMonthName(dateString, data.companyDateFormat)} ${date.getFullYear()}`;
            }
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        };

        const printHeader = `
           <div class="print-header">
            <h1>${data.currentCompanyName || 'Company Name'}</h1>
            <p>
                ${data.currentCompany?.address || ''}-${data.currentCompany?.ward || ''}, ${data.currentCompany?.city || ''},
                TPIN: ${data.currentCompany?.pan || ''}<br>
                <h2 class="report-title">Purchase Book</h2>
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
                    padding: 0px; 
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
                .nowrap { 
                    white-space: nowrap; 
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
                .print-footer {
                    margin-top: 10px;
                    font-size: 9px;
                    text-align: right;
                }
                .month-year {
                    font-weight: bold;
                }
            </style>
            ${printHeader}
            
            <div class="report-period">
                <div>
                    <strong>Report Period:</strong> 
                    <span class="month-year">${getMonthName(data.fromDate, data.companyDateFormat)} ${getYear(data.fromDate)}</span>
                </div>
                <div>
                    <strong>From:</strong> ${formatDisplayDate(data.fromDate)} 
                    <strong>To:</strong> ${formatDisplayDate(data.toDate)}
                </div>
                <div>
                    <strong>Printed:</strong> ${new Date().toLocaleString()}
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Vch. No.</th>
                        <th>Supplier's Bill No.</th>
                        <th>Supplier's Name</th>
                        <th>Supplier's PAN</th>
                        <th class="text-end">Total Amount</th>
                        <th class="text-end">Discount</th>
                        <th class="text-end">Non-VAT Purchase</th>
                        <th class="text-end">Taxable Amount</th>
                        <th class="text-end">VAT</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filteredReports.forEach(report => {
            tableContent += `
                <tr>
                    <td>${new Date(report.date).toISOString().split('T')[0]}</td>
                    <td>${report.billNumber}</td>
                    <td>${report.partyBillNumber || '-'}</td>
                    <td>${report.account}</td>
                    <td>${report.panNumber || 'N/A'}</td>
                    <td class="text-end">${parseFloat(report.totalAmount || 0).toFixed(2)}</td>
                    <td class="text-end">${parseFloat(report.discountAmount || 0).toFixed(2)}</td>
                    <td class="text-end">${parseFloat(report.nonVatPurchase || 0).toFixed(2)}</td>
                    <td class="text-end">${parseFloat(report.taxableAmount || 0).toFixed(2)}</td>
                    <td class="text-end">${parseFloat(report.vatAmount || 0).toFixed(2)}</td>
                </tr>
            `;
        });

        // Add totals row
        tableContent += `
                <tr style="font-weight:bold;">
                    <td colspan="5">Grand Totals</td>
                    <td class="text-end">${totals.totalAmount.toFixed(2)}</td>
                    <td class="text-end">${totals.discountAmount.toFixed(2)}</td>
                    <td class="text-end">${totals.nonVatPurchase.toFixed(2)}</td>
                    <td class="text-end">${totals.taxableAmount.toFixed(2)}</td>
                    <td class="text-end">${totals.vatAmount.toFixed(2)}</td>
                </tr>
                </tbody>
            </table>
            
            <div class="print-footer">
                Printed from ${data.currentCompanyName || 'Company Name'} | Page 1 of 1
            </div>
        `;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Purchase VAT Report - ${getMonthName(data.fromDate, data.companyDateFormat)} ${getYear(data.fromDate)} - ${data.currentCompanyName || 'Company Name'}</title>
                </head>
                <body>
                    ${tableContent}
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

    // const formatCurrency = (num) => {
    //     return (num || 0).toLocaleString('en-US', {
    //         minimumFractionDigits: 2,
    //         maximumFractionDigits: 2
    //     });
    // };

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

    const handleKeyDown = (e, nextFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextFieldId) {
                document.getElementById(nextFieldId)?.focus();
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
                    <h1 className="h3 mb-0 text-center text-primary">Purchase VAT Report</h1>
                </div>

                <div className="card-body">
                    {/* Date Range Filter */}
                    <div className="row mb-4">
                        <div className="col-md-8">
                            <div className="row g-3 align-items-end">
                                <div className="col-md-3">
                                    <label htmlFor="fromDate" className="form-label">From Date</label>
                                    <input
                                        type="text"
                                        name="fromDate"
                                        id="fromDate"
                                        ref={company.dateFormat === 'nepali' ? fromDateRef : null}
                                        className="form-control no-date-icon"
                                        value={data.fromDate}
                                        onChange={handleDateChange}
                                        required
                                        autoComplete='off'
                                        onKeyDown={(e) => handleKeyDown(e, 'toDate')}
                                    />
                                </div>
                                <div className="col-md-3">
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
                                <div className="col-md-3">
                                    <button
                                        id="generateReport"
                                        className="btn btn-primary w-100"
                                        onClick={handleGenerateReport}
                                    >
                                        <i className="fas fa-chart-line me-2"></i>Generate Report
                                    </button>
                                </div>
                                <div className="col-md-3">
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Search..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            disabled={data.purchaseVatReport.length === 0}
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            disabled={data.purchaseVatReport.length === 0}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-md-4 d-flex align-items-end justify-content-end">
                            <button
                                className="btn btn-danger"
                                onClick={handlePrint}
                                disabled={data.purchaseVatReport.length === 0}
                            >
                                <i className="fas fa-print me-2"></i>Print Report
                            </button>
                        </div>
                    </div>

                    {data.purchaseVatReport.length === 0 ? (
                        <div className="alert alert-info text-center py-3">
                            <i className="fas fa-info-circle me-2"></i>
                            Select date range and generate report to view purchase VAT data
                        </div>
                    ) : (
                        <>
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Date</th>
                                            <th>Vch. No.</th>
                                            <th>Supplier's Bill No.</th>
                                            <th>Supplier's Name</th>
                                            <th>Supplier's PAN</th>
                                            <th className="text-end">Total Amount</th>
                                            <th className="text-end">Discount</th>
                                            <th className="text-end">Non-VAT Purchase</th>
                                            <th className="text-end">Taxable Amount</th>
                                            <th className="text-end">VAT</th>
                                        </tr>
                                    </thead>
                                    <tbody ref={tableBodyRef} className="table-data-rows">
                                        {filteredReports.map((report, index) => (
                                            <tr
                                                key={index}
                                                className={`${selectedRowIndex === index ? 'highlighted-row' : ''}`}
                                                onClick={() => handleRowClick(index)}
                                            >
                                                <td>{new Date(report.date).toISOString().split('T')[0]}</td>
                                                <td>{report.billNumber}</td>
                                                <td>{report.partyBillNumber || '-'}</td>
                                                <td>{report.account}</td>
                                                <td>{report.panNumber}</td>
                                                <td className="text-end">{formatCurrency(report.totalAmount)}</td>
                                                <td className="text-end">{formatCurrency(report.discountAmount)}</td>
                                                <td className="text-end">{formatCurrency(report.nonVatPurchase)}</td>
                                                <td className="text-end">{formatCurrency(report.taxableAmount)}</td>
                                                <td className="text-end">{formatCurrency(report.vatAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="table-active fw-bold">
                                            <td colSpan="5">Totals:</td>
                                            <td className="text-end">{formatCurrency(totals.totalAmount)}</td>
                                            <td className="text-end">{formatCurrency(totals.discountAmount)}</td>
                                            <td className="text-end">{formatCurrency(totals.nonVatPurchase)}</td>
                                            <td className="text-end">{formatCurrency(totals.taxableAmount)}</td>
                                            <td className="text-end">{formatCurrency(totals.vatAmount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="mt-3 text-end">
                                <small className="text-muted">
                                    Showing {filteredReports.length} of {data.purchaseVatReport.length} records
                                </small>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

<style>{`
    .table-data-rows tr {
        height: 36px;
    }
    .table-data-rows td {
        padding: 8px !important;
        vertical-align: middle !important;
    }
    .highlighted-row {
        background-color: #e6f7ff !important;
    }
`}</style>

export default PurchaseVatReport;