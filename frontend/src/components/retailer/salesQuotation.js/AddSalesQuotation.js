import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';

import axios from 'axios';
import Header from '../Header';
// import '../../../stylesheet/retailer/salesQuotation/AddSalesQuotation.css'
import NotificationToast from '../../NotificationToast';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
import '../../../stylesheet/noDateIcon.css'
import ProductModal from '../dashboard/modals/ProductModal';
import AccountBalanceDisplay from '../payment/AccountBalanceDisplay';

import useDebounce from '../../../hooks/useDebounce';
import VirtualizedItemList from '../../VirtualizedItemList';

const AddSalesQuotation = () => {
    const { salesQuotationDraftSave, setSalesQuotationDraftSave, clearSalesQuotationDraft } = usePageNotRefreshContext();
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
    const navigate = useNavigate();
    const [printAfterSave, setPrintAfterSave] = useState(
        localStorage.getItem('printAfterSave') === 'true' || false
    );
    const [showAccountCreationModal, setShowAccountCreationModal] = useState(false);
    const [showItemsModal, setShowItemsModal] = useState(false);
    const [pollInterval, setPollInterval] = useState(null);

    const continueButtonRef = useRef(null);
    const [transactionCache, setTransactionCache] = useState(new Map());
    const [loadingItems, setLoadingItems] = useState(new Set());
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const transactionDateRef = useRef(null);
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
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
    const [showProductModal, setShowProductModal] = useState(false);
    const [formData, setFormData] = useState(salesQuotationDraftSave?.formData || {
        accountId: '',
        accountName: '',
        accountAddress: '',
        accountPan: '',
        transactionDateNepali: currentNepaliDate,
        transactionDateRoman: new Date().toISOString().split('T')[0],
        nepaliDate: currentNepaliDate,
        billDate: new Date().toISOString().split('T')[0],
        billNumber: '',
        paymentMode: 'credit',
        isVatExempt: 'all',
        discountPercentage: 0,
        discountAmount: 0,
        roundOffAmount: 0,
        vatPercentage: 13,
        description: '',
        items: []
    });

    const [items, setItems] = useState(salesQuotationDraftSave?.items || []);
    const [allItems, setAllItems] = useState([]);
    const [accounts, setAccounts] = useState(salesQuotationDraftSave?.accounts || []);
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

    // Add function to fetch items
    const fetchItems = async () => {
        try {
            const response = await api.get('/api/retailer/items');
            if (response.data.success) {
                const sortedItems = response.data.items.sort((a, b) => a.name.localeCompare(b.name));
                setAllItems(sortedItems);

                // Update filtered items based on current search
                if (itemSearchRef.current?.value) {
                    handleItemSearch({ target: { value: itemSearchRef.current.value } });
                }
            }
        } catch (error) {
            console.error('Error fetching items:', error);
        }
    };

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

    useEffect(() => {
        if (showItemsModal) {
            const interval = setInterval(fetchItems, 2000); // Poll every 2 seconds
            setPollInterval(interval);
        } else {
            if (pollInterval) {
                clearInterval(pollInterval);
                setPollInterval(null);
            }
        }

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [showItemsModal]);

    useEffect(() => {
        // Save draft to session storage whenever form data or items change
        if (formData.accountId || items.length > 0) {
            setSalesQuotationDraftSave({
                formData,
                items,
                accounts
            });
        }
    }, [formData, items, accounts, setSalesQuotationDraftSave]);

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

    // useEffect(() => {
    //     const handleF6KeyForItems = (e) => {
    //         if (e.key === 'F6' && document.activeElement === itemSearchRef.current) {
    //             e.preventDefault();
    //             setShowItemsModal(true);
    //         }
    //     };

    //     window.addEventListener('keydown', handleF6KeyForItems);
    //     return () => {
    //         window.removeEventListener('keydown', handleF6KeyForItems);
    //     };
    // }, []);

    useEffect(() => {
        const handleF6KeyForItems = (e) => {
            if (e.key === 'F6' && document.activeElement === itemSearchRef.current) {
                e.preventDefault();
                setShowItemsModal(true);
                // Clear search when opening modal
                setSearchQuery('');
                if (itemSearchRef.current) {
                    itemSearchRef.current.value = '';
                }
                setShowItemDropdown(false);
            }
        };

        window.addEventListener('keydown', handleF6KeyForItems);
        return () => {
            window.removeEventListener('keydown', handleF6KeyForItems);
        };
    }, []);


    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/retailer/sales-quotation');
                const { data } = response;

                const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
                const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));

                setCompany(data.data.company);
                setAllItems(sortedItems);
                setAccounts(sortedAccounts);
                setNextBillNumber(data.data.nextQuotationNumber);

                setFormData(prev => ({
                    ...prev,
                    billNumber: data.data.nextQuotationNumber
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
            (account.uniqueNumber && account.uniqueNumber.toString().toLowerCase().includes(searchText)) ||
            (account.pan && account.pan.toString().toLowerCase().includes(searchText))
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

        const sortedStockEntries = item.stockEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstStockEntry = sortedStockEntries[0] || {};

        const newItem = {
            item: item._id,
            uniqueNumber: item.uniqueNumber || 'N/A',
            hscode: item.hscode,
            name: item.name,
            category: item.category?.name || 'No Category',
            quantity: 0,
            unit: item.unit,
            price: firstStockEntry.price || 0,
            puPrice: firstStockEntry.puPrice || 0,
            netPuPrice: firstStockEntry.netPuPrice || 0,
            amount: 0,
            vatStatus: item.vatStatus,
            uniqueUuId: firstStockEntry.uniqueUuId
        };

        setItems([...items, newItem]);
        setShowItemDropdown(false);
        itemSearchRef.current.value = '';

        // Clear search after adding item
        setSearchQuery('');
        if (itemSearchRef.current) {
            itemSearchRef.current.value = '';
        }

        // Update the transaction fetching part for SALES QUOTATION
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


        setTimeout(() => {
            const descriptionInput = document.getElementById(`description-${items.length}`);
            if (descriptionInput) {
                descriptionInput.focus();
                descriptionInput.select();
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

    const removeItem = (index) => {
        const updatedItems = items.filter((_, i) => i !== index);
        setItems(updatedItems);
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

    useEffect(() => {
        if (showTransactionModal && continueButtonRef.current) {
            const timer = setTimeout(() => {
                continueButtonRef.current.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showTransactionModal]);

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
            setIsLoading(true);

            const response = await api.get('/api/retailer/sales-quotation');
            const { data } = response;

            const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
            const currentRomanDate = new Date().toISOString().split('T')[0];

            setFormData({
                accountId: '',
                accountName: '',
                accountAddress: '',
                accountPan: '',
                transactionDateNepali: currentNepaliDate,
                transactionDateRoman: currentRomanDate,
                nepaliDate: currentNepaliDate,
                billDate: currentRomanDate,
                billNumber: data.data.nextQuotationNumber,
                paymentMode: 'credit',
                isVatExempt: 'all',
                discountPercentage: 0,
                discountAmount: 0,
                roundOffAmount: 0,
                vatPercentage: 13,
                description: '',
                items: []
            });

            setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
            const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
            setAccounts(sortedAccounts);
            setFilteredAccounts([]);
            setNextBillNumber(data.data.nextQuotationNumber);
            setItems([]);
            clearSalesQuotationDraft();

            if (accountSearchRef.current) {
                accountSearchRef.current.value = '';
            }

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
        setIsSaving(true);

        try {
            const quotationData = {
                ...formData,
                items: items.map(item => ({
                    item: item.item,
                    quantity: item.quantity,
                    unit: item.unit?._id,
                    price: item.price,
                    puPrice: item.puPrice,
                    netPuPrice: item.netPuPrice,
                    vatStatus: item.vatStatus,
                    uniqueUuId: item.uniqueUuId,
                    description: item.description
                })),
                print
            };

            const response = await api.post('/api/retailer/sales-quotation', quotationData);

            setNotification({
                show: true,
                message: 'Sales quotation saved successfully!',
                type: 'success'
            });

            setFormData({
                accountId: '',
                accountName: '',
                accountAddress: '',
                accountPan: '',
                transactionDateNepali: formData.transactionDateNepali,
                transactionDateRoman: new Date().toISOString().split('T')[0],
                nepaliDate: formData.nepaliDate,
                billDate: new Date().toISOString().split('T')[0],
                billNumber: nextBillNumber,
                paymentMode: 'credit',
                isVatExempt: 'all',
                discountPercentage: 0,
                discountAmount: 0,
                roundOffAmount: 0,
                vatPercentage: 13,
                description: '',
                items: []
            });

            setItems([]);
            clearSalesQuotationDraft();

            if (print && response.data.data?.quotation?._id) {
                setItems([]);
                setIsSaving(false);
                resetForm()
                await printQuotationImmediately(response.data.data.quotation._id);
            } else {
                setItems([]);
                setIsSaving(false);
                resetForm()
                setTimeout(() => {
                    if (transactionDateRef.current) {
                        transactionDateRef.current.focus();
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error saving sales quotation:', error);
            setNotification({
                show: true,
                message: 'Failed to save sales quotation. Please try again.',
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

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/api/retailer/fetchlatest/accounts');
            const sortedAccounts = response.data.sort((a, b) => a.name.localeCompare(b.name));
            setAccounts(sortedAccounts);
            setFilteredAccounts(sortedAccounts);
        } catch (error) {
            console.error('Error fetching accounts:', error);
            setNotification({
                show: true,
                message: 'Error refreshing accounts',
                type: 'error'
            });
        }
    };

    const handleTransactionModalClose = () => {
        setShowTransactionModal(false);

        // Focus on quantity field of the last added item
        setTimeout(() => {
            if (items.length > 0) {
                const descriptionInput = document.getElementById(`description-${items.length - 1}`);
                if (descriptionInput) {
                    descriptionInput.focus();
                    descriptionInput.select();
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
            } else if (showAccountCreationModal && e.key === 'Escape') {
                e.preventDefault();
                setShowAccountCreationModal(false);
                setShowAccountModal(true);
            } else if (showAccountModal && e.key === 'F6') {
                e.preventDefault();
                setShowAccountCreationModal(true);
                setShowAccountModal(false);
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [showTransactionModal, showAccountCreationModal, showAccountModal, handleTransactionModalClose]);


    const handleAccountCreationModalClose = () => {
        setShowAccountCreationModal(false);
        setShowAccountModal(true);

        // Refresh accounts data
        fetchAccounts();
    };

    const printQuotationImmediately = async (quotationId) => {
        try {
            const response = await api.get(`/api/retailer/sales-quotation/${quotationId}/print`);
            const printData = response.data.data;

            // Create a temporary div to hold the print content
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            document.body.appendChild(tempDiv);

            // Create the printable content
            tempDiv.innerHTML = `
      <div id="printableContent">
        <div class="print-quotation-container">
          <div class="print-quotation-header">
            <div class="print-company-name">${printData.currentCompanyName}</div>
            <div class="print-company-details">
              ${printData.currentCompany.address} | Tel: ${printData.currentCompany.phone} | PAN: ${printData.currentCompany.pan}
            </div>
            <div class="print-quotation-title">SALES QUOTATION</div>
          </div>

          <div class="print-quotation-details">
            <div>
              <div><strong>M/S:</strong> ${printData.salesQuotation.account?.name || printData.salesQuotation.cashAccount || 'Account Not Found'}</div>
              <div><strong>Address:</strong> ${printData.salesQuotation.account?.address || printData.salesQuotation.cashAccountAddress || 'N/A'}</div>
              <div><strong>PAN:</strong> ${printData.salesQuotation.account?.pan || printData.salesQuotation.cashAccountPan || 'N/A'} | <strong>Tel:</strong> ${printData.salesQuotation.account?.phone || printData.salesQuotation.cashAccountPhone || 'N/A'}</div>
              <div><strong>Email:</strong> ${printData.salesQuotation.account?.email || printData.salesQuotation.cashAccountEmail || 'N/A'}</div>
            </div>
            <div>
              <div><strong>Quotation No:</strong> ${printData.salesQuotation.billNumber}</div>
              <div><strong>Validity Periods:</strong> ${new Date(printData.salesQuotation.transactionDate).toLocaleDateString()}</div>
              <div><strong>Quotation Issue Date:</strong> ${new Date(printData.salesQuotation.date).toLocaleDateString()}</div>
              <div><strong>Mode of Payment:</strong> ${printData.salesQuotation.paymentMode}</div>
            </div>
          </div>

          <table class="print-quotation-table">
            <thead>
              <tr>
                <th>S.N.</th>
                <th>#</th>
                <th>HSN</th>
                <th>Description of Goods</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate (Rs.)</th>
                <th>Total (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              ${printData.salesQuotation.items.map((item, i) => `
                <tr key="${i}">
                  <td>${i + 1}</td>
                  <td>${item.item.uniqueNumber}</td>
                  <td>${item.item.hscode}</td>
                  <td>
                    ${item.item.vatStatus === 'vatExempt' ?
                    `${item.item.name} *` :
                    item.item.name
                }
                  </td>
                  <td>${item.description ? item.description : ''}</td>
                  <td>${item.quantity}</td>
                  <td>${item.item.unit?.name || ''}</td>
                  <td>${item.price.toFixed(2)}</td>
                  <td>${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tr>
              <td colSpan="9" style="border-bottom: 1px solid #000"></td>
            </tr>
          </table>

          <table class="print-totals-table">
            <tbody>
              <tr>
                <td><strong>Sub-Total:</strong></td>
                <td class="print-text-right">${printData.salesQuotation.subTotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Discount (${printData.salesQuotation.discountPercentage}%):</strong></td>
                <td class="print-text-right">${printData.salesQuotation.discountAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Non-Taxable:</strong></td>
                <td class="print-text-right">${printData.salesQuotation.nonVatSales.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Taxable Amount:</strong></td>
                <td class="print-text-right">${printData.salesQuotation.taxableAmount.toFixed(2)}</td>
              </tr>
              ${!printData.salesQuotation.isVatExempt ? `
                <tr>
                  <td><strong>VAT (${printData.salesQuotation.vatPercentage}%):</strong></td>
                  <td class="print-text-right">${(printData.salesQuotation.taxableAmount * printData.salesQuotation.vatPercentage / 100).toFixed(2)}</td>
                </tr>
              ` : ''}
              <tr>
                <td><strong>Round Off:</strong></td>
                <td class="print-text-right">${printData.salesQuotation.roundOffAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Grand Total:</strong></td>
                <td class="print-text-right">${printData.salesQuotation.totalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="print-amount-in-words">
            <strong>In Words:</strong> ${convertToRupeesAndPaisa(printData.salesQuotation.totalAmount)} Only.
          </div>

          ${printData.salesQuotation.description ? `
            <div class="mt-3 print-note">
              <strong>Note:</strong> ${printData.salesQuotation.description}
            </div>
          ` : ''}

          <div class="print-signature-area">
            <div class="print-signature-box">Received By</div>
            <div class="print-signature-box">Prepared By: ${printData.salesQuotation.user.name}</div>
            <div class="print-signature-box">For: ${printData.currentCompanyName}</div>
          </div>
        </div>
      </div>
    `;

            // Add print styles
            const styles = `
      @page {
        size: A4;
        margin: 5mm;
      }
      body {
        font-family: 'Arial Narrow', Arial, sans-serif;
        font-size: 9pt;
        line-height: 1.2;
        color: #000;
        background: white;
        margin: 0;
        padding: 0;
      }
      .print-quotation-container {
        width: 100%;
        max-width: 210mm;
        margin: 0 auto;
        padding: 2mm;
      }
      .print-quotation-header {
        text-align: center;
        margin-bottom: 3mm;
        border-bottom: 1px solid #000;
        padding-bottom: 2mm;
      }
      .print-quotation-title {
        font-size: 12pt;
        font-weight: bold;
        margin: 2mm 0;
        text-transform: uppercase;
      }
      .print-company-name {
        font-size: 16pt;
        font-weight: bold;
      }
      .print-company-details {
        font-size: 8pt;
        margin: 1mm 0;
        font-weight: bold;
      }
      .print-quotation-details {
        display: flex;
        justify-content: space-between;
        margin: 2mm 0;
        font-size: 8pt;
      }
      .print-quotation-table {
        width: 100%;
        border-collapse: collapse;
        margin: 3mm 0;
        font-size: 8pt;
        border: none;
      }
      .print-quotation-table thead {
        border-top: 1px solid #000;
        border-bottom: 1px solid #000;
      }
      .print-quotation-table th {
        background-color: transparent;
        border: none;
        padding: 1mm;
        text-align: left;
        font-weight: bold;
      }
      .print-quotation-table td {
        border: none;
        padding: 1mm;
        border-bottom: 1px solid #eee;
      }
      .print-text-right {
        text-align: right;
      }
      .print-text-center {
        text-align: center;
      }
      .print-amount-in-words {
        font-size: 8pt;
        margin: 2mm 0;
        padding: 1mm;
        border: 1px dashed #000;
      }
      .print-signature-area {
        display: flex;
        justify-content: space-between;
        margin-top: 5mm;
        font-size: 8pt;
      }
      .print-signature-box {
        text-align: center;
        width: 30%;
        border-top: 1px solid #000;
        padding-top: 1mm;
        font-weight: bold;
      }
      .print-totals-table {
        width: 60%;
        margin-left: auto;
        border-collapse: collapse;
        font-size: 8pt;
      }
      .print-totals-table td {
        padding: 1mm;
      }
    `;

            // Create print window
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
      <html>
        <head>
          <title>Sales_Quotation_${printData.salesQuotation.billNumber}</title>
          <style>${styles}</style>
        </head>
        <body>
          ${tempDiv.innerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 200);
            };
          </script>
        </body>
      </html>
    `);
            printWindow.document.close();

            // Clean up
            document.body.removeChild(tempDiv);
        } catch (error) {
            console.error('Error fetching print data:', error);
            setNotification({
                show: true,
                message: 'Quotation saved but failed to load print data',
                type: 'warning'
            });
        }
    };

    const handlePrintAfterSaveChange = (e) => {
        const isChecked = e.target.checked;
        setPrintAfterSave(isChecked);
        localStorage.setItem('printAfterSave', isChecked);
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
        <div className="container-fluid px-0">
            <Header />
            <div className="container-fluid px-2 px-md-3 py-2">
                <div className="card mt-2 shadow-lg">
                    <div className="card-header bg-primary text-white">
                        <div className="d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">Sales Quotation</h5>
                            <div>
                                {formData.billNumber === '' && (
                                    <span className="badge bg-danger me-2">Quotation number is required!</span>
                                )}
                                {dateErrors.transactionDateNepali && (
                                    <span className="badge bg-danger me-2">{dateErrors.transactionDateNepali}</span>
                                )}
                                {dateErrors.nepaliDate && (
                                    <span className="badge bg-danger">{dateErrors.nepaliDate}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="card-body p-2 p-md-3">
                        <form onSubmit={handleSubmit} id="quotationForm" className="needs-validation" noValidate>
                            {/* Date and Basic Info Row */}
                            <div className="row g-2 mb-3">
                                {company.dateFormat === 'nepali' ? (
                                    <>
                                        <div className="col-12 col-md-6 col-lg-3">
                                            <label htmlFor="transactionDateNepali" className="form-label">Validity Periods:</label>
                                            <input
                                                type="text"
                                                name="transactionDateNepali"
                                                id="transactionDateNepali"
                                                ref={company.dateFormat === 'nepali' ? transactionDateRef : null}
                                                autoComplete='off'
                                                className={`form-control form-control-sm no-date-icon ${dateErrors.transactionDateNepali ? 'is-invalid' : ''}`}
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
                                        <div className="col-12 col-md-6 col-lg-3">
                                            <label htmlFor="nepaliDate" className="form-label">Quotation Date:</label>
                                            <input
                                                type="text"
                                                name="nepaliDate"
                                                id="nepaliDate"
                                                autoComplete='off'
                                                className={`form-control form-control-sm no-date-icon ${dateErrors.nepaliDate ? 'is-invalid' : ''}`}
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
                                        <div className="col-12 col-md-6 col-lg-3">
                                            <label htmlFor="transactionDateRoman" className="form-label">Transaction Date:</label>
                                            <input
                                                type="date"
                                                name="transactionDateRoman"
                                                id="transactionDateRoman"
                                                className="form-control form-control-sm"
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
                                        <div className="col-12 col-md-6 col-lg-3">
                                            <label htmlFor="billDate" className="form-label">Quotation Date:</label>
                                            <input
                                                type="date"
                                                name="billDate"
                                                id="billDate"
                                                className="form-control form-control-sm"
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

                                <div className="col-12 col-md-6 col-lg-2">
                                    <label htmlFor="billNumber" className="form-label">Quot. No:</label>
                                    <input
                                        type="text"
                                        name="billNumber"
                                        id="billNumber"
                                        className="form-control form-control-sm"
                                        value={formData.billNumber}
                                        readOnly
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleKeyDown(e, 'billNumber');
                                            }
                                        }}
                                    />
                                </div>

                                <div className="col-12 col-md-6 col-lg-2">
                                    <label htmlFor="paymentMode" className="form-label">Payment Mode:</label>
                                    <select
                                        className="form-select form-select-sm"
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

                                <div className="col-12 col-md-6 col-lg-2">
                                    <label htmlFor="isVatExempt" className="form-label">VAT</label>
                                    <select
                                        className="form-select form-select-sm"
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

                            {/* Party Information Row */}
                            <div className="row g-2 mb-3">
                                <div className="col-12 col-md-6">
                                    <label htmlFor="account" className="form-label">Party Name:</label>
                                    <input
                                        type="text"
                                        id="account"
                                        name="account"
                                        className="form-control form-control-sm"
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
                                        compact={true}
                                        dateFormat={company.dateFormat}
                                    />
                                    <input type="hidden" id="accountId" name="accountId" value={formData.accountId} />
                                </div>

                                <div className="col-12 col-md-3">
                                    <label htmlFor="address" className="form-label">Party Address:</label>
                                    <input
                                        type="text"
                                        id="address"
                                        className="form-control form-control-sm"
                                        value={formData.accountAddress}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleKeyDown(e, 'address');
                                            }
                                        }}
                                        readOnly
                                    />
                                </div>

                                <div className="col-12 col-md-3">
                                    <label htmlFor="pan" className="form-label">Vat No:</label>
                                    <input
                                        type="text"
                                        id="pan"
                                        name="pan"
                                        className="form-control form-control-sm"
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

                            <hr className="my-2" />

                            {/* Items Table */}
                            <div className="table-responsive mb-3" style={{ maxHeight: "300px", overflowY: "auto" }}>
                                <table className="table table-sm table-bordered table-hover">
                                    <thead className="sticky-top bg-light">
                                        <tr>
                                            <th width="5%">S.N.</th>
                                            <th width="8%">#</th>
                                            <th width="8%">HSN</th>
                                            <th width="25%">Description of Goods</th>
                                            <th width="20%">Description</th>
                                            <th width="8%">Qty</th>
                                            <th width="8%">Unit</th>
                                            <th width="8%">Rate</th>
                                            <th width="10%">Amount</th>
                                            <th width="5%">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody id="items">
                                        {items.map((item, index) => (
                                            <tr key={index} className={`item ${item.vatStatus === 'vatable' ? 'vatable-item' : 'non-vatable-item'}`}>
                                                <td>{index + 1}</td>
                                                <td>{item.uniqueNumber}</td>
                                                <td>
                                                    <input type="hidden" name={`items[${index}][hscode]`} value={item.hscode || ''} />
                                                    {item.hscode || ''}
                                                </td>
                                                <td>
                                                    <input type="hidden" name={`items[${index}][item]`} value={item.item} />
                                                    {item.name}
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        name={`items[${index}][description]`}
                                                        className="form-control form-control-sm"
                                                        autoComplete='off'
                                                        id={`description-${index}`}
                                                        onChange={(e) => updateItemField(index, 'description', e.target.value)}
                                                        required
                                                        onFocus={(e) => {
                                                            e.target.select();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                document.getElementById(`quantity-${index}`)?.focus();
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        name={`items[${index}][quantity]`}
                                                        className="form-control form-control-sm"
                                                        id={`quantity-${index}`}
                                                        value={item.quantity}
                                                        onChange={(e) => updateItemField(index, 'quantity', e.target.value)}
                                                        required
                                                        onFocus={(e) => {
                                                            e.target.select();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                document.getElementById(`price-${index}`)?.focus();
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td className="text-nowrap">
                                                    {item.unit?.name}
                                                    <input type="hidden" name={`items[${index}][unit]`} value={item.unit?._id} />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        name={`items[${index}][price]`}
                                                        className="form-control form-control-sm"
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
                                                <td className="text-center">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-info py-0 px-1"
                                                        onClick={() => fetchLastTransactions(item.item)}
                                                        title="View last transactions"
                                                        disabled={isLoadingTransactions}
                                                    >
                                                        {isLoadingTransactions ? (
                                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: "10px", height: "10px" }}></span>
                                                        ) : (
                                                            <i className="bi bi-clock-history"></i>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-danger py-0 px-1"
                                                        onClick={() => removeItem(index)}
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </td>
                                                <td className="d-none">
                                                    <input type="hidden" name={`items[${index}][vatStatus]`} value={item.vatStatus} />
                                                    <input type="hidden" name={`items[${index}][puPrice]`} value={item.puPrice} />
                                                    <input type="hidden" name={`items[${index}][netPuPrice]`} value={item.netPuPrice} />
                                                    <input type="hidden" name={`items[${index}][uniqueUuId]`} value={item.uniqueUuId} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <hr className="my-2" />

                            {/* Item Search */}
                            {/* <div className="row mb-3">
                                <div className="col-12">
                                    <label htmlFor="itemSearch" className="form-label">Search Item</label>
                                    <div className="position-relative">
                                        <input
                                            type="text"
                                            id="itemSearch"
                                            className="form-control form-control-sm"
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
                                                className="dropdown-menu show w-100"
                                                style={{
                                                    maxHeight: '280px',
                                                    height: '280px',
                                                    overflowY: 'auto',
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
                                                            <div>Rs.{item.stockEntries?.[0]?.price || 0}</div>
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

                            {/* Totals Section */}
                            <div className="table-responsive mb-3">
                                <table className="table table-sm table-bordered">
                                    <thead>
                                        <tr>
                                            <th colSpan="6" className="text-center bg-light">Bill Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><label htmlFor="subTotal" className="form-label mb-0">Sub Total:</label></td>
                                            <td>
                                                <p className="form-control-plaintext mb-0">Rs. {totals.subTotal.toFixed(2)}</p>
                                            </td>
                                            <td><label htmlFor="discountPercentage" className="form-label mb-0">Discount %:</label></td>
                                            <td>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    name="discountPercentage"
                                                    id="discountPercentage"
                                                    className="form-control form-control-sm"
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
                                            <td><label htmlFor="discountAmount" className="form-label mb-0">Discount (Rs.):</label></td>
                                            <td>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    name="discountAmount"
                                                    id="discountAmount"
                                                    value={formData.discountAmount}
                                                    className="form-control form-control-sm"
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
                                                    <td><label htmlFor="taxableAmount" className="form-label mb-0">Taxable Amount:</label></td>
                                                    <td>
                                                        <p className="form-control-plaintext mb-0">Rs. {totals.taxableAmount.toFixed(2)}</p>
                                                    </td>
                                                    <td><label htmlFor="vatPercentage" className="form-label mb-0">VAT %:</label></td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            name="vatPercentage"
                                                            id="vatPercentage"
                                                            className="form-control form-control-sm"
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
                                                    <td><label htmlFor="vatAmount" className="form-label mb-0">VAT Amount:</label></td>
                                                    <td>
                                                        <p className="form-control-plaintext mb-0">Rs. {totals.vatAmount.toFixed(2)}</p>
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
                                            <td><label htmlFor="roundOffAmount" className="form-label mb-0">Round Off:</label></td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="form-control form-control-sm"
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
                                                            document.getElementById('description')?.focus();
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td><label htmlFor="totalAmount" className="form-label mb-0">Total Amount:</label></td>
                                            <td>
                                                <p className="form-control-plaintext mb-0">Rs. {totals.totalAmount.toFixed(2)}</p>
                                            </td>
                                            <td><label htmlFor="amountInWords" className="form-label mb-0">In Words:</label></td>
                                            <td>
                                                <p className="form-control-plaintext mb-0" id="amountInWords">
                                                    {convertToRupeesAndPaisa(totals.totalAmount)} Only.
                                                </p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Description */}
                            <div className="mb-3">
                                <label htmlFor="description" className="form-label">Description</label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    autoComplete="off"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            document.getElementById('saveQuotation')?.focus();
                                        }
                                    }}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="d-flex justify-content-end gap-2">
                                {/* Print After Save Checkbox */}
                                <div className="form-check mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="printAfterSave"
                                        checked={printAfterSave}
                                        onChange={handlePrintAfterSaveChange}
                                    />
                                    <label className="form-check-label" htmlFor="printAfterSave">
                                        Print after save
                                    </label>
                                </div>

                                {/* Action Buttons */}
                                <div className="d-flex justify-content-end gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={resetForm}
                                        disabled={isSaving}
                                    >
                                        <i className="bi bi-arrow-counterclockwise me-1"></i> Reset
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-sm"
                                        id="saveQuotation"
                                        disabled={isSaving}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSubmit(e, printAfterSave);
                                            }
                                        }}
                                    >
                                        {isSaving ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-save me-1"></i> Save
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div >

            {/* Account Modal */}
            {
                showAccountModal && (
                    <div
                        className="modal fade show"
                        id="accountModal"
                        tabIndex="-1"
                        style={{ display: 'block' }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setShowAccountModal(false);

                                setTimeout(() => {
                                    document.getElementById('address').focus();
                                }, 0);
                            }
                        }}
                    >
                        <div className="modal-dialog modal-xl modal-dialog-centered">
                            <div className="modal-content" style={{ height: '500px' }}>
                                <div className="modal-header">
                                    <h5 className="modal-title" id="accountModalLabel">Select an Account</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setShowAccountModal(false)}
                                        aria-label="Close"
                                    ></button>
                                </div>
                                <div className="p-3 bg-white sticky-top">
                                    <input
                                        type="text"
                                        id="searchAccount"
                                        className="form-control form-control-sm"
                                        placeholder="Search Account"
                                        autoFocus
                                        autoComplete='off'
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
                                                            } else if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                setShowAccountModal(false);
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
                                                                } else if (e.key === 'Escape') {
                                                                    e.preventDefault();
                                                                    setShowAccountModal(false);
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
                )
            }

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

            {showAccountCreationModal && (
                <div className="modal fade show" tabIndex="-1" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <div className="modal-dialog modal-fullscreen">
                        <div className="modal-content" style={{ height: '95vh', margin: '2.5vh auto' }}>
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">Create New Account</h5>
                                <div className="d-flex align-items-center">
                                    <button
                                        type="button"
                                        className="btn-close btn-close-white"
                                        onClick={handleAccountCreationModalClose}
                                    ></button>
                                </div>
                            </div>
                            <div className="modal-body p-0">
                                <iframe
                                    src="/retailer/accounts"
                                    title="Account Creation"
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                />
                            </div>
                            <div className="modal-footer bg-light">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleAccountCreationModalClose}
                                >
                                    <i className="bi bi-arrow-left me-2"></i>Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Items Modal */}
            {showItemsModal && (
                <div className="modal fade show" tabIndex="-1" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <div className="modal-dialog modal-fullscreen">
                        <div className="modal-content" style={{ height: '95vh', margin: '2.5vh auto' }}>
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">Create New Item</h5>
                                <div className="d-flex align-items-center">
                                    <button
                                        type="button"
                                        className="btn-close btn-close-white"
                                        onClick={() => setShowItemsModal(false)}
                                    ></button>
                                </div>
                            </div>
                            <div className="modal-body p-0">
                                <iframe
                                    src="/retailer/items"
                                    title="Item Creation"
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                />
                            </div>
                            <div className="modal-footer bg-light">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowItemsModal(false)}
                                >
                                    <i className="bi bi-arrow-left me-2"></i>Close
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

export default AddSalesQuotation;