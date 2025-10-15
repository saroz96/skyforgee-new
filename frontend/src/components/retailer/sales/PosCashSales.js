// import React, { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date-converter';
// import axios from 'axios';
// import Header from '../Header';
// import NotificationToast from '../../NotificationToast';
// import '../../../stylesheet/retailer/sales/AddCashSales.css';
// import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
// import '../../../stylesheet/noDateIcon.css';
// import ProductModal from '../dashboard/modals/ProductModal';
// import AccountCreationModal from './AccountCreationModal';
// import '../../../stylesheet/retailer/sales/POSStylesSales.css';
// import StockAdjustmentModal from './StockAdjustmentModal';
// import DiscountModal from './DiscountModal';

// const PosCashSales = () => {
//     const navigate = useNavigate();

//     // POS State Management
//     const [quantityErrors, setQuantityErrors] = useState({});
//     const [stockValidation, setStockValidation] = useState({
//         itemStockMap: new Map(),
//         usedStockMap: new Map(),
//     });
//     // Add this to your existing state declarations
//     const [showStockAdjustmentModal, setShowStockAdjustmentModal] = useState(false);
//     const [selectedProductForStock, setSelectedProductForStock] = useState(null);
//     const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
//     const [showAccountCreationModal, setShowAccountCreationModal] = useState(false);
//     const [showProductModal, setShowProductModal] = useState(false);
//     const [itemSearchTerm, setItemSearchTerm] = useState('');
//     const transactionDateRef = useRef(null);
//     const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
//     const addressRef = useRef(null);
//     const [isSaving, setIsSaving] = useState(false);
//     const [isLoading, setIsLoading] = useState(true);
//     const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//     const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
//     // Add these with your existing state declarations
//     const [discountInput, setDiscountInput] = useState('');
//     const [discountType, setDiscountType] = useState('percentage'); // 'percentage' or 'amount'
//     const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

//     const [notification, setNotification] = useState({
//         show: false,
//         message: '',
//         type: 'success'
//     });
//     const [dateErrors, setDateErrors] = useState({
//         transactionDateNepali: '',
//         nepaliDate: ''
//     });

//     // Enhanced Form Data for POS (updated to match second component)
//     const [formData, setFormData] = useState({
//         cashAccount: '',
//         cashAccountId: '',
//         cashAccountAddress: '',
//         cashAccountPan: '',
//         cashAccountEmail: '',
//         cashAccountPhone: '',
//         transactionDateNepali: currentNepaliDate,
//         transactionDateRoman: new Date().toISOString().split('T')[0],
//         nepaliDate: currentNepaliDate,
//         billDate: new Date().toISOString().split('T')[0],
//         billNumber: '',
//         paymentMode: 'cash',
//         isVatExempt: 'all',
//         discountPercentage: 0,
//         discountAmount: 0,
//         roundOffAmount: 0,
//         vatPercentage: 13,
//         items: [],
//         // POS Specific Fields
//         tenderAmount: 0,
//         changeDue: 0,
//         transactionType: 'sale',
//         referenceNumber: '',
//         holdReason: ''
//     });

//     const [items, setItems] = useState([]);
//     const [allItems, setAllItems] = useState([]);
//     const [accounts, setAccounts] = useState([]);
//     const [filteredAccounts, setFilteredAccounts] = useState([]);
//     const [showAccountModal, setShowAccountModal] = useState(false);
//     const [showItemDropdown, setShowItemDropdown] = useState(false);
//     const [filteredItems, setFilteredItems] = useState([]);
//     const itemDropdownRef = useRef(null);
//     const [company, setCompany] = useState({
//         dateFormat: 'nepali',
//         vatEnabled: true,
//         fiscalYear: {},
//         posSettings: {
//             enableBarcode: true,
//             enableQuickKeys: true,
//             autoPrint: false,
//             requireCustomer: false
//         }
//     });
//     const [nextBillNumber, setNextBillNumber] = useState('');
//     const [barcodeInput, setBarcodeInput] = useState('');
//     const [quickProducts, setQuickProducts] = useState([]);
//     const [activeTab, setActiveTab] = useState('products'); // 'products', 'customers', 'history'

//     const accountSearchRef = useRef(null);
//     const itemSearchRef = useRef(null);
//     const barcodeInputRef = useRef(null);
//     const selectedItemRef = useRef(null);
//     const tenderAmountRef = useRef(null);

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     // Load initial data
//     useEffect(() => {
//         const fetchInitialData = async () => {
//             try {
//                 const response = await api.get('/api/retailer/cash-sales');
//                 const { data } = response;

//                 const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
//                 const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));

//                 setCompany(data.data.company);
//                 setAllItems(sortedItems);
//                 setAccounts(sortedAccounts);
//                 setNextBillNumber(data.data.nextSalesBillNumber);

//                 setFormData(prev => ({
//                     ...prev,
//                     billNumber: data.data.nextSalesBillNumber
//                 }));
//                 setIsInitialDataLoaded(true);
//             } catch (error) {
//                 console.error('Error fetching initial data:', error);
//             }
//         };
//         fetchInitialData();
//     }, []);

//     // Add this function after your other functions in the component
//     const refreshStockData = async () => {
//         try {
//             const response = await api.get('/api/retailer/cash-sales');
//             const { data } = response;

//             const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));
//             setAllItems(sortedItems);

//             // Update stock validation map
//             const newItemStockMap = new Map();
//             sortedItems.forEach(item => {
//                 const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
//                 newItemStockMap.set(item._id, totalStock);
//             });

//             setStockValidation(prev => ({
//                 ...prev,
//                 itemStockMap: newItemStockMap
//             }));

//             return sortedItems;
//         } catch (error) {
//             console.error('Error refreshing stock data:', error);
//             setNotification({
//                 show: true,
//                 message: 'Failed to refresh stock data',
//                 type: 'error'
//             });
//             return allItems; // Return current items as fallback
//         }
//     };

//     // Stock validation
//     useEffect(() => {
//         if (allItems.length > 0) {
//             const newItemStockMap = new Map();
//             allItems.forEach(item => {
//                 const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
//                 newItemStockMap.set(item._id, totalStock);
//             });
//             setStockValidation(prev => ({ ...prev, itemStockMap: newItemStockMap }));
//         }
//     }, [allItems]);

//     // Enhanced search with debouncing
//     useEffect(() => {
//         const timer = setTimeout(() => {
//             if (barcodeInput.trim()) {
//                 filterItems(barcodeInput);
//             }
//         }, 200);
//         return () => clearTimeout(timer);
//     }, [barcodeInput]);

//     // Auto-scroll for selected search item
//     useEffect(() => {
//         if (selectedSearchIndex >= 0 && selectedItemRef.current) {
//             selectedItemRef.current.scrollIntoView({
//                 behavior: 'smooth',
//                 block: 'nearest'
//             });
//         }
//     }, [selectedSearchIndex]);

//     // Update the keyboard navigation useEffect
//     useEffect(() => {
//         const handleRowNavigation = (e) => {
//             if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
//                 const focusedElement = document.activeElement;
//                 const isInTable = focusedElement.closest('.items-table');

//                 if (isInTable && items.length > 0) {
//                     e.preventDefault();
//                     let newIndex = selectedRowIndex;

//                     if (e.key === 'ArrowDown') {
//                         newIndex = selectedRowIndex < items.length - 1 ? selectedRowIndex + 1 : 0;
//                     } else if (e.key === 'ArrowUp') {
//                         newIndex = selectedRowIndex > 0 ? selectedRowIndex - 1 : items.length - 1;
//                     }

//                     setSelectedRowIndex(newIndex);

//                     // Enhanced scrolling with visibility check
//                     setTimeout(() => {
//                         const selectedRow = document.querySelector(`tr[data-row-index="${newIndex}"]`);
//                         const itemsContainer = document.querySelector('.items-table-container');

//                         if (selectedRow && itemsContainer) {
//                             const containerRect = itemsContainer.getBoundingClientRect();
//                             const rowRect = selectedRow.getBoundingClientRect();

//                             const isRowVisible = (
//                                 rowRect.top >= containerRect.top &&
//                                 rowRect.bottom <= containerRect.bottom
//                             );

//                             if (!isRowVisible) {
//                                 selectedRow.scrollIntoView({
//                                     behavior: 'smooth',
//                                     block: 'nearest'
//                                 });
//                             }
//                         }
//                     }, 0);
//                 }
//             }

//             // Add Delete key functionality for removing items
//             if (e.key === 'Delete' && selectedRowIndex >= 0) {
//                 e.preventDefault();
//                 removeItem(selectedRowIndex);
//                 const newIndex = selectedRowIndex >= items.length - 1 ? Math.max(0, items.length - 2) : selectedRowIndex;
//                 setSelectedRowIndex(newIndex);
//             }
//         };

//         window.addEventListener('keydown', handleRowNavigation);
//         return () => window.removeEventListener('keydown', handleRowNavigation);
//     }, [selectedRowIndex, items.length]);

//     // Stock Calculation Functions
//     const calculateUsedStock = (items) => {
//         const newUsedStockMap = new Map();

//         items.forEach(item => {
//             const itemId = item.item;
//             const currentUsed = newUsedStockMap.get(itemId) || 0;
//             const itemQuantity = parseFloat(item.quantity) || 0;

//             newUsedStockMap.set(itemId, currentUsed + itemQuantity);
//         });

//         return newUsedStockMap;
//     };

//     const getAvailableStockForDisplay = (item) => {
//         if (!item) return 0;
//         return stockValidation.itemStockMap.get(item.item) || 0;
//     };

//     const getRemainingStock = (item, itemsToCheck = items) => {
//         if (!item) return 0;
//         const itemId = item.item;
//         const availableStock = stockValidation.itemStockMap.get(itemId) || 0;
//         const usedStockMap = calculateUsedStock(itemsToCheck);
//         const totalUsed = usedStockMap.get(itemId) || 0;
//         return availableStock - totalUsed;
//     };

//     const validateQuantity = (index, quantity, itemsToValidate = items) => {
//         const item = itemsToValidate[index];
//         if (!item) return true;

//         const itemId = item.item;
//         const availableStock = stockValidation.itemStockMap.get(itemId) || 0;

//         // If stock data is not available yet, skip validation
//         if (availableStock === 0 && !stockValidation.itemStockMap.has(itemId)) {
//             return true;
//         }

//         // Calculate total used quantity for this item across all items
//         const usedStockMap = calculateUsedStock(itemsToValidate);
//         const totalUsed = usedStockMap.get(itemId) || 0;

//         // The quantity is valid if it doesn't exceed available stock
//         return totalUsed <= availableStock;
//     };

//     const validateAllQuantities = (itemsToValidate = items) => {
//         const newErrors = {};

//         itemsToValidate.forEach((item, index) => {
//             const itemId = item.item;

//             // Only validate if stock data is available
//             if (stockValidation.itemStockMap.has(itemId)) {
//                 const isValid = validateQuantity(index, item.quantity, itemsToValidate);
//                 if (!isValid) {
//                     const remainingStock = getRemainingStock(item, itemsToValidate);
//                     const availableStock = getAvailableStockForDisplay(item);
//                     newErrors[index] = `Stock: ${availableStock} | Rem.: ${remainingStock}`;
//                 }
//             }
//         });

//         setQuantityErrors(newErrors);
//         return Object.keys(newErrors).length === 0;
//     };

//     const filterItems = (searchTerm) => {
//         if (!searchTerm.trim()) {
//             setFilteredItems([]);
//             setShowItemDropdown(false);
//             setSelectedSearchIndex(-1);
//             return;
//         }

//         const searchLower = searchTerm.toLowerCase();

//         const filtered = allItems.filter(item => {
//             const matchesName = item.name.toLowerCase().includes(searchLower);
//             const matchesCode = item.uniqueNumber && item.uniqueNumber.toString().includes(searchTerm);
//             const matchesBarcode = item.barcode && item.barcode.includes(searchTerm);
//             const matchesHSCode = item.hscode && item.hscode.toString().includes(searchTerm);

//             return matchesName || matchesCode || matchesBarcode || matchesHSCode;
//         })
//             .slice(0, 8) // Limit results for better performance
//             .sort((a, b) => {
//                 // Sort by relevance (exact matches first)
//                 const aNameMatch = a.name.toLowerCase().startsWith(searchLower);
//                 const bNameMatch = b.name.toLowerCase().startsWith(searchLower);

//                 if (aNameMatch && !bNameMatch) return -1;
//                 if (!aNameMatch && bNameMatch) return 1;

//                 // Then sort by stock availability
//                 const aStock = a.stockEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0;
//                 const bStock = b.stockEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0;

//                 return bStock - aStock;
//             });

//         setFilteredItems(filtered);
//         setShowItemDropdown(filtered.length > 0);
//         setSelectedSearchIndex(filtered.length > 0 ? 0 : -1);
//     };

//     // Update your keyboard shortcuts useEffect
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             const focusedElement = document.activeElement;
//             const isInputFocused = focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'TEXTAREA';

//             // If search dropdown is open, handle navigation keys
//             if (showItemDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
//                 handleSearchResultsKeyDown(e);
//                 return;
//             }

//             if (!isInputFocused) {
//                 switch (e.key) {
//                     case 'F1':
//                         e.preventDefault();
//                         barcodeInputRef.current?.focus();
//                         break;
//                     case 'F2': // Customer selection
//                         e.preventDefault();
//                         setShowAccountModal(true);
//                         break;
//                     case 'F3': // Discount shortcut
//                         e.preventDefault();
//                         setIsDiscountModalOpen(true);
//                         break;
//                     case 'F4':
//                         e.preventDefault();
//                         handleQuickPayment('exact');
//                         break;
//                     case 'F5':
//                         e.preventDefault();
//                         resetForm();
//                         break;
//                     case 'F9':
//                         e.preventDefault();
//                         setShowProductModal(prev => !prev);
//                         break;
//                     case 'F12':
//                         e.preventDefault();
//                         handleSubmit(null, true);
//                         break;
//                     case 'Escape':
//                         e.preventDefault();
//                         handleEscapeKey();
//                         break;
//                 }
//             }

//             // Additional keyboard shortcuts from second component
//             if (e.key === 'Enter' && e.target.id === 'tenderAmount') {
//                 e.preventDefault();
//                 handleSubmit(e, false);
//             }
//         };

//         window.addEventListener('keydown', handleKeyDown);
//         return () => window.removeEventListener('keydown', handleKeyDown);
//     }, [items, formData, showItemDropdown, filteredItems, selectedSearchIndex]);


//     // Add this useEffect after your existing useEffect hooks
//     useEffect(() => {
//         // Auto-scroll to the last added item when items change
//         if (items.length > 0) {
//             const timer = setTimeout(() => {
//                 const itemsContainer = document.querySelector('.items-table-container');
//                 const lastRow = document.querySelector(`tr[data-row-index="${items.length - 1}"]`);

//                 if (itemsContainer && lastRow) {
//                     lastRow.scrollIntoView({
//                         behavior: 'smooth',
//                         block: 'nearest',
//                         inline: 'nearest'
//                     });

//                     // Also select the newly added row
//                     setSelectedRowIndex(items.length - 1);
//                 }
//             }, 100);

//             return () => clearTimeout(timer);
//         }
//     }, [items.length]); // Only trigger when items count changes

//     const handleSearchResultsKeyDown = (e) => {
//         if (!showItemDropdown || filteredItems.length === 0) return;

//         switch (e.key) {
//             case 'ArrowDown':
//                 e.preventDefault();
//                 setSelectedSearchIndex(prev =>
//                     prev < filteredItems.length - 1 ? prev + 1 : 0
//                 );
//                 break;

//             case 'ArrowUp':
//                 e.preventDefault();
//                 setSelectedSearchIndex(prev =>
//                     prev > 0 ? prev - 1 : filteredItems.length - 1
//                 );
//                 break;

//             case 'Enter':
//                 e.preventDefault();
//                 if (selectedSearchIndex >= 0 && selectedSearchIndex < filteredItems.length) {
//                     addItemToBill(filteredItems[selectedSearchIndex]);
//                     setBarcodeInput('');
//                     setShowItemDropdown(false);
//                     setSelectedSearchIndex(-1);
//                 }
//                 break;

//             case 'Escape':
//                 e.preventDefault();
//                 setShowItemDropdown(false);
//                 setSelectedSearchIndex(-1);
//                 barcodeInputRef.current?.focus();
//                 break;

//             default:
//                 break;
//         }
//     };

//     const handleEscapeKey = () => {
//         setShowItemDropdown(false);
//         setBarcodeInput('');
//         setSelectedSearchIndex(-1);
//         if (barcodeInputRef.current) barcodeInputRef.current.focus();
//     };

//     const handleBarcodeScan = async (barcode) => {
//         const item = allItems.find(item =>
//             item.barcode === barcode || item.uniqueNumber === barcode
//         );
//         if (item) {
//             addItemToBill(item);
//             setNotification({ show: true, message: `"${item.name}" added`, type: 'success' });
//         }
//     };

//     // Add this function to handle smart scrolling
//     const handleAutoScroll = (newItems, previousItems) => {
//         if (newItems.length > previousItems.length) {
//             // Item was added
//             const newIndex = newItems.length - 1;

//             setTimeout(() => {
//                 const itemsContainer = document.querySelector('.items-table-container');
//                 const newRow = document.querySelector(`tr[data-row-index="${newIndex}"]`);

//                 if (itemsContainer && newRow) {
//                     // Calculate if the new row is already visible
//                     const containerRect = itemsContainer.getBoundingClientRect();
//                     const rowRect = newRow.getBoundingClientRect();

//                     const isRowVisible = (
//                         rowRect.top >= containerRect.top &&
//                         rowRect.bottom <= containerRect.bottom
//                     );

//                     if (!isRowVisible) {
//                         newRow.scrollIntoView({
//                             behavior: 'smooth',
//                             block: 'nearest'
//                         });
//                     }

//                     setSelectedRowIndex(newIndex);
//                 }
//             }, 150);
//         }
//     };

//     // Update your addItemToBill function to use the smart scroll
//     const addItemToBill = (item, batchIndex = 0) => {
//         const previousItems = [...items]; // Store current items before update

//         const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
//         if (totalStock === 0) {
//             setNotification({ show: true, message: `"${item.name}" out of stock`, type: 'error' });
//             return;
//         }

//         const sortedStockEntries = item.stockEntries.sort((a, b) =>
//             new Date(a.expiryDate || '9999-12-31') - new Date(b.expiryDate || '9999-12-31')
//         );
//         const selectedBatch = sortedStockEntries[batchIndex] || {};

//         const existingItemIndex = items.findIndex(cartItem =>
//             cartItem.item === item._id && cartItem.batchNumber === selectedBatch.batchNumber
//         );

//         if (existingItemIndex > -1) {
//             const updatedItems = [...items];
//             const newQuantity = parseFloat(updatedItems[existingItemIndex].quantity) + 1;
//             updateItemField(existingItemIndex, 'quantity', newQuantity);

//             // Scroll to existing item when quantity is increased
//             setTimeout(() => {
//                 const existingRow = document.querySelector(`tr[data-row-index="${existingItemIndex}"]`);
//                 if (existingRow) {
//                     existingRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
//                     setSelectedRowIndex(existingItemIndex);
//                 }
//             }, 100);
//         } else {
//             const newItem = {
//                 item: item._id,
//                 uniqueNumber: item.uniqueNumber || 'N/A',
//                 hscode: item.hscode,
//                 name: item.name,
//                 category: item.category?.name || 'No Category',
//                 batchNumber: selectedBatch.batchNumber || '',
//                 expiryDate: selectedBatch.expiryDate ? new Date(selectedBatch.expiryDate).toISOString().split('T')[0] : '',
//                 quantity: 1,
//                 unit: item.unit,
//                 price: Math.round(selectedBatch.price * 100) / 100 || 0,
//                 puPrice: selectedBatch.puPrice || 0,
//                 netPuPrice: selectedBatch.netPuPrice || 0,
//                 amount: Math.round(selectedBatch.price * 100) / 100 || 0,
//                 vatStatus: item.vatStatus,
//                 uniqueUuId: selectedBatch.uniqueUuId,
//                 barcode: item.barcode
//             };

//             const updatedItems = [...items, newItem];
//             setItems(updatedItems);

//             // Use smart scrolling for new items
//             handleAutoScroll(updatedItems, previousItems);

//             // Validate the new item's quantity
//             setTimeout(() => {
//                 validateAllQuantities(updatedItems);
//             }, 0);
//         }

//         // Show available stock info
//         const availableStock = stockValidation.itemStockMap.get(item._id) || 0;
//         setNotification({
//             show: true,
//             message: `"${item.name}" added. Available stock: ${availableStock}`,
//             type: 'success'
//         });

//         setShowItemDropdown(false);
//         setBarcodeInput('');
//         setSelectedSearchIndex(-1);
//         barcodeInputRef.current?.focus();
//     };

//     const updateItemField = (index, field, value) => {
//         const updatedItems = items.map((item, i) => {
//             if (i === index) {
//                 const updatedItem = { ...item, [field]: value };
//                 if (field === 'quantity' || field === 'price') {
//                     updatedItem.amount = (updatedItem.quantity * updatedItem.price).toFixed(2);
//                 }
//                 return updatedItem;
//             }
//             return item;
//         });

//         setItems(updatedItems);

//         // Validate quantity when it changes
//         if (field === 'quantity') {
//             const item = updatedItems[index];
//             const itemId = item.item;

//             // Only validate if stock data is available
//             if (stockValidation.itemStockMap.has(itemId)) {
//                 const isValid = validateQuantity(index, value, updatedItems);
//                 const remainingStock = getRemainingStock(item, updatedItems);
//                 const availableStock = getAvailableStockForDisplay(item);

//                 if (!isValid) {
//                     setQuantityErrors(prev => ({
//                         ...prev,
//                         [index]: `Stock: ${availableStock} | Rem.: ${remainingStock}`
//                     }));
//                 } else {
//                     setQuantityErrors(prev => {
//                         const newErrors = { ...prev };
//                         delete newErrors[index];
//                         return newErrors;
//                     });
//                 }
//             }
//         }

//         // Calculate discounts when items change
//         if (field === 'quantity' || field === 'price') {
//             calculateDiscounts(updatedItems);
//         }
//     };

//     const removeItem = (index) => {
//         const updatedItems = items.filter((_, i) => i !== index);
//         setItems(updatedItems);

//         // Revalidate all quantities after removal
//         setTimeout(() => {
//             validateAllQuantities(updatedItems);
//         }, 0);
//     };

//     const quickQuantityUpdate = (index, action) => {
//         const currentQuantity = parseFloat(items[index].quantity) || 0;
//         let newQuantity = currentQuantity;

//         switch (action) {
//             case 'increment': newQuantity = currentQuantity + 1; break;
//             case 'decrement': newQuantity = Math.max(1, currentQuantity - 1); break;
//             case 'double': newQuantity = currentQuantity * 2; break;
//             case 'half': newQuantity = Math.max(1, Math.round(currentQuantity / 2)); break;
//             default: return;
//         }

//         updateItemField(index, 'quantity', newQuantity);
//     };

//     // CORRECTED POS Calculations - Discount applied to all items, VAT calculated correctly
//     const calculatePOSSummary = () => {
//         const subTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
//         const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
//         const totalItems = items.length;

//         // Calculate taxable and non-taxable amounts
//         const taxableAmount = items.filter(item => item.vatStatus === 'vatable')
//             .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

//         const nonTaxableAmount = items.filter(item => item.vatStatus !== 'vatable')
//             .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

//         const discountAmount = parseFloat(formData.discountAmount) || 0;
//         const discountPercentage = parseFloat(formData.discountPercentage) || 0;

//         // Apply discount proportionally to both taxable and non-taxable amounts
//         let discountedTaxableAmount = taxableAmount;
//         let discountedNonTaxableAmount = nonTaxableAmount;
//         let discountAppliedToTaxable = 0;
//         let discountAppliedToNonTaxable = 0;

//         if (discountAmount > 0 && subTotal > 0) {
//             // Calculate discount distribution based on proportion of each type
//             const taxableRatio = taxableAmount / subTotal;
//             const nonTaxableRatio = nonTaxableAmount / subTotal;

//             discountAppliedToTaxable = discountAmount * taxableRatio;
//             discountAppliedToNonTaxable = discountAmount * nonTaxableRatio;

//             discountedTaxableAmount = Math.max(0, taxableAmount - discountAppliedToTaxable);
//             discountedNonTaxableAmount = Math.max(0, nonTaxableAmount - discountAppliedToNonTaxable);
//         }

//         // Calculate VAT on DISCOUNTED taxable amount only
//         const vatAmount = formData.isVatExempt !== 'true' ?
//             (discountedTaxableAmount * formData.vatPercentage) / 100 : 0;

//         // Calculate grand total: discounted amounts + VAT + round off
//         const grandTotalBeforeRound = discountedTaxableAmount + discountedNonTaxableAmount + vatAmount;
//         const roundOffAmount = parseFloat(formData.roundOffAmount || 0);
//         const grandTotal = grandTotalBeforeRound + roundOffAmount;

//         // Calculate change due
//         const tenderAmount = parseFloat(formData.tenderAmount || 0);
//         const changeDue = Math.max(0, tenderAmount - grandTotal);

//         return {
//             subTotal,
//             totalQuantity,
//             totalItems,
//             discountAmount,
//             taxableAmount,
//             nonTaxableAmount,
//             discountedTaxableAmount,
//             discountedNonTaxableAmount,
//             discountAppliedToTaxable,
//             discountAppliedToNonTaxable,
//             vatAmount,
//             grandTotal,
//             grandTotalBeforeRound,
//             roundOffAmount,
//             changeDue,
//             tenderAmount
//         };
//     };

//     const calculateDiscounts = (itemsToCalculate = items) => {
//         const subTotal = itemsToCalculate.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

//         if (discountType === 'percentage' && discountInput) {
//             const discountValue = parseFloat(discountInput) || 0;
//             const discountAmount = (subTotal * discountValue) / 100;
//             setFormData(prev => ({
//                 ...prev,
//                 discountAmount: Math.min(discountAmount, subTotal).toFixed(2),
//                 discountPercentage: discountValue
//             }));
//         } else if (discountType === 'amount' && discountInput) {
//             const discountAmount = parseFloat(discountInput) || 0;
//             const discountPercentage = subTotal > 0 ? (discountAmount / subTotal) * 100 : 0;
//             setFormData(prev => ({
//                 ...prev,
//                 discountAmount: Math.min(discountAmount, subTotal).toFixed(2),
//                 discountPercentage: discountPercentage.toFixed(2)
//             }));
//         }
//     };

//     const handleQuickPayment = (amount) => {
//         const summary = calculatePOSSummary();
//         let tenderAmount = 0;

//         switch (amount) {
//             case 'exact':
//                 tenderAmount = summary.grandTotal;
//                 break;
//             case 'round':
//                 tenderAmount = Math.ceil(summary.grandTotal / 10) * 10;
//                 break;
//             case 'no-discount':
//                 // Remove discount and calculate total
//                 const vatAmount = (summary.taxableAmount * formData.vatPercentage) / 100;
//                 tenderAmount = summary.subTotal + vatAmount;
//                 // Remove discount
//                 setFormData(prev => ({
//                     ...prev,
//                     discountAmount: 0,
//                     discountPercentage: 0
//                 }));
//                 setDiscountInput('');
//                 break;
//             default:
//                 tenderAmount = typeof amount === 'number' ? amount : summary.grandTotal;
//                 break;
//         }

//         setFormData(prev => ({
//             ...prev,
//             tenderAmount,
//             changeDue: Math.max(0, tenderAmount - summary.grandTotal)
//         }));

//         focusTenderAmount();
//     };


//     const handleSubmit = async (e, print = false) => {
//         if (e) e.preventDefault();

//         // Validate all quantities before submitting
//         const isValid = validateAllQuantities();
//         if (!isValid) {
//             setNotification({
//                 show: true,
//                 message: 'Please fix quantity errors before completing sale',
//                 type: 'error'
//             });

//             // Focus on the first error
//             const firstErrorIndex = Object.keys(quantityErrors)[0];
//             if (firstErrorIndex !== undefined) {
//                 setTimeout(() => {
//                     const errorInput = document.querySelector(`tr:nth-child(${parseInt(firstErrorIndex) + 1}) .quantity-controls input`);
//                     errorInput?.focus();
//                     errorInput?.select();
//                 }, 100);
//             }

//             return;
//         }

//         if (items.length === 0) {
//             setNotification({ show: true, message: 'Please add items to the sale', type: 'error' });
//             return;
//         }

//         setIsSaving(true);
//         try {
//             const billData = {
//                 ...formData,
//                 items: items.map(item => ({
//                     item: item.item,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     quantity: item.quantity,
//                     unit: item.unit?._id,
//                     price: item.price,
//                     puPrice: item.puPrice,
//                     netPuPrice: item.netPuPrice || item.puPrice,
//                     vatStatus: item.vatStatus,
//                     uniqueUuId: item.uniqueUuId
//                 })),
//                 print,
//                 posData: {
//                     summary: calculatePOSSummary(),
//                     timestamp: new Date().toISOString()
//                 }
//             };

//             const response = await api.post('/api/retailer/cash-sales', billData);

//             // Refresh stock data after successful sale
//             await refreshStockData();

//             setNotification({
//                 show: true,
//                 message: print ? 'Receipt printed!' : 'Sale completed!',
//                 type: 'success'
//             });

