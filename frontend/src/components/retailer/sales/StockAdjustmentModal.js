// // StockAdjustmentModal.js
// import React, { useState, useEffect, useRef } from 'react';
// import axios from 'axios';
// import NepaliDate from 'nepali-date-converter';
// import NotificationToast from '../../NotificationToast';

// const getDefaultExpiryDate = () => {
//     const today = new Date();
//     today.setFullYear(today.getFullYear() + 2);
//     return today.toISOString().split('T')[0];
// };

// const StockAdjustmentModal = ({
//     show,
//     onClose,
//     product,
//     onStockAdded
// }) => {
//     const [formData, setFormData] = useState({
//         adjustmentType: 'xcess',
//         quantity: 1,
//         batchNumber: '',
//         expiryDate: getDefaultExpiryDate(),
//         puPrice: 0,
//         price: 0,
//         mrp: 0,
//         marginPercentage: 0,
//         note: '',
//         nepaliDate: new NepaliDate().format('YYYY-MM-DD'),
//         billDate: new Date().toISOString().split('T')[0]
//     });

//     const [isLoading, setIsLoading] = useState(false);
//     const [nextBillNumber, setNextBillNumber] = useState('');
//     const [notification, setNotification] = useState({
//         show: false,
//         message: '',
//         type: 'success'
//     });

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     const quantityInputRef = useRef(null);

//     // Load initial data when modal opens
//     useEffect(() => {
//         if (show && product) {
//             fetchInitialData();
//             generateBatchNumber();
//             setFormData(prev => ({
//                 ...prev,
//                 puPrice: product.latestPuPrice || product.puPrice || 0,
//                 price: product.stockEntries?.[0]?.price || 0,
//                 mrp: product.mrp || 0
//             }));
//         }
//     }, [show, product]);

//     const fetchInitialData = async () => {
//         try {
//             const response = await api.get('/api/retailer/stockAdjustments/new');
//             setNextBillNumber(response.data.data.nextBillNumber);
//         } catch (error) {
//             console.error('Error fetching stock adjustment data:', error);
//             setNotification({
//                 show: true,
//                 message: 'Failed to load form data',
//                 type: 'error'
//             });
//         }
//     };

//     const generateBatchNumber = () => {
//         const timestamp = new Date().getTime().toString().slice(-6);
//         const random = Math.random().toString(36).substring(2, 5).toUpperCase();
//         setFormData(prev => ({
//             ...prev,
//             batchNumber: `BATCH-${timestamp}-${random}`
//         }));
//     };

//     const calculatePriceFromMargin = () => {
//         const puPrice = parseFloat(formData.puPrice) || 0;
//         const margin = parseFloat(formData.marginPercentage) || 0;
//         const calculatedPrice = puPrice * (1 + margin / 100);
//         setFormData(prev => ({
//             ...prev,
//             price: Math.round(calculatedPrice * 100) / 100
//         }));
//     };

//     const calculateMarginFromPrice = () => {
//         const puPrice = parseFloat(formData.puPrice) || 0;
//         const price = parseFloat(formData.price) || 0;
//         if (puPrice > 0) {
//             const margin = ((price - puPrice) / puPrice) * 100;
//             setFormData(prev => ({
//                 ...prev,
//                 marginPercentage: Math.round(margin * 100) / 100
//             }));
//         }
//     };

//     const handleSubmit = async (e) => {
//         e.preventDefault();

//         if (!formData.quantity || formData.quantity <= 0) {
//             setNotification({
//                 show: true,
//                 message: 'Please enter a valid quantity',
//                 type: 'error'
//             });
//             return;
//         }

//         setIsLoading(true);
//         try {
//             const adjustmentData = {
//                 adjustmentType: 'xcess',
//                 items: [{
//                     item: product._id,
//                     unit: product.unit?._id || product.unit,
//                     quantity: formData.quantity,
//                     batchNumber: formData.batchNumber,
//                     expiryDate: formData.expiryDate,
//                     puPrice: formData.puPrice,
//                     price: formData.price,
//                     mrp: formData.mrp,
//                     marginPercentage: formData.marginPercentage,
//                     reason: ['excess_stock'],
//                     vatStatus: product.vatStatus || 'vatable'
//                 }],
//                 note: formData.note || `Excess stock added for ${product.name}`,
//                 nepaliDate: formData.nepaliDate,
//                 billDate: formData.billDate,
//                 isVatExempt: 'all',
//                 vatPercentage: 13,
//                 discountPercentage: 0
//             };

//             const response = await api.post('/api/retailer/stockAdjustments/new', adjustmentData);

//             // Notify parent component
//             if (onStockAdded) {
//                 onStockAdded(response.data.data);
//             }

//             // Close modal after success
//             setTimeout(() => {
//                 handleClose();
//             }, 1500);

//         } catch (error) {
//             console.error('Error adding stock:', error);
//             setNotification({
//                 show: true,
//                 message: error.response?.data?.error || 'Failed to add stock',
//                 type: 'error'
//             });
//         } finally {
//             setIsLoading(false);
//         }
//     };

//     const handleClose = () => {
//         setFormData({
//             adjustmentType: 'xcess',
//             quantity: 1,
//             batchNumber: '',
//             expiryDate: '',
//             puPrice: 0,
//             price: 0,
//             mrp: 0,
//             marginPercentage: 0,
//             note: '',
//             nepaliDate: new NepaliDate().format('YYYY-MM-DD'),
//             billDate: new Date().toISOString().split('T')[0]
//         });
//         onClose();
//     };

//     if (!show || !product) return null;

//     return (
//         <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
//             <div className="modal-dialog modal-lg">
//                 <div className="modal-content">
//                     <div className="modal-header bg-primary text-white">
//                         <h5 className="modal-title">
//                             <i className="bi bi-plus-circle me-2"></i>
//                             Add Excess Stock - {product.name}
//                         </h5>
//                         <button
//                             type="button"
//                             className="btn-close btn-close-white"
//                             onClick={handleClose}
//                         ></button>
//                     </div>

//                     <form onSubmit={handleSubmit}>
//                         <div className="modal-body">
//                             {/* Product Info */}
//                             <div className="row mb-3">
//                                 <div className="col-md-6">
//                                     <label className="form-label">Product Name</label>
//                                     <input
//                                         type="text"
//                                         className="form-control"
//                                         value={product.name}
//                                         disabled
//                                     />
//                                 </div>
//                                 <div className="col-md-3">
//                                     <label className="form-label">Current Stock</label>
//                                     <input
//                                         type="text"
//                                         className="form-control"
//                                         value={product.stock || 0}
//                                         disabled
//                                     />
//                                 </div>
//                                 <div className="col-md-3">
//                                     <label className="form-label">Vch. No</label>
//                                     <input
//                                         type="text"
//                                         className="form-control"
//                                         value={nextBillNumber}
//                                         disabled
//                                     />
//                                 </div>
//                             </div>

//                             {/* Stock Details */}
//                             <div className="row mb-3">
//                                 <div className="col-md-3">
//                                     <label className="form-label">Quantity *</label>
//                                     <input
//                                         ref={quantityInputRef}
//                                         type="number"
//                                         className="form-control"
//                                         value={formData.quantity}
//                                         onChange={(e) => setFormData(prev => ({
//                                             ...prev,
//                                             quantity: (e.target.value)
//                                         }))}
//                                         required
//                                     />
//                                 </div>
//                                 <div className="col-md-3">
//                                     <label className="form-label">Unit</label>
//                                     <input
//                                         type="text"
//                                         className="form-control"
//                                         value={product.unit?.name || 'N/A'}
//                                         disabled
//                                     />
//                                 </div>
//                                 <div className="col-md-3">
//                                     <label className="form-label">Batch Number</label>
//                                     <input
//                                         type="text"
//                                         className="form-control"
//                                         value={formData.batchNumber}
//                                         onChange={(e) => setFormData(prev => ({
//                                             ...prev,
//                                             batchNumber: e.target.value
//                                         }))}
//                                         required
//                                     />
//                                 </div>
//                                 <div className="col-md-3">
//                                     <label className="form-label">Expiry Date</label>
//                                     <input
//                                         type="date"
//                                         className="form-control"
//                                         value={getDefaultExpiryDate()}
//                                         onChange={(e) => setFormData(prev => ({
//                                             ...prev,
//                                             expiryDate: e.target.value
//                                         }))}
//                                     />
//                                 </div>
//                             </div>

//                             {/* Pricing */}
//                             <div className="row mb-3">
//                                 <div className="col-md-3">
//                                     <label className="form-label">Purchase Price *</label>
//                                     <input
//                                         type="number"
//                                         step="0.01"
//                                         className="form-control"
//                                         value={formData.puPrice}
//                                         onChange={(e) => setFormData(prev => ({
//                                             ...prev,
//                                             puPrice: parseFloat(e.target.value) || 0
//                                         }))}
//                                         onBlur={calculatePriceFromMargin}
//                                         required
//                                     />
//                                 </div>
//                                 <div className="col-md-3">
//                                     <label className="form-label">Margin %</label>
//                                     <input
//                                         type="number"
//                                         step="0.01"
//                                         className="form-control"
//                                         value={formData.marginPercentage}
//                                         onChange={(e) => setFormData(prev => ({
//                                             ...prev,
//                                             marginPercentage: parseFloat(e.target.value) || 0
//                                         }))}
//                                         onBlur={calculatePriceFromMargin}
//                                     />
//                                 </div>
//                                 <div className="col-md-3">
//                                     <label className="form-label">Selling Price *</label>
//                                     <input
//                                         type="number"
//                                         step="0.01"
//                                         className="form-control"
//                                         value={formData.price}
//                                         onChange={(e) => setFormData(prev => ({
//                                             ...prev,
//                                             price: parseFloat(e.target.value) || 0
//                                         }))}
//                                         onBlur={calculateMarginFromPrice}
//                                         required
//                                     />
//                                 </div>
//                                 <div className="col-md-3">
//                                     <label className="form-label">MRP</label>
//                                     <input
//                                         type="number"
//                                         step="0.01"
//                                         className="form-control"
//                                         value={formData.mrp}
//                                         onChange={(e) => setFormData(prev => ({
//                                             ...prev,
//                                             mrp: parseFloat(e.target.value) || 0
//                                         }))}
//                                     />
//                                 </div>
//                             </div>

//                             {/* Dates and Notes */}
//                             <div className="row mb-3">
//                                 <div className="col-md-6">
//                                     <label className="form-label">Date</label>
//                                     <input
//                                         type="text"
//                                         className="form-control"
//                                         value={formData.nepaliDate}
//                                         onChange={(e) => setFormData(prev => ({
//                                             ...prev,
//                                             nepaliDate: e.target.value
//                                         }))}
//                                     />
//                                 </div>
//                                 <div className="col-md-6">
//                                     <label className="form-label">Notes</label>
//                                     <textarea
//                                         className="form-control"
//                                         rows="2"
//                                         value={formData.note}
//                                         onChange={(e) => setFormData(prev => ({
//                                             ...prev,
//                                             note: e.target.value
//                                         }))}
//                                         placeholder=""
//                                     />
//                                 </div>
//                             </div>

//                             {/* <div className="mb-3">
//                                 <label className="form-label">Notes</label>
//                                 <textarea
//                                     className="form-control"
//                                     rows="2"
//                                     value={formData.note}
//                                     onChange={(e) => setFormData(prev => ({
//                                         ...prev,
//                                         note: e.target.value
//                                     }))}
//                                     placeholder="Optional notes about this stock adjustment..."
//                                 />
//                             </div> */}

//                             {/* Summary */}
//                             <div className="alert alert-info">
//                                 <div className="row">
//                                     <div className="col-md-4">
//                                         <strong>Total Value:</strong>
//                                         {(formData.quantity * formData.puPrice).toFixed(2)}
//                                     </div>
//                                     <div className="col-md-4">
//                                         <strong>New Stock:</strong>
//                                         {(product.stock || 0) + parseInt(formData.quantity)}
//                                     </div>
//                                     <div className="col-md-4">
//                                         <strong>Type:</strong> Xcess
//                                     </div>
//                                 </div>
//                             </div>
//                         </div>

//                         <div className="modal-footer">
//                             <button
//                                 type="button"
//                                 className="btn btn-secondary"
//                                 onClick={handleClose}
//                                 disabled={isLoading}
//                             >
//                                 Cancel
//                             </button>
//                             <button
//                                 type="submit"
//                                 className="btn btn-primary"
//                                 disabled={isLoading}
//                             >
//                                 {isLoading ? (
//                                     <>
//                                         <span className="spinner-border spinner-border-sm me-2"></span>
//                                         Adding Stock...
//                                     </>
//                                 ) : (
//                                     <>
//                                         <i className="bi bi-check-circle me-2"></i>
//                                         Add Stock
//                                     </>
//                                 )}
//                             </button>
//                         </div>
//                     </form>
//                 </div>
//             </div>

//             <NotificationToast
//                 show={notification.show}
//                 message={notification.message}
//                 type={notification.type}
//                 onClose={() => setNotification({ ...notification, show: false })}
//             />
//         </div>
//     );
// };

// export default StockAdjustmentModal;

// StockAdjustmentModal.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import NepaliDate from 'nepali-date-converter';
import NotificationToast from '../../NotificationToast';

const getDefaultExpiryDate = () => {
    const today = new Date();
    today.setFullYear(today.getFullYear() + 2);
    return today.toISOString().split('T')[0];
};

