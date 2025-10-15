
// // Discount Modal Component
// import { useState, useEffect } from "react";

// const DiscountModal = ({
//     discountInput,
//     discountType,
//     setDiscountInput,
//     setDiscountType,
//     setFormData,
//     setIsDiscountModalOpen,
//     calculatePOSSummary,
//     focusTenderAmount,
//     items = [],
//     formData // Add formData to access VAT settings
// }) => {
//     const [localDiscount, setLocalDiscount] = useState(discountInput);
//     const [localType, setLocalType] = useState(discountType);
//     const [activeTab, setActiveTab] = useState('quick');
//     const [calculatedDiscount, setCalculatedDiscount] = useState({
//         amount: 0,
//         percentage: 0,
//         taxableDiscount: 0,
//         nonTaxableDiscount: 0,
//         totalDiscount: 0
//     });

//     // Calculate taxable and non-taxable amounts
//     const calculateTaxableAmounts = () => {
//         const summary = getPOSSummary();

//         // Separate vatable and non-vatable items
//         const vatableItems = items.filter(item => item.vatStatus === 'vatable');
//         const nonVatableItems = items.filter(item => item.vatStatus !== 'vatable');

//         const vatableSubTotal = vatableItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
//         const nonVatableSubTotal = nonVatableItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

//         return {
//             vatableSubTotal,
//             nonVatableSubTotal,
//             totalSubTotal: summary.subTotal
//         };
//     };

//     // Safe calculation of POS summary
//     const getPOSSummary = () => {
//         try {
//             return calculatePOSSummary ? calculatePOSSummary() : {
//                 subTotal: 0,
//                 discountAmount: 0,
//                 taxableAmount: 0,
//                 vatAmount: 0,
//                 grandTotal: 0,
//                 billNumber: 'N/A'
//             };
//         } catch (error) {
//             return {
//                 subTotal: 0,
//                 discountAmount: 0,
//                 taxableAmount: 0,
//                 vatAmount: 0,
//                 grandTotal: 0,
//                 billNumber: 'N/A'
//             };
//         }
//     };

//     // Calculate discount in real-time (APPLIED TO BOTH TAXABLE AND NON-TAXABLE AMOUNTS)
//     useEffect(() => {
//         if (localDiscount) {
//             const discountValue = parseFloat(localDiscount) || 0;
//             const amounts = calculateTaxableAmounts();
//             const vatableSubTotal = amounts.vatableSubTotal;
//             const nonVatableSubTotal = amounts.nonVatableSubTotal;
//             const totalSubTotal = amounts.totalSubTotal;

//             let taxableDiscount = 0;
//             let nonTaxableDiscount = 0;
//             let totalDiscount = 0;

//             if (localType === 'percentage') {
//                 // Apply percentage discount to both taxable and non-taxable amounts proportionally
//                 taxableDiscount = (vatableSubTotal * discountValue) / 100;
//                 nonTaxableDiscount = (nonVatableSubTotal * discountValue) / 100;
//                 totalDiscount = taxableDiscount + nonTaxableDiscount;
//             } else {
//                 // Apply fixed amount discount proportionally to both taxable and non-taxable amounts
//                 if (totalSubTotal > 0) {
//                     const taxableRatio = vatableSubTotal / totalSubTotal;
//                     const nonTaxableRatio = nonVatableSubTotal / totalSubTotal;

//                     taxableDiscount = discountValue * taxableRatio;
//                     nonTaxableDiscount = discountValue * nonTaxableRatio;
//                     totalDiscount = taxableDiscount + nonTaxableDiscount;
//                 } else {
//                     taxableDiscount = 0;
//                     nonTaxableDiscount = 0;
//                     totalDiscount = 0;
//                 }
//             }

//             // Ensure discounts don't exceed the respective subtotals
//             taxableDiscount = Math.min(taxableDiscount, vatableSubTotal);
//             nonTaxableDiscount = Math.min(nonTaxableDiscount, nonVatableSubTotal);
//             totalDiscount = taxableDiscount + nonTaxableDiscount;

//             setCalculatedDiscount({
//                 amount: totalDiscount,
//                 percentage: localType === 'percentage' ? discountValue : (totalSubTotal > 0 ? (totalDiscount / totalSubTotal) * 100 : 0),
//                 taxableDiscount: taxableDiscount,
//                 nonTaxableDiscount: nonTaxableDiscount,
//                 totalDiscount: totalDiscount
//             });
//         } else {
//             setCalculatedDiscount({
//                 amount: 0,
//                 percentage: 0,
//                 taxableDiscount: 0,
//                 nonTaxableDiscount: 0,
//                 totalDiscount: 0
//             });
//         }
//     }, [localDiscount, localType, calculatePOSSummary, items]);

