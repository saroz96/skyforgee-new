import React from 'react';
import { Modal } from 'react-bootstrap';
import '../../../../stylesheet/retailer/dashboard/modals/ProductDetailsModal.css';

const ProductDetailsModal = ({ product, onClose, onBatchUpdate }) => {
    const getExpiryStatus = (expiryDate) => {
        if (!expiryDate) return { status: 'safe', text: 'OK' };

        const now = new Date();
        const expiry = new Date(expiryDate);
        const timeDiff = expiry - now;
        const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysUntilExpiry <= 0) {
            return { status: 'expired', text: 'EXPIRED' };
        } else if (daysUntilExpiry <= 30) {
            return { status: 'danger', text: `${daysUntilExpiry}d` };
        } else if (daysUntilExpiry <= 90) {
            return { status: 'warning', text: `${daysUntilExpiry}d` };
        } else {
            return { status: 'safe', text: 'OK' };
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    return (
        <Modal
            show={true}
            onHide={onClose}
            size="xl"
            centered
            backdrop="static"
            dialogClassName="product-details-modal-centered"
        >
            <Modal.Header closeButton className="bg-primary text-white">
                <Modal.Title>
                    {product.name} - {product.uniqueNumber}
                    <span className="ms-3 badge bg-secondary">{product.category}</span>
                </Modal.Title>
            </Modal.Header>

            <Modal.Body style={{
                maxHeight: 'calc(70vh - 120px)',
                overflowY: 'auto',
                padding: '15px'
            }}>
                {product.composition.length > 0 && (
                    <div className="mt-3">
                        <h6 className="mb-2"><strong>Composition:</strong></h6>
                        <div className="d-flex flex-wrap gap-2">
                            {product.composition.map((comp, idx) => (
                                <span key={idx} className="badge bg-light text-dark border">
                                    {comp.uniqueNumber ? `${comp.uniqueNumber} - ` : ''}{comp.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                <div className="table-responsive">
                    <table className="table table-hover align-middle">
                        <thead className="table-light sticky-top">
                            <tr>
                                <th>Batch</th>
                                <th>Expiry</th>
                                <th>Status</th>
                                <th>Stock</th>
                                <th>Unit</th>
                                <th>C.P (Rs.)</th>
                                <th>S.P (Rs.)</th>
                                <th>MRP (Rs.)</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {product.stockEntries
                                .filter(entry => entry.quantity > 0)
                                .map((entry, index) => {
                                    const status = getExpiryStatus(entry.expiryDate);

                                    return (
                                        <tr key={index} className={status.status}>
                                            <td>{entry.batchNumber || '-'}</td>
                                            <td>{formatDate(entry.expiryDate)}</td>
                                            <td>
                                                <span className={`expiry-badge-modal ${status.status}`}>
                                                    {status.text}
                                                </span>
                                            </td>
                                            <td>{entry.quantity}</td>
                                            <td>{product.unit}</td>
                                            <td>{Math.round(entry.puPrice * 100) / 100}</td>
                                            <td>{Math.round(entry.price * 100) / 100}</td>
                                            <td>{Math.round(entry.mrp * 100) / 100}</td>
                                            <td>
                                                <button
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={() => onBatchUpdate(index)}
                                                >
                                                    Update
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>

                <div className="expiry-legend mt-3">
                    <small className="text-muted">
                        <strong>Expiry Legend:</strong>
                        <span className="expiry-badge-modal expired ms-2">EXPIRED</span>
                        <span className="expiry-badge-modal danger ms-2">≤30d</span>
                        <span className="expiry-badge-modal warning ms-2">≤90d</span>
                        <span className="expiry-badge-modal safe ms-2">OK</span>
                    </small>
                </div>
            </Modal.Body>

            <Modal.Footer className="py-2">
                <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={onClose}
                >
                    Close
                </button>
            </Modal.Footer>

            <style jsx global>{`
                .product-details-modal-centered {
                    max-width: 60vw;
                    width: 60vw;
                    height: 70vh;
                    margin: 0 auto;
                }
            `}</style>
        </Modal>
    );
};

export default ProductDetailsModal;