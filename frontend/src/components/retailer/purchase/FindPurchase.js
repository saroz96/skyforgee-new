import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../../stylesheet/retailer/purchase/FindPurchase.css'
import Header from '../../retailer/Header';

const FindPurchase = () => {
    const [billNumber, setBillNumber] = useState('');
    const [latestBillNumber, setLatestBillNumber] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    const [company, setCompany] = useState({
        dateFormat: 'english',
        vatEnabled: true,
        fiscalYear: {}
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/retailer/purchase/finds')

                if (response.data.success) {
                    setLatestBillNumber(response.data.data.latestBillNumber || '');
                } else {
                    setError(response.data.error || 'Failed to fetch initial data');
                }
                setCompany(response.data.company);

            } catch (err) {
                setError(err.response?.data?.error || 'An error occurred while fetching data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!billNumber.trim()) {
            setError('Please enter a voucher number');
            return;
        }
        navigate(`/api/retailer/purchase/edit/${billNumber}`);
    };

    if (isLoading) {
        return <div className="text-center mt-5">Loading...</div>;
    }

    if (error) {
        return <div className="alert alert-danger mt-5">{error}</div>;
    }

    return (
        <div className="container-fluid">
            <Header />
            <div className="container centered-container">
                <div className="card shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
                    <h1 className="text-center mb-4">Enter Voucher Number</h1>
                    <form onSubmit={handleSubmit} className="needs-validation" noValidate>
                        <div className="form-group">
                            <input
                                type="text"
                                name="billNumber"
                                id="billNumber"
                                className="form-control"
                                required
                                placeholder="Enter your voucher number"
                                aria-describedby="billHelp"
                                autoComplete="off"
                                autoFocus
                                value={billNumber}
                                onChange={(e) => setBillNumber(e.target.value)}
                            />
                            <small id="billHelp" className="form-text text-muted">
                                Please enter a valid voucher number to find the purchase invoice.
                            </small>
                            <div className="invalid-feedback">
                                Please enter a voucher number.
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary btn-block">
                            Find Voucher
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default FindPurchase;