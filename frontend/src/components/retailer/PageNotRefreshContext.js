import { createContext, useContext, useState, useEffect } from 'react';

const PageNotRefreshContext = createContext();

export const PageNotRefreshProvider = ({ children }) => {
    // Initialize state with data from sessionStorage if it exists
    //for purchase
    const [draftSave, setDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('draftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse draftSave from sessionStorage', error);
            return null;
        }
    });
    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (draftSave) {
                sessionStorage.setItem('draftSave', JSON.stringify(draftSave));
            } else {
                sessionStorage.removeItem('draftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [draftSave]);


    // Function to clear the draft (e.g., after submission)
    const clearDraft = () => {
        setDraftSave(null);
    };

    //--------------------------------------------------------------------------------

    //for AddSales
    const [salesDraftSave, setSalesDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('salesOpenDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse salesDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (salesDraftSave) {
                sessionStorage.setItem('salesDraftSave', JSON.stringify(salesDraftSave));
            } else {
                sessionStorage.removeItem('salesDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [salesDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearSalesDraft = () => {
        setSalesDraftSave(null);
    };
    //-------------------------------------------------------------------------------

    //for AddSalesOpen

    const [salesOpenDraftSave, setSalesOpenDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('salesOpenDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse salesDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (salesOpenDraftSave) {
                sessionStorage.setItem('salesOpenDraftSave', JSON.stringify(salesOpenDraftSave));
            } else {
                sessionStorage.removeItem('salesOpenDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [salesOpenDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearSalesOpenDraft = () => {
        setSalesOpenDraftSave(null);
    };

    //----------------------------------------------------------------------------------------

    //for credit sales return

    const [draftCreditSalesReturnSave, setDraftCreditSalesReturnSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('draftCreditSalesReturnSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse salesDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (draftCreditSalesReturnSave) {
                sessionStorage.setItem('draftCreditSalesReturnSave', JSON.stringify(draftCreditSalesReturnSave));
            } else {
                sessionStorage.removeItem('draftCreditSalesReturnSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [draftCreditSalesReturnSave]);

    // Function to clear the draft (e.g., after submission)
    const clearCreditSalesReturnDraft = () => {
        setDraftCreditSalesReturnSave(null);
    };

    //==================Sales Quotation===================

    const [salesQuotationDraftSave, setSalesQuotationDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('salesQuotationDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse salesQuotationDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (salesQuotationDraftSave) {
                sessionStorage.setItem('salesQuotationDraftSave', JSON.stringify(salesQuotationDraftSave));
            } else {
                sessionStorage.removeItem('salesQuotationDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [salesQuotationDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearSalesQuotationDraft = () => {
        setSalesQuotationDraftSave(null);
    };
    //====================END===============================

    //==================Header===================
    const [headerDraftSave, setHeaderDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('headerDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse companyDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (headerDraftSave) {
                sessionStorage.setItem('headerDraftSave', JSON.stringify(headerDraftSave));
            } else {
                sessionStorage.removeItem('headerDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [headerDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearHeaderDraft = () => {
        setHeaderDraftSave(null);
    };
    //==================END====================================================

    //==================Stats Card===================
    const [statsCardDraftSave, setStatsCardDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('statsCardDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse companyDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (statsCardDraftSave) {
                sessionStorage.setItem('statsCardDraftSave', JSON.stringify(statsCardDraftSave));
            } else {
                sessionStorage.removeItem('statsCardDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [statsCardDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearStatsCardDraft = () => {
        setStatsCardDraftSave(null);
    };
    //==================END====================================================

    //==================Sales Chart===================
    const [salesChartDraftSave, setSalesChartDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('salesChartDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse companyDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (salesChartDraftSave) {
                sessionStorage.setItem('salesChartDraftSave', JSON.stringify(salesChartDraftSave));
            } else {
                sessionStorage.removeItem('salesChartDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [salesChartDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearSalesChartDraft = () => {
        setSalesChartDraftSave(null);
    };
    //==================END====================================================

    //==================Product from F9===================
    const [productDraftSave, setProductDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('productDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse companyDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (productDraftSave) {
                sessionStorage.setItem('productDraftSave', JSON.stringify(productDraftSave));
            } else {
                sessionStorage.removeItem('productDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [productDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearProductDraft = () => {
        setProductDraftSave(null);
    };
    //==================END====================================================


    //==================Existing Items===================
    const [itemsTableDraftSave, setItemsTableDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('itemsTableDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse companyDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (itemsTableDraftSave) {
                sessionStorage.setItem('itemsTableDraftSave', JSON.stringify(itemsTableDraftSave));
            } else {
                sessionStorage.removeItem('itemsTableDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [itemsTableDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearItemsTableDraft = () => {
        setItemsTableDraftSave(null);
    };
    //==================END====================================================

    //==================Stock Status Draft Saving===================
    const [draftStockStatusSave, setDraftStockStatusSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('draftStockStatusSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse draftStockStatusSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (draftStockStatusSave) {
                sessionStorage.setItem('draftStockStatusSave', JSON.stringify(draftStockStatusSave));
            } else {
                sessionStorage.removeItem('draftStockStatusSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [draftStockStatusSave]);

    // Function to clear the draft (e.g., after submission)
    const clearDraftStockStatusSave = () => {
        setDraftStockStatusSave(null);
    };
    //==================END====================================================

    //==================Contact Modal===================
    const [contactDraftSave, setContactDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('contactDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse contactDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (contactDraftSave) {
                sessionStorage.setItem('contactDraftSave', JSON.stringify(contactDraftSave));
            } else {
                sessionStorage.removeItem('contactDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [contactDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearContactDraft = () => {
        setContactDraftSave(null);
    };
    //==================END====================================================

    return (
        <PageNotRefreshContext.Provider
            value={{
                //for purchase
                draftSave,
                setDraftSave,
                clearDraft,

                //for credit sales
                salesDraftSave,
                setSalesDraftSave,
                clearSalesDraft,

                //for credit sales open
                salesOpenDraftSave,
                setSalesOpenDraftSave,
                clearSalesOpenDraft,

                //for credit sales return
                draftCreditSalesReturnSave,
                setDraftCreditSalesReturnSave,
                clearCreditSalesReturnDraft,

                //for sales quotation
                salesQuotationDraftSave,
                setSalesQuotationDraftSave,
                clearSalesQuotationDraft,

                //for header
                headerDraftSave,
                setHeaderDraftSave,
                clearHeaderDraft,

                //for stats card
                statsCardDraftSave,
                setStatsCardDraftSave,
                clearStatsCardDraft,

                //for sales chart
                salesChartDraftSave,
                setSalesChartDraftSave,
                clearSalesChartDraft,

                //for product from F9 key
                productDraftSave,
                setProductDraftSave,
                clearProductDraft,

                //for contact from F4 key
                contactDraftSave,
                setContactDraftSave,
                clearContactDraft,

                //for existing items
                itemsTableDraftSave,
                setItemsTableDraftSave,
                clearItemsTableDraft,

                //for stock status draft saving
                draftStockStatusSave,
                setDraftStockStatusSave,
                clearDraftStockStatusSave
            }}
        >
            {children}
        </PageNotRefreshContext.Provider>
    );
};

export const usePageNotRefreshContext = () => {
    const context = useContext(PageNotRefreshContext);
    if (!context) {
        throw new Error(
            'usePageNotRefreshContext must be used within a PageNotRefreshProvider'
        );
    }
    return context;
};