//             if (print) {
//                 navigate(`/bills/${response.data.data.bill._id}/cash/direct-print`);
//             } else {
//                 resetForm();
//             }
//         } catch (error) {
//             setNotification({
//                 show: true,
//                 message: error.response?.data?.error || 'Failed to process sale',
//                 type: 'error'
//             });
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     const resetForm = async () => {
//         try {
//             // Refresh stock data first
//             await refreshStockData();

//             const response = await api.get('/api/retailer/cash-sales');
//             const { data } = response;

//             const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//             const currentRomanDate = new Date().toISOString().split('T')[0];

//             setFormData(prev => ({
//                 ...prev,
//                 cashAccount: '',
//                 cashAccountId: '',
//                 cashAccountAddress: '',
//                 cashAccountPan: '',
//                 cashAccountEmail: '',
//                 cashAccountPhone: '',
//                 transactionDateNepali: currentNepaliDate,
//                 transactionDateRoman: currentRomanDate,
//                 nepaliDate: currentNepaliDate,
//                 billDate: currentRomanDate,
//                 billNumber: data.data.nextSalesBillNumber,
//                 tenderAmount: 0,
//                 changeDue: 0,
//                 discountAmount: 0,
//                 discountPercentage: 0,
//                 roundOffAmount: 0,
//                 isVatExempt: 'all',
//                 items: []
//             }));
//             setItems([]);
//             setQuantityErrors({}); // Clear quantity errors
//             setNextBillNumber(data.data.nextSalesBillNumber);
//             barcodeInputRef.current?.focus();
//         } catch (err) {
//             console.error('Error resetting form:', err);
//         }
//     };

//     // Add this function after your other functions
//     const focusTenderAmount = () => {
//         setTimeout(() => {
//             tenderAmountRef.current?.focus();
//             tenderAmountRef.current?.select();
//         }, 100);
//     };

//     // Updated handleAccountCreated function
//     const handleAccountCreated = async (newAccountData) => {
//         try {
//             const response = await api.get('/api/retailer/cash-sales');
//             const { data } = response;
//             const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
//             setAccounts(sortedAccounts);

//             if (newAccountData?.name) {
//                 setFormData(prev => ({
//                     ...prev,
//                     cashAccount: newAccountData.name,
//                     cashAccountId: newAccountData._id,
//                     cashAccountAddress: newAccountData.address || '',
//                     cashAccountPan: newAccountData.pan || '',
//                     cashAccountEmail: newAccountData.email || '',
//                     cashAccountPhone: newAccountData.phone || ''
//                 }));
//             }

//             setNotification({
//                 show: true,
//                 message: 'Account created and selected!',
//                 type: 'success'
//             });
//         } catch (error) {
//             console.error('Error refreshing accounts:', error);
//         }
//     };

//     // Update your IMSSidebar component
//     const IMSSidebar = () => (
//         <div className="ims-sidebar">
//             <div className="sidebar-header">
//                 <h6>POS Quick Actions</h6>
//             </div>
//             <div className="sidebar-content">
//                 <button className="sidebar-btn" onClick={() => barcodeInputRef.current?.focus()}>
//                     <i className="bi bi-upc-scan"></i> Scan Product (F1)
//                 </button>
//                 <button className="sidebar-btn" onClick={() => setShowAccountModal(true)}>
//                     <i className="bi bi-person"></i> Customer (F2)
//                 </button>
//                 <button className="sidebar-btn" onClick={() => setIsDiscountModalOpen(true)}>
//                     <i className="bi bi-percent"></i> Discount (F3)
//                 </button>
//                 <button className="sidebar-btn" onClick={() => setShowProductModal(true)}>
//                     <i className="bi bi-search"></i> Product Search (F9)
//                 </button>
//                 <button className="sidebar-btn" onClick={resetForm}>
//                     <i className="bi bi-x-circle"></i> New Sale (F5)
//                 </button>
//                 <button className="sidebar-btn" onClick={() => handleSubmit(null, true)}>
//                     <i className="bi bi-printer"></i> Print Receipt (F12)
//                 </button>
//             </div>

//             <div className="sidebar-footer">
//                 <div className="system-info">
//                     <small>Invoice: <strong>{formData.billNumber}</strong></small>
//                     <small>Time: {new Date().toLocaleTimeString()}</small>
//                     {formData.discountAmount > 0 && (
//                         <small className="text-warning">
//                             Discount: -{formData.discountAmount.toFixed(2)}
//                         </small>
//                     )}
//                 </div>
//             </div>
//         </div>
//     );

// // Update the POSItemRow component with stable focus management
// const POSItemRow = ({ item, index, isNew = false }) => {
//     const availableStock = getAvailableStockForDisplay(item);
//     const remainingStock = getRemainingStock(item);
//     const [isHighlighted, setIsHighlighted] = useState(isNew);
//     const [localQuantity, setLocalQuantity] = useState(item.quantity.toString());
//     const [localPrice, setLocalPrice] = useState(item.price.toString());
//     const quantityInputRef = useRef(null);
//     const priceInputRef = useRef(null);

//     // Sync local state with item props
//     useEffect(() => {
//         setLocalQuantity(item.quantity.toString());
//         setLocalPrice(item.price.toString());
//     }, [item.quantity, item.price]);

//     // Remove highlight after animation
//     useEffect(() => {
//         if (isNew) {
//             const timer = setTimeout(() => {
//                 setIsHighlighted(false);
//             }, 2000);
//             return () => clearTimeout(timer);
//         }
//     }, [isNew]);

//     // Focus management functions
//     const focusQuantityInput = () => {
//         setTimeout(() => {
//             quantityInputRef.current?.focus();
//             quantityInputRef.current?.select();
//         }, 10);
//     };

//     const focusPriceInput = () => {
//         setTimeout(() => {
//             priceInputRef.current?.focus();
//             priceInputRef.current?.select();
//         }, 10);
//     };

//     const handleQuantityChange = (e) => {
//         const value = e.target.value;
//         setLocalQuantity(value);

//         // Only update parent state when input is valid and user is done typing
//         if (value === '' || value === '0') {
//             return; // Wait for valid input
//         }

//         const numValue = parseFloat(value);
//         if (!isNaN(numValue) && numValue > 0) {
//             updateItemField(index, 'quantity', numValue);
//         }
//     };

//     const handlePriceChange = (e) => {
//         const value = e.target.value;
//         setLocalPrice(value);

//         // Only update parent state when input is valid
//         if (value === '' || value === '0') {
//             return; // Wait for valid input
//         }

//         const numValue = parseFloat(value);
//         if (!isNaN(numValue) && numValue >= 0) {
//             updateItemField(index, 'price', numValue);
//         }
//     };

//     const handleQuantityBlur = (e) => {
//         const value = e.target.value;
//         if (value === '' || value === '0') {
//             // Reset to previous valid value if input is invalid
//             setLocalQuantity(item.quantity.toString());
//         } else {
//             const numValue = parseFloat(value);
//             if (!isNaN(numValue) && numValue > 0) {
//                 updateItemField(index, 'quantity', numValue);
//             }
//         }
//     };

//     const handlePriceBlur = (e) => {
//         const value = e.target.value;
//         if (value === '' || value === '0') {
//             // Reset to previous valid value if input is invalid
//             setLocalPrice(item.price.toString());
//         } else {
//             const numValue = parseFloat(value);
//             if (!isNaN(numValue) && numValue >= 0) {
//                 updateItemField(index, 'price', numValue);
//             }
//         }
//     };

//     const handleQuantityKeyDown = (e) => {
//         if (e.key === 'Enter') {
//             e.preventDefault();
//             // Update parent state before moving focus
//             const numValue = parseFloat(localQuantity);
//             if (!isNaN(numValue) && numValue > 0) {
//                 updateItemField(index, 'quantity', numValue);
//             }

//             if (!quantityErrors[index]) {
//                 focusPriceInput();
//             } else {
//                 focusQuantityInput();
//             }
//         } else if (e.key === 'Tab') {
//             e.preventDefault();
//             if (e.shiftKey) {
//                 // Shift+Tab - move to previous row
//                 if (index > 0) {
//                     const prevRow = document.querySelector(`tr[data-row-index="${index - 1}"]`);
//                     const prevPriceInput = prevRow?.querySelector('.price-input');
//                     setTimeout(() => {
//                         prevPriceInput?.focus();
//                         prevPriceInput?.select();
//                     }, 10);
//                 }
//             } else {
//                 // Tab - move to price input
//                 focusPriceInput();
//             }
//         }
//         // Allow arrow keys and other keys to work normally
//     };

//     const handlePriceKeyDown = (e) => {
//         if (e.key === 'Enter') {
//             e.preventDefault();
//             // Update parent state before moving focus
//             const numValue = parseFloat(localPrice);
//             if (!isNaN(numValue) && numValue >= 0) {
//                 updateItemField(index, 'price', numValue);
//             }

//             // Move to next row's quantity or to tender amount
//             const nextRow = e.target.closest('tr').nextElementSibling;
//             if (nextRow) {
//                 const nextQuantityInput = nextRow.querySelector('.quantity-input');
//                 setTimeout(() => {
//                     nextQuantityInput?.focus();
//                     nextQuantityInput?.select();
//                 }, 10);
//             } else {
//                 document.getElementById('tenderAmount')?.focus();
//                 document.getElementById('tenderAmount')?.select();
//             }
//         } else if (e.key === 'Tab') {
//             e.preventDefault();
//             if (e.shiftKey) {
//                 // Shift+Tab - move back to quantity input
//                 focusQuantityInput();
//             } else {
//                 // Tab - move to next row or tender amount
//                 const nextRow = e.target.closest('tr').nextElementSibling;
//                 if (nextRow) {
//                     const nextQuantityInput = nextRow.querySelector('.quantity-input');
//                     setTimeout(() => {
//                         nextQuantityInput?.focus();
//                         nextQuantityInput?.select();
//                     }, 10);
//                 } else {
//                     document.getElementById('tenderAmount')?.focus();
//                     document.getElementById('tenderAmount')?.select();
//                 }
//             }
//         }
//     };

//     const handleQuantityFocus = (e) => {
//         e.target.select();
//         setSelectedRowIndex(index);
//     };

//     const handlePriceFocus = (e) => {
//         e.target.select();
//         setSelectedRowIndex(index);
//     };

//     const handleQuickQuantityUpdate = (action) => {
//         quickQuantityUpdate(index, action);
//         // Refocus on the quantity input after update
//         setTimeout(() => {
//             focusQuantityInput();
//         }, 50);
//     };

//     return (
//         <tr
//             className={`pos-item-row ${index === selectedRowIndex ? 'selected' : ''} ${isHighlighted ? 'newly-added' : ''}`}
//             data-row-index={index}
//             onClick={() => setSelectedRowIndex(index)}
//         >
//             <td className="text-center">{index + 1}</td>
//             <td>
//                 <div className="item-info">
//                     <div className="item-name">{item.name}</div>
//                     <div className="item-details">
//                         {item.barcode && <span>Barcode: {item.barcode}</span>}
//                         <span>Batch: {item.batchNumber}</span>
//                         {item.expiryDate && <span>Expiry: {item.expiryDate}</span>}
//                         <div className="stock-info small text-muted">
//                             Stock: {availableStock} | {remainingStock}
//                         </div>
//                     </div>
//                 </div>
//             </td>
//             <td className="text-center">
//                 <div className="quantity-controls">
//                     <button
//                         onClick={(e) => {
//                             e.stopPropagation();
//                             handleQuickQuantityUpdate('decrement');
//                         }}
//                         title="Decrease quantity"
//                     >-</button>
//                     <input
//                         ref={quantityInputRef}
//                         type="number"
//                         value={localQuantity}
//                         onChange={handleQuantityChange}
//                         onBlur={handleQuantityBlur}
//                         onKeyDown={handleQuantityKeyDown}
//                         onFocus={handleQuantityFocus}
//                         onClick={(e) => e.stopPropagation()}
//                         min="1"
//                         max={availableStock}
//                         className={`quantity-input ${quantityErrors[index] ? 'error' : ''}`}
//                         placeholder="Qty"
//                     />
//                     <button
//                         onClick={(e) => {
//                             e.stopPropagation();
//                             handleQuickQuantityUpdate('increment');
//                         }}
//                         title="Increase quantity"
//                     >+</button>
//                 </div>
//                 {quantityErrors[index] && (
//                     <div className="quantity-error text-danger small">
//                         {quantityErrors[index]}
//                     </div>
//                 )}
//             </td>
//             <td className="text-center">{item.unit?.name}</td>
//             <td className="text-end">
//                 <input
//                     ref={priceInputRef}
//                     type="number"
//                     value={localPrice}
//                     onChange={handlePriceChange}
//                     onBlur={handlePriceBlur}
//                     onKeyDown={handlePriceKeyDown}
//                     onFocus={handlePriceFocus}
//                     onClick={(e) => e.stopPropagation()}
//                     step="0.01"
//                     min="0"
//                     className="price-input"
//                     placeholder="0.00"
//                 />
//             </td>
//             <td className="text-end amount-cell">{parseFloat(item.amount || 0).toFixed(2)}</td>
//             <td className="text-center">
//                 <button
//                     className="btn-remove"
//                     onClick={(e) => {
//                         e.stopPropagation();
//                         removeItem(index);
//                         setSelectedRowIndex(-1);
//                     }}
//                     title="Remove item"
//                 >
//                     <i className="bi bi-trash"></i>
//                 </button>
//             </td>
//         </tr>
//     );
// };
// // Add a function to handle row focus and scrolling
// const scrollToRow = (index) => {
//     setTimeout(() => {
//         const rowElement = document.querySelector(`tr[data-row-index="${index}"]`);
//         if (rowElement) {
//             rowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
//         }
//     }, 100);
// };



//     const SalesSummaryPanel = () => {
//         const summary = calculatePOSSummary();

//         return (
//             <div className="sales-summary-panel">
//                 <div className="summary-grid">
//                     <div className="summary-item">
//                         <span>Items:</span>
//                         <strong>{summary.totalItems}</strong>
//                     </div>
//                     <div className="summary-item">
//                         <span>Qty:</span>
//                         <strong>{summary.totalQuantity}</strong>
//                     </div>
//                     <div className="summary-item">
//                         <span>Subtotal:</span>
//                         <strong>{summary.subTotal.toFixed(2)}</strong>
//                     </div>

//                     {/* Show discount breakdown if discount is applied */}
//                     {summary.discountAmount > 0 && (
//                         <>
//                             <div className="summary-item">
//                                 <span>Discount:</span>
//                                 <strong className="text-danger">-{summary.discountAmount.toFixed(2)}</strong>
//                             </div>
//                             <div className="summary-item">
//                                 <span>Taxable After Disc:</span>
//                                 <strong>{summary.discountedTaxableAmount.toFixed(2)}</strong>
//                             </div>
//                             <div className="summary-item">
//                                 <span>Non-Taxable After Disc:</span>
//                                 <strong>{summary.discountedNonTaxableAmount.toFixed(2)}</strong>
//                             </div>
//                         </>
//                     )}

//                     <div className="summary-item">
//                         <span>VAT ({formData.vatPercentage}%):</span>
//                         <strong>{summary.vatAmount.toFixed(2)}</strong>
//                     </div>

//                     {summary.roundOffAmount !== 0 && (
//                         <div className="summary-item">
//                             <span>Round Off:</span>
//                             <strong>{summary.roundOffAmount.toFixed(2)}</strong>
//                         </div>
//                     )}

//                     <div className="summary-item total">
//                         <span>Grand Total:</span>
//                         <strong>{summary.grandTotal.toFixed(2)}</strong>
//                     </div>
//                 </div>
//             </div>
//         );
//     };

//     return (
//         <div className="ims-container">
//             <Header />

//             <div className="ims-layout">
//                 <IMSSidebar />

//                 <div className="ims-main-content">
//                     {/* Top Bar */}
//                     <div className="ims-top-bar">
//                         <div className="top-bar-left">
//                             {/* <h4>Point of Sale</h4> */}
//                             <div className="session-info">
//                                 <span className="badge bg-primary">Invoice: {formData.billNumber}</span>
//                                 <span className="time-display">{new Date().toLocaleTimeString()}</span>
//                             </div>
//                         </div>
//                         <div className="top-bar-right">
//                             <div className="quick-stats">
//                                 <span>Items: {items.length}</span>
//                                 <span>Total: {calculatePOSSummary().grandTotal.toFixed(2)}</span>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Main Content Grid */}
//                     <div className="ims-grid">
//                         {/* Products Panel */}
//                         <div className="products-panel">
//                             <div className="panel-header">
//                                 <h5>Products</h5>
//                                 <div className="search-container">
//                                     <div className="search-box">
//                                         <i className="bi bi-search"></i>
//                                         <input
//                                             type="text"
//                                             placeholder="Scan barcode or search products..."
//                                             value={barcodeInput}
//                                             onChange={(e) => {
//                                                 setBarcodeInput(e.target.value);
//                                                 filterItems(e.target.value);
//                                             }}
//                                             onFocus={() => {
//                                                 if (barcodeInput.length > 0) {
//                                                     filterItems(barcodeInput);
//                                                 }
//                                             }}
//                                             ref={barcodeInputRef}
//                                             className="search-input"
//                                         />
//                                         <button
//                                             className="btn-search-advanced"
//                                             onClick={() => setShowProductModal(true)}
//                                             title="Advanced search"
//                                         >
//                                             <i className="bi bi-funnel"></i>
//                                         </button>
//                                     </div>

//                                     {/* Search Results Dropdown */}
//                                     {showItemDropdown && filteredItems.length > 0 && (
//                                         <div
//                                             className="search-results-dropdown"
//                                             onKeyDown={handleSearchResultsKeyDown}
//                                         >
//                                             <div className="dropdown-header">
//                                                 <span>Search Results ({filteredItems.length})</span>
//                                                 <button
//                                                     className="btn-close-dropdown"
//                                                     onClick={() => {
//                                                         setShowItemDropdown(false);
//                                                         setSelectedSearchIndex(-1);
//                                                     }}
//                                                 >
//                                                     <i className="bi bi-x"></i>
//                                                 </button>
//                                             </div>
//                                             <div className="dropdown-content">
//                                                 {filteredItems.map((item, index) => (
//                                                     <div
//                                                         key={item._id}
//                                                         className={`search-result-item ${index === selectedSearchIndex ? 'selected' : ''}`}
//                                                         onClick={() => {
//                                                             addItemToBill(item);
//                                                             setBarcodeInput('');
//                                                             setShowItemDropdown(false);
//                                                             setSelectedSearchIndex(-1);
//                                                         }}
//                                                         ref={index === selectedSearchIndex ? selectedItemRef : null}
//                                                     >
//                                                         <div className="product-info">
//                                                             <div className="product-name">{item.name}</div>
//                                                             <div className="product-details">
//                                                                 <span className="product-code">Code: {item.uniqueNumber}</span>
//                                                                 <span className="product-price">Price: {item.stockEntries?.[0]?.price || 0}</span>
//                                                                 <span className="product-stock">Stock: {item.stockEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0}</span>
//                                                             </div>
//                                                         </div>
//                                                         <div
//                                                             className="add-indicator"
//                                                             onClick={(e) => {
//                                                                 e.stopPropagation(); // Prevent the main click from adding to bill
//                                                                 setSelectedProductForStock(item);
//                                                                 setShowStockAdjustmentModal(true);
//                                                                 setShowItemDropdown(false);
//                                                                 setSelectedSearchIndex(-1);
//                                                             }}
//                                                             title="Add stock for this product"
//                                                         >
//                                                             <i className="bi bi-plus-circle"></i>
//                                                         </div>
//                                                     </div>
//                                                 ))}
//                                             </div>
//                                         </div>
//                                     )}
//                                 </div>
//                             </div>

//                             <div className="products-content">
//                                 {items.length === 0 ? (
//                                     <div className="empty-state">
//                                         <i className="bi bi-cart-x"></i>
//                                         <p>No items added</p>
//                                         <small>Scan barcode or search products to begin</small>
//                                         {filteredItems.length === 0 && barcodeInput.length > 2 && (
//                                             <div className="no-results">
//                                                 <i className="bi bi-search"></i>
//                                                 <p>No products found for "{barcodeInput}"</p>
//                                             </div>
//                                         )}
//                                     </div>
//                                 ) : (
//                                     <div className="items-table-container">
//                                         <table className="items-table">
//                                             <thead>
//                                                 <tr>
//                                                     <th width="5%">#</th>
//                                                     <th width="35%">Product</th>
//                                                     <th width="15%">Qty</th>
//                                                     <th width="10%">Unit</th>
//                                                     <th width="15%">Price</th>
//                                                     <th width="15%">Amount</th>
//                                                     <th width="5%"></th>
//                                                 </tr>
//                                             </thead>
//                                             <tbody>
//                                                 {items.map((item, index) => (
//                                                     <POSItemRow
//                                                         key={index}
//                                                         item={item}
//                                                         index={index}
//                                                         isNew={index === items.length - 1} // Mark the last item as new
//                                                     />
//                                                 ))}
//                                             </tbody>
//                                         </table>
//                                     </div>
//                                 )}
//                             </div>
//                         </div>

//                         {/* Transaction Panel */}
//                         <div className="transaction-panel">
//                             <div className="panel-header">
//                                 <h5>Transaction</h5>
//                             </div>

//                             <div className="transaction-content">
//                                 {/* Customer Section */}
//                                 <div className="customer-section">
//                                     <label>Customer</label>
//                                     <div className="customer-input-group">
//                                         <input
//                                             type="text"
//                                             placeholder="Search"
//                                             value={formData.cashAccount}
//                                             onChange={(e) => setFormData(prev => ({
//                                                 ...prev,
//                                                 cashAccount: e.target.value
//                                             }))}
//                                             onFocus={() => setShowAccountModal(true)}
//                                         />
//                                         <button
//                                             className="btn-customer-add"
//                                             onClick={() => setShowAccountCreationModal(true)}
//                                             title="Add New Customer"
//                                         >
//                                             <i className="bi bi-person-plus"></i>
//                                         </button>
//                                     </div>
//                                 </div>

//                                 {/* Sales Summary - Compact Version */}
//                                 <div className="sales-summary-panel compact">
//                                     <div className="summary-header">
//                                         <h6>Sale Summary</h6>
//                                         <div className="header-actions">
//                                             <span className="items-count">{items.length} items</span>
//                                             <button
//                                                 className="btn-discount"
//                                                 onClick={() => setIsDiscountModalOpen(true)}
//                                                 title="Apply Discount"
//                                             >
//                                                 <i className="bi bi-percent"></i>
//                                             </button>
//                                         </div>
//                                     </div>
//                                     <div className="summary-grid compact">
//                                         <div className="summary-row">
//                                             <span>Subtotal:</span>
//                                             <span className="amount">{calculatePOSSummary().subTotal.toFixed(2)}</span>
//                                         </div>

//                                         {/* Discount Row - Only show if discount is applied */}
//                                         {(formData.discountAmount > 0) && (
//                                             <div className="summary-row discount">
//                                                 <span>
//                                                     Discount
//                                                     {formData.discountPercentage > 0 && ` (${formData.discountPercentage}%)`}:
//                                                 </span>
//                                                 <span className="amount text-danger">
//                                                     -{calculatePOSSummary().discountAmount.toFixed(2)}
//                                                 </span>
//                                             </div>
//                                         )}

//                                         <div className="summary-row">
//                                             <span>VAT ({formData.vatPercentage}%):</span>
//                                             <span className="amount">{calculatePOSSummary().vatAmount.toFixed(2)}</span>
//                                         </div>

//                                         {calculatePOSSummary().roundOffAmount !== 0 && (
//                                             <div className="summary-row">
//                                                 <span>Round Off:</span>
//                                                 <span className="amount">{calculatePOSSummary().roundOffAmount.toFixed(2)}</span>
//                                             </div>
//                                         )}

//                                         <div className="summary-row total">
//                                             <span>Grand Total:</span>
//                                             <span className="amount">{calculatePOSSummary().grandTotal.toFixed(2)}</span>
//                                         </div>
//                                     </div>
//                                 </div>

//                                 {/* Payment Section - Compact Layout */}
//                                 <div className="payment-section compact">
//                                     <div className="payment-header">
//                                         <h6>Payment</h6>
//                                     </div>

//                                     <div className="payment-grid">
//                                         <div className="payment-group">
//                                             <label htmlFor="tenderAmount">Tender Amount</label>
//                                             <input
//                                                 ref={tenderAmountRef}
//                                                 type="number"
//                                                 id="tenderAmount"
//                                                 value={formData.tenderAmount}
//                                                 onChange={(e) => setFormData(prev => ({
//                                                     ...prev,
//                                                     tenderAmount: parseFloat(e.target.value) || 0,
//                                                     changeDue: Math.max(0, parseFloat(e.target.value) - calculatePOSSummary().grandTotal)
//                                                 }))}
//                                                 placeholder="0.00"
//                                                 className="tender-input"
//                                             />
//                                         </div>

//                                         <div className="payment-group">
//                                             <label>Change Due</label>
//                                             <div className={`change-amount ${calculatePOSSummary().changeDue > 0 ? 'has-change' : ''}`}>
//                                                 {calculatePOSSummary().changeDue.toFixed(2)}
//                                             </div>
//                                         </div>
//                                     </div>

//                                     <div className="payment-method-group">
//                                         <label htmlFor="paymentMode">Payment Method</label>
//                                         <select
//                                             id="paymentMode"
//                                             value={formData.paymentMode}
//                                             onChange={(e) => setFormData(prev => ({ ...prev, paymentMode: e.target.value }))}
//                                             className="payment-select"
//                                         >
//                                             <option value="cash">💵 Cash</option>
//                                             {/* <option value="card">💳 Card</option>
//                                             <option value="digital">📱 Digital</option>
//                                             <option value="credit">📝 Credit</option> */}
//                                         </select>
//                                     </div>

//                                     {/* Quick Payment Buttons */}
//                                     <div className="quick-payment-buttons">
//                                         <button
//                                             className="btn-quick-payment"
//                                             onClick={() => handleQuickPayment('exact')}
//                                             title="Set tender amount to grand total"
//                                         >
//                                             Exact
//                                         </button>
//                                         <button
//                                             className="btn-quick-payment"
//                                             onClick={() => handleQuickPayment('round')}
//                                             title="Round up to nearest 10"
//                                         >
//                                             Round Up
//                                         </button>
//                                         <button
//                                             className="btn-quick-payment"
//                                             onClick={() => handleQuickPayment(1000)}
//                                             title="Set tender amount to 1000"
//                                         >
//                                             1000
//                                         </button>
//                                         {/* Add Discount Button */}
//                                         <button
//                                             className="btn-quick-payment btn-discount"
//                                             onClick={() => setIsDiscountModalOpen(true)}
//                                             title="Apply Discount"
//                                         >
//                                             <i className="bi bi-percent"></i> Discount
//                                         </button>
//                                     </div>
//                                 </div>

//                                 {/* Action Buttons - Compact Layout */}
//                                 <div className="action-buttons compact">
//                                     <div className="primary-actions">
//                                         <button
//                                             className="btn-complete-sale"
//                                             onClick={(e) => handleSubmit(e, false)}
//                                             disabled={isSaving || items.length === 0}
//                                         >
//                                             {isSaving ? (
//                                                 <>
//                                                     <i className="bi bi-hourglass-split"></i>
//                                                     <span className="btn-text">Processing...</span>
//                                                 </>
//                                             ) : (
//                                                 <>
//                                                     <i className="bi bi-check-circle"></i>
//                                                     <span className="btn-text">Complete Sale</span>
//                                                     <span className="shortcut">(Enter)</span>
//                                                 </>
//                                             )}
//                                         </button>
//                                     </div>

//                                     <div className="secondary-actions compact">
//                                         <button
//                                             className="btn-print"
//                                             onClick={(e) => handleSubmit(e, true)}
//                                             disabled={isSaving || items.length === 0}
//                                             title="Print Receipt (F12)"
//                                         >
//                                             <i className="bi bi-printer"></i>
//                                             <span className="btn-text">Print</span>
//                                             <span className="shortcut">F12</span>
//                                         </button>

//                                         <button
//                                             className="btn-clear"
//                                             onClick={resetForm}
//                                             title="New Sale (F5)"
//                                         >
//                                             <i className="bi bi-x-circle"></i>
//                                             <span className="btn-text">Clear</span>
//                                             <span className="shortcut">F5</span>
//                                         </button>
//                                     </div>
//                                 </div>

//                                 {/* Transaction Status Bar */}
//                                 <div className="transaction-status">
//                                     <div className="status-item">
//                                         <span className="status-label">Invoice:</span>
//                                         <span className="status-value">{formData.billNumber}</span>
//                                     </div>
//                                     <div className="status-item">
//                                         <span className="status-label">Time:</span>
//                                         <span className="status-value">{new Date().toLocaleTimeString()}</span>
//                                     </div>
//                                     <div className="status-item">
//                                         <span className="status-label">Status:</span>
//                                         <span className={`status-value ${items.length > 0 ? 'active' : 'inactive'}`}>
//                                             {items.length > 0 ? 'Active' : 'Ready'}
//                                         </span>
//                                     </div>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             {/* Account Modal */}
//             {showAccountModal && (
//                 <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block' }}>
//                     <div className="modal-dialog modal-xl modal-dialog-centered">
//                         <div className="modal-content" style={{ height: '500px' }}>
//                             <div className="modal-header">
//                                 <h5 className="modal-title" id="accountModalLabel">Select or Enter Cash Account</h5>
//                                 <button
//                                     type="button"
//                                     className="btn-close"
//                                     onClick={() => {
//                                         setShowAccountModal(false);
//                                         focusTenderAmount(); // Focus on tender amount when closing modal
//                                     }}
//                                 ></button>
//                             </div>
//                             <div className="p-3 bg-white sticky-top">
//                                 <input
//                                     type="text"
//                                     id="searchAccount"
//                                     autoComplete='off'
//                                     className="form-control form-control-lg"
//                                     placeholder="Type to search or enter new account name"
//                                     autoFocus
//                                     value={formData.cashAccount}
//                                     onChange={(e) => {
//                                         const value = e.target.value;
//                                         setFormData(prev => ({
//                                             ...prev,
//                                             cashAccount: value,
//                                             cashAccountAddress: '',
//                                             cashAccountPhone: ''
//                                         }));

//                                         // Filter accounts based on search
//                                         if (value === '') {
//                                             setFilteredAccounts([]);
//                                         } else {
//                                             const filtered = accounts.filter(account =>
//                                                 account.name.toLowerCase().includes(value.toLowerCase())
//                                             );
//                                             setFilteredAccounts(filtered);
//                                         }
//                                     }}
//                                     onKeyDown={(e) => {
//                                         if (e.key === 'ArrowDown') {
//                                             e.preventDefault();
//                                             const firstAccountItem = document.querySelector('.account-item');
//                                             if (firstAccountItem) {
//                                                 firstAccountItem.focus();
//                                             }
//                                         } else if (e.key === 'Enter') {
//                                             e.preventDefault();
//                                             // Always use the typed text when pressing Enter in the input
//                                             setShowAccountModal(false);
//                                             focusTenderAmount();
//                                             setTimeout(() => {
//                                                 addressRef.current?.focus();
//                                             }, 100);
//                                         }
//                                     }}
//                                     ref={accountSearchRef}
//                                 />
//                             </div>
//                             <div className="modal-body p-0">
//                                 <div className="overflow-auto" style={{ height: 'calc(400px - 120px)' }}>
//                                     <ul id="accountList" className="list-group">
//                                         {(filteredAccounts.length > 0 ? filteredAccounts : accounts).map((account, index) => (
//                                             <li
//                                                 key={account._id}
//                                                 data-account-id={account._id}
//                                                 className={`list-group-item account-item py-2`}
//                                                 onClick={() => {
//                                                     setFormData({
//                                                         ...formData,
//                                                         cashAccount: account.name,
//                                                         cashAccountAddress: account.address,
//                                                         cashAccountPhone: account.phone
//                                                     });
//                                                     setShowAccountModal(false);
//                                                     focusTenderAmount();
//                                                     setTimeout(() => {
//                                                         addressRef.current?.focus();
//                                                     }, 100);
//                                                 }}
//                                                 style={{ cursor: 'pointer' }}
//                                                 tabIndex={0}
//                                                 onKeyDown={(e) => {
//                                                     if (e.key === 'ArrowDown') {
//                                                         e.preventDefault();
//                                                         const nextItem = e.target.nextElementSibling;
//                                                         if (nextItem) {
//                                                             e.target.classList.remove('active');
//                                                             nextItem.classList.add('active');
//                                                             nextItem.focus();
//                                                         }
//                                                     } else if (e.key === 'ArrowUp') {
//                                                         e.preventDefault();
//                                                         const prevItem = e.target.previousElementSibling;
//                                                         if (prevItem) {
//                                                             e.target.classList.remove('active');
//                                                             prevItem.classList.add('active');
//                                                             prevItem.focus();
//                                                         } else {
//                                                             accountSearchRef.current?.focus();
//                                                         }
//                                                     } else if (e.key === 'Enter') {
//                                                         e.preventDefault();
//                                                         setFormData({
//                                                             ...formData,
//                                                             cashAccount: account.name,
//                                                             cashAccountAddress: account.address,
//                                                             cashAccountPhone: account.phone
//                                                         });
//                                                         setShowAccountModal(false);
//                                                         focusTenderAmount();
//                                                         setTimeout(() => {
//                                                             addressRef.current?.focus();
//                                                         }, 100);
//                                                     }
//                                                 }}
//                                                 onFocus={(e) => {
//                                                     document.querySelectorAll('.account-item').forEach(item => {
//                                                         item.classList.remove('active');
//                                                     });
//                                                     e.target.classList.add('active');
//                                                 }}
//                                             >
//                                                 <div className="d-flex justify-content-between small">
//                                                     <strong>{account.name}</strong>
//                                                     <span>📍 {account.address || 'N/A'} | 📞 {account.phone || 'N/A'}</span>
//                                                 </div>
//                                             </li>
//                                         ))}
//                                     </ul>
//                                 </div>
//                             </div>
//                             <div className="modal-footer">
//                                 <button
//                                     type="button"
//                                     className="btn btn-primary"
//                                     onClick={() => {
//                                         setShowAccountModal(false);
//                                         focusTenderAmount();
//                                         setTimeout(() => {
//                                             addressRef.current?.focus();
//                                         }, 100);
//                                     }}
//                                 >
//                                     Use Entered Name
//                                 </button>
//                                 <button
//                                     type="button"
//                                     className="btn btn-secondary"
//                                     onClick={() => {
//                                         setShowAccountModal(false);
//                                         focusTenderAmount(); // Focus on tender amount
//                                     }}
//                                 >
//                                     Cancel
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             )}

//             {/* Modals */}
//             <AccountCreationModal
//                 show={showAccountCreationModal}
//                 onClose={() => setShowAccountCreationModal(false)}
//                 onAccountCreated={handleAccountCreated}
//                 companyId={company?._id}
//                 fiscalYear={company?.fiscalYear?._id}
//             />

//             {isDiscountModalOpen && (
//                 <DiscountModal
//                     discountInput={discountInput}
//                     discountType={discountType}
//                     setDiscountInput={setDiscountInput}
//                     setDiscountType={setDiscountType}
//                     setFormData={setFormData}
//                     setIsDiscountModalOpen={setIsDiscountModalOpen}
//                     calculatePOSSummary={calculatePOSSummary}
//                     focusTenderAmount={focusTenderAmount}
//                     items={items}
//                     formData={formData}
//                 />
//             )}

//             {showProductModal && (
//                 <ProductModal
//                     onClose={() => setShowProductModal(false)}
//                     onSelectProduct={addItemToBill}
//                     products={allItems}
//                 />
//             )}

//             <NotificationToast
//                 show={notification.show}
//                 message={notification.message}
//                 type={notification.type}
//                 onClose={() => setNotification({ ...notification, show: false })}
//             />

//             {/* Stock Adjustment Modal */}
//             <StockAdjustmentModal
//                 show={showStockAdjustmentModal}
//                 onClose={() => {
//                     setShowStockAdjustmentModal(false);
//                     setSelectedProductForStock(null);
//                     barcodeInputRef.current?.focus();
//                 }}
//                 product={selectedProductForStock}
//                 onStockAdded={async (adjustmentData) => {
//                     // Refresh stock data after successful stock adjustment
//                     await refreshStockData();

//                     setNotification({
//                         show: true,
//                         message: `Stock added successfully! Bill: ${adjustmentData.billNumber}`,
//                         type: 'success'
//                     });

//                     // Also refresh the items in the current bill to reflect new stock
//                     const updatedItems = await refreshStockData();

//                     // Update current items with fresh stock data
//                     setItems(prevItems => {
//                         return prevItems.map(cartItem => {
//                             const freshItem = updatedItems.find(item => item._id === cartItem.item);
//                             if (freshItem) {
//                                 return {
//                                     ...cartItem,
//                                     // Update stock-related information if needed
//                                 };
//                             }
//                             return cartItem;
//                         });
//                     });
//                 }}
//             />
//         </div>
//     );
// };

// export default PosCashSales;

//===================================================================================

// import React, { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date-converter';
// import axios from 'axios';
// import Header from '../Header';
// import NotificationToast from '../../NotificationToast';
// import '../../../stylesheet/retailer/sales/AddCashSales.css';
// import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
// import '../../../stylesheet/noDateIcon.css';
// import ProductModal from '../dashboard/modals/ProductModal';
// import AccountCreationModal from './AccountCreationModal';
// import '../../../stylesheet/retailer/sales/POSStylesSales.css';
// import StockAdjustmentModal from './StockAdjustmentModal';
// import DiscountModal from './DiscountModal';

// const PosCashSales = () => {
//     const navigate = useNavigate();

//     // POS State Management
//     const [quantityErrors, setQuantityErrors] = useState({});
//     const [stockValidation, setStockValidation] = useState({
//         itemStockMap: new Map(),
//         usedStockMap: new Map(),
//     });
//     const [dateErrors, setDateErrors] = useState({
//         transactionDateNepali: '',
//         nepaliDate: ''
//     });
//     const [showDatePicker, setShowDatePicker] = useState(false);
//     const [showStockAdjustmentModal, setShowStockAdjustmentModal] = useState(false);
//     const [selectedProductForStock, setSelectedProductForStock] = useState(null);
//     const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
//     const [showAccountCreationModal, setShowAccountCreationModal] = useState(false);
//     const [showProductModal, setShowProductModal] = useState(false);
//     const [itemSearchTerm, setItemSearchTerm] = useState('');
//     const transactionDateRef = useRef(null);
//     const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
//     const addressRef = useRef(null);
//     const [isSaving, setIsSaving] = useState(false);
//     const [isLoading, setIsLoading] = useState(true);
//     const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//     const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
//     const [discountInput, setDiscountInput] = useState('');
//     const [discountType, setDiscountType] = useState('percentage');
//     const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

//     const [notification, setNotification] = useState({
//         show: false,
//         message: '',
//         type: 'success'
//     });

//     // Enhanced Form Data for POS
//     const [formData, setFormData] = useState({
//         cashAccount: '',
//         cashAccountId: '',
//         cashAccountAddress: '',
//         cashAccountPan: '',
//         cashAccountEmail: '',
//         cashAccountPhone: '',
//         transactionDateNepali: currentNepaliDate,
//         transactionDateRoman: new Date().toISOString().split('T')[0],
//         nepaliDate: currentNepaliDate,
//         billDate: new Date().toISOString().split('T')[0],
//         billNumber: '',
//         paymentMode: 'cash',
//         isVatExempt: 'all',
//         discountPercentage: 0,
//         discountAmount: 0,
//         roundOffAmount: 0,
//         vatPercentage: 13,
//         items: [],
//         tenderAmount: 0,
//         changeDue: 0,
//         transactionType: 'sale',
//         referenceNumber: '',
//         holdReason: ''
//     });

//     const [items, setItems] = useState([]);
//     const [allItems, setAllItems] = useState([]);
//     const [accounts, setAccounts] = useState([]);
//     const [filteredAccounts, setFilteredAccounts] = useState([]);
//     const [showAccountModal, setShowAccountModal] = useState(false);
//     const [showItemDropdown, setShowItemDropdown] = useState(false);
//     const [filteredItems, setFilteredItems] = useState([]);
//     const [company, setCompany] = useState({
//         dateFormat: 'nepali',
//         vatEnabled: true,
//         fiscalYear: {},
//         posSettings: {
//             enableBarcode: true,
//             enableQuickKeys: true,
//             autoPrint: false,
//             requireCustomer: false
//         }
//     });
//     const [nextBillNumber, setNextBillNumber] = useState('');
//     const [barcodeInput, setBarcodeInput] = useState('');

//     const accountSearchRef = useRef(null);
//     const itemSearchRef = useRef(null);
//     const barcodeInputRef = useRef(null);
//     const selectedItemRef = useRef(null);
//     const tenderAmountRef = useRef(null);

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     // Load initial data
//     useEffect(() => {
//         const fetchInitialData = async () => {
//             try {
//                 const response = await api.get('/api/retailer/cash-sales');
//                 const { data } = response;

//                 const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
//                 const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));

//                 setCompany(data.data.company);
//                 setAllItems(sortedItems);
//                 setAccounts(sortedAccounts);
//                 setNextBillNumber(data.data.nextSalesBillNumber);

//                 setFormData(prev => ({
//                     ...prev,
//                     billNumber: data.data.nextSalesBillNumber
//                 }));
//                 setIsInitialDataLoaded(true);
//             } catch (error) {
//                 console.error('Error fetching initial data:', error);
//             }
//         };
//         fetchInitialData();
//     }, []);


//     // Add this function after your other functions in the component
//     const refreshStockData = async () => {
//         try {
//             const response = await api.get('/api/retailer/cash-sales');
//             const { data } = response;

//             const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));
//             setAllItems(sortedItems);

//             // Update stock validation map
//             const newItemStockMap = new Map();
//             sortedItems.forEach(item => {
//                 const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
//                 newItemStockMap.set(item._id, totalStock);
//             });

//             setStockValidation(prev => ({
//                 ...prev,
//                 itemStockMap: newItemStockMap
//             }));

//             return sortedItems;
//         } catch (error) {
//             console.error('Error refreshing stock data:', error);
//             setNotification({
//                 show: true,
//                 message: 'Failed to refresh stock data',
//                 type: 'error'
//             });
//             return allItems; // Return current items as fallback
//         }
//     };

//     // Stock validation
//     useEffect(() => {
//         if (allItems.length > 0) {
//             const newItemStockMap = new Map();
//             allItems.forEach(item => {
//                 const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
//                 newItemStockMap.set(item._id, totalStock);
//             });
//             setStockValidation(prev => ({ ...prev, itemStockMap: newItemStockMap }));
//         }
//     }, [allItems]);

//     // Enhanced search with debouncing
//     useEffect(() => {
//         const timer = setTimeout(() => {
//             if (barcodeInput.trim()) {
//                 filterItems(barcodeInput);
//             }
//         }, 200);
//         return () => clearTimeout(timer);
//     }, [barcodeInput]);

//     // Auto-scroll for selected search item
//     useEffect(() => {
//         if (selectedSearchIndex >= 0 && selectedItemRef.current) {
//             selectedItemRef.current.scrollIntoView({
//                 behavior: 'smooth',
//                 block: 'nearest'
//             });
//         }
//     }, [selectedSearchIndex]);

//     // Update the keyboard navigation useEffect
//     useEffect(() => {
//         const handleRowNavigation = (e) => {
//             if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
//                 const focusedElement = document.activeElement;
//                 const isInTable = focusedElement.closest('.items-table');

//                 if (isInTable && items.length > 0) {
//                     e.preventDefault();
//                     let newIndex = selectedRowIndex;

//                     if (e.key === 'ArrowDown') {
//                         newIndex = selectedRowIndex < items.length - 1 ? selectedRowIndex + 1 : 0;
//                     } else if (e.key === 'ArrowUp') {
//                         newIndex = selectedRowIndex > 0 ? selectedRowIndex - 1 : items.length - 1;
//                     }

//                     setSelectedRowIndex(newIndex);

//                     // Enhanced scrolling with visibility check
//                     setTimeout(() => {
//                         const selectedRow = document.querySelector(`tr[data-row-index="${newIndex}"]`);
//                         const itemsContainer = document.querySelector('.items-table-container');

//                         if (selectedRow && itemsContainer) {
//                             const containerRect = itemsContainer.getBoundingClientRect();
//                             const rowRect = selectedRow.getBoundingClientRect();

//                             const isRowVisible = (
//                                 rowRect.top >= containerRect.top &&
//                                 rowRect.bottom <= containerRect.bottom
//                             );

//                             if (!isRowVisible) {
//                                 selectedRow.scrollIntoView({
//                                     behavior: 'smooth',
//                                     block: 'nearest'
//                                 });
//                             }
//                         }
//                     }, 0);
//                 }
//             }

//             // Add Delete key functionality for removing items
//             if (e.key === 'Delete' && selectedRowIndex >= 0) {
//                 e.preventDefault();
//                 removeItem(selectedRowIndex);
//                 const newIndex = selectedRowIndex >= items.length - 1 ? Math.max(0, items.length - 2) : selectedRowIndex;
//                 setSelectedRowIndex(newIndex);
//             }
//         };

//         window.addEventListener('keydown', handleRowNavigation);
//         return () => window.removeEventListener('keydown', handleRowNavigation);
//     }, [selectedRowIndex, items.length]);

//     // Stock Calculation Functions
//     const calculateUsedStock = (items) => {
//         const newUsedStockMap = new Map();

//         items.forEach(item => {
//             const itemId = item.item;
//             const currentUsed = newUsedStockMap.get(itemId) || 0;
//             const itemQuantity = parseFloat(item.quantity) || 0;

//             newUsedStockMap.set(itemId, currentUsed + itemQuantity);
//         });

//         return newUsedStockMap;
//     };

//     const getAvailableStockForDisplay = (item) => {
//         if (!item) return 0;
//         return stockValidation.itemStockMap.get(item.item) || 0;
//     };

//     const getRemainingStock = (item, itemsToCheck = items) => {
//         if (!item) return 0;
//         const itemId = item.item;
//         const availableStock = stockValidation.itemStockMap.get(itemId) || 0;
//         const usedStockMap = calculateUsedStock(itemsToCheck);
//         const totalUsed = usedStockMap.get(itemId) || 0;
//         return availableStock - totalUsed;
//     };

//     const validateQuantity = (index, quantity, itemsToValidate = items) => {
//         const item = itemsToValidate[index];
//         if (!item) return true;

//         const itemId = item.item;
//         const availableStock = stockValidation.itemStockMap.get(itemId) || 0;

//         // If stock data is not available yet, skip validation
//         if (availableStock === 0 && !stockValidation.itemStockMap.has(itemId)) {
//             return true;
//         }

//         // Calculate total used quantity for this item across all items
//         const usedStockMap = calculateUsedStock(itemsToValidate);
//         const totalUsed = usedStockMap.get(itemId) || 0;

//         // The quantity is valid if it doesn't exceed available stock
//         return totalUsed <= availableStock;
//     };

//     const validateAllQuantities = (itemsToValidate = items) => {
//         const newErrors = {};

//         itemsToValidate.forEach((item, index) => {
//             const itemId = item.item;

//             // Only validate if stock data is available
//             if (stockValidation.itemStockMap.has(itemId)) {
//                 const isValid = validateQuantity(index, item.quantity, itemsToValidate);
//                 if (!isValid) {
//                     const remainingStock = getRemainingStock(item, itemsToValidate);
//                     const availableStock = getAvailableStockForDisplay(item);
//                     newErrors[index] = `Stock: ${availableStock} | Rem.: ${remainingStock}`;
//                 }
//             }
//         });

//         setQuantityErrors(newErrors);
//         return Object.keys(newErrors).length === 0;
//     };

//     const filterItems = (searchTerm) => {
//         if (!searchTerm.trim()) {
//             setFilteredItems([]);
//             setShowItemDropdown(false);
//             setSelectedSearchIndex(-1);
//             return;
//         }

//         const searchLower = searchTerm.toLowerCase();

//         const filtered = allItems.filter(item => {
//             const matchesName = item.name.toLowerCase().includes(searchLower);
//             const matchesCode = item.uniqueNumber && item.uniqueNumber.toString().includes(searchTerm);
//             const matchesBarcode = item.barcode && item.barcode.includes(searchTerm);
//             const matchesHSCode = item.hscode && item.hscode.toString().includes(searchTerm);

//             return matchesName || matchesCode || matchesBarcode || matchesHSCode;
//         })
//             .slice(0, 8) // Limit results for better performance
//             .sort((a, b) => {
//                 // Sort by relevance (exact matches first)
//                 const aNameMatch = a.name.toLowerCase().startsWith(searchLower);
//                 const bNameMatch = b.name.toLowerCase().startsWith(searchLower);

//                 if (aNameMatch && !bNameMatch) return -1;
//                 if (!aNameMatch && bNameMatch) return 1;

//                 // Then sort by stock availability
//                 const aStock = a.stockEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0;
//                 const bStock = b.stockEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0;

//                 return bStock - aStock;
//             });

//         setFilteredItems(filtered);
//         setShowItemDropdown(filtered.length > 0);
//         setSelectedSearchIndex(filtered.length > 0 ? 0 : -1);
//     };

//     // Update your keyboard shortcuts useEffect
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             const focusedElement = document.activeElement;
//             const isInputFocused = focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'TEXTAREA';

//             // If search dropdown is open, handle navigation keys
//             if (showItemDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
//                 handleSearchResultsKeyDown(e);
//                 return;
//             }

//             if (!isInputFocused) {
//                 switch (e.key) {
//                     case 'F1':
//                         e.preventDefault();
//                         barcodeInputRef.current?.focus();
//                         break;
//                     case 'F2': // Customer selection
//                         e.preventDefault();
//                         setShowAccountModal(true);
//                         break;
//                     case 'F3': // Discount shortcut
//                         e.preventDefault();
//                         setIsDiscountModalOpen(true);
//                         break;
//                     case 'F4':
//                         e.preventDefault();
//                         handleQuickPayment('exact');
//                         break;
//                     case 'F5':
//                         e.preventDefault();
//                         resetForm();
//                         break;
//                     case 'F9':
//                         e.preventDefault();
//                         setShowProductModal(prev => !prev);
//                         break;
//                     case 'F12':
//                         e.preventDefault();
//                         handleSubmit(null, true);
//                         break;
//                     case 'Escape':
//                         e.preventDefault();
//                         handleEscapeKey();
//                         break;
//                 }
//             }

//             // Additional keyboard shortcuts from second component
//             if (e.key === 'Enter' && e.target.id === 'tenderAmount') {
//                 e.preventDefault();
//                 handleSubmit(e, false);
//             }
//         };

//         window.addEventListener('keydown', handleKeyDown);
//         return () => window.removeEventListener('keydown', handleKeyDown);
//     }, [items, formData, showItemDropdown, filteredItems, selectedSearchIndex]);


//     // Add this useEffect after your existing useEffect hooks
//     useEffect(() => {
//         // Auto-scroll to the last added item when items change
//         if (items.length > 0) {
//             const timer = setTimeout(() => {
//                 const itemsContainer = document.querySelector('.items-table-container');
//                 const lastRow = document.querySelector(`tr[data-row-index="${items.length - 1}"]`);

//                 if (itemsContainer && lastRow) {
//                     lastRow.scrollIntoView({
//                         behavior: 'smooth',
//                         block: 'nearest',
//                         inline: 'nearest'
//                     });

//                     // Also select the newly added row
//                     setSelectedRowIndex(items.length - 1);
//                 }
//             }, 100);

//             return () => clearTimeout(timer);
//         }
//     }, [items.length]); // Only trigger when items count changes

//     const handleSearchResultsKeyDown = (e) => {
//         if (!showItemDropdown || filteredItems.length === 0) return;

//         switch (e.key) {
//             case 'ArrowDown':
//                 e.preventDefault();
//                 setSelectedSearchIndex(prev =>
//                     prev < filteredItems.length - 1 ? prev + 1 : 0
//                 );
//                 break;

//             case 'ArrowUp':
//                 e.preventDefault();
//                 setSelectedSearchIndex(prev =>
//                     prev > 0 ? prev - 1 : filteredItems.length - 1
//                 );
//                 break;

//             case 'Enter':
//                 e.preventDefault();
//                 if (selectedSearchIndex >= 0 && selectedSearchIndex < filteredItems.length) {
//                     addItemToBill(filteredItems[selectedSearchIndex]);
//                     setBarcodeInput('');
//                     setShowItemDropdown(false);
//                     setSelectedSearchIndex(-1);
//                 }
//                 break;

//             case 'Escape':
//                 e.preventDefault();
//                 setShowItemDropdown(false);
//                 setSelectedSearchIndex(-1);
//                 barcodeInputRef.current?.focus();
//                 break;

//             default:
//                 break;
//         }
//     };

//     const handleEscapeKey = () => {
//         setShowItemDropdown(false);
//         setBarcodeInput('');
//         setSelectedSearchIndex(-1);
//         if (barcodeInputRef.current) barcodeInputRef.current.focus();
//     };

//     const handleBarcodeScan = async (barcode) => {
//         const item = allItems.find(item =>
//             item.barcode === barcode || item.uniqueNumber === barcode
//         );
//         if (item) {
//             addItemToBill(item);
//             setNotification({ show: true, message: `"${item.name}" added`, type: 'success' });
//         }
//     };

//     // Add this function to handle smart scrolling
//     const handleAutoScroll = (newItems, previousItems) => {
//         if (newItems.length > previousItems.length) {
//             // Item was added
//             const newIndex = newItems.length - 1;

//             setTimeout(() => {
//                 const itemsContainer = document.querySelector('.items-table-container');
//                 const newRow = document.querySelector(`tr[data-row-index="${newIndex}"]`);

//                 if (itemsContainer && newRow) {
//                     // Calculate if the new row is already visible
//                     const containerRect = itemsContainer.getBoundingClientRect();
//                     const rowRect = newRow.getBoundingClientRect();

//                     const isRowVisible = (
//                         rowRect.top >= containerRect.top &&
//                         rowRect.bottom <= containerRect.bottom
//                     );

//                     if (!isRowVisible) {
//                         newRow.scrollIntoView({
//                             behavior: 'smooth',
//                             block: 'nearest'
//                         });
//                     }

//                     setSelectedRowIndex(newIndex);
//                 }
//             }, 150);
//         }
//     };

//     // Update your addItemToBill function to use the smart scroll
//     const addItemToBill = (item, batchIndex = 0) => {
//         const previousItems = [...items]; // Store current items before update

//         const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
//         if (totalStock === 0) {
//             setNotification({ show: true, message: `"${item.name}" out of stock`, type: 'error' });
//             return;
//         }

//         const sortedStockEntries = item.stockEntries.sort((a, b) =>
//             new Date(a.expiryDate || '9999-12-31') - new Date(b.expiryDate || '9999-12-31')
//         );
//         const selectedBatch = sortedStockEntries[batchIndex] || {};

//         const existingItemIndex = items.findIndex(cartItem =>
//             cartItem.item === item._id && cartItem.batchNumber === selectedBatch.batchNumber
//         );

//         if (existingItemIndex > -1) {
//             const updatedItems = [...items];
//             const newQuantity = parseFloat(updatedItems[existingItemIndex].quantity) + 1;
//             updateItemField(existingItemIndex, 'quantity', newQuantity);

//             // Scroll to existing item when quantity is increased
//             setTimeout(() => {
//                 const existingRow = document.querySelector(`tr[data-row-index="${existingItemIndex}"]`);
//                 if (existingRow) {
//                     existingRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
//                     setSelectedRowIndex(existingItemIndex);
//                 }
//             }, 100);
//         } else {
//             const newItem = {
//                 item: item._id,
//                 uniqueNumber: item.uniqueNumber || 'N/A',
//                 hscode: item.hscode,
//                 name: item.name,
//                 category: item.category?.name || 'No Category',
//                 batchNumber: selectedBatch.batchNumber || '',
//                 expiryDate: selectedBatch.expiryDate ? new Date(selectedBatch.expiryDate).toISOString().split('T')[0] : '',
//                 quantity: 1,
//                 unit: item.unit,
//                 price: Math.round(selectedBatch.price * 100) / 100 || 0,
//                 puPrice: selectedBatch.puPrice || 0,
//                 netPuPrice: selectedBatch.netPuPrice || 0,
//                 amount: Math.round(selectedBatch.price * 100) / 100 || 0,
//                 vatStatus: item.vatStatus,
//                 uniqueUuId: selectedBatch.uniqueUuId,
//                 barcode: item.barcode
//             };

//             const updatedItems = [...items, newItem];
//             setItems(updatedItems);

//             // Use smart scrolling for new items
//             handleAutoScroll(updatedItems, previousItems);

//             // Validate the new item's quantity
//             setTimeout(() => {
//                 validateAllQuantities(updatedItems);
//             }, 0);
//         }

//         // Show available stock info
//         const availableStock = stockValidation.itemStockMap.get(item._id) || 0;
//         setNotification({
//             show: true,
//             message: `"${item.name}" added. Available stock: ${availableStock}`,
//             type: 'success'
//         });

//         setShowItemDropdown(false);
//         setBarcodeInput('');
//         setSelectedSearchIndex(-1);
//         barcodeInputRef.current?.focus();
//     };

//     const updateItemField = (index, field, value) => {
//         const updatedItems = items.map((item, i) => {
//             if (i === index) {
//                 const updatedItem = { ...item, [field]: value };
//                 if (field === 'quantity' || field === 'price') {
//                     updatedItem.amount = (updatedItem.quantity * updatedItem.price).toFixed(2);
//                 }
//                 return updatedItem;
//             }
//             return item;
//         });

//         setItems(updatedItems);

//         // Validate quantity when it changes
//         if (field === 'quantity') {
//             const item = updatedItems[index];
//             const itemId = item.item;

//             // Only validate if stock data is available
//             if (stockValidation.itemStockMap.has(itemId)) {
//                 const isValid = validateQuantity(index, value, updatedItems);
//                 const remainingStock = getRemainingStock(item, updatedItems);
//                 const availableStock = getAvailableStockForDisplay(item);

//                 if (!isValid) {
//                     setQuantityErrors(prev => ({
//                         ...prev,
//                         [index]: `Stock: ${availableStock} | Rem.: ${remainingStock}`
//                     }));
//                 } else {
//                     setQuantityErrors(prev => {
//                         const newErrors = { ...prev };
//                         delete newErrors[index];
//                         return newErrors;
//                     });
//                 }
//             }
//         }

//         // Calculate discounts when items change
//         if (field === 'quantity' || field === 'price') {
//             calculateDiscounts(updatedItems);
//         }
//     };

//     const removeItem = (index) => {
//         const updatedItems = items.filter((_, i) => i !== index);
//         setItems(updatedItems);

//         // Revalidate all quantities after removal
//         setTimeout(() => {
//             validateAllQuantities(updatedItems);
//         }, 0);
//     };

//     const quickQuantityUpdate = (index, action) => {
//         const currentQuantity = parseFloat(items[index].quantity) || 0;
//         let newQuantity = currentQuantity;

//         switch (action) {
//             case 'increment': newQuantity = currentQuantity + 1; break;
//             case 'decrement': newQuantity = Math.max(1, currentQuantity - 1); break;
//             case 'double': newQuantity = currentQuantity * 2; break;
//             case 'half': newQuantity = Math.max(1, Math.round(currentQuantity / 2)); break;
//             default: return;
//         }

//         updateItemField(index, 'quantity', newQuantity);
//     };

//     // CORRECTED POS Calculations - Discount applied to all items, VAT calculated correctly
//     const calculatePOSSummary = () => {
//         const subTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
//         const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
//         const totalItems = items.length;

//         // Calculate taxable and non-taxable amounts
//         const taxableAmount = items.filter(item => item.vatStatus === 'vatable')
//             .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

//         const nonTaxableAmount = items.filter(item => item.vatStatus !== 'vatable')
//             .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

//         const discountAmount = parseFloat(formData.discountAmount) || 0;
//         const discountPercentage = parseFloat(formData.discountPercentage) || 0;

//         // Apply discount proportionally to both taxable and non-taxable amounts
//         let discountedTaxableAmount = taxableAmount;
//         let discountedNonTaxableAmount = nonTaxableAmount;
//         let discountAppliedToTaxable = 0;
//         let discountAppliedToNonTaxable = 0;

//         if (discountAmount > 0 && subTotal > 0) {
//             // Calculate discount distribution based on proportion of each type
//             const taxableRatio = taxableAmount / subTotal;
//             const nonTaxableRatio = nonTaxableAmount / subTotal;

//             discountAppliedToTaxable = discountAmount * taxableRatio;
//             discountAppliedToNonTaxable = discountAmount * nonTaxableRatio;

//             discountedTaxableAmount = Math.max(0, taxableAmount - discountAppliedToTaxable);
//             discountedNonTaxableAmount = Math.max(0, nonTaxableAmount - discountAppliedToNonTaxable);
//         }

//         // Calculate VAT on DISCOUNTED taxable amount only
//         const vatAmount = formData.isVatExempt !== 'true' ?
//             (discountedTaxableAmount * formData.vatPercentage) / 100 : 0;

//         // Calculate grand total: discounted amounts + VAT + round off
//         const grandTotalBeforeRound = discountedTaxableAmount + discountedNonTaxableAmount + vatAmount;
//         const roundOffAmount = parseFloat(formData.roundOffAmount || 0);
//         const grandTotal = grandTotalBeforeRound + roundOffAmount;

//         // Calculate change due
//         const tenderAmount = parseFloat(formData.tenderAmount || 0);
//         const changeDue = Math.max(0, tenderAmount - grandTotal);

//         return {
//             subTotal,
//             totalQuantity,
//             totalItems,
//             discountAmount,
//             taxableAmount,
//             nonTaxableAmount,
//             discountedTaxableAmount,
//             discountedNonTaxableAmount,
//             discountAppliedToTaxable,
//             discountAppliedToNonTaxable,
//             vatAmount,
//             grandTotal,
//             grandTotalBeforeRound,
//             roundOffAmount,
//             changeDue,
//             tenderAmount
//         };
//     };

//     const calculateDiscounts = (itemsToCalculate = items) => {
//         const subTotal = itemsToCalculate.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

//         if (discountType === 'percentage' && discountInput) {
//             const discountValue = parseFloat(discountInput) || 0;
//             const discountAmount = (subTotal * discountValue) / 100;
//             setFormData(prev => ({
//                 ...prev,
//                 discountAmount: Math.min(discountAmount, subTotal).toFixed(2),
//                 discountPercentage: discountValue
//             }));
//         } else if (discountType === 'amount' && discountInput) {
//             const discountAmount = parseFloat(discountInput) || 0;
//             const discountPercentage = subTotal > 0 ? (discountAmount / subTotal) * 100 : 0;
//             setFormData(prev => ({
//                 ...prev,
//                 discountAmount: Math.min(discountAmount, subTotal).toFixed(2),
//                 discountPercentage: discountPercentage.toFixed(2)
//             }));
//         }
//     };

//     const handleQuickPayment = (amount) => {
//         const summary = calculatePOSSummary();
//         let tenderAmount = 0;

//         switch (amount) {
//             case 'exact':
//                 tenderAmount = summary.grandTotal;
//                 break;
//             case 'round':
//                 tenderAmount = Math.ceil(summary.grandTotal / 10) * 10;
//                 break;
//             case 'no-discount':
//                 // Remove discount and calculate total
//                 const vatAmount = (summary.taxableAmount * formData.vatPercentage) / 100;
//                 tenderAmount = summary.subTotal + vatAmount;
//                 // Remove discount
//                 setFormData(prev => ({
//                     ...prev,
//                     discountAmount: 0,
//                     discountPercentage: 0
//                 }));
//                 setDiscountInput('');
//                 break;
//             default:
//                 tenderAmount = typeof amount === 'number' ? amount : summary.grandTotal;
//                 break;
//         }

//         setFormData(prev => ({
//             ...prev,
//             tenderAmount,
//             changeDue: Math.max(0, tenderAmount - summary.grandTotal)
//         }));

//         focusTenderAmount();
//     };


//     const handleSubmit = async (e, print = false) => {
//         if (e) e.preventDefault();

//         // Validate dates first
//         const transactionDateError = validateNepaliDate(formData.transactionDateNepali, 'transactionDateNepali');
//         const invoiceDateError = validateNepaliDate(formData.nepaliDate, 'nepaliDate');

//         if (transactionDateError || invoiceDateError) {
//             setDateErrors({
//                 transactionDateNepali: transactionDateError,
//                 nepaliDate: invoiceDateError
//             });
//             setNotification({
//                 show: true,
//                 message: 'Please fix date errors before completing sale',
//                 type: 'error'
//             });
//             return;
//         }
//         // Validate all quantities before submitting
//         const isValid = validateAllQuantities();
//         if (!isValid) {
//             setNotification({
//                 show: true,
//                 message: 'Please fix quantity errors before completing sale',
//                 type: 'error'
//             });

//             // Focus on the first error
//             const firstErrorIndex = Object.keys(quantityErrors)[0];
//             if (firstErrorIndex !== undefined) {
//                 setTimeout(() => {
//                     const errorInput = document.querySelector(`tr:nth-child(${parseInt(firstErrorIndex) + 1}) .quantity-controls input`);
//                     errorInput?.focus();
//                     errorInput?.select();
//                 }, 100);
//             }

//             return;
//         }

//         if (items.length === 0) {
//             setNotification({ show: true, message: 'Please add items to the sale', type: 'error' });
//             return;
//         }

//         setIsSaving(true);
//         try {
//             const billData = {
//                 ...formData,
//                 items: items.map(item => ({
//                     item: item.item,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     quantity: item.quantity,
//                     unit: item.unit?._id,
//                     price: item.price,
//                     puPrice: item.puPrice,
//                     netPuPrice: item.netPuPrice || item.puPrice,
//                     vatStatus: item.vatStatus,
//                     uniqueUuId: item.uniqueUuId
//                 })),
//                 print,
//                 posData: {
//                     summary: calculatePOSSummary(),
//                     timestamp: new Date().toISOString()
//                 }
//             };

//             const response = await api.post('/api/retailer/cash-sales', billData);

//             // Refresh stock data after successful sale
//             await refreshStockData();

//             setNotification({
//                 show: true,
//                 message: print ? 'Receipt printed!' : 'Sale completed!',
//                 type: 'success'
//             });

//             if (print) {
//                 navigate(`/bills/${response.data.data.bill._id}/cash/direct-print`);
//             } else {
//                 resetForm();
//             }
//         } catch (error) {
//             setNotification({
//                 show: true,
//                 message: error.response?.data?.error || 'Failed to process sale',
//                 type: 'error'
//             });
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     const resetForm = async () => {
//         try {
//             // Refresh stock data first
//             await refreshStockData();

//             const response = await api.get('/api/retailer/cash-sales');
//             const { data } = response;

//             const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//             const currentRomanDate = new Date().toISOString().split('T')[0];

//             setFormData(prev => ({
//                 ...prev,
//                 cashAccount: '',
//                 cashAccountId: '',
//                 cashAccountAddress: '',
//                 cashAccountPan: '',
//                 cashAccountEmail: '',
//                 cashAccountPhone: '',
//                 transactionDateNepali: currentNepaliDate,
//                 transactionDateRoman: currentRomanDate,
//                 nepaliDate: currentNepaliDate,
//                 billDate: currentRomanDate,
//                 billNumber: data.data.nextSalesBillNumber,
//                 tenderAmount: 0,
//                 changeDue: 0,
//                 discountAmount: 0,
//                 discountPercentage: 0,
//                 roundOffAmount: 0,
//                 isVatExempt: 'all',
//                 items: []
//             }));

//             setDateErrors({ transactionDateNepali: '', nepaliDate: '' });
//             setItems([]);
//             setQuantityErrors({}); // Clear quantity errors
//             setNextBillNumber(data.data.nextSalesBillNumber);
//             barcodeInputRef.current?.focus();
//         } catch (err) {
//             console.error('Error resetting form:', err);
//         }
//     };

//     // Add this function after your other functions
//     const focusTenderAmount = () => {
//         setTimeout(() => {
//             tenderAmountRef.current?.focus();
//             tenderAmountRef.current?.select();
//         }, 100);
//     };

//     // Updated handleAccountCreated function
//     const handleAccountCreated = async (newAccountData) => {
//         try {
//             const response = await api.get('/api/retailer/cash-sales');
//             const { data } = response;
//             const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
//             setAccounts(sortedAccounts);

//             if (newAccountData?.name) {
//                 setFormData(prev => ({
//                     ...prev,
//                     cashAccount: newAccountData.name,
//                     cashAccountId: newAccountData._id,
//                     cashAccountAddress: newAccountData.address || '',
//                     cashAccountPan: newAccountData.pan || '',
//                     cashAccountEmail: newAccountData.email || '',
//                     cashAccountPhone: newAccountData.phone || ''
//                 }));
//             }

//             setNotification({
//                 show: true,
//                 message: 'Account created and selected!',
//                 type: 'success'
//             });
//         } catch (error) {
//             console.error('Error refreshing accounts:', error);
//         }
//     };

//     // Update IMSSidebar with mart styling
//     const IMSSidebar = () => (
//         <div className="ims-sidebar" style={{
//             background: 'linear-gradient(180deg, #2c3e50 0%, #34495e 100%)',
//             borderRight: '3px solid #1abc9c'
//         }}>
//             <div className="sidebar-header" style={{
//                 padding: '20px 15px',
//                 borderBottom: '2px solid #1abc9c',
//                 background: 'rgba(0,0,0,0.2)'
//             }}>
//                 <h6 style={{
//                     color: '#ecf0f1',
//                     margin: 0,
//                     fontSize: '1.1rem',
//                     fontWeight: '700',
//                     textAlign: 'center'
//                 }}>
//                     🏪 POS ACTIONS
//                 </h6>
//             </div>
//             <div className="sidebar-content" style={{ padding: '15px 10px' }}>
//                 <button
//                     className="sidebar-btn"
//                     onClick={() => barcodeInputRef.current?.focus()}
//                     style={sidebarButtonStyle}
//                 >
//                     <span style={buttonIconStyle}>📦</span>
//                     Scan Product
//                     <small style={shortcutStyle}>(F1)</small>
//                 </button>
//                 <button
//                     className="sidebar-btn"
//                     onClick={() => setShowAccountModal(true)}
//                     style={sidebarButtonStyle}
//                 >
//                     <span style={buttonIconStyle}>👤</span>
//                     Customer
//                     <small style={shortcutStyle}>(F2)</small>
//                 </button>
//                 <button
//                     className="sidebar-btn"
//                     onClick={() => setIsDiscountModalOpen(true)}
//                     style={sidebarButtonStyle}
//                 >
//                     <span style={buttonIconStyle}>💰</span>
//                     Discount
//                     <small style={shortcutStyle}>(F3)</small>
//                 </button>
//                 <button
//                     className="sidebar-btn"
//                     onClick={() => setShowProductModal(true)}
//                     style={sidebarButtonStyle}
//                 >
//                     <span style={buttonIconStyle}>🔍</span>
//                     Product Search
//                     <small style={shortcutStyle}>(F9)</small>
//                 </button>
//                 <button
//                     className="sidebar-btn"
//                     onClick={resetForm}
//                     style={sidebarButtonStyle}
//                 >
//                     <span style={buttonIconStyle}>🆕</span>
//                     New Sale
//                     <small style={shortcutStyle}>(F5)</small>
//                 </button>
//                 <button
//                     className="sidebar-btn"
//                     onClick={() => handleSubmit(null, true)}
//                     style={{ ...sidebarButtonStyle, background: '#e74c3c' }}
//                 >
//                     <span style={buttonIconStyle}>🖨️</span>
//                     Print Receipt
//                     <small style={shortcutStyle}>(F12)</small>
//                 </button>
//             </div>

//             <div className="sidebar-footer" style={{
//                 padding: '15px',
//                 borderTop: '2px solid #1abc9c',
//                 background: 'rgba(0,0,0,0.3)'
//             }}>
//                 <div className="system-info" style={{ color: '#bdc3c7', fontSize: '0.8rem' }}>
//                     <div style={{ marginBottom: '5px' }}>
//                         <strong>Invoice:</strong> {formData.billNumber}
//                     </div>
//                     <div style={{ marginBottom: '5px' }}>
//                         <strong>Time:</strong> {new Date().toLocaleTimeString()}
//                     </div>
//                     {formData.discountAmount > 0 && (
//                         <div style={{ color: '#f39c12' }}>
//                             <strong>Discount:</strong> -{formData.discountAmount.toFixed(2)}
//                         </div>
//                     )}
//                 </div>
//             </div>
//         </div>
//     );

//     const sidebarButtonStyle = {
//         width: '100%',
//         padding: '12px 10px',
//         marginBottom: '10px',
//         background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
//         color: 'white',
//         border: 'none',
//         borderRadius: '8px',
//         fontWeight: '600',
//         fontSize: '0.9rem',
//         cursor: 'pointer',
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'space-between',
//         transition: 'all 0.3s ease',
//         boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
//     };

//     const buttonIconStyle = {
//         fontSize: '1.2rem',
//         marginRight: '8px'
//     };

//     const shortcutStyle = {
//         opacity: '0.8',
//         fontSize: '0.7rem'
//     };

//     const POSItemRow = ({ item, index, isNew = false }) => {
//         const availableStock = getAvailableStockForDisplay(item);
//         const remainingStock = getRemainingStock(item);
//         const [isHighlighted, setIsHighlighted] = useState(isNew);
//         const [localQuantity, setLocalQuantity] = useState(item.quantity.toString());
//         const [localPrice, setLocalPrice] = useState(item.price.toString());

//         const quantityInputRef = useRef(null);
//         const priceInputRef = useRef(null);
//         const rowRef = useRef(null);

//         // NEW: Track focus state
//         const [hasQuantityFocus, setHasQuantityFocus] = useState(false);
//         const [hasPriceFocus, setHasPriceFocus] = useState(false);

//         // FIX: Only sync when not focused and parent value actually changed
//         useEffect(() => {
//             if (!hasQuantityFocus) {
//                 setLocalQuantity(item.quantity.toString());
//             }
//         }, [item.quantity, hasQuantityFocus]);

//         useEffect(() => {
//             if (!hasPriceFocus) {
//                 setLocalPrice(item.price.toString());
//             }
//         }, [item.price, hasPriceFocus]);

//         // Remove highlight after animation
//         useEffect(() => {
//             if (isNew) {
//                 const timer = setTimeout(() => {
//                     setIsHighlighted(false);
//                 }, 2000);
//                 return () => clearTimeout(timer);
//             }
//         }, [isNew]);

//         // FIX: Quantity change handler - don't immediately update parent
//         const handleQuantityChange = (e) => {
//             const value = e.target.value;
//             setLocalQuantity(value);
//             // Don't update parent immediately - wait for blur or enter
//         };

//         // FIX: Price change handler - don't immediately update parent
//         const handlePriceChange = (e) => {
//             const value = e.target.value;
//             setLocalPrice(value);
//             // Don't update parent immediately - wait for blur or enter
//         };

//         // FIX: Update parent only on blur or enter
//         const updateQuantityInParent = () => {
//             if (localQuantity !== '' && localQuantity !== '0') {
//                 const numValue = parseFloat(localQuantity);
//                 if (!isNaN(numValue) && numValue > 0) {
//                     updateItemField(index, 'quantity', numValue);
//                 } else {
//                     // Reset to current value if invalid
//                     setLocalQuantity(item.quantity.toString());
//                 }
//             } else {
//                 // Reset if empty
//                 setLocalQuantity(item.quantity.toString());
//             }
//         };

//         const updatePriceInParent = () => {
//             if (localPrice !== '' && localPrice !== '0') {
//                 const numValue = parseFloat(localPrice);
//                 if (!isNaN(numValue) && numValue >= 0) {
//                     updateItemField(index, 'price', numValue);
//                 } else {
//                     setLocalPrice(item.price.toString());
//                 }
//             } else {
//                 setLocalPrice(item.price.toString());
//             }
//         };

//         // FIX: Blur handlers
//         const handleQuantityBlur = (e) => {
//             setHasQuantityFocus(false);
//             updateQuantityInParent();
//         };

//         const handlePriceBlur = (e) => {
//             setHasPriceFocus(false);
//             updatePriceInParent();
//         };

//         // FIX: Focus handlers
//         const handleQuantityFocus = (e) => {
//             setHasQuantityFocus(true);
//             e.target.select();
//             setSelectedRowIndex(index);
//         };

//         const handlePriceFocus = (e) => {
//             setHasPriceFocus(true);
//             e.target.select();
//             setSelectedRowIndex(index);
//         };

//         // FIX: Keyboard handlers
//         const handleQuantityKeyDown = (e) => {
//             if (e.key === 'Enter') {
//                 e.preventDefault();
//                 updateQuantityInParent();
//                 setHasQuantityFocus(false);
//                 // Move to price field but keep focus management
//                 setTimeout(() => {
//                     priceInputRef.current?.focus();
//                     priceInputRef.current?.select();
//                 }, 10);
//             } else if (e.key === 'Tab') {
//                 e.preventDefault();
//                 updateQuantityInParent();
//                 setHasQuantityFocus(false);
//                 if (e.shiftKey) {
//                     // Navigate to previous row's price input
//                     if (index > 0) {
//                         const prevRow = document.querySelector(`tr[data-row-index="${index - 1}"]`);
//                         const prevPriceInput = prevRow?.querySelector('.price-input');
//                         setTimeout(() => {
//                             prevPriceInput?.focus();
//                             prevPriceInput?.select();
//                         }, 10);
//                     }
//                 } else {
//                     setTimeout(() => {
//                         priceInputRef.current?.focus();
//                         priceInputRef.current?.select();
//                     }, 10);
//                 }
//             }
//         };

//         const handlePriceKeyDown = (e) => {
//             if (e.key === 'Enter') {
//                 e.preventDefault();
//                 updatePriceInParent();
//                 setHasPriceFocus(false);

//                 // Navigate to next row's quantity input or tender amount
//                 const nextRow = e.target.closest('tr').nextElementSibling;
//                 if (nextRow) {
//                     const nextQuantityInput = nextRow.querySelector('.quantity-input');
//                     setTimeout(() => {
//                         nextQuantityInput?.focus();
//                         nextQuantityInput?.select();
//                     }, 10);
//                 } else {
//                     document.getElementById('tenderAmount')?.focus();
//                     document.getElementById('tenderAmount')?.select();
//                 }
//             } else if (e.key === 'Tab') {
//                 e.preventDefault();
//                 updatePriceInParent();
//                 setHasPriceFocus(false);

//                 if (e.shiftKey) {
//                     setTimeout(() => {
//                         quantityInputRef.current?.focus();
//                         quantityInputRef.current?.select();
//                     }, 10);
//                 } else {
//                     const nextRow = e.target.closest('tr').nextElementSibling;
//                     if (nextRow) {
//                         const nextQuantityInput = nextRow.querySelector('.quantity-input');
//                         setTimeout(() => {
//                             nextQuantityInput?.focus();
//                             nextQuantityInput?.select();
//                         }, 10);
//                     } else {
//                         document.getElementById('tenderAmount')?.focus();
//                         document.getElementById('tenderAmount')?.select();
//                     }
//                 }
//             }
//         };

//         const handleQuickQuantityUpdate = (action) => {
//             const currentQuantity = parseFloat(item.quantity) || 0;
//             let newQuantity = currentQuantity;

//             switch (action) {
//                 case 'increment': newQuantity = currentQuantity + 1; break;
//                 case 'decrement': newQuantity = Math.max(1, currentQuantity - 1); break;
//                 case 'double': newQuantity = currentQuantity * 2; break;
//                 case 'half': newQuantity = Math.max(1, Math.round(currentQuantity / 2)); break;
//                 default: return;
//             }

//             updateItemField(index, 'quantity', newQuantity);
//             setLocalQuantity(newQuantity.toString());
//         };

//         return (
//             <tr
//                 ref={rowRef}
//                 className={`pos-item-row ${index === selectedRowIndex ? 'selected' : ''} ${isHighlighted ? 'newly-added' : ''}`}
//                 data-row-index={index}
//                 onClick={() => setSelectedRowIndex(index)}
//                 style={{
//                     transition: 'background-color 0.2s ease',
//                     background: index === selectedRowIndex ? '#e3f2fd' : 'transparent'
//                 }}
//             >
//                 <td className="text-center" style={{ padding: '12px 8px', fontWeight: '600' }}>{index + 1}</td>
//                 <td style={{ padding: '12px 8px' }}>
//                     <div className="item-info">
//                         <div className="item-name" style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '4px' }}>
//                             {item.name}
//                         </div>
//                         <div className="item-details" style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>
//                             {item.barcode && <span>Barcode: {item.barcode}</span>}
//                             <span>Batch: {item.batchNumber}</span>
//                             {item.expiryDate && <span>Expiry: {item.expiryDate}</span>}
//                             <div className="stock-info small text-muted" style={{ marginTop: '4px', fontWeight: '500' }}>
//                                 Stock: {availableStock} | Rem: {remainingStock}
//                             </div>
//                         </div>
//                     </div>
//                 </td>
//                 <td className="text-center" style={{ padding: '12px 8px' }}>
//                     <div className="quantity-controls" style={{
//                         display: 'flex',
//                         alignItems: 'center',
//                         justifyContent: 'center',
//                         gap: '5px'
//                     }}>
//                         <button
//                             onClick={(e) => {
//                                 e.stopPropagation();
//                                 handleQuickQuantityUpdate('decrement');
//                             }}
//                             title="Decrease quantity"
//                             style={quantityButtonStyle}
//                         >-</button>
//                         <input
//                             ref={quantityInputRef}
//                             type="number"
//                             value={localQuantity}
//                             onChange={handleQuantityChange}
//                             onBlur={handleQuantityBlur}
//                             onKeyDown={handleQuantityKeyDown}
//                             onFocus={handleQuantityFocus}
//                             onClick={(e) => e.stopPropagation()}
//                             min="1"
//                             step="1"
//                             max={availableStock}
//                             className={`quantity-input ${quantityErrors[index] ? 'error' : ''}`}
//                             placeholder="Qty"
//                             style={{
//                                 width: '70px',
//                                 padding: '8px',
//                                 border: quantityErrors[index] ? '2px solid #e74c3c' : '2px solid #bdc3c7',
//                                 borderRadius: '6px',
//                                 textAlign: 'center',
//                                 fontWeight: '600',
//                                 fontSize: '0.9rem'
//                             }}
//                         />
//                         <button
//                             onClick={(e) => {
//                                 e.stopPropagation();
//                                 handleQuickQuantityUpdate('increment');
//                             }}
//                             title="Increase quantity"
//                             style={quantityButtonStyle}
//                         >+</button>
//                     </div>
//                     {quantityErrors[index] && (
//                         <div className="quantity-error text-danger small" style={{
//                             fontSize: '0.7rem',
//                             marginTop: '4px',
//                             color: '#e74c3c',
//                             fontWeight: '600'
//                         }}>
//                             {quantityErrors[index]}
//                         </div>
//                     )}
//                 </td>
//                 <td className="text-center" style={{ padding: '12px 8px', fontWeight: '600', color: '#2c3e50' }}>
//                     {item.unit?.name}
//                 </td>
//                 <td className="text-end" style={{ padding: '12px 8px' }}>
//                     <input
//                         ref={priceInputRef}
//                         type="number"
//                         value={localPrice}
//                         onChange={handlePriceChange}
//                         onBlur={handlePriceBlur}
//                         onKeyDown={handlePriceKeyDown}
//                         onFocus={handlePriceFocus}
//                         onClick={(e) => e.stopPropagation()}
//                         step="0.01"
//                         min="0"
//                         className="price-input"
//                         placeholder="0.00"
//                         style={{
//                             width: '100%',
//                             padding: '8px',
//                             border: '2px solid #3498db',
//                             borderRadius: '6px',
//                             textAlign: 'right',
//                             fontWeight: '600',
//                             fontSize: '0.9rem'
//                         }}
//                     />
//                 </td>
//                 <td className="text-end amount-cell" style={{
//                     padding: '12px 8px',
//                     fontWeight: '700',
//                     color: '#27ae60',
//                     fontSize: '1rem'
//                 }}>
//                     {parseFloat(item.amount || 0).toFixed(2)}
//                 </td>
//                 <td className="text-center" style={{ padding: '12px 8px' }}>
//                     <button
//                         className="btn-remove"
//                         onClick={(e) => {
//                             e.stopPropagation();
//                             removeItem(index);
//                             setSelectedRowIndex(-1);
//                         }}
//                         title="Remove item"
//                         style={{
//                             background: '#e74c3c',
//                             border: 'none',
//                             color: 'white',
//                             borderRadius: '6px',
//                             width: '30px',
//                             height: '30px',
//                             fontSize: '0.9rem',
//                             cursor: 'pointer',
//                             display: 'flex',
//                             alignItems: 'center',
//                             justifyContent: 'center'
//                         }}
//                     >
//                         🗑️
//                     </button>
//                 </td>
//             </tr>
//         );
//     };
//     const quantityButtonStyle = {
//         background: '#3498db',
//         border: 'none',
//         color: 'white',
//         borderRadius: '6px',
//         width: '30px',
//         height: '30px',
//         fontSize: '1rem',
//         fontWeight: 'bold',
//         cursor: 'pointer',
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'center'
//     };
//     // Add a function to handle row focus and scrolling
//     const scrollToRow = (index) => {
//         setTimeout(() => {
//             const rowElement = document.querySelector(`tr[data-row-index="${index}"]`);
//             if (rowElement) {
//                 rowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
//             }
//         }, 100);
//     };

//     // Date validation functions
//     const validateNepaliDate = (dateStr, fieldName) => {
//         try {
//             if (!dateStr.trim()) {
//                 return 'Date is required';
//             }

//             // Validate format YYYY-MM-DD
//             if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
//                 return 'Invalid format. Use YYYY-MM-DD';
//             }

//             const [year, month, day] = dateStr.split('-').map(Number);

//             // Basic validation
//             if (year < 2000 || year > 2099) return "Year must be between 2000-2099";
//             if (month < 1 || month > 12) return "Month must be between 1-12";
//             if (day < 1 || day > 32) return "Day must be between 1-32";

//             // Try to create Nepali date object for validation
//             const nepaliDate = new NepaliDate(year, month - 1, day);

//             // Verify the date is valid
//             if (
//                 nepaliDate.getYear() !== year ||
//                 nepaliDate.getMonth() + 1 !== month ||
//                 nepaliDate.getDate() !== day
//             ) {
//                 return "Invalid Nepali date";
//             }

//             return ''; // No error
//         } catch (error) {
//             return error.message || 'Invalid date';
//         }
//     };

//     const handleDateBlur = (fieldName) => {
//         const dateValue = formData[fieldName];
//         const error = validateNepaliDate(dateValue, fieldName);

//         setDateErrors(prev => ({
//             ...prev,
//             [fieldName]: error
//         }));

//         // If valid, also update the Roman date
//         if (!error && dateValue) {
//             try {
//                 const [year, month, day] = dateValue.split('-').map(Number);
//                 const nepaliDate = new NepaliDate(year, month - 1, day);
//                 const englishDate = nepaliDate.toJsDate();
//                 const romanDate = englishDate.toISOString().split('T')[0];

//                 if (fieldName === 'transactionDateNepali') {
//                     setFormData(prev => ({
//                         ...prev,
//                         transactionDateRoman: romanDate
//                     }));
//                 } else if (fieldName === 'nepaliDate') {
//                     setFormData(prev => ({
//                         ...prev,
//                         billDate: romanDate
//                     }));
//                 }
//             } catch (error) {
//                 console.error('Error converting date:', error);
//             }
//         }
//     };



//     return (
//         <div className="ims-container" style={{ background: '#ecf0f1', minHeight: '100vh' }}>
//             <Header />

//             <div className="ims-layout" style={{ display: 'flex', minHeight: 'calc(100vh - 70px)' }}>
//                 <IMSSidebar />

//                 <div className="ims-main-content" style={{ flex: 1, background: '#f8f9fa' }}>
//                     {/* Top Bar - Mart Style */}
//                     <div className="ims-top-bar" style={{
//                         background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
//                         padding: '15px 25px',
//                         borderBottom: '3px solid #149174',
//                         boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
//                     }}>
//                         <div className="top-bar-left">
//                             <div className="session-info" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
//                                 <span className="badge" style={{
//                                     background: '#e74c3c',
//                                     padding: '8px 15px',
//                                     borderRadius: '20px',
//                                     fontSize: '0.9rem',
//                                     fontWeight: '700'
//                                 }}>
//                                     🧾 Invoice: {formData.billNumber}
//                                 </span>
//                                 <span className="time-display" style={{
//                                     color: 'white',
//                                     fontWeight: '600',
//                                     fontSize: '1rem'
//                                 }}>
//                                     ⏰ {new Date().toLocaleTimeString()}
//                                 </span>
//                             </div>
//                         </div>
//                         <div className="top-bar-right">
//                             <div className="quick-stats" style={{ display: 'flex', gap: '15px', color: 'white' }}>
//                                 <span style={{
//                                     background: 'rgba(255,255,255,0.2)',
//                                     padding: '5px 12px',
//                                     borderRadius: '15px',
//                                     fontWeight: '600'
//                                 }}>
//                                     🛒 {items.length} Items
//                                 </span>
//                                 <span style={{
//                                     background: 'rgba(255,255,255,0.2)',
//                                     padding: '5px 12px',
//                                     borderRadius: '15px',
//                                     fontWeight: '600'
//                                 }}>
//                                     💰 {calculatePOSSummary().grandTotal.toFixed(2)}
//                                 </span>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Main Content Grid */}
//                     <div className="ims-grid" style={{
//                         display: 'grid',
//                         gridTemplateColumns: '1fr 400px',
//                         gap: '0',
//                         height: 'calc(100vh - 140px)'
//                     }}>

// {/* Products Panel - Mart Style */ }
// <div className="products-panel" style={{
//     background: 'white',
//     borderRight: '3px solid #bdc3c7',
//     display: 'flex',
//     flexDirection: 'column'
// }}>
//     <div className="panel-header" style={{
//         padding: '20px',
//         borderBottom: '2px solid #ecf0f1',
//         background: 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
//     }}>
//         <h5 style={{
//             color: 'white',
//             margin: '0 0 15px 0',
//             fontSize: '1.3rem',
//             fontWeight: '700'
//         }}>
//             🏪 PRODUCTS
//         </h5>
//         <div className="search-container">
//             <div className="search-box" style={{
//                 position: 'relative',
//                 display: 'flex',
//                 alignItems: 'center'
//             }}>
//                 <span style={{
//                     position: 'absolute',
//                     left: '15px',
//                     fontSize: '1.2rem',
//                     color: '#7f8c8d'
//                 }}>🔍</span>
//                 <input
//                     type="text"
//                     placeholder="Scan barcode or search products..."
//                     value={barcodeInput}
//                     onChange={(e) => {
//                         setBarcodeInput(e.target.value);
//                         filterItems(e.target.value);
//                     }}
//                     onFocus={() => {
//                         if (barcodeInput.length > 0) {
//                             filterItems(barcodeInput);
//                         }
//                     }}
//                     ref={barcodeInputRef}
//                     className="search-input"
//                     style={{
//                         width: '100%',
//                         padding: '12px 12px 12px 45px',
//                         border: '2px solid #3498db',
//                         borderRadius: '25px',
//                         fontSize: 'rem',
//                         fontWeight: '500',
//                         boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
//                     }}
//                 />
//                 <button
//                     className="btn-search-advanced"
//                     onClick={() => setShowProductModal(true)}
//                     title="Advanced search"
//                     style={{
//                         position: 'absolute',
//                         right: '10px',
//                         background: '#3498db',
//                         border: 'none',
//                         color: 'white',
//                         borderRadius: '50%',
//                         width: '35px',
//                         height: '35px',
//                         fontSize: '1rem'
//                     }}
//                 >
//                     ⚙️
//                 </button>
//             </div>

//             {/* Search Results Dropdown */}
//             {showItemDropdown && filteredItems.length > 0 && (
//                 <div
//                     className="search-results-dropdown"
//                     onKeyDown={handleSearchResultsKeyDown}
//                     style={{
//                         position: 'absolute',
//                         top: '100%',
//                         left: '20px',
//                         right: '20px',
//                         background: 'white',
//                         border: '2px solid #3498db',
//                         borderRadius: '10px',
//                         boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
//                         zIndex: 1000,
//                         maxHeight: '300px',
//                         overflowY: 'auto'
//                     }}
//                 >
//                     <div className="dropdown-header" style={{
//                         padding: '10px 15px',
//                         background: '#34495e',
//                         color: 'white',
//                         display: 'flex',
//                         justifyContent: 'space-between',
//                         alignItems: 'center',
//                         borderTopLeftRadius: '8px',
//                         borderTopRightRadius: '8px'
//                     }}>
//                         <span>Search Results ({filteredItems.length})</span>
//                         <button
//                             className="btn-close-dropdown"
//                             onClick={() => {
//                                 setShowItemDropdown(false);
//                                 setSelectedSearchIndex(-1);
//                             }}
//                             style={{
//                                 background: 'none',
//                                 border: 'none',
//                                 color: 'white',
//                                 fontSize: '1.2rem'
//                             }}
//                         >
//                             ✕
//                         </button>
//                     </div>
//                     <div className="dropdown-content">
//                         {filteredItems.map((item, index) => (
//                             <div
//                                 key={item._id}
//                                 className={`search-result-item ${index === selectedSearchIndex ? 'selected' : ''}`}
//                                 onClick={() => {
//                                     addItemToBill(item);
//                                     setBarcodeInput('');
//                                     setShowItemDropdown(false);
//                                     setSelectedSearchIndex(-1);
//                                 }}
//                                 ref={index === selectedSearchIndex ? selectedItemRef : null}
//                                 style={{
//                                     padding: '12px 15px',
//                                     borderBottom: '1px solid #ecf0f1',
//                                     cursor: 'pointer',
//                                     display: 'flex',
//                                     justifyContent: 'space-between',
//                                     alignItems: 'center',
//                                     background: index === selectedSearchIndex ? '#e3f2fd' : 'white',
//                                     transition: 'background 0.2s ease'
//                                 }}
//                             >
//                                 <div className="product-info">
//                                     <div className="product-name" style={{
//                                         fontWeight: '600',
//                                         color: '#2c3e50',
//                                         marginBottom: '3px'
//                                     }}>
//                                         {item.name}
//                                     </div>
//                                     <div className="product-details" style={{
//                                         fontSize: '0.8rem',
//                                         color: '#7f8c8d',
//                                         display: 'flex',
//                                         gap: '10px'
//                                     }}>
//                                         <span>Code: {item.uniqueNumber}</span>
//                                         <span>Price: {item.stockEntries?.[0]?.price || 0}</span>
//                                         <span>Stock: {item.stockEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0}</span>
//                                     </div>
//                                 </div>
//                                 <div
//                                     className="add-indicator"
//                                     onClick={(e) => {
//                                         e.stopPropagation();
//                                         setSelectedProductForStock(item);
//                                         setShowStockAdjustmentModal(true);
//                                         setShowItemDropdown(false);
//                                         setSelectedSearchIndex(-1);
//                                     }}
//                                     title="Add stock for this product"
//                                     style={{
//                                         color: '#27ae60',
//                                         fontSize: '1.2rem',
//                                         padding: '5px'
//                                     }}
//                                 >
//                                     ➕
//                                 </div>
//                             </div>
//                         ))}
//                     </div>
//                 </div>
//             )}
//         </div>
//     </div>

//     <div className="products-content" style={{ flex: 1, overflow: 'hidden' }}>
//         {items.length === 0 ? (
//             <div className="empty-state" style={{
//                 display: 'flex',
//                 flexDirection: 'column',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 height: '100%',
//                 color: '#7f8c8d'
//             }}>
//                 <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🛒</div>
//                 <p style={{ fontSize: '1.2rem', marginBottom: '10px', fontWeight: '600' }}>No items added</p>
//                 <small>Scan barcode or search products to begin</small>
//                 {filteredItems.length === 0 && barcodeInput.length > 2 && (
//                     <div className="no-results" style={{ marginTop: '20px', textAlign: 'center' }}>
//                         <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔍</div>
//                         <p>No products found for "{barcodeInput}"</p>
//                     </div>
//                 )}
//             </div>
//         ) : (
//             <div className="items-table-container" style={{ height: '100%', overflow: 'auto' }}>
//                 <table className="items-table" style={{
//                     width: '100%',
//                     borderCollapse: 'collapse'
//                 }}>
//                     <thead style={{
//                         background: 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)',
//                         position: 'sticky',
//                         top: 0,
//                         zIndex: 10
//                     }}>
//                         <tr>
//                             <th width="5%" style={{
//                                 padding: '12px 8px',
//                                 color: 'black',
//                                 fontWeight: '600',
//                                 textAlign: 'center',
//                                 borderRight: '1px solid #46627f'
//                             }}>#</th>
//                             <th width="35%" style={{
//                                 padding: '12px 8px',
//                                 color: 'black',
//                                 fontWeight: '600',
//                                 borderRight: '1px solid #46627f'
//                             }}>Product</th>
//                             <th width="15%" style={{
//                                 padding: '12px 8px',
//                                 color: 'black',
//                                 fontWeight: '600',
//                                 textAlign: 'center',
//                                 borderRight: '1px solid #46627f'
//                             }}>Qty</th>
//                             <th width="10%" style={{
//                                 padding: '12px 8px',
//                                 color: 'black',
//                                 fontWeight: '600',
//                                 textAlign: 'center',
//                                 borderRight: '1px solid #46627f'
//                             }}>Unit</th>
//                             <th width="15%" style={{
//                                 padding: '12px 8px',
//                                 color: 'black',
//                                 fontWeight: '600',
//                                 textAlign: 'center',
//                                 borderRight: '1px solid #46627f'
//                             }}>Price</th>
//                             <th width="15%" style={{
//                                 padding: '12px 8px',
//                                 color: 'black',
//                                 fontWeight: '600',
//                                 textAlign: 'center',
//                                 borderRight: '1px solid #46627f'
//                             }}>Amount</th>
//                             <th width="5%" style={{
//                                 padding: '12px 8px',
//                                 color: 'black',
//                                 fontWeight: '600',
//                                 textAlign: 'center'
//                             }}></th>
//                         </tr>
//                     </thead>
//                     <tbody>
//                         {items.map((item, index) => (
//                             <POSItemRow
//                                 key={index}
//                                 item={item}
//                                 index={index}
//                                 isNew={index === items.length - 1}
//                             />
//                         ))}
//                     </tbody>
//                 </table>
//             </div>
//         )}
//     </div>
// </div>

//             {/* Transaction Panel - Mart Style */}
//             <div className="transaction-panel" style={{
//                 background: 'white',
//                 display: 'flex',
//                 flexDirection: 'column',
//                 borderLeft: '3px solid #bdc3c7'
//             }}>
//                 <div className="panel-header" style={{
//                     padding: '20px',
//                     borderBottom: '2px solid #ecf0f1',
//                     background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'
//                 }}>
//                     <h5 style={{
//                         color: 'white',
//                         margin: 0,
//                         fontSize: '1.3rem',
//                         fontWeight: '700'
//                     }}>
//                         💰 TRANSACTION
//                     </h5>
//                 </div>

//                 <div className="transaction-content" style={{
//                     flex: 1,
//                     padding: '20px',
//                     overflowY: 'auto',
//                     display: 'flex',
//                     flexDirection: 'column',
//                     gap: '20px'
//                 }}>
//                     {/* Date Selection Section */}
//                     <div className="date-section">
//                         <label style={{
//                             display: 'block',
//                             marginBottom: '8px',
//                             fontWeight: '600',
//                             color: '#2c3e50'
//                         }}>📅 Date Selection</label>

//                         <div className="date-input-group" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
//                             <div style={{ flex: 1 }}>
//                                 <label className="small" style={{ marginBottom: '4px', display: 'block' }}>
//                                     Transaction Date
//                                 </label>
//                                 <input
//                                     type="text"
//                                     value={formData.transactionDateNepali}
//                                     onChange={(e) => {
//                                         setFormData(prev => ({ ...prev, transactionDateNepali: e.target.value }));
//                                         setDateErrors(prev => ({ ...prev, transactionDateNepali: '' }));
//                                     }}
//                                     onBlur={() => handleDateBlur('transactionDateNepali')}
//                                     onFocus={() => setShowDatePicker(true)}
//                                     placeholder="YYYY-MM-DD"
//                                     style={{
//                                         width: '100%',
//                                         padding: '8px',
//                                         border: dateErrors.transactionDateNepali ? '2px solid #e74c3c' : '2px solid #bdc3c7',
//                                         borderRadius: '6px',
//                                         fontSize: '0.9rem'
//                                     }}
//                                 />
//                             </div>

//                             <div style={{ flex: 1 }}>
//                                 <label className="small" style={{ marginBottom: '4px', display: 'block' }}>
//                                     Invoice Date
//                                 </label>
//                                 <input
//                                     type="text"
//                                     value={formData.nepaliDate}
//                                     onChange={(e) => {
//                                         setFormData(prev => ({ ...prev, nepaliDate: e.target.value }));
//                                         setDateErrors(prev => ({ ...prev, nepaliDate: '' }));
//                                     }}
//                                     onBlur={() => handleDateBlur('nepaliDate')}
//                                     onFocus={() => setShowDatePicker(true)}
//                                     placeholder="YYYY-MM-DD"
//                                     style={{
//                                         width: '100%',
//                                         padding: '8px',
//                                         border: dateErrors.nepaliDate ? '2px solid #e74c3c' : '2px solid #bdc3c7',
//                                         borderRadius: '6px',
//                                         fontSize: '0.9rem'
//                                     }}
//                                 />
//                             </div>
//                         </div>

//                         {dateErrors.transactionDateNepali && (
//                             <div className="text-danger small" style={{ color: '#e74c3c', fontSize: '0.8rem' }}>
//                                 {dateErrors.transactionDateNepali}
//                             </div>
//                         )}
//                         {dateErrors.nepaliDate && (
//                             <div className="text-danger small" style={{ color: '#e74c3c', fontSize: '0.8rem' }}>
//                                 {dateErrors.nepaliDate}
//                             </div>
//                         )}
//                     </div>
//                     {/* Customer Section */}
//                     <div className="customer-section">
//                         <label style={{
//                             display: 'block',
//                             marginBottom: '8px',
//                             fontWeight: '600',
//                             color: '#2c3e50'
//                         }}>👤 Customer</label>
//                         <div className="customer-input-group" style={{ display: 'flex', gap: '10px' }}>
//                             <input
//                                 type="text"
//                                 placeholder="Search customer..."
//                                 value={formData.cashAccount}
//                                 onChange={(e) => setFormData(prev => ({
//                                     ...prev,
//                                     cashAccount: e.target.value
//                                 }))}
//                                 onFocus={() => setShowAccountModal(true)}
//                                 style={{
//                                     flex: 1,
//                                     padding: '10px 15px',
//                                     border: '2px solid #3498db',
//                                     borderRadius: '8px',
//                                     fontSize: '0.9rem',
//                                     fontWeight: '500'
//                                 }}
//                             />
//                             <button
//                                 className="btn-customer-add"
//                                 onClick={() => setShowAccountCreationModal(true)}
//                                 title="Add New Customer"
//                                 style={{
//                                     background: '#27ae60',
//                                     border: 'none',
//                                     color: 'white',
//                                     borderRadius: '8px',
//                                     padding: '10px 15px',
//                                     fontSize: '1.1rem',
//                                     cursor: 'pointer'
//                                 }}
//                             >
//                                 👥
//                             </button>
//                         </div>
//                     </div>

//                     {/* Sales Summary - Mart Style */}
//                     <div className="sales-summary-panel compact" style={{
//                         background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
//                         padding: '15px',
//                         borderRadius: '10px',
//                         border: '2px solid #dee2e6'
//                     }}>
//                         <div className="summary-header" style={{
//                             display: 'flex',
//                             justifyContent: 'space-between',
//                             alignItems: 'center',
//                             marginBottom: '15px'
//                         }}>
//                             <h6 style={{
//                                 margin: 0,
//                                 color: '#2c3e50',
//                                 fontWeight: '700',
//                                 fontSize: '1.1rem'
//                             }}>📊 SALE SUMMARY</h6>
//                             <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
//                                 <span className="items-count" style={{
//                                     background: '#3498db',
//                                     color: 'white',
//                                     padding: '3px 8px',
//                                     borderRadius: '12px',
//                                     fontSize: '0.8rem',
//                                     fontWeight: '600'
//                                 }}>{items.length} items</span>
//                                 <button
//                                     className="btn-discount"
//                                     onClick={() => setIsDiscountModalOpen(true)}
//                                     title="Apply Discount"
//                                     style={{
//                                         background: '#f39c12',
//                                         border: 'none',
//                                         color: 'white',
//                                         borderRadius: '50%',
//                                         width: '30px',
//                                         height: '30px',
//                                         fontSize: '0.9rem',
//                                         cursor: 'pointer'
//                                     }}
//                                 >
//                                     💰
//                                 </button>
//                             </div>
//                         </div>
//                         <div className="summary-grid compact">
//                             <div className="summary-row" style={summaryRowStyle}>
//                                 <span>Subtotal:</span>
//                                 <span className="amount" style={amountStyle}>{calculatePOSSummary().subTotal.toFixed(2)}</span>
//                             </div>

//                             {(formData.discountAmount > 0) && (
//                                 <div className="summary-row discount" style={summaryRowStyle}>
//                                     <span>
//                                         Discount{formData.discountPercentage > 0 && ` (${formData.discountPercentage}%)`}:
//                                     </span>
//                                     <span className="amount text-danger" style={{ ...amountStyle, color: '#e74c3c' }}>
//                                         -{calculatePOSSummary().discountAmount.toFixed(2)}
//                                     </span>
//                                 </div>
//                             )}

//                             <div className="summary-row" style={summaryRowStyle}>
//                                 <span>VAT ({formData.vatPercentage}%):</span>
//                                 <span className="amount" style={amountStyle}>{calculatePOSSummary().vatAmount.toFixed(2)}</span>
//                             </div>

//                             {calculatePOSSummary().roundOffAmount !== 0 && (
//                                 <div className="summary-row" style={summaryRowStyle}>
//                                     <span>Round Off:</span>
//                                     <span className="amount" style={amountStyle}>{calculatePOSSummary().roundOffAmount.toFixed(2)}</span>
//                                 </div>
//                             )}

//                             <div className="summary-row total" style={{
//                                 ...summaryRowStyle,
//                                 borderTop: '2px solid #bdc3c7',
//                                 paddingTop: '10px',
//                                 fontWeight: '700',
//                                 fontSize: '1.1rem'
//                             }}>
//                                 <span>Grand Total:</span>
//                                 <span className="amount" style={{
//                                     ...amountStyle,
//                                     color: '#27ae60',
//                                     fontSize: '1.2rem'
//                                 }}>{calculatePOSSummary().grandTotal.toFixed(2)}</span>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Payment Section - Mart Style */}
//                     <div className="payment-section compact">
//                         <div className="payment-header" style={{ marginBottom: '15px' }}>
//                             <h6 style={{
//                                 margin: 0,
//                                 color: '#2c3e50',
//                                 fontWeight: '700',
//                                 fontSize: '1.1rem'
//                             }}>💳 PAYMENT</h6>
//                         </div>

//                         <div className="payment-grid" style={{
//                             display: 'grid',
//                             gridTemplateColumns: '1fr 1fr',
//                             gap: '15px',
//                             marginBottom: '15px'
//                         }}>
//                             <div className="payment-group">
//                                 <label htmlFor="tenderAmount" style={{
//                                     display: 'block',
//                                     marginBottom: '5px',
//                                     fontWeight: '600',
//                                     color: '#2c3e50'
//                                 }}>Tender Amount</label>
//                                 <input
//                                     ref={tenderAmountRef}
//                                     type="number"
//                                     id="tenderAmount"
//                                     value={formData.tenderAmount}
//                                     onChange={(e) => setFormData(prev => ({
//                                         ...prev,
//                                         tenderAmount: parseFloat(e.target.value) || 0,
//                                         changeDue: Math.max(0, parseFloat(e.target.value) - calculatePOSSummary().grandTotal)
//                                     }))}
//                                     placeholder="0.00"
//                                     className="tender-input"
//                                     style={{
//                                         width: '100%',
//                                         padding: '10px',
//                                         border: '2px solid #27ae60',
//                                         borderRadius: '8px',
//                                         fontSize: '1rem',
//                                         fontWeight: '600',
//                                         textAlign: 'center'
//                                     }}
//                                 />
//                             </div>

//                             <div className="payment-group">
//                                 <label style={{
//                                     display: 'block',
//                                     marginBottom: '5px',
//                                     fontWeight: '600',
//                                     color: '#2c3e50'
//                                 }}>Change Due</label>
//                                 <div className={`change-amount ${calculatePOSSummary().changeDue > 0 ? 'has-change' : ''}`}
//                                     style={{
//                                         width: '100%',
//                                         padding: '10px',
//                                         background: calculatePOSSummary().changeDue > 0 ? '#d4edda' : '#f8f9fa',
//                                         border: `2px solid ${calculatePOSSummary().changeDue > 0 ? '#27ae60' : '#6c757d'}`,
//                                         borderRadius: '8px',
//                                         fontSize: '1rem',
//                                         fontWeight: '700',
//                                         textAlign: 'center',
//                                         color: calculatePOSSummary().changeDue > 0 ? '#155724' : '#6c757d'
//                                     }}
//                                 >
//                                     {calculatePOSSummary().changeDue.toFixed(2)}
//                                 </div>
//                             </div>
//                         </div>

//                         <div className="payment-method-group" style={{ marginBottom: '15px' }}>
//                             <label htmlFor="paymentMode" style={{
//                                 display: 'block',
//                                 marginBottom: '5px',
//                                 fontWeight: '600',
//                                 color: '#2c3e50'
//                             }}>Payment Method</label>
//                             <select
//                                 id="paymentMode"
//                                 value={formData.paymentMode}
//                                 onChange={(e) => setFormData(prev => ({ ...prev, paymentMode: e.target.value }))}
//                                 className="payment-select"
//                                 style={{
//                                     width: '100%',
//                                     padding: '10px',
//                                     border: '2px solid #3498db',
//                                     borderRadius: '8px',
//                                     fontSize: '0.9rem',
//                                     fontWeight: '500'
//                                 }}
//                             >
//                                 <option value="cash">💵 Cash</option>
//                             </select>
//                         </div>

//                         {/* Quick Payment Buttons */}
//                         <div className="quick-payment-buttons" style={{
//                             display: 'grid',
//                             gridTemplateColumns: '1fr 1fr',
//                             gap: '10px',
//                             marginBottom: '15px'
//                         }}>
//                             <button
//                                 className="btn-quick-payment"
//                                 onClick={() => handleQuickPayment('exact')}
//                                 title="Set tender amount to grand total"
//                                 style={quickPaymentButtonStyle}
//                             >
//                                 Exact
//                             </button>
//                             <button
//                                 className="btn-quick-payment"
//                                 onClick={() => handleQuickPayment('round')}
//                                 title="Round up to nearest 10"
//                                 style={quickPaymentButtonStyle}
//                             >
//                                 Round Up
//                             </button>
//                             <button
//                                 className="btn-quick-payment"
//                                 onClick={() => handleQuickPayment(1000)}
//                                 title="Set tender amount to 1000"
//                                 style={quickPaymentButtonStyle}
//                             >
//                                 1000
//                             </button>
//                             <button
//                                 className="btn-quick-payment btn-discount"
//                                 onClick={() => setIsDiscountModalOpen(true)}
//                                 title="Apply Discount"
//                                 style={{ ...quickPaymentButtonStyle, background: '#f39c12' }}
//                             >
//                                 💰 Discount
//                             </button>
//                         </div>
//                     </div>

//                     {/* Action Buttons - Mart Style */}
//                     <div className="action-buttons compact" style={{ marginTop: 'auto' }}>
//                         <div className="primary-actions" style={{ marginBottom: '10px' }}>
//                             <button
//                                 className="btn-complete-sale"
//                                 onClick={(e) => handleSubmit(e, false)}
//                                 disabled={isSaving || items.length === 0}
//                                 style={{
//                                     width: '100%',
//                                     padding: '15px',
//                                     background: isSaving ? '#95a5a6' : 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
//                                     color: 'white',
//                                     border: 'none',
//                                     borderRadius: '10px',
//                                     fontSize: '1.1rem',
//                                     fontWeight: '700',
//                                     cursor: items.length === 0 ? 'not-allowed' : 'pointer',
//                                     display: 'flex',
//                                     alignItems: 'center',
//                                     justifyContent: 'center',
//                                     gap: '10px',
//                                     boxShadow: '0 3px 6px rgba(0,0,0,0.2)'
//                                 }}
//                             >
//                                 {isSaving ? (
//                                     <>
//                                         <span>⏳</span>
//                                         <span>Processing...</span>
//                                     </>
//                                 ) : (
//                                     <>
//                                         <span>✅</span>
//                                         <span>Complete Sale</span>
//                                         <small style={{ opacity: '0.8', fontSize: '0.8rem' }}>(Enter)</small>
//                                     </>
//                                 )}
//                             </button>
//                         </div>

//                         <div className="secondary-actions compact" style={{
//                             display: 'grid',
//                             gridTemplateColumns: '1fr 1fr',
//                             gap: '10px'
//                         }}>
//                             <button
//                                 className="btn-print"
//                                 onClick={(e) => handleSubmit(e, true)}
//                                 disabled={isSaving || items.length === 0}
//                                 title="Print Receipt (F12)"
//                                 style={secondaryButtonStyle}
//                             >
//                                 🖨️ Print
//                                 <small style={shortcutStyle}>F12</small>
//                             </button>

//                             <button
//                                 className="btn-clear"
//                                 onClick={resetForm}
//                                 title="New Sale (F5)"
//                                 style={secondaryButtonStyle}
//                             >
//                                 🆕 Clear
//                                 <small style={shortcutStyle}>F5</small>
//                             </button>
//                         </div>
//                     </div>

//                     {/* Transaction Status Bar */}
//                     <div className="transaction-status" style={{
//                         display: 'flex',
//                         justifyContent: 'space-between',
//                         padding: '10px',
//                         background: '#34495e',
//                         borderRadius: '8px',
//                         color: 'white',
//                         fontSize: '0.8rem',
//                         marginTop: '10px'
//                     }}>
//                         <div className="status-item">
//                             <span className="status-label">Invoice:</span>
//                             <span className="status-value" style={{ fontWeight: '600' }}>{formData.billNumber}</span>
//                         </div>
//                         <div className="status-item">
//                             <span className="status-label">Time:</span>
//                             <span className="status-value" style={{ fontWeight: '600' }}>{new Date().toLocaleTimeString()}</span>
//                         </div>
//                         <div className="status-item">
//                             <span className="status-label">Status:</span>
//                             <span className={`status-value ${items.length > 0 ? 'active' : 'inactive'}`}
//                                 style={{
//                                     fontWeight: '600',
//                                     color: items.length > 0 ? '#27ae60' : '#f39c12'
//                                 }}
//                             >
//                                 {items.length > 0 ? 'Active' : 'Ready'}
//                             </span>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     </div>
// </div>

//             {/* Account Modal */}
//             {showAccountModal && (
//                 <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block' }}>
//                     <div className="modal-dialog modal-xl modal-dialog-centered">
//                         <div className="modal-content" style={{ height: '500px' }}>
//                             <div className="modal-header">
//                                 <h5 className="modal-title" id="accountModalLabel">Select or Enter Cash Account</h5>
//                                 <button
//                                     type="button"
//                                     className="btn-close"
//                                     onClick={() => {
//                                         setShowAccountModal(false);
//                                         focusTenderAmount(); // Focus on tender amount when closing modal
//                                     }}
//                                 ></button>
//                             </div>
//                             <div className="p-3 bg-white sticky-top">
//                                 <input
//                                     type="text"
//                                     id="searchAccount"
//                                     autoComplete='off'
//                                     className="form-control form-control-lg"
//                                     placeholder="Type to search or enter new account name"
//                                     autoFocus
//                                     value={formData.cashAccount}
//                                     onChange={(e) => {
//                                         const value = e.target.value;
//                                         setFormData(prev => ({
//                                             ...prev,
//                                             cashAccount: value,
//                                             cashAccountAddress: '',
//                                             cashAccountPhone: ''
//                                         }));

//                                         // Filter accounts based on search
//                                         if (value === '') {
//                                             setFilteredAccounts([]);
//                                         } else {
//                                             const filtered = accounts.filter(account =>
//                                                 account.name.toLowerCase().includes(value.toLowerCase())
//                                             );
//                                             setFilteredAccounts(filtered);
//                                         }
//                                     }}
//                                     onKeyDown={(e) => {
//                                         if (e.key === 'ArrowDown') {
//                                             e.preventDefault();
//                                             const firstAccountItem = document.querySelector('.account-item');
//                                             if (firstAccountItem) {
//                                                 firstAccountItem.focus();
//                                             }
//                                         } else if (e.key === 'Enter') {
//                                             e.preventDefault();
//                                             // Always use the typed text when pressing Enter in the input
//                                             setShowAccountModal(false);
//                                             focusTenderAmount();
//                                             setTimeout(() => {
//                                                 addressRef.current?.focus();
//                                             }, 100);
//                                         }
//                                     }}
//                                     ref={accountSearchRef}
//                                 />
//                             </div>
//                             <div className="modal-body p-0">
//                                 <div className="overflow-auto" style={{ height: 'calc(400px - 120px)' }}>
//                                     <ul id="accountList" className="list-group">
//                                         {(filteredAccounts.length > 0 ? filteredAccounts : accounts).map((account, index) => (
//                                             <li
//                                                 key={account._id}
//                                                 data-account-id={account._id}
//                                                 className={`list-group-item account-item py-2`}
//                                                 onClick={() => {
//                                                     setFormData({
//                                                         ...formData,
//                                                         cashAccount: account.name,
//                                                         cashAccountAddress: account.address,
//                                                         cashAccountPhone: account.phone
//                                                     });
//                                                     setShowAccountModal(false);
//                                                     focusTenderAmount();
//                                                     setTimeout(() => {
//                                                         addressRef.current?.focus();
//                                                     }, 100);
//                                                 }}
//                                                 style={{ cursor: 'pointer' }}
//                                                 tabIndex={0}
//                                                 onKeyDown={(e) => {
//                                                     if (e.key === 'ArrowDown') {
//                                                         e.preventDefault();
//                                                         const nextItem = e.target.nextElementSibling;
//                                                         if (nextItem) {
//                                                             e.target.classList.remove('active');
//                                                             nextItem.classList.add('active');
//                                                             nextItem.focus();
//                                                         }
//                                                     } else if (e.key === 'ArrowUp') {
//                                                         e.preventDefault();
//                                                         const prevItem = e.target.previousElementSibling;
//                                                         if (prevItem) {
//                                                             e.target.classList.remove('active');
//                                                             prevItem.classList.add('active');
//                                                             prevItem.focus();
//                                                         } else {
//                                                             accountSearchRef.current?.focus();
//                                                         }
//                                                     } else if (e.key === 'Enter') {
//                                                         e.preventDefault();
//                                                         setFormData({
//                                                             ...formData,
//                                                             cashAccount: account.name,
//                                                             cashAccountAddress: account.address,
//                                                             cashAccountPhone: account.phone
//                                                         });
//                                                         setShowAccountModal(false);
//                                                         focusTenderAmount();
//                                                         setTimeout(() => {
//                                                             addressRef.current?.focus();
//                                                         }, 100);
//                                                     }
//                                                 }}
//                                                 onFocus={(e) => {
//                                                     document.querySelectorAll('.account-item').forEach(item => {
//                                                         item.classList.remove('active');
//                                                     });
//                                                     e.target.classList.add('active');
//                                                 }}
//                                             >
//                                                 <div className="d-flex justify-content-between small">
//                                                     <strong>{account.name}</strong>
//                                                     <span>📍 {account.address || 'N/A'} | 📞 {account.phone || 'N/A'}</span>
//                                                 </div>
//                                             </li>
//                                         ))}
//                                     </ul>
//                                 </div>
//                             </div>
//                             <div className="modal-footer">
//                                 <button
//                                     type="button"
//                                     className="btn btn-primary"
//                                     onClick={() => {
//                                         setShowAccountModal(false);
//                                         focusTenderAmount();
//                                         setTimeout(() => {
//                                             addressRef.current?.focus();
//                                         }, 100);
//                                     }}
//                                 >
//                                     Use Entered Name
//                                 </button>
//                                 <button
//                                     type="button"
//                                     className="btn btn-secondary"
//                                     onClick={() => {
//                                         setShowAccountModal(false);
//                                         focusTenderAmount(); // Focus on tender amount
//                                     }}
//                                 >
//                                     Cancel
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             )}