//     const applyDiscount = () => {
//         if (!localDiscount) {
//             removeDiscount();
//             return;
//         }

//         // Apply discount to both taxable and non-taxable amounts
//         setFormData(prev => ({
//             ...prev,
//             discountPercentage: calculatedDiscount.percentage,
//             discountAmount: calculatedDiscount.amount
//         }));

//         setDiscountInput(localDiscount);
//         setDiscountType(localType);
//         setIsDiscountModalOpen(false);
//         focusTenderAmount?.();
//     };

//     const removeDiscount = () => {
//         setLocalDiscount('');
//         setFormData(prev => ({
//             ...prev,
//             discountAmount: 0,
//             discountPercentage: 0
//         }));
//         setDiscountInput('');
//         setIsDiscountModalOpen(false);
//         focusTenderAmount?.();
//     };

//     const quickDiscounts = {
//         percentage: [5, 10, 15, 20, 25],
//         amount: [50, 100, 200, 500, 1000]
//     };

//     const smartDiscounts = () => {
//         const amounts = calculateTaxableAmounts();
//         const totalSubTotal = amounts.totalSubTotal;
//         const suggestions = [];

//         if (totalSubTotal > 1000) {
//             suggestions.push({ type: 'percentage', value: 10, label: '10% ' });
//             suggestions.push({ type: 'amount', value: 100, label: '100 Off ' });
//         } else if (totalSubTotal > 500) {
//             suggestions.push({ type: 'percentage', value: 5, label: '5% Off ' });
//             suggestions.push({ type: 'amount', value: 50, label: '50 Off ' });
//         } else if (totalSubTotal > 200) {
//             suggestions.push({ type: 'percentage', value: 3, label: '3% Off ' });
//             suggestions.push({ type: 'amount', value: 20, label: '20 Off ' });
//         }

//         return suggestions;
//     };

//     const handleQuickDiscount = (value, type) => {
//         setLocalType(type);
//         setLocalDiscount(value.toString());
//         setActiveTab('custom');
//     };

//     const summary = getPOSSummary();
//     const amounts = calculateTaxableAmounts();
//     const newTaxableAmount = amounts.vatableSubTotal - calculatedDiscount.taxableDiscount;
//     const vatAmount = formData.isVatExempt !== 'true' ? (newTaxableAmount * formData.vatPercentage) / 100 : 0;
//     const newTotal = (amounts.nonVatableSubTotal - calculatedDiscount.nonTaxableDiscount) + newTaxableAmount + vatAmount;

//     const itemsCount = items?.length || 0;

//     return (
//         <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
//             <div className="modal-dialog modal-lg">
//                 <div className="modal-content">
//                     <div className="modal-header bg-gradient-warning text-white">
//                         <h5 className="modal-title">
//                             <i className="bi bi-tag me-2"></i>
//                             Apply Discount
//                         </h5>
//                         <button
//                             type="button"
//                             className="btn-close btn-close-white"
//                             onClick={() => setIsDiscountModalOpen?.(false)}
//                         ></button>
//                     </div>

//                     <div className="modal-body p-0">
//                         {/* Summary Bar */}
//                         <div className="bg-light p-3 border-bottom">
//                             <div className="row text-center">
//                                 <div className="col-3">
//                                     <div className="text-muted small">Total Amount</div>
//                                     <div className="h6 mb-0">{amounts.totalSubTotal.toFixed(2)}</div>
//                                 </div>
//                                 <div className="col-3">
//                                     <div className="text-muted small">Taxable</div>
//                                     <div className="h6 mb-0">{amounts.vatableSubTotal.toFixed(2)}</div>
//                                 </div>
//                                 <div className="col-3">
//                                     <div className="text-muted small">Non-Taxable</div>
//                                     <div className="h6 mb-0">{amounts.nonVatableSubTotal.toFixed(2)}</div>
//                                 </div>
//                                 <div className="col-3">
//                                     <div className="text-muted small">Total Discount</div>
//                                     <div className="h6 mb-0 text-danger">-{calculatedDiscount.totalDiscount.toFixed(2)}</div>
//                                 </div>
//                             </div>
//                         </div>

