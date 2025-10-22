import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';
import Header from '../Header';
import NotificationToast from '../../NotificationToast';
import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
import '../../../stylesheet/noDateIcon.css'
import ProductModal from '../dashboard/modals/ProductModal';
import AccountBalanceDisplay from '../payment/AccountBalanceDisplay';

import useDebounce from '../../../hooks/useDebounce';
import VirtualizedItemList from '../../VirtualizedItemList';

const EditSalesQuotation = () => {
    const { id } = useParams();
    const navigate = useNavigate();
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
    const continueButtonRef = useRef(null);
    const [transactionCache, setTransactionCache] = useState(new Map());
    const [loadingItems, setLoadingItems] = useState(new Set());
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const itemSearchRef = useRef(null);
    const accountSearchRef = useRef(null);
    const [showAccountCreationModal, setShowAccountCreationModal] = useState(false);
    const [showItemsModal, setShowItemsModal] = useState(false);
    const [pollInterval, setPollInterval] = useState(null);
    const [showTransactionModal, setShowTransactionModal] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const itemDropdownRef = useRef(null);
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
        accountId: '',
        accountName: '',
        accountAddress: '',
        accountPan: '',
        transactionDateNepali: '',
        transactionDateRoman: '',
        nepaliDate: '',
        billDate: '',
        billNumber: '',
        paymentMode: 'credit',
        isVatExempt: 'all',
        discountPercentage: 0,
        discountAmount: 0,
        roundOffAmount: 0,
        vatPercentage: 13,
        items: []
    });
    const [showProductModal, setShowProductModal] = useState(false);
    const [items, setItems] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [filteredAccounts, setFilteredAccounts] = useState([]);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const [filteredItems, setFilteredItems] = useState([]);

    const [company, setCompany] = useState({
        dateFormat: 'english',
        vatEnabled: true,
        fiscalYear: {}
    });

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

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
        // When VAT selection changes or items are loaded, update the filtered items
        const filtered = allItems.filter(item => {
            if (formData.isVatExempt === 'all') return true;
            if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
            if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
            return true;
        });
        setFilteredItems(filtered);
    }, [formData.isVatExempt, allItems]);

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

    useEffect(() => {
        const fetchSalesQuotationData = async () => {
            try {
                const response = await api.get(`/api/retailer/sales-quotation/edit/${id}`);
                const { data } = response;

                const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));

                setCompany(data.data.company);
                setAllItems(sortedItems);
                setAccounts(data.data.accounts || []);

                const salesQuotation = data.data.salesQuotation;
                const dateFormat = data.data.company.dateFormat;

                setFormData({
                    accountId: salesQuotation.account._id,
                    accountName: salesQuotation.account.name,
                    accountAddress: salesQuotation.account.address,
                    accountPan: salesQuotation.account.pan,
                    transactionDateNepali: dateFormat === 'nepali' ?
                        new NepaliDate(salesQuotation.transactionDate).format('YYYY-MM-DD') : '',
                    transactionDateRoman: dateFormat !== 'nepali' ?
                        new Date(salesQuotation.transactionDate).toISOString().split('T')[0] : '',
                    nepaliDate: dateFormat === 'nepali' ?
                        salesQuotation.date : '',
                    billDate: dateFormat !== 'nepali' ?
                        new Date(salesQuotation.date).toISOString().split('T')[0] : '',
                    billNumber: salesQuotation.billNumber,
                    paymentMode: salesQuotation.paymentMode,
                    isVatExempt: salesQuotation.isVatExempt ? 'true' :
                        (salesQuotation.isVatAll === 'true' ? 'all' : 'false'),
                    discountPercentage: salesQuotation.discountPercentage,
                    discountAmount: salesQuotation.discountAmount,
                    roundOffAmount: salesQuotation.roundOffAmount,
                    vatPercentage: salesQuotation.vatPercentage,
                    items: salesQuotation.items.map(item => ({
                        ...item,
                        item: item.item?._id || item.item,
                        unit: item.unit ? {
                            _id: item.unit._id,
                            name: item.unit.name
                        } : null,
                        amount: (item.quantity * item.price).toFixed(2)
                    }))
                });

                setIsLoading(false);
            } catch (error) {
                console.error('Error fetching sales quotation data:', error);
                setNotification({
                    show: true,
                    message: 'Failed to load sales quotation data',
                    type: 'error'
                });
                setIsLoading(false);
            }
        };

        fetchSalesQuotationData();
    }, [id]);

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
        calculateTotal();
    }, [formData.items, formData.discountPercentage, formData.discountAmount, formData.roundOffAmount]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (itemSearchRef.current && !itemSearchRef.current.contains(event.target)) {
                setShowItemDropdown(false);
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
            account.name.toLowerCase().includes(searchText)
        ).sort((a, b) => a.name.localeCompare(b.name));

        setFilteredAccounts(filtered);
    };

    const selectAccount = (account) => {
        setFormData({
            ...formData,
            accountId: account._id,
            accountName: account.name,
            accountAddress: account.address,
            accountPan: account.pan
        });
        setShowAccountModal(false);
    };

    // const handleItemSearch = (e) => {
    //     const query = e.target.value.toLowerCase();
    //     setShowItemDropdown(query.length > 0 || e.type === 'focus');

    //     if (query.length === 0) {
    //         const filtered = allItems.filter(item => {
    //             if (formData.isVatExempt === 'all') return true;
    //             if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
    //             if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
    //             return true;
    //         });
    //         setFilteredItems(filtered);
    //         return;
    //     }

    //     let filtered = allItems.filter(item =>
    //         item.name.toLowerCase().includes(query) ||
    //         (item.hscode && item.hscode.toString().toLowerCase().includes(query)) ||
    //         (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(query))
    //     ).sort((a, b) => a.name.localeCompare(b.name));

    //     setFilteredItems(filtered);
    // };

    // Update the fetch function

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


    const addItemToBill = async (item) => {

        // Store the search query when adding an item
        if (itemSearchRef.current?.value) {
            setLastSearchQuery(itemSearchRef.current.value);
            setShouldShowLastSearchResults(true);
        }

        const newItem = {
            item: item._id,
            uniqueNumber: item.uniqueNumber || 'N/A',
            hscode: item.hscode,
            name: item.name,
            description: item.description,
            quantity: 1,
            unit: item.unit ? {
                _id: item.unit._id,
                name: item.unit.name
            } : null,
            price: item.latestPrice || 0,
            amount: (1 * (item.latestPrice || 0)).toFixed(2),
            vatStatus: item.vatStatus
        };

        setFormData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
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
            const newItemIndex = formData.items.length; // New item will be at this index
            const descriptionInput = document.getElementById(`description-${newItemIndex}`);
            if (descriptionInput) {
                descriptionInput.focus();
                descriptionInput.select(); // Optional: select the text for easy editing
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
        const updatedItems = [...formData.items];
        updatedItems[index][field] = value;

        if (field === 'quantity' || field === 'price') {
            updatedItems[index].amount = (updatedItems[index].quantity * updatedItems[index].price).toFixed(2);
        }

        setFormData(prev => ({
            ...prev,
            items: updatedItems
        }));

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
        if (formData.items.length <= 1) {
            setNotification({
                show: true,
                message: 'You cannot remove the last item. A quotation must have at least one item.',
                type: 'error'
            });
            return;
        }

        const updatedItems = formData.items.filter((_, i) => i !== index);
        setFormData(prev => ({
            ...prev,
            items: updatedItems
        }));
    };

    const calculateTotal = (itemsToCalculate = formData.items) => {
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

        setFormData(prev => ({
            ...prev,
            discountPercentage: value,
            discountAmount: discountAmount.toFixed(2)
        }));
    };

    const handleDiscountAmountChange = (e) => {
        const value = parseFloat(e.target.value) || 0;
        const subTotal = calculateTotal().subTotal;
        const discountPercentage = subTotal > 0 ? (value / subTotal) * 100 : 0;

        setFormData(prev => ({
            ...prev,
            discountAmount: value,
            discountPercentage: discountPercentage.toFixed(2)
        }));
    };

    const handleSubmit = async (e, print = false) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const quotationData = {
                accountId: formData.accountId,
                accountName: formData.accountName,
                accountAddress: formData.accountAddress,
                accountPan: formData.accountPan,
                transactionDateNepali: new NepaliDate(formData.transactionDateNepali).format('YYYY-MM-DD'),
                transactionDateRoman: formData.transactionDateRoman,
                nepaliDate: formData.nepaliDate,
                billDate: formData.billDate,
                billNumber: formData.billNumber,
                paymentMode: formData.paymentMode,
                isVatExempt: formData.isVatExempt,
                discountPercentage: formData.discountPercentage,
                discountAmount: formData.discountAmount,
                roundOffAmount: formData.roundOffAmount,
                vatPercentage: formData.vatPercentage,
                items: formData.items.map(item => ({
                    ...item,
                    item: item.item?._id || item.item,
                    unit: item.unit?._id || item.unit,
                    vatStatus: item.vatStatus
                })),
                print
            };

            const response = await api.put(`/api/retailer/sales-quotation/edit/${id}`, quotationData);

            setNotification({
                show: true,
                message: 'Sales quotation updated successfully!',
                type: 'success'
            });

            if (print) {
                window.open(`/sales-quotations/${response.data.data.quotation._id}/print`, '_blank');
                navigate('/sales-quotations');
            }
        } catch (error) {
            console.error('Error updating sales quotation:', error);
            setNotification({
                show: true,
                message: error.response?.data?.error || 'Failed to update sales quotation. Please try again.',
                type: 'error'
            });
        } finally {
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

        // Focus on description field of the last item in formData.items
        setTimeout(() => {
            if (formData.items.length > 0) {
                const lastIndex = formData.items.length - 1;
                const descriptionInput = document.getElementById(`description-${lastIndex}`);
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

    // Memoized dropdown component

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


    if (isLoading) {
        return (
            <div className="container-fluid">
                <Header />
                <div className="text-center py-5">
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <Header />
            <div className="container-fluid wow-form expanded-container">
                <div className="card mt-4 shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
                    <div className="card-header">
                        Update Sales Quotation
                        <span id="customAlertForBillNumber" style={{ color: 'red', display: 'none' }}>Quotation no. is required!</span>
                        <span id="transactionDateError" style={{ color: 'red', display: 'none' }}>Invalid date!</span>
                        <span id="nepaliDateError" style={{ color: 'red', display: 'none' }}>Invalid date!</span>
                    </div>
                    <div className="card-body">
                        <form onSubmit={handleSubmit} id="billForm" className="wow-form">
                            <div className="form-group row">
                                {company.dateFormat === 'nepali' ? (
                                    <>
                                        <div className="col">
                                            <label htmlFor="transactionDateNepali">Validity Periods:</label>
                                            <input
                                                type="text"
                                                name="transactionDateNepali"
                                                id="transactionDateNepali"
                                                className={`form-control no-date-icon ${dateErrors.transactionDateNepali ? 'is-invalid' : ''}`}
                                                value={new NepaliDate(formData.transactionDateNepali).format('YYYY-MM-DD')}
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
                                                        const transactionDateNepali = new NepaliDate(year, month - 1, day);

                                                        setFormData({
                                                            ...formData,
                                                            transactionDateNepali: transactionDateNepali.format('YYYY-MM-DD')
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
                                                autoFocus
                                                required
                                            />
                                            {dateErrors.transactionDateNepali && (
                                                <div className="invalid-feedback">
                                                    {dateErrors.transactionDateNepali}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col">
                                            <label htmlFor="nepaliDate">Quotation Date:</label>
                                            <input
                                                type="text"
                                                name="nepaliDate"
                                                id="nepaliDate"
                                                className={`form-control no-date-icon ${dateErrors.nepaliDate ? 'is-invalid' : ''}`}
                                                value={new NepaliDate(formData.nepaliDate).format('YYYY-MM-DD')}
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
                                                            nepaliDate: nepaliDate.format('YYYY-MM-DD')
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
                                                type="text"
                                                name="transactionDateRoman"
                                                id="transactionDateRoman"
                                                className="form-control"
                                                value={formData.transactionDateRoman}
                                                onChange={(e) => setFormData({ ...formData, transactionDateRoman: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.transactionDateRoman) {
                                                        e.preventDefault();
                                                        e.target.focus();
                                                    } else if (e.key === 'Enter') {
                                                        handleKeyDown(e, 'transactionDateRoman');
                                                    }
                                                }}
                                                required
                                            />
                                        </div>
                                        <div className="col">
                                            <label htmlFor="billDate">Quotation Date:</label>
                                            <input
                                                type="date"
                                                name="billDate"
                                                id="billDate"
                                                className="form-control"
                                                value={formData.billDate}
                                                onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.billDate) {
                                                        e.preventDefault();
                                                        e.target.focus();
                                                    } else if (e.key === 'Enter') {
                                                        handleKeyDown(e, 'billDate');
                                                    }
                                                }}
                                                required
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
                                        onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleKeyDown(e, 'billNumber');
                                            }
                                        }}
                                        readOnly
                                    />
                                </div>

                                <div className="col">
                                    <label htmlFor="paymentMode">Payment Mode:</label>
                                    <select
                                        className="form-control"
                                        id="paymentMode"
                                        name="paymentMode"
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
                                        name="isVatExempt"
                                        id="isVatExempt"
                                        className="form-control"
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
                                    />
                                    <AccountBalanceDisplay
                                        accountId={formData.accountId}
                                        api={api}
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
                                        name="address"
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

                            <hr style={{ border: "1px solid gray" }} />

                            <table className="table table-bordered compact-table" id="itemsTable">
                                <thead>
                                    <tr>
                                        <th>S.N.</th>
                                        <th>#</th>
                                        <th>HSN</th>
                                        <th>Description of Goods</th>
                                        <th>Description</th>
                                        <th>Qty</th>
                                        <th>Unit</th>
                                        <th>Rate</th>
                                        <th>Amount</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="items">
                                    {formData.items.map((item, index) => (
                                        <tr key={index} className={`item ${item.vatStatus === 'vatable' ? 'vatable-item' : 'non-vatable-item'}`}>
                                            <td>{index + 1}</td>
                                            <td>{item.uniqueNumber}</td>
                                            <td>
                                                <input type="hidden" name={`items[${index}][hscode]`} value={item.hscode} />
                                                {item.hscode}
                                            </td>
                                            <td className="col-3">
                                                <input type="hidden" name={`items[${index}][item]`} value={item.item?._id || item.item} />
                                                {item.name}
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    name={`items[${index}][description]`}
                                                    className="form-control form-control-sm"
                                                    autoComplete='off'
                                                    value={item.description}
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
                                                    className="form-control item-quantity"
                                                    id={`quantity-${index}`}
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemField(index, 'quantity', e.target.value)}
                                                    min="1"
                                                    step="any"
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            document.getElementById(`price-${index}`)?.focus();
                                                        }
                                                    }}
                                                />
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
                                                    step="any"
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            itemSearchRef.current?.focus();
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td className="item-amount">{item.amount}</td>
                                            <td>
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
                                            </td>
                                            <input type="hidden" name={`items[${index}][vatStatus]`} value={item.vatStatus} />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

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
                                                // Always prevent default to stop form submission
                                                e.preventDefault();

                                                // Handle adding item if one is selected
                                                const activeItem = document.querySelector('.dropdown-item.active');
                                                if (activeItem) {
                                                    const index = parseInt(activeItem.getAttribute('data-index'));
                                                    const filteredItem = filteredItems.length > 0 ? filteredItems[index] : allItems[index];
                                                    if (filteredItem) {
                                                        addItemToBill(filteredItem);
                                                    }
                                                }
                                                // Move to discount if search is empty AND there are items
                                                else if (!e.target.value && formData.items.length > 0) {
                                                    setShowItemDropdown(false); // Hide dropdown first
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
                                                filteredItems
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((item, index) => (
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
                                                            <div>Rs.{item.latestPuPrice || 0}</div>
                                                        </div>
                                                    ))
                                            ) : itemSearchRef.current?.value ? (
                                                <div className="text-center py-3 text-muted">
                                                    No items found matching "{itemSearchRef.current.value}"
                                                </div>
                                            ) : allItems.length > 0 ? (
                                                allItems
                                                    // Filter items based on VAT selection
                                                    .filter(item => {
                                                        if (formData.isVatExempt === 'all') return true;
                                                        if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
                                                        if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
                                                        return true;
                                                    })
                                                    .sort((a, b) => a.name.localeCompare(b.name))
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
                                                            <div>Rs.{item.latestPuPrice || 0}</div>
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

                            <hr style={{ border: "1px solid gray" }} />

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
                                            <td className="text-right">
                                                <p className="form-control-plaintext">Rs. <span id="subTotal">{totals.subTotal.toFixed(2)}</span></p>
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
                                                    onFocus={(e) => e.target.select()}
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
                                                    value={Math.round(formData.discountAmount * 100) / 100}
                                                    className="form-control"
                                                    onChange={handleDiscountAmountChange}
                                                    onFocus={(e) => e.target.select()}
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
                                                    <td className="text-right">
                                                        <p className="form-control-plaintext">Rs. <span id="taxableAmount">{totals.taxableAmount.toFixed(2)}</span></p>
                                                    </td>

                                                    <td><label htmlFor="vatPercentage">VAT %:</label></td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            name="vatPercentage"
                                                            id="vatPercentage"
                                                            className="form-control"
                                                            value="13.00"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleKeyDown(e, 'vatPercentage');
                                                                }
                                                            }}
                                                            readOnly
                                                        />
                                                    </td>
                                                    <td><label htmlFor="vatAmount">VAT Amount:</label></td>
                                                    <td className="text-right">
                                                        <p className="form-control-plaintext">Rs. <span id="vatAmount">{totals.vatAmount.toFixed(2)}</span></p>
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
                                                    onFocus={(e) => e.target.select()}
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
                                                <p className="form-control-plaintext">Rs. <span id="totalAmount">{totals.totalAmount.toFixed(2)}</span></p>
                                            </td>
                                            <td><label htmlFor="amountInWords">In Words:</label></td>
                                            <td className="text-right">
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
                                    type="button"
                                    className="btn btn-primary mr-2 p-3"
                                    id="saveBill"
                                    onClick={(e) => handleSubmit(e, false)}
                                    disabled={isSaving}
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
                                    autoFocus
                                    autoComplete='off'
                                    onChange={handleAccountSearch}
                                    onKeyDown={(e) => {
                                        // Handle arrow keys and Enter in search input
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
                                            filteredAccounts
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((account, index) => (
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
                                                                    accountSearchRef.current.focus();
                                                                }
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                selectAccount(account);
                                                                document.getElementById('address').focus();
                                                            }
                                                        }}
                                                        onFocus={(e) => {
                                                            // Remove active class from all items and add to focused one
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
                                            // If search is active and no result found
                                            accountSearchRef.current?.value ? (
                                                <li className="list-group-item text-center text-muted small py-2">No accounts found</li>
                                            ) : (
                                                accounts
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((account, index) => (
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
                                                                        accountSearchRef.current.focus();
                                                                    }
                                                                } else if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    selectAccount(account);
                                                                    document.getElementById('address').focus();
                                                                }
                                                            }}
                                                            onFocus={(e) => {
                                                                // Remove active class from all items and add to focused one
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
        </div>
    );
};

// Helper function to convert amount to words
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

export default EditSalesQuotation;