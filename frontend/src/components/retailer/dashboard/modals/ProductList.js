import React, { useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import '../../../../stylesheet/retailer/dashboard/modals/ProductList.css';
import { calculateExpiryStatus } from './ExpiryStatus';

const ProductList = React.forwardRef(({ products, currentFocus, onProductSelect }, ref) => {
    const listRef = useRef(null);

    // Scroll to center the focused item whenever currentFocus changes
    useEffect(() => {
        if (listRef.current && currentFocus !== null) {
            const itemHeight = 40; // Same as your itemSize
            const listHeight = 600; // Same as your list height
            const visibleItems = Math.floor(listHeight / itemHeight);
            const centerOffset = Math.floor(visibleItems / 2);

            // Calculate position to center the focused item
            const scrollToPosition = Math.max(0, (currentFocus - centerOffset) * itemHeight);

            listRef.current.scrollTo(scrollToPosition);
        }
    }, [currentFocus]);

    const Row = useCallback(({ index, style, data }) => {
        const product = data[index];
        const expiryStatus = calculateExpiryStatus(product);
        const isFocused = index === currentFocus;

        const rowClass = [
            'list-group-item',
            'product-row',
            isFocused ? 'active' : '',
            product.vatStatus === 'vatable' ? 'vatable' : '',
            product.vatStatus === 'vatExempt' ? 'vatExempt' : '',
            `expiry-${expiryStatus}`
        ].filter(Boolean).join(' ');

        // Calculate rate
        const baseRate = Math.round(product.rate * 100) / 100;

        const rateWithVAT = product.vatStatus === 'vatable'
            ? Math.round((product.rate * 1.13) * 100) / 100
            : baseRate;

        return (
            <div
                className={rowClass}
                onClick={() => onProductSelect(product)}
                style={{
                    ...style,
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer'
                }}
            >
                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.uniqueNumber}</div>
                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.hscode}</div>
                <div className="product-cell product-name" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.name}</div>
                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.company}</div>
                {/* <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.category}</div> */}
                {/* S.Rate */}
                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>
                    Rs.{baseRate} {product.vatStatus === 'vatable'}
                </div>
                {/* With Tax */}
                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>
                    Rs.{rateWithVAT}
                </div>
                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.stock}</div>
                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.unit}</div>
                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{Math.round(product.margin * 100) / 100}</div>
            </div>
        );
    }, [currentFocus, onProductSelect]);

    return (
        <div id="productDetailsContainer" style={{ height: '100%' }}>
            {/* Header remains static */}
            <ul id="productDetailsHeader" className="list-group list-group-horizontal">
                <li className="product-cell" style={{ textAlign: 'left' }}>#</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>HSN</li>
                <li className="product-cell product-name" style={{ textAlign: 'left' }}>Description of Goods</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>Company</li>
                {/* <li className="product-cell" style={{ textAlign: 'left' }}>Category</li> */}
                <li className="product-cell" style={{ textAlign: 'left' }}>S.Rate</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>with tax</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>Stock</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>Unit</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>%</li>
            </ul>

            {/* Virtualized list */}
            <div style={{ height: 'calc(100% - 40px)', outline: 'none' }}>
                {products.length === 0 ? (
                    <div className="list-group-item text-center py-4 text-muted">
                        No products found
                    </div>
                ) : (
                    <List
                        ref={listRef}
                        height={600}
                        itemCount={products.length}
                        itemSize={40}
                        width="100%"
                        itemData={products}
                    >
                        {Row}
                    </List>
                )}
            </div>
        </div>
    );
});

export default ProductList;