//                         {/* Taxable vs Non-Taxable Breakdown */}
//                         {/* <div className="p-3 bg-info bg-opacity-10 border-bottom">
//                             <div className="row small">
//                                 <div className="col-6">
//                                     <strong>Taxable Items Breakdown:</strong>
//                                     <div className="mt-1">
//                                         <span>Original: {amounts.vatableSubTotal.toFixed(2)}</span>
//                                         <br />
//                                         <span>Discount: -{calculatedDiscount.taxableDiscount.toFixed(2)}</span>
//                                         <br />
//                                         <span>New Taxable: {newTaxableAmount.toFixed(2)}</span>
//                                         <br />
//                                         <span>VAT ({formData.vatPercentage}%): {vatAmount.toFixed(2)}</span>
//                                     </div>
//                                 </div>
//                                 <div className="col-6">
//                                     <strong>Non-Taxable Items Breakdown:</strong>
//                                     <div className="mt-1">
//                                         <span>Original: {amounts.nonVatableSubTotal.toFixed(2)}</span>
//                                         <br />
//                                         <span>Discount: -{calculatedDiscount.nonTaxableDiscount.toFixed(2)}</span>
//                                         <br />
//                                         <span>New Non-Taxable: {(amounts.nonVatableSubTotal - calculatedDiscount.nonTaxableDiscount).toFixed(2)}</span>
//                                         <br />
//                                         <span>VAT: 0.00 (Exempt)</span>
//                                     </div>
//                                 </div>
//                             </div>
//                         </div> */}

//                         {/* Tab Navigation */}
//                         <div className="border-bottom">
//                             <ul className="nav nav-tabs nav-justified">
//                                 <li className="nav-item">
//                                     <button
//                                         className={`nav-link ${activeTab === 'quick' ? 'active' : ''}`}
//                                         onClick={() => setActiveTab('quick')}
//                                     >
//                                         <i className="bi bi-lightning me-1"></i>
//                                         Quick Discounts
//                                     </button>
//                                 </li>
//                                 <li className="nav-item">
//                                     <button
//                                         className={`nav-link ${activeTab === 'custom' ? 'active' : ''}`}
//                                         onClick={() => setActiveTab('custom')}
//                                     >
//                                         <i className="bi bi-sliders me-1"></i>
//                                         Custom Discount
//                                     </button>
//                                 </li>
//                             </ul>
//                         </div>

//                         {/* Tab Content */}
//                         <div className="p-3">
//                             {activeTab === 'quick' && (
//                                 <div>
//                                     {/* Smart Suggestions */}
//                                     {smartDiscounts().length > 0 && (
//                                         <div className="mb-4">
//                                             <label className="form-label text-success">
//                                                 <i className="bi bi-star me-1"></i>
//                                                 Smart Suggestions
//                                             </label>
//                                             <div className="d-grid gap-2">
//                                                 {smartDiscounts().map((discount, index) => (
//                                                     <button
//                                                         key={index}
//                                                         type="button"
//                                                         className="btn btn-outline-success text-start"
//                                                         onClick={() => handleQuickDiscount(discount.value, discount.type)}
//                                                     >
//                                                         <div className="d-flex justify-content-between align-items-center">
//                                                             <span>{discount.label}</span>
//                                                             <small className="text-muted">
//                                                                 {discount.type === 'percentage'
//                                                                     ? `-${((amounts.totalSubTotal * discount.value) / 100).toFixed(2)}`
//                                                                     : `-${Math.min(discount.value, amounts.totalSubTotal)}`
//                                                                 }
//                                                             </small>
//                                                         </div>
//                                                     </button>
//                                                 ))}
//                                             </div>
//                                         </div>
//                                     )}

//                                     {/* Quick Percentage Discounts */}
//                                     <div className="mb-3">
//                                         <label className="form-label">Percentage Discounts </label>
//                                         <div className="d-flex flex-wrap gap-2">
//                                             {quickDiscounts.percentage.map((discount) => (
//                                                 <button
//                                                     key={`pct-${discount}`}
//                                                     type="button"
//                                                     className="btn btn-outline-primary btn-sm"
//                                                     onClick={() => handleQuickDiscount(discount, 'percentage')}
//                                                     disabled={amounts.totalSubTotal === 0}
//                                                 >
//                                                     {discount}%
//                                                 </button>
//                                             ))}
//                                         </div>
//                                     </div>

//                                     {/* Quick Amount Discounts */}
//                                     <div className="mb-3">
//                                         <label className="form-label">Fixed Amount Discounts </label>
//                                         <div className="d-flex flex-wrap gap-2">
//                                             {quickDiscounts.amount.map((discount) => (
//                                                 <button
//                                                     key={`amt-${discount}`}
//                                                     type="button"
//                                                     className="btn btn-outline-info btn-sm"
//                                                     onClick={() => handleQuickDiscount(discount, 'amount')}
//                                                     disabled={discount > amounts.totalSubTotal}
//                                                 >
//                                                     {discount}
//                                                 </button>
//                                             ))}
//                                         </div>
//                                     </div>
//                                 </div>
//                             )}