const StockAdjustmentModal = ({
    show,
    onClose,
    product,
    onStockAdded
}) => {
    const [formData, setFormData] = useState({
        adjustmentType: 'xcess',
        quantity: 1,
        batchNumber: '',
        expiryDate: getDefaultExpiryDate(),
        puPrice: 0,
        price: 0,
        mrp: 0,
        marginPercentage: 0,
        note: '',
        nepaliDate: new NepaliDate().format('YYYY-MM-DD'),
        billDate: new Date().toISOString().split('T')[0]
    });

    const [isLoading, setIsLoading] = useState(false);
    const [nextBillNumber, setNextBillNumber] = useState('');
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    const quantityInputRef = useRef(null);

    // Load initial data when modal opens
    useEffect(() => {
        if (show && product) {
            fetchInitialData();
            generateBatchNumber();
            setFormData(prev => ({
                ...prev,
                puPrice: product.latestPuPrice || product.puPrice || 0,
                price: product.stockEntries?.[0]?.price || 0,
                mrp: product.mrp || 0
            }));
        }
    }, [show, product]);

    const fetchInitialData = async () => {
        try {
            const response = await api.get('/api/retailer/stockAdjustments/new');
            setNextBillNumber(response.data.data.nextBillNumber);
        } catch (error) {
            console.error('Error fetching stock adjustment data:', error);
            setNotification({
                show: true,
                message: 'Failed to load form data',
                type: 'error'
            });
        }
    };

    const generateBatchNumber = () => {
        const timestamp = new Date().getTime().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        setFormData(prev => ({
            ...prev,
            batchNumber: `BATCH-${timestamp}-${random}`
        }));
    };

    const calculatePriceFromMargin = () => {
        const puPrice = parseFloat(formData.puPrice) || 0;
        const margin = parseFloat(formData.marginPercentage) || 0;
        const calculatedPrice = puPrice * (1 + margin / 100);
        setFormData(prev => ({
            ...prev,
            price: Math.round(calculatedPrice * 100) / 100
        }));
    };

    const calculateMarginFromPrice = () => {
        const puPrice = parseFloat(formData.puPrice) || 0;
        const price = parseFloat(formData.price) || 0;
        if (puPrice > 0) {
            const margin = ((price - puPrice) / puPrice) * 100;
            setFormData(prev => ({
                ...prev,
                marginPercentage: Math.round(margin * 100) / 100
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.quantity || formData.quantity <= 0) {
            setNotification({
                show: true,
                message: 'Please enter a valid quantity',
                type: 'error'
            });
            return;
        }

        setIsLoading(true);
        try {
            const adjustmentData = {
                adjustmentType: 'xcess',
                items: [{
                    item: product._id,
                    unit: product.unit?._id || product.unit,
                    quantity: formData.quantity,
                    batchNumber: formData.batchNumber,
                    expiryDate: formData.expiryDate,
                    puPrice: formData.puPrice,
                    price: formData.price,
                    mrp: formData.mrp,
                    marginPercentage: formData.marginPercentage,
                    reason: ['excess_stock'],
                    vatStatus: product.vatStatus || 'vatable'
                }],
                note: formData.note || `Excess stock added for ${product.name}`,
                nepaliDate: formData.nepaliDate,
                billDate: formData.billDate,
                isVatExempt: 'all',
                vatPercentage: 13,
                discountPercentage: 0
            };

            const response = await api.post('/api/retailer/stockAdjustments/new', adjustmentData);

            // Notify parent component
            if (onStockAdded) {
                onStockAdded(response.data.data);
            }

            // Close modal after success
            setTimeout(() => {
                handleClose();
            }, 1500);

        } catch (error) {
            console.error('Error adding stock:', error);
            setNotification({
                show: true,
                message: error.response?.data?.error || 'Failed to add stock',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            adjustmentType: 'xcess',
            quantity: 1,
            batchNumber: '',
            expiryDate: '',
            puPrice: 0,
            price: 0,
            mrp: 0,
            marginPercentage: 0,
            note: '',
            nepaliDate: new NepaliDate().format('YYYY-MM-DD'),
            billDate: new Date().toISOString().split('T')[0]
        });
        onClose();
    };

    if (!show || !product) return null;

    return (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div className="modal-dialog modal-lg">
                <div className="modal-content" style={{ 
                    borderRadius: '12px', 
                    border: '3px solid #2c80ff',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }}>
                    {/* Header - Mart Style */}
                    <div className="modal-header text-white" style={{ 
                        background: 'linear-gradient(135deg, #2c80ff 0%, #1a5fcc 100%)',
                        borderTopLeftRadius: '9px',
                        borderTopRightRadius: '9px',
                        borderBottom: '4px solid #1a5fcc',
                        padding: '20px 25px'
                    }}>
                        <h5 className="modal-title mb-0" style={{ 
                            fontSize: '1.4rem', 
                            fontWeight: '700',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                        }}>
                            📦 ADD STOCK - {product.name.toUpperCase()}
                        </h5>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={handleClose}
                            style={{ fontSize: '0.9rem' }}
                        ></button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="modal-body" style={{ padding: '25px', background: '#f8fafc' }}>
                            {/* Product Quick Info Bar */}
                            <div className="row mb-4">
                                <div className="col-12">
                                    <div className="product-info-bar p-3" style={{
                                        background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                                        borderRadius: '8px',
                                        border: '2px solid #90caf9'
                                    }}>
                                        <div className="row align-items-center">
                                            <div className="col-md-4">
                                                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1565c0' }}>PRODUCT</div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0d47a1' }}>
                                                    {product.name}
                                                </div>
                                            </div>
                                            <div className="col-md-2 text-center">
                                                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#1565c0' }}>CURRENT STOCK</div>
                                                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#e65100' }}>
                                                    {product.stock || 0}
                                                </div>
                                            </div>
                                            <div className="col-md-2 text-center">
                                                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#1565c0' }}>UNIT</div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#2e7d32' }}>
                                                    {product.unit?.name || 'N/A'}
                                                </div>
                                            </div>
                                            <div className="col-md-2 text-center">
                                                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#1565c0' }}>VOUCHER NO</div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#7b1fa2' }}>
                                                    {nextBillNumber}
                                                </div>
                                            </div>
                                            <div className="col-md-2 text-center">
                                                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#1565c0' }}>TYPE</div>
                                                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#c62828' }}>
                                                    EXCESS
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stock Details Section */}
                            <div className="section-card mb-4">
                                <div className="section-header mb-3" style={{
                                    borderBottom: '3px solid #2c80ff',
                                    paddingBottom: '8px'
                                }}>
                                    <h6 style={{ 
                                        fontSize: '1.1rem', 
                                        fontWeight: '700', 
                                        color: '#2c80ff',
                                        margin: 0
                                    }}>
                                        📋 STOCK DETAILS
                                    </h6>
                                </div>
                                <div className="row g-3">
                                    <div className="col-md-3">
                                        <label className="form-label" style={{ fontWeight: '600', color: '#555' }}>
                                            📦 Quantity *
                                        </label>
                                        <input
                                            ref={quantityInputRef}
                                            type="number"
                                            className="form-control form-control-lg"
                                            value={formData.quantity}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                quantity: (e.target.value)
                                            }))}
                                            required
                                            style={{
                                                border: '2px solid #4caf50',
                                                borderRadius: '6px',
                                                fontWeight: '600',
                                                textAlign: 'center',
                                                fontSize: '1.1rem'
                                            }}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label" style={{ fontWeight: '600', color: '#555' }}>
                                            🔢 Batch Number
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.batchNumber}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                batchNumber: e.target.value
                                            }))}
                                            required
                                            style={{
                                                border: '2px solid #2196f3',
                                                borderRadius: '6px',
                                                fontWeight: '500'
                                            }}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label" style={{ fontWeight: '600', color: '#555' }}>
                                            📅 Expiry Date
                                        </label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={getDefaultExpiryDate()}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                expiryDate: e.target.value
                                            }))}
                                            style={{
                                                border: '2px solid #ff9800',
                                                borderRadius: '6px',
                                                fontWeight: '500'
                                            }}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label" style={{ fontWeight: '600', color: '#555' }}>
                                            🏷️ Barcode
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Auto-generated"
                                            disabled
                                            style={{
                                                background: '#f5f5f5',
                                                border: '2px solid #9e9e9e',
                                                borderRadius: '6px',
                                                fontStyle: 'italic'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Pricing Section */}
                            <div className="section-card mb-4">
                                <div className="section-header mb-3" style={{
                                    borderBottom: '3px solid #ff6b35',
                                    paddingBottom: '8px'
                                }}>
                                    <h6 style={{ 
                                        fontSize: '1.1rem', 
                                        fontWeight: '700', 
                                        color: '#ff6b35',
                                        margin: 0
                                    }}>
                                        💰 PRICING INFORMATION
                                    </h6>
                                </div>
                                <div className="row g-3">
                                    <div className="col-md-3">
                                        <label className="form-label" style={{ fontWeight: '600', color: '#555' }}>
                                            💵 Purchase Price *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-control"
                                            value={formData.puPrice}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                puPrice: parseFloat(e.target.value) || 0
                                            }))}
                                            onBlur={calculatePriceFromMargin}
                                            required
                                            style={{
                                                border: '2px solid #4caf50',
                                                borderRadius: '6px',
                                                fontWeight: '600'
                                            }}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label" style={{ fontWeight: '600', color: '#555' }}>
                                            📈 Margin %
                                        </label>
                                        <div className="input-group">
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-control"
                                                value={formData.marginPercentage}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    marginPercentage: parseFloat(e.target.value) || 0
                                                }))}
                                                onBlur={calculatePriceFromMargin}
                                                style={{
                                                    border: '2px solid #ff9800',
                                                    borderRadius: '6px',
                                                    fontWeight: '600'
                                                }}
                                            />
                                            <span className="input-group-text" style={{ 
                                                background: '#ff9800', 
                                                color: 'white',
                                                fontWeight: '600',
                                                border: '2px solid #ff9800'
                                            }}>%</span>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label" style={{ fontWeight: '600', color: '#555' }}>
                                            🏪 Selling Price *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-control"
                                            value={formData.price}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                price: parseFloat(e.target.value) || 0
                                            }))}
                                            onBlur={calculateMarginFromPrice}
                                            required
                                            style={{
                                                border: '2px solid #2196f3',
                                                borderRadius: '6px',
                                                fontWeight: '600'
                                            }}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label" style={{ fontWeight: '600', color: '#555' }}>
                                            🏷️ MRP
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-control"
                                            value={formData.mrp}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                mrp: parseFloat(e.target.value) || 0
                                            }))}
                                            style={{
                                                border: '2px solid #9c27b0',
                                                borderRadius: '6px',
                                                fontWeight: '600'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Summary Card - Receipt Style */}
                            <div className="section-card mb-3">
                                <div className="summary-receipt p-3" style={{
                                    background: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)',
                                    borderRadius: '8px',
                                    border: '2px solid #4caf50',
                                    borderLeft: '6px solid #4caf50'
                                }}>
                                    <div className="row text-center">
                                        <div className="col-md-4 border-end">
                                            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#2e7d32' }}>TOTAL VALUE</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1b5e20' }}>
                                                {(formData.quantity * formData.puPrice).toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="col-md-4 border-end">
                                            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#2e7d32' }}>NEW STOCK</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#e65100' }}>
                                                {(product.stock || 0) + parseInt(formData.quantity)}
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#2e7d32' }}>PROFIT MARGIN</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#7b1fa2' }}>
                                                {formData.marginPercentage}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notes Section */}
                            <div className="section-card">
                                <div className="section-header mb-2" style={{
                                    borderBottom: '2px solid #757575',
                                    paddingBottom: '6px'
                                }}>
                                    <h6 style={{ 
                                        fontSize: '1rem', 
                                        fontWeight: '600', 
                                        color: '#757575',
                                        margin: 0
                                    }}>
                                        📝 ADDITIONAL NOTES
                                    </h6>
                                </div>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    value={formData.note}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        note: e.target.value
                                    }))}
                                    placeholder="Enter any notes about this stock addition..."
                                    style={{
                                        border: '2px solid #757575',
                                        borderRadius: '6px',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Footer Actions - Mart Style */}
                        <div className="modal-footer" style={{ 
                            background: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                            borderBottomLeftRadius: '9px',
                            borderBottomRightRadius: '9px',
                            borderTop: '3px solid #bdbdbd',
                            padding: '20px 25px'
                        }}>
                            <div className="w-100 d-flex justify-content-between align-items-center">
                                {/* Quick Stats */}
                                <div className="d-flex gap-3">
                                    <span className="badge bg-primary" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                                        ⏰ {new Date().toLocaleTimeString()}
                                    </span>
                                    <span className="badge bg-success" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                                        📊 Stock: {product.stock || 0}
                                    </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={handleClose}
                                        disabled={isLoading}
                                        style={{
                                            borderRadius: '6px',
                                            fontWeight: '600',
                                            padding: '10px 20px',
                                            border: '2px solid #6c757d'
                                        }}
                                    >
                                        ❌ Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-success"
                                        disabled={isLoading}
                                        style={{
                                            borderRadius: '6px',
                                            fontWeight: '600',
                                            padding: '10px 25px',
                                            border: '2px solid #28a745',
                                            background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                                        }}
                                    >
                                        {isLoading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>
                                                Adding Stock...
                                            </>
                                        ) : (
                                            <>
                                                ✅ Add Stock
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />
        </div>
    );
};

export default StockAdjustmentModal;