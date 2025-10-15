import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../../stylesheet/retailer/stockAdjustment/List.css';
import Header from '../Header';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import Loader from '../../Loader';

const StockAdjustmentsList = () => {
    const { draftSave, setDraftSave, clearDraft } = usePageNotRefreshContext();

    const [data, setData] = useState(() => {
        if (draftSave && draftSave.stockAdjustmentsData) {
            return draftSave.stockAdjustmentsData;
        }
        return {
            company: null,
            currentFiscalYear: null,
            stockAdjustments: [],
            items: [],
            user: null,
            isAdminOrSupervisor: false
        };
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [adjustmentTypeFilter, setAdjustmentTypeFilter] = useState('');
    const [totalQuantity, setTotalQuantity] = useState(0);
    const [selectedRowIndex, setSelectedRowIndex] = useState(0);
    const [filteredAdjustments, setFilteredAdjustments] = useState([]);

    const searchInputRef = useRef(null);
    const adjustmentTypeFilterRef = useRef(null);
    const tableBodyRef = useRef(null);
    const navigate = useNavigate();

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        if (data.stockAdjustments.length > 0) {
            setDraftSave({
                ...draftSave,
                stockAdjustmentsData: data
            });
        }
    }, [data]);

    // Fetch data on component mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await api.get('api/retailer/stockAdjustments/register');
                setData(response.data.data);
                setError(null);
                setSelectedRowIndex(0); // Reset selection when new data loads
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch stock adjustments');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter adjustments based on search and adjustment type
    useEffect(() => {
        const filtered = data.stockAdjustments.filter(adjustment => {
            const matchesSearch =
                adjustment.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                adjustment.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                adjustment.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                adjustment.billNumber?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesAdjustmentType =
                adjustmentTypeFilter === '' ||
                adjustment.adjustmentType?.toLowerCase() === adjustmentTypeFilter.toLowerCase();

            return matchesSearch && matchesAdjustmentType;
        });

        setFilteredAdjustments(filtered);
        // Reset selected row when filters change
        setSelectedRowIndex(0);
    }, [data.stockAdjustments, searchQuery, adjustmentTypeFilter]);

    // Calculate total quantity when filtered adjustments change
    useEffect(() => {
        if (filteredAdjustments.length === 0) {
            setTotalQuantity(0);
            return;
        }

        const newTotalQuantity = filteredAdjustments.reduce((acc, adjustment) => {
            return acc + (adjustment.quantity || 0);
        }, 0);

        setTotalQuantity(newTotalQuantity);
    }, [filteredAdjustments]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (filteredAdjustments.length === 0) return;

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
                    setSelectedRowIndex(prev => Math.min(filteredAdjustments.length - 1, prev + 1));
                    break;
                case 'Enter':
                    if (selectedRowIndex >= 0 && selectedRowIndex < filteredAdjustments.length) {
                        navigate(`/stockAdjustments/${filteredAdjustments[selectedRowIndex].adjustmentId}/print`);
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredAdjustments, selectedRowIndex, navigate]);

    // Scroll to selected row
    useEffect(() => {
        if (tableBodyRef.current && filteredAdjustments.length > 0) {
            const rows = tableBodyRef.current.querySelectorAll('tr');
            if (rows.length > selectedRowIndex) {
                rows[selectedRowIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, filteredAdjustments]);

    const formatCurrency = (amount) => {
        return parseFloat(amount || 0).toFixed(2);
    };

    const handleRowClick = (index) => {
        setSelectedRowIndex(index);
    };

    const handleRowDoubleClick = (adjustmentId) => {
        navigate(`/stockAdjustments/${adjustmentId}/print`);
    };

    const handlePrint = (filtered = false) => {
        const rowsToPrint = filtered ?
            document.querySelectorAll('.adjustment-row:not([style*="display: none"])') :
            document.querySelectorAll('.adjustment-row');

        if (rowsToPrint.length === 0) {
            alert("No adjustments to print");
            return;
        }

        const printWindow = window.open("", "_blank");
        const printHeader = `
            <div class="print-header">
                <h1>${data.company?.name || 'Company Name'}</h1>
                <p>
                    ${data.company?.address || ''}-${data.company?.ward || ''}, ${data.company?.city || ''},
                    ${data.company?.country || ''}<br>
                    Tel.: ${data.company?.phone || ''}, Email: ${data.company?.email || ''}<br>
                    VAT NO.: ${data.company?.pan || ''}
                </p>
                <hr>
                <h1 style="text-align:center;">Stock Adjustments</h1>
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
            .badge-xcess {
                background-color: #1cc88a;
                color: white;
                padding: 2px 5px;
                border-radius: 3px;
            }
            .badge-short {
                background-color: #e74a3b;
                color: white;
                padding: 2px 5px;
                border-radius: 3px;
            }
        </style>
        ${printHeader}
        <table>
            <thead>
                <tr>
                    <th class="nowrap">Date</th>
                    <th class="nowrap">Vch. No.</th>
                    <th class="nowrap">Item Description</th>
                    <th class="nowrap">Qty</th>
                    <th class="nowrap">Unit</th>
                    <th class="nowrap">Rate</th>
                    <th class="nowrap">Type</th>
                    <th class="nowrap">Reason</th>
                    <th class="nowrap">User</th>
                </tr>
            </thead>
            <tbody>
        `;

        let totalQty = 0;

        filteredAdjustments.forEach(adjustment => {
            tableContent += `
            <tr>
                <td class="nowrap">${new Date(adjustment.date).toLocaleDateString()}</td>
                <td class="nowrap">${adjustment.billNumber}</td>
                <td class="nowrap">
                    ${adjustment.itemName}
                    ${adjustment.vatStatus === 'vatExempt' ? '*' : ''}
                </td>
                <td class="nowrap">${formatCurrency(adjustment.quantity)}</td>
                <td class="nowrap">${adjustment.unitName}</td>
                <td class="nowrap">${formatCurrency(adjustment.puPrice)}</td>
                <td class="nowrap">
                    <span class="badge-${adjustment.adjustmentType}">
                        ${adjustment.adjustmentType}
                    </span>
                </td>
                <td class="nowrap">${adjustment.reason}</td>
                <td class="nowrap">${adjustment.userName}</td>
            </tr>
            `;

            totalQty += parseFloat(adjustment.quantity || 0);
        });

        // Add final totals row
        tableContent += `
            <tr style="font-weight:bold; border-top: 2px solid #000;">
                <td colspan="3">Total Quantity</td>
                <td>${formatCurrency(totalQty)}</td>
                <td colspan="5"></td>
            </tr>
            </tbody>
        </table>
        <p>* Items marked with asterisk are VAT exempt.</p>
        `;

        printWindow.document.write(`
        <html>
            <head>
                <title>Stock Adjustments</title>
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

    if (loading) return <Loader />;
    
    if (error) {
        return <div className="alert alert-danger text-center py-5">{error}</div>;
    }

    return (
        <div className="container-fluid">
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-3">
                    <h1 className="h3 mb-0 text-center text-primary">Stock Adjustments</h1>
                </div>

                <div className="card-body">
                    {/* Search and Filter Section */}
                    <div className="row mb-4">
                        <div className="col-md-8">
                            <div className="row g-3">
                                {/* Search Row */}
                                <div className="col-md-6">
                                    <label htmlFor="searchInput" className="form-label">Search</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="searchInput"
                                            ref={searchInputRef}
                                            placeholder="Search by item, reason or user..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            disabled={data.stockAdjustments.length === 0}
                                            autoComplete='off'
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            disabled={data.stockAdjustments.length === 0}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>

                                {/* Adjustment Type Filter Row */}
                                <div className="col-md-4">
                                    <label htmlFor="adjustmentTypeFilter" className="form-label">Adjustment Type</label>
                                    <select
                                        className="form-select"
                                        id="adjustmentTypeFilter"
                                        ref={adjustmentTypeFilterRef}
                                        value={adjustmentTypeFilter}
                                        onChange={(e) => setAdjustmentTypeFilter(e.target.value)}
                                        disabled={data.stockAdjustments.length === 0}
                                    >
                                        <option value="">All Adjustment Types</option>
                                        <option value="xcess">Xcess</option>
                                        <option value="short">Short</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="col-md-4 d-flex align-items-end justify-content-end gap-2">
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/retailer/stockAdjustments/new')}
                            >
                                <i className="fas fa-plus me-2"></i>New Adjustment
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(false)}
                                disabled={data.stockAdjustments.length === 0}
                            >
                                <i className="fas fa-print"></i>Print All
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(true)}
                                disabled={data.stockAdjustments.length === 0}
                            >
                                <i className="fas fa-filter"></i>Print Filtered
                            </button>
                        </div>
                    </div>

                    {data.stockAdjustments.length === 0 ? (
                        <div className="alert alert-info text-center py-3">
                            <i className="fas fa-info-circle me-2"></i>
                            No stock adjustments found
                        </div>
                    ) : (
                        <>
                            {/* Adjustments Table */}
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Vch. No.</th>
                                            <th>Item Description</th>
                                            <th className="text-end">Qty</th>
                                            <th>Unit</th>
                                            <th className="text-end">Rate</th>
                                            <th>Type</th>
                                            <th>Reason</th>
                                            <th>User</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody ref={tableBodyRef}>
                                        {filteredAdjustments.map((adjustment, index) => (
                                            <tr
                                                key={`${adjustment.adjustmentId}-${adjustment.itemId}`}
                                                className={`adjustment-row ${selectedRowIndex === index ? 'highlighted-row' : ''}`}
                                                onClick={() => handleRowClick(index)}
                                                onDoubleClick={() => handleRowDoubleClick(adjustment.adjustmentId)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td className="compact-cell">{new Date(adjustment.date).toLocaleDateString()}</td>
                                                <td className="compact-cell">{adjustment.billNumber}</td>
                                                <td className="compact-cell">
                                                    {adjustment.itemName}
                                                    {adjustment.vatStatus === 'vatExempt' && '*'}
                                                </td>
                                                <td className="compact-cell text-end">{formatCurrency(adjustment.quantity)}</td>
                                                <td className="compact-cell">{adjustment.unitName}</td>
                                                <td className="compact-cell text-end">{formatCurrency(adjustment.puPrice)}</td>
                                                <td className="compact-cell">
                                                    <span className={`badge ${adjustment.adjustmentType === 'xcess' ? 'bg-success' : 'bg-danger'}`}>
                                                        {adjustment.adjustmentType}
                                                    </span>
                                                </td>
                                                <td className="compact-cell">{adjustment.reason}</td>
                                                <td className="compact-cell">{adjustment.userName}</td>
                                                <td className='compact-cell'>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            className="btn btn-sm btn-info"
                                                            onClick={() => navigate(`/stockAdjustments/${adjustment.adjustmentId}/print`)}
                                                        >
                                                            <i className="fas fa-eye"></i>View
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-warning"
                                                            onClick={() => navigate(`/stockAdjustments/edit/${adjustment.adjustmentId}`)}
                                                            disabled={!data.isAdminOrSupervisor}
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
                                            <td colSpan="3">Total Quantity:</td>
                                            <td className="text-end">{formatCurrency(totalQuantity)}</td>
                                            <td colSpan="6"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <p className="text-muted small mt-2">* Items marked with asterisk are VAT exempt.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockAdjustmentsList;