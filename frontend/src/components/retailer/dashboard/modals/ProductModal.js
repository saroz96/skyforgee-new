// ProductModal.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ProductList from './ProductList';
import ProductDetailsModal from './ProductDetailsModal';
import BatchUpdateModal from './BatchUpdateModal';
import { Modal } from 'react-bootstrap';
import { usePageNotRefreshContext } from '../../PageNotRefreshContext';

const ProductModal = ({ onClose }) => {
    const { productDraftSave, setProductDraftSave } = usePageNotRefreshContext();
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentFocus, setCurrentFocus] = useState(0);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showBatchUpdateModal, setShowBatchUpdateModal] = useState(false);
    const [batchToUpdate, setBatchToUpdate] = useState(null);
    const [loadingState, setLoadingState] = useState({
        isLoading: !productDraftSave,
        error: null,
        isFresh: false
    });
    const searchInputRef = useRef(null);
    const scrollDebounceRef = useRef(null);

    useEffect(() => {
        if (!loadingState.isLoading && productDraftSave) {
            setProducts(productDraftSave.products);
            setFilteredProducts(productDraftSave.products);
        }
    }, [loadingState.isLoading, productDraftSave]);

    useEffect(() => {
        fetchProducts();
        const interval = setInterval(fetchProducts, 300000);
        return () => clearInterval(interval);
    }, []); // Removed dependencies to prevent unnecessary fetches

    const fetchProducts = async () => {
        if (!productDraftSave) {
            setLoadingState(prev => ({ ...prev, isLoading: true }));
        }

        try {
            const response = await axios.get('/api/retailer/products');
            if (response.data.success) {
                const freshProducts = response.data.data;
                setProducts(freshProducts);
                // Only update filteredProducts if there's no active search
                if (!searchQuery) {
                    setFilteredProducts(freshProducts);
                }
                setProductDraftSave({ products: freshProducts });
                setLoadingState({ isLoading: false, error: null, isFresh: true });
            } else {
                throw new Error(response.data.error || 'Failed to fetch products');
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            if (!productDraftSave) {
                setLoadingState({
                    isLoading: false,
                    error: error.response?.data?.error || 'Error fetching products. Please try again.',
                    isFresh: false
                });
            }
        }
    };

    const handleSearch = (e) => {
        const query = e.target.value.toLowerCase();
        setSearchQuery(query);
        const filtered = products.filter(product =>
            product.name.toLowerCase().includes(query) ||
            (product.category && product.category.toLowerCase().includes(query)) ||
            product.uniqueNumber.toString().toLowerCase().includes(query)
        );
        setFilteredProducts(filtered);
        setCurrentFocus(0);
    };

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setShowDetailsModal(true);
    };

    const handleBatchUpdate = (batchIndex) => {
        setBatchToUpdate({
            index: batchIndex,
            ...selectedProduct.stockEntries[batchIndex]
        });
        setShowBatchUpdateModal(true);
    };

    const handleKeyNavigation = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const newFocus = (currentFocus + 1) % filteredProducts.length;
            setCurrentFocus(newFocus);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const newFocus = (currentFocus - 1 + filteredProducts.length) % filteredProducts.length;
            setCurrentFocus(newFocus);
        } else if (e.key === 'Enter' && filteredProducts[currentFocus]) {
            e.preventDefault();
            handleProductSelect(filteredProducts[currentFocus]);
        }
    };

    // Determine which data to display
    const displayProducts = loadingState.isFresh ? products :
        (productDraftSave?.products || products);
    const displayFilteredProducts = loadingState.isFresh ? 
        (searchQuery ? filteredProducts : products) :
        (productDraftSave?.products ?
            (searchQuery ? 
                productDraftSave.products.filter(p =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    p.uniqueNumber.toString().toLowerCase().includes(searchQuery.toLowerCase())
                ) : 
                productDraftSave.products
            ) :
            filteredProducts);

    if (loadingState.isLoading && !productDraftSave) {
        return (
            <Modal show={true} onHide={onClose} size="xl" centered backdrop="static">
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title>Product Details</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-flex justify-content-center align-items-center" style={{ height: '600px' }}>
                    <div className="text-center">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-2">Loading...</p>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }

    if (loadingState.error && !productDraftSave) {
        return (
            <Modal show={true} onHide={onClose} size="xl" centered backdrop="static">
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title>Product Details</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-flex justify-content-center align-items-center" style={{ height: '600px' }}>
                    <div className="alert alert-danger">
                        {loadingState.error}
                        <button className="btn btn-sm btn-danger ms-2" onClick={fetchProducts}>
                            Retry
                        </button>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }

    return (
        <>
            <Modal
                show={true}
                onHide={onClose}    
                size="lg"
                centered
                backdrop="static"
                dialogClassName="modal-custom-width"
            >
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title>Product Details</Modal.Title>
                </Modal.Header>

                <Modal.Body style={{
                    overflowY: 'auto',
                    height: '600px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div className="form-group mb-4">
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="form-control"
                            placeholder="Search items by item code, name & category..."
                            value={searchQuery}
                            onChange={handleSearch}
                            onKeyDown={handleKeyNavigation}
                            autoFocus
                        />
                    </div>

                    <div
                        style={{
                            overflow: 'hidden',
                            flex: '1',
                            minHeight: '200px',
                            position: 'relative'
                        }}
                        tabIndex="0"
                        onKeyDown={handleKeyNavigation}
                    >
                        {displayFilteredProducts.length > 0 ? (
                            <ProductList
                                products={displayFilteredProducts}
                                currentFocus={currentFocus}
                                onProductSelect={handleProductSelect}
                                scrollDebounceRef={scrollDebounceRef}
                            />
                        ) : (
                            <div className="d-flex justify-content-center align-items-center h-100">
                                <p className="text-muted">
                                    {searchQuery ? 'No products match your search' : 'No products available'}
                                </p>
                            </div>
                        )}
                    </div>
                </Modal.Body>
                {/* <Modal.Footer className="d-flex justify-content-between">
                    <div className="expiry-summary">
                        <small>
                            <span className="expiry-status expired me-2">Expired</span>
                            <span className="expiry-status danger me-2">Critical (≤30 days)</span>
                            <span className="expiry-status warning me-2">Warning (≤90 days)</span>
                        </small>
                    </div>
                    <button type="button" className="btn btn-danger" onClick={onClose}>Close</button>
                </Modal.Footer> */}
            </Modal>

            {showDetailsModal && selectedProduct && (
                <ProductDetailsModal
                    product={selectedProduct}
                    onClose={() => setShowDetailsModal(false)}
                    onBatchUpdate={handleBatchUpdate}
                />
            )}

            {showBatchUpdateModal && batchToUpdate && (
                <BatchUpdateModal
                    product={selectedProduct}
                    batch={batchToUpdate}
                    onClose={() => setShowBatchUpdateModal(false)}
                    onUpdate={fetchProducts}
                />
            )}

            <style jsx global>{`
                .modal-custom-width {
                    max-width: calc(100% - 400px) !important;
                    margin-left: auto;
                    margin-right: auto;
                }
            `}</style>
        </>
    );
};

export default ProductModal;