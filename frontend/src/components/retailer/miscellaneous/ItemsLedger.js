import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import NepaliDate from 'nepali-date-converter';
import { Modal, Button, Form, Table, InputGroup, FormControl, Badge } from 'react-bootstrap';
import { BiBox, BiSearch, BiPrinter } from 'react-icons/bi';
import Header from '../Header';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import '../../../stylesheet/retailer/Items/ItemsLedger.css';

const ItemsLedger = () => {
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];
    const { draftSave, setDraftSave, clearDraft } = usePageNotRefreshContext();
    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });

    const [data, setData] = useState(() => {
        if (draftSave && draftSave.itemsLedgerData) {
            return draftSave.itemsLedgerData;
        }
        return {
            company: null,
            currentFiscalYear: null,
            fromDate: '',
            toDate: company.dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate
        };
    });

    const selectedItemRef = useRef(null);
    const fromDateRef = useRef(null);
    const toDateRef = useRef(null);
    const generateReportButtonRef = useRef(null);
    const itemInputRef = useRef(null);

    const [showItemModal, setShowItemModal] = useState(false);
    const [allItems, setAllItems] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(draftSave?.itemsLedgerData?.selectedItem || null);
    const [ledgerData, setLedgerData] = useState(draftSave?.itemsLedgerData?.ledgerData || null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState(draftSave?.itemsLedgerData?.searchTerm || '');
    const [typeFilter, setTypeFilter] = useState(draftSave?.itemsLedgerData?.typeFilter || '');
    const [selectedRowIndex, setSelectedRowIndex] = useState(0);
    const itemListRef = useRef(null);
    const tableRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Handle keyboard navigation between fields
    const handleKeyDown = (e, currentFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = e.target.form;
            const inputs = Array.from(form.querySelectorAll('input, select, button')).filter(
                el => !el.hidden && !el.disabled && el.offsetParent !== null
            );
            const currentIndex = inputs.findIndex(input => input.id === currentFieldId);

            if (currentIndex > -1 && currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
            }
        }
    };

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

    // Fetch items when component mounts
    useEffect(() => {
        const fetchItems = async () => {
            try {
                const response = await api.get('/api/retailer/items');
                if (response.data.success) {
                    const sortedItems = response.data.items.sort((a, b) => a.name.localeCompare(b.name));
                    setAllItems(sortedItems);
                    setFilteredItems(sortedItems);
                }
            } catch (error) {
                console.error('Error fetching items:', error);
            }
        };

        fetchItems();
    }, []);

    // Focus on fromDate after item selection
    useEffect(() => {
        if (selectedItem && fromDateRef.current) {
            fromDateRef.current.focus();
        }
    }, [selectedItem]);

    // Add this useEffect to your component
    useEffect(() => {
        if (itemListRef.current && filteredItems.length > 0) {
            const selectedElement = itemListRef.current.querySelector(`.list-group-item:nth-child(${selectedRowIndex + 1})`);
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, filteredItems]);

    // Save to draft when data changes
    useEffect(() => {
        const draftData = {
            ...data,
            selectedItem,
            ledgerData,
            searchTerm,
            typeFilter,
        };

        setDraftSave({
            ...draftSave,
            itemsLedgerData: draftData
        });
    }, [data, selectedItem, ledgerData, searchTerm, typeFilter]);

    // Filter items based on search term
    useEffect(() => {
        if (searchTerm === '') {
            setFilteredItems(allItems);
        } else {
            const filtered = allItems.filter(item =>
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(searchTerm))
            );
            setFilteredItems(filtered);
        }
    }, [searchTerm, allItems]);

    useEffect(() => {
        if (selectedItem && fromDateRef.current) {
            fromDateRef.current.focus();
        }
    }, [selectedItem]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Check if focus is inside an input or select element
            const activeElement = document.activeElement;
            if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT') {
                return;
            }

            if (ledgerData && ledgerData.entries && filteredEntries.length > 0) {
                switch (e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        setSelectedRowIndex(prev => Math.max(0, prev - 1));
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        setSelectedRowIndex(prev => Math.min(filteredEntries.length - 1, prev + 1));
                        break;
                    case 'Enter':
                        if (selectedRowIndex >= 0 && selectedRowIndex < filteredEntries.length) {
                            // Handle enter action on ledger entry if needed
                        }
                        break;
                    default:
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [ledgerData, selectedRowIndex]);

    const fetchItemLedger = async () => {
        if (!selectedItem || !data.fromDate || !data.toDate) return;

        try {
            setLoading(true);
            const response = await api.get(`/api/retailer/items-ledger/${selectedItem.id}`, {
                params: {
                    fromDate: data.fromDate,
                    toDate: data.toDate
                }
            });

            if (response.data.success) {
                setLedgerData(response.data.data); // Access the data property
            } else {
                console.error('Error from server:', response.data.error);
                // Show error to user
            }
        } catch (error) {
            console.error('Error fetching ledger data:', error);
            if (error.response) {
                console.error('Server responded with:', error.response.data);
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle item selection
    const handleSelectItem = (item) => {
        setSelectedItem({
            id: item._id,
            name: item.name,
            unit: item.unit?.name || 'N/A'
        });
        setShowItemModal(false);
        setSearchTerm('');
    };

    const handlePrint = (filtered = false) => {
        const entriesToPrint = filtered ? filteredEntries : ledgerData?.entries || [];

        if (entriesToPrint.length === 0) {
            alert("No data to print");
            return;
        }

        const printWindow = window.open("", "_blank");
        const printHeader = `
                   <div class="print-header">
            <h1>${ledgerData.currentCompanyName || 'Company Name'}</h1>
            <p>
                ${ledgerData.currentCompany?.address || ''}-${ledgerData.currentCompany?.ward || ''}, ${ledgerData.currentCompany?.city || ''},
                TPIN: ${ledgerData.currentCompany?.pan || ''}<br>
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
        <h1 style="text-align:center;text-decoration:underline;">Items Ledger: ${selectedItem?.name || ''}</h1>
        <p style="text-align:center;">Period: ${data.fromDate} to ${data.toDate}</p>
        <table>
            <thead>
                <tr>
                    <th class="nowrap">Date</th>
                    <th class="nowrap">Vouch/Inv.</th>
                    <th class="nowrap">Party Name</th>
                    <th class="nowrap">Type</th>
                    <th class="nowrap">Qty. In</th>
                    <th class="nowrap">Qty. Out</th>
                    <th class="nowrap">Free</th>
                    <th class="nowrap">Unit</th>
                    <th class="nowrap">Rate (Rs.)</th>
                    <th class="nowrap">Balance</th>
                </tr>
            </thead>
            <tbody>
        `;

        // Add opening stock
        tableContent += `
          <tr className="opening-row">
                <td><strong>${data.fromDate}</strong></td>
                <td colSpan="1"><strong></strong></td>
                <td colSpan="1"><strong>Opening</strong></td>
                <td colSpan="5"><strong></strong></td>
                <td><strong>${ledgerData?.purchasePrice || ''}</strong></td>
                <td><strong>${ledgerData?.openingStock?.toFixed(2) || '0.00'}</strong></td>
            </tr>
        `;

        let runningBalance = ledgerData?.openingStock || 0;

        entriesToPrint.forEach(entry => {
            tableContent += `
            <tr>
                <td class="nowrap">${new Date(entry.date).toLocaleDateString()}</td>
                <td class="nowrap">${entry.billNumber || ''}</td>
                <td class="nowrap">${entry.partyName}</td>
                <td class="nowrap">${entry.type}</td>
                <td class="nowrap">${entry.qtyIn || '-'}</td>
                <td class="nowrap">${entry.qtyOut || '-'}</td>
                <td class="nowrap">${entry.bonus || 0}</td>
                <td class="nowrap">${entry.unit || ''}</td>
                <td class="nowrap">${Math.round(entry.price || '') * 100 / 100}</td>
                <td class="nowrap">${entry.balance?.toFixed(2)}</td>
            </tr>
            `;
        });

        // Add totals row
        tableContent += `
            <tr style="font-weight:bold; border-top: 2px solid #000;">
                <td colspan="4">Totals:</td>
                <td>${totals.qtyIn.toFixed(2)}</td>
                <td>${totals.qtyOut.toFixed(2)}</td>
                <td>${totals.free.toFixed(2)}</td>
                <td></td>
                <td></td>
                <td>${totals.balance.toFixed(2)}</td>
            </tr>
            </tbody>
        </table>
        `;

        printWindow.document.write(`
        <html>
            <head>
                <title>Items Ledger: ${selectedItem?.name || ''}</title>
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

    // Handle keyboard navigation in modal
    const handleModalKeyDown = (e) => {
        if (filteredItems.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedRowIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedRowIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredItems[selectedRowIndex]) {
                    handleSelectItem(filteredItems[selectedRowIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setShowItemModal(false);
                break;
            default:
                break;
        }
    };

    // Filter ledger entries
    const filteredEntries = ledgerData?.entries?.filter(entry => {
        const matchesSearch = entry.partyName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = !typeFilter || entry.type.toLowerCase() === typeFilter.toLowerCase();
        return matchesSearch && matchesType;
    }) || [];

    // Calculate totals
    const totals = filteredEntries.reduce((acc, entry) => {
        return {
            qtyIn: acc.qtyIn + (entry.qtyIn || 0),
            qtyOut: acc.qtyOut + (entry.qtyOut || 0),
            free: acc.free + (entry.bonus || 0),
            balance: entry.balance || 0
        };
    }, { qtyIn: 0, qtyOut: 0, free: 0, balance: 0 });

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="container-fluid">
            <Header />
            <div className="card mt-4 shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
                <div className="card-header">
                    <h2 className="card-title text-center">
                        <BiBox className="mr-2" />
                        {selectedItem ? `Items Ledger: ${selectedItem.name}` : 'Items Ledger'}
                    </h2>
                </div>

                <div className="card-body">
                    <div className="filter-section">
                        <div className="filter-group">
                            <label htmlFor="Items" className="font-weight-bold">Items</label>
                            <div className="input-group">
                                <FormControl
                                    type="text"
                                    placeholder="Select an item..."
                                    value={selectedItem?.name || ''}
                                    autoFocus
                                    onFocus={() => setShowItemModal(true)}
                                    readOnly
                                    ref={itemInputRef}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            // Only open modal if no item is selected yet
                                            if (!selectedItem) {
                                                setShowItemModal(true);
                                            } else {
                                                // If item is already selected, move to next field
                                                fromDateRef.current?.focus();
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <Form id="ledgerFilterForm" onSubmit={(e) => {
                            e.preventDefault();
                            fetchItemLedger();
                        }}>
                            <div className="row g-3">
                                <div className="filter-group">
                                    <label htmlFor="fromDate">From Date</label>
                                    <input
                                        type="text"
                                        name="fromDate"
                                        id="fromDate"
                                        ref={fromDateRef}
                                        className="form-control"
                                        value={data.fromDate}
                                        onChange={handleDateChange}
                                        required
                                        autoComplete='off'
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleKeyDown(e, 'fromDate');
                                            }
                                        }}
                                    />
                                </div>
                                <div className="filter-group">
                                    <label htmlFor="toDate">To Date</label>
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
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleKeyDown(e, 'toDate');
                                            }
                                        }}
                                    />
                                </div>
                                <div className="filter-group">
                                    <label htmlFor=""></label>
                                    <div className="action-buttons">
                                        <Button
                                            variant="primary"
                                            type="submit"
                                            ref={generateReportButtonRef}
                                            id="generateReportButton"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    fetchItemLedger();
                                                }
                                            }}
                                        >
                                            Generate Report
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Form>

                        <div className="filter-group">
                            <label htmlFor="searchInput" className="font-weight-bold">Search Party</label>
                            <InputGroup>
                                <InputGroup.Text>
                                    <BiSearch />
                                </InputGroup.Text>
                                <FormControl
                                    type="text"
                                    id="searchInput"
                                    autoComplete='off'
                                    placeholder="Search by party name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'searchInput');
                                        }
                                    }}
                                />
                            </InputGroup>
                        </div>

                        <div className="filter-group">
                            <label htmlFor="adjustmentTypeFilter" className="font-weight-bold">Filter by Type</label>
                            <Form.Select
                                id="adjustmentTypeFilter"
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleKeyDown(e, 'adjustmentTypeFilter');
                                    }
                                }}
                            >
                                <option value="">All Transactions</option>
                                <option value="xcess">Xcess</option>
                                <option value="short">Short</option>
                                <option value="Sale">Sales</option>
                                <option value="SlRt">Sales Return</option>
                                <option value="Purc">Purchase</option>
                                <option value="PrRt">Purchase Return</option>
                            </Form.Select>
                        </div>
                    </div>

                    <div className="toolbar">
                        <Button
                            variant="secondary"
                            className="btn-action"
                            disabled={!ledgerData}
                            onClick={() => handlePrint(false)}
                        >
                            <BiPrinter className="mr-1" /> Print All
                        </Button>
                        <Button
                            variant="secondary"
                            className="btn-action"
                            disabled={!ledgerData}
                            onClick={() => handlePrint(true)}
                        >
                            <BiPrinter className="mr-1" /> Print Filtered
                        </Button>
                    </div>

                    <div className="table-container">
                        <Table striped bordered hover className="ledger-table" ref={tableRef}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Vouch/Inv.</th>
                                    <th>Party Name</th>
                                    <th>Type</th>
                                    <th>Qty. In</th>
                                    <th>Qty. Out</th>
                                    <th>Free</th>
                                    <th>Unit</th>
                                    <th>Rate (Rs.)</th>
                                    <th>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td colSpan="10" className="text-center py-4">
                                            Loading...
                                        </td>
                                    </tr>
                                )}

                                {!loading && !ledgerData && (
                                    <tr>
                                        <td colSpan="10" className="text-center py-4 text-muted">
                                            Please select an item and date range
                                        </td>
                                    </tr>
                                )}

                                {!loading && ledgerData && (
                                    <>
                                        <tr className="opening-row">
                                            <td><strong>{data.fromDate}</strong></td>
                                            <td colSpan="1"><strong></strong></td>
                                            <td colSpan="1"><strong>Opening</strong></td>
                                            <td colSpan="5"><strong></strong></td>
                                            <td><strong>{ledgerData?.purchasePrice || ''}</strong></td>
                                            <td><strong>{ledgerData?.openingStock?.toFixed(2) || '0.00'}</strong></td>
                                        </tr>

                                        {filteredEntries.map((entry, index) => (
                                            <tr
                                                key={index}
                                                className={`searchClass ${index === selectedRowIndex ? 'selected-row' : ''}`}
                                                onClick={() => setSelectedRowIndex(index)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        setSelectedRowIndex(index);
                                                    }
                                                }}
                                                tabIndex={0}
                                            >
                                                <td>{new NepaliDate(entry.date).format('YYYY-MM-DD')}</td>
                                                <td>{entry.billNumber || ''}</td>
                                                <td>{entry.partyName}</td>
                                                <td className={`type-${entry.type}`}>{entry.type}</td>
                                                <td>{entry.qtyIn || '-'}</td>
                                                <td>{entry.qtyOut || '-'}</td>
                                                <td>{entry.bonus || 0}</td>
                                                <td>{entry.unit || ''}</td>
                                                <td>{Math.round(entry.price || '') * 100 / 100}</td>
                                                <td>{entry.balance?.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </>
                                )}
                            </tbody>

                            {ledgerData && filteredEntries.length > 0 && (
                                <tfoot>
                                    <tr className="bg-light">
                                        <td colSpan="4"><strong>Totals:</strong></td>
                                        <td><strong>{totals.qtyIn.toFixed(2)}</strong></td>
                                        <td><strong>{totals.qtyOut.toFixed(2)}</strong></td>
                                        <td><strong>{totals.free.toFixed(2)}</strong></td>
                                        <td></td>
                                        <td></td>
                                        <td><strong>{totals.balance.toFixed(2)}</strong></td>
                                    </tr>
                                </tfoot>
                            )}
                        </Table>
                    </div>
                </div>
            </div>

            {/* Item Selection Modal */}
            {showItemModal && (
                <div className="modal fade show" id="itemModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content" style={{ height: '500px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title" id="itemModalLabel">Select an Item</h5>
                                <button type="button" className="btn-close" onClick={() => setShowItemModal(false)}></button>
                            </div>
                            <div className="p-3 bg-white sticky-top">
                                <input
                                    type="text"
                                    id="searchItem"
                                    className="form-control form-control-sm"
                                    placeholder="Search Item"
                                    autoFocus
                                    autoComplete='off'
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        // Handle arrow keys and Enter in search input
                                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            const firstItem = document.querySelector('.item-item');
                                            if (firstItem) {
                                                firstItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const firstItem = document.querySelector('.item-item.active');
                                            if (firstItem) {
                                                const itemId = firstItem.getAttribute('data-item-id');
                                                const item = filteredItems.length > 0
                                                    ? filteredItems.find(i => i._id === itemId)
                                                    : allItems.find(i => i._id === itemId);
                                                if (item) {
                                                    handleSelectItem(item);
                                                }
                                            }
                                        } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            setShowItemModal(false);
                                        }
                                    }}
                                    ref={itemInputRef}
                                />
                            </div>
                            <div className="modal-body p-0">
                                <div className="overflow-auto" style={{ height: 'calc(400px - 120px)' }}>
                                    <ul id="itemList" className="list-group" ref={itemListRef}>
                                        {allItems.length === 0 ? (
                                            <li className="list-group-item text-center text-muted small py-2">Loading items...</li>
                                        ) : filteredItems.length > 0 ? (
                                            filteredItems
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((item, index) => (
                                                    <li
                                                        key={item._id}
                                                        data-item-id={item._id}
                                                        className={`list-group-item item-item py-2 ${index === 0 ? 'active' : ''}`}
                                                        onClick={() => handleSelectItem(item)}
                                                        style={{ cursor: 'pointer' }}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            // Handle keyboard navigation
                                                            if (e.key === 'ArrowDown') {
                                                                e.preventDefault();
                                                                const nextItem = e.target.nextElementSibling;
                                                                if (nextItem) {
                                                                    e.target.classList.remove('active');
                                                                    nextItem.classList.add('active');
                                                                    nextItem.focus();
                                                                }
                                                            } else if (e.key === 'ArrowUp') {
                                                                e.preventDefault();
                                                                const prevItem = e.target.previousElementSibling;
                                                                if (prevItem) {
                                                                    e.target.classList.remove('active');
                                                                    prevItem.classList.add('active');
                                                                    prevItem.focus();
                                                                } else {
                                                                    // If at top, go back to search input
                                                                    itemInputRef.current.focus();
                                                                }
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleSelectItem(item);
                                                            } else if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                setShowItemModal(false);
                                                            }
                                                        }}
                                                        onFocus={(e) => {
                                                            // Remove active class from all items and add to focused one
                                                            document.querySelectorAll('.item-item').forEach(item => {
                                                                item.classList.remove('active');
                                                            });
                                                            e.target.classList.add('active');
                                                        }}
                                                    >
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <div>
                                                                <strong>{item.uniqueNumber || 'N/A'} {item.name}</strong>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-2">
                                                                {item.category && `Category: ${item.category.name || item.category}`}
                                                                <Badge bg="primary" pill>{item.unit?.name || 'N/A'}</Badge>
                                                                <strong>{item.currentStock?.toFixed(2) || '0.00'}</strong>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))
                                        ) : (
                                            // If search is active and no result found
                                            searchTerm ? (
                                                <li className="list-group-item text-center text-muted small py-2">No items found</li>
                                            ) : (
                                                allItems
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((item, index) => (
                                                        <li
                                                            key={item._id}
                                                            data-item-id={item._id}
                                                            className={`list-group-item item-item py-2 ${index === 0 ? 'active' : ''}`}
                                                            onClick={() => handleSelectItem(item)}
                                                            style={{ cursor: 'pointer' }}
                                                            tabIndex={0}
                                                            onKeyDown={(e) => {
                                                                // Handle keyboard navigation
                                                                if (e.key === 'ArrowDown') {
                                                                    e.preventDefault();
                                                                    const nextItem = e.target.nextElementSibling;
                                                                    if (nextItem) {
                                                                        e.target.classList.remove('active');
                                                                        nextItem.classList.add('active');
                                                                        nextItem.focus();
                                                                    }
                                                                } else if (e.key === 'ArrowUp') {
                                                                    e.preventDefault();
                                                                    const prevItem = e.target.previousElementSibling;
                                                                    if (prevItem) {
                                                                        e.target.classList.remove('active');
                                                                        prevItem.classList.add('active');
                                                                        prevItem.focus();
                                                                    } else {
                                                                        // If at top, go back to search input
                                                                        itemInputRef.current.focus();
                                                                    }
                                                                } else if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleSelectItem(item);
                                                                } else if (e.key === 'Escape') {
                                                                    e.preventDefault();
                                                                    setShowItemModal(false);
                                                                }
                                                            }}
                                                            onFocus={(e) => {
                                                                // Remove active class from all items and add to focused one
                                                                document.querySelectorAll('.item-item').forEach(item => {
                                                                    item.classList.remove('active');
                                                                });
                                                                e.target.classList.add('active');
                                                            }}
                                                        >
                                                            <div className="d-flex justify-content-between align-items-center">
                                                                <div>
                                                                    <strong>{item.uniqueNumber}{item.name}</strong>
                                                                    <div className="text-muted small">
                                                                        {item.uniqueNumber && ` | #: ${item.uniqueNumber}`}
                                                                        {item.category && ` | Category: ${item.category.name || item.category}`}
                                                                    </div>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <Badge bg="primary" pill>{item.unit?.name || 'N/A'}</Badge>
                                                                    <Badge
                                                                        bg={item.currentStock > 0 ? 'success' : 'danger'}
                                                                        pill
                                                                        title="Current Stock"
                                                                    >
                                                                        Stock: {item.currentStock?.toFixed(2) || '0.00'}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    ))
                                            )
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ItemsLedger;