import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../Header';

const ReceiptVoucherForm = () => {
    const [billNumber, setBillNumber] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingLatest, setIsFetchingLatest] = useState(true);
    const navigate = useNavigate();

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Fetch the latest receipt number when component mounts
    useEffect(() => {
        const fetchLatestReceiptNumber = async () => {
            try {
                const response = await api.get('/api/retailer/receipts/finds', {
                    withCredentials: true
                });

                if (response.data.success) {
                    setBillNumber(response.data.data.billNumber || '');
                }
            } catch (err) {
                console.error('Error fetching latest receipt number:', err);
                // Proceed with empty field if there's an error
            } finally {
                setIsFetchingLatest(false);
            }
        };

        fetchLatestReceiptNumber();
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
            const response = await api.get('/api/retailer/receipts/edit/billNumber', {
                params: { billNumber },
                withCredentials: true
            });

            if (response.data.success) {
                navigate(`/retailer/receipts/${response.data.data.receipt._id}`);
            } else {
                setError(response.data.error || 'Receipt not found');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'An error occurred while fetching receipt');
            console.error('Error fetching receipt:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
       <div className='Container-fluid'>
            <Header />
            <div className="container mt-5 wow-form centered-container">
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
                                        document.getElementById('findReceipt')?.focus();
                                    }
                                }}
                                disabled={isFetchingLatest}
                            />
                            {isFetchingLatest && (
                                <div className="text-muted small">Loading latest voucher number...</div>
                            )}
                            <small id="billHelp" className="form-text text-muted">
                                Please enter a valid voucher number to find the receipt.
                            </small>
                            {error && (
                                <div className="invalid-feedback d-block">
                                    {error}
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={isLoading || isFetchingLatest}
                            id="findReceipt"
                        >
                            {isLoading ? 'Searching...' : 'Find Receipt'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ReceiptVoucherForm;