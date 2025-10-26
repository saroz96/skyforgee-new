import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../../retailer/Header';
import NotificationToast from '../../NotificationToast';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';
import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
import '../../../stylesheet/retailer/purchase/EditPurchase.css'
import '../../../stylesheet/noDateIcon.css'
import ProductModal from '../dashboard/modals/ProductModal';
import AccountBalanceDisplay from '../payment/AccountBalanceDisplay';
import useDebounce from '../../../hooks/useDebounce';
import VirtualizedItemList from '../../VirtualizedItemList';
import { Button } from 'react-bootstrap';
import { BiArrowBack } from 'react-icons/bi';


const EditPurchase = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [transactionSettings, setTransactionSettings] = useState({
        displayTransactions: false,
        displayTransactionsForPurchase: false,
        displayTransactionsForSalesReturn: false,
        displayTransactionsForPurchaseReturn: false
    });
    // Add these state variables with your existing state declarations
    const [searchQuery, setSearchQuery] = useState('');
    const [lastSearchQuery, setLastSearchQuery] = useState(''); // Store the last search
    const [shouldShowLastSearchResults, setShouldShowLastSearchResults] = useState(false);
    const debouncedSearchQuery = useDebounce(searchQuery, 50);

    const [loadingItems, setLoadingItems] = useState(new Set());
    const continueButtonRef = useRef(null);
    const [transactionCache, setTransactionCache] = useState(new Map());
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const itemSearchRef = useRef(null);
    const accountSearchRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
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
        partyBillNumber: '',
        paymentMode: 'credit',
        isVatExempt: 'all',
        discountPercentage: 0,
        discountAmount: 0,
        roundOffAmount: 0,
        // CCAmount: 0,
        vatPercentage: 13,
        items: [],
        subTotal: 0,
        taxableAmount: 0,
        nonTaxableAmount: 0,
        vatAmount: 0,
        totalAmount: 0,
        totalCCAmount: 0
    });

    const [items, setItems] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [filteredAccounts, setFilteredAccounts] = useState([]);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [showSalesPriceModal, setShowSalesPriceModal] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [transactionType, setTransactionType] = useState('purchase');
    const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
    const [filteredItems, setFilteredItems] = useState([]);

    const itemDropdownRef = useRef(null);
    const [salesPriceData, setSalesPriceData] = useState({
        puPrice: 0,
        CCPercentage: 7.5,
        itemCCAmount: 0,
        marginPercentage: 0,
        currency: 'NPR',
        mrp: 0,
        salesPrice: 0
    });

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
        const fetchPurchaseData = async () => {
            try {
                const response = await api.get(`/api/retailer/purchase/edit/${id}`);
                const { data } = response;

                const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));

                setCompany(data.data.company);
                setAllItems(sortedItems);
                setAccounts(data.data.accounts || []);

                const invoice = data.data.purchaseInvoice;
                const dateFormat = data.data.company.dateFormat;

                const accountDoc = data.data.accounts.find(acc => acc._id === invoice.account._id);
                const accountNameWithNumber = accountDoc?.uniqueNumber
                    ? `${accountDoc.uniqueNumber} ${invoice.account.name}`
                    : invoice.account.name;

                setFormData({
                    accountId: invoice.account._id,
                    accountName: accountNameWithNumber,
                    accountAddress: invoice.account.address,
                    accountPan: invoice.account.pan,
                    transactionDateNepali: dateFormat === 'nepali' ?
                        new Date(invoice.transactionDate).toISOString().split('T')[0] : '',
                    transactionDateRoman: dateFormat !== 'nepali' ?
                        new Date(invoice.transactionDate).toISOString().split('T')[0] : '',
                    nepaliDate: dateFormat === 'nepali' ?
                        new Date(invoice.date).toISOString().split('T')[0] : '',
                    billDate: dateFormat !== 'nepali' ?
                        new Date(invoice.date).toISOString().split('T')[0] : '',
                    billNumber: invoice.billNumber,
                    partyBillNumber: invoice.partyBillNumber,
                    paymentMode: invoice.paymentMode,
                    isVatExempt: invoice.isVatExempt ? 'true' :
                        (invoice.isVatAll === 'true' ? 'all' : 'false'),
                    discountPercentage: invoice.discountPercentage,
                    discountAmount: invoice.discountAmount,
                    roundOffAmount: invoice.roundOffAmount,
                    CCAmount: invoice.totalCCAmount,
                    vatPercentage: invoice.vatPercentage,
                    items: invoice.items.map(item => ({
                        ...item,
                        item: item.item?._id || item.item,
                        unit: item.unit ? {
                            _id: item.unit._id,
                            name: item.unit.name
                        } : null,
                        amount: (item.quantity * item.puPrice).toFixed(2),
                        uniqueUuId: item.uniqueUuId || ''
                    }))
                });

                setIsLoading(false);
            } catch (error) {
                console.error('Error fetching purchase data:', error);
                setNotification({
                    show: true,
                    message: 'Failed to load purchase data',
                    type: 'error'
                });
                setIsLoading(false);
            }
        };

        fetchPurchaseData();
    }, [id]);

    useEffect(() => {
        calculateTotal();
    }, [formData.items, formData.discountPercentage, formData.discountAmount, formData.roundOffAmount]);

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

    // Add this useEffect to fetch transaction settings
    useEffect(() => {
        const fetchTransactionSettings = async () => {
            try {
                const response = await api.get('/api/retailer/get-display-purchase-transactions');
                if (response.data.success) {
                    setTransactionSettings(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching transaction settings:', error);
            }
        };
        fetchTransactionSettings();
    }, []);

    const handleTransactionModalClose = () => {
        setShowTransactionModal(false);
        setTimeout(() => {
            const newItemIndex = items.length - 1; // New item will be at this index
            const wsUnitInput = document.getElementById(`WSUnit-${newItemIndex}`);
            if (wsUnitInput) {
                wsUnitInput.focus();
                wsUnitInput.select(); // Optional: select the text for easy editing
            }
        }, 100); // Small timeout to allow React to render the new item
    };

    // Add global key handler for Escape key
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

    // Add this useEffect to handle modal focus
    useEffect(() => {
        if (showTransactionModal && continueButtonRef.current) {
            const timer = setTimeout(() => {
                continueButtonRef.current.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showTransactionModal]);

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
            accountName: `${account.uniqueNumber || ''} ${account.name}`.trim(), // Combine uniqueNumber and name
            accountAddress: account.address,
            accountPan: account.pan,
            uniqueNumber: account.uniqueNumber // Store separately if needed
        });
        setShowAccountModal(false);
    };

    // const handleItemSearch = (e) => {
    //     const query = e.target.value.toLowerCase();
    //     setShowItemDropdown(query.length > 0 || e.type === 'focus');

    //     if (query.length === 0) {
    //         // Show all items when search is empty
    //         const filtered = allItems.filter(item => {
    //             if (formData.isVatExempt === 'all') return true;
    //             if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
    //             if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
    //             return true;
    //         });
    //         setFilteredItems(filtered);
    //         return;
    //     }

    //     let filtered = allItems.filter(item => {
    //         const matchesSearch = item.name.toLowerCase().includes(query) ||
    //             (item.hscode && item.hscode.toString().toLowerCase().includes(query)) ||
    //             (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(query));

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


    const addItemToBill = async (item) => {

        if (itemSearchRef.current?.value) {
            setLastSearchQuery(itemSearchRef.current.value);
            setShouldShowLastSearchResults(true);
        }

        const newItem = {
            item: item._id,
            uniqueNumber: item.uniqueNumber || 'N/A',
            hscode: item.hscode,
            name: item.name,
            WSUnit: item.WSUnit || 1,
            batchNumber: 'XXX',
            expiryDate: getDefaultExpiryDate(),
            quantity: 0,
            bonus: 0,
            unit: item.unit ? {
                _id: item.unit._id,
                name: item.unit.name
            } : null,
            puPrice: item.latestPuPrice || 0,
            price: 0,
            mrp: 0,
            marginPercentage: 0,
            currency: 'NPR',
            CCPercentage: 7.5,
            itemCCAmount: 0,
            amount: 0,
            vatStatus: item.vatStatus,
            uniqueUuId: item.uniqueUuId
        };

        setFormData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setItems([...items, newItem]);
        setShowItemDropdown(false);
        // itemSearchRef.current.value = '';

        setSearchQuery('');
        if (itemSearchRef.current) {
            itemSearchRef.current.value = '';
        }

        // Update the transaction fetching part for PURCHASE
        if (transactionSettings.displayTransactionsForPurchase && formData.accountId) {
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

                const response = await api.get(`/api/retailer/transactions/${item._id}/${formData.accountId}/Purchase`, {
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
            const wsUnitInput = document.getElementById(`WSUnit-${newItemIndex}`);
            if (wsUnitInput) {
                wsUnitInput.focus();
                wsUnitInput.select(); // Optional: select the text for easy editing
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

    // Update your search input's onFocus handler
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


    const getDefaultExpiryDate = () => {
        const today = new Date();
        today.setFullYear(today.getFullYear() + 2);
        return today.toISOString().split('T')[0];
    };

    // const updateItemField = (index, field, value) => {
    //     const updatedItems = [...formData.items];
    //     updatedItems[index][field] = value;

    //     if (field === 'quantity' || field === 'puPrice') {
    //         updatedItems[index].amount = (updatedItems[index].quantity * updatedItems[index].puPrice).toFixed(2);
    //     }

    //     setFormData(prev => ({
    //         ...prev,
    //         items: updatedItems
    //     }));

    //     // Recalculate discounts if they have values
    //     if (formData.discountPercentage || formData.discountAmount) {
    //         const subTotal = calculateTotal(updatedItems).subTotal;

    //         if (formData.discountPercentage) {
    //             const discountAmount = (subTotal * formData.discountPercentage) / 100;
    //             setFormData(prev => ({
    //                 ...prev,
    //                 discountAmount: discountAmount.toFixed(2)
    //             }));
    //         } else if (formData.discountAmount) {
    //             const discountPercentage = subTotal > 0 ? (formData.discountAmount / subTotal) * 100 : 0;
    //             setFormData(prev => ({
    //                 ...prev,
    //                 discountPercentage: discountPercentage.toFixed(2)
    //             }));
    //         }
    //     }
    // };

    const removeItem = (index) => {
        if (formData.items.length <= 1) {
            setNotification({
                show: true,
                message: 'You cannot remove the last item. A bill must have at least one item.',
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

    // const calculateTotal = (itemsToCalculate = formData.items) => {
    //     let subTotal = 0;
    //     let taxableAmount = 0;
    //     let nonTaxableAmount = 0;
    //     let totalCCAmount = 0;
    //     let taxableCCAmount = 0;
    //     let nonTaxableCCAmount = 0;

    //     itemsToCalculate.forEach(item => {
    //         subTotal += parseFloat(item.amount) || 0;
    //         totalCCAmount += parseFloat(item.itemCCAmount) || 0;

    //         if (item.vatStatus === 'vatable') {
    //             taxableAmount += parseFloat(item.amount) || 0;
    //             taxableCCAmount += parseFloat(item.itemCCAmount) || 0;
    //         } else {
    //             nonTaxableAmount += parseFloat(item.amount) || 0;
    //             nonTaxableCCAmount += parseFloat(item.itemCCAmount) || 0;
    //         }
    //     });

    //     const discountPercentage = parseFloat(formData.discountPercentage) || 0;
    //     const discountAmount = parseFloat(formData.discountAmount) || 0;

    //     const discountForTaxable = (taxableAmount * discountPercentage) / 100;
    //     const discountForNonTaxable = (nonTaxableAmount * discountPercentage) / 100;

    //     const finalTaxableAmount = taxableAmount - discountForTaxable + taxableCCAmount;
    //     const finalNonTaxableAmount = nonTaxableAmount - discountForNonTaxable + nonTaxableCCAmount;

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
    //         totalAmount,
    //         totalCCAmount
    //     };
    // };

    // const handleDiscountPercentageChange = (e) => {
    //     const value = parseFloat(e.target.value) || 0;
    //     const subTotal = calculateTotal().subTotal;
    //     const discountAmount = (subTotal * value) / 100;

    //     setFormData(prev => ({
    //         ...prev,
    //         discountPercentage: value,
    //         discountAmount: discountAmount.toFixed(2)
    //     }));
    // };

    // const handleDiscountAmountChange = (e) => {
    //     const value = parseFloat(e.target.value) || 0;
    //     const subTotal = calculateTotal().subTotal;
    //     const discountPercentage = subTotal > 0 ? (value / subTotal) * 100 : 0;

    //     setFormData(prev => ({
    //         ...prev,
    //         discountAmount: value,
    //         discountPercentage: discountPercentage.toFixed(2)
    //     }));
    // };

    // Precision utility functions (add these at the top of the component)
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

    // Replace the calculateTotal function with this robust version
    const calculateTotal = (itemsToCalculate = formData.items) => {
        // Initialize all amounts with proper precision
        let subTotal = 0;
        let taxableAmount = 0;
        let nonTaxableAmount = 0;
        let totalCCAmount = 0;
        let taxableCCAmount = 0;
        let nonTaxableCCAmount = 0;

        // Calculate item amounts with proper rounding
        itemsToCalculate.forEach(item => {
            const itemAmount = parseFloat(item.amount) || 0;
            const itemCCAmount = parseFloat(item.itemCCAmount) || 0;

            subTotal = preciseAdd(subTotal, itemAmount);
            totalCCAmount = preciseAdd(totalCCAmount, itemCCAmount);

            if (item.vatStatus === 'vatable') {
                taxableAmount = preciseAdd(taxableAmount, itemAmount);
                taxableCCAmount = preciseAdd(taxableCCAmount, itemCCAmount);
            } else {
                nonTaxableAmount = preciseAdd(nonTaxableAmount, itemAmount);
                nonTaxableCCAmount = preciseAdd(nonTaxableCCAmount, itemCCAmount);
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

        // Apply discount and add CC amounts
        const finalTaxableAmount = preciseSubtract(
            preciseAdd(taxableAmount, taxableCCAmount),
            discountForTaxable
        );

        const finalNonTaxableAmount = preciseSubtract(
            preciseAdd(nonTaxableAmount, nonTaxableCCAmount),
            discountForNonTaxable
        );

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
            totalCCAmount: preciseRound(totalCCAmount, 2),
            discountAmount: preciseRound(effectiveDiscount, 2),
            roundOffAmount: preciseRound(roundOffAmount, 2)
        };
    };

    // Replace the handleDiscountPercentageChange function
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

    // Replace the handleDiscountAmountChange function
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

    // Update the updateItemField function to use precise calculations
    const updateItemField = (index, field, value) => {
        const updatedItems = [...formData.items];
        updatedItems[index][field] = value;

        if (field === 'quantity' || field === 'puPrice') {
            const quantity = parseFloat(updatedItems[index].quantity) || 0;
            const puPrice = parseFloat(updatedItems[index].puPrice) || 0;
            updatedItems[index].amount = preciseRound(preciseMultiply(quantity, puPrice), 2);
        }

        setFormData(prev => ({
            ...prev,
            items: updatedItems
        }));

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

            const response = await api.get(`/api/retailer/transactions/${itemId}/${formData.accountId}/Purchase`, {
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

    const fetchSalesTransactions = async () => {
        if (!items[selectedItemIndex]) return;

        try {
            const response = await api.get(`/api/retailer/transactions/sales-by-item-account?itemId=${items[selectedItemIndex]._id}&accountId=${formData.accountId}`);
            setTransactions(response.data);
            setTransactionType('sales');
        } catch (error) {
            console.error('Error fetching sales transactions:', error);
        }
    };

    const fetchPurchaseTransactions = async () => {
        if (!items[selectedItemIndex]) return;

        try {
            const response = await api.get(`/api/retailer/transactions/purchase-by-item-account?itemId=${items[selectedItemIndex]._id}&accountId=${formData.accountId}`);
            setTransactions(response.data);
            setTransactionType('purchase');
        } catch (error) {
            console.error('Error fetching purchase transactions:', error);
        }
    };

    const handleBack = () => {
        navigate(-1);
    };

    const openSalesPriceModal = (index) => {
        setSelectedItemIndex(index);
        const item = formData.items[index];

        // Get the full item data including latest stock entry
        const fullItem = allItems.find(i => i._id === (item.item?._id || item.item)) || item;
        const latestStockEntry = fullItem.stockEntries?.[fullItem.stockEntries.length - 1] || {};

        // Calculate initial values
        // const prevPuPrice = latestStockEntry?.puPrice || 0;
        const prevPuPrice = Math.round((latestStockEntry?.puPrice * latestStockEntry?.WSUnit) * 100) / 100 || 0;
        const currentPuPrice = Math.round(item.puPrice * 100) / 100;
        const CCPercentage = item.CCPercentage || 7.5;
        const marginPercentage = Math.round((item.marginPercentage) * 100) / 100 || 0;
        const currency = item.currency || 'NPR';
        const mrp = Math.round((item.mrp) * 100) / 100 || 0;
        const salesPrice = Math.round((item.price) * 100) / 100 || currentPuPrice;

        // Calculate CC amount based on bonus quantity
        const itemCCAmount = ((currentPuPrice * CCPercentage / 100) * (item.bonus || 0));

        setSalesPriceData({
            prevPuPrice: prevPuPrice,
            puPrice: currentPuPrice,
            CCPercentage: CCPercentage,
            itemCCAmount: itemCCAmount,
            marginPercentage: marginPercentage,
            currency: currency,
            mrp: mrp,
            salesPrice: salesPrice,
            isVatable: item.vatStatus === 'vatable'
        });

        setShowSalesPriceModal(true);
    };

    const saveSalesPrice = () => {
        if (selectedItemIndex === -1) return;

        const updatedItems = [...formData.items];
        updatedItems[selectedItemIndex] = {
            ...updatedItems[selectedItemIndex],
            price: salesPriceData.salesPrice,
            mrp: salesPriceData.mrp,
            marginPercentage: salesPriceData.marginPercentage,
            currency: salesPriceData.currency,
            CCPercentage: salesPriceData.CCPercentage,
            itemCCAmount: salesPriceData.itemCCAmount
        };

        setFormData(prev => ({
            ...prev,
            items: updatedItems
        }));
        setItems(updatedItems);
        setShowSalesPriceModal(false);

        setTimeout(() => {
            itemSearchRef.current?.focus();
            itemSearchRef.current?.select();
        }, 0);
    };

    const fetchItemsAndAccounts = async () => {
        try {
            const response = await api.get(`/api/retailer/purchase/edit/${id}`);
            const { data } = response;

            const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));
            setAllItems(sortedItems);
            setAccounts(data.data.accounts || []);

            return { items: sortedItems, accounts: data.data.accounts || [] };
        } catch (error) {
            console.error('Error fetching items and accounts:', error);
            throw error;
        }
    };

    useEffect(() => {
        return () => {
            // Reset search memory when component unmounts
            setLastSearchQuery('');
            setShouldShowLastSearchResults(false);
        };
    }, []);

    const handleSubmit = async (e, print = false) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            // Debug: Log the form data before submission
            console.log('Form data before submission:', {
                ...formData,
                items: formData.items.map(item => ({
                    ...item,
                    item: item.item?._id || item.item, // Ensure we have the ID
                    uniqueUuId: item.uniqueUuId || '' // Ensure uniqueUuId exists
                }))
            });

            const billData = {
                accountId: formData.accountId,
                accountName: formData.accountName,
                accountAddress: formData.accountAddress,
                accountPan: formData.accountPan,
                transactionDateNepali: new Date(formData.transactionDateNepali).toISOString().split('T')[0],
                transactionDateRoman: formData.transactionDateRoman,
                nepaliDate: new Date(formData.nepaliDate).toISOString().split('T')[0],
                billDate: formData.billDate,
                billNumber: formData.billNumber,
                partyBillNumber: formData.partyBillNumber,
                paymentMode: formData.paymentMode,
                isVatExempt: formData.isVatExempt,
                discountPercentage: formData.discountPercentage,
                discountAmount: formData.discountAmount,
                roundOffAmount: formData.roundOffAmount,
                CCAmount: formData.CCAmount,
                vatPercentage: formData.vatPercentage,
                subTotal: totals.subTotal,
                taxableAmount: totals.taxableAmount,
                nonTaxableAmount: totals.nonTaxableAmount,
                vatAmount: totals.vatAmount,
                totalAmount: totals.totalAmount,
                totalCCAmount: totals.totalCCAmount,
                items: formData.items.map(item => ({
                    ...item,
                    item: item.item?._id || item.item, // Ensure we have the ID
                    uniqueUuId: item.uniqueUuId || '', // Preserve existing uniqueUuId
                    unit: item.unit?._id || item.unit, // Ensure unit ID is correct
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    WSUnit: item.WSUnit,
                    quantity: item.quantity,
                    bonus: item.bonus,
                    puPrice: item.puPrice,
                    price: item.price || 0,
                    mrp: item.mrp || 0,
                    marginPercentage: item.marginPercentage || 0,
                    currency: item.currency || 'NPR',
                    CCPercentage: item.CCPercentage || 7.5,
                    itemCCAmount: item.itemCCAmount || 0,
                    vatStatus: item.vatStatus
                })),
                print
            };

            console.log('Submitting purchase data:', billData); // Debug log

            const response = await api.put(`/api/retailer/purchase/edit/${id}`, billData);

            console.log('Update response:', response.data); // Debug response

            setNotification({
                show: true,
                message: 'Purchase updated successfully!',
                type: 'success'
            });

            // Refresh items and accounts after successful update
            await fetchItemsAndAccounts();

            if (print) {
                window.open(`/purchase-bills/${response.data.data.bill._id}/print`, '_blank');
                navigate('/purchase-bills');
            } else {
                // Refresh filtered items based on VAT selection
                const filtered = allItems.filter(item => {
                    if (formData.isVatExempt === 'all') return true;
                    if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
                    if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
                    return true;
                });
                setFilteredItems(filtered);
            }
        } catch (error) {
            console.error('Full error details:', {
                message: error.message,
                response: error.response?.data,
                config: error.config,
                stack: error.stack
            });

            setNotification({
                show: true,
                message: error.response?.data?.error || 'Failed to update purchase. Please try again.',
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
            <div className="card mt-4 shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
                <div className="card-header">
                    Update Purchase
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
                                                    const transactionDateNepali = new NepaliDate(year, month - 1, day);

                                                    setFormData({
                                                        ...formData,
                                                        transactionDateNepali: transactionDateNepali.format('MM/DD/YYYY')
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
                                                // Prevent moving to next field if current date is invalid
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
                                        <label htmlFor="nepaliDate">Invoice Date:</label>
                                        <input
                                            type="text"
                                            name="nepaliDate"
                                            id="nepaliDate"
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
                                                        nepaliDate: nepaliDate.format('YYYY/MM/DD')
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
                                                // Prevent moving to next field if current date is invalid
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
                                            value={formData.transactionDateRoman}
                                            onChange={(e) => setFormData({ ...formData, transactionDateRoman: e.target.value })}
                                            onKeyDown={(e) => {
                                                // Prevent moving to next field if current date is invalid
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
                                        <label htmlFor="billDate">Invoice Date:</label>
                                        <input
                                            type="date"
                                            name="billDate"
                                            id="billDate"
                                            className="form-control"
                                            value={formData.billDate}
                                            onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                                            onKeyDown={(e) => {
                                                // Prevent moving to next field if current date is invalid
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
                                <label htmlFor="billNumber">Vch. No:</label>
                                <input
                                    type="text"
                                    name="billNumber"
                                    id="billNumber"
                                    className="form-control"
                                    value={formData.billNumber}
                                    readOnly
                                    onKeyDown={(e) => {
                                        // Prevent moving to next field if current date is invalid
                                        if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.transactionDateNepali) {
                                            e.preventDefault();
                                            e.target.focus();
                                        } else if (e.key === 'Enter') {
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
                                        // Prevent moving to next field if current date is invalid
                                        if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.transactionDateNepali) {
                                            e.preventDefault();
                                            e.target.focus();
                                        } else if (e.key === 'Enter') {
                                            handleKeyDown(e, 'paymentMode');
                                        }
                                    }}
                                >
                                    <option value="credit">credit</option>
                                    <option value="cash">cash</option>
                                </select>
                            </div>

                            <div className="col">
                                <label htmlFor="partyBillNumber">Party Inv. No:</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="partyBillNumber"
                                    name="partyBillNumber"
                                    value={formData.partyBillNumber}
                                    onChange={(e) => setFormData({ ...formData, partyBillNumber: e.target.value })}
                                    autoComplete='off'
                                    onKeyDown={(e) => {
                                        // Prevent moving to next field if current date is invalid
                                        if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.transactionDateNepali) {
                                            e.preventDefault();
                                            e.target.focus();
                                        } else if (e.key === 'Enter') {
                                            handleKeyDown(e, 'partyBillNumber');
                                        }
                                    }}
                                    required
                                />
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
                                        // Prevent moving to next field if current date is invalid
                                        if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.transactionDateNepali) {
                                            e.preventDefault();
                                            e.target.focus();
                                        } else if (e.key === 'Enter') {
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
                                    onKeyDown={(e) => {
                                        // Prevent moving to next field if current date is invalid
                                        if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.transactionDateNepali) {
                                            e.preventDefault();
                                            e.target.focus();
                                        } else if (e.key === 'Enter') {
                                            handleKeyDown(e, 'fieldId');
                                        }
                                    }}
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

                        <div id="bill-details-container" style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }}>
                            <table className="table table-bordered compact-table" id="itemsTable">
                                <thead>
                                    <tr>
                                        <th>S.N.</th>
                                        <th>#</th>
                                        <th>HSN</th>
                                        <th>Description of Goods</th>
                                        <th>WS Unit</th>
                                        <th>Batch</th>
                                        <th>Expiry</th>
                                        <th>Qty</th>
                                        <th>Bonus</th>
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
                                                    type="number"
                                                    name={`items[${index}][WSUnit]`}
                                                    className="form-control item-WSUnit"
                                                    id={`WSUnit-${index}`}
                                                    value={item.WSUnit}
                                                    onChange={(e) => updateItemField(index, 'WSUnit', e.target.value)}
                                                    required
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            document.getElementById(`batchNumber-${index}`)?.focus();
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    name={`items[${index}][batchNumber]`}
                                                    className="form-control item-batchNumber"
                                                    id={`batchNumber-${index}`}
                                                    value={item.batchNumber}
                                                    onChange={(e) => updateItemField(index, 'batchNumber', e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    required
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            document.getElementById(`expiryDate-${index}`)?.focus();
                                                        }
                                                    }}
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
                                                    required
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            document.getElementById(`bonus-${index}`)?.focus();
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    name={`items[${index}][bonus]`}
                                                    className="form-control item-bonus"
                                                    id={`bonus-${index}`}
                                                    value={item.bonus}
                                                    onChange={(e) => updateItemField(index, 'bonus', e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            document.getElementById(`puPrice-${index}`)?.focus();
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
                                                    name={`items[${index}][puPrice]`}
                                                    className="form-control item-puPrice"
                                                    id={`puPrice-${index}`}
                                                    value={item.puPrice}
                                                    onChange={(e) => updateItemField(index, 'puPrice', e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            openSalesPriceModal(index);
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
                                            <input type="hidden" name={`items[${index}][CCPercentage]`} value={item.CCPercentage || 7.5} />
                                            <input type="hidden" name={`items[${index}][itemCCAmount]`} value={item.itemCCAmount || 0} />
                                            <input type="hidden" name={`items[${index}][marginPercentage]`} value={item.marginPercentage || ''} />
                                            <input type="hidden" name={`items[${index}][mrp]`} value={item.mrp || ''} />
                                            <input type="hidden" name={`items[${index}][price]`} value={item.price || ''} />
                                            <input type="hidden" name={`items[${index}][currency]`} value={item.currency || ''} />
                                            <input type="hidden" name={`items[${index}][uniqueUuId]`} value={item.uniqueUuId || ''} />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="form-group row">
                            <div className="col">
                                <label htmlFor="itemSearch">Search Item</label>
                                <input
                                    type="text"
                                    id="itemSearch"
                                    className="form-control"
                                    placeholder="Search item (Press F6 to create new item)"
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

                                    <tr id="taxableAmountRow">
                                        <td><label htmlFor="CCAmount">CC Charge:</label></td>
                                        <td>
                                            <input
                                                type="number"
                                                name="CCAmount"
                                                id="CCAmount"
                                                className="form-control"
                                                value={totals.totalCCAmount.toFixed(2)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleKeyDown(e, 'CCAmount');
                                                    }
                                                }}
                                                readOnly
                                            />
                                        </td>
                                        {company.vatEnabled && formData.isVatExempt !== 'true' && (
                                            <>
                                                <td><label htmlFor="taxableAmount">Taxable Amount:</label></td>
                                                <td className="text-right">
                                                    <p className="form-control-plaintext">Rs. {totals.taxableAmount.toFixed(2)}</p>
                                                </td>
                                                <td className="d-none">
                                                    <input
                                                        type="number"
                                                        name="vatPercentage"
                                                        id="vatPercentage"
                                                        className="form-control"
                                                        value="13.00"
                                                        readOnly
                                                    />
                                                </td>
                                                <td><label htmlFor="vatAmount">VAT (13%):</label></td>
                                                <td className="text-right">
                                                    <p className="form-control-plaintext">Rs. {totals.vatAmount.toFixed(2)}</p>
                                                </td>
                                            </>
                                        )}
                                        {/* Add empty cells to maintain table structure when exempt */}
                                        {company.vatEnabled && formData.isVatExempt === 'true' && (
                                            <>
                                                <td colSpan="4"></td>
                                            </>
                                        )}
                                    </tr>
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
                                            <p className="form-control-plaintext">Rs. {totals.totalAmount.toFixed(2)}</p>
                                        </td>
                                        <td><label htmlFor="amountInWords">In Words:</label></td>
                                        <td className="col-3 text-right">
                                            <p className="form-control-plaintext" id="amountInWords">
                                                {convertToRupeesAndPaisa(totals.totalAmount)} Only.
                                            </p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="d-flex justify-content-end mt-4">
                            <Button variant="secondary" className="me-2" onClick={handleBack}>
                                <BiArrowBack /> Back
                            </Button>
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

            {showTransactionModal && (
                <div className="modal fade show" id="transactionModal" tabIndex="-1" style={{ display: 'block' }} role="dialog" aria-labelledby="transactionModalLabel" aria-modal="true">
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title" id="transactionModalLabel">Last Purchase Transactions</h5>
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
                                                <th style={{ width: '15%' }}>Vch. No.</th>
                                                <th style={{ width: '10%' }}>Type</th>
                                                <th style={{ width: '10%' }}>A/c Type</th>
                                                <th style={{ width: '10%' }}>Pay.Mode</th>
                                                <th style={{ width: '10%' }}>Qty.</th>
                                                <th style={{ width: '10%' }}>Free</th>
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
                                                            if (transaction.purchaseBillId && transaction.purchaseBillId._id) {
                                                                navigate(`/retailer/purchase/${transaction.purchaseBillId._id}/print`);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (transaction.purchaseBillId && transaction.purchaseBillId._id) {
                                                                    navigate(`/purchase-bills/${transaction.purchaseBillId._id}/print`);
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
                                                        <td>{transaction.bonus || 0}</td>
                                                        <td>{transaction.unit?.name || 'N/A'}</td>
                                                        <td>Rs.{transaction.puPrice ? Math.round(transaction.puPrice * 100) / 100 : 0}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="9" className="text-center text-muted py-3">
                                                        No previous purchase transactions found
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

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

            {/* Sales Price Modal */}
            {showSalesPriceModal && (
                <div className="modal fade show" id="setSalesPriceModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title" id="setSalesPriceModalLabel">Set Sales Price for New Batch</h5>
                                <button type="button" className="btn-close" onClick={() => setShowSalesPriceModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col">
                                        <label htmlFor="prevPuPrice" className="form-label">Prev. Price</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="prePuPrice"
                                            step="any"
                                            value={salesPriceData.prevPuPrice.toFixed(2)}
                                            readOnly
                                        />
                                    </div>
                                    <div className="col">
                                        <label htmlFor="puPrice" className="form-label">New Price</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="puPrice"
                                            step="any"
                                            value={salesPriceData.puPrice}
                                            readOnly
                                        />
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col">
                                        <label htmlFor="CCPercentage" className="form-label">CC (%)</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="CCPercentage"
                                            step="any"
                                            value={salesPriceData.CCPercentage}
                                            onChange={(e) => {
                                                const CCPercentage = parseFloat(e.target.value) || 0;
                                                const item = formData.items[selectedItemIndex];
                                                const itemCCAmount = ((salesPriceData.puPrice * CCPercentage / 100) * (item.bonus || 0));

                                                setSalesPriceData({
                                                    ...salesPriceData,
                                                    CCPercentage: CCPercentage,
                                                    itemCCAmount: itemCCAmount
                                                });
                                            }}
                                            onFocus={(e) => {
                                                e.target.select();
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    document.getElementById('itemCCAmount')?.focus();
                                                }
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="col">
                                        <label htmlFor="itemCCAmount" className="form-label">CC Charge</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="itemCCAmount"
                                            step="any"
                                            value={salesPriceData.itemCCAmount.toFixed(2)}
                                            onFocus={(e) => {
                                                e.target.select();
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    document.getElementById('marginPercentage')?.focus();
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="marginPercentage" className="form-label">Margin Percentage (%)</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="marginPercentage"
                                        min="0"
                                        step="any"
                                        value={Math.round(salesPriceData.marginPercentage * 100) / 100}
                                        onFocus={(e) => {
                                            e.target.select();
                                        }}
                                        onChange={(e) => {
                                            const margin = parseFloat(e.target.value) || 0;
                                            const puPrice = parseFloat(salesPriceData.puPrice) || 0;
                                            const salesPrice = puPrice + (puPrice * margin / 100);

                                            setSalesPriceData({
                                                ...salesPriceData,
                                                marginPercentage: margin,
                                                salesPrice: parseFloat(salesPrice.toFixed(2))
                                            });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const margin = parseFloat(e.target.value) || 0;
                                                const puPrice = parseFloat(salesPriceData.puPrice) || 0;
                                                const salesPrice = puPrice + (puPrice * margin / 100);

                                                setSalesPriceData({
                                                    ...salesPriceData,
                                                    marginPercentage: margin,
                                                    salesPrice: parseFloat(salesPrice.toFixed(2))
                                                });
                                                document.getElementById('currency')?.focus();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="currency" className="form-label">Currency</label>
                                    <select
                                        className="form-select"
                                        id="currency"
                                        value={salesPriceData.currency}
                                        onChange={(e) => setSalesPriceData({ ...salesPriceData, currency: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                document.getElementById('mrp')?.focus();
                                            }
                                        }}
                                    >
                                        <option value="NPR">NPR</option>
                                        <option value="INR">INR</option>
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="mrp" className="form-label">MRP</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="mrp"
                                        step="any"
                                        value={salesPriceData.mrp}
                                        onFocus={(e) => {
                                            e.target.select();
                                        }}
                                        onChange={(e) => {
                                            const mrp = parseFloat(e.target.value) || 0;
                                            // const salesPrice = salesPriceData.currency === 'INR' ? mrp * 1.6 : mrp;
                                            let salesPrice;

                                            if (salesPriceData.isVatable) {
                                                // For vatable items, sales price is MRP / 1.13
                                                salesPrice = mrp > 0 ? mrp / 1.13 : salesPriceData.salesPrice;
                                            } else {
                                                // For non-vatable items, sales price is same as MRP
                                                salesPrice = mrp > 0 ? mrp : salesPriceData.salesPrice;
                                            }

                                            // Apply currency conversion if needed
                                            salesPrice = salesPriceData.currency === 'INR' ? salesPrice * 1.6 : salesPrice;
                                            const margin = ((salesPrice - salesPriceData.puPrice) / salesPriceData.puPrice) * 100;
                                            setSalesPriceData({
                                                ...salesPriceData,
                                                mrp: mrp,
                                                salesPrice: salesPrice,
                                                marginPercentage: margin
                                            });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                document.getElementById('salesPrice')?.focus();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="salesPrice" className="form-label">Sales Price</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="salesPrice"
                                        step="any"
                                        value={Math.round(salesPriceData.salesPrice * 100) / 100}
                                        onFocus={(e) => {
                                            e.target.select();
                                        }}
                                        onChange={(e) => {
                                            const salesPrice = parseFloat(e.target.value) || 0;
                                            const margin = ((salesPrice - salesPriceData.puPrice) / salesPriceData.puPrice) * 100;
                                            setSalesPriceData({
                                                ...salesPriceData,
                                                salesPrice: salesPrice,
                                                marginPercentage: margin
                                            });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                document.getElementById('saveSalesPrice')?.focus();
                                            }
                                        }}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    id='saveSalesPriceClose'
                                    onClick={() => setShowSalesPriceModal(false)}
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    id='saveSalesPrice'
                                    onClick={() => {
                                        saveSalesPrice();
                                    }}
                                >
                                    Save Sales Price
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

// Helper functions
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

export default EditPurchase;