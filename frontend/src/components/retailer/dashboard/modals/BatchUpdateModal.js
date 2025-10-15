import React, { useState } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import axios from 'axios';
import NotificationToast from '../../../NotificationToast'; // Import the toast component
const BatchUpdateModal = ({ product, batch, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        batchNumber: batch.batchNumber || '',
        expiryDate: batch.expiryDate ? new Date(batch.expiryDate).toISOString().split('T')[0] : '',
        price: batch.price || 0
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: ''
    });
    const [apiError, setApiError] = useState(null); // For detailed error messages

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setApiError(null); // Reset error state
        
        try {
            const response = await axios.put(
                `/api/retailer/update-batch/${product.id}/${batch.index}`,
                formData,
                {
                    validateStatus: (status) => status < 500 // Don't throw for server errors
                }
            );
            
            if (response.status === 200 && response.data.success) {
                setNotification({
                    show: true,
                    message: 'Batch updated successfully!',
                    type: 'success'
                });
                onUpdate();
                setTimeout(() => onClose(), 1500);
            } else {
                // Handle API validation errors
                const errorMsg = response.data.message || 
                               response.data.error || 
                               'Failed to update batch';
                setNotification({
                    show: true,
                    message: errorMsg,
                    type: 'error'
                });
                setApiError(errorMsg);
            }
        } catch (error) {
            console.error('Error updating batch:', error);
            
            let errorMessage = 'An error occurred while updating batch';
            if (error.response) {
                // Server responded with error status
                errorMessage = error.response.data?.message || 
                             error.response.data?.error || 
                             `Server error: ${error.response.status}`;
            } else if (error.request) {
                // Request was made but no response
                errorMessage = 'No response from server';
            }
            
            setNotification({
                show: true,
                message: errorMessage,
                type: 'error'
            });
            setApiError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeNotification = () => {
        setNotification(prev => ({ ...prev, show: false }));
    };

    return (
        <>
            <Modal
                show={true}
                onHide={onClose}
                centered
                backdrop="static"
                size="lg"
                className="batch-update-modal"
            >
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title>
                        <i className="bi bi-pencil-square me-2"></i>
                        Update Batch - {product.name}
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    <Form id="batchUpdateForm" onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Batch Number</Form.Label>
                            <Form.Control
                                type="text"
                                name="batchNumber"
                                value={formData.batchNumber}
                                onChange={handleChange}
                                required
                                placeholder="Enter batch number"
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Expiry Date</Form.Label>
                            <Form.Control
                                type="date"
                                name="expiryDate"
                                value={formData.expiryDate}
                                onChange={handleChange}
                            />
                            <Form.Text className="text-muted">
                                Leave empty if no expiry date
                            </Form.Text>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Sales Price (Rs.)</Form.Label>
                            <div className="input-group">
                                <span className="input-group-text">Rs.</span>
                                <Form.Control
                                    type="number"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    step="0.01"
                                    min="0"
                                    required
                                    placeholder="Enter sales price"
                                />
                            </div>
                        </Form.Group>
                    </Form>

                    <div className="current-info p-3 bg-light rounded mt-3">
                        <h6 className="mb-2">Current Batch Info:</h6>
                        <div className="row">
                            <div className="col-md-4">
                                <strong>Batch:</strong> {batch.batchNumber || '-'}
                            </div>
                            <div className="col-md-4">
                                <strong>Expiry:</strong> {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '-'}
                            </div>
                            <div className="col-md-4">
                                <strong>Current Price:</strong> Rs.{batch.price.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </Modal.Body>

                <Modal.Footer>
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        <i className="bi bi-x-lg me-1"></i> Cancel
                    </Button>
                    <Button 
                        variant="success" 
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                Saving...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg me-1"></i>
                                Save Changes
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Notification Toast */}
            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={closeNotification}
            />
        </>
    );
};

export default BatchUpdateModal;