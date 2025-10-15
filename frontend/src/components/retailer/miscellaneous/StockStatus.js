import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../Header';
import Loader from '../../Loader';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import * as XLSX from 'xlsx';

const StockStatus = () => {
    const { draftStockStatusSave, setDraftStockStatusSave } = usePageNotRefreshContext();
    const [allItems, setAllItems] = useState(() => {
        if (draftStockStatusSave && draftStockStatusSave.stockStatusData) {
            return draftStockStatusSave.stockStatusData.allItems || [];
        }
        return [];
    });
    const [filteredItems, setFilteredItems] = useState(() => {
        if (draftStockStatusSave && draftStockStatusSave.stockStatusData) {
            return draftStockStatusSave.stockStatusData.filteredItems || [];
        }
        return [];
    });
    const [currentPageItems, setCurrentPageItems] = useState([]);
    const [displayOptions, setDisplayOptions] = useState(() => {
        if (draftStockStatusSave && draftStockStatusSave.stockStatusData) {
            return draftStockStatusSave.stockStatusData.displayOptions || {
                showPurchaseValue: false,
                showSalesValue: false
            };
        }
        return {
            showPurchaseValue: false,
            showSalesValue: false
        };
    });
    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        company: null,
        fiscalYear: null
    });
    const [loading, setLoading] = useState({
        initial: true,
        table: false,
        printAll: false
    });
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState(() => {
        if (draftStockStatusSave && draftStockStatusSave.stockStatusData) {
            return draftStockStatusSave.stockStatusData.searchQuery || '';
        }
        return '';
    });
    const [currentPage, setCurrentPage] = useState(() => {
        if (draftStockStatusSave && draftStockStatusSave.stockStatusData) {
            return draftStockStatusSave.stockStatusData.currentPage || 1;
        }
        return 1;
    });
    const [itemsPerPage, setItemsPerPage] = useState(() => {
        if (draftStockStatusSave && draftStockStatusSave.stockStatusData) {
            return draftStockStatusSave.stockStatusData.itemsPerPage || 10;
        }
        return 10;
    });
    // Set initial sort to name in ascending order (A-Z)
    const [sortConfig, setSortConfig] = useState(() => {
        if (draftStockStatusSave && draftStockStatusSave.stockStatusData) {
            return draftStockStatusSave.stockStatusData.sortConfig || {
                key: 'name',
                direction: 'ascending'
            };
        }
        return {
            key: 'name',
            direction: 'ascending'
        };
    });
    const navigate = useNavigate();
    const searchInputRef = useRef(null);
    const abortControllerRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Add this near your other useEffects
    useEffect(() => {
        const fetchCompanyData = async () => {
            try {
                const response = await api.get('/api/my-company');
                if (response.data.success) {
                    const { company: companyData, currentFiscalYear } = response.data;

                    // Update company state with additional details
                    setCompany(prev => ({
                        ...prev,
                        company: {
                            ...prev.company,
                            currentCompanyName: companyData.currentCompanyName,
                            address: companyData.address,
                            city: companyData.city,
                            pan: companyData.pan,
                            ward: companyData.ward
                        },
                        fiscalYear: currentFiscalYear
                    }));
                }
            } catch (err) {
                console.error('Error fetching company data:', err);
            }
        };

        fetchCompanyData();
    }, []);

    // Fetch all stock items on component mount
    const fetchAllStockItems = useCallback(async () => {

        if (draftStockStatusSave && draftStockStatusSave.stockStatusData && draftStockStatusSave.stockStatusData.allItems.length > 0) {
            setLoading(prev => ({ ...prev, initial: false }));
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        try {
            setLoading(prev => ({ ...prev, initial: true }));

            const response = await api.get(`/api/retailer/stock-status?limit=10000`, {
                signal: abortControllerRef.current.signal
            });

            setAllItems(response.data.items);
            setFilteredItems(response.data.items);
            setCompany({
                company: response.data.company,
                fiscalYear: response.data.fiscalYear
            });
            setLoading(prev => ({ ...prev, initial: false }));
        } catch (err) {
            if (err.name === 'AbortError' || err.name === 'CanceledError') {
                return;
            }

            setError(err.response?.data?.error || 'Failed to fetch stock status');
            setLoading(prev => ({ ...prev, initial: false }));
        }
    }, []);

    // Save to draft whenever relevant state changes
    useEffect(() => {
        setDraftStockStatusSave({
            ...draftStockStatusSave,
            stockStatusData: {
                allItems,
                filteredItems,
                displayOptions,
                searchQuery,
                itemsPerPage,
                currentPage,
                sortConfig // Save sort config to draft
            }
        });
    }, [allItems, filteredItems, displayOptions, searchQuery, itemsPerPage, currentPage, sortConfig]);

    // Cleanup on unmount
    useEffect(() => {
        fetchAllStockItems();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchAllStockItems]);

    // Sorting function
    const sortItems = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }

        setSortConfig({ key, direction });

        const sortedItems = [...filteredItems].sort((a, b) => {
            // Handle numeric values
            if (['stock', 'openingStock', 'totalQtyIn', 'totalQtyOut',
                'minStock', 'maxStock', 'avgPuPrice', 'avgPrice',
                'totalStockValuePurchase', 'totalStockValueSales'].includes(key)) {
                const aValue = a[key] || 0;
                const bValue = b[key] || 0;

                if (direction === 'ascending') {
                    return aValue - bValue;
                } else {
                    return bValue - aValue;
                }
            }

            // Handle string values
            const aValue = (a[key] || '').toString().toLowerCase();
            const bValue = (b[key] || '').toString().toLowerCase();

            if (direction === 'ascending') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        });

        setFilteredItems(sortedItems);
    };

    // Apply initial sorting when component loads or when allItems changes
    useEffect(() => {
        if (allItems.length > 0) {
            // Apply the current sort configuration
            const sortedItems = [...allItems].sort((a, b) => {
                const key = sortConfig.key;
                const direction = sortConfig.direction;

                // Handle numeric values
                if (['stock', 'openingStock', 'totalQtyIn', 'totalQtyOut',
                    'minStock', 'maxStock', 'avgPuPrice', 'avgPrice',
                    'totalStockValuePurchase', 'totalStockValueSales'].includes(key)) {
                    const aValue = a[key] || 0;
                    const bValue = b[key] || 0;

                    if (direction === 'ascending') {
                        return aValue - bValue;
                    } else {
                        return bValue - aValue;
                    }
                }

                // Handle string values (default to name sorting)
                const aValue = (a[key] || a.name || '').toString().toLowerCase();
                const bValue = (b[key] || b.name || '').toString().toLowerCase();

                if (direction === 'ascending') {
                    return aValue.localeCompare(bValue);
                } else {
                    return bValue.localeCompare(aValue);
                }
            });

            setFilteredItems(sortedItems);
        }
    }, [allItems, sortConfig]); // Add sortConfig as dependency

    // Filter items based on search query
    useEffect(() => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const filtered = allItems.filter(item =>
                item.name.toLowerCase().includes(query) ||
                (item.code && item.code.toString().toLowerCase().includes(query))
            );

            // Apply current sorting to filtered results
            const sortedFiltered = [...filtered].sort((a, b) => {
                const key = sortConfig.key;
                const direction = sortConfig.direction;

                // Handle numeric values
                if (['stock', 'openingStock', 'totalQtyIn', 'totalQtyOut',
                    'minStock', 'maxStock', 'avgPuPrice', 'avgPrice',
                    'totalStockValuePurchase', 'totalStockValueSales'].includes(key)) {
                    const aValue = a[key] || 0;
                    const bValue = b[key] || 0;

                    if (direction === 'ascending') {
                        return aValue - bValue;
                    } else {
                        return bValue - aValue;
                    }
                }

                // Handle string values (default to name sorting)
                const aValue = (a[key] || a.name || '').toString().toLowerCase();
                const bValue = (b[key] || b.name || '').toString().toLowerCase();

                if (direction === 'ascending') {
                    return aValue.localeCompare(bValue);
                } else {
                    return bValue.localeCompare(aValue);
                }
            });

            setFilteredItems(sortedFiltered);
        } else {
            // If no search query, apply sorting to all items
            const sortedItems = [...allItems].sort((a, b) => {
                const key = sortConfig.key;
                const direction = sortConfig.direction;

                // Handle numeric values
                if (['stock', 'openingStock', 'totalQtyIn', 'totalQtyOut',
                    'minStock', 'maxStock', 'avgPuPrice', 'avgPrice',
                    'totalStockValuePurchase', 'totalStockValueSales'].includes(key)) {
                    const aValue = a[key] || 0;
                    const bValue = b[key] || 0;

                    if (direction === 'ascending') {
                        return aValue - bValue;
                    } else {
                        return bValue - aValue;
                    }
                }

                // Handle string values (default to name sorting)
                const aValue = (a[key] || a.name || '').toString().toLowerCase();
                const bValue = (b[key] || b.name || '').toString().toLowerCase();

                if (direction === 'ascending') {
                    return aValue.localeCompare(bValue);
                } else {
                    return bValue.localeCompare(aValue);
                }
            });

            setFilteredItems(sortedItems);
        }
        setCurrentPage(1);
    }, [searchQuery, allItems, sortConfig]); // Add sortConfig as dependency

    // Paginate items
    useEffect(() => {
        if (itemsPerPage === 'all') {
            setCurrentPageItems(filteredItems);
        } else {
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            setCurrentPageItems(filteredItems.slice(startIndex, endIndex));
        }
    }, [filteredItems, currentPage, itemsPerPage]);

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setDisplayOptions(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const handleItemsPerPageChange = (e) => {
        const value = e.target.value;
        setItemsPerPage(value === 'all' ? 'all' : parseInt(value));
        setCurrentPage(1);
    };

    const handlePageChange = (newPage) => {
        if (itemsPerPage === 'all') return;

        const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            window.scrollTo(0, 0);
        }
    };

    // Calculate totals for current page
    const totals = React.useMemo(() => {
        return currentPageItems.reduce((acc, item) => {
            acc.totalStock += item.stock;
            acc.totalOpeningStock += item.openingStock;
            acc.totalQtyIn += item.totalQtyIn;
            acc.totalQtyOut += item.totalQtyOut;

            if (displayOptions.showPurchaseValue) {
                acc.totalPurchaseValue += item.totalStockValuePurchase;
            }

            if (displayOptions.showSalesValue) {
                acc.totalSalesValue += item.totalStockValueSales;
            }

            return acc;
        }, {
            totalStock: 0,
            totalOpeningStock: 0,
            totalQtyIn: 0,
            totalQtyOut: 0,
            totalPurchaseValue: 0,
            totalSalesValue: 0
        });
    }, [currentPageItems, displayOptions]);

    // Calculate totals for all filtered items
    const allFilteredTotals = React.useMemo(() => {
        return filteredItems.reduce((acc, item) => {
            acc.totalStock += item.stock;
            acc.totalOpeningStock += item.openingStock;
            acc.totalQtyIn += item.totalQtyIn;
            acc.totalQtyOut += item.totalQtyOut;

            if (displayOptions.showPurchaseValue) {
                acc.totalPurchaseValue += item.totalStockValuePurchase;
            }

            if (displayOptions.showSalesValue) {
                acc.totalSalesValue += item.totalStockValueSales;
            }

            return acc;
        }, {
            totalStock: 0,
            totalOpeningStock: 0,
            totalQtyIn: 0,
            totalQtyOut: 0,
            totalPurchaseValue: 0,
            totalSalesValue: 0
        });
    }, [filteredItems, displayOptions]);

    // Format currency function
    // const formatCurrency = (num) => {
    //     const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
    //     return number.toLocaleString('en-US', {
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

    // Print function
    const printStockStatus = async (printAll = false) => {
        let itemsToPrint = printAll ? filteredItems : currentPageItems;
        let totalsToUse = printAll ? allFilteredTotals : totals;

        if (itemsToPrint.length === 0) return;

        const printWindow = window.open('', '_blank');
        const printDate = new Date().toLocaleDateString();
        const fiscalYear = company.fiscalYear?.name || 'N/A';

        const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Stock Status Report</title>
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
            .print-header { 
                text-align: center; 
                margin-bottom: 15px; 
            }
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
        </style>
    </head>
    <body>
        <div class="print-header">
            <h1>${company.company?.currentCompanyName || 'Company Name'}</h1>
            <p>
                ${company.company?.address || ''}-${company.company?.ward || ''}, ${company.company?.city || ''},
                TPIN: ${company.company?.pan || ''}<br>
                <h2 class="report-title">Stock Status Report</h2>
            </p>
            <hr>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
            <div>
                <strong>As on:</strong> ${printDate} |
                <strong>F.Y:</strong> ${fiscalYear}
            </div>
            <div>
                <strong>Report:</strong> ${printAll ? 'All Items' : 'Current Page'} |
                <strong>Total Items:</strong> ${itemsToPrint.length}
                ${searchQuery ? `<br><strong>Search Filter:</strong> "${searchQuery}"` : ''}
            </div>
            <div>
                <strong>Printed:</strong> ${new Date().toLocaleString()}
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th class="text-end">Stock</th>
                    <th class="text-end">Op. Stock</th>
                    <th class="text-end">Qty. In</th>
                    <th class="text-end">Qty. Out</th>
                    <th class="text-end">Min Stock</th>
                    <th class="text-end">Max Stock</th>
                    <th class="text-end">C.P</th>
                    <th class="text-end">S.P</th>
                    ${displayOptions.showPurchaseValue ? '<th class="text-end">St.Val (C.P)</th>' : ''}
                    ${displayOptions.showSalesValue ? '<th class="text-end">St.Val (S.P)</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${itemsToPrint.map((item, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.name}${item.code ? ` (${item.code})` : ''}</td>
                        <td>${item.category || '-'}</td>
                        <td>${item.unit || '-'}</td>
                        <td class="text-end">${formatCurrency(item.stock)}</td>
                        <td class="text-end">${formatCurrency(item.openingStock)}</td>
                        <td class="text-end">${formatCurrency(item.totalQtyIn)}</td>
                        <td class="text-end">${formatCurrency(item.totalQtyOut)}</td>
                        <td class="text-end">${item.minStock || '-'}</td>
                        <td class="text-end">${item.maxStock || '-'}</td>
                        <td class="text-end">${formatCurrency(item.avgPuPrice)}</td>
                        <td class="text-end">${formatCurrency(item.avgPrice)}</td>
                        ${displayOptions.showPurchaseValue ? `<td class="text-end">${formatCurrency(item.totalStockValuePurchase)}</td>` : ''}
                        ${displayOptions.showSalesValue ? `<td class="text-end">${formatCurrency(item.totalStockValueSales)}</td>` : ''}
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr style="font-weight:bold;">
                    <td colspan="4">Totals</td>
                    <td class="text-end">${formatCurrency(totalsToUse.totalStock)}</td>
                    <td class="text-end">${formatCurrency(totalsToUse.totalOpeningStock)}</td>
                    <td class="text-end">${formatCurrency(totalsToUse.totalQtyIn)}</td>
                    <td class="text-end">${formatCurrency(totalsToUse.totalQtyOut)}</td>
                    <td colspan="2"></td>
                    <td></td>
                    <td></td>
                    ${displayOptions.showPurchaseValue ? `<td class="text-end">${formatCurrency(totalsToUse.totalPurchaseValue)}</td>` : ''}
                    ${displayOptions.showSalesValue ? `<td class="text-end">${formatCurrency(totalsToUse.totalSalesValue)}</td>` : ''}
                </tr>
            </tfoot>
        </table>
        
        <div class="print-footer">
            Printed from ${company.company?.name || 'Company Name'} | Page 1 of 1
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

    const handleKeyDown = (e, nextFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextFieldId) {
                document.getElementById(nextFieldId)?.focus();
            }
        }
    };

    if (loading.initial) return <Loader />;

    const totalPages = Math.ceil(filteredItems.length / (itemsPerPage === 'all' ? 1 : itemsPerPage));
    const columnCount = 12 + (displayOptions.showPurchaseValue ? 1 : 0) + (displayOptions.showSalesValue ? 1 : 0);

    // Function to get sort indicator
    const getSortIndicator = (key) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'ascending' ? '↑' : '↓';
        }
        return '';
    };

    // Export to Excel function
    const exportToExcel = async (exportAll = false) => {
        let itemsToExport = exportAll ? filteredItems : currentPageItems;
        let totalsToUse = exportAll ? allFilteredTotals : totals;

        if (itemsToExport.length === 0) return;

        // Prepare data for Excel
        const data = itemsToExport.map((item, index) => {
            const rowData = {
                '#': exportAll ? index + 1 : ((currentPage - 1) * itemsPerPage) + index + 1,
                'Code': item.code || '',
                'Item Name': item.name,
                'Category': item.category || '-',
                'Unit': item.unit || '-',
                'Stock': formatCurrency(item.stock),
                'Op. Stock': formatCurrency(item.openingStock),
                'Qty. In': formatCurrency(item.totalQtyIn),
                'Qty. Out': formatCurrency(item.totalQtyOut),
                'Min Stock': item.minStock || '-',
                'Max Stock': item.maxStock || '-',
                'C.P': formatCurrency(item.avgPuPrice),
                'S.P': formatCurrency(item.avgPrice)
            };

            if (displayOptions.showPurchaseValue) {
                rowData['Stock Value (CP)'] = formatCurrency(item.totalStockValuePurchase);
            }

            if (displayOptions.showSalesValue) {
                rowData['Stock Value (SP)'] = formatCurrency(item.totalStockValueSales);
            }

            return rowData;
        });

        // Add totals row
        const totalsRow = {
            '#': '',
            'Code': '',
            'Item Name': 'TOTALS',
            'Category': '',
            'Unit': '',
            'Stock': formatCurrency(totalsToUse.totalStock),
            'Op. Stock': formatCurrency(totalsToUse.totalOpeningStock),
            'Qty. In': formatCurrency(totalsToUse.totalQtyIn),
            'Qty. Out': formatCurrency(totalsToUse.totalQtyOut),
            'Min Stock': '',
            'Max Stock': '',
            'C.P': '',
            'S.P': ''
        };

        if (displayOptions.showPurchaseValue) {
            totalsRow['Stock Value (CP)'] = formatCurrency(totalsToUse.totalPurchaseValue);
        }

        if (displayOptions.showSalesValue) {
            totalsRow['Stock Value (SP)'] = formatCurrency(totalsToUse.totalSalesValue);
        }

        data.push(totalsRow);

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(data);

        // Set column widths
        const colWidths = [
            { wch: 5 },  // #
            { wch: 5 }, // Code
            { wch: 30 }, // Item Name
            { wch: 20 }, // Category
            { wch: 10 }, // Unit
            { wch: 12 }, // Total Stock
            { wch: 12 }, // Opening Stock
            { wch: 12 }, // Quantity In
            { wch: 12 }, // Quantity Out
            { wch: 10 }, // Min Stock
            { wch: 10 }, // Max Stock
            { wch: 12 }, // Cost Price
            { wch: 12 }, // Selling Price
        ];

        if (displayOptions.showPurchaseValue) {
            colWidths.push({ wch: 15 }); // Stock Value (CP)
        }

        if (displayOptions.showSalesValue) {
            colWidths.push({ wch: 15 }); // Stock Value (SP)
        }

        ws['!cols'] = colWidths;

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stock Status');

        // Generate file name
        const date = new Date().toISOString().split('T')[0];
        const fileName = `Stock_Status_${date}.xlsx`;

        // Export to Excel
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="container-fluid">
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-2">
                    <h5 className="mb-0 text-center text-primary">
                        <i className="fas fa-boxes me-2"></i>Stock Status
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
                                            placeholder="Search by item name or code..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            autoComplete="off"
                                            onKeyDown={(e) => handleKeyDown(e, 'showPurchaseValue')}
                                        />
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <div className="d-flex align-items-center h-100 gap-2">
                                        <div className="form-check form-switch form-check-sm">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id="showPurchaseValue"
                                                checked={displayOptions.showPurchaseValue}
                                                onChange={handleCheckboxChange}
                                                name="showPurchaseValue"
                                            />
                                            <label className="form-check-label small" htmlFor="showPurchaseValue">
                                                Show CP Value
                                            </label>
                                        </div>
                                        <div className="form-check form-switch form-check-sm">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id="showSalesValue"
                                                checked={displayOptions.showSalesValue}
                                                onChange={handleCheckboxChange}
                                                name="showSalesValue"
                                            />
                                            <label className="form-check-label small" htmlFor="showSalesValue">
                                                Show SP Value
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
                                        <option value="all">All items</option>
                                    </select>
                                </div>
                                {/* Export Buttons */}
                                <button
                                    className="btn btn-outline-success btn-sm"
                                    onClick={() => exportToExcel(false)}
                                    disabled={currentPageItems.length === 0}
                                    title="Export current page to Excel"
                                >
                                    <i className="fas fa-file-excel me-1 small"></i>Export Page
                                </button>
                                <button
                                    className="btn btn-success btn-sm"
                                    onClick={() => exportToExcel(true)}
                                    disabled={filteredItems.length === 0}
                                    title="Export all filtered items to Excel"
                                >
                                    <i className="fas fa-file-excel me-1 small"></i>Export All
                                </button>
                                <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => printStockStatus(false)}
                                    disabled={currentPageItems.length === 0}
                                >
                                    <i className="fas fa-print me-1 small"></i>Print Page
                                </button>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => printStockStatus(true)}
                                    disabled={filteredItems.length === 0}
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
                                    <th width="30px" className="small">Code</th>
                                    <th
                                        className="small sortable"
                                        onClick={() => sortItems('name')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Item Name {getSortIndicator('name')}
                                    </th>
                                    <th
                                        className="small sortable"
                                        onClick={() => sortItems('category')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Category {getSortIndicator('category')}
                                    </th>
                                    <th
                                        className="small sortable"
                                        onClick={() => sortItems('unit')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Unit {getSortIndicator('unit')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('stock')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Stock {getSortIndicator('stock')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('openingStock')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Op. Stock {getSortIndicator('openingStock')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('totalQtyIn')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Qty. In {getSortIndicator('totalQtyIn')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('totalQtyOut')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Qty. Out {getSortIndicator('totalQtyOut')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('minStock')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Min {getSortIndicator('minStock')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('maxStock')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Max {getSortIndicator('maxStock')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('avgPuPrice')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        C.P {getSortIndicator('avgPuPrice')}
                                    </th>
                                    <th
                                        className="text-end small sortable"
                                        onClick={() => sortItems('avgPrice')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        S.P {getSortIndicator('avgPrice')}
                                    </th>
                                    {displayOptions.showPurchaseValue && (
                                        <th
                                            className="text-end small sortable"
                                            onClick={() => sortItems('totalStockValuePurchase')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            Val (CP) {getSortIndicator('totalStockValuePurchase')}
                                        </th>
                                    )}
                                    {displayOptions.showSalesValue && (
                                        <th
                                            className="text-end small sortable"
                                            onClick={() => sortItems('totalStockValueSales')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            Val (SP) {getSortIndicator('totalStockValueSales')}
                                        </th>
                                    )}
                                </tr>
                            </thead>

                            {currentPageItems.length === 0 ? (
                                <tbody>
                                    <tr>
                                        <td colSpan={columnCount} className="text-center py-3 small">
                                            <i className="fas fa-info-circle me-1"></i>
                                            {searchQuery ? 'No items match your search criteria' : 'No stock items found in your inventory'}
                                        </td>
                                    </tr>
                                </tbody>
                            ) : (
                                <>
                                    <tbody>
                                        {currentPageItems.map((item, index) => (
                                            <tr key={item._id} className="compact-row">
                                                <td className="small">{itemsPerPage === 'all' ? index + 1 : ((currentPage - 1) * itemsPerPage) + index + 1}</td>
                                                <td className="small">{item.code}</td>
                                                <td className="small">
                                                    <div className="d-flex align-items-center">
                                                        {item.stock <= (item.minStock || 0) ? (
                                                            <span className="badge bg-danger me-1 small">LOW</span>
                                                        ) : item.stock >= (item.maxStock || Infinity) ? (
                                                            <span className="badge bg-warning me-1 small">HIGH</span>
                                                        ) : null}
                                                        <span className="text-truncate" style={{ maxWidth: '150px' }}>
                                                            {item.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="small">{item.category || '-'}</td>
                                                <td className="small">{item.unit || '-'}</td>
                                                <td className="text-end small">{formatCurrency(item.stock)}</td>
                                                <td className="text-end small">{formatCurrency(item.openingStock)}</td>
                                                <td className="text-end small">{formatCurrency(item.totalQtyIn)}</td>
                                                <td className="text-end small">{formatCurrency(item.totalQtyOut)}</td>
                                                <td className="text-end small">{item.minStock || '-'}</td>
                                                <td className="text-end small">{item.maxStock || '-'}</td>
                                                <td className="text-end small">{formatCurrency(item.avgPuPrice)}</td>
                                                <td className="text-end small">{formatCurrency(item.avgPrice)}</td>
                                                {displayOptions.showPurchaseValue && (
                                                    <td className="text-end fw-bold small">{formatCurrency(item.totalStockValuePurchase)}</td>
                                                )}
                                                {displayOptions.showSalesValue && (
                                                    <td className="text-end fw-bold small">{formatCurrency(item.totalStockValueSales)}</td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="table-group-divider">
                                        <tr className="fw-bold small">
                                            <td colSpan="5">
                                                {itemsPerPage === 'all' ? 'All Items Total' : 'Page Total'}
                                            </td>
                                            <td className="text-end">{formatCurrency(totals.totalStock)}</td>
                                            <td className="text-end">{formatCurrency(totals.totalOpeningStock)}</td>
                                            <td className="text-end">{formatCurrency(totals.totalQtyIn)}</td>
                                            <td className="text-end">{formatCurrency(totals.totalQtyOut)}</td>
                                            <td colSpan="2"></td>
                                            <td></td>
                                            <td></td>
                                            {displayOptions.showPurchaseValue && (
                                                <td className="text-end">{formatCurrency(totals.totalPurchaseValue)}</td>
                                            )}
                                            {displayOptions.showSalesValue && (
                                                <td className="text-end">{formatCurrency(totals.totalSalesValue)}</td>
                                            )}
                                        </tr>
                                    </tfoot>
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
                                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} items
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

export default StockStatus;
