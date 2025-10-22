import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';

import axios from 'axios';
import Header from '../Header';
import NotificationToast from '../../NotificationToast';
import '../../../stylesheet/retailer/sales/AddCashSales.css'
import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
import '../../../stylesheet/noDateIcon.css'
import ProductModal from '../dashboard/modals/ProductModal';

import useDebounce from '../../../hooks/useDebounce';
import VirtualizedItemList from '../../VirtualizedItemList';

const AddCashSales = () => {
    const navigate = useNavigate();
    const [quantityErrors, setQuantityErrors] = useState({});
    const [stockValidation, setStockValidation] = useState({
        itemStockMap: new Map(), // Maps item ID to total available stock
        usedStockMap: new Map(), // Maps item ID to used quantity across all entries
    });
    const [showProductModal, setShowProductModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [lastSearchQuery, setLastSearchQuery] = useState('');
    const [shouldShowLastSearchResults, setShouldShowLastSearchResults] = useState(false);
    const debouncedSearchQuery = useDebounce(searchQuery, 50);
    const transactionDateRef = useRef(null);
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
    const addressRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [dateErrors, setDateErrors] = useState({
        transactionDateNepali: '',
        nepaliDate: ''
    });
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
        items: []
    });

    const [items, setItems] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [filteredAccounts, setFilteredAccounts] = useState([]);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const itemDropdownRef = useRef(null);
    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });
    const [nextBillNumber, setNextBillNumber] = useState('');

    const accountSearchRef = useRef(null);
    const itemSearchRef = useRef(null);
    const accountModalRef = useRef(null);
    const transactionModalRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        return () => {
            // Reset search memory when component unmounts
            setLastSearchQuery('');
            setShouldShowLastSearchResults(false);
        };
    }, []);

    useEffect(() => {
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
            } catch (error) {
                console.error('Error fetching initial data:', error);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (isInitialDataLoaded && transactionDateRef.current) {
            const timer = setTimeout(() => {
                transactionDateRef.current.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isInitialDataLoaded, company.dateFormat]);

    useEffect(() => {
        calculateTotal();
    }, [items, formData]);

    // useEffect(() => {
    //     if (itemSearchRef.current?.value) {
    //         handleItemSearch({ target: { value: itemSearchRef.current.value } });
    //     } else {
    //         const filtered = allItems.filter(item => {
    //             if (formData.isVatExempt === 'all') return true;
    //             if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
    //             if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
    //             return true;
    //         });
    //         setFilteredItems(filtered);
    //     }
    // }, [formData.isVatExempt, allItems]);

    // Update the useEffect that initializes stock maps

    useEffect(() => {
        if (allItems.length > 0) {
            const newItemStockMap = new Map();

            allItems.forEach(item => {
                // Calculate total stock for each item (across all batches)
                const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
                newItemStockMap.set(item._id, totalStock);
            });

            setStockValidation(prev => ({
                ...prev,
                itemStockMap: newItemStockMap
            }));

            // Validate existing items after stock maps are initialized
            if (items.length > 0) {
                validateAllQuantities();
            }
        }
    }, [allItems]);

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

    // Function to calculate used stock across all items
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

        // If stock data is not available yet (e.g., right after page load), skip validation
        if (availableStock === 0 && !stockValidation.itemStockMap.has(itemId)) {
            return true;
        }

        // Calculate total used quantity for this item across all items
        const usedStockMap = calculateUsedStock(itemsToValidate);
        const totalUsed = usedStockMap.get(itemId) || 0;

        // The quantity is valid if it doesn't exceed available stock
        return totalUsed <= availableStock;
    };

    const handleAccountSearch = (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (searchTerm === '') {
            setFilteredAccounts([]);
        } else {
            const filtered = accounts.filter(account =>
                account.name.toLowerCase().includes(searchTerm)
            );
            filtered.sort((a, b) => {
                const aNameMatch = a.name.toLowerCase() === searchTerm;
                const bNameMatch = b.name.toLowerCase() === searchTerm;
                if (aNameMatch && !bNameMatch) return -1;
                if (!aNameMatch && bNameMatch) return 1;
                return a.name.localeCompare(b.name);
            });
            setFilteredAccounts(filtered);
        }
    };

    const selectAccount = (account) => {
        setFormData({
            ...formData,
            cashAccount: account.name, // Store account name instead of ID
            cashAccountAddress: account.address,
            cashAccountPhone: account.phone
        });
        setShowAccountModal(false);
        setTimeout(() => {
            addressRef.current?.focus();
        }, 100);
    };


    // const handleItemSearch = (e) => {
    //     const query = e.target.value.toLowerCase();

    //     if (query.length === 0) {
    //         setFilteredItems([]);
    //         return;
    //     }

    //     let filtered = allItems.filter(item => {
    //         const matchesSearch = item.name.toLowerCase().includes(query) ||
    //             (item.hscode && item.hscode.toString().toLowerCase().includes(query)) ||
    //             (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(query)) ||
    //             (item.category && item.category.name.toLowerCase().includes(query));

    //         if (formData.isVatExempt === 'all') return matchesSearch;
    //         if (formData.isVatExempt === 'false') return matchesSearch && item.vatStatus === 'vatable';
    //         if (formData.isVatExempt === 'true') return matchesSearch && item.vatStatus === 'vatExempt';
    //         return matchesSearch;
    //     }).sort((a, b) => a.name.localeCompare(b.name));

    //     setFilteredItems(filtered);
    // };

    // const addItemToBill = (item) => {
    //     const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);

    //     if (totalStock === 0) {
    //         setNotification({
    //             show: true,
    //             message: `Item "${item.name}" has zero stock and cannot be added to the bill.`,
    //             type: 'error'
    //         });
    //         itemSearchRef.current.value = '';
    //         itemSearchRef.current.focus();
    //         return;
    //     }

    //     const sortedStockEntries = item.stockEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
    //     const firstStockEntry = sortedStockEntries[0] || {};

    //     const newItem = {
    //         item: item._id,
    //         uniqueNumber: item.uniqueNumber || 'N/A',
    //         hscode: item.hscode,
    //         name: item.name,
    //         category: item.category?.name || 'No Category',
    //         batchNumber: firstStockEntry.batchNumber || '',
    //         expiryDate: firstStockEntry.expiryDate ? new Date(firstStockEntry.expiryDate).toISOString().split('T')[0] : '',
    //         quantity: 0,
    //         unit: item.unit,
    //         price: firstStockEntry.price || 0,
    //         puPrice: firstStockEntry.puPrice || 0,
    //         netPuPrice: firstStockEntry.netPuPrice || 0,
    //         amount: 0,
    //         vatStatus: item.vatStatus,
    //         uniqueUuId: firstStockEntry.uniqueUuId
    //     };

    //     setItems([...items, newItem]);
    //     setShowItemDropdown(false);
    //     itemSearchRef.current.value = '';

    //     setTimeout(() => {
    //         const quantityInput = document.getElementById(`quantity-${items.length}`);
    //         if (quantityInput) {
    //             quantityInput.focus();
    //             quantityInput.select();
    //         }
    //     }, 100);
    // };

    const handleItemSearch = (e) => {
        const query = e.target.value.toLowerCase();
        setSearchQuery(query);

        // When user starts typing, disable showing last search results
        if (query.length > 0) {
            setShouldShowLastSearchResults(false);
        }

        setShowItemDropdown(true);
    };

    const handleSearchFocus = () => {
        setShowItemDropdown(true);

        // If we have a last search query and the input is empty, show those results
        if (lastSearchQuery && !searchQuery) {
            setShouldShowLastSearchResults(true);
        }

        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.remove('active');
        });
    };

    const addItemToBill = (item) => {
        // Store the search query when adding an item
        if (itemSearchRef.current?.value) {
            setLastSearchQuery(itemSearchRef.current.value);
            setShouldShowLastSearchResults(true);
        }
        const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);

        if (totalStock === 0) {
            setNotification({
                show: true,
                message: `Item "${item.name}" has zero stock and cannot be added to the bill.`,
                type: 'error'
            });
            itemSearchRef.current.value = '';
            itemSearchRef.current.focus();
            return;
        }

        const sortedStockEntries = item.stockEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstStockEntry = sortedStockEntries[0] || {};

        const newItem = {
            item: item._id,
            uniqueNumber: item.uniqueNumber || 'N/A',
            hscode: item.hscode,
            name: item.name,
            category: item.category?.name || 'No Category',
            batchNumber: firstStockEntry.batchNumber || '',
            expiryDate: firstStockEntry.expiryDate ? new Date(firstStockEntry.expiryDate).toISOString().split('T')[0] : '',
            quantity: 0,
            unit: item.unit,
            price: Math.round(firstStockEntry.price * 100) / 100 || 0,
            puPrice: firstStockEntry.puPrice || 0,
            netPuPrice: firstStockEntry.netPuPrice || 0,
            amount: 0,
            vatStatus: item.vatStatus,
            uniqueUuId: firstStockEntry.uniqueUuId
        };

        const updatedItems = [...items, newItem];
        setItems(updatedItems);
        setShowItemDropdown(false);
        itemSearchRef.current.value = '';

        // Clear search after adding item
        setSearchQuery('');
        if (itemSearchRef.current) {
            itemSearchRef.current.value = '';
        }

        // Show available stock info
        const availableStock = stockValidation.itemStockMap.get(item._id) || 0;

        setNotification({
            show: true,
            message: `Available stock: ${availableStock}`,
            type: 'success'
        });

        // Focus on quantity field
        setTimeout(() => {
            const quantityInput = document.getElementById(`quantity-${updatedItems.length - 1}`);
            if (quantityInput) {
                quantityInput.focus();
                quantityInput.select();
            }
        }, 100);
    };

    // Memoized filtered items calculation
    const memoizedFilteredItems = React.useMemo(() => {
        // If we should show last search results and there's a last search query
        if (shouldShowLastSearchResults && lastSearchQuery && !searchQuery) {
            return allItems.filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(lastSearchQuery.toLowerCase()) ||
                    (item.hscode && item.hscode.toString().toLowerCase().includes(lastSearchQuery.toLowerCase())) ||
                    (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(lastSearchQuery.toLowerCase())) ||
                    (item.category && item.category.name.toLowerCase().includes(lastSearchQuery.toLowerCase()));

                if (formData.isVatExempt === 'all') return matchesSearch;
                if (formData.isVatExempt === 'false') return matchesSearch && item.vatStatus === 'vatable';
                if (formData.isVatExempt === 'true') return matchesSearch && item.vatStatus === 'vatExempt';
                return matchesSearch;
            });
        }

        // Normal search behavior
        if (!searchQuery && allItems.length > 0) {
            return allItems.filter(item => {
                if (formData.isVatExempt === 'all') return true;
                if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
                if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
                return true;
            });
        }

        if (searchQuery.length === 0) return [];

        return allItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.hscode && item.hscode.toString().toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.category && item.category.name.toLowerCase().includes(searchQuery.toLowerCase()));

            if (formData.isVatExempt === 'all') return matchesSearch;
            if (formData.isVatExempt === 'false') return matchesSearch && item.vatStatus === 'vatable';
            if (formData.isVatExempt === 'true') return matchesSearch && item.vatStatus === 'vatExempt';
            return matchesSearch;
        });
    }, [allItems, formData.isVatExempt, searchQuery, lastSearchQuery, shouldShowLastSearchResults]);

    const updateItemField = (index, field, value) => {
        const updatedItems = [...items];
        updatedItems[index][field] = value;

        if (field === 'quantity' || field === 'price') {
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

            updatedItems[index].amount = (updatedItems[index].quantity * updatedItems[index].price).toFixed(2);
        }

        setItems(updatedItems);

        if (formData.discountPercentage || formData.discountAmount) {
            const subTotal = calculateTotal(updatedItems).subTotal;

            if (formData.discountPercentage) {
                const discountAmount = (subTotal * formData.discountPercentage) / 100;
                setFormData(prev => ({
                    ...prev,
                    discountAmount: discountAmount.toFixed(2)
                }));
            } else if (formData.discountAmount) {
                const discountPercentage = subTotal > 0 ? (formData.discountAmount / subTotal) * 100 : 0;
                setFormData(prev => ({
                    ...prev,
                    discountPercentage: discountPercentage.toFixed(2)
                }));
            }
        }
    };

    // const removeItem = (index) => {
    //     const updatedItems = items.filter((_, i) => i !== index);
    //     setItems(updatedItems);
    // };

    const removeItem = (index) => {
        const updatedItems = items.filter((_, i) => i !== index);
        setItems(updatedItems);

        // Revalidate all quantities after removal
        setTimeout(() => {
            validateAllQuantities(updatedItems);
        }, 0);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (itemSearchRef.current && !itemSearchRef.current.contains(event.target)) {
                if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) {
                    setShowItemDropdown(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const validateAllQuantities = (itemsToValidate = items) => {
        const newErrors = {};

        itemsToValidate.forEach((item, index) => {
            const itemId = item.item;

            // Only validate if stock data is available
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

    const calculateTotal = (itemsToCalculate = items) => {
        let subTotal = 0;
        let taxableAmount = 0;
        let nonTaxableAmount = 0;

        itemsToCalculate.forEach(item => {
            subTotal += parseFloat(item.amount) || 0;

            if (item.vatStatus === 'vatable') {
                taxableAmount += parseFloat(item.amount) || 0;
            } else {
                nonTaxableAmount += parseFloat(item.amount) || 0;
            }
        });

        const discountPercentage = parseFloat(formData.discountPercentage) || 0;
        const discountAmount = parseFloat(formData.discountAmount) || 0;

        const discountForTaxable = (taxableAmount * discountPercentage) / 100;
        const discountForNonTaxable = (nonTaxableAmount * discountPercentage) / 100;

        const finalTaxableAmount = taxableAmount - discountForTaxable;
        const finalNonTaxableAmount = nonTaxableAmount - discountForNonTaxable;

        let vatAmount = 0;
        if (formData.isVatExempt === 'false' || formData.isVatExempt === 'all') {
            vatAmount = (finalTaxableAmount * formData.vatPercentage) / 100;
        }

        const roundOffAmount = parseFloat(formData.roundOffAmount) || 0;
        const totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount + roundOffAmount;

        return {
            subTotal,
            taxableAmount: finalTaxableAmount,
            nonTaxableAmount: finalNonTaxableAmount,
            vatAmount,
            totalAmount
        };
    };

    const handleDiscountPercentageChange = (e) => {
        const value = parseFloat(e.target.value) || 0;
        const subTotal = calculateTotal().subTotal;
        const discountAmount = (subTotal * value) / 100;

        setFormData({
            ...formData,
            discountPercentage: value,
            discountAmount: discountAmount.toFixed(2)
        });
    };

    const handleDiscountAmountChange = (e) => {
        const value = parseFloat(e.target.value) || 0;
        const subTotal = calculateTotal().subTotal;
        const discountPercentage = subTotal > 0 ? (value / subTotal) * 100 : 0;

        setFormData({
            ...formData,
            discountAmount: value,
            discountPercentage: discountPercentage.toFixed(2)
        });
    };

    // const resetForm = async () => {
    //     try {
    //         setIsLoading(true); // Show loading state while refreshing data

    //         // Fetch fresh data from the backend
    //         const response = await api.get('/api/retailer/cash-sales');
    //         const { data } = response;

    //         // Update all necessary states
    //         const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    //         const currentRomanDate = new Date().toISOString().split('T')[0];

    //         setFormData({
    //             cashAccount: '',
    //             cashAccountAddress: '',
    //             cashAccountPan: '',
    //             cashAccountEmail: '',
    //             cashAccountPhone: '',
    //             transactionDateNepali: currentNepaliDate,
    //             transactionDateRoman: currentRomanDate,
    //             nepaliDate: currentNepaliDate,
    //             billDate: currentRomanDate,
    //             billNumber: data.data.nextSalesBillNumber,
    //             paymentMode: 'cash',
    //             isVatExempt: 'all',
    //             discountPercentage: 0,
    //             discountAmount: 0,
    //             roundOffAmount: 0,
    //             vatPercentage: 13,
    //             items: []
    //         });

    //         // Update all data states with fresh data
    //         setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
    //         // const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
    //         const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
    //         setAccounts(sortedAccounts);
    //         setFilteredAccounts([]); // Reset filtered accounts
    //         setNextBillNumber(data.data.nextSalesBillNumber);
    //         setItems([]);
    //         setQuantityErrors({}); // Clear quantity errors

    //         // Clear the account search input if it exists
    //         if (accountSearchRef.current) {
    //             accountSearchRef.current.value = '';
    //         }

    //         // Focus back to the date field
    //         setTimeout(() => {
    //             if (transactionDateRef.current) {
    //                 transactionDateRef.current.focus();
    //             }
    //         }, 100);
    //     } catch (err) {
    //         console.error('Error resetting form:', err);
    //         setNotification({
    //             show: true,
    //             message: 'Error refreshing form data',
    //             type: 'error'
    //         });
    //     } finally {
    //         setIsLoading(false);
    //     }
    // };

    const resetForm = async () => {
        try {
            setIsLoading(true);

            // Fetch fresh data from the backend
            const response = await api.get('/api/retailer/cash-sales');
            const { data } = response;

            // Update all necessary states
            const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
            const currentRomanDate = new Date().toISOString().split('T')[0];

            setFormData({
                cashAccount: '',
                cashAccountAddress: '',
                cashAccountPan: '',
                cashAccountEmail: '',
                cashAccountPhone: '',
                transactionDateNepali: currentNepaliDate,
                transactionDateRoman: currentRomanDate,
                nepaliDate: currentNepaliDate,
                billDate: currentRomanDate,
                billNumber: data.data.nextSalesBillNumber,
                paymentMode: 'cash',
                isVatExempt: 'all',
                discountPercentage: 0,
                discountAmount: 0,
                roundOffAmount: 0,
                vatPercentage: 13,
                items: []
            });

            // Update all data states with fresh data
            setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
            const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
            setAccounts(sortedAccounts);
            setFilteredAccounts([]);
            setNextBillNumber(data.data.nextSalesBillNumber);
            setItems([]);
            setQuantityErrors({});

            // Clear search state
            setSearchQuery('');
            setLastSearchQuery('');
            setShouldShowLastSearchResults(false);

            // Clear the account search input if it exists
            if (accountSearchRef.current) {
                accountSearchRef.current.value = '';
            }

            // Clear the item search input if it exists
            if (itemSearchRef.current) {
                itemSearchRef.current.value = '';
            }

            // Focus back to the date field
            setTimeout(() => {
                if (transactionDateRef.current) {
                    transactionDateRef.current.focus();
                }
            }, 100);
        } catch (err) {
            console.error('Error resetting form:', err);
            setNotification({
                show: true,
                message: 'Error refreshing form data',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e, print = false) => {
        e.preventDefault();
        // Validate all quantities before submitting
        const isValid = validateAllQuantities();
        if (!isValid) {
            setNotification({
                show: true,
                message: 'Please fix quantity errors before submitting',
                type: 'error'
            });

            // Focus on the first error
            const firstErrorIndex = Object.keys(quantityErrors)[0];
            if (firstErrorIndex !== undefined) {
                setTimeout(() => {
                    document.getElementById(`quantity-${firstErrorIndex}`)?.focus();
                }, 100);
            }

            return;
        }

        setIsSaving(true);

        try {
            const billData = {
                cashAccount: formData.cashAccount,
                cashAccountAddress: formData.cashAccountAddress,
                cashAccountPan: formData.cashAccountPan,
                cashAccountEmail: formData.cashAccountEmail,
                cashAccountPhone: formData.cashAccountPhone,
                vatPercentage: formData.vatPercentage,
                transactionDateRoman: formData.transactionDateRoman,
                transactionDateNepali: formData.transactionDateNepali,
                billDate: formData.billDate,
                nepaliDate: formData.nepaliDate,
                isVatExempt: formData.isVatExempt,
                discountPercentage: formData.discountPercentage,
                paymentMode: formData.paymentMode,
                roundOffAmount: formData.roundOffAmount,
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
                print
            };

            const response = await api.post('/api/retailer/cash-sales', billData);

            setNotification({
                show: true,
                message: 'Cash sales bill saved successfully!',
                type: 'success'
            });

            setItems([]);

            setFormData({
                cashAccount: '',
                cashAccountAddress: '',
                cashAccountPan: '',
                cashAccountEmail: '',
                cashAccountPhone: '',
                transactionDateNepali: currentNepaliDate,
                transactionDateRoman: new Date().toISOString().split('T')[0],
                nepaliDate: currentNepaliDate,
                billDate: new Date().toISOString().split('T')[0],
                billNumber: nextBillNumber,
                paymentMode: 'cash',
                isVatExempt: 'all',
                discountPercentage: 0,
                discountAmount: 0,
                roundOffAmount: 0,
                vatPercentage: 13,
                items: []
            });

            setItems([]);

            if (print) {
                setIsSaving(false);
                navigate(`/bills/${response.data.data.bill._id}/cash/direct-print`);
            } else {
                setItems([]);
                setIsSaving(false);
                resetForm()
                // Focus back to the first field
                setTimeout(() => {
                    if (transactionDateRef.current) {
                        transactionDateRef.current.focus();
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error saving cash sales bill:', error);
            setNotification({
                show: true,
                message: error.response?.data?.error || 'Failed to save cash sales bill. Please try again.',
                type: 'error'
            });
            setIsSaving(false);
        }
    };

    const totals = calculateTotal();

    const handleKeyDown = (e, currentFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = e.target.form;
            const inputs = Array.from(form.querySelectorAll('input, select, textarea')).filter(
                el => !el.hidden && !el.disabled && el.offsetParent !== null
            );
            const currentIndex = inputs.findIndex(input => input.id === currentFieldId);

            if (currentIndex > -1 && currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
            }
        }
    };

    // Memoized dropdown component
    const ItemDropdown = React.useMemo(() => {
        if (!showItemDropdown) return null;

        const itemsToShow = memoizedFilteredItems;

        // Determine what message to show
        let message = null;
        if (itemsToShow.length === 0) {
            if (shouldShowLastSearchResults && lastSearchQuery) {
                message = `No items found matching "${lastSearchQuery}"`;
            } else if (searchQuery) {
                message = `No items found matching "${searchQuery}"`;
            } else {
                message = "No items available";
            }
        }

        return (
            <div
                id="dropdownMenu"
                className="dropdown-menu show"
                style={{
                    maxHeight: '280px',
                    height: '280px',
                    overflow: 'hidden',
                    position: 'absolute',
                    width: '100%',
                    zIndex: 1000,
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                }}
                ref={itemDropdownRef}
            >
                <div className="dropdown-header" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    alignItems: 'center',
                    padding: '0 10px',
                    height: '40px',
                    background: '#f0f0f0',
                    fontWeight: 'bold',
                    borderBottom: '1px solid #dee2e6'
                }}>
                    <div><strong>#</strong></div>
                    <div><strong>HSN</strong></div>
                    <div><strong>Description</strong></div>
                    <div><strong>Category</strong></div>
                    <div><strong>Qty</strong></div>
                    <div><strong>Unit</strong></div>
                    <div><strong>Rate</strong></div>
                </div>

                {itemsToShow.length > 0 ? (
                    <VirtualizedItemList
                        items={itemsToShow}
                        onItemClick={addItemToBill}
                        searchRef={itemSearchRef}
                    />
                ) : (
                    <div className="text-center py-3 text-muted">
                        {message}
                    </div>
                )}
            </div>
        );
    }, [showItemDropdown, memoizedFilteredItems, searchQuery, lastSearchQuery, shouldShowLastSearchResults]);

    return (
        <div className="container-fluid">
            <Header />
            <div className="card mt-4 shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
                <div className="card-header">
                    <div className="row">
                        <div className="col-md-8 col-12">
                            Cash Sales Entry
                            {formData.billNumber === '' && (
                                <span style={{ color: 'red' }}>Invoice is required!</span>
                            )}
                            {dateErrors.transactionDateNepali && (
                                <span style={{ color: 'red' }}>{dateErrors.transactionDateNepali}</span>
                            )}
                            {dateErrors.nepaliDate && (
                                <span style={{ color: 'red' }}>{dateErrors.nepaliDate}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit} id="billForm" className="needs-validation" noValidate>
                        <div className="form-group row">
                            {company.dateFormat === 'nepali' ? (
                                <>
                                    <div className="col">
                                        <label htmlFor="transactionDateNepali">Transaction Date:</label>
                                        <input
                                            type="text"
                                            name="transactionDateNepali"
                                            id="transactionDateNepali"
                                            ref={company.dateFormat === 'nepali' ? transactionDateRef : null}
                                            autoComplete='off'
                                            className={`form-control no-date-icon ${dateErrors.transactionDateNepali ? 'is-invalid' : ''}`}
                                            value={formData.transactionDateNepali}
                                            onChange={(e) => {
                                                setFormData({ ...formData, transactionDateNepali: e.target.value });
                                                setDateErrors(prev => ({ ...prev, transactionDateNepali: '' }));
                                            }}
                                            onBlur={(e) => {
                                                try {
                                                    const dateStr = e.target.value;
                                                    if (!dateStr) {
                                                        setDateErrors(prev => ({ ...prev, transactionDateNepali: 'Date is required' }));
                                                        return;
                                                    }
                                                    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
                                                        return;
                                                    }
                                                    const [year, month, day] = dateStr.split('/').map(Number);
                                                    if (month < 1 || month > 12) throw new Error("Month must be between 1-12");
                                                    if (day < 1 || day > 33) throw new Error("Day must be between 1-32");
                                                    const nepaliDate = new NepaliDate(year, month - 1, day);

                                                    setFormData({
                                                        ...formData,
                                                        transactionDateNepali: nepaliDate.format('MM/DD/YYYY')
                                                    });
                                                    setDateErrors(prev => ({ ...prev, transactionDateNepali: '' }));
                                                } catch (error) {
                                                    setDateErrors(prev => ({
                                                        ...prev,
                                                        transactionDateNepali: error.message || 'Invalid Nepali date'
                                                    }));
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.transactionDateNepali) {
                                                    e.preventDefault();
                                                    e.target.focus();
                                                } else if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'transactionDateNepali');
                                                }
                                            }}
                                            required
                                        />
                                        {dateErrors.transactionDateNepali && (
                                            <div className="invalid-feedback">
                                                {dateErrors.transactionDateNepali}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col">
                                        <label htmlFor="nepaliDate">Invoice Date:</label>
                                        <input
                                            type="text"
                                            name="nepaliDate"
                                            id="nepaliDate"
                                            autoComplete='off'
                                            className={`form-control no-date-icon ${dateErrors.nepaliDate ? 'is-invalid' : ''}`}
                                            value={formData.nepaliDate}
                                            onChange={(e) => {
                                                setFormData({ ...formData, nepaliDate: e.target.value });
                                                setDateErrors(prev => ({ ...prev, nepaliDate: '' }));
                                            }}
                                            onBlur={(e) => {
                                                try {
                                                    const dateStr = e.target.value.trim();
                                                    if (!dateStr) {
                                                        setDateErrors(prev => ({ ...prev, nepaliDate: 'Date is required' }));
                                                        return;
                                                    }

                                                    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
                                                        return;
                                                    }

                                                    const [year, month, day] = dateStr.split('/').map(Number);
                                                    if (month < 1 || month > 12) throw new Error("Month must be between 1-12");
                                                    if (day < 1 || day > 33) throw new Error("Day must be between 1-32");

                                                    const nepaliDate = new NepaliDate(year, month - 1, day);

                                                    if (
                                                        nepaliDate.getYear() !== year ||
                                                        nepaliDate.getMonth() + 1 !== month ||
                                                        nepaliDate.getDate() !== day
                                                    ) {
                                                        throw new Error("Invalid Nepali date");
                                                    }

                                                    setFormData({
                                                        ...formData,
                                                        nepaliDate: nepaliDate.format('MM/DD/YYYY')
                                                    });
                                                    setDateErrors(prev => ({ ...prev, nepaliDate: '' }));
                                                } catch (error) {
                                                    setDateErrors(prev => ({
                                                        ...prev,
                                                        nepaliDate: error.message || 'Invalid Nepali date'
                                                    }));
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.nepaliDate) {
                                                    e.preventDefault();
                                                    e.target.focus();
                                                } else if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'nepaliDate');
                                                }
                                            }}
                                            required
                                        />
                                        {dateErrors.nepaliDate && (
                                            <div className="invalid-feedback">
                                                {dateErrors.nepaliDate}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="col">
                                        <label htmlFor="transactionDateRoman">Transaction Date:</label>
                                        <input
                                            type="date"
                                            name="transactionDateRoman"
                                            id="transactionDateRoman"
                                            className="form-control"
                                            ref={company.dateFormat === 'nepali' ? transactionDateRef : null}
                                            value={formData.transactionDateRoman}
                                            onChange={(e) => setFormData({ ...formData, transactionDateRoman: e.target.value })}
                                            required
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'transactionDateRoman');
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="col">
                                        <label htmlFor="billDate">Invoice Date:</label>
                                        <input
                                            type="date"
                                            name="billDate"
                                            id="billDate"
                                            className="form-control"
                                            value={formData.billDate}
                                            onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                                            required
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'billDate');
                                                }
                                            }}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="col">
                                <label htmlFor="billNumber">Inv. No:</label>
                                <input
                                    type="text"
                                    name="billNumber"
                                    id="billNumber"
                                    className="form-control"
                                    value={formData.billNumber}
                                    readOnly
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'billNumber');
                                        }
                                    }}
                                />
                            </div>

                            <div className="col">
                                <label htmlFor="isVatExempt">VAT</label>
                                <select
                                    className="form-control"
                                    name="isVatExempt"
                                    id="isVatExempt"
                                    value={formData.isVatExempt}
                                    onChange={(e) => setFormData({ ...formData, isVatExempt: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'isVatExempt');
                                        }
                                    }}
                                >
                                    {company.vatEnabled && <option value="all">All</option>}
                                    {company.vatEnabled && <option value="false">13%</option>}
                                    <option value="true">Exempt</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group row">
                            <div className="col-6">
                                <label htmlFor="account">Cash Account:</label>
                                <input
                                    type="text"
                                    id="account"
                                    name="account"
                                    className="form-control"
                                    value={formData.cashAccount}
                                    onChange={(e) => {
                                        setFormData({
                                            ...formData,
                                            cashAccount: e.target.value,
                                            cashAccountAddress: '',
                                            cashAccountPhone: ''
                                        });
                                    }}
                                    onClick={() => setShowAccountModal(true)}
                                    onFocus={() => setShowAccountModal(true)}
                                    readOnly
                                    required
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'account');
                                        }
                                    }}
                                />
                            </div>

                            <div className="col">
                                <label htmlFor="cashAccountAddress">Address:</label>
                                <input
                                    type="text"
                                    id="cashAccountAddress"
                                    className="form-control"
                                    value={formData.cashAccountAddress}
                                    onChange={(e) => setFormData({ ...formData, cashAccountAddress: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'cashAccountAddress');
                                        }
                                    }}
                                    ref={addressRef}
                                    autoComplete='off'
                                />
                            </div>

                            <div className="col">
                                <label htmlFor="cashAccountPhone">Phone:</label>
                                <input
                                    type="text"
                                    id="cashAccountPhone"
                                    className="form-control"
                                    value={formData.cashAccountPhone}
                                    onChange={(e) => setFormData({ ...formData, cashAccountPhone: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'cashAccountPhone');
                                        }
                                    }}
                                    autoComplete='off'
                                />
                            </div>
                        </div>

                        <hr style={{ border: "1px solid gray" }} />

                        <div id="bill-details-container" style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }}>
                            <table className="table table-bordered compact-table" id="itemsTable">
                                <thead>
                                    <tr>
                                        <th>S.No.</th>
                                        <th>#</th>
                                        <th>HSN</th>
                                        <th>Description of Goods</th>
                                        <th>Batch</th>
                                        <th>Expiry</th>
                                        <th>Qty</th>
                                        <th>Unit</th>
                                        <th>Rate</th>
                                        <th>Amount</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="items">
                                    {items.map((item, index) => {
                                        const availableStock = getAvailableStockForDisplay(item);
                                        const remainingStock = getRemainingStock(item);
                                        return (
                                            <tr key={index} className={`item ${item.vatStatus === 'vatable' ? 'vatable-item' : 'non-vatable-item'}`}>
                                                <td>{index + 1}</td>
                                                <td>{item.uniqueNumber}</td>
                                                <td>
                                                    <input type="hidden" name={`items[${index}][hscode]`} value={item.hscode} />
                                                    {item.hscode}
                                                </td>
                                                <td className="col-3">
                                                    <input type="hidden" name={`items[${index}][item]`} value={item.item} />
                                                    {item.name}
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        name={`items[${index}][batchNumber]`}
                                                        className="form-control item-batchNumber"
                                                        id={`batchNumber-${index}`}
                                                        value={item.batchNumber}
                                                        onChange={(e) => updateItemField(index, 'batchNumber', e.target.value)}
                                                        required
                                                        onFocus={(e) => {
                                                            e.target.select();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                document.getElementById(`expiryDate-${index}`)?.focus();
                                                            }
                                                        }}
                                                        readOnly
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="date"
                                                        name={`items[${index}][expiryDate]`}
                                                        className="form-control item-expiryDate"
                                                        id={`expiryDate-${index}`}
                                                        value={item.expiryDate}
                                                        onChange={(e) => updateItemField(index, 'expiryDate', e.target.value)}
                                                        required
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                document.getElementById(`quantity-${index}`)?.focus();
                                                            }
                                                        }}
                                                        readOnly
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        name={`items[${index}][quantity]`}
                                                        className={`form-control item-quantity ${quantityErrors[index] ? 'is-invalid' : ''}`}
                                                        id={`quantity-${index}`}
                                                        value={item.quantity}
                                                        onChange={(e) => updateItemField(index, 'quantity', e.target.value)}
                                                        required
                                                        min="0"
                                                        max={availableStock}
                                                        onFocus={(e) => {
                                                            e.target.select();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                // Only move to next field if quantity is valid
                                                                if (!quantityErrors[index]) {
                                                                    document.getElementById(`price-${index}`)?.focus();
                                                                } else {
                                                                    // Keep focus on quantity field if there's an error
                                                                    e.target.focus();
                                                                    e.target.select();
                                                                }
                                                            }
                                                        }}
                                                    />
                                                    {quantityErrors[index] && (
                                                        <div className="invalid-feedback d-block small">
                                                            {quantityErrors[index]}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {item.unit?.name}
                                                    <input type="hidden" name={`items[${index}][unit]`} value={item.unit?._id} />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        name={`items[${index}][price]`}
                                                        className="form-control item-price"
                                                        id={`price-${index}`}
                                                        value={item.price}
                                                        onChange={(e) => updateItemField(index, 'price', e.target.value)}
                                                        onFocus={(e) => {
                                                            e.target.select();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                itemSearchRef.current?.focus();
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td className="item-amount">{item.amount}</td>
                                                <td className="align-middle">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => removeItem(index)}
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </td>
                                                <input type="hidden" name={`items[${index}][vatStatus]`} value={item.vatStatus} />
                                                <input type="hidden" name={`items[${index}][puPrice]`} value={item.puPrice} />
                                                <input type="hidden" name={`items[${index}][netPuPrice]`} value={item.netPuPrice} />
                                                <input type="hidden" name={`items[${index}][uniqueUuId]`} value={item.uniqueUuId} />
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <hr style={{ border: "1px solid gray" }} />

                        {/* <div className="form-group row">
                            <div className="col">
                                <label htmlFor="itemSearch">Search Item</label>
                                <input
                                    type="text"
                                    id="itemSearch"
                                    className="form-control"
                                    placeholder="Search for an item"
                                    autoComplete='off'
                                    onChange={(e) => {
                                        handleItemSearch(e);
                                        setShowItemDropdown(true);
                                    }}
                                    onFocus={() => {
                                        setShowItemDropdown(true);
                                        document.querySelectorAll('.dropdown-item').forEach(item => {
                                            item.classList.remove('active');
                                        });
                                    }}
                                    ref={itemSearchRef}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            const firstItem = document.querySelector('.dropdown-item');
                                            if (firstItem) {
                                                firstItem.classList.add('active');
                                                firstItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const activeItem = document.querySelector('.dropdown-item.active');
                                            if (activeItem) {
                                                const index = parseInt(activeItem.getAttribute('data-index'));
                                                const filteredItem = filteredItems.length > 0 ? filteredItems[index] : allItems[index];
                                                if (filteredItem) {
                                                    addItemToBill(filteredItem);
                                                }
                                            } else if (!e.target.value && items.length > 0) {
                                                setShowItemDropdown(false);
                                                setTimeout(() => {
                                                    document.getElementById('discountPercentage')?.focus();
                                                }, 0);
                                            }
                                        }
                                    }}
                                />
                                {showItemDropdown && (
                                    <div
                                        id="dropdownMenu"
                                        className="dropdown-menu show"
                                        style={{
                                            maxHeight: '280px',
                                            height: '280px',
                                            overflowY: 'auto',
                                            position: 'absolute',
                                            width: '100%',
                                            zIndex: 1000,
                                            border: '1px solid #ddd',
                                            borderRadius: '4px'
                                        }}
                                        ref={itemDropdownRef}
                                    >
                                        <div className="dropdown-header" style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(7, 1fr)',
                                            alignItems: 'center',
                                            padding: '0 10px',
                                            height: '40px',
                                            background: '#f0f0f0',
                                            fontWeight: 'bold',
                                            borderBottom: '1px solid #dee2e6'
                                        }}>
                                            <div><strong>#</strong></div>
                                            <div><strong>HSN</strong></div>
                                            <div><strong>Description</strong></div>
                                            <div><strong>Category</strong></div>
                                            <div><strong>Qty</strong></div>
                                            <div><strong>Unit</strong></div>
                                            <div><strong>Rate</strong></div>
                                        </div>

                                        {filteredItems.length > 0 ? (
                                            filteredItems.map((item, index) => (
                                                <div
                                                    key={index}
                                                    data-index={index}
                                                    className={`dropdown-item ${item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt'} expiry-${calculateExpiryStatus(item)}`}
                                                    style={{
                                                        height: '40px',
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(7, 1fr)',
                                                        alignItems: 'center',
                                                        padding: '0 10px',
                                                        borderBottom: '1px solid #eee',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => addItemToBill(item)}
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addItemToBill(item);
                                                        } else if (e.key === 'ArrowDown') {
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
                                                                itemSearchRef.current.focus();
                                                            }
                                                        }
                                                    }}
                                                    onFocus={(e) => {
                                                        document.querySelectorAll('.dropdown-item').forEach(item => {
                                                            item.classList.remove('active');
                                                        });
                                                        e.target.classList.add('active');
                                                    }}
                                                >
                                                    <div>{item.uniqueNumber || 'N/A'}</div>
                                                    <div>{item.hscode || 'N/A'}</div>
                                                    <div className="dropdown-items-name">{item.name}</div>
                                                    <div>{item.category?.name || 'No Category'}</div>
                                                    <div>{item.stock || 0}</div>
                                                    <div>{item.unit?.name || ''}</div>
                                                    <div>Rs.{Math.round(item.stockEntries?.[0]?.price * 100) / 100 || 0}</div>
                                                </div>
                                            ))
                                        ) : itemSearchRef.current?.value ? (
                                            <div className="text-center py-3 text-muted">
                                                No items found matching "{itemSearchRef.current.value}"
                                            </div>
                                        ) : allItems.length > 0 ? (
                                            allItems
                                                .filter(item => {
                                                    if (formData.isVatExempt === 'all') return true;
                                                    if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
                                                    if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
                                                    return true;
                                                })
                                                .map((item, index) => (
                                                    <div
                                                        key={index}
                                                        data-index={index}
                                                        className={`dropdown-item ${item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt'}`}
                                                        style={{
                                                            height: '40px',
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(7, 1fr)',
                                                            alignItems: 'center',
                                                            padding: '0 10px',
                                                            borderBottom: '1px solid #eee',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => addItemToBill(item)}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                addItemToBill(item);
                                                            } else if (e.key === 'ArrowDown') {
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
                                                                    itemSearchRef.current.focus();
                                                                }
                                                            }
                                                        }}
                                                        onFocus={(e) => {
                                                            document.querySelectorAll('.dropdown-item').forEach(item => {
                                                                item.classList.remove('active');
                                                            });
                                                            e.target.classList.add('active');
                                                        }}
                                                    >
                                                        <div>{item.uniqueNumber || 'N/A'}</div>
                                                        <div>{item.hscode || 'N/A'}</div>
                                                        <div className="dropdown-items-name">{item.name}</div>
                                                        <div>{item.category?.name || 'No Category'}</div>
                                                        <div>{item.stock || 0}</div>
                                                        <div>{item.unit?.name || ''}</div>
                                                        <div>Rs.{item.price || 0}</div>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="text-center py-3 text-muted">
                                                No items available
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div> */}

                        <div className="form-group row">
                            <div className="col">
                                <label htmlFor="itemSearch">Search Item</label>
                                <input
                                    type="text"
                                    id="itemSearch"
                                    className="form-control"
                                    placeholder="Search for an item"
                                    autoComplete='off'
                                    value={searchQuery}
                                    onChange={handleItemSearch}
                                    onFocus={handleSearchFocus}
                                    ref={itemSearchRef}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            const firstItem = document.querySelector('.dropdown-item');
                                            if (firstItem) {
                                                firstItem.classList.add('active');
                                                firstItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const activeItem = document.querySelector('.dropdown-item.active');
                                            if (activeItem) {
                                                const index = parseInt(activeItem.getAttribute('data-index'));
                                                const itemToAdd = memoizedFilteredItems[index];
                                                if (itemToAdd) {
                                                    addItemToBill(itemToAdd);
                                                }
                                            } else if (!searchQuery && items.length > 0) {
                                                setShowItemDropdown(false);
                                                setTimeout(() => {
                                                    document.getElementById('discountPercentage')?.focus();
                                                }, 0);
                                            }
                                        }
                                    }}
                                />
                                {ItemDropdown}
                            </div>
                        </div>

                        <div className="table-responsive">
                            <table className="table table-bordered">
                                <thead>
                                    <tr>
                                        <th colSpan="6" className="text-center bg-light">Bill Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><label htmlFor="subTotal">Sub Total:</label></td>
                                        <td>
                                            <p className="form-control-plaintext">Rs. {totals.subTotal.toFixed(2)}</p>
                                        </td>
                                        <td><label htmlFor="discountPercentage">Discount %:</label></td>
                                        <td>
                                            <input
                                                type="number"
                                                step="any"
                                                name="discountPercentage"
                                                id="discountPercentage"
                                                className="form-control"
                                                value={formData.discountPercentage}
                                                onChange={handleDiscountPercentageChange}
                                                onFocus={(e) => {
                                                    e.target.select();
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleKeyDown(e, 'discountPercentage');
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td><label htmlFor="discountAmount">Discount (Rs.):</label></td>
                                        <td>
                                            <input
                                                type="number"
                                                step="any"
                                                name="discountAmount"
                                                id="discountAmount"
                                                value={formData.discountAmount}
                                                className="form-control"
                                                onChange={handleDiscountAmountChange}
                                                onFocus={(e) => {
                                                    e.target.select();
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleKeyDown(e, 'discountAmount');
                                                    }
                                                }}
                                            />
                                        </td>
                                    </tr>
                                    {company.vatEnabled && formData.isVatExempt !== 'true' && (
                                        <>
                                            <tr id="taxableAmountRow">
                                                <td><label htmlFor="taxableAmount">Taxable Amount:</label></td>
                                                <td>
                                                    <p className="form-control-plaintext">Rs. {totals.taxableAmount.toFixed(2)}</p>
                                                </td>
                                                <td><label htmlFor="vatPercentage">VAT %:</label></td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        name="vatPercentage"
                                                        id="vatPercentage"
                                                        className="form-control"
                                                        value={formData.vatPercentage}
                                                        readOnly
                                                        onFocus={(e) => {
                                                            e.target.select();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleKeyDown(e, 'vatPercentage');
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td><label htmlFor="vatAmount">VAT Amount:</label></td>
                                                <td>
                                                    <p className="form-control-plaintext">Rs. {totals.vatAmount.toFixed(2)}</p>
                                                </td>
                                            </tr>
                                        </>
                                    )}
                                    {/* Add empty cells to maintain table structure when exempt */}
                                    {company.vatEnabled && formData.isVatExempt === 'true' && (
                                        <>
                                            <td colSpan="4"></td>
                                        </>
                                    )}


                                    <tr>
                                        <td><label htmlFor="roundOffAmount">Round Off:</label></td>
                                        <td>
                                            <input
                                                type="number"
                                                className="form-control"
                                                step="any"
                                                id="roundOffAmount"
                                                name="roundOffAmount"
                                                value={formData.roundOffAmount}
                                                onChange={(e) => setFormData({ ...formData, roundOffAmount: e.target.value })}
                                                onFocus={(e) => {
                                                    e.target.select();
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        document.getElementById('saveBill')?.focus();
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td><label htmlFor="totalAmount">Total Amount:</label></td>
                                        <td>
                                            <p className="form-control-plaintext">Rs. {totals.totalAmount.toFixed(2)}</p>
                                        </td>
                                        <td><label htmlFor="amountInWords">In Words:</label></td>
                                        <td>
                                            <p className="form-control-plaintext" id="amountInWords">
                                                {convertToRupeesAndPaisa(totals.totalAmount)} Only.
                                            </p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="d-flex justify-content-end mt-4">
                            <button
                                type="submit"
                                className="btn btn-primary mr-2 p-3"
                                id="saveBill"
                                disabled={isSaving}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                            >
                                {isSaving ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Saving...
                                    </>
                                ) : (
                                    <i className="bi bi-save"></i>
                                )}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary p-3"
                                onClick={(e) => handleSubmit(e, true)}
                                disabled={isSaving}
                            >
                                <i className="bi bi-printer"></i>
                            </button>
                        </div>
                    </form>
                </div>
            </div >

            {showAccountModal && (
                <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content" style={{ height: '500px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title" id="accountModalLabel">Select or Enter Cash Account</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowAccountModal(false)}
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

                                        // Filter accounts based on search
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
                                            // Always use the typed text when pressing Enter in the input
                                            setShowAccountModal(false);
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
                                    onClick={() => setShowAccountModal(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}

            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />
        </div >
    );
};

function convertToRupeesAndPaisa(amount) {
    const rupees = Math.floor(amount);
    const paisa = Math.round((amount - rupees) * 100);

    let words = '';

    if (rupees > 0) {
        words += numberToWords(rupees) + ' Rupees';
    }

    if (paisa > 0) {
        words += (rupees > 0 ? ' and ' : '') + numberToWords(paisa) + ' Paisa';
    }

    return words || 'Zero Rupees';
}

function numberToWords(num) {
    const ones = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'
    ];

    const tens = [
        '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    const scales = ['', 'Thousand', 'Million', 'Billion'];

    function convertHundreds(num) {
        let words = '';

        if (num > 99) {
            words += ones[Math.floor(num / 100)] + ' Hundred ';
            num %= 100;
        }

        if (num > 19) {
            words += tens[Math.floor(num / 10)] + ' ';
            num %= 10;
        }

        if (num > 0) {
            words += ones[num] + ' ';
        }

        return words.trim();
    }

    if (num === 0) return 'Zero';
    if (num < 0) return 'Negative ' + numberToWords(Math.abs(num));

    let words = '';

    for (let i = 0; i < scales.length; i++) {
        let unit = Math.pow(1000, scales.length - i - 1);
        let currentNum = Math.floor(num / unit);

        if (currentNum > 0) {
            words += convertHundreds(currentNum) + ' ' + scales[scales.length - i - 1] + ' ';
        }

        num %= unit;
    }

    return words.trim();
}

export default AddCashSales;