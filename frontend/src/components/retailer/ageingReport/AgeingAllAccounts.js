import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../Header';
import Loader from '../../Loader';
import * as XLSX from 'xlsx';

const AgeingReportAllAccounts = () => {
    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });
    const [data, setData] = useState({
        report: [],
        receivableTotals: { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 },
        payableTotals: { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 },
        netTotals: { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 },
        company: null,
        currentFiscalYear: null,
        initialFiscalYear: null,
        currentCompanyName: ''
    });

    const [loading, setLoading] = useState({ initial: true, table: false });
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sortConfig, setSortConfig] = useState({ key: 'accountName', direction: 'ascending' });
    const [showTotals, setShowTotals] = useState(true);
    const [exporting, setExporting] = useState(false);

    const navigate = useNavigate();
    const searchInputRef = useRef(null);
    const abortControllerRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    const fetchAgeingData = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        try {
            setLoading(prev => ({ ...prev, initial: true }));

            const response = await api.get('/api/retailer/ageing-report/all-accounts', {
                signal: abortControllerRef.current.signal
            });

            if (response.data.success) {
                setData(response.data.data);
                setCompany(prev => ({
                    ...prev,
                    company: response.data.data.company,
                    fiscalYear: response.data.data.currentFiscalYear
                }));
            } else {
                setError('Failed to load ageing data');
            }
        } catch (err) {
            if (err.name === 'AbortError' || err.name === 'CanceledError') {
                return;
            }
            console.error('Error fetching ageing data:', err);
            setError(err.response?.data?.error || 'Failed to load ageing report');
        } finally {
            setLoading(prev => ({ ...prev, initial: false }));
        }
    }, []);

    useEffect(() => {
        fetchAgeingData();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchAgeingData]);

    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    // const formatCurrency = (num) => {
    //     const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
    //     if (company.dateFormat === 'nepali') {
    //         return number.toLocaleString('en-IN', {
    //             minimumFractionDigits: 2,
    //             maximumFractionDigits: 2
    //         });
    //     }
    //     return number.toLocaleString('en-US', {
    //         minimumFractionDigits: 2,
    //         maximumFractionDigits: 2
    //     });
    // };

    const formatCurrency = (num) => {
        const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
        const absoluteNumber = Math.abs(number); // Take absolute value to remove negative sign

        if (company.dateFormat === 'nepali') {
            return absoluteNumber.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        return absoluteNumber.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const applyFilters = () => {
        let filteredReport = data.report.filter(account => {
            const typeMatches = typeFilter === 'all' ||
                (typeFilter === 'receivable' && account.isReceivable) ||
                (typeFilter === 'payable' && !account.isReceivable);

            const searchMatches = searchQuery === '' ||
                account.accountName.toLowerCase().includes(searchQuery.toLowerCase());

            const hasNonZeroBalance = Math.abs(account.netBalance) > 0.01;

            return typeMatches && searchMatches && hasNonZeroBalance;
        });

        filteredReport = filteredReport.sort((a, b) => {
            let aAccountName = a.accountName.toLowerCase();
            let bAccountName = b.accountName.toLowerCase();

            if (aAccountName < bAccountName) return -1;
            if (aAccountName > bAccountName) return 1;

            if (sortConfig.key && sortConfig.key !== 'accountName') {
                let aValue, bValue;

                if (sortConfig.key === 'type') {
                    aValue = a.isReceivable ? 'receivable' : 'payable';
                    bValue = b.isReceivable ? 'receivable' : 'payable';
                } else if (sortConfig.key === 'netBalance') {
                    aValue = a.netBalance;
                    bValue = b.netBalance;
                } else {
                    aValue = a.buckets[sortConfig.key];
                    bValue = b.buckets[sortConfig.key];
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
            }

            return 0;
        });

        const filteredReceivableTotals = { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 };
        const filteredPayableTotals = { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 };
        const filteredNetTotals = { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 };

        filteredReport.forEach(account => {
            if (account.isReceivable) {
                Object.keys(account.buckets).forEach(key => {
                    if (key !== 'total') {
                        filteredReceivableTotals[key] += account.buckets[key];
                        filteredNetTotals[key] += account.buckets[key];
                    }
                });
                filteredReceivableTotals.total += account.buckets.total;
                filteredNetTotals.total += account.buckets.total;
            } else {
                Object.keys(account.buckets).forEach(key => {
                    if (key !== 'total') {
                        filteredPayableTotals[key] += Math.abs(account.buckets[key]);
                        filteredNetTotals[key] -= Math.abs(account.buckets[key]);
                    }
                });
                filteredPayableTotals.total += Math.abs(account.buckets.total);
                filteredNetTotals.total -= Math.abs(account.buckets.total);
            }
        });

        return {
            filteredReport,
            filteredReceivableTotals,
            filteredPayableTotals,
            filteredNetTotals
        };
    };

    const sortItems = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }

        setSortConfig({ key, direction });
    };

    const { filteredReport, filteredReceivableTotals, filteredPayableTotals, filteredNetTotals } = applyFilters();

    const handleItemsPerPageChange = (e) => {
        const value = e.target.value;
        setItemsPerPage(value === 'all' ? 'all' : parseInt(value));
        setCurrentPage(1);
    };

    const handlePageChange = (newPage) => {
        if (itemsPerPage === 'all') return;

        const totalPages = Math.ceil(filteredReport.length / itemsPerPage);
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            window.scrollTo(0, 0);
        }
    };

    const currentPageItems = itemsPerPage === 'all'
        ? filteredReport
        : filteredReport.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getSortIndicator = (key) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'ascending' ? '↑' : '↓';
        }
        return '';
    };

    const handleKeyDown = (e, nextFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextFieldId) {
                document.getElementById(nextFieldId)?.focus();
            }
        }
    };

    const exportToExcel = async (exportAll = false) => {
        setExporting(true);
        try {
            const itemsToExport = exportAll ? filteredReport : currentPageItems;
            const totalsToUse = exportAll ? {
                filteredReceivableTotals,
                filteredPayableTotals,
                filteredNetTotals
            } : {
                filteredReceivableTotals: { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 },
                filteredPayableTotals: { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 },
                filteredNetTotals: { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 }
            };

            if (!exportAll) {
                itemsToExport.forEach(account => {
                    if (account.isReceivable) {
                        Object.keys(account.buckets).forEach(key => {
                            if (key !== 'total') {
                                totalsToUse.filteredReceivableTotals[key] += account.buckets[key];
                                totalsToUse.filteredNetTotals[key] += account.buckets[key];
                            }
                        });
                        totalsToUse.filteredReceivableTotals.total += account.buckets.total;
                        totalsToUse.filteredNetTotals.total += account.buckets.total;
                    } else {
                        Object.keys(account.buckets).forEach(key => {
                            if (key !== 'total') {
                                totalsToUse.filteredPayableTotals[key] += Math.abs(account.buckets[key]);
                                totalsToUse.filteredNetTotals[key] -= Math.abs(account.buckets[key]);
                            }
                        });
                        totalsToUse.filteredPayableTotals.total += Math.abs(account.buckets.total);
                        totalsToUse.filteredNetTotals.total -= Math.abs(account.buckets.total);
                    }
                });
            }

            const data = itemsToExport.map((account, index) => {
                return {
                    '#': exportAll ? index + 1 : ((currentPage - 1) * itemsPerPage) + index + 1,
                    'Account Name': account.accountName,
                    'Type': account.isReceivable ? 'Receivable' : 'Payable',
                    '0-30 Days': formatCurrency(account.buckets['0-30']),
                    '31-60 Days': formatCurrency(account.buckets['30-60']),
                    '61-90 Days': formatCurrency(account.buckets['60-90']),
                    '91-120 Days': formatCurrency(account.buckets['90-120']),
                    'Over 120 Days': formatCurrency(account.buckets['over-120']),
                    'Closing Balance': formatCurrency(account.netBalance)
                };
            });

            // Add totals rows
            data.push({});
            data.push({
                'Account Name': 'TOTAL RECEIVABLES',
                '0-30 Days': formatCurrency(totalsToUse.filteredReceivableTotals['0-30']),
                '31-60 Days': formatCurrency(totalsToUse.filteredReceivableTotals['30-60']),
                '61-90 Days': formatCurrency(totalsToUse.filteredReceivableTotals['60-90']),
                '91-120 Days': formatCurrency(totalsToUse.filteredReceivableTotals['90-120']),
                'Over 120 Days': formatCurrency(totalsToUse.filteredReceivableTotals['over-120']),
                'Closing Balance': formatCurrency(totalsToUse.filteredReceivableTotals.total)
            });

            data.push({
                'Account Name': 'TOTAL PAYABLES',
                '0-30 Days': formatCurrency(totalsToUse.filteredPayableTotals['0-30']),
                '31-60 Days': formatCurrency(totalsToUse.filteredPayableTotals['30-60']),
                '61-90 Days': formatCurrency(totalsToUse.filteredPayableTotals['60-90']),
                '91-120 Days': formatCurrency(totalsToUse.filteredPayableTotals['90-120']),
                'Over 120 Days': formatCurrency(totalsToUse.filteredPayableTotals['over-120']),
                'Closing Balance': formatCurrency(totalsToUse.filteredPayableTotals.total)
            });

            data.push({
                'Account Name': 'NET TOTAL',
                '0-30 Days': formatCurrency(totalsToUse.filteredNetTotals['0-30']),
                '31-60 Days': formatCurrency(totalsToUse.filteredNetTotals['30-60']),
                '61-90 Days': formatCurrency(totalsToUse.filteredNetTotals['60-90']),
                '91-120 Days': formatCurrency(totalsToUse.filteredNetTotals['90-120']),
                'Over 120 Days': formatCurrency(totalsToUse.filteredNetTotals['over-120']),
                'Closing Balance': formatCurrency(totalsToUse.filteredNetTotals.total)
            });

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Ageing Report');

            const date = new Date().toISOString().split('T')[0];
            const fileName = `Ageing_Report_${date}.xlsx`;

            XLSX.writeFile(wb, fileName);
        } catch (err) {
            console.error('Error exporting to Excel:', err);
            alert('Failed to export data');
        } finally {
            setExporting(false);
        }
    };

    const printReport = (printAll = false) => {
        const itemsToPrint = printAll ? filteredReport : currentPageItems;
        const totalsToUse = printAll ? {
            filteredReceivableTotals,
            filteredPayableTotals,
            filteredNetTotals
        } : {
            filteredReceivableTotals: { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 },
            filteredPayableTotals: { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 },
            filteredNetTotals: { '0-30': 0, '30-60': 0, '60-90': 0, '90-120': 0, 'over-120': 0, total: 0 }
        };

        if (!printAll) {
            itemsToPrint.forEach(account => {
                if (account.isReceivable) {
                    Object.keys(account.buckets).forEach(key => {
                        if (key !== 'total') {
                            totalsToUse.filteredReceivableTotals[key] += account.buckets[key];
                            totalsToUse.filteredNetTotals[key] += account.buckets[key];
                        }
                    });
                    totalsToUse.filteredReceivableTotals.total += account.buckets.total;
                    totalsToUse.filteredNetTotals.total += account.buckets.total;
                } else {
                    Object.keys(account.buckets).forEach(key => {
                        if (key !== 'total') {
                            totalsToUse.filteredPayableTotals[key] += Math.abs(account.buckets[key]);
                            totalsToUse.filteredNetTotals[key] -= Math.abs(account.buckets[key]);
                        }
                    });
                    totalsToUse.filteredPayableTotals.total += Math.abs(account.buckets.total);
                    totalsToUse.filteredNetTotals.total -= Math.abs(account.buckets.total);
                }
            });
        }

        if (itemsToPrint.length === 0) {
            alert("No data to print");
            return;
        }

        const printWindow = window.open('', '_blank');
        const printDate = new Date().toLocaleDateString();
        const fiscalYear = company.fiscalYear?.name || 'N/A';

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ageing Report</title>
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
                    .print-header { text-align: center; margin-bottom: 20px; }
                    .report-title {
                        text-align: center;
                        text-decoration: underline;
                        margin-bottom: 10px;
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
                    .text-end { 
                        text-align: right; 
                    }
                    .nowrap { 
                        white-space: nowrap; 
                    }
                    .print-footer {
                        margin-top: 10px;
                        font-size: 9px;
                        text-align: right;
                    }
                    .receivable-row { background-color: #e6f7ff; }
                    .payable-row { background-color: #fff7e6; }
                    .total-row { background-color: #e6e6e6; font-weight: bold; }
                    .net-total { background-color: #f0f0f0; font-weight: bold; }
                </style>
            </head>
            <body>
                    <div class="print-header">
            <h3>${data.currentCompanyName || 'Company Name'}</h3>
                <p>
                ${data.currentCompany?.address || ''}-${data.currentCompany?.ward || ''}, ${data.currentCompany?.city || ''}
            </p>
            <h2>Ageing Report</h2>
            <hr>
        </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <div>
                        <strong>As on:</strong> ${printDate} |
                        <strong>F.Y:</strong> ${fiscalYear}
                    </div>
                    <div>
                        <strong>Report:</strong> ${printAll ? 'All Accounts' : 'Current Page'} |
                        <strong>Total Accounts:</strong> ${itemsToPrint.length}
                        ${searchQuery ? `<br><strong>Search Filter:</strong> "${searchQuery}"` : ''}
                        ${typeFilter !== 'all' ? `<br><strong>Type Filter:</strong> ${typeFilter}` : ''}
                    </div>
                    <div>
                        <strong>Printed:</strong> ${new Date().toLocaleString()}
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Account</th>
                            <th>Type</th>
                            <th class="text-end">0-30 Days</th>
                            <th class="text-end">31-60 Days</th>
                            <th class="text-end">61-90 Days</th>
                            <th class="text-end">91-120 Days</th>
                            <th class="text-end">Over 120 Days</th>
                            <th class="text-end">Closing</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsToPrint.map((account, index) => `
                            <tr class="${account.isReceivable ? 'receivable-row' : 'payable-row'}">
                                <td>${index + 1}</td>
                                <td>${account.accountName}</td>
                                <td>${account.isReceivable ? 'Receivable' : 'Payable'}</td>
                                <td class="text-end">${formatCurrency(account.buckets['0-30'])}</td>
                                <td class="text-end">${formatCurrency(account.buckets['30-60'])}</td>
                                <td class="text-end">${formatCurrency(account.buckets['60-90'])}</td>
                                <td class="text-end">${formatCurrency(account.buckets['90-120'])}</td>
                                <td class="text-end">${formatCurrency(account.buckets['over-120'])}</td>
                                <td class="text-end">${formatCurrency(account.netBalance)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    ${showTotals && itemsToPrint.length > 0 ? `
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="3">Total Receivables</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredReceivableTotals['0-30'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredReceivableTotals['30-60'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredReceivableTotals['60-90'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredReceivableTotals['90-120'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredReceivableTotals['over-120'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredReceivableTotals.total)}</td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="3">Total Payables</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredPayableTotals['0-30'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredPayableTotals['30-60'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredPayableTotals['60-90'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredPayableTotals['90-120'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredPayableTotals['over-120'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredPayableTotals.total)}</td>
                        </tr>
                        <tr class="net-total">
                            <td colspan="3">Net Total</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredNetTotals['0-30'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredNetTotals['30-60'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredNetTotals['60-90'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredNetTotals['90-120'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredNetTotals['over-120'])}</td>
                            <td class="text-end">${formatCurrency(totalsToUse.filteredNetTotals.total)}</td>
                        </tr>
                    </tfoot>
                    ` : ''}
                </table>
                
                <div class="print-footer">
                    Printed from ${data.currentCompanyName || 'Company Name'} | Page 1 of 1
                </div>
                
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
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    if (loading.initial) return <Loader />;

    const totalPages = Math.ceil(filteredReport.length / (itemsPerPage === 'all' ? 1 : itemsPerPage));

    return (
        <div className="container-fluid">
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-2">
                    <h5 className="mb-0 text-center text-primary">
                        <i className="fas fa-file-invoice-dollar me-2"></i>Ageing Report
                    </h5>
                </div>

                <div className="card-body p-3">
                    {/* Search and Filter Section */}
                    <div className="row mb-3 g-2">
                        <div className="col-md-8">
                            <div className="row g-2">
                                <div className="col-md-6">
                                    <div className="input-group input-group-sm">
                                        <span className="input-group-text py-1">
                                            <i className="fas fa-search small"></i>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            ref={searchInputRef}
                                            placeholder="Search account name..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            autoComplete="off"
                                            onKeyDown={(e) => handleKeyDown(e, 'typeFilter')}
                                        />
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <div className="d-flex align-items-center h-100 gap-2">
                                        <select
                                            id="typeFilter"
                                            className="form-select form-select-sm"
                                            value={typeFilter}
                                            onChange={(e) => setTypeFilter(e.target.value)}
                                            style={{ width: 'auto' }}
                                        >
                                            <option value="all">All Types</option>
                                            <option value="receivable">Receivable Only</option>
                                            <option value="payable">Payable Only</option>
                                        </select>

                                        <div className="form-check form-switch form-check-sm">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id="showTotals"
                                                checked={showTotals}
                                                onChange={() => setShowTotals(!showTotals)}
                                            />
                                            <label className="form-check-label small" htmlFor="showTotals">
                                                Show Totals
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons and Display Options */}
                        <div className="col-md-4">
                            <div className="d-flex justify-content-end gap-1 align-items-center">
                                <div className="me-2">
                                    <select
                                        className="form-select form-select-sm"
                                        value={itemsPerPage}
                                        onChange={handleItemsPerPageChange}
                                        style={{ width: 'auto' }}
                                    >
                                        <option value="10">10 per page</option>
                                        <option value="25">25 per page</option>
                                        <option value="50">50 per page</option>
                                        <option value="all">All accounts</option>
                                    </select>
                                </div>
                                {/* Export Buttons */}
                                <button
                                    className="btn btn-outline-success btn-sm"
                                    onClick={() => exportToExcel(false)}
                                    disabled={currentPageItems.length === 0 || exporting}
                                    title="Export current page to Excel"
                                >
                                    <i className="fas fa-file-excel me-1 small"></i>Export Page
                                </button>
                                <button
                                    className="btn btn-success btn-sm"
                                    onClick={() => exportToExcel(true)}
                                    disabled={filteredReport.length === 0 || exporting}
                                    title="Export all filtered accounts to Excel"
                                >
                                    <i className="fas fa-file-excel me-1 small"></i>Export All
                                </button>
                                <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => printReport(false)}
                                    disabled={currentPageItems.length === 0}
                                >
                                    <i className="fas fa-print me-1 small"></i>Print Page
                                </button>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => printReport(true)}
                                    disabled={filteredReport.length === 0}
                                >
                                    <i className="fas fa-print me-1 small"></i>Print All
                                </button>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-danger text-center py-1 mb-2 small">
                            <i className="fas fa-exclamation-circle me-1"></i>
                            {error}
                            <button
                                type="button"
                                className="btn-close btn-sm ms-2"
                                onClick={() => setError(null)}
                                aria-label="Close"
                            ></button>
                        </div>
                    )}

                    {/* Table */}
                    <div className="table-responsive compact-table">
                        <table className="table table-hover mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th width="30px" className="small">#</th>
                                    <th
                                        className="small sortable"
                                        onClick={() => sortItems('accountName')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Account Name {getSortIndicator('accountName')}
                                    </th>
                                    <th
                                        className="small sortable"
                                        onClick={() => sortItems('type')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Type {getSortIndicator('type')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('0-30')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        0-30 Days {getSortIndicator('0-30')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('30-60')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        31-60 Days {getSortIndicator('30-60')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('60-90')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        61-90 Days {getSortIndicator('60-90')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('90-120')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        91-120 Days {getSortIndicator('90-120')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('over-120')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Over 120 Days {getSortIndicator('over-120')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('netBalance')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Closing {getSortIndicator('netBalance')}
                                    </th>
                                </tr>
                            </thead>

                            {currentPageItems.length === 0 ? (
                                <tbody>
                                    <tr>
                                        <td colSpan="9" className="text-center py-3 small">
                                            <i className="fas fa-info-circle me-1"></i>
                                            {searchQuery || typeFilter !== 'all'
                                                ? 'No accounts match your search criteria'
                                                : 'No accounts found'}
                                        </td>
                                    </tr>
                                </tbody>
                            ) : (
                                <>
                                    <tbody>
                                        {currentPageItems.map((account, index) => (
                                            <tr key={index} className={`compact-row ${account.isReceivable ? 'table-info' : 'table-warning'}`}>
                                                <td className="small">{itemsPerPage === 'all' ? index + 1 : ((currentPage - 1) * itemsPerPage) + index + 1}</td>
                                                <td className="small fw-bold">{account.accountName}</td>
                                                <td className="small">
                                                    <span className={`badge ${account.isReceivable ? 'bg-info' : 'bg-warning'}`}>
                                                        {account.isReceivable ? 'Receivable' : 'Payable'}
                                                    </span>
                                                </td>
                                                <td className="text-end small">{formatCurrency(account.buckets['0-30'])}</td>
                                                <td className="text-end small">{formatCurrency(account.buckets['30-60'])}</td>
                                                <td className="text-end small">{formatCurrency(account.buckets['60-90'])}</td>
                                                <td className="text-end small">{formatCurrency(account.buckets['90-120'])}</td>
                                                <td className="text-end small">{formatCurrency(account.buckets['over-120'])}</td>
                                                <td className="text-end fw-bold small">{formatCurrency(account.netBalance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {showTotals && (
                                        <tfoot className="table-group-divider">
                                            <tr className="fw-bold small table-secondary">
                                                <td colSpan="3">Total Receivables</td>
                                                <td className="text-end">{formatCurrency(filteredReceivableTotals['0-30'])}</td>
                                                <td className="text-end">{formatCurrency(filteredReceivableTotals['30-60'])}</td>
                                                <td className="text-end">{formatCurrency(filteredReceivableTotals['60-90'])}</td>
                                                <td className="text-end">{formatCurrency(filteredReceivableTotals['90-120'])}</td>
                                                <td className="text-end">{formatCurrency(filteredReceivableTotals['over-120'])}</td>
                                                <td className="text-end">{formatCurrency(filteredReceivableTotals.total)}</td>
                                            </tr>
                                            <tr className="fw-bold small table-secondary">
                                                <td colSpan="3">Total Payables</td>
                                                <td className="text-end">{formatCurrency(filteredPayableTotals['0-30'])}</td>
                                                <td className="text-end">{formatCurrency(filteredPayableTotals['30-60'])}</td>
                                                <td className="text-end">{formatCurrency(filteredPayableTotals['60-90'])}</td>
                                                <td className="text-end">{formatCurrency(filteredPayableTotals['90-120'])}</td>
                                                <td className="text-end">{formatCurrency(filteredPayableTotals['over-120'])}</td>
                                                <td className="text-end">{formatCurrency(filteredPayableTotals.total)}</td>
                                            </tr>
                                            <tr className="fw-bold small table-primary">
                                                <td colSpan="3">Net Total</td>
                                                <td className="text-end">{formatCurrency(filteredNetTotals['0-30'])}</td>
                                                <td className="text-end">{formatCurrency(filteredNetTotals['30-60'])}</td>
                                                <td className="text-end">{formatCurrency(filteredNetTotals['60-90'])}</td>
                                                <td className="text-end">{formatCurrency(filteredNetTotals['90-120'])}</td>
                                                <td className="text-end">{formatCurrency(filteredNetTotals['over-120'])}</td>
                                                <td className="text-end">{formatCurrency(filteredNetTotals.total)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </>
                            )}
                        </table>
                    </div>

                    {/* Bottom Pagination - Only show if not displaying all items */}
                    {itemsPerPage !== 'all' && totalPages > 1 && (
                        <div className="row mt-2">
                            <div className="col-12">
                                <nav>
                                    <ul className="pagination justify-content-center pagination-sm">
                                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                            <button
                                                className="page-link"
                                                onClick={() => handlePageChange(currentPage - 1)}
                                            >
                                                Previous
                                            </button>
                                        </li>

                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }

                                            return (
                                                <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                                                    <button
                                                        className="page-link"
                                                        onClick={() => handlePageChange(pageNum)}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                </li>
                                            );
                                        })}

                                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                            <button
                                                className="page-link"
                                                onClick={() => handlePageChange(currentPage + 1)}
                                            >
                                                Next
                                            </button>
                                        </li>
                                    </ul>
                                </nav>
                                <div className="text-center text-muted small">
                                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredReport.length)} of {filteredReport.length} accounts
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>
                {`
                    .compact-table .table {
                        margin-bottom: 0;
                        font-size: 0.8rem;
                    }
                    
                    .compact-table th,
                    .compact-table td {
                        padding: 4px 6px;
                    }
                    
                    .compact-row td {
                        padding: 4px 6px !important;
                        vertical-align: middle;
                    }
                    
                    .badge {
                        font-size: 0.65rem;
                        padding: 2px 4px;
                    }
                    
                    .form-check-label.small {
                        font-size: 0.8rem;
                    }
                    
                    .input-group-sm {
                        height: 30px;
                    }
                    
                    .btn-sm {
                        padding: 0.25rem 0.5rem;
                        font-size: 0.75rem;
                    }
                    
                    .sortable:hover {
                        background-color: #f8f9fa;
                    }
                `}
            </style>
        </div>
    );
};

export default AgeingReportAllAccounts;