//             {/* Modals */}
//             <AccountCreationModal
//                 show={showAccountCreationModal}
//                 onClose={() => setShowAccountCreationModal(false)}
//                 onAccountCreated={handleAccountCreated}
//                 companyId={company?._id}
//                 fiscalYear={company?.fiscalYear?._id}
//             />

//             {isDiscountModalOpen && (
//                 <DiscountModal
//                     discountInput={discountInput}
//                     discountType={discountType}
//                     setDiscountInput={setDiscountInput}
//                     setDiscountType={setDiscountType}
//                     setFormData={setFormData}
//                     setIsDiscountModalOpen={setIsDiscountModalOpen}
//                     calculatePOSSummary={calculatePOSSummary}
//                     focusTenderAmount={focusTenderAmount}
//                     items={items}
//                     formData={formData}
//                 />
//             )}

//             {showProductModal && (
//                 <ProductModal
//                     onClose={() => setShowProductModal(false)}
//                     onSelectProduct={addItemToBill}
//                     products={allItems}
//                 />
//             )}

//             <NotificationToast
//                 show={notification.show}
//                 message={notification.message}
//                 type={notification.type}
//                 onClose={() => setNotification({ ...notification, show: false })}
//             />

//             {/* Stock Adjustment Modal */}
//             <StockAdjustmentModal
//                 show={showStockAdjustmentModal}
//                 onClose={() => {
//                     setShowStockAdjustmentModal(false);
//                     setSelectedProductForStock(null);
//                     barcodeInputRef.current?.focus();
//                 }}
//                 product={selectedProductForStock}
//                 onStockAdded={async (adjustmentData) => {
//                     // Refresh stock data after successful stock adjustment
//                     await refreshStockData();

//                     setNotification({
//                         show: true,
//                         message: `Stock added successfully! Bill: ${adjustmentData.billNumber}`,
//                         type: 'success'
//                     });

//                     // Also refresh the items in the current bill to reflect new stock
//                     const updatedItems = await refreshStockData();

//                     // Update current items with fresh stock data
//                     setItems(prevItems => {
//                         return prevItems.map(cartItem => {
//                             const freshItem = updatedItems.find(item => item._id === cartItem.item);
//                             if (freshItem) {
//                                 return {
//                                     ...cartItem,
//                                     // Update stock-related information if needed
//                                 };
//                             }
//                             return cartItem;
//                         });
//                     });
//                 }}
//             />
//         </div>
//     );
// };

// // Helper styles
// const summaryRowStyle = {
//     display: 'flex',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     padding: '8px 0',
//     borderBottom: '1px solid #ecf0f1'
// };

// const amountStyle = {
//     fontWeight: '600',
//     color: '#2c3e50'
// };

// const quickPaymentButtonStyle = {
//     padding: '8px 5px',
//     background: '#3498db',
//     color: 'white',
//     border: 'none',
//     borderRadius: '6px',
//     fontSize: '0.8rem',
//     fontWeight: '600',
//     cursor: 'pointer',
//     textAlign: 'center'
// };

// const secondaryButtonStyle = {
//     padding: '10px',
//     background: '#95a5a6',
//     color: 'white',
//     border: 'none',
//     borderRadius: '6px',
//     fontSize: '0.9rem',
//     fontWeight: '600',
//     cursor: 'pointer',
//     display: 'flex',
//     alignItems: 'center',
//     justifyContent: 'space-between'
// };

// export default PosCashSales;
// //===================================================================================================