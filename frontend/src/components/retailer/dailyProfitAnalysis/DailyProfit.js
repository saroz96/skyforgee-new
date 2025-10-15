import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../Header';

const DailyProfit = () => {
    const [formData, setFormData] = useState({
        fromDate: '',
        toDate: ''
    });
    const [companyData, setCompanyData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
        const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/retailer/daily-profit/sales-analysis');
                if (response.data.success) {
                    const data = response.data.data;
                    setCompanyData(data);
                    
                    // Set default dates
                    setFormData({
                        fromDate: data.fromDate || data.startDate,
                        toDate: data.toDate || data.endDate || new Date().toISOString().split('T')[0]
                    });
                } else {
                    setError(response.data.error);
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to fetch initial data');
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        
        try {
            const response = await api.post('/api/retailer/daily-profit/sales-analysis', formData);
            if (response.data.success) {
                // Handle the results - you might want to pass this to a parent component
                // or display it in a results component
                console.log('Analysis results:', response.data.data);
                // You can redirect to a results page or show results in a modal/separate section
                window.location.href = `/retailer/daily-profit/sales-analysis/results?fromDate=${formData.fromDate}&toDate=${formData.toDate}`;
            } else {
                setError(response.data.error);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate profit analysis');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="content-wrapper">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-md-8 col-lg-6">
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <p className="mt-3">Loading profit analysis form...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="content-wrapper">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-md-8 col-lg-6">
                            <div className="alert alert-danger mt-4" role="alert">
                                <i className="fas fa-exclamation-triangle me-2"></i>
                                {error}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="content-wrapper">
            <Header/>
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-md-8 col-lg-6">
                        <div className="card shadow-lg mt-4 animate__animated animate__fadeInUp">
                            <div className="card-header bg-primary text-white text-center">
                                <h3 className="mb-0">
                                    <i className="fas fa-chart-line me-2"></i> Daily Profit/Sales Analysis
                                </h3>
                            </div>
                            <div className="card-body">
                                <section className="content-header text-center mb-4">
                                    <h4>Select Date Range</h4>
                                </section>

                                <form onSubmit={handleSubmit}>
                                    <div className="row justify-content-center">
                                        <div className="col-md-5 mb-3">
                                            <div className="form-group text-center">
                                                <label htmlFor="fromDate" className="form-label">From Date</label>
                                                <div className="input-group">
                                                    <span className="input-group-text">
                                                        <i className="fas fa-calendar-alt"></i>
                                                    </span>
                                                    <input
                                                        type="date"
                                                        name="fromDate"
                                                        id="fromDate"
                                                        className="form-control text-center"
                                                        value={formData.fromDate}
                                                        onChange={handleChange}
                                                        autoFocus
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-5 mb-3">
                                            <div className="form-group text-center">
                                                <label htmlFor="toDate" className="form-label">To Date</label>
                                                <div className="input-group">
                                                    <span className="input-group-text">
                                                        <i className="fas fa-calendar-alt"></i>
                                                    </span>
                                                    <input
                                                        type="date"
                                                        name="toDate"
                                                        id="toDate"
                                                        className="form-control text-center"
                                                        value={formData.toDate}
                                                        onChange={handleChange}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-group text-center mt-4">
                                        <button 
                                            type="submit" 
                                            className="btn btn-primary btn-lg px-4"
                                            disabled={submitting}
                                        >
                                            {submitting ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-eye me-2"></i> View Report
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyProfit;