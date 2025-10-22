import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';

import axios from 'axios';
import Header from '../Header';
import NotificationToast from '../../NotificationToast';
import '../../../stylesheet/retailer/sales/AddSales.css'
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
import '../../../stylesheet/noDateIcon.css'
import ProductModal from '../dashboard/modals/ProductModal';
import AccountBalanceDisplay from '../payment/AccountBalanceDisplay';
import useDebounce from '../../../hooks/useDebounce';
import VirtualizedItemList from '../../VirtualizedItemList';

const AddSales = () => {
    const { salesDraftSave, setSalesDraftSave, clearSalesDraft } = usePageNotRefreshContext();

    const [searchQuery, setSearchQuery] = useState('');
    const [lastSearchQuery, setLastSearchQuery] = useState('');
    const [shouldShowLastSearchResults, setShouldShowLastSearchResults] = useState(false);
    const debouncedSearchQuery = useDebounce(searchQuery, 50);

    const [transactionSettings, setTransactionSettings] = useState({
        displayTransactions: false,
        displayTransactionsForPurchase: false,
        displayTransactionsForSalesReturn: false,
        displayTransactionsForPurchaseReturn: false
    });
    const [showProductModal, setShowProductModal] = useState(false);
    const [quantityErrors, setQuantityErrors] = useState({});
    const [stockValidation, setStockValidation] = useState({
        itemStockMap: new Map(), // Maps item ID to total available stock
        usedStockMap: new Map(), // Maps item ID to used quantity across all entries
    });

    const continueButtonRef = useRef(null);
    const [transactionCache, setTransactionCache] = useState(new Map());
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const navigate = useNavigate();
    const transactionDateRef = useRef(null);
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingItems, setLoadingItems] = useState(new Set());
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
    const [formData, setFormData] = useState(salesDraftSave?.formData || {
        accountId: '',
        accountName: '',
        accountAddress: '',
        accountPan: '',
        transactionDateNepali: new NepaliDate(currentNepaliDate).format('YYYY-MM-DD'),
        transactionDateRoman: new Date().toISOString().split('T')[0],
        nepaliDate: new NepaliDate(currentNepaliDate).format('YYYY-MM-DD'),
        billDate: new Date().toISOString().split('T')[0],
        billNumber: '',
        paymentMode: 'credit',
        isVatExempt: 'all',
        discountPercentage: 0,
        discountAmount: 0,
        roundOffAmount: 0,
        vatPercentage: 13,
        items: []
    });

    const [items, setItems] = useState(salesDraftSave?.items || []);
    const [allItems, setAllItems] = useState([]);
    const [accounts, setAccounts] = useState(salesDraftSave?.accounts || []);
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
        // Save draft to session storage whenever form data or items change
        if (formData.accountId || items.length > 0) {
            setSalesDraftSave({
                formData,
                items,
                accounts
            });
        }
    }, [formData, items, accounts, setSalesDraftSave]);

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


    // Add this useEffect to handle draft items when they're loaded
    useEffect(() => {
        if (salesDraftSave?.items && salesDraftSave.items.length > 0 && allItems.length > 0) {
            // Validate quantities when draft items are loaded
            setTimeout(() => {
                validateAllQuantities();
            }, 100);
        }
    }, [salesDraftSave?.items, allItems]);

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

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/retailer/credit-sales');
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
            // Small timeout to ensure the field is rendered
            const timer = setTimeout(() => {
                transactionDateRef.current.focus();

                // For date inputs, we might need to select the text
                if (transactionDateRef.current.type === 'text') {
                }
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

    useEffect(() => {
        const fetchTransactionSettings = async () => {
            try {
                const response = await api.get('/api/retailer/get-display-sales-transactions');
                if (response.data.success) {
                    setTransactionSettings(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching transaction settings:', error);
            }
        };
        fetchTransactionSettings();
    }, []);

    // Add this useEffect to handle modal focus
    useEffect(() => {
        if (showTransactionModal && continueButtonRef.current) {
            // Small timeout to ensure modal is fully rendered
            const timer = setTimeout(() => {
                continueButtonRef.current.focus();
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [showTransactionModal]);

    useEffect(() => {
        return () => {
            // Reset search memory when component unmounts
            setLastSearchQuery('');
            setShouldShowLastSearchResults(false);
        };
    }, []);


    const handleAccountSearch = (e) => {
        const searchText = e.target.value.toLowerCase();
        const filtered = accounts.filter(account =>
            account.name.toLowerCase().includes(searchText) ||
            (account.uniqueNumber && account.uniqueNumber.toString().toLowerCase().includes(searchText))
        ).sort((a, b) => a.name.localeCompare(b.name));

        setFilteredAccounts(filtered);
    };

    const selectAccount = (account) => {
        setFormData({
            ...formData,
            accountId: account._id,
            accountName: `${account.uniqueNumber || ''} ${account.name}`.trim(),
            accountAddress: account.address,
            accountPan: account.pan
        });
        setShowAccountModal(false);
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

    // Update the addItemToBill function

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

    const addItemToBill = async (item) => {

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

        // Update the transaction fetching part
        if (transactionSettings.displayTransactions && formData.accountId) {
            const cacheKey = `${item._id}-${formData.accountId}`;

            // Check cache first
            if (transactionCache.has(cacheKey)) {
                const cachedTransactions = transactionCache.get(cacheKey);
                if (cachedTransactions.length > 0) {
                    setTransactions(cachedTransactions);
                    setShowTransactionModal(true);
                    return;
                }
            }

            try {
                setIsLoadingTransactions(true);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await api.get(`/api/retailer/transactions/${item._id}/${formData.accountId}/Sales`, {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.data.success) {
                    setTransactionCache(prev => new Map(prev.set(cacheKey, response.data.data.transactions)));

                    if (response.data.data.transactions.length > 0) {
                        setTransactions(response.data.data.transactions);
                        setShowTransactionModal(true);
                        return;
                    }
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error fetching transactions:', error);
                }
            } finally {
                setIsLoadingTransactions(false);
            }
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

        // if (formData.discountPercentage || formData.discountAmount) {
        //     const subTotal = calculateTotal(updatedItems).subTotal;

        //     if (formData.discountPercentage) {
        //         const discountAmount = (subTotal * formData.discountPercentage) / 100;
        //         setFormData(prev => ({
        //             ...prev,
        //             discountAmount: discountAmount.toFixed(2)
        //         }));
        //     } else if (formData.discountAmount) {
        //         const discountPercentage = subTotal > 0 ? (formData.discountAmount / subTotal) * 100 : 0;
        //         setFormData(prev => ({
        //             ...prev,
        //             discountPercentage: discountPercentage.toFixed(2)
        //         }));
        //     }
        // }

        // Recalculate discounts if they have values
        if (formData.discountPercentage || formData.discountAmount) {
            const subTotal = calculateTotal(updatedItems).subTotal;

            if (formData.discountPercentage) {
                const discountAmount = preciseMultiply(subTotal, preciseDivide(formData.discountPercentage, 100));
                setFormData(prev => ({
                    ...prev,
                    discountAmount: preciseRound(discountAmount, 2)
                }));
            } else if (formData.discountAmount) {
                const discountPercentage = subTotal > 0 ?
                    preciseMultiply(preciseDivide(formData.discountAmount, subTotal), 100) : 0;
                setFormData(prev => ({
                    ...prev,
                    discountPercentage: preciseRound(discountPercentage, 2)
                }));
            }
        }
    };

    const removeItem = (index) => {
        const updatedItems = items.filter((_, i) => i !== index);
        setItems(updatedItems);

        // Revalidate all quantities after removal
        setTimeout(() => {
            validateAllQuantities(updatedItems);
        }, 0);
    };


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

    // const calculateTotal = (itemsToCalculate = items) => {
    //     let subTotal = 0;
    //     let taxableAmount = 0;
    //     let nonTaxableAmount = 0;

    //     itemsToCalculate.forEach(item => {
    //         subTotal += parseFloat(item.amount) || 0;

    //         if (item.vatStatus === 'vatable') {
    //             taxableAmount += parseFloat(item.amount) || 0;
    //         } else {
    //             nonTaxableAmount += parseFloat(item.amount) || 0;
    //         }
    //     });

    //     const discountPercentage = parseFloat(formData.discountPercentage) || 0;
    //     const discountAmount = parseFloat(formData.discountAmount) || 0;

    //     const discountForTaxable = (taxableAmount * discountPercentage) / 100;
    //     const discountForNonTaxable = (nonTaxableAmount * discountPercentage) / 100;

    //     const finalTaxableAmount = taxableAmount - discountForTaxable;
    //     const finalNonTaxableAmount = nonTaxableAmount - discountForNonTaxable;

    //     let vatAmount = 0;
    //     if (formData.isVatExempt === 'false' || formData.isVatExempt === 'all') {
    //         vatAmount = (finalTaxableAmount * formData.vatPercentage) / 100;
    //     }

    //     const roundOffAmount = parseFloat(formData.roundOffAmount) || 0;
    //     const totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount + roundOffAmount;

    //     return {
    //         subTotal,
    //         taxableAmount: finalTaxableAmount,
    //         nonTaxableAmount: finalNonTaxableAmount,
    //         vatAmount,
    //         totalAmount
    //     };
    // };

    const calculateTotal = (itemsToCalculate = items) => {
        // Initialize all amounts with proper precision
        let subTotal = 0;
        let taxableAmount = 0;
        let nonTaxableAmount = 0;

        // Calculate item amounts with proper rounding
        itemsToCalculate.forEach(item => {
            const itemAmount = parseFloat(item.amount) || 0;
            subTotal = preciseAdd(subTotal, itemAmount);

            if (item.vatStatus === 'vatable') {
                taxableAmount = preciseAdd(taxableAmount, itemAmount);
            } else {
                nonTaxableAmount = preciseAdd(nonTaxableAmount, itemAmount);
            }
        });

        const discountPercentage = parseFloat(formData.discountPercentage) || 0;
        const discountAmount = parseFloat(formData.discountAmount) || 0;

        // Calculate effective discount (prioritize discount amount if both are provided)
        let effectiveDiscount = 0;
        let discountForTaxable = 0;
        let discountForNonTaxable = 0;

        if (discountAmount > 0) {
            // Use discount amount directly
            effectiveDiscount = discountAmount;

            // Allocate discount proportionally between taxable and non-taxable amounts
            if (subTotal > 0) {
                const taxableRatio = preciseDivide(taxableAmount, subTotal);
                const nonTaxableRatio = preciseDivide(nonTaxableAmount, subTotal);

                discountForTaxable = preciseMultiply(effectiveDiscount, taxableRatio);
                discountForNonTaxable = preciseMultiply(effectiveDiscount, nonTaxableRatio);
            }
        } else if (discountPercentage > 0) {
            // Use discount percentage
            discountForTaxable = preciseMultiply(taxableAmount, preciseDivide(discountPercentage, 100));
            discountForNonTaxable = preciseMultiply(nonTaxableAmount, preciseDivide(discountPercentage, 100));
            effectiveDiscount = preciseAdd(discountForTaxable, discountForNonTaxable);
        }

        // Apply discount
        const finalTaxableAmount = preciseSubtract(taxableAmount, discountForTaxable);
        const finalNonTaxableAmount = preciseSubtract(nonTaxableAmount, discountForNonTaxable);

        // Calculate VAT
        let vatAmount = 0;
        if (formData.isVatExempt === 'false' || formData.isVatExempt === 'all') {
            vatAmount = preciseMultiply(finalTaxableAmount, preciseDivide(formData.vatPercentage, 100));
        }

        // Calculate total before round-off
        let totalBeforeRoundOff = preciseAdd(
            preciseAdd(finalTaxableAmount, finalNonTaxableAmount),
            vatAmount
        );

        const roundOffAmount = parseFloat(formData.roundOffAmount) || 0;
        const totalAmount = preciseAdd(totalBeforeRoundOff, roundOffAmount);

        return {
            subTotal: preciseRound(subTotal, 2),
            taxableAmount: preciseRound(finalTaxableAmount, 2),
            nonTaxableAmount: preciseRound(finalNonTaxableAmount, 2),
            vatAmount: preciseRound(vatAmount, 2),
            totalAmount: preciseRound(totalAmount, 2),
            discountAmount: preciseRound(effectiveDiscount, 2),
            roundOffAmount: preciseRound(roundOffAmount, 2)
        };
    };

    // const handleDiscountPercentageChange = (e) => {
    //     const value = parseFloat(e.target.value) || 0;
    //     const subTotal = calculateTotal().subTotal;
    //     const discountAmount = (subTotal * value) / 100;

    //     setFormData({
    //         ...formData,
    //         discountPercentage: value,
    //         discountAmount: discountAmount.toFixed(2)
    //     });
    // };

    // const handleDiscountAmountChange = (e) => {
    //     const value = parseFloat(e.target.value) || 0;
    //     const subTotal = calculateTotal().subTotal;
    //     const discountPercentage = subTotal > 0 ? (value / subTotal) * 100 : 0;

    //     setFormData({
    //         ...formData,
    //         discountAmount: value,
    //         discountPercentage: discountPercentage.toFixed(2)
    //     });
    // };

    const handleDiscountPercentageChange = (e) => {
        const value = parseFloat(e.target.value) || 0;

        // Validate percentage range
        const validatedValue = Math.min(Math.max(value, 0), 100);

        // Calculate discount amount based on subtotal
        const subTotal = calculateTotal().subTotal;
        const discountAmount = preciseMultiply(subTotal, preciseDivide(validatedValue, 100));

        setFormData({
            ...formData,
            discountPercentage: validatedValue,
            discountAmount: preciseRound(discountAmount, 2)
        });
    };

    const handleDiscountAmountChange = (e) => {
        const value = parseFloat(e.target.value) || 0;
        const subTotal = calculateTotal().subTotal;

        // Validate discount amount doesn't exceed subtotal
        const validatedValue = Math.min(Math.max(value, 0), subTotal);

        // Calculate discount percentage
        const discountPercentage = subTotal > 0 ?
            preciseMultiply(preciseDivide(validatedValue, subTotal), 100) : 0;

        setFormData({
            ...formData,
            discountAmount: validatedValue,
            discountPercentage: preciseRound(discountPercentage, 2)
        });
    };

    // Precision utility functions
    const preciseAdd = (a, b) => {
        return parseFloat((parseFloat(a) + parseFloat(b)).toFixed(10));
    };

    const preciseSubtract = (a, b) => {
        return parseFloat((parseFloat(a) - parseFloat(b)).toFixed(10));
    };

    const preciseMultiply = (a, b) => {
        return parseFloat((parseFloat(a) * parseFloat(b)).toFixed(10));
    };

    const preciseDivide = (a, b) => {
        return b !== 0 ? parseFloat((parseFloat(a) / parseFloat(b)).toFixed(10)) : 0;
    };

    const preciseRound = (value, decimals = 2) => {
        return parseFloat(value.toFixed(decimals));
    };


    // Update the fetch function
    const fetchLastTransactions = async (itemId) => {
        if (!formData.accountId) {
            setNotification({
                show: true,
                message: 'Please select an account first',
                type: 'error'
            });
            return;
        }

        setLoadingItems(prev => new Set(prev).add(itemId));
        setIsLoadingTransactions(true);

        try {
            const cacheKey = `${itemId}-${formData.accountId}`;

            if (transactionCache.has(cacheKey)) {
                const cachedTransactions = transactionCache.get(cacheKey);
                setTransactions(cachedTransactions);
                setShowTransactionModal(true);
                return;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await api.get(`/api/retailer/transactions/${itemId}/${formData.accountId}/Sales`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.data.success) {
                setTransactionCache(prev => new Map(prev.set(cacheKey, response.data.data.transactions)));
                setTransactions(response.data.data.transactions);
                setShowTransactionModal(true);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching transactions:', error);
            }
        } finally {
            setLoadingItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(itemId);
                return newSet;
            });
            setIsLoadingTransactions(false);
        }
    };



    const resetForm = async () => {
        try {
            setIsLoading(true); // Show loading state while refreshing data

            // Fetch fresh data from the backend
            const response = await api.get('/api/retailer/credit-sales');
            const { data } = response;

            // Update all necessary states
            const currentNepaliDate = new NepaliDate().format('YYYY/MM/DD');
            const currentRomanDate = new Date().toISOString().split('T')[0];

            setFormData({
                accountId: '',
                accountName: '',
                accountAddress: '',
                accountPan: '',
                transactionDateNepali: new NepaliDate(currentNepaliDate).format('YYYY-MM-DD'),
                transactionDateRoman: currentRomanDate,
                nepaliDate: new NepaliDate(currentNepaliDate).format('YYYY-MM-DD'),
                billDate: currentRomanDate,
                billNumber: data.data.nextSalesBillNumber,
                paymentMode: 'credit',
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
            setFilteredAccounts([]); // Reset filtered accounts
            setNextBillNumber(data.data.nextSalesBillNumber);
            setItems([]);
            clearSalesDraft();

            // Clear the account search input if it exists
            if (accountSearchRef.current) {
                accountSearchRef.current.value = '';
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
            // Calculate all values before submission
            const calculatedValues = calculateTotal();

            // const billData = {
            //     ...formData,
            //     items: items.map(item => ({
            //         item: item.item,
            //         batchNumber: item.batchNumber,
            //         expiryDate: item.expiryDate,
            //         quantity: item.quantity,
            //         unit: item.unit?._id,
            //         price: item.price,
            //         puPrice: item.puPrice,
            //         netPuPrice: item.netPuPrice || item.puPrice,
            //         vatStatus: item.vatStatus,
            //         uniqueUuId: item.uniqueUuId
            //     })),
            //     print
            // };
            const billData = {
                accountId: formData.accountId,
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
                vatPercentage: formData.vatPercentage,
                transactionDateNepali: formData.transactionDateNepali,
                transactionDateRoman: formData.transactionDateRoman,
                billDate: formData.billDate,
                nepaliDate: formData.nepaliDate,
                paymentMode: formData.paymentMode,
                isVatExempt: formData.isVatExempt,
                discountPercentage: formData.discountPercentage,
                discountAmount: formData.discountAmount,
                roundOffAmount: formData.roundOffAmount,
                // Include calculated values
                subTotal: calculatedValues.subTotal,
                taxableAmount: calculatedValues.taxableAmount,
                nonTaxableAmount: calculatedValues.nonTaxableAmount,
                vatAmount: calculatedValues.vatAmount,
                totalAmount: calculatedValues.totalAmount,
                print
            };

            const response = await api.post('/api/retailer/credit-sales', billData);

            // Clear transaction cache when new bill is saved
            setTransactionCache(new Map());

            setNotification({
                show: true,
                message: 'Sales bill saved successfully!',
                type: 'success'
            });

            setFormData({
                accountId: '',
                accountName: '',
                accountAddress: '',
                accountPan: '',
                transactionDateNepali: currentNepaliDate,
                transactionDateRoman: new Date().toISOString().split('T')[0],
                nepaliDate: currentNepaliDate,
                billDate: new Date().toISOString().split('T')[0],
                billNumber: nextBillNumber,
                paymentMode: 'credit',
                isVatExempt: 'all',
                discountPercentage: 0,
                discountAmount: 0,
                roundOffAmount: 0,
                vatPercentage: 13,
                items: []
            });

            setItems([]);
            clearSalesDraft();

            if (print) {
                setIsSaving(false);
                navigate(`/bills/${response.data.data.bill._id}/direct-print`);
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
            console.error('Error saving sales bill:', error);

            // Handle credit limit error specifically
            if (error.response && error.response.data && error.response.data.error) {
                const errorMsg = error.response.data.error;

                if (errorMsg.includes('Credit limit exceeded')) {
                    setNotification({
                        show: true,
                        message: errorMsg,
                        type: 'error',
                        duration: 10000 // Show for longer
                    });

                    // Optional: Display detailed credit information
                    if (error.response.data.details) {
                        const details = error.response.data.details;
                        console.log('Credit limit details:', details);
                        // You could display this in a more detailed error modal
                    }
                } else {
                    setNotification({
                        show: true,
                        message: 'Failed to save sales bill. Please try again.',
                        type: 'error'
                    });
                }
            } else {
                setNotification({
                    show: true,
                    message: 'Failed to save sales bill. Please try again.',
                    type: 'error'
                });
            }
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

    const handleTransactionModalClose = () => {
        setShowTransactionModal(false);

        // Focus on quantity field of the last added item
        setTimeout(() => {
            if (items.length > 0) {
                const quantityInput = document.getElementById(`quantity-${items.length - 1}`);
                if (quantityInput) {
                    quantityInput.focus();
                    quantityInput.select();
                }
            }
        }, 100);
    };

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (showTransactionModal) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    handleTransactionModalClose();
                }
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);

        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [showTransactionModal, handleTransactionModalClose]);

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
                className="dropdown-menu show w-100"
                style={{
                    maxHeight: '280px',
                    height: '280px',
                    overflow: 'hidden',
                    position: 'absolute',
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
                            Credit Sales Entry
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
                                <label htmlFor="paymentMode">Payment Mode:</label>
                                <select
                                    className="form-control"
                                    name="paymentMode"
                                    id="paymentMode"
                                    value={formData.paymentMode}
                                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'paymentMode');
                                        }
                                    }}
                                >
                                    <option value="credit">credit</option>
                                    <option value="cash">cash</option>
                                </select>
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
                                <label htmlFor="account">Party Name:</label>
                                <input
                                    type="text"
                                    id="account"
                                    name="account"
                                    className="form-control"
                                    value={formData.accountName}
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
                                <AccountBalanceDisplay
                                    accountId={formData.accountId}
                                    api={api}
                                    newTransactionAmount={parseFloat(totals.totalAmount) || 0}
                                    compact={true}
                                    dateFormat={company.dateFormat}
                                />
                                <input type="hidden" id="accountId" name="accountId" value={formData.accountId} />
                            </div>

                            <div className="col">
                                <label htmlFor="address">Party Address:</label>
                                <input
                                    type="text"
                                    id="address"
                                    className="form-control"
                                    value={formData.accountAddress}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'address');
                                        }
                                    }}
                                    readOnly
                                />
                            </div>

                            <div className="col">
                                <label htmlFor="pan">Vat No:</label>
                                <input
                                    type="text"
                                    id="pan"
                                    name="pan"
                                    className="form-control"
                                    value={formData.accountPan}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'pan');
                                        }
                                    }}
                                    readOnly
                                />
                            </div>
                        </div>
                        {/* Add Account Balance Display here
                        <div className="form-group row mb-3">
                            <div className="col-12">
                                <AccountBalanceDisplay
                                    accountId={formData.accountId}
                                    api={api}
                                    compact={true}
                                    dateFormat={company.dateFormat}
                                />
                            </div>
                        </div> */}
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
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-info"
                                                            onClick={() => fetchLastTransactions(item.item)}
                                                            title="View last transactions"
                                                            disabled={isLoadingTransactions}
                                                        >
                                                            {isLoadingTransactions ? (
                                                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: "14px", height: "14px" }}></span>
                                                            ) : (
                                                                <i className="bi bi-clock-history"></i>
                                                            )}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => removeItem(index)}
                                                        >
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    </div>
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

                        {/* Item Search */}
                        <div className="row mb-3">
                            <div className="col-12">
                                <label htmlFor="itemSearch" className="form-label">Search Item</label>
                                <div className="position-relative">
                                    <input
                                        type="text"
                                        id="itemSearch"
                                        className="form-control form-control-sm"
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
                                                <td><label htmlFor="vatPercentage">VAT (13%):</label></td>
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
            </div>

            {/* Account Modal */}
            {showAccountModal && (
                <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content" style={{ height: '500px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title" id="accountModalLabel">Select an Account</h5>
                                <button type="button" className="btn-close" onClick={() => setShowAccountModal(false)}></button>
                            </div>
                            <div className="p-3 bg-white sticky-top">
                                <input
                                    type="text"
                                    id="searchAccount"
                                    className="form-control form-control-sm"
                                    placeholder="Search Account"
                                    autoComplete='off'
                                    autoFocus
                                    onChange={handleAccountSearch}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item');
                                            if (firstAccountItem) {
                                                firstAccountItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item.active');
                                            if (firstAccountItem) {
                                                const accountId = firstAccountItem.getAttribute('data-account-id');
                                                const account = filteredAccounts.length > 0
                                                    ? filteredAccounts.find(a => a._id === accountId)
                                                    : accounts.find(a => a._id === accountId);
                                                if (account) {
                                                    selectAccount(account);
                                                    document.getElementById('address').focus();
                                                }
                                            }
                                        }
                                    }}
                                    ref={accountSearchRef}
                                />
                            </div>
                            <div className="modal-body p-0">
                                <div className="overflow-auto" style={{ height: 'calc(400px - 120px)' }}>
                                    <ul id="accountList" className="list-group">
                                        {filteredAccounts.length > 0 ? (
                                            filteredAccounts.map((account, index) => (
                                                <li
                                                    key={account._id}
                                                    data-account-id={account._id}
                                                    className={`list-group-item account-item py-2 ${index === 0 ? 'active' : ''}`}
                                                    onClick={() => {
                                                        selectAccount(account);
                                                        document.getElementById('address').focus();
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
                                                                accountSearchRef.current.focus();
                                                            }
                                                        } else if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            selectAccount(account);
                                                            document.getElementById('address').focus();
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
                                                        <strong>{account.uniqueNumber || 'N/A'} {account.name}</strong>
                                                        <span>📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}</span>
                                                    </div>
                                                </li>
                                            ))
                                        ) : (
                                            accountSearchRef.current?.value ? (
                                                <li className="list-group-item text-center text-muted small py-2">No accounts found</li>
                                            ) : (
                                                accounts.map((account, index) => (
                                                    <li
                                                        key={account._id}
                                                        data-account-id={account._id}
                                                        className={`list-group-item account-item py-2 ${index === 0 ? 'active' : ''}`}
                                                        onClick={() => {
                                                            selectAccount(account);
                                                            document.getElementById('address').focus();
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
                                                                    accountSearchRef.current.focus();
                                                                }
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                selectAccount(account);
                                                                document.getElementById('address').focus();
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
                                                            <strong>{account.uniqueNumber || 'N/A'} {account.name}</strong>
                                                            <span>📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}</span>
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

            {/* Transaction Modal */}
            {showTransactionModal && (
                <div className="modal fade show" id="transactionModal" tabIndex="-1" style={{ display: 'block' }} role="dialog" aria-labelledby="transactionModalLabel" aria-modal="true">
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title" id="transactionModalLabel">Last Transactions</h5>
                                <button
                                    type="button"
                                    className="close"
                                    onClick={handleTransactionModalClose}
                                    aria-label="Close"
                                >
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div className="modal-body p-0">
                                <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    <table className="table table-sm table-hover mb-0">
                                        <thead>
                                            <tr className="sticky-top bg-light" style={{ top: 0 }}>
                                                <th style={{ width: '5%' }}>S.N.</th>
                                                <th style={{ width: '15%' }}>Date</th>
                                                <th style={{ width: '15%' }}>Inv. No.</th>
                                                <th style={{ width: '10%' }}>Type</th>
                                                <th style={{ width: '10%' }}>A/c Type</th>
                                                <th style={{ width: '10%' }}>Pay.Mode</th>
                                                <th style={{ width: '10%' }}>Qty.</th>
                                                <th style={{ width: '10%' }}>Unit</th>
                                                <th style={{ width: '15%' }}>Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.length > 0 ? (
                                                transactions.map((transaction, index) => (
                                                    <tr
                                                        key={index}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => {
                                                            if (transaction.billId && transaction.billId._id) {
                                                                navigate(`/retailer/sales/${transaction.billId._id}/print`);
                                                            } else if (transaction.purchaseBillId && transaction.purchaseBillId._id) {
                                                                navigate(`/bills/${transaction.purchaseBillId._id}/print`);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (transaction.billId && transaction.billId._id) {
                                                                    navigate(`/bills/${transaction.billId._id}/print`);
                                                                } else if (transaction.purchaseBillId && transaction.purchaseBillId._id) {
                                                                    navigate(`/bills/${transaction.purchaseBillId._id}/print`);
                                                                }
                                                            } else if (e.key === 'Tab') {
                                                                e.preventDefault();
                                                                continueButtonRef.current?.focus();
                                                            }
                                                        }}
                                                        tabIndex={0}
                                                    >
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            {transaction.date ?
                                                                new Date(transaction.date).toLocaleDateString() :
                                                                'N/A'
                                                            }
                                                        </td>
                                                        <td>{transaction.billNumber || 'N/A'}</td>
                                                        <td>{transaction.type || 'N/A'}</td>
                                                        <td>{transaction.purchaseSalesType || 'N/A'}</td>
                                                        <td>{transaction.paymentMode || 'N/A'}</td>
                                                        <td>{transaction.quantity || 0}</td>
                                                        <td>{transaction.unit?.name || 'N/A'}</td>
                                                        <td>Rs.{transaction.price ? Math.round(transaction.price * 100) / 100 : 0}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="9" className="text-center text-muted py-3">
                                                        No previous transactions found
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Show row count information */}
                                {transactions.length > 5 && (
                                    <div className="text-center small text-muted mt-2">
                                        Showing {transactions.length} transactions. Scroll to see more.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button
                                    ref={continueButtonRef}
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleTransactionModalClose}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleTransactionModalClose();
                                        } else if (e.key === 'Tab' && !e.shiftKey) {
                                            e.preventDefault();
                                            // Loop back to first transaction row
                                            const firstTransactionRow = document.querySelector('tbody tr');
                                            if (firstTransactionRow) {
                                                firstTransactionRow.focus();
                                            }
                                        }
                                    }}
                                >
                                    Continue
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
        </div>
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

export default AddSales;