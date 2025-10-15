import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../Header';
import ProductModal from '../dashboard/modals/ProductModal';

const CreditSalesVoucherNumber = () => {
    const [billNumber, setBillNumber] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingLatest, setIsFetchingLatest] = useState(true);
    const navigate = useNavigate();
    const [showProductModal, setShowProductModal] = useState(false);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Fetch the latest bill number when component mounts
    useEffect(() => {
        const fetchLatestBillNumber = async () => {
            try {
                const response = await api.get('/api/retailer/credit-sales/finds', {
                    withCredentials: true
                });

                console.log('API Response:', response.data);
                if (response.data.success) {
                    console.log('Bill number from API:', response.data.data.latestBillNumber);
                    setBillNumber(response.data.data.latestBillNumber);
                }
            } catch (err) {
                console.error('Error fetching latest bill number:', err);
                // Don't show error to user - just proceed with empty field
            } finally {
                setIsFetchingLatest(false);
            }
        };

        fetchLatestBillNumber();
    }, []);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!billNumber.trim()) {
            setError('Please enter a voucher number');
            return;
        }

        setIsLoading(true);
        try {
            // Call the API endpoint to find sales bill by bill number
            const response = await axios.get('/api/retailer/credit-sales/edit/billNumber', {
                params: { billNumber },
                withCredentials: true
            });

            if (response.data.success) {
                // Navigate to edit page with the sales bill ID
                navigate(`/retailer/credit-sales/edit/${response.data.data.salesBill._id}`);
            } else {
                setError(response.data.error || 'Sales voucher not found');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'An error occurred while fetching sales bill');
            console.error('Error fetching sales bill', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className='Container-fluid'>
            <Header />
            <div className="container centered-container">
                <div className="card shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
                    <h1 className="text-center mb-4">Enter Voucher Number</h1>
                    <form onSubmit={handleSubmit} className="needs-validation" noValidate>
                        <div className="form-group">
                            <label htmlFor="billNumber">Voucher Number:</label>
                            <input
                                type="text"
                                name="billNumber"
                                id="billNumber"
                                className={`form-control ${error ? 'is-invalid' : ''}`}
                                required
                                placeholder="Enter your voucher number"
                                aria-describedby="billHelp"
                                autoComplete="off"
                                autoFocus
                                value={billNumber}
                                onChange={(e) => setBillNumber(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        document.getElementById('findBill')?.focus();
                                    }
                                }}
                                disabled={isFetchingLatest} // Disable while loading
                            />
                            {isFetchingLatest && (
                                <div className="text-muted small">Loading latest voucher number...</div>
                            )}
                            <small id="billHelp" className="form-text text-muted">
                                Please enter a valid voucher number to find the sales invoice.
                            </small>
                            {error && (
                                <div className="invalid-feedback">
                                    {error}
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={isLoading || isFetchingLatest}
                            id="findBill"
                        >
                            {isLoading ? 'Searching...' : 'Find Voucher'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Product modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}
        </div>
    );
};

export default CreditSalesVoucherNumber;