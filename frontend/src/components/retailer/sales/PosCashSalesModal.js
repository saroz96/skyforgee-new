
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NepaliDate from 'nepali-date-converter';
import axios from 'axios';
import Header from '../Header';
import NotificationToast from '../../NotificationToast';
import '../../../stylesheet/retailer/sales/AddCashSales.css';
import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
import '../../../stylesheet/noDateIcon.css';
import ProductModal from '../dashboard/modals/ProductModal';
import AccountCreationModal from './AccountCreationModal';
import '../../../stylesheet/retailer/sales/POSStylesSales.css';
import StockAdjustmentModal from './StockAdjustmentModal';
import DiscountModal from './DiscountModal';

const PosCashSalesModal = ({ show, onClose, onSaleComplete }) => {
    const navigate = useNavigate();

    // POS State Management
    const [quantityErrors, setQuantityErrors] = useState({});
    const [stockValidation, setStockValidation] = useState({
        itemStockMap: new Map(),
        usedStockMap: new Map(),
    });
    const [dateErrors, setDateErrors] = useState({
        transactionDateNepali: '',
        nepaliDate: ''
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showStockAdjustmentModal, setShowStockAdjustmentModal] = useState(false);
    const [selectedProductForStock, setSelectedProductForStock] = useState(null);
    const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
    const [showAccountCreationModal, setShowAccountCreationModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [itemSearchTerm, setItemSearchTerm] = useState('');
    const transactionDateRef = useRef(null);
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
    const addressRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
    const [discountInput, setDiscountInput] = useState('');
    const [discountType, setDiscountType] = useState('percentage');
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });

    // Enhanced Form Data for POS
    const [formData, setFormData] = useState({
        cashAccount: '',
        cashAccountId: '',
        cashAccountAddress: '',
        cashAccountPan: '',
        cashAccountEmail: '',
        cashAccountPhone: '',
        transactionDateNepali: currentNepaliDate,
        transactionDateRoman: new Date().toISOString().split('T')[0],
        nepaliDate: currentNepaliDate,
        billDate: new Date().toISOString().split('T')[0],
        billNumber: '',
        paymentMode: 'cash',
        isVatExempt: 'all',
        discountPercentage: 0,
        discountAmount: 0,
        roundOffAmount: 0,
        vatPercentage: 13,
        items: [],
        tenderAmount: 0,
        changeDue: 0,
        transactionType: 'sale',
        referenceNumber: '',
        holdReason: ''
    });

    const [items, setItems] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [filteredAccounts, setFilteredAccounts] = useState([]);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const [filteredItems, setFilteredItems] = useState([]);
    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {},
        posSettings: {
            enableBarcode: true,
            enableQuickKeys: true,
            autoPrint: false,
            requireCustomer: false
        }
    });
    const [nextBillNumber, setNextBillNumber] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');

    const accountSearchRef = useRef(null);
    const itemSearchRef = useRef(null);
    const barcodeInputRef = useRef(null);
    const selectedItemRef = useRef(null);
    const tenderAmountRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Close modal when Escape key is pressed
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && show) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [show]);

    // Load initial data when modal opens
    useEffect(() => {
        if (show) {
            const fetchInitialData = async () => {
                try {
                    const response = await api.get('/api/retailer/cash-sales');
                    const { data } = response;

                    const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
                    const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));

                    setCompany(data.data.company);
                    setAllItems(sortedItems);
                    setAccounts(sortedAccounts);
                    setNextBillNumber(data.data.nextSalesBillNumber);

                    setFormData(prev => ({
                        ...prev,
                        billNumber: data.data.nextSalesBillNumber
                    }));
                    setIsInitialDataLoaded(true);

                    // Focus on barcode input when modal opens
                    setTimeout(() => {
                        barcodeInputRef.current?.focus();
                    }, 100);
                } catch (error) {
                    console.error('Error fetching initial data:', error);
                }
            };
            fetchInitialData();
        }
    }, [show]);

    // Refresh stock data function
    const refreshStockData = async () => {
        try {
            const response = await api.get('/api/retailer/cash-sales');
            const { data } = response;

            const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));
            setAllItems(sortedItems);

            const newItemStockMap = new Map();
            sortedItems.forEach(item => {
                const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
                newItemStockMap.set(item._id, totalStock);
            });

            setStockValidation(prev => ({
                ...prev,
                itemStockMap: newItemStockMap
            }));

            return sortedItems;
        } catch (error) {
            console.error('Error refreshing stock data:', error);
            setNotification({
                show: true,
                message: 'Failed to refresh stock data',
                type: 'error'
            });
            return allItems;
        }
    };

    // Stock validation
    useEffect(() => {
        if (allItems.length > 0) {
            const newItemStockMap = new Map();
            allItems.forEach(item => {
                const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
                newItemStockMap.set(item._id, totalStock);
            });
            setStockValidation(prev => ({ ...prev, itemStockMap: newItemStockMap }));
        }
    }, [allItems]);

    // Enhanced search with debouncing
    useEffect(() => {
        const timer = setTimeout(() => {
            if (barcodeInput.trim()) {
                filterItems(barcodeInput);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [barcodeInput]);

    // Auto-scroll for selected search item
    useEffect(() => {
        if (selectedSearchIndex >= 0 && selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }, [selectedSearchIndex]);

    // Keyboard navigation
    useEffect(() => {
        const handleRowNavigation = (e) => {
            if (!show) return;

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                const focusedElement = document.activeElement;
                const isInTable = focusedElement.closest('.items-table');

                if (isInTable && items.length > 0) {
                    e.preventDefault();
                    let newIndex = selectedRowIndex;

                    if (e.key === 'ArrowDown') {
                        newIndex = selectedRowIndex < items.length - 1 ? selectedRowIndex + 1 : 0;
                    } else if (e.key === 'ArrowUp') {
                        newIndex = selectedRowIndex > 0 ? selectedRowIndex - 1 : items.length - 1;
                    }

                    setSelectedRowIndex(newIndex);

                    setTimeout(() => {
                        const selectedRow = document.querySelector(`tr[data-row-index="${newIndex}"]`);
                        const itemsContainer = document.querySelector('.items-table-container');

                        if (selectedRow && itemsContainer) {
                            const containerRect = itemsContainer.getBoundingClientRect();
                            const rowRect = selectedRow.getBoundingClientRect();

                            const isRowVisible = (
                                rowRect.top >= containerRect.top &&
                                rowRect.bottom <= containerRect.bottom
                            );

                            if (!isRowVisible) {
                                selectedRow.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'nearest'
                                });
                            }
                        }
                    }, 0);
                }
            }

            if (e.key === 'Delete' && selectedRowIndex >= 0) {
                e.preventDefault();
                removeItem(selectedRowIndex);
                const newIndex = selectedRowIndex >= items.length - 1 ? Math.max(0, items.length - 2) : selectedRowIndex;
                setSelectedRowIndex(newIndex);
            }
        };

        if (show) {
            window.addEventListener('keydown', handleRowNavigation);
        }
        return () => window.removeEventListener('keydown', handleRowNavigation);
    }, [selectedRowIndex, items.length, show]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!show) return;

            const focusedElement = document.activeElement;
            const isInputFocused = focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'TEXTAREA';

            if (showItemDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
                handleSearchResultsKeyDown(e);
                return;
            }

            if (!isInputFocused) {
                switch (e.key) {
                    case 'F1':
                        e.preventDefault();
                        barcodeInputRef.current?.focus();
                        break;
                    case 'F2':
                        e.preventDefault();
                        setShowAccountModal(true);
                        break;
                    case 'F3':
                        e.preventDefault();
                        setIsDiscountModalOpen(true);
                        break;
                    case 'F4':
                        e.preventDefault();
                        handleQuickPayment('exact');
                        break;
                    case 'F5':
                        e.preventDefault();
                        resetForm();
                        break;
                    case 'F9':
                        e.preventDefault();
                        setShowProductModal(prev => !prev);
                        break;
                    case 'F12':
                        e.preventDefault();
                        handleSubmit(null, true);
                        break;
                    case 'Escape':
                        e.preventDefault();
                        handleEscapeKey();
                        break;
                }
            }

            if (e.key === 'Enter' && e.target.id === 'tenderAmount') {
                e.preventDefault();
                handleSubmit(e, false);
            }
        };

        if (show) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [items, formData, showItemDropdown, filteredItems, selectedSearchIndex, show]);

    // Auto-scroll to last added item
    useEffect(() => {
        if (show && items.length > 0) {
            const timer = setTimeout(() => {
                const itemsContainer = document.querySelector('.items-table-container');
                const lastRow = document.querySelector(`tr[data-row-index="${items.length - 1}"]`);

                if (itemsContainer && lastRow) {
                    lastRow.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'nearest'
                    });
                    setSelectedRowIndex(items.length - 1);
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [items.length, show]);

    // Stock Calculation Functions
    const calculateUsedStock = (items) => {
        const newUsedStockMap = new Map();
        items.forEach(item => {
            const itemId = item.item;
            const currentUsed = newUsedStockMap.get(itemId) || 0;
            const itemQuantity = parseFloat(item.quantity) || 0;
            newUsedStockMap.set(itemId, currentUsed + itemQuantity);
        });
        return newUsedStockMap;
    };

    const getAvailableStockForDisplay = (item) => {
        if (!item) return 0;
        return stockValidation.itemStockMap.get(item.item) || 0;
    };

    const getRemainingStock = (item, itemsToCheck = items) => {
        if (!item) return 0;
        const itemId = item.item;
        const availableStock = stockValidation.itemStockMap.get(itemId) || 0;
        const usedStockMap = calculateUsedStock(itemsToCheck);
        const totalUsed = usedStockMap.get(itemId) || 0;
        return availableStock - totalUsed;
    };

    const validateQuantity = (index, quantity, itemsToValidate = items) => {
        const item = itemsToValidate[index];
        if (!item) return true;
        const itemId = item.item;
        const availableStock = stockValidation.itemStockMap.get(itemId) || 0;
        if (availableStock === 0 && !stockValidation.itemStockMap.has(itemId)) {
            return true;
        }
        const usedStockMap = calculateUsedStock(itemsToValidate);
        const totalUsed = usedStockMap.get(itemId) || 0;
        return totalUsed <= availableStock;
    };

    const validateAllQuantities = (itemsToValidate = items) => {
        const newErrors = {};
        itemsToValidate.forEach((item, index) => {
            const itemId = item.item;
            if (stockValidation.itemStockMap.has(itemId)) {
                const isValid = validateQuantity(index, item.quantity, itemsToValidate);
                if (!isValid) {
                    const remainingStock = getRemainingStock(item, itemsToValidate);
                    const availableStock = getAvailableStockForDisplay(item);
                    newErrors[index] = `Stock: ${availableStock} | Rem.: ${remainingStock}`;
                }
            }
        });
        setQuantityErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const filterItems = (searchTerm) => {
        if (!searchTerm.trim()) {
            setFilteredItems([]);
            setShowItemDropdown(false);
            setSelectedSearchIndex(-1);
            return;
        }

        const searchLower = searchTerm.toLowerCase();
        const filtered = allItems.filter(item => {
            const matchesName = item.name.toLowerCase().includes(searchLower);
            const matchesCode = item.uniqueNumber && item.uniqueNumber.toString().includes(searchTerm);
            const matchesBarcode = item.barcode && item.barcode.includes(searchTerm);
            const matchesHSCode = item.hscode && item.hscode.toString().includes(searchTerm);
            return matchesName || matchesCode || matchesBarcode || matchesHSCode;
        })
            .slice(0, 8)
            .sort((a, b) => {
                const aNameMatch = a.name.toLowerCase().startsWith(searchLower);
                const bNameMatch = b.name.toLowerCase().startsWith(searchLower);
                if (aNameMatch && !bNameMatch) return -1;
                if (!aNameMatch && bNameMatch) return 1;
                const aStock = a.stockEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0;
                const bStock = b.stockEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0;
                return bStock - aStock;
            });

        setFilteredItems(filtered);
        setShowItemDropdown(filtered.length > 0);
        setSelectedSearchIndex(filtered.length > 0 ? 0 : -1);
    };

    const handleSearchResultsKeyDown = (e) => {
        if (!showItemDropdown || filteredItems.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSearchIndex(prev => prev < filteredItems.length - 1 ? prev + 1 : 0);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSearchIndex(prev => prev > 0 ? prev - 1 : filteredItems.length - 1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedSearchIndex >= 0 && selectedSearchIndex < filteredItems.length) {
                    addItemToBill(filteredItems[selectedSearchIndex]);
                    setBarcodeInput('');
                    setShowItemDropdown(false);
                    setSelectedSearchIndex(-1);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setShowItemDropdown(false);
                setSelectedSearchIndex(-1);
                barcodeInputRef.current?.focus();
                break;
            default:
                break;
        }
    };

    const handleEscapeKey = () => {
        setShowItemDropdown(false);
        setBarcodeInput('');
        setSelectedSearchIndex(-1);
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    };

    const handleAutoScroll = (newItems, previousItems) => {
        if (newItems.length > previousItems.length) {
            const newIndex = newItems.length - 1;
            setTimeout(() => {
                const itemsContainer = document.querySelector('.items-table-container');
                const newRow = document.querySelector(`tr[data-row-index="${newIndex}"]`);
                if (itemsContainer && newRow) {
                    const containerRect = itemsContainer.getBoundingClientRect();
                    const rowRect = newRow.getBoundingClientRect();
                    const isRowVisible = (rowRect.top >= containerRect.top && rowRect.bottom <= containerRect.bottom);
                    if (!isRowVisible) {
                        newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                    setSelectedRowIndex(newIndex);
                }
            }, 150);
        }
    };

    const addItemToBill = (item, batchIndex = 0) => {
        const previousItems = [...items];
        const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
        if (totalStock === 0) {
            setNotification({ show: true, message: `"${item.name}" out of stock`, type: 'error' });
            return;
        }

        const sortedStockEntries = item.stockEntries.sort((a, b) =>
            new Date(a.expiryDate || '9999-12-31') - new Date(b.expiryDate || '9999-12-31')
        );
        const selectedBatch = sortedStockEntries[batchIndex] || {};

        const existingItemIndex = items.findIndex(cartItem =>
            cartItem.item === item._id && cartItem.batchNumber === selectedBatch.batchNumber
        );

        if (existingItemIndex > -1) {
            const updatedItems = [...items];
            const newQuantity = parseFloat(updatedItems[existingItemIndex].quantity) + 1;
            updateItemField(existingItemIndex, 'quantity', newQuantity);
            setTimeout(() => {
                const existingRow = document.querySelector(`tr[data-row-index="${existingItemIndex}"]`);
                if (existingRow) {
                    existingRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    setSelectedRowIndex(existingItemIndex);
                }
            }, 100);
        } else {
            const newItem = {
                item: item._id,
                uniqueNumber: item.uniqueNumber || 'N/A',
                hscode: item.hscode,
                name: item.name,
                category: item.category?.name || 'No Category',
                batchNumber: selectedBatch.batchNumber || '',
                expiryDate: selectedBatch.expiryDate ? new Date(selectedBatch.expiryDate).toISOString().split('T')[0] : '',
                quantity: 1,
                unit: item.unit,
                price: Math.round(selectedBatch.price * 100) / 100 || 0,
                puPrice: selectedBatch.puPrice || 0,
                netPuPrice: selectedBatch.netPuPrice || 0,
                amount: Math.round(selectedBatch.price * 100) / 100 || 0,
                vatStatus: item.vatStatus,
                uniqueUuId: selectedBatch.uniqueUuId,
                barcode: item.barcode
            };

            const updatedItems = [...items, newItem];
            setItems(updatedItems);
            handleAutoScroll(updatedItems, previousItems);
            setTimeout(() => validateAllQuantities(updatedItems), 0);
        }

        const availableStock = stockValidation.itemStockMap.get(item._id) || 0;
        setNotification({
            show: true,
            message: `"${item.name}" added. Available stock: ${availableStock}`,
            type: 'success'
        });

        setShowItemDropdown(false);
        setBarcodeInput('');
        setSelectedSearchIndex(-1);
        barcodeInputRef.current?.focus();
    };

    // const updateItemField = (index, field, value) => {
    //     const updatedItems = items.map((item, i) => {
    //         if (i === index) {
    //             const updatedItem = { ...item, [field]: value };
    //             if (field === 'quantity' || field === 'price') {
    //                 updatedItem.amount = (updatedItem.quantity * updatedItem.price).toFixed(2);
    //             }
    //             return updatedItem;
    //         }
    //         return item;
    //     });

    //     setItems(updatedItems);

    //     if (field === 'quantity') {
    //         const item = updatedItems[index];
    //         const itemId = item.item;
    //         if (stockValidation.itemStockMap.has(itemId)) {
    //             const isValid = validateQuantity(index, value, updatedItems);
    //             const remainingStock = getRemainingStock(item, updatedItems);
    //             const availableStock = getAvailableStockForDisplay(item);
    //             if (!isValid) {
    //                 setQuantityErrors(prev => ({ ...prev, [index]: `Stock: ${availableStock} | Rem.: ${remainingStock}` }));
    //             } else {
    //                 setQuantityErrors(prev => {
    //                     const newErrors = { ...prev };
    //                     delete newErrors[index];
    //                     return newErrors;
    //                 });
    //             }
    //         }
    //     }

    //     if (field === 'quantity' || field === 'price') {
    //         calculateDiscounts(updatedItems);
    //     }
    // };


    const updateItemField = (index, field, value) => {
        const updatedItems = items.map((item, i) => {
            if (i === index) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'quantity' || field === 'price') {
                    updatedItem.amount = (updatedItem.quantity * updatedItem.price).toFixed(2);
                }
                return updatedItem;
            }
            return item;
        });

        setItems(updatedItems);

        // Validate quantity when it changes
        if (field === 'quantity') {
            const item = updatedItems[index];
            const itemId = item.item;

            // Only validate if stock data is available
            if (stockValidation.itemStockMap.has(itemId)) {
                const isValid = validateQuantity(index, value, updatedItems);
                const remainingStock = getRemainingStock(item, updatedItems);
                const availableStock = getAvailableStockForDisplay(item);

                if (!isValid) {
                    setQuantityErrors(prev => ({
                        ...prev,
                        [index]: `Stock: ${availableStock} | Rem.: ${remainingStock}`
                    }));
                } else {
                    setQuantityErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors[index];
                        return newErrors;
                    });
                }
            }
        }

        // Calculate discounts when items change
        if (field === 'quantity' || field === 'price') {
            calculateDiscounts(updatedItems);
        }
    };

    const removeItem = (index) => {
        const updatedItems = items.filter((_, i) => i !== index);
        setItems(updatedItems);
        setTimeout(() => validateAllQuantities(updatedItems), 0);
    };

    const quickQuantityUpdate = (index, action) => {
        const currentQuantity = parseFloat(items[index].quantity) || 0;
        let newQuantity = currentQuantity;
        switch (action) {
            case 'increment': newQuantity = currentQuantity + 1; break;
            case 'decrement': newQuantity = Math.max(1, currentQuantity - 1); break;
            case 'double': newQuantity = currentQuantity * 2; break;
            case 'half': newQuantity = Math.max(1, Math.round(currentQuantity / 2)); break;
            default: return;
        }
        updateItemField(index, 'quantity', newQuantity);
    };

    // POS Calculations
    const calculatePOSSummary = () => {
        const subTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
        const totalItems = items.length;

        const taxableAmount = items.filter(item => item.vatStatus === 'vatable')
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const nonTaxableAmount = items.filter(item => item.vatStatus !== 'vatable')
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        const discountAmount = parseFloat(formData.discountAmount) || 0;
        const discountPercentage = parseFloat(formData.discountPercentage) || 0;

        let discountedTaxableAmount = taxableAmount;
        let discountedNonTaxableAmount = nonTaxableAmount;
        let discountAppliedToTaxable = 0;
        let discountAppliedToNonTaxable = 0;

        if (discountAmount > 0 && subTotal > 0) {
            const taxableRatio = taxableAmount / subTotal;
            const nonTaxableRatio = nonTaxableAmount / subTotal;
            discountAppliedToTaxable = discountAmount * taxableRatio;
            discountAppliedToNonTaxable = discountAmount * nonTaxableRatio;
            discountedTaxableAmount = Math.max(0, taxableAmount - discountAppliedToTaxable);
            discountedNonTaxableAmount = Math.max(0, nonTaxableAmount - discountAppliedToNonTaxable);
        }

        const vatAmount = formData.isVatExempt !== 'true' ? (discountedTaxableAmount * formData.vatPercentage) / 100 : 0;
        const grandTotalBeforeRound = discountedTaxableAmount + discountedNonTaxableAmount + vatAmount;
        const roundOffAmount = parseFloat(formData.roundOffAmount || 0);
        const grandTotal = grandTotalBeforeRound + roundOffAmount;
        const tenderAmount = parseFloat(formData.tenderAmount || 0);
        const changeDue = Math.max(0, tenderAmount - grandTotal);

        return {
            subTotal, totalQuantity, totalItems, discountAmount, taxableAmount, nonTaxableAmount,
            discountedTaxableAmount, discountedNonTaxableAmount, discountAppliedToTaxable,
            discountAppliedToNonTaxable, vatAmount, grandTotal, grandTotalBeforeRound,
            roundOffAmount, changeDue, tenderAmount
        };
    };

    const calculateDiscounts = (itemsToCalculate = items) => {
        const subTotal = itemsToCalculate.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        if (discountType === 'percentage' && discountInput) {
            const discountValue = parseFloat(discountInput) || 0;
            const discountAmount = (subTotal * discountValue) / 100;
            setFormData(prev => ({
                ...prev,
                discountAmount: Math.min(discountAmount, subTotal).toFixed(2),
                discountPercentage: discountValue
            }));
        } else if (discountType === 'amount' && discountInput) {
            const discountAmount = parseFloat(discountInput) || 0;
            const discountPercentage = subTotal > 0 ? (discountAmount / subTotal) * 100 : 0;
            setFormData(prev => ({
                ...prev,
                discountAmount: Math.min(discountAmount, subTotal).toFixed(2),
                discountPercentage: discountPercentage.toFixed(2)
            }));
        }
    };

    const handleQuickPayment = (amount) => {
        const summary = calculatePOSSummary();
        let tenderAmount = 0;
        switch (amount) {
            case 'exact': tenderAmount = summary.grandTotal; break;
            case 'round': tenderAmount = Math.ceil(summary.grandTotal / 10) * 10; break;
            case 'no-discount':
                const vatAmount = (summary.taxableAmount * formData.vatPercentage) / 100;
                tenderAmount = summary.subTotal + vatAmount;
                setFormData(prev => ({ ...prev, discountAmount: 0, discountPercentage: 0 }));
                setDiscountInput('');
                break;
            default: tenderAmount = typeof amount === 'number' ? amount : summary.grandTotal;
        }
        setFormData(prev => ({ ...prev, tenderAmount, changeDue: Math.max(0, tenderAmount - summary.grandTotal) }));
        focusTenderAmount();
    };

    const handleSubmit = async (e, print = false) => {
        if (e) e.preventDefault();

        // Validate dates first
        const transactionDateError = validateNepaliDate(formData.transactionDateNepali, 'transactionDateNepali');
        const invoiceDateError = validateNepaliDate(formData.nepaliDate, 'nepaliDate');

        if (transactionDateError || invoiceDateError) {
            setDateErrors({
                transactionDateNepali: transactionDateError,
                nepaliDate: invoiceDateError
            });
            setNotification({
                show: true,
                message: 'Please fix date errors before completing sale',
                type: 'error'
            });
            return;
        }
        // Validate all quantities before submitting
        const isValid = validateAllQuantities();
        if (!isValid) {
            setNotification({
                show: true,
                message: 'Please fix quantity errors before completing sale',
                type: 'error'
            });

            // Focus on the first error
            const firstErrorIndex = Object.keys(quantityErrors)[0];
            if (firstErrorIndex !== undefined) {
                setTimeout(() => {
                    const errorInput = document.querySelector(`tr:nth-child(${parseInt(firstErrorIndex) + 1}) .quantity-controls input`);
                    errorInput?.focus();
                    errorInput?.select();
                }, 100);
            }

            return;
        }

        if (items.length === 0) {
            setNotification({ show: true, message: 'Please add items to the sale', type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            const billData = {
                ...formData,
                items: items.map(item => ({
                    item: item.item,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    quantity: item.quantity,
                    unit: item.unit?._id,
                    price: item.price,
                    puPrice: item.puPrice,
                    netPuPrice: item.netPuPrice || item.puPrice,
                    vatStatus: item.vatStatus,
                    uniqueUuId: item.uniqueUuId
                })),
                print,
                posData: {
                    summary: calculatePOSSummary(),
                    timestamp: new Date().toISOString()
                }
            };

            const response = await api.post('/api/retailer/cash-sales', billData);

            // Refresh stock data after successful sale
            await refreshStockData();

            setNotification({
                show: true,
                message: print ? 'Receipt printed!' : 'Sale completed!',
                type: 'success'
            });

            if (print) {
                navigate(`/bills/${response.data.data.bill._id}/cash/direct-print`);
            } else {
                resetForm();
            }
        } catch (error) {
            setNotification({
                show: true,
                message: error.response?.data?.error || 'Failed to process sale',
                type: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };


    const resetForm = async () => {
        try {
            await refreshStockData();
            const response = await api.get('/api/retailer/cash-sales');
            const { data } = response;
            const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
            const currentRomanDate = new Date().toISOString().split('T')[0];

            setFormData(prev => ({
                ...prev,
                cashAccount: '', cashAccountId: '', cashAccountAddress: '', cashAccountPan: '',
                cashAccountEmail: '', cashAccountPhone: '', transactionDateNepali: currentNepaliDate,
                transactionDateRoman: currentRomanDate, nepaliDate: currentNepaliDate,
                billDate: currentRomanDate, billNumber: data.data.nextSalesBillNumber,
                tenderAmount: 0, changeDue: 0, discountAmount: 0, discountPercentage: 0,
                roundOffAmount: 0, isVatExempt: 'all', items: []
            }));

            setDateErrors({ transactionDateNepali: '', nepaliDate: '' });
            setItems([]);
            setQuantityErrors({});
            setNextBillNumber(data.data.nextSalesBillNumber);
            barcodeInputRef.current?.focus();
        } catch (err) {
            console.error('Error resetting form:', err);
        }
    };

    const focusTenderAmount = () => {
        setTimeout(() => {
            tenderAmountRef.current?.focus();
            tenderAmountRef.current?.select();
        }, 100);
    };

    const handleAccountCreated = async (newAccountData) => {
        try {
            const response = await api.get('/api/retailer/cash-sales');
            const { data } = response;
            const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
            setAccounts(sortedAccounts);

            if (newAccountData?.name) {
                setFormData(prev => ({
                    ...prev,
                    cashAccount: newAccountData.name,
                    cashAccountId: newAccountData._id,
                    cashAccountAddress: newAccountData.address || '',
                    cashAccountPan: newAccountData.pan || '',
                    cashAccountEmail: newAccountData.email || '',
                    cashAccountPhone: newAccountData.phone || ''
                }));
            }

            setNotification({ show: true, message: 'Account created and selected!', type: 'success' });
        } catch (error) {
            console.error('Error refreshing accounts:', error);
        }
    };

    // Date validation functions
    const validateNepaliDate = (dateStr, fieldName) => {
        try {
            if (!dateStr.trim()) return 'Date is required';
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Invalid format. Use YYYY-MM-DD';
            const [year, month, day] = dateStr.split('-').map(Number);
            if (year < 2000 || year > 2099) return "Year must be between 2000-2099";
            if (month < 1 || month > 12) return "Month must be between 1-12";
            if (day < 1 || day > 32) return "Day must be between 1-32";
            const nepaliDate = new NepaliDate(year, month - 1, day);
            if (nepaliDate.getYear() !== year || nepaliDate.getMonth() + 1 !== month || nepaliDate.getDate() !== day) {
                return "Invalid Nepali date";
            }
            return '';
        } catch (error) {
            return error.message || 'Invalid date';
        }
    };

    const handleDateBlur = (fieldName) => {
        const dateValue = formData[fieldName];
        const error = validateNepaliDate(dateValue, fieldName);
        setDateErrors(prev => ({ ...prev, [fieldName]: error }));

        if (!error && dateValue) {
            try {
                const [year, month, day] = dateValue.split('-').map(Number);
                const nepaliDate = new NepaliDate(year, month - 1, day);
                const englishDate = nepaliDate.toJsDate();
                const romanDate = englishDate.toISOString().split('T')[0];

                if (fieldName === 'transactionDateNepali') {
                    setFormData(prev => ({ ...prev, transactionDateRoman: romanDate }));
                } else if (fieldName === 'nepaliDate') {
                    setFormData(prev => ({ ...prev, billDate: romanDate }));
                }
            } catch (error) {
                console.error('Error converting date:', error);
            }
        }

    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const POSItemRow = ({ item, index, isNew = false }) => {
        const availableStock = getAvailableStockForDisplay(item);
        const remainingStock = getRemainingStock(item);
        const [isHighlighted, setIsHighlighted] = useState(isNew);
        const [localQuantity, setLocalQuantity] = useState(item.quantity.toString());
        const [localPrice, setLocalPrice] = useState(item.price.toString());

        const quantityInputRef = useRef(null);
        const priceInputRef = useRef(null);
        const rowRef = useRef(null);

        const [hasQuantityFocus, setHasQuantityFocus] = useState(false);
        const [hasPriceFocus, setHasPriceFocus] = useState(false);

        useEffect(() => {
            if (!hasQuantityFocus) {
                setLocalQuantity(item.quantity.toString());
            }
        }, [item.quantity, hasQuantityFocus]);

        useEffect(() => {
            if (!hasPriceFocus) {
                setLocalPrice(item.price.toString());
            }
        }, [item.price, hasPriceFocus]);

        useEffect(() => {
            if (isNew) {
                const timer = setTimeout(() => {
                    setIsHighlighted(false);
                }, 2000);
                return () => clearTimeout(timer);
            }
        }, [isNew]);

        const handleQuantityChange = (e) => {
            const value = e.target.value;
            setLocalQuantity(value);
        };

        const handlePriceChange = (e) => {
            const value = e.target.value;
            setLocalPrice(value);
        };

        const updateQuantityInParent = () => {
            if (localQuantity !== '' && localQuantity !== '0') {
                const numValue = parseFloat(localQuantity);
                if (!isNaN(numValue) && numValue > 0) {
                    updateItemField(index, 'quantity', numValue);
                } else {
                    setLocalQuantity(item.quantity.toString());
                }
            } else {
                setLocalQuantity(item.quantity.toString());
            }
        };

        const updatePriceInParent = () => {
            if (localPrice !== '' && localPrice !== '0') {
                const numValue = parseFloat(localPrice);
                if (!isNaN(numValue) && numValue >= 0) {
                    updateItemField(index, 'price', numValue);
                } else {
                    setLocalPrice(item.price.toString());
                }
            } else {
                setLocalPrice(item.price.toString());
            }
        };

        const handleQuantityBlur = (e) => {
            setHasQuantityFocus(false);
            updateQuantityInParent();
        };

        const handlePriceBlur = (e) => {
            setHasPriceFocus(false);
            updatePriceInParent();
        };

        const handleQuantityFocus = (e) => {
            setHasQuantityFocus(true);
            e.target.select();
            setSelectedRowIndex(index);
        };

        const handlePriceFocus = (e) => {
            setHasPriceFocus(true);
            e.target.select();
            setSelectedRowIndex(index);
        };

        const handleQuantityKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateQuantityInParent();
                setHasQuantityFocus(false);
                setTimeout(() => {
                    priceInputRef.current?.focus();
                    priceInputRef.current?.select();
                }, 10);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                updateQuantityInParent();
                setHasQuantityFocus(false);
                if (e.shiftKey) {
                    if (index > 0) {
                        const prevRow = document.querySelector(`tr[data-row-index="${index - 1}"]`);
                        const prevPriceInput = prevRow?.querySelector('.price-input');
                        setTimeout(() => {
                            prevPriceInput?.focus();
                            prevPriceInput?.select();
                        }, 10);
                    }
                } else {
                    setTimeout(() => {
                        priceInputRef.current?.focus();
                        priceInputRef.current?.select();
                    }, 10);
                }
            }
        };

        const handlePriceKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updatePriceInParent();
                setHasPriceFocus(false);

                const nextRow = e.target.closest('tr').nextElementSibling;
                if (nextRow) {
                    const nextQuantityInput = nextRow.querySelector('.quantity-input');
                    setTimeout(() => {
                        nextQuantityInput?.focus();
                        nextQuantityInput?.select();
                    }, 10);
                } else {
                    document.getElementById('tenderAmount')?.focus();
                    document.getElementById('tenderAmount')?.select();
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                updatePriceInParent();
                setHasPriceFocus(false);

                if (e.shiftKey) {
                    setTimeout(() => {
                        quantityInputRef.current?.focus();
                        quantityInputRef.current?.select();
                    }, 10);
                } else {
                    const nextRow = e.target.closest('tr').nextElementSibling;
                    if (nextRow) {
                        const nextQuantityInput = nextRow.querySelector('.quantity-input');
                        setTimeout(() => {
                            nextQuantityInput?.focus();
                            nextQuantityInput?.select();
                        }, 10);
                    } else {
                        document.getElementById('tenderAmount')?.focus();
                        document.getElementById('tenderAmount')?.select();
                    }
                }
            }
        };

        const handleQuickQuantityUpdate = (action) => {
            const currentQuantity = parseFloat(item.quantity) || 0;
            let newQuantity = currentQuantity;

            switch (action) {
                case 'increment': newQuantity = currentQuantity + 1; break;
                case 'decrement': newQuantity = Math.max(1, currentQuantity - 1); break;
                case 'double': newQuantity = currentQuantity * 2; break;
                case 'half': newQuantity = Math.max(1, Math.round(currentQuantity / 2)); break;
                default: return;
            }

            updateItemField(index, 'quantity', newQuantity);
            setLocalQuantity(newQuantity.toString());
        };

        return (
            <tr
                ref={rowRef}
                className={`pos-item-row ${index === selectedRowIndex ? 'selected' : ''} ${isHighlighted ? 'newly-added' : ''}`}
                data-row-index={index}
                onClick={() => setSelectedRowIndex(index)}
                style={{
                    transition: 'background-color 0.2s ease',
                    background: index === selectedRowIndex ? '#e3f2fd' : 'transparent'
                }}
            >
                <td className="text-center" style={{ padding: '12px 8px', fontWeight: '600' }}>{index + 1}</td>
                <td style={{ padding: '12px 8px' }}>
                    <div className="item-info">
                        <div className="item-name" style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '4px' }}>
                            {item.name}
                        </div>
                        <div className="item-details" style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>
                            {item.barcode && <span>Barcode: {item.barcode}</span>}
                            <span>Batch: {item.batchNumber}</span>
                            {item.expiryDate && <span>Exp: {item.expiryDate}</span>}
                            {/* <div className="stock-info small text-muted" style={{ marginTop: '4px', fontWeight: '500' }}>
                                Stock: {availableStock} | Rem: {remainingStock}
                            </div> */}
                        </div>
                    </div>
                </td>
                <td className="text-center" style={{ padding: '12px 8px' }}>
                    <div className="quantity-controls" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px'
                    }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleQuickQuantityUpdate('decrement');
                            }}
                            title="Decrease quantity"
                            style={quantityButtonStyle}
                        >-</button>
                        <input
                            ref={quantityInputRef}
                            type="number"
                            value={localQuantity}
                            onChange={handleQuantityChange}
                            onBlur={handleQuantityBlur}
                            onKeyDown={handleQuantityKeyDown}
                            onFocus={handleQuantityFocus}
                            onClick={(e) => e.stopPropagation()}
                            min="1"
                            step="1"
                            max={availableStock}
                            className={`quantity-input ${quantityErrors[index] ? 'error' : ''}`}
                            placeholder="Qty"
                            style={{
                                width: '70px',
                                padding: '8px',
                                border: quantityErrors[index] ? '2px solid #e74c3c' : '2px solid #bdc3c7',
                                borderRadius: '6px',
                                textAlign: 'center',
                                fontWeight: '600',
                                fontSize: '0.9rem'
                            }}
                        />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleQuickQuantityUpdate('increment');
                            }}
                            title="Increase quantity"
                            style={quantityButtonStyle}
                        >+</button>
                    </div>
                    {quantityErrors[index] && (
                        <div className="quantity-error text-danger small" style={{
                            fontSize: '0.7rem',
                            marginTop: '4px',
                            color: '#e74c3c',
                            fontWeight: '600'
                        }}>
                            {quantityErrors[index]}
                        </div>
                    )}
                </td>
                <td className="text-center" style={{ padding: '12px 8px', fontWeight: '600', color: '#2c3e50' }}>
                    {item.unit?.name}
                </td>
                <td className="text-end" style={{ padding: '12px 8px' }}>
                    <input
                        ref={priceInputRef}
                        type="number"
                        value={localPrice}
                        onChange={handlePriceChange}
                        onBlur={handlePriceBlur}
                        onKeyDown={handlePriceKeyDown}
                        onFocus={handlePriceFocus}
                        onClick={(e) => e.stopPropagation()}
                        step="0.01"
                        min="0"
                        className="price-input"
                        placeholder="0.00"
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '2px solid #3498db',
                            borderRadius: '6px',
                            textAlign: 'right',
                            fontWeight: '600',
                            fontSize: '0.9rem'
                        }}
                    />
                </td>
                <td className="text-end amount-cell" style={{
                    padding: '12px 8px',
                    fontWeight: '700',
                    color: '#27ae60',
                    fontSize: '1rem'
                }}>
                    {parseFloat(item.amount || 0).toFixed(2)}
                </td>
                <td className="text-center" style={{ padding: '12px 8px' }}>
                    <button
                        className="btn-remove"
                        onClick={(e) => {
                            e.stopPropagation();
                            removeItem(index);
                            setSelectedRowIndex(-1);
                        }}
                        title="Remove item"
                        style={{
                            background: '#e74c3c',
                            border: 'none',
                            color: 'white',
                            borderRadius: '6px',
                            width: '30px',
                            height: '30px',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        🗑️
                    </button>
                </td>
            </tr>
        );
    };

    const quantityButtonStyle = {
        background: '#3498db',
        border: 'none',
        color: 'white',
        borderRadius: '6px',
        width: '30px',
        height: '30px',
        fontSize: '1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    // Helper styles
    const summaryRowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid #ecf0f1'
    };

    const amountStyle = {
        fontWeight: '600',
        color: '#2c3e50'
    };

    const quickPaymentButtonStyle = {
        padding: '8px 5px',
        background: '#3498db',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: '600',
        cursor: 'pointer',
        textAlign: 'center'
    };

    const secondaryButtonStyle = {
        padding: '10px',
        background: '#95a5a6',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    };

    const sidebarButtonStyle = {
        width: '100%',
        padding: '12px 10px',
        marginBottom: '10px',
        background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '0.9rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'all 0.3s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    };

    const buttonIconStyle = {
        fontSize: '1.2rem',
        marginRight: '8px'
    };

    const shortcutStyle = {
        opacity: '0.8',
        fontSize: '0.7rem'
    };

    if (!show) return null;

    return (
        <div className="modal fade show" style={{
            display: 'block',
            backgroundColor: 'rgba(0,0,0,0.5)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1050
        }}>
            <div className="modal-dialog modal-xl" style={{
                maxWidth: '95%',
                height: '95%',
                margin: '2.5% auto'
            }}>
                <div className="modal-content" style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Modal Header */}
                    <div className="modal-header" style={{
                        background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                        color: 'white',
                        borderBottom: '3px solid #149174'
                    }}>
                        <h5 className="modal-title" style={{ fontWeight: '700', fontSize: '1.3rem' }}>
                            🏪 QUICK POS - CASH SALES
                        </h5>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={handleClose}
                            style={{ filter: 'brightness(0) invert(1)' }}
                        ></button>
                    </div>

                    {/* Modal Body */}
                    <div className="modal-body" style={{
                        flex: 1,
                        padding: 0,
                        overflow: 'hidden'
                    }}>
                        <div className="ims-container" style={{
                            background: '#ecf0f1',
                            height: '100%',
                            display: 'flex'
                        }}>
                            {/* Sidebar */}
                            <div className="ims-sidebar" style={{
                                background: 'linear-gradient(180deg, #2c3e50 0%, #34495e 100%)',
                                borderRight: '3px solid #1abc9c',
                                width: '200px',
                                flexShrink: 0
                            }}>
                                <div className="sidebar-header" style={{
                                    padding: '15px',
                                    borderBottom: '2px solid #1abc9c',
                                    background: 'rgba(0,0,0,0.2)'
                                }}>
                                    <h6 style={{
                                        color: '#ecf0f1',
                                        margin: 0,
                                        fontSize: '1rem',
                                        fontWeight: '700',
                                        textAlign: 'center'
                                    }}>
                                        POS ACTIONS
                                    </h6>
                                </div>
                                <div className="sidebar-content" style={{ padding: '10px' }}>
                                    <button
                                        className="sidebar-btn"
                                        onClick={() => barcodeInputRef.current?.focus()}
                                        style={sidebarButtonStyle}
                                    >
                                        <span style={buttonIconStyle}>📦</span>
                                        Scan Product
                                        <small style={shortcutStyle}>(F1)</small>
                                    </button>
                                    <button
                                        className="sidebar-btn"
                                        onClick={() => setShowAccountModal(true)}
                                        style={sidebarButtonStyle}
                                    >
                                        <span style={buttonIconStyle}>👤</span>
                                        Customer
                                        <small style={shortcutStyle}>(F2)</small>
                                    </button>
                                    <button
                                        className="sidebar-btn"
                                        onClick={() => setIsDiscountModalOpen(true)}
                                        style={sidebarButtonStyle}
                                    >
                                        <span style={buttonIconStyle}>💰</span>
                                        Discount
                                        <small style={shortcutStyle}>(F3)</small>
                                    </button>
                                    <button
                                        className="sidebar-btn"
                                        onClick={() => setShowProductModal(true)}
                                        style={sidebarButtonStyle}
                                    >
                                        <span style={buttonIconStyle}>🔍</span>
                                        Product Search
                                        <small style={shortcutStyle}>(F9)</small>
                                    </button>
                                    <button
                                        className="sidebar-btn"
                                        onClick={resetForm}
                                        style={sidebarButtonStyle}
                                    >
                                        <span style={buttonIconStyle}>🆕</span>
                                        New Sale
                                        <small style={shortcutStyle}>(F5)</small>
                                    </button>
                                    <button
                                        className="sidebar-btn"
                                        onClick={() => handleSubmit(null, true)}
                                        style={{ ...sidebarButtonStyle, background: '#e74c3c' }}
                                    >
                                        <span style={buttonIconStyle}>🖨️</span>
                                        Print Receipt
                                        <small style={shortcutStyle}>(F12)</small>
                                    </button>
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="ims-main-content" style={{
                                flex: 1,
                                background: '#f8f9fa',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {/* Top Bar */}
                                <div className="ims-top-bar" style={{
                                    background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                                    padding: '10px 20px',
                                    borderBottom: '3px solid #149174'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div className="session-info" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <span className="badge" style={{
                                                background: '#e74c3c',
                                                padding: '6px 12px',
                                                borderRadius: '15px',
                                                fontSize: '0.8rem',
                                                fontWeight: '700'
                                            }}>
                                                🧾 Invoice: {formData.billNumber}
                                            </span>
                                            <span className="time-display" style={{
                                                color: 'white',
                                                fontWeight: '600',
                                                fontSize: '0.9rem'
                                            }}>
                                                ⏰ {new Date().toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="quick-stats" style={{ display: 'flex', gap: '10px', color: 'white' }}>
                                            <span style={{
                                                background: 'rgba(255,255,255,0.2)',
                                                padding: '4px 8px',
                                                borderRadius: '12px',
                                                fontWeight: '600',
                                                fontSize: '0.8rem'
                                            }}>
                                                🛒 {items.length} Items
                                            </span>
                                            <span style={{
                                                background: 'rgba(255,255,255,0.2)',
                                                padding: '4px 8px',
                                                borderRadius: '12px',
                                                fontWeight: '600',
                                                fontSize: '0.8rem'
                                            }}>
                                                💰 {calculatePOSSummary().grandTotal.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Grid */}
                                <div className="ims-grid" style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 350px',
                                    gap: '0',
                                    flex: 1
                                }}>
                                    {/* Products Panel - Mart Style */}
                                    <div className="products-panel" style={{
                                        background: 'white',
                                        borderRight: '3px solid #bdc3c7',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <div className="panel-header" style={{
                                            padding: '20px',
                                            borderBottom: '2px solid #ecf0f1',
                                            background: 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
                                        }}>
                                            <h5 style={{
                                                color: 'white',
                                                margin: '0 0 15px 0',
                                                fontSize: '1.3rem',
                                                fontWeight: '700'
                                            }}>
                                                🏪 PRODUCTS
                                            </h5>
                                            <div className="search-container">
                                                <div className="search-box" style={{
                                                    position: 'relative',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}>
                                                    <span style={{
                                                        position: 'absolute',
                                                        left: '15px',
                                                        fontSize: '1.2rem',
                                                        color: '#7f8c8d'
                                                    }}>🔍</span>
                                                    <input
                                                        type="text"
                                                        placeholder="Scan barcode or search products..."
                                                        value={barcodeInput}
                                                        onChange={(e) => {
                                                            setBarcodeInput(e.target.value);
                                                            filterItems(e.target.value);
                                                        }}
                                                        onFocus={() => {
                                                            if (barcodeInput.length > 0) {
                                                                filterItems(barcodeInput);
                                                            }
                                                        }}
                                                        ref={barcodeInputRef}
                                                        className="search-input"
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px 12px 12px 45px',
                                                            border: '2px solid #3498db',
                                                            borderRadius: '25px',
                                                            fontSize: 'rem',
                                                            fontWeight: '500',
                                                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                                                        }}
                                                    />
                                                    <button
                                                        className="btn-search-advanced"
                                                        onClick={() => setShowProductModal(true)}
                                                        title="Advanced search"
                                                        style={{
                                                            position: 'absolute',
                                                            right: '10px',
                                                            background: '#3498db',
                                                            border: 'none',
                                                            color: 'white',
                                                            borderRadius: '50%',
                                                            width: '35px',
                                                            height: '35px',
                                                            fontSize: '1rem'
                                                        }}
                                                    >
                                                        ⚙️
                                                    </button>
                                                </div>

                                                {/* Search Results Dropdown */}
                                                {showItemDropdown && filteredItems.length > 0 && (
                                                    <div
                                                        className="search-results-dropdown"
                                                        onKeyDown={handleSearchResultsKeyDown}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '100%',
                                                            left: '20px',
                                                            right: '20px',
                                                            background: 'white',
                                                            border: '2px solid #3498db',
                                                            borderRadius: '10px',
                                                            boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
                                                            zIndex: 1000,
                                                            maxHeight: '300px',
                                                            overflowY: 'auto'
                                                        }}
                                                    >
                                                        <div className="dropdown-header" style={{
                                                            padding: '10px 15px',
                                                            background: '#34495e',
                                                            color: 'white',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            borderTopLeftRadius: '8px',
                                                            borderTopRightRadius: '8px'
                                                        }}>
                                                            <span>Search Results ({filteredItems.length})</span>
                                                            <button
                                                                className="btn-close-dropdown"
                                                                onClick={() => {
                                                                    setShowItemDropdown(false);
                                                                    setSelectedSearchIndex(-1);
                                                                }}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: 'white',
                                                                    fontSize: '1.2rem'
                                                                }}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                        <div className="dropdown-content">
                                                            {filteredItems.map((item, index) => (
                                                                <div
                                                                    key={item._id}
                                                                    className={`search-result-item ${index === selectedSearchIndex ? 'selected' : ''}`}
                                                                    onClick={() => {
                                                                        addItemToBill(item);
                                                                        setBarcodeInput('');
                                                                        setShowItemDropdown(false);
                                                                        setSelectedSearchIndex(-1);
                                                                    }}
                                                                    ref={index === selectedSearchIndex ? selectedItemRef : null}
                                                                    style={{
                                                                        padding: '12px 15px',
                                                                        borderBottom: '1px solid #ecf0f1',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center',
                                                                        background: index === selectedSearchIndex ? '#e3f2fd' : 'white',
                                                                        transition: 'background 0.2s ease'
                                                                    }}
                                                                >
                                                                    <div className="product-info">
                                                                        <div className="product-name" style={{
                                                                            fontWeight: '600',
                                                                            color: '#2c3e50',
                                                                            marginBottom: '3px'
                                                                        }}>
                                                                            {item.name}
                                                                        </div>
                                                                        <div className="product-details" style={{
                                                                            fontSize: '0.8rem',
                                                                            color: '#7f8c8d',
                                                                            display: 'flex',
                                                                            gap: '10px'
                                                                        }}>
                                                                            <span>Code: {item.uniqueNumber}</span>
                                                                            <span>Price: {item.stockEntries?.[0]?.price || 0}</span>
                                                                            <span>Stock: {item.stockEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div
                                                                        className="add-indicator"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedProductForStock(item);
                                                                            setShowStockAdjustmentModal(true);
                                                                            setShowItemDropdown(false);
                                                                            setSelectedSearchIndex(-1);
                                                                        }}
                                                                        title="Add stock for this product"
                                                                        style={{
                                                                            color: '#27ae60',
                                                                            fontSize: '1.2rem',
                                                                            padding: '5px'
                                                                        }}
                                                                    >
                                                                        ➕
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="products-content" style={{ flex: 1, overflow: 'hidden' }}>
                                            {items.length === 0 ? (
                                                <div className="empty-state" style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    height: '100%',
                                                    color: '#7f8c8d'
                                                }}>
                                                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🛒</div>
                                                    <p style={{ fontSize: '1.2rem', marginBottom: '10px', fontWeight: '600' }}>No items added</p>
                                                    <small>Scan barcode or search products to begin</small>
                                                    {filteredItems.length === 0 && barcodeInput.length > 2 && (
                                                        <div className="no-results" style={{ marginTop: '20px', textAlign: 'center' }}>
                                                            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔍</div>
                                                            <p>No products found for "{barcodeInput}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="items-table-container" style={{ height: '100%', overflow: 'auto' }}>
                                                    <table className="items-table" style={{
                                                        width: '100%',
                                                        borderCollapse: 'collapse'
                                                    }}>
                                                        <thead style={{
                                                            background: 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)',
                                                            position: 'sticky',
                                                            top: 0,
                                                            zIndex: 10
                                                        }}>
                                                            <tr>
                                                                <th width="5%" style={{
                                                                    padding: '12px 8px',
                                                                    color: 'black',
                                                                    fontWeight: '600',
                                                                    textAlign: 'center',
                                                                    borderRight: '1px solid #46627f'
                                                                }}>#</th>
                                                                <th width="35%" style={{
                                                                    padding: '12px 8px',
                                                                    color: 'black',
                                                                    fontWeight: '600',
                                                                    borderRight: '1px solid #46627f'
                                                                }}>Product</th>
                                                                <th width="15%" style={{
                                                                    padding: '12px 8px',
                                                                    color: 'black',
                                                                    fontWeight: '600',
                                                                    textAlign: 'center',
                                                                    borderRight: '1px solid #46627f'
                                                                }}>Qty</th>
                                                                <th width="10%" style={{
                                                                    padding: '12px 8px',
                                                                    color: 'black',
                                                                    fontWeight: '600',
                                                                    textAlign: 'center',
                                                                    borderRight: '1px solid #46627f'
                                                                }}>Unit</th>
                                                                <th width="15%" style={{
                                                                    padding: '12px 8px',
                                                                    color: 'black',
                                                                    fontWeight: '600',
                                                                    textAlign: 'center',
                                                                    borderRight: '1px solid #46627f'
                                                                }}>Price</th>
                                                                <th width="15%" style={{
                                                                    padding: '12px 8px',
                                                                    color: 'black',
                                                                    fontWeight: '600',
                                                                    textAlign: 'center',
                                                                    borderRight: '1px solid #46627f'
                                                                }}>Amount</th>
                                                                <th width="5%" style={{
                                                                    padding: '12px 8px',
                                                                    color: 'black',
                                                                    fontWeight: '600',
                                                                    textAlign: 'center'
                                                                }}></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {items.map((item, index) => (
                                                                <POSItemRow
                                                                    key={index}
                                                                    item={item}
                                                                    index={index}
                                                                    isNew={index === items.length - 1}
                                                                />
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Transaction Panel */}
                                    <div className="transaction-panel" style={{
                                        background: 'white',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <div className="transaction-content" style={{
                                            flex: 1,
                                            padding: '20px',
                                            overflowY: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '20px'
                                        }}>
                                            {/* Date Selection Section */}
                                            {/* <DateSection /> */}
                                            {/* Date Selection Section */}
                                            <div className="date-section">
                                                <label style={{
                                                    display: 'block',
                                                    marginBottom: '8px',
                                                    fontWeight: '600',
                                                    color: '#2c3e50'
                                                }}>📅 Date Selection</label>

                                                <div className="date-input-group" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label className="small" style={{ marginBottom: '4px', display: 'block' }}>
                                                            Transaction Date
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.transactionDateNepali}
                                                            onChange={(e) => {
                                                                setFormData(prev => ({ ...prev, transactionDateNepali: e.target.value }));
                                                                setDateErrors(prev => ({ ...prev, transactionDateNepali: '' }));
                                                            }}
                                                            onBlur={() => handleDateBlur('transactionDateNepali')}
                                                            onFocus={() => setShowDatePicker(true)}
                                                            placeholder="YYYY-MM-DD"
                                                            style={{
                                                                width: '100%',
                                                                padding: '8px',
                                                                border: dateErrors.transactionDateNepali ? '2px solid #e74c3c' : '2px solid #bdc3c7',
                                                                borderRadius: '6px',
                                                                fontSize: '0.9rem'
                                                            }}
                                                        />
                                                    </div>

                                                    <div style={{ flex: 1 }}>
                                                        <label className="small" style={{ marginBottom: '4px', display: 'block' }}>
                                                            Invoice Date
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.nepaliDate}
                                                            onChange={(e) => {
                                                                setFormData(prev => ({ ...prev, nepaliDate: e.target.value }));
                                                                setDateErrors(prev => ({ ...prev, nepaliDate: '' }));
                                                            }}
                                                            onBlur={() => handleDateBlur('nepaliDate')}
                                                            onFocus={() => setShowDatePicker(true)}
                                                            placeholder="YYYY-MM-DD"
                                                            style={{
                                                                width: '100%',
                                                                padding: '8px',
                                                                border: dateErrors.nepaliDate ? '2px solid #e74c3c' : '2px solid #bdc3c7',
                                                                borderRadius: '6px',
                                                                fontSize: '0.9rem'
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                {dateErrors.transactionDateNepali && (
                                                    <div className="text-danger small" style={{ color: '#e74c3c', fontSize: '0.8rem' }}>
                                                        {dateErrors.transactionDateNepali}
                                                    </div>
                                                )}
                                                {dateErrors.nepaliDate && (
                                                    <div className="text-danger small" style={{ color: '#e74c3c', fontSize: '0.8rem' }}>
                                                        {dateErrors.nepaliDate}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Customer Section */}
                                            <div className="customer-section">
                                                <label style={{
                                                    display: 'block',
                                                    marginBottom: '8px',
                                                    fontWeight: '600',
                                                    color: '#2c3e50'
                                                }}>👤 Customer</label>
                                                <div className="customer-input-group" style={{ display: 'flex', gap: '10px' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Search customer..."
                                                        value={formData.cashAccount}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            cashAccount: e.target.value
                                                        }))}
                                                        onFocus={() => setShowAccountModal(true)}
                                                        style={{
                                                            flex: 1,
                                                            padding: '10px 15px',
                                                            border: '2px solid #3498db',
                                                            borderRadius: '8px',
                                                            fontSize: '0.9rem',
                                                            fontWeight: '500'
                                                        }}
                                                    />
                                                    <button
                                                        className="btn-customer-add"
                                                        onClick={() => setShowAccountCreationModal(true)}
                                                        title="Add New Customer"
                                                        style={{
                                                            background: '#27ae60',
                                                            border: 'none',
                                                            color: 'white',
                                                            borderRadius: '8px',
                                                            padding: '10px 15px',
                                                            fontSize: '1.1rem',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        👥
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Sales Summary - Mart Style */}
                                            <div className="sales-summary-panel compact" style={{
                                                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                                                padding: '15px',
                                                borderRadius: '10px',
                                                border: '2px solid #dee2e6'
                                            }}>
                                                <div className="summary-header" style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: '15px'
                                                }}>
                                                    <h6 style={{
                                                        margin: 0,
                                                        color: '#2c3e50',
                                                        fontWeight: '700',
                                                        fontSize: '1.1rem'
                                                    }}>📊 SALE SUMMARY</h6>
                                                    <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span className="items-count" style={{
                                                            background: '#3498db',
                                                            color: 'white',
                                                            padding: '3px 8px',
                                                            borderRadius: '12px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '600'
                                                        }}>{items.length} items</span>
                                                        <button
                                                            className="btn-discount"
                                                            onClick={() => setIsDiscountModalOpen(true)}
                                                            title="Apply Discount"
                                                            style={{
                                                                background: '#f39c12',
                                                                border: 'none',
                                                                color: 'white',
                                                                borderRadius: '50%',
                                                                width: '30px',
                                                                height: '30px',
                                                                fontSize: '0.9rem',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            💰
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="summary-grid compact">
                                                    <div className="summary-row" style={summaryRowStyle}>
                                                        <span>Subtotal:</span>
                                                        <span className="amount" style={amountStyle}>{calculatePOSSummary().subTotal.toFixed(2)}</span>
                                                    </div>

                                                    {(formData.discountAmount > 0) && (
                                                        <div className="summary-row discount" style={summaryRowStyle}>
                                                            <span>
                                                                Discount{formData.discountPercentage > 0 && ` (${formData.discountPercentage}%)`}:
                                                            </span>
                                                            <span className="amount text-danger" style={{ ...amountStyle, color: '#e74c3c' }}>
                                                                -{calculatePOSSummary().discountAmount.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="summary-row" style={summaryRowStyle}>
                                                        <span>VAT ({formData.vatPercentage}%):</span>
                                                        <span className="amount" style={amountStyle}>{calculatePOSSummary().vatAmount.toFixed(2)}</span>
                                                    </div>

                                                    {calculatePOSSummary().roundOffAmount !== 0 && (
                                                        <div className="summary-row" style={summaryRowStyle}>
                                                            <span>Round Off:</span>
                                                            <span className="amount" style={amountStyle}>{calculatePOSSummary().roundOffAmount.toFixed(2)}</span>
                                                        </div>
                                                    )}

                                                    <div className="summary-row total" style={{
                                                        ...summaryRowStyle,
                                                        borderTop: '2px solid #bdc3c7',
                                                        paddingTop: '10px',
                                                        fontWeight: '700',
                                                        fontSize: '1.1rem'
                                                    }}>
                                                        <span>Grand Total:</span>
                                                        <span className="amount" style={{
                                                            ...amountStyle,
                                                            color: '#27ae60',
                                                            fontSize: '1.2rem'
                                                        }}>{calculatePOSSummary().grandTotal.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Payment Section - Mart Style */}
                                            <div className="payment-section compact">
                                                <div className="payment-header" style={{ marginBottom: '15px' }}>
                                                    <h6 style={{
                                                        margin: 0,
                                                        color: '#2c3e50',
                                                        fontWeight: '700',
                                                        fontSize: '1.1rem'
                                                    }}>💳 PAYMENT</h6>
                                                </div>

                                                <div className="payment-grid" style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr 1fr',
                                                    gap: '15px',
                                                    marginBottom: '15px'
                                                }}>
                                                    <div className="payment-group">
                                                        <label htmlFor="tenderAmount" style={{
                                                            display: 'block',
                                                            marginBottom: '5px',
                                                            fontWeight: '600',
                                                            color: '#2c3e50'
                                                        }}>Tender Amount</label>
                                                        <input
                                                            ref={tenderAmountRef}
                                                            type="number"
                                                            id="tenderAmount"
                                                            value={formData.tenderAmount}
                                                            onChange={(e) => setFormData(prev => ({
                                                                ...prev,
                                                                tenderAmount: parseFloat(e.target.value) || 0,
                                                                changeDue: Math.max(0, parseFloat(e.target.value) - calculatePOSSummary().grandTotal)
                                                            }))}
                                                            placeholder="0.00"
                                                            className="tender-input"
                                                            style={{
                                                                width: '100%',
                                                                padding: '10px',
                                                                border: '2px solid #27ae60',
                                                                borderRadius: '8px',
                                                                fontSize: '1rem',
                                                                fontWeight: '600',
                                                                textAlign: 'center'
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="payment-group">
                                                        <label style={{
                                                            display: 'block',
                                                            marginBottom: '5px',
                                                            fontWeight: '600',
                                                            color: '#2c3e50'
                                                        }}>Change Due</label>
                                                        <div className={`change-amount ${calculatePOSSummary().changeDue > 0 ? 'has-change' : ''}`}
                                                            style={{
                                                                width: '100%',
                                                                padding: '10px',
                                                                background: calculatePOSSummary().changeDue > 0 ? '#d4edda' : '#f8f9fa',
                                                                border: `2px solid ${calculatePOSSummary().changeDue > 0 ? '#27ae60' : '#6c757d'}`,
                                                                borderRadius: '8px',
                                                                fontSize: '1rem',
                                                                fontWeight: '700',
                                                                textAlign: 'center',
                                                                color: calculatePOSSummary().changeDue > 0 ? '#155724' : '#6c757d'
                                                            }}
                                                        >
                                                            {calculatePOSSummary().changeDue.toFixed(2)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="payment-method-group" style={{ marginBottom: '15px' }}>
                                                    <label htmlFor="paymentMode" style={{
                                                        display: 'block',
                                                        marginBottom: '5px',
                                                        fontWeight: '600',
                                                        color: '#2c3e50'
                                                    }}>Payment Method</label>
                                                    <select
                                                        id="paymentMode"
                                                        value={formData.paymentMode}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, paymentMode: e.target.value }))}
                                                        className="payment-select"
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px',
                                                            border: '2px solid #3498db',
                                                            borderRadius: '8px',
                                                            fontSize: '0.9rem',
                                                            fontWeight: '500'
                                                        }}
                                                    >
                                                        <option value="cash">💵 Cash</option>
                                                    </select>
                                                </div>

                                                {/* Quick Payment Buttons */}
                                                <div className="quick-payment-buttons" style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr 1fr',
                                                    gap: '10px',
                                                    marginBottom: '15px'
                                                }}>
                                                    <button
                                                        className="btn-quick-payment"
                                                        onClick={() => handleQuickPayment('exact')}
                                                        title="Set tender amount to grand total"
                                                        style={quickPaymentButtonStyle}
                                                    >
                                                        Exact
                                                    </button>
                                                    <button
                                                        className="btn-quick-payment"
                                                        onClick={() => handleQuickPayment('round')}
                                                        title="Round up to nearest 10"
                                                        style={quickPaymentButtonStyle}
                                                    >
                                                        Round Up
                                                    </button>
                                                    <button
                                                        className="btn-quick-payment"
                                                        onClick={() => handleQuickPayment(1000)}
                                                        title="Set tender amount to 1000"
                                                        style={quickPaymentButtonStyle}
                                                    >
                                                        1000
                                                    </button>
                                                    <button
                                                        className="btn-quick-payment btn-discount"
                                                        onClick={() => setIsDiscountModalOpen(true)}
                                                        title="Apply Discount"
                                                        style={{ ...quickPaymentButtonStyle, background: '#f39c12' }}
                                                    >
                                                        💰 Discount
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Action Buttons - Mart Style */}
                                            <div className="action-buttons compact" style={{ marginTop: 'auto' }}>
                                                <div className="primary-actions" style={{ marginBottom: '10px' }}>
                                                    <button
                                                        className="btn-complete-sale"
                                                        onClick={(e) => handleSubmit(e, false)}
                                                        disabled={isSaving || items.length === 0}
                                                        style={{
                                                            width: '100%',
                                                            padding: '15px',
                                                            background: isSaving ? '#95a5a6' : 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '10px',
                                                            fontSize: '1.1rem',
                                                            fontWeight: '700',
                                                            cursor: items.length === 0 ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '10px',
                                                            boxShadow: '0 3px 6px rgba(0,0,0,0.2)'
                                                        }}
                                                    >
                                                        {isSaving ? (
                                                            <>
                                                                <span>⏳</span>
                                                                <span>Processing...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>✅</span>
                                                                <span>Complete Sale</span>
                                                                <small style={{ opacity: '0.8', fontSize: '0.8rem' }}>(Enter)</small>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>

                                                <div className="secondary-actions compact" style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr 1fr',
                                                    gap: '10px'
                                                }}>
                                                    <button
                                                        className="btn-print"
                                                        onClick={(e) => handleSubmit(e, true)}
                                                        disabled={isSaving || items.length === 0}
                                                        title="Print Receipt (F12)"
                                                        style={secondaryButtonStyle}
                                                    >
                                                        🖨️ Print
                                                        <small style={shortcutStyle}>F12</small>
                                                    </button>

                                                    <button
                                                        className="btn-clear"
                                                        onClick={resetForm}
                                                        title="New Sale (F5)"
                                                        style={secondaryButtonStyle}
                                                    >
                                                        🆕 Clear
                                                        <small style={shortcutStyle}>F5</small>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Transaction Status Bar */}
                                            <div className="transaction-status" style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                padding: '10px',
                                                background: '#34495e',
                                                borderRadius: '8px',
                                                color: 'white',
                                                fontSize: '0.8rem',
                                                marginTop: '10px'
                                            }}>
                                                <div className="status-item">
                                                    <span className="status-label">Invoice:</span>
                                                    <span className="status-value" style={{ fontWeight: '600' }}>{formData.billNumber}</span>
                                                </div>
                                                <div className="status-item">
                                                    <span className="status-label">Time:</span>
                                                    <span className="status-value" style={{ fontWeight: '600' }}>{new Date().toLocaleTimeString()}</span>
                                                </div>
                                                <div className="status-item">
                                                    <span className="status-label">Status:</span>
                                                    <span className={`status-value ${items.length > 0 ? 'active' : 'inactive'}`}
                                                        style={{
                                                            fontWeight: '600',
                                                            color: items.length > 0 ? '#27ae60' : '#f39c12'
                                                        }}
                                                    >
                                                        {items.length > 0 ? 'Active' : 'Ready'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Account Modal */}
            {showAccountModal && (
                <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content" style={{ height: '500px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title" id="accountModalLabel">Select or Enter Cash Account</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => {
                                        setShowAccountModal(false);
                                        focusTenderAmount();
                                    }}
                                ></button>
                            </div>
                            <div className="p-3 bg-white sticky-top">
                                <input
                                    type="text"
                                    id="searchAccount"
                                    autoComplete='off'
                                    className="form-control form-control-lg"
                                    placeholder="Type to search or enter new account name"
                                    autoFocus
                                    value={formData.cashAccount}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            cashAccount: value,
                                            cashAccountAddress: '',
                                            cashAccountPhone: ''
                                        }));

                                        if (value === '') {
                                            setFilteredAccounts([]);
                                        } else {
                                            const filtered = accounts.filter(account =>
                                                account.name.toLowerCase().includes(value.toLowerCase())
                                            );
                                            setFilteredAccounts(filtered);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item');
                                            if (firstAccountItem) {
                                                firstAccountItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            setShowAccountModal(false);
                                            focusTenderAmount();
                                            setTimeout(() => {
                                                addressRef.current?.focus();
                                            }, 100);
                                        }
                                    }}
                                    ref={accountSearchRef}
                                />
                            </div>
                            <div className="modal-body p-0">
                                <div className="overflow-auto" style={{ height: 'calc(400px - 120px)' }}>
                                    <ul id="accountList" className="list-group">
                                        {(filteredAccounts.length > 0 ? filteredAccounts : accounts).map((account, index) => (
                                            <li
                                                key={account._id}
                                                data-account-id={account._id}
                                                className={`list-group-item account-item py-2`}
                                                onClick={() => {
                                                    setFormData({
                                                        ...formData,
                                                        cashAccount: account.name,
                                                        cashAccountAddress: account.address,
                                                        cashAccountPhone: account.phone
                                                    });
                                                    setShowAccountModal(false);
                                                    focusTenderAmount();
                                                    setTimeout(() => {
                                                        addressRef.current?.focus();
                                                    }, 100);
                                                }}
                                                style={{ cursor: 'pointer' }}
                                                tabIndex={0}
                                                onKeyDown={(e) => {
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
                                                            accountSearchRef.current?.focus();
                                                        }
                                                    } else if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        setFormData({
                                                            ...formData,
                                                            cashAccount: account.name,
                                                            cashAccountAddress: account.address,
                                                            cashAccountPhone: account.phone
                                                        });
                                                        setShowAccountModal(false);
                                                        focusTenderAmount();
                                                        setTimeout(() => {
                                                            addressRef.current?.focus();
                                                        }, 100);
                                                    }
                                                }}
                                                onFocus={(e) => {
                                                    document.querySelectorAll('.account-item').forEach(item => {
                                                        item.classList.remove('active');
                                                    });
                                                    e.target.classList.add('active');
                                                }}
                                            >
                                                <div className="d-flex justify-content-between small">
                                                    <strong>{account.name}</strong>
                                                    <span>📍 {account.address || 'N/A'} | 📞 {account.phone || 'N/A'}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setShowAccountModal(false);
                                        focusTenderAmount();
                                        setTimeout(() => {
                                            addressRef.current?.focus();
                                        }, 100);
                                    }}
                                >
                                    Use Entered Name
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setShowAccountModal(false);
                                        focusTenderAmount();
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <AccountCreationModal
                show={showAccountCreationModal}
                onClose={() => setShowAccountCreationModal(false)}
                onAccountCreated={handleAccountCreated}
                companyId={company?._id}
                fiscalYear={company?.fiscalYear?._id}
            />

            {isDiscountModalOpen && (
                <DiscountModal
                    discountInput={discountInput}
                    discountType={discountType}
                    setDiscountInput={setDiscountInput}
                    setDiscountType={setDiscountType}
                    setFormData={setFormData}
                    setIsDiscountModalOpen={setIsDiscountModalOpen}
                    calculatePOSSummary={calculatePOSSummary}
                    focusTenderAmount={focusTenderAmount}
                    items={items}
                    formData={formData}
                />
            )}

            {showProductModal && (
                <ProductModal
                    onClose={() => setShowProductModal(false)}
                    onSelectProduct={addItemToBill}
                    products={allItems}
                />
            )}

            {/* Stock Adjustment Modal */}
            <StockAdjustmentModal
                show={showStockAdjustmentModal}
                onClose={() => {
                    setShowStockAdjustmentModal(false);
                    setSelectedProductForStock(null);
                    barcodeInputRef.current?.focus();
                }}
                product={selectedProductForStock}
                onStockAdded={async (adjustmentData) => {
                    await refreshStockData();
                    setNotification({
                        show: true,
                        message: `Stock added successfully! Bill: ${adjustmentData.billNumber}`,
                        type: 'success'
                    });
                    const updatedItems = await refreshStockData();
                    setItems(prevItems => {
                        return prevItems.map(cartItem => {
                            const freshItem = updatedItems.find(item => item._id === cartItem.item);
                            if (freshItem) {
                                return { ...cartItem };
                            }
                            return cartItem;
                        });
                    });
                }}
            />

            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />
        </div>
    );
};

export default PosCashSalesModal;