//                             {activeTab === 'custom' && (
//                                 <div>
//                                     {/* Discount Type Toggle */}
//                                     <div className="discount-type-toggle mb-3">
//                                         <label className="form-label">Discount Type </label>
//                                         <div className="btn-group w-100" role="group">
//                                             <button
//                                                 type="button"
//                                                 className={`btn ${localType === 'percentage' ? 'btn-primary' : 'btn-outline-primary'}`}
//                                                 onClick={() => setLocalType('percentage')}
//                                             >
//                                                 <i className="bi bi-percent me-1"></i>
//                                                 Percentage
//                                             </button>
//                                             <button
//                                                 type="button"
//                                                 className={`btn ${localType === 'amount' ? 'btn-primary' : 'btn-outline-primary'}`}
//                                                 onClick={() => setLocalType('amount')}
//                                             >
//                                                 <span className="fw-bold me-1">रु</span>
//                                                 Fixed Amount
//                                             </button>
//                                         </div>
//                                     </div>

//                                     {/* Discount Input */}
//                                     <div className="mb-3">
//                                         <label className="form-label">
//                                             Enter Discount {localType === 'percentage' ? 'Percentage' : 'Amount'}
//                                         </label>
//                                         <div className="input-group input-group-lg">
//                                             <span className="input-group-text">
//                                                 {localType === 'percentage' ? '%' : ''}
//                                             </span>
//                                             <input
//                                                 type="number"
//                                                 className="form-control"
//                                                 value={localDiscount}
//                                                 onChange={(e) => setLocalDiscount(e.target.value)}
//                                                 placeholder={localType === 'percentage' ? '0-100' : '0.00'}
//                                                 min="0"
//                                                 max={localType === 'percentage' ? '100' : amounts.totalSubTotal}
//                                                 step={localType === 'percentage' ? '1' : '0.01'}
//                                                 autoFocus
//                                             />
//                                         </div>
//                                         <div className="form-text">
//                                             {localType === 'percentage'
//                                                 ? `Enter a value between 0-100% (Total: ${amounts.totalSubTotal.toFixed(2)})`
//                                                 : `Maximum discount: ${amounts.totalSubTotal.toFixed(2)} (Total amount)`
//                                             }
//                                         </div>
//                                     </div>

//                                     {/* Discount Breakdown */}
//                                     {localDiscount && (
//                                         <div className="alert alert-info">
//                                             <div className="row small">
//                                                 <div className="col-6">Total Amount:</div>
//                                                 <div className="col-6 text-end">{amounts.totalSubTotal.toFixed(2)}</div>

//                                                 <div className="col-6">Taxable Discount:</div>
//                                                 <div className="col-6 text-end text-danger">
//                                                     -{calculatedDiscount.taxableDiscount.toFixed(2)}
//                                                 </div>

//                                                 <div className="col-6">Non-Taxable Discount:</div>
//                                                 <div className="col-6 text-end text-danger">
//                                                     -{calculatedDiscount.nonTaxableDiscount.toFixed(2)}
//                                                 </div>

//                                                 <div className="col-6">Total Discount:</div>
//                                                 <div className="col-6 text-end text-danger">
//                                                     -{calculatedDiscount.totalDiscount.toFixed(2)}
//                                                     {localType === 'percentage' && ` (${calculatedDiscount.percentage.toFixed(2)}%)`}
//                                                 </div>

//                                                 <div className="col-6">You Save:</div>
//                                                 <div className="col-6 text-end text-success">
//                                                     {calculatedDiscount.totalDiscount.toFixed(2)}
//                                                 </div>
//                                             </div>
//                                         </div>
//                                     )}
//                                 </div>
//                             )}
//                         </div>
//                     </div>

//                     {/* Footer Actions */}
//                     <div className="modal-footer">
//                         <button
//                             type="button"
//                             className="btn btn-outline-secondary"
//                             onClick={() => setIsDiscountModalOpen?.(false)}
//                         >
//                             <i className="bi bi-x-circle me-1"></i>
//                             Cancel
//                         </button>

//                         {(summary.discountAmount > 0 || localDiscount) && (
//                             <button
//                                 type="button"
//                                 className="btn btn-danger"
//                                 onClick={removeDiscount}
//                             >
//                                 <i className="bi bi-trash me-1"></i>
//                                 Remove Discount
//                             </button>
//                         )}

//                         <button
//                             type="button"
//                             className="btn btn-success"
//                             onClick={applyDiscount}
//                             disabled={!localDiscount || calculatedDiscount.amount <= 0 || amounts.totalSubTotal === 0}
//                         >
//                             <i className="bi bi-check-circle me-1"></i>
//                             Apply Discount
//                         </button>
//                     </div>

//                     {/* Quick Stats */}
//                     <div className="modal-footer bg-light">
//                         <div className="w-100 text-center small text-muted">
//                             <div className="row">
//                                 <div className="col-3">
//                                     <i className="bi bi-cart me-1"></i>
//                                     {itemsCount} Items
//                                 </div>
//                                 <div className="col-3">
//                                     <i className="bi bi-receipt me-1"></i>
//                                     {items.filter(item => item.vatStatus === 'vatable').length} Taxable
//                                 </div>
//                                 <div className="col-3">
//                                     <i className="bi bi-file-earmark me-1"></i>
//                                     {items.filter(item => item.vatStatus !== 'vatable').length} Non-Taxable
//                                 </div>
//                                 <div className="col-3">
//                                     <i className="bi bi-clock me-1"></i>
//                                     {new Date().toLocaleTimeString()}
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default DiscountModal;

// Discount Modal Component
import { useState, useEffect } from "react";

const DiscountModal = ({
    discountInput,
    discountType,
    setDiscountInput,
    setDiscountType,
    setFormData,
    setIsDiscountModalOpen,
    calculatePOSSummary,
    focusTenderAmount,
    items = [],
    formData
}) => {
    const [localDiscount, setLocalDiscount] = useState(discountInput);
    const [localType, setLocalType] = useState(discountType);
    const [activeTab, setActiveTab] = useState('quick');
    const [calculatedDiscount, setCalculatedDiscount] = useState({
        amount: 0,
        percentage: 0,
        taxableDiscount: 0,
        nonTaxableDiscount: 0,
        totalDiscount: 0
    });

    // Calculate taxable and non-taxable amounts
    const calculateTaxableAmounts = () => {
        const summary = getPOSSummary();

        const vatableItems = items.filter(item => item.vatStatus === 'vatable');
        const nonVatableItems = items.filter(item => item.vatStatus !== 'vatable');

        const vatableSubTotal = vatableItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const nonVatableSubTotal = nonVatableItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        return {
            vatableSubTotal,
            nonVatableSubTotal,
            totalSubTotal: summary.subTotal
        };
    };

    // Safe calculation of POS summary
    const getPOSSummary = () => {
        try {
            return calculatePOSSummary ? calculatePOSSummary() : {
                subTotal: 0,
                discountAmount: 0,
                taxableAmount: 0,
                vatAmount: 0,
                grandTotal: 0,
                billNumber: 'N/A'
            };
        } catch (error) {
            return {
                subTotal: 0,
                discountAmount: 0,
                taxableAmount: 0,
                vatAmount: 0,
                grandTotal: 0,
                billNumber: 'N/A'
            };
        }
    };

    // Calculate discount in real-time
    useEffect(() => {
        if (localDiscount) {
            const discountValue = parseFloat(localDiscount) || 0;
            const amounts = calculateTaxableAmounts();
            const vatableSubTotal = amounts.vatableSubTotal;
            const nonVatableSubTotal = amounts.nonVatableSubTotal;
            const totalSubTotal = amounts.totalSubTotal;

            let taxableDiscount = 0;
            let nonTaxableDiscount = 0;
            let totalDiscount = 0;

            if (localType === 'percentage') {
                taxableDiscount = (vatableSubTotal * discountValue) / 100;
                nonTaxableDiscount = (nonVatableSubTotal * discountValue) / 100;
                totalDiscount = taxableDiscount + nonTaxableDiscount;
            } else {
                if (totalSubTotal > 0) {
                    const taxableRatio = vatableSubTotal / totalSubTotal;
                    const nonTaxableRatio = nonVatableSubTotal / totalSubTotal;

                    taxableDiscount = discountValue * taxableRatio;
                    nonTaxableDiscount = discountValue * nonTaxableRatio;
                    totalDiscount = taxableDiscount + nonTaxableDiscount;
                }
            }

            taxableDiscount = Math.min(taxableDiscount, vatableSubTotal);
            nonTaxableDiscount = Math.min(nonTaxableDiscount, nonVatableSubTotal);
            totalDiscount = taxableDiscount + nonTaxableDiscount;

            setCalculatedDiscount({
                amount: totalDiscount,
                percentage: localType === 'percentage' ? discountValue : (totalSubTotal > 0 ? (totalDiscount / totalSubTotal) * 100 : 0),
                taxableDiscount: taxableDiscount,
                nonTaxableDiscount: nonTaxableDiscount,
                totalDiscount: totalDiscount
            });
        } else {
            setCalculatedDiscount({
                amount: 0,
                percentage: 0,
                taxableDiscount: 0,
                nonTaxableDiscount: 0,
                totalDiscount: 0
            });
        }
    }, [localDiscount, localType, calculatePOSSummary, items]);

    const applyDiscount = () => {
        if (!localDiscount) {
            removeDiscount();
            return;
        }

        setFormData(prev => ({
            ...prev,
            discountPercentage: calculatedDiscount.percentage,
            discountAmount: calculatedDiscount.amount
        }));

        setDiscountInput(localDiscount);
        setDiscountType(localType);
        setIsDiscountModalOpen(false);
        focusTenderAmount?.();
    };

    const removeDiscount = () => {
        setLocalDiscount('');
        setFormData(prev => ({
            ...prev,
            discountAmount: 0,
            discountPercentage: 0
        }));
        setDiscountInput('');
        setIsDiscountModalOpen(false);
        focusTenderAmount?.();
    };

    const quickDiscounts = {
        percentage: [5, 10, 15, 20, 25],
        amount: [50, 100, 200, 500, 1000]
    };

    const smartDiscounts = () => {
        const amounts = calculateTaxableAmounts();
        const totalSubTotal = amounts.totalSubTotal;
        const suggestions = [];

        if (totalSubTotal > 1000) {
            suggestions.push({ type: 'percentage', value: 10, label: '10% Off' });
            suggestions.push({ type: 'amount', value: 100, label: '100 Off' });
        } else if (totalSubTotal > 500) {
            suggestions.push({ type: 'percentage', value: 5, label: '5% Off' });
            suggestions.push({ type: 'amount', value: 50, label: '50 Off' });
        } else if (totalSubTotal > 200) {
            suggestions.push({ type: 'percentage', value: 3, label: '3% Off' });
            suggestions.push({ type: 'amount', value: 20, label: '20 Off' });
        }

        return suggestions;
    };

    const handleQuickDiscount = (value, type) => {
        setLocalType(type);
        setLocalDiscount(value.toString());
        setActiveTab('custom');
    };

    const summary = getPOSSummary();
    const amounts = calculateTaxableAmounts();
    const itemsCount = items?.length || 0;

    return (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div className="modal-dialog modal-md"> {/* Changed to modal-md for compact mart style */}
                <div className="modal-content" style={{ borderRadius: '10px', border: '2px solid #e0e0e0' }}>
                    {/* Header - Mart Style */}
                    <div className="modal-header bg-success text-white" style={{ 
                        borderTopLeftRadius: '8px', 
                        borderTopRightRadius: '8px',
                        borderBottom: '3px solid #28a745',
                        padding: '15px 20px'
                    }}>
                        <h5 className="modal-title mb-0" style={{ fontSize: '1.3rem', fontWeight: '600' }}>
                            🏪 DISCOUNT MANAGER
                        </h5>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={() => setIsDiscountModalOpen?.(false)}
                            style={{ fontSize: '0.8rem' }}
                        ></button>
                    </div>

                    <div className="modal-body p-0">
                        {/* Quick Summary Bar - Mart Style */}
                        <div className="bg-light p-3 border-bottom" style={{ background: '#f8f9fa !important' }}>
                            <div className="row text-center">
                                <div className="col-4 border-end">
                                    <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>TOTAL BILL</div>
                                    <div className="h6 mb-0 text-success" style={{ fontSize: '1.1rem', fontWeight: '700' }}>{amounts.totalSubTotal.toFixed(2)}</div>
                                </div>
                                <div className="col-4 border-end">
                                    <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>DISCOUNT</div>
                                    <div className="h6 mb-0 text-danger" style={{ fontSize: '1.1rem', fontWeight: '700' }}>-{calculatedDiscount.totalDiscount.toFixed(2)}</div>
                                </div>
                                <div className="col-4">
                                    <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>NEW TOTAL</div>
                                    <div className="h6 mb-0 text-primary" style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                                        {(amounts.totalSubTotal - calculatedDiscount.totalDiscount).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tab Navigation - Modern Style */}
                        <div className="border-bottom bg-white">
                            <ul className="nav nav-pills nav-justified" style={{ padding: '10px 15px' }}>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeTab === 'quick' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('quick')}
                                        style={{
                                            borderRadius: '20px',
                                            fontWeight: '600',
                                            fontSize: '0.9rem',
                                            padding: '8px 15px',
                                            border: activeTab === 'quick' ? '2px solid #28a745' : '2px solid transparent'
                                        }}
                                    >
                                        ⚡ Quick Discount
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeTab === 'custom' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('custom')}
                                        style={{
                                            borderRadius: '20px',
                                            fontWeight: '600',
                                            fontSize: '0.9rem',
                                            padding: '8px 15px',
                                            border: activeTab === 'custom' ? '2px solid #28a745' : '2px solid transparent'
                                        }}
                                    >
                                        🎯 Custom Discount
                                    </button>
                                </li>
                            </ul>
                        </div>

                        {/* Tab Content */}
                        <div className="p-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {activeTab === 'quick' && (
                                <div>
                                    {/* Smart Suggestions - Mart Style */}
                                    {smartDiscounts().length > 0 && (
                                        <div className="mb-4">
                                            <label className="form-label text-primary mb-2" style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                                💡 SMART SUGGESTIONS
                                            </label>
                                            <div className="row g-2">
                                                {smartDiscounts().map((discount, index) => (
                                                    <div key={index} className="col-6">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-primary w-100 text-start p-2"
                                                            onClick={() => handleQuickDiscount(discount.value, discount.type)}
                                                            style={{
                                                                borderRadius: '8px',
                                                                border: '2px solid #007bff',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '500'
                                                            }}
                                                        >
                                                            <div className="d-flex justify-content-between align-items-center">
                                                                <span>{discount.label}</span>
                                                                <small className="badge bg-primary">
                                                                    {discount.type === 'percentage'
                                                                        ? `-${((amounts.totalSubTotal * discount.value) / 100).toFixed(0)}`
                                                                        : `-${discount.value}`
                                                                    }
                                                                </small>
                                                            </div>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick Percentage Discounts - Button Grid */}
                                    <div className="mb-3">
                                        <label className="form-label mb-2" style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                            📊 PERCENTAGE DISCOUNTS
                                        </label>
                                        <div className="row g-2">
                                            {quickDiscounts.percentage.map((discount) => (
                                                <div key={`pct-${discount}`} className="col-4">
                                                    <button
                                                        type="button"
                                                        className="btn btn-success w-100"
                                                        onClick={() => handleQuickDiscount(discount, 'percentage')}
                                                        disabled={amounts.totalSubTotal === 0}
                                                        style={{
                                                            borderRadius: '6px',
                                                            fontSize: '0.9rem',
                                                            fontWeight: '600',
                                                            padding: '8px 5px'
                                                        }}
                                                    >
                                                        {discount}%
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Quick Amount Discounts - Button Grid */}
                                    <div className="mb-3">
                                        <label className="form-label mb-2" style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                            💰 FIXED DISCOUNTS
                                        </label>
                                        <div className="row g-2">
                                            {quickDiscounts.amount.map((discount) => (
                                                <div key={`amt-${discount}`} className="col-4">
                                                    <button
                                                        type="button"
                                                        className="btn btn-warning w-100"
                                                        onClick={() => handleQuickDiscount(discount, 'amount')}
                                                        disabled={discount > amounts.totalSubTotal}
                                                        style={{
                                                            borderRadius: '6px',
                                                            fontSize: '0.9rem',
                                                            fontWeight: '600',
                                                            padding: '8px 5px',
                                                            color: '#000'
                                                        }}
                                                    >
                                                        {discount}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'custom' && (
                                <div>
                                    {/* Discount Type Toggle - Modern Style */}
                                    <div className="discount-type-toggle mb-4">
                                        <label className="form-label mb-2" style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                            🎚️ DISCOUNT TYPE
                                        </label>
                                        <div className="btn-group w-100 shadow-sm" role="group" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                                            <button
                                                type="button"
                                                className={`btn ${localType === 'percentage' ? 'btn-success' : 'btn-outline-success'}`}
                                                onClick={() => setLocalType('percentage')}
                                                style={{
                                                    fontWeight: '600',
                                                    padding: '10px',
                                                    border: '2px solid #28a745'
                                                }}
                                            >
                                                📈 Percentage
                                            </button>
                                            <button
                                                type="button"
                                                className={`btn ${localType === 'amount' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                onClick={() => setLocalType('amount')}
                                                style={{
                                                    fontWeight: '600',
                                                    padding: '10px',
                                                    border: '2px solid #007bff'
                                                }}
                                            >
                                                💵 Fixed Amount
                                            </button>
                                        </div>
                                    </div>

                                    {/* Discount Input - Mart Style */}
                                    <div className="mb-4">
                                        <label className="form-label mb-2" style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                            {localType === 'percentage' ? '📊 ENTER DISCOUNT %' : '💵 ENTER DISCOUNT AMOUNT'}
                                        </label>
                                        <div className="input-group input-group-lg shadow-sm" style={{ borderRadius: '8px' }}>
                                            <span className="input-group-text bg-light" style={{ 
                                                fontWeight: '600',
                                                border: '2px solid #dee2e6',
                                                borderRight: 'none'
                                            }}>
                                                {localType === 'percentage' ? '%' : ''}
                                            </span>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={localDiscount}
                                                onChange={(e) => setLocalDiscount(e.target.value)}
                                                placeholder={localType === 'percentage' ? '0-100' : '0.00'}
                                                min="0"
                                                max={localType === 'percentage' ? '100' : amounts.totalSubTotal}
                                                step={localType === 'percentage' ? '1' : '0.01'}
                                                autoFocus
                                                style={{
                                                    border: '2px solid #dee2e6',
                                                    borderLeft: 'none',
                                                    fontWeight: '600',
                                                    fontSize: '1.1rem',
                                                    textAlign: 'center'
                                                }}
                                            />
                                        </div>
                                        <div className="form-text text-muted mt-1" style={{ fontSize: '0.8rem' }}>
                                            {localType === 'percentage'
                                                ? `Enter percentage (0-100%) • Max discount: ${amounts.totalSubTotal.toFixed(2)}`
                                                : `Enter amount • Max: ${amounts.totalSubTotal.toFixed(2)}`
                                            }
                                        </div>
                                    </div>

                                    {/* Discount Breakdown - Receipt Style */}
                                    {localDiscount && (
                                        <div className="alert alert-info border-0 shadow-sm" style={{ borderRadius: '8px' }}>
                                            <div className="row small" style={{ fontWeight: '500' }}>
                                                <div className="col-6">Total Bill:</div>
                                                <div className="col-6 text-end">{amounts.totalSubTotal.toFixed(2)}</div>
                                                
                                                <div className="col-6 text-danger">Taxable Discount:</div>
                                                <div className="col-6 text-end text-danger">-{calculatedDiscount.taxableDiscount.toFixed(2)}</div>
                                                
                                                <div className="col-6 text-danger">Non-Taxable Discount:</div>
                                                <div className="col-6 text-end text-danger">-{calculatedDiscount.nonTaxableDiscount.toFixed(2)}</div>
                                                
                                                <hr className="my-2" />
                                                
                                                <div className="col-6 text-success" style={{ fontWeight: '600' }}>Total Discount:</div>
                                                <div className="col-6 text-end text-success" style={{ fontWeight: '600' }}>
                                                    -{calculatedDiscount.totalDiscount.toFixed(2)}
                                                    {localType === 'percentage' && ` (${calculatedDiscount.percentage.toFixed(1)}%)`}
                                                </div>
                                                
                                                {/* <div className="col-6 text-primary" style={{ fontWeight: '700' }}>You Save:</div>
                                                <div className="col-6 text-end text-primary" style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                                                    {calculatedDiscount.totalDiscount.toFixed(2)}
                                                </div> */}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions - Mart Style */}
                    <div className="modal-footer bg-light" style={{ 
                        borderBottomLeftRadius: '8px', 
                        borderBottomRightRadius: '8px',
                        padding: '15px 20px',
                        borderTop: '2px solid #e0e0e0'
                    }}>
                        <div className="w-100 d-flex justify-content-between align-items-center">
                            {/* Quick Stats */}
                            <div className="text-muted small" style={{ fontSize: '0.8rem' }}>
                                <span className="badge bg-secondary me-2">🛒 {itemsCount} Items</span>
                                <span className="badge bg-info me-2">📊 {items.filter(item => item.vatStatus === 'vatable').length} Taxable</span>
                                <span className="badge bg-warning">📝 {items.filter(item => item.vatStatus !== 'vatable').length} Non-Tax</span>
                            </div>

                            {/* Action Buttons */}
                            <div className="d-flex gap-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => setIsDiscountModalOpen?.(false)}
                                    style={{ borderRadius: '6px', fontWeight: '600' }}
                                >
                                    ❌ Cancel
                                </button>

                                {(summary.discountAmount > 0 || localDiscount) && (
                                    <button
                                        type="button"
                                        className="btn btn-danger btn-sm"
                                        onClick={removeDiscount}
                                        style={{ borderRadius: '6px', fontWeight: '600' }}
                                    >
                                        🗑️ Remove
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className="btn btn-success btn-sm"
                                    onClick={applyDiscount}
                                    disabled={!localDiscount || calculatedDiscount.amount <= 0 || amounts.totalSubTotal === 0}
                                    style={{ borderRadius: '6px', fontWeight: '600' }}
                                >
                                    ✅ Apply
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiscountModal;