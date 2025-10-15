import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiEye, FiCheck, FiPrinter, FiArrowLeft, FiPlus, FiPackage, FiRefreshCw } from 'react-icons/fi';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Header from '../Header';
import NotificationToast from '../../NotificationToast';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import ProductModal from '../dashboard/modals/ProductModal';


const Items = () => {
    const { itemsTableDraftSave, setItemsTableDraftSave } = usePageNotRefreshContext();
    const [isTableDataFresh, setIsTableDataFresh] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const navigate = useNavigate();
    const [data, setData] = useState({
        items: [],
        categories: [],
        itemsCompanies: [],
        units: [],
        mainUnits: [],
        compositions: [],
        company: null,
        currentFiscalYear: null,
        vatEnabled: false,
        companyId: '',
        currentCompanyName: '',
        companyDateFormat: 'english',
        nepaliDate: '',
        fiscalYear: '',
        user: null,
        theme: 'light',
        isAdminOrSupervisor: false
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showCompositionModal, setShowCompositionModal] = useState(false);
    const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [printOption, setPrintOption] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [selectedCompositions, setSelectedCompositions] = useState([]);
    const [compositionSearch, setCompositionSearch] = useState('');
    const [user, setUser] = useState(null);
    const [isAdminOrSupervisor, setIsAdminOrSupervisor] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [itemsWithTransactions, setItemsWithTransactions] = useState({});

    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState(''); // 'success' or 'error'
    const [showProductModal, setShowProductModal] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        hscode: '',
        category: '',
        itemsCompany: '',
        composition: '',
        compositionIds: '',
        mainUnit: '',
        WSUnit: '',
        unit: '',
        vatStatus: '',
        reorderLevel: '',
        price: '',
        puPrice: '',
        openingStock: '',
        openingStockBalance: ''
    });

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Show notification function
    const showNotificationMessage = (message, type) => {
        setNotificationMessage(message);
        setNotificationType(type);
        setShowNotification(true);
    };
    useEffect(() => {
        // If we have draft data, show it immediately and fetch fresh in background
        if (itemsTableDraftSave) {
            setData(prev => ({
                ...prev,
                items: itemsTableDraftSave.items
            }));
            fetchItems(); // Fetch fresh data in background
        } else {
            fetchItems(); // Fetch fresh data (will show loading state)
        }

        // Set up auto-refresh every 5 minutes
        const interval = setInterval(fetchItems, 300000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const userRes = await api.get('/api/auth/me');
                const userData = userRes.data.user;
                setUser(userData);
                setIsAdminOrSupervisor(userData.isAdmin || userData.role === 'Supervisor');
                setLoading(false);
            } catch (err) {
                showNotificationMessage(err.response?.data?.message || 'Failed to fetch data', 'error');
                setLoading(false);
            }
        };
        fetchData();
    }, []);

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

    // First, define the shallowEqual function at the top level of your component file
    function shallowEqual(objA, objB) {
        if (objA === objB) return true;

        if (typeof objA !== 'object' || objA === null ||
            typeof objB !== 'object' || objB === null) {
            return false;
        }

        const keysA = Object.keys(objA);
        const keysB = Object.keys(objB);

        if (keysA.length !== keysB.length) return false;

        for (let i = 0; i < keysA.length; i++) {
            if (!objB.hasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
                return false;
            }
        }

        return true;
    }


    const filteredItems = React.useMemo(() => {
        const items = (itemsTableDraftSave?.items || data.items)
            .filter(item =>
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.itemsCompany && item.itemsCompany.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.category && item.category.name.toLowerCase().includes(searchTerm.toLowerCase()))
            )
            .sort((a, b) => a.name.localeCompare(b.name)); // Add this sorting line

        return items;
    }, [data.items, itemsTableDraftSave?.items, searchTerm]);


    // Table Header Component
    const TableHeader = React.memo(() => (
        <div
            className="d-flex bg-primary text-white sticky-top align-items-center"
            style={{
                zIndex: 1, // Increased from 0 to ensure it stays above content
                height: '50px', // Fixed height for consistency
                minWidth: '720px' // Sum of all column widths
            }}
        >
            {/* Description */}
            <div
                className="d-flex align-items-center ps-2 border-end border-white"
                style={{
                    width: '250px',
                    flexShrink: 0,
                    minWidth: '250px'
                }}
            >
                <strong>Description of Goods</strong>
            </div>

            {/* Company */}
            <div
                className="d-flex align-items-center px-2 border-end border-white"
                style={{
                    width: '150px',
                    flexShrink: 0,
                    minWidth: '150px'
                }}
            >
                <strong>Company</strong>
            </div>

            {/* Category */}
            <div
                className="d-flex align-items-center px-2 border-end border-white"
                style={{
                    width: '150px',
                    flexShrink: 0,
                    minWidth: '150px'
                }}
            >
                <strong>Category</strong>
            </div>

            {/* VAT */}
            <div
                className="d-flex align-items-center justify-content-center px-2 border-end border-white"
                style={{
                    width: '100px',
                    flexShrink: 0,
                    minWidth: '100px'
                }}
            >
                <strong>VAT</strong>
            </div>

            {/* Actions */}
            <div
                className="d-flex align-items-center justify-content-end px-2"
                style={{
                    width: '120px',
                    flexShrink: 0,
                    minWidth: '120px'
                }}
            >
                <strong>Actions</strong>
            </div>
        </div>
    ));

    // Table Row Component
    const TableRow = React.memo(({ index, style, data }) => {
        const { items, isAdminOrSupervisor } = data;
        const item = items[index];

        // Memoize handlers
        const handleView = useCallback(() => navigate(`/retailer/items/${item?._id}`), [item?._id]);
        const handleEditClick = useCallback(() => item && handleEdit(item), [item]);
        const handleDeleteClick = useCallback(() => item?._id && handleDelete(item._id), [item?._id]);
        const handleSelect = useCallback(() => item && handleSelectItem(item), [item]);

        if (!item) return null;

        const itemName = item.name || 'N/A';
        const companyName = item.itemsCompany?.name || 'N/A';
        const categoryName = item.category?.name || 'N/A';
        const isActive = item.status === 'active';
        const isVatable = item.vatStatus === 'vatable';

        return (
            <div
                style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 0'
                }}
                className={index % 2 === 0 ? 'bg-light' : 'bg-white'}
            >
                {/* Item Name */}
                <div
                    className="border-end d-flex align-items-center gap-2 ps-2"
                    style={{
                        width: '400px',
                        flexShrink: 0,
                        minHeight: '100%',
                        overflow: 'visible', // Changed from 'hidden'
                        whiteSpace: 'normal'
                    }}
                >
                    <span className="text-muted" style={{ width: '30px', flexShrink: 0 }}>{index + 1}.</span>
                    <div className="d-flex flex-column" style={{ flex: 1, minWidth: 0 }}>
                        <span
                            className="text-truncate"
                            style={{
                                lineHeight: '1.2',
                                wordBreak: 'break-word'
                            }}
                            title={itemName}
                        >
                            {itemName}
                            <Badge
                                bg={isActive ? 'success' : 'danger'}
                                className="align-self-start mt-1"
                                style={{ fontSize: '0.7rem', margin: '4px' }}
                            >
                                {item.status || 'N/A'}
                            </Badge>
                        </span>

                    </div>
                </div>

                {/* Company */}
                <div
                    className="p-2 border-end text-truncate"
                    style={{ width: '100px', flexShrink: 0 }}
                    title={companyName}
                >
                    <small>{companyName}</small>
                </div>

                {/* Category */}
                <div
                    className="p-2 border-end text-truncate"
                    style={{ width: '100px', flexShrink: 0 }}
                    title={categoryName}
                >
                    <small>{categoryName}</small>
                </div>

                {/* VAT */}
                <div
                    className="p-2 border-end d-flex justify-content-center"
                    style={{ width: '70px', flexShrink: 0 }}
                >
                    <Badge bg={isVatable ? 'success' : 'warning'} pill>
                        {isVatable ? '13%' : 'Exempt'}
                    </Badge>
                </div>

                {/* Actions */}
                <div
                    className="p-2 d-flex justify-content-end gap-1"
                    style={{ width: '120px', flexShrink: 0 }}
                >
                    <Button
                        variant="outline-info"
                        size="sm"
                        className="p-1"
                        onClick={handleView}
                        aria-label={`View ${itemName}`}
                    >
                        <FiEye size={14} />
                    </Button>

                    {isAdminOrSupervisor && (
                        <>
                            <Button
                                variant="outline-warning"
                                size="sm"
                                className="p-1"
                                onClick={handleEditClick}
                                aria-label={`Edit ${itemName}`}
                            >
                                <FiEdit2 size={14} />
                            </Button>
                            <Button
                                variant="outline-danger"
                                size="sm"
                                className="p-1"
                                onClick={handleDeleteClick}
                                aria-label={`Delete ${itemName}`}
                            >
                                <FiTrash2 size={14} />
                            </Button>
                        </>
                    )}

                    <Button
                        variant="outline-success"
                        size="sm"
                        className="p-1"
                        onClick={handleSelect}
                        aria-label={`Select ${itemName}`}
                    >
                        <FiCheck size={14} />
                    </Button>
                </div>
            </div>
        );
    }, (prevProps, nextProps) => {
        // Custom comparison function
        if (prevProps.index !== nextProps.index) return false;
        if (prevProps.style !== nextProps.style) return false;

        const prevItem = prevProps.data.items[prevProps.index];
        const nextItem = nextProps.data.items[nextProps.index];

        return (
            shallowEqual(prevItem, nextItem) &&
            prevProps.data.isAdminOrSupervisor === nextProps.data.isAdminOrSupervisor
        );
    });

    // Usage in your component
    <div className="card h-100 shadow-lg">
        <div className="card-body p-0 d-flex flex-column">
            <TableHeader />
            <div style={{ flex: 1, minHeight: 0 }}>
                {loading ? (
                    <div className="d-flex flex-column justify-content-center align-items-center h-100">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2 text-muted">Loading items...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="d-flex justify-content-center align-items-center h-100">
                        <div className="text-center p-4 text-muted">
                            <FiPackage size={32} className="mb-2" />
                            <p>No items found</p>
                        </div>
                    </div>
                ) : (
                    <AutoSizer>
                        {({ height, width }) => (
                            <List
                                height={height}
                                itemCount={filteredItems.length}
                                itemSize={70} // Slightly increased row height
                                width={width}
                                itemData={{
                                    items: filteredItems,
                                    isAdminOrSupervisor: data.isAdminOrSupervisor
                                }}
                            >
                                {TableRow}
                            </List>
                        )}
                    </AutoSizer>
                )}
            </div>
        </div>
    </div>

    // Data fetching and management
    const fetchItems = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/retailer/items');

            if (response.data.redirectTo) {
                navigate(response.data.redirectTo);
                return;
            }

            if (response.data.success) {
                const transactionsMap = {};
                response.data.items.forEach(item => {
                    transactionsMap[item._id] = item.hasTransactions === 'true';
                });

                setItemsWithTransactions(transactionsMap);

                const newData = {
                    items: response.data.items,
                    categories: response.data.categories,
                    itemsCompanies: response.data.itemsCompanies,
                    units: response.data.units,
                    mainUnits: response.data.mainUnits,
                    compositions: response.data.composition,
                    company: response.data.company,
                    currentFiscalYear: response.data.currentFiscalYear,
                    vatEnabled: response.data.vatEnabled,
                    companyId: response.data.companyId,
                    currentCompanyName: response.data.currentCompanyName,
                    companyDateFormat: response.data.companyDateFormat,
                    nepaliDate: response.data.nepaliDate,
                    fiscalYear: response.data.fiscalYear,
                    user: response.data.user,
                    theme: response.data.theme,
                    isAdminOrSupervisor: response.data.isAdminOrSupervisor
                };

                setData(newData);
                setIsTableDataFresh(true);
                setLastUpdated(new Date().toISOString());
                setItemsTableDraftSave({
                    items: newData.items,
                    lastUpdated: new Date().toISOString()
                });
            } else {
                throw new Error(response.data.error || 'Failed to fetch items');
            }
        } catch (err) {
            if (itemsTableDraftSave) {
                setData(prev => ({
                    ...prev,
                    items: itemsTableDraftSave.items
                }));
                showNotificationMessage('Using cached data. Could not fetch fresh items.', 'warning');
            } else {
                handleApiError(err);
            }
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            hscode: '',
            category: '',
            itemsCompany: '',
            composition: '',
            compositionIds: '',
            mainUnit: '',
            WSUnit: '',
            unit: '',
            vatStatus: '',
            reorderLevel: '',
            price: '',
            puPrice: '',
            openingStock: '',
            openingStockBalance: ''
        });
        setCurrentItem(null);
    };

    const handleApiError = (error) => {
        let errorMessage = 'An error occurred';

        if (error.response) {
            switch (error.response.status) {
                case 400:
                    if (error.response.data.error === 'No fiscal year found in session.') {
                        navigate('/select-fiscal-year');
                        return;
                    }
                    errorMessage = error.response.data.error || 'Invalid request';
                    break;
                case 401:
                    navigate('/login');
                    return;
                case 403:
                    navigate('/dashboard');
                    return;
                default:
                    errorMessage = error.response.data.message || 'Request failed';
            }
        } else if (error.request) {
            errorMessage = 'No response from server. Please check your connection.';
        } else {
            errorMessage = error.message || 'An error occurred';
        }

        showNotificationMessage(errorMessage, 'error');
    };


    const handleSearch = (e) => {
        setSearchTerm(e.target.value.toLowerCase());
    };

    const handleEdit = async (item) => {
        setCurrentItem(item);

        setFormData({
            name: item.name,
            hscode: item.hscode || '',
            category: item.category?._id || '',
            itemsCompany: item.itemsCompany?._id || '',
            composition: item.composition?.map(c => c.name).join(', ') || '',
            compositionIds: item.composition?.map(c => c._id).join(',') || '',
            mainUnit: item.mainUnit?._id || '',
            WSUnit: item.WSUnit || '',
            unit: item.unit?._id || '',
            vatStatus: item.vatStatus || '',
            reorderLevel: item.reorderLevel || '',
            price: item.price || '',
            puPrice: item.puPrice || '',
            openingStock: item.openingStock || '',
            openingStockBalance: item.openingStockBalance || (item.puPrice * item.openingStock).toFixed(2)
        });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            try {
                const response = await api.delete(`/api/retailer/items/${id}`);

                if (response.data.success) {
                    showNotificationMessage(response.data.message || 'Item deleted successfully', 'success');
                    fetchItems(); // Refresh the list
                } else {
                    showNotificationMessage(response.data.message || 'Failed to delete item', 'error');
                }
            } catch (err) {
                // Handle specific error cases
                if (err.response && err.response.status === 400) {
                    showNotificationMessage(err.response.data.message || 'Item cannot be deleted as it has related transactions', 'error');
                } else {
                    showNotificationMessage(err.message || 'Failed to delete item', 'error');
                }
            }
        }
    };

    const handleSelectItem = (item) => {
        setFormData({
            name: item.name,
            hscode: item.hscode || '',
            category: item.category?._id || '',
            itemsCompany: item.itemsCompany?._id || '',
            composition: item.composition?.map(c => c.name).join(', ') || '',
            compositionIds: item.composition?.map(c => c._id).join(',') || '',
            mainUnit: item.mainUnit?._id || '',
            WSUnit: item.WSUnit || '',
            unit: item.unit?._id || '',
            vatStatus: item.vatStatus || '',
            reorderLevel: item.reorderLevel || '',
            price: item.price || '',
            puPrice: item.puPrice || '',
            openingStock: item.openingStock || '',
            openingStockBalance: item.openingStockBalance || (item.puPrice * item.openingStock).toFixed(2)
        });
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // If the field being changed is the name field, also update the search term
        if (name === 'name') {
            setSearchTerm(value.toLowerCase());
        }
    };

    const handleCompositionSelect = (composition) => {
        setSelectedCompositions(prev => {
            const exists = prev.some(c => c._id === composition._id);
            if (exists) {
                return prev.filter(c => c._id !== composition._id);
            } else {
                return [...prev, composition];
            }
        });
    };

    const handleSelectAllCompositions = (e) => {
        if (e.target.checked) {
            setSelectedCompositions(filteredCompositions);
        } else {
            setSelectedCompositions([]);
        }
    };

    const handleCompositionDone = () => {
        setFormData(prev => ({
            ...prev,
            composition: selectedCompositions.map(c => c.name).join(', '),
            compositionIds: selectedCompositions.map(c => c._id).join(',')
        }));
        setShowCompositionModal(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (currentItem) {
                await api.put(`/api/retailer/items/${currentItem._id}`, formData);
                showNotificationMessage('Item updated successfully!', 'success');
            } else {
                await api.post('/api/retailer/items/create', formData);
                showNotificationMessage('Item created successfully!', 'success');

                // Clear the form after successful creation
                setFormData({
                    name: '',
                    hscode: '',
                    category: '',
                    itemsCompany: '',
                    composition: '',
                    compositionIds: '',
                    mainUnit: '',
                    WSUnit: '',
                    unit: '',
                    vatStatus: '',
                    reorderLevel: '',
                    price: '',
                    puPrice: '',
                    openingStock: '',
                    openingStockBalance: ''
                });
            }
            fetchItems();
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredCompositions = data.compositions.filter(comp =>
        comp.name.toLowerCase().includes(compositionSearch.toLowerCase()) ||
        (comp.uniqueNumber && comp.uniqueNumber.toString().includes(compositionSearch))
    );

    const printItems = () => {
        // Use fresh data if available, otherwise fall back to draft
        const itemsToPrintSource = isTableDataFresh ? data.items :
            (itemsTableDraftSave?.items || data.items);

        let itemsToPrint = [...itemsToPrintSource];

        switch (printOption) {
            case 'active':
                itemsToPrint = itemsToPrint.filter(item => item.status === 'active');
                break;
            case 'vatable':
                itemsToPrint = itemsToPrint.filter(item => item.vatStatus === 'vatable');
                break;
            case 'vatExempt':
                itemsToPrint = itemsToPrint.filter(item => item.vatStatus === 'vatExempt');
                break;
            case 'category':
                itemsToPrint = itemsToPrint.filter(item => item.category?._id === selectedCategory);
                break;
            case 'itemsCompany':
                itemsToPrint = itemsToPrint.filter(item => item.itemsCompany?._id === selectedCompany);
                break;
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
        <html>
            <head>
                <title>Items Report - ${data.currentCompanyName}</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    h2, h3 { color: #333; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .badge { padding: 3px 6px; border-radius: 3px; font-size: 12px; }
                    .badge-success { background-color: #28a745; color: white; }
                    .badge-danger { background-color: #dc3545; color: white; }
                    .badge-warning { background-color: #ffc107; color: black; }
                    .draft-notice { 
                        background-color: #fff3cd; 
                        padding: 5px; 
                        border-left: 4px solid #ffc107;
                        margin-bottom: 15px;
                    }
                </style>
            </head>
            <body>
                <h2>Items Report - ${data.currentCompanyName}</h2>
                ${!isTableDataFresh && itemsTableDraftSave ?
                `<div class="draft-notice">
                        <strong>Note:</strong> This report is generated from cached data last updated at 
                        ${new Date(itemsTableDraftSave.lastUpdated).toLocaleString()}
                    </div>` : ''
            }
                <h3>Fiscal Year: ${data.currentFiscalYear?.name || 'N/A'}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>S.N.</th>
                            <th>Name</th>
                            <th>Company</th>
                            <th>Category</th>
                            <th>VAT</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsToPrint.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.name}</td>
                                <td>${item.itemsCompany?.name || 'N/A'}</td>
                                <td>${item.category?.name || 'N/A'}</td>
                                <td>
                                    <span class="badge ${item.vatStatus === 'vatable' ? 'badge-success' : 'badge-warning'}">
                                        ${item.vatStatus === 'vatable' ? '13%' : 'Exempt'}
                                    </span>
                                </td>
                                <td>
                                    <span class="badge ${item.status === 'active' ? 'badge-success' : 'badge-danger'}">
                                        ${item.status}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
                    Printed on: ${data.companyDateFormat === 'nepali' ?
                data.nepaliDate :
                new Date().toLocaleDateString()}
                    ${!isTableDataFresh ? ' (using cached data)' : ''}
                </p>
            </body>
        </html>
    `);
        printWindow.document.close();
        printWindow.print();
    };

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                setShowSaveConfirmModal(true);
            } else if (e.key === 'F6' && !showCompositionModal) {
                e.preventDefault();
                setShowCompositionModal(true);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const form = e.target.form;
                if (form) {
                    const index = Array.prototype.indexOf.call(form, e.target);
                    if (index < form.length - 1) {
                        form.elements[index + 1].focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showCompositionModal]);

    return (
        <div className="container-fluid">
            {/* Notification Toast */}
            <NotificationToast
                message={notificationMessage}
                type={notificationType}
                show={showNotification}
                onClose={() => setShowNotification(false)}
            />
            <Header />
            <div className="row g-3">
                {/* Left Column - Add Item Form */}
                <div className="col-lg-6">
                    <div className="card h-100 shadow-lg">
                        <h1 className="text-center" style={{ textDecoration: 'underline' }}>
                            {currentItem ? `Edit Item: ${currentItem.name}` : 'Create Items'}
                        </h1>                        <div className="card-body">
                            <Form onSubmit={handleSubmit} id="addItemForm">
                                <Form.Group className="row mb-3">
                                    <div className="col">
                                        <Form.Label>Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleFormChange}
                                            placeholder="Enter item name"
                                            required
                                            autoFocus
                                            autoComplete='off'
                                        />
                                    </div>
                                    <div className="col-3">
                                        <Form.Label>HSN</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="hscode"
                                            value={formData.hscode}
                                            onChange={handleFormChange}
                                            autoComplete='off'
                                        />
                                    </div>
                                    <div className="col-3">
                                        <Form.Label>Company <span className="text-danger">*</span></Form.Label>
                                        <Form.Select
                                            name="itemsCompany"
                                            value={formData.itemsCompany}
                                            onChange={handleFormChange}
                                            required
                                        >
                                            <option value="" disabled>Select company</option>
                                            {data.itemsCompanies.map(company => (
                                                <option key={company._id} value={company._id}>
                                                    {company.name}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </div>
                                </Form.Group>

                                <Form.Group className="row mb-3">
                                    <div className="col-3">
                                        <Form.Label>Category <span className="text-danger">*</span></Form.Label>
                                        <Form.Select
                                            name="category"
                                            value={formData.category}
                                            onChange={handleFormChange}
                                            required
                                        >
                                            <option value="" disabled>Select category</option>
                                            {data.categories.map(category => (
                                                <option key={category._id} value={category._id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </div>
                                    <div className="col-9">
                                        <Form.Label>Composition</Form.Label>
                                        <div className="input-group">
                                            <Form.Control
                                                as="textarea"
                                                rows={1}
                                                name="composition"
                                                value={formData.composition}
                                                onChange={handleFormChange}
                                                placeholder="Press F6 to add compositions"
                                                autoComplete='off'
                                                onKeyDown={(e) => {
                                                    if (e.key === 'F6') {
                                                        e.preventDefault();
                                                        setShowCompositionModal(true);
                                                    }
                                                }}
                                            />
                                            <Button
                                                variant="outline-secondary"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        document.querySelector('select[name="mainUnit"]').focus();
                                                    }
                                                }}
                                                onClick={() => setShowCompositionModal(true)}
                                            >
                                                <FiPlus />
                                            </Button>
                                        </div>
                                        <Form.Control type="hidden" name="compositionIds" value={formData.compositionIds} />
                                    </div>
                                </Form.Group>

                                <Form.Group className="row mb-3">
                                    <div className="col">
                                        <Form.Label>Main Unit <span className="text-danger">*</span></Form.Label>
                                        <Form.Select
                                            name="mainUnit"
                                            value={formData.mainUnit}
                                            onChange={handleFormChange}
                                            required
                                        >
                                            <option value="" disabled>Select Main Unit</option>
                                            {data.mainUnits.map(unit => (
                                                <option key={unit._id} value={unit._id}>
                                                    {unit.name}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </div>
                                    <div className="col">
                                        <Form.Label>WS Unit</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="WSUnit"
                                            value={formData.WSUnit}
                                            onChange={handleFormChange}
                                            autoComplete='off'
                                        />
                                    </div>
                                    <div className="col">
                                        <Form.Label>Unit <span className="text-danger">*</span></Form.Label>
                                        <Form.Select
                                            name="unit"
                                            value={formData.unit}
                                            onChange={handleFormChange}
                                            required
                                        >
                                            <option value="" disabled>Select Unit</option>
                                            {data.units.map(unit => (
                                                <option key={unit._id} value={unit._id}>
                                                    {unit.name}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </div>
                                </Form.Group>

                                <Form.Group className="row mb-3">
                                    <div className="col">
                                        <Form.Label>VAT <span className="text-danger">*</span></Form.Label>
                                        <Form.Select
                                            name="vatStatus"
                                            value={formData.vatStatus}
                                            onChange={handleFormChange}
                                            required
                                        >
                                            <option value="" disabled>Select VAT</option>
                                            {data.vatEnabled && <option value="vatable">Vatable</option>}
                                            <option value="vatExempt">VAT Exempt</option>
                                        </Form.Select>
                                    </div>
                                    <div className="col">
                                        <Form.Label>Re-Order (Qty)</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="reorderLevel"
                                            value={formData.reorderLevel}
                                            onChange={handleFormChange}
                                            autoComplete='off'
                                        />
                                    </div>
                                    <div className="col">
                                        <Form.Label>Sales Price</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="price"
                                            value={formData.price}
                                            onChange={handleFormChange}
                                            step="0.01"
                                            autoComplete='off'
                                        />
                                    </div>
                                </Form.Group>

                                <Form.Group className="row mb-3">
                                    <div className="col-md-3">
                                        <Form.Label>Purchase Price</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="puPrice"
                                            value={formData.puPrice}
                                            onChange={(e) => {
                                                const puPrice = parseFloat(e.target.value) || 0;
                                                const openingStock = parseFloat(formData.openingStock) || 0;
                                                const hasTransactions = currentItem ? itemsWithTransactions[currentItem._id] : false;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    puPrice: e.target.value,
                                                    openingStockBalance: hasTransactions ? prev.openingStockBalance : (puPrice * openingStock).toFixed(2)
                                                }));
                                            }}
                                            step="any"
                                            autoComplete='off'
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <Form.Label>Opening Stock</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="openingStock"
                                            value={formData.openingStock}
                                            onChange={(e) => {
                                                if (currentItem && itemsWithTransactions[currentItem._id]) return;
                                                const openingStock = parseFloat(e.target.value) || 0;
                                                const puPrice = parseFloat(formData.puPrice) || 0;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    openingStock: e.target.value,
                                                    openingStockBalance: (puPrice * openingStock).toFixed(2)
                                                }));
                                            }}
                                            readOnly={currentItem ? itemsWithTransactions[currentItem._id] : false}
                                            autoComplete='off'
                                            className={currentItem && itemsWithTransactions[currentItem._id] ? 'bg-light' : ''}
                                        />
                                    </div>
                                    <div className="col">
                                        <Form.Label>Opening Stock Value</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="openingStockBalance"
                                            value={formData.openingStockBalance}
                                            onChange={handleFormChange}
                                            step="any"
                                            readOnly={currentItem ? itemsWithTransactions[currentItem._id] : false}
                                            autoComplete='off'
                                            className={currentItem && itemsWithTransactions[currentItem._id] ? 'bg-light' : ''}
                                        />
                                        {currentItem && itemsWithTransactions[currentItem._id] && (
                                            <small className="text-muted">
                                                Opening stock cannot be modified because this item has existing transactions
                                            </small>
                                        )}
                                    </div>
                                </Form.Group>
                                <Button variant="primary" type="submit" disabled={isSaving}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSubmit(e);
                                        }
                                    }}
                                >
                                    {isSaving ? (
                                        <>
                                            <Spinner
                                                as="span"
                                                animation="border"
                                                size="sm"
                                                role="status"
                                                aria-hidden="true"
                                                className="me-2"
                                            />
                                            Saving...
                                        </>
                                    ) : currentItem ? (
                                        'Save Changes'
                                    ) : (
                                        'Add Item'
                                    )}
                                </Button>
                                {/* Add this cancel button */}
                                <Button
                                    variant="secondary"
                                    className="ms-2"
                                    onClick={resetForm}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <small className="ms-2">To Save Press Alt+S</small>
                            </Form>
                        </div>
                    </div>
                </div>

                {/* Right Column - Existing Items */}
                <div className="col-lg-6">
                    <div className="card h-100 shadow-lg" style={{ height: '600px' }}>
                        <div className="card-body">
                            <h1 className="text-center" style={{ textDecoration: 'underline' }}>Existing Items</h1>

                            <div className="row mb-3">
                                <div className="col-2">
                                    <Button variant="primary" onClick={() => navigate(-1)}>
                                        <FiArrowLeft /> Back
                                    </Button>
                                </div>
                                <div className="col-1">
                                    <Button variant="primary" onClick={() => setShowPrintModal(true)}>
                                        <FiPrinter />
                                    </Button>
                                </div>
                                <div className="col">
                                    <Form.Control
                                        type="text"
                                        placeholder="Search items by name..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                            </div>

                            {/* Virtualized Table */}
                            <div style={{ height: '400px', width: '100%' }}>
                                {/* Table Header */}
                                <div className="d-flex bg-primary text-white">
                                    <div className="flex-grow-1 p-2 border-end" style={{ width: '400px' }}>
                                        <strong>Description of Goods</strong>
                                    </div>
                                    <div className="p-2 border-end" style={{ width: '100px' }}>
                                        <strong>Company</strong>
                                    </div>
                                    <div className="p-2 border-end" style={{ width: '100px' }}>
                                        <strong>Category</strong>
                                    </div>
                                    <div className="p-2 border-end" style={{ width: '70px' }}>
                                        <strong>VAT</strong>
                                    </div>
                                    <div className="p-2" style={{ width: '120px' }}>
                                        <strong>Actions</strong>
                                    </div>
                                </div>

                                {/* Virtualized List */}
                                {loading ? (
                                    <div className="text-center p-4">
                                        <Spinner animation="border" />
                                        <p>Loading items...</p>
                                    </div>
                                ) : filteredItems.length === 0 ? (
                                    <div className="text-center p-4">No items found</div>
                                ) : (
                                    <AutoSizer>
                                        {({ height, width }) => (
                                            <List
                                                height={height}
                                                itemCount={filteredItems.length}
                                                itemSize={60}
                                                width={width}
                                                itemData={{
                                                    items: filteredItems,
                                                    isAdminOrSupervisor: data.isAdminOrSupervisor
                                                }}
                                            >
                                                {TableRow}
                                            </List>
                                        )}
                                    </AutoSizer>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Print Options Modal */}
            <Modal show={showPrintModal} onHide={() => setShowPrintModal(false)} centered>
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title><FiPrinter className="me-2" />Print Options</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Label className="fw-bold mb-3">Select Print Option:</Form.Label>

                        <Form.Check
                            type="radio"
                            id="printAll"
                            name="printOption"
                            label={
                                <div className="d-flex align-items-center">
                                    <span className="me-3"><FiPrinter /></span>
                                    <div>
                                        <strong>All Items</strong>
                                        <p className="mb-0 small text-muted">Print all items in your inventory</p>
                                    </div>
                                </div>
                            }
                            checked={printOption === 'all'}
                            onChange={() => setPrintOption('all')}
                            className="mb-3 p-3 border rounded"
                        />

                        <Form.Check
                            type="radio"
                            id="printActive"
                            name="printOption"
                            label={
                                <div className="d-flex align-items-center">
                                    <span className="me-3"><FiPrinter /></span>
                                    <div>
                                        <strong>Active Items Only</strong>
                                        <p className="mb-0 small text-muted">Print only active inventory items</p>
                                    </div>
                                </div>
                            }
                            checked={printOption === 'active'}
                            onChange={() => setPrintOption('active')}
                            className="mb-3 p-3 border rounded"
                        />

                        <Form.Check
                            type="radio"
                            id="printVatable"
                            name="printOption"
                            label={
                                <div className="d-flex align-items-center">
                                    <span className="me-3"><FiPrinter /></span>
                                    <div>
                                        <strong>Vatable Items Only</strong>
                                        <p className="mb-0 small text-muted">Print items subject to VAT</p>
                                    </div>
                                </div>
                            }
                            checked={printOption === 'vatable'}
                            onChange={() => setPrintOption('vatable')}
                            className="mb-3 p-3 border rounded"
                        />

                        <Form.Check
                            type="radio"
                            id="printExempt"
                            name="printOption"
                            label={
                                <div className="d-flex align-items-center">
                                    <span className="me-3"><FiPrinter /></span>
                                    <div>
                                        <strong>VAT Exempt Items Only</strong>
                                        <p className="mb-0 small text-muted">Print VAT-exempt items</p>
                                    </div>
                                </div>
                            }
                            checked={printOption === 'vatExempt'}
                            onChange={() => setPrintOption('vatExempt')}
                            className="mb-3 p-3 border rounded"
                        />

                        <Form.Check
                            type="radio"
                            id="printCategory"
                            name="printOption"
                            label={
                                <div className="d-flex align-items-center">
                                    <span className="me-3"><FiPrinter /></span>
                                    <div>
                                        <strong>Category Wise</strong>
                                        <p className="mb-0 small text-muted">Print items from a specific category</p>
                                    </div>
                                </div>
                            }
                            checked={printOption === 'category'}
                            onChange={() => setPrintOption('category')}
                            className="mb-3 p-3 border rounded"
                        />

                        {printOption === 'category' && (
                            <div className="card p-3 mt-3">
                                <Form.Label className="fw-bold mb-2">Select Category:</Form.Label>
                                <Form.Select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    {data.categories.map(category => (
                                        <option key={category._id} value={category._id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </div>
                        )}

                        <Form.Check
                            type="radio"
                            id="printCompany"
                            name="printOption"
                            label={
                                <div className="d-flex align-items-center">
                                    <span className="me-3"><FiPrinter /></span>
                                    <div>
                                        <strong>Company Wise</strong>
                                        <p className="mb-0 small text-muted">Print items from a specific company</p>
                                    </div>
                                </div>
                            }
                            checked={printOption === 'itemsCompany'}
                            onChange={() => setPrintOption('itemsCompany')}
                            className="mb-3 p-3 border rounded"
                        />

                        {printOption === 'itemsCompany' && (
                            <div className="card p-3 mt-3">
                                <Form.Label className="fw-bold mb-2">Select Company:</Form.Label>
                                <Form.Select
                                    value={selectedCompany}
                                    onChange={(e) => setSelectedCompany(e.target.value)}
                                >
                                    {data.itemsCompanies.map(company => (
                                        <option key={company._id} value={company._id}>
                                            {company.name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </div>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowPrintModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => {
                        printItems();
                        setShowPrintModal(false);
                    }}>
                        Print
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Composition Selection Modal */}
            <Modal show={showCompositionModal} onHide={() => setShowCompositionModal(false)} size="lg" centered>
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title>
                        <div className="d-flex align-items-center">
                            <FiEdit2 className="me-2" />
                            <span>Select Compositions</span>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-0">
                    <div className="sticky-top p-3 bg-light border-bottom">
                        <div className="input-group">
                            <span className="input-group-text bg-white">
                                <i className="bi bi-search"></i>
                            </span>
                            <Form.Control
                                type="search"
                                placeholder="Search compositions by name or code..."
                                value={compositionSearch}
                                onChange={(e) => setCompositionSearch(e.target.value)}
                                autoFocus
                                className="border-start-0"
                            />
                        </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center p-3 bg-light border-bottom">
                        <small className="text-muted">
                            Showing {filteredCompositions.length} of {data.compositions.length} compositions
                        </small>
                        <Form.Check
                            type="checkbox"
                            label="Select All"
                            checked={selectedCompositions.length === filteredCompositions.length && filteredCompositions.length > 0}
                            onChange={handleSelectAllCompositions}
                            className="ms-2"
                        />
                    </div>

                    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {filteredCompositions.length === 0 ? (
                            <div className="text-center p-5">
                                <div className="mb-3">
                                    <i className="bi bi-search text-muted" style={{ fontSize: '2rem' }}></i>
                                </div>
                                <h5 className="text-muted">No compositions found</h5>
                                <p className="text-muted small">Try a different search term</p>
                            </div>
                        ) : (
                            <div className="list-group list-group-flush">
                                {filteredCompositions.map(comp => (
                                    <div
                                        key={comp._id}
                                        className={`list-group-item list-group-item-action ${selectedCompositions.some(c => c._id === comp._id) ? 'active' : ''}`}
                                        onClick={() => handleCompositionSelect(comp)}
                                    >
                                        <div className="d-flex align-items-center">
                                            <Form.Check
                                                type="checkbox"
                                                checked={selectedCompositions.some(c => c._id === comp._id)}
                                                onChange={() => handleCompositionSelect(comp)}
                                                className="me-3 flex-shrink-0"
                                            />
                                            <div className="flex-grow-1">
                                                <div className="d-flex justify-content-between">
                                                    <strong>{comp.name}</strong>
                                                    {comp.uniqueNumber && (
                                                        <span className="badge bg-secondary ms-2">
                                                            #{comp.uniqueNumber}
                                                        </span>
                                                    )}
                                                </div>
                                                {comp.description && (
                                                    <small className="text-muted d-block mt-1">
                                                        {comp.description}
                                                    </small>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer className="d-flex justify-content-between">
                    <div>
                        <Badge bg="primary" className="me-2">
                            {selectedCompositions.length} selected
                        </Badge>
                        <small className="text-muted">
                            {selectedCompositions.length > 0 ?
                                selectedCompositions.map(c => c.name).join(', ') :
                                'No compositions selected'}
                        </small>
                    </div>
                    <div>
                        <Button
                            variant="outline-secondary"
                            onClick={() => setShowCompositionModal(false)}
                            className="me-2"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleCompositionDone}
                            disabled={selectedCompositions.length === 0}
                        >
                            <FiCheck className="me-1" />
                            Apply Selected
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>

            {/* Save Confirmation Modal */}
            <Modal show={showSaveConfirmModal} onHide={() => setShowSaveConfirmModal(false)} centered>
                <Modal.Header closeButton className="bg-warning text-dark">
                    <Modal.Title>Confirm Save</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to save this item?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowSaveConfirmModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => {
                        document.getElementById('addItemForm').dispatchEvent(new Event('submit'));
                        setShowSaveConfirmModal(false);
                    }}>
                        Save
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Product modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}
        </div>
    );
};

export default Items;