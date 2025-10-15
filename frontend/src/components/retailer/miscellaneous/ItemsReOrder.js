import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiPrinter, FiFileText, FiInbox } from 'react-icons/fi';
import { FaSearch } from 'react-icons/fa';
import Header from '../Header';

const ItemsReOrderLevel = () => {
    const [stockData, setStockData] = useState({
        items: [],
        company: null,
        currentCompanyName: '',
        currentFiscalYear: null,
        isAdminOrSupervisor: false
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterType, setFilterType] = useState('reorderLevel');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentRowIndex, setCurrentRowIndex] = useState(-1);
    const tableRef = useRef(null);
    const navigate = useNavigate();

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        const fetchStockData = async () => {
            try {
                const response = await api.get('/api/retailer/items/reorder');
                if (response.data.success) {
                    // Process items to add status field
                    const processedItems = response.data.data.items.map(item => {
                        let status = 'Normal';
                        if (item.currentStock < item.reorderLevel) {
                            status = 'Understocked';
                        } else if (item.maxStock && item.currentStock > item.maxStock) {
                            status = 'Overstocked';
                        }
                        return {
                            ...item,
                            status,
                            code: item.code || '', // Ensure code exists
                            overStock: item.overStock || 0 // Ensure overStock exists
                        };
                    });
                    
                    setStockData({
                        ...response.data.data,
                        items: processedItems
                    });
                } else {
                    setError(response.data.error || 'Failed to fetch stock data');
                }
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch stock data');
                setLoading(false);
            }
        };

        fetchStockData();
    }, []);

    const filteredItems = stockData.items.filter(item => {
        // Apply filter type
        const matchesFilter = filterType === 'all' ||
            (filterType === 'reorderLevel' && item.status === 'Understocked') ||
            (filterType === 'maxStock' && item.status === 'Overstocked');

        // Apply search term if exists
        const matchesSearch = !searchTerm ||
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()));

        return matchesFilter && matchesSearch;
    });

    const summary = {
        reorderCount: stockData.items.filter(i => i.status === 'Understocked').length,
        overstockCount: stockData.items.filter(i => i.status === 'Overstocked').length,
        totalCount: stockData.items.length,
        totalNeeded: stockData.items.reduce((sum, item) => sum + (item.neededStock || 0), 0),
        totalOverstock: stockData.items.reduce((sum, item) => sum + (item.overStock || 0), 0)
    };

    const handleFilterChange = (e) => {
        setFilterType(e.target.value);
        setCurrentRowIndex(-1);
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentRowIndex(-1);
    };

    const handleKeyDown = (e) => {
        if (filteredItems.length === 0) return;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (currentRowIndex > 0) {
                    setCurrentRowIndex(currentRowIndex - 1);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (currentRowIndex < filteredItems.length - 1) {
                    setCurrentRowIndex(currentRowIndex + 1);
                }
                break;
            case 'Home':
                e.preventDefault();
                setCurrentRowIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setCurrentRowIndex(filteredItems.length - 1);
                break;
            case 'Enter':
                if (currentRowIndex >= 0 && currentRowIndex < filteredItems.length) {
                    // Handle row action if needed
                }
                break;
        }
    };

    const printItems = () => {
        const printWindow = window.open('', '_blank');
        const title = filterType === 'maxStock' ? 'Overstock Items Report' :
            filterType === 'reorderLevel' ? 'Reorder Level Report' : 'Stock Report';

        printWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
                        th { background-color: #f2f2f2; font-weight: bold; }
                        .text-danger { color: #e74c3c; }
                        .text-success { color: #2ecc71; }
                        h2 { color: #3498db; text-align: center; }
                        @page { size: landscape; margin: 10mm; }
                    </style>
                </head>
                <body>
                    <h2>${title}</h2>
                    <p>Company: ${stockData.currentCompanyName || 'N/A'}</p>
                    <p>Fiscal Year: ${stockData.currentFiscalYear?.name || 'N/A'}</p>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Item Name</th>
                                <th>Unit</th>
                                <th>Current Stock</th>
                                <th>${filterType === 'maxStock' ? 'Max Stock' : 'Reorder Level'}</th>
                                <th>${filterType === 'maxStock' ? 'Over Stock' : 'Needed Stock'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredItems.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item.name}</td>
                                    <td>${item.unit}</td>
                                    <td>${item.currentStock}</td>
                                    <td>${filterType === 'maxStock' ? item.maxStock : item.reorderLevel}</td>
                                    <td class="${filterType === 'maxStock' ?
                (item.overStock > 0 ? 'text-danger' : '') :
                (item.neededStock > 0 ? 'text-danger' : 'text-success')}">
                                        ${filterType === 'maxStock' ? item.overStock : item.neededStock}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <script>
                        window.onload = function() { 
                            window.print(); 
                            setTimeout(function() { window.close(); }, 1000);
                        }
                    <\/script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const exportToExcel = () => {
        const title = filterType === 'maxStock' ? 'Overstock_Items_Report' :
            filterType === 'reorderLevel' ? 'Reorder_Level_Report' : 'Stock_Report';

        let csv = 'No,Item Name,Code,Unit,Current Stock,Reorder Level,Max Stock,Needed Stock,Over Stock,Status\n';

        filteredItems.forEach((item, index) => {
            const rowData = [
                index + 1,
                `"${item.name}"`,
                item.code || '',
                item.unit,
                item.currentStock,
                item.reorderLevel,
                item.maxStock || '',
                item.neededStock,
                item.overStock || '',
                item.status
            ];
            csv += rowData.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `${title}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className="container-fluid">
                <div className="card mt-4 shadow">
                    <div className="card-header bg-primary text-white">
                        <h2 className="mb-0">Stock Re-Order Level</h2>
                    </div>
                    <div className="card-body text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-3">Loading stock data...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container-fluid">
                <div className="card mt-4 shadow">
                    <div className="card-header bg-primary text-white">
                        <h2 className="mb-0">Stock Re-Order Level</h2>
                    </div>
                    <div className="card-body text-center py-5">
                        <div className="alert alert-danger">
                            <i className="fas fa-exclamation-circle me-2"></i>
                            {error}
                        </div>
                        <button className="btn btn-primary" onClick={() => window.location.reload()}>
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <Header/>
            <div className="card mt-4 shadow">
                <div className="card-header bg-primary text-white">
                    <div className="d-flex justify-content-between align-items-center">
                        <h2 className="mb-0">Stock Re-Order Level</h2>
                        <div className="d-flex gap-2">
                            <button className="btn btn-light" onClick={printItems}>
                                <FiPrinter className="me-2" /> Print
                            </button>
                            <button className="btn btn-light" onClick={exportToExcel}>
                                <FiFileText className="me-2" /> Export
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card-body">
                    {/* Status Summary Cards */}
                    <div className="d-flex justify-content-between mb-4">
                        <div className="card shadow-sm flex-fill mx-2 border-top-danger">
                            <div className="card-body text-center">
                                <h5 className="text-muted">Items Need Reorder</h5>
                                <div className="h3 text-danger">{summary.reorderCount}</div>
                            </div>
                        </div>
                        <div className="card shadow-sm flex-fill mx-2 border-top-warning">
                            <div className="card-body text-center">
                                <h5 className="text-muted">Overstock Items</h5>
                                <div className="h3 text-warning">{summary.overstockCount}</div>
                            </div>
                        </div>
                        <div className="card shadow-sm flex-fill mx-2 border-top-primary">
                            <div className="card-body text-center">
                                <h5 className="text-muted">Total Items</h5>
                                <div className="h3 text-primary">{summary.totalCount}</div>
                            </div>
                        </div>
                    </div>

                    {/* Filter Section */}
                    <div className="card shadow-sm mb-4">
                        <div className="card-body">
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label fw-bold">Filter Items</label>
                                        <select
                                            className="form-select"
                                            value={filterType}
                                            onChange={handleFilterChange}
                                        >
                                            <option value="reorderLevel">Items Need Reorder</option>
                                            <option value="maxStock">Overstock Items</option>
                                            <option value="all">All Items</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label fw-bold">Search Items</label>
                                        <div className="input-group">
                                            <span className="input-group-text">
                                                <FaSearch />
                                            </span>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Search by item name or code..."
                                                value={searchTerm}
                                                onChange={handleSearchChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="table-responsive">
                        <table
                            className="table table-bordered table-hover"
                            ref={tableRef}
                            onKeyDown={handleKeyDown}
                        >
                            <thead className="table-light">
                                <tr>
                                    <th width="5%">#</th>
                                    <th width="30%">Item Name</th>
                                    <th width="10%">Code</th>
                                    <th width="10%">Unit</th>
                                    <th width="15%">Current Stock</th>
                                    <th width="15%">
                                        {filterType === 'maxStock' ? 'Max Stock' : 'Reorder Level'}
                                    </th>
                                    <th width="15%">
                                        {filterType === 'maxStock' ? 'Over Stock' : 'Needed Stock'}
                                    </th>
                                    <th width="10%">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.length > 0 ? (
                                    filteredItems.map((item, index) => (
                                        <tr
                                            key={index}
                                            className={currentRowIndex === index ? 'table-active' : ''}
                                            tabIndex={0}
                                            onClick={() => setCurrentRowIndex(index)}
                                        >
                                            <td>{index + 1}</td>
                                            <td>{item.name}</td>
                                            <td>{item.code || '-'}</td>
                                            <td>{item.unit}</td>
                                            <td>{item.currentStock}</td>
                                            <td>
                                                {filterType === 'maxStock' ? item.maxStock : item.reorderLevel}
                                            </td>
                                            <td className={
                                                filterType === 'maxStock' ?
                                                    (item.overStock > 0 ? 'text-danger fw-bold' : '') :
                                                    (item.neededStock > 0 ? 'text-danger fw-bold' : 'text-success')
                                            }>
                                                {filterType === 'maxStock' ? item.overStock : item.neededStock}
                                            </td>
                                            <td>
                                                {item.status === 'Understocked' ? (
                                                    <span className="badge bg-danger">Reorder</span>
                                                ) : item.status === 'Overstocked' ? (
                                                    <span className="badge bg-warning">Overstock</span>
                                                ) : (
                                                    <span className="badge bg-success">Normal</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="text-center py-5">
                                            <FiInbox size={48} className="text-muted mb-3" />
                                            <h4>No items found</h4>
                                            <p className="text-muted">Try adjusting your filters or search criteria</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ItemsReOrderLevel;