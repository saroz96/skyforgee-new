import React, { useState, useEffect } from 'react';
import axios from 'axios';
import NotificationToast from '../../NotificationToast';
import Header from '../Header';

const VoucherConfiguration = () => {
    const [settings, setSettings] = useState({
        roundOffSales: false,
        roundOffPurchase: false,
        roundOffSalesReturn: false,
        roundOffPurchaseReturn: false,
        displayTransactions: false,
        displayTransactionsForSalesReturn: false,
        displayTransactionsForPurchase: false,
        displayTransactionsForPurchaseReturn: false,
        storeManagement: false
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState({});
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/api/retailer/roundoff-sales');
            setSettings(response.data.data.settings);
            setIsLoading(false);
        } catch (error) {
            console.error("Error fetching settings:", error);
            setNotification({
                show: true,
                message: 'Error fetching settings',
                type: 'error'
            });
            setIsLoading(false);
        }
    };

    const updateSetting = async (settingName, value) => {
        setIsSaving(prev => ({ ...prev, [settingName]: true }));
        
        try {
            // Determine the endpoint based on the setting name
            let endpoint = '';
            const payload = { [settingName]: value };
            
            switch(settingName) {
                case 'roundOffSales':
                    endpoint = '/api/retailer/roundoff-sales';
                    break;
                case 'roundOffSalesReturn':
                    endpoint = '/api/retailer/roundoff-sales-return';
                    break;
                case 'roundOffPurchase':
                    endpoint = '/api/retailer/roundoff-purchase';
                    break;
                case 'roundOffPurchaseReturn':
                    endpoint = '/api/retailer/roundoff-purchase-return';
                    break;
                case 'displayTransactions':
                    endpoint = '/api/retailer/updateDisplayTransactionsForSales';
                    break;
                case 'displayTransactionsForSalesReturn':
                    endpoint = '/api/retailer/updateDisplayTransactionsForSalesReturn';
                    break;
                case 'displayTransactionsForPurchase':
                    endpoint = '/api/retailer/PurchaseTransactionDisplayUpdate';
                    break;
                case 'displayTransactionsForPurchaseReturn':
                    endpoint = '/api/retailer/PurchaseReturnTransactionDisplayUpdate';
                    break;
                case 'storeManagement':
                    endpoint = '/api/retailer/storemanagement';
                    break;
                default:
                    console.error('Unknown setting:', settingName);
                    return;
            }
            
            const response = await api.post(endpoint, payload);
            
            if (response.data.success) {
                setSettings(prev => ({ ...prev, [settingName]: value }));
                setNotification({
                    show: true,
                    message: response.data.message || 'Setting updated successfully',
                    type: 'success'
                });
            }
        } catch (error) {
            console.error('Error updating setting:', error);
            setNotification({
                show: true,
                message: error.response?.data?.error || 'Error updating setting',
                type: 'error'
            });
        } finally {
            setIsSaving(prev => ({ ...prev, [settingName]: false }));
        }
    };

    const handleCheckboxChange = (settingName) => (e) => {
        const value = e.target.checked;
        updateSetting(settingName, value);
    };

    if (isLoading) {
        return (
            <div className="Container-fluid">
                <Header />
                <div className="container mt-4">
                    <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="Container-fluid">
            <Header />
            <div className="container settings-container mt-4">
                <div className="card settings-card">
                    <div className="card-body">
                        {/* Round-Off Settings Section */}
                        <div className="settings-section">
                            <h2><i className="fas fa-calculator me-2"></i> Round-Off Settings</h2>
                            <div className="row">
                                <div className="col-md-6 col-lg-3">
                                    <div className="setting-item">
                                        <div className="form-check d-flex align-items-center">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                id="roundOffSales"
                                                checked={settings.roundOffSales || false}
                                                onChange={handleCheckboxChange('roundOffSales')}
                                                disabled={isSaving.roundOffSales}
                                            />
                                            <label className="form-check-label" htmlFor="roundOffSales">
                                                Round Off Sales
                                            </label>
                                        </div>
                                        {isSaving.roundOffSales && (
                                            <div className="mt-2">
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Saving...
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="col-md-6 col-lg-3">
                                    <div className="setting-item">
                                        <div className="form-check d-flex align-items-center">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                id="roundOffSalesReturn"
                                                checked={settings.roundOffSalesReturn || false}
                                                onChange={handleCheckboxChange('roundOffSalesReturn')}
                                                disabled={isSaving.roundOffSalesReturn}
                                            />
                                            <label className="form-check-label" htmlFor="roundOffSalesReturn">
                                                Round Off Sales Rtn
                                            </label>
                                        </div>
                                        {isSaving.roundOffSalesReturn && (
                                            <div className="mt-2">
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Saving...
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="col-md-6 col-lg-3">
                                    <div className="setting-item">
                                        <div className="form-check d-flex align-items-center">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                id="roundOffPurchase"
                                                checked={settings.roundOffPurchase || false}
                                                onChange={handleCheckboxChange('roundOffPurchase')}
                                                disabled={isSaving.roundOffPurchase}
                                            />
                                            <label className="form-check-label" htmlFor="roundOffPurchase">
                                                Round Off Purchase
                                            </label>
                                        </div>
                                        {isSaving.roundOffPurchase && (
                                            <div className="mt-2">
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Saving...
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="col-md-6 col-lg-3">
                                    <div className="setting-item">
                                        <div className="form-check d-flex align-items-center">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                id="roundOffPurchaseReturn"
                                                checked={settings.roundOffPurchaseReturn || false}
                                                onChange={handleCheckboxChange('roundOffPurchaseReturn')}
                                                disabled={isSaving.roundOffPurchaseReturn}
                                            />
                                            <label className="form-check-label" htmlFor="roundOffPurchaseReturn">
                                                Round Off Purchase Rtn
                                            </label>
                                        </div>
                                        {isSaving.roundOffPurchaseReturn && (
                                            <div className="mt-2">
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Saving...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Display Settings Section */}
                        <div className="settings-section">
                            <h2><i className="fas fa-desktop me-2"></i> Display Settings</h2>
                            <div className="row">
                                <div className="col-md-6 col-lg-3">
                                    <div className="setting-item">
                                        <div className="form-check d-flex align-items-center">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="displayTransactions"
                                                checked={settings.displayTransactions || false}
                                                onChange={handleCheckboxChange('displayTransactions')}
                                                disabled={isSaving.displayTransactions}
                                            />
                                            <label className="form-check-label" htmlFor="displayTransactions">
                                                Show Trans. in Sales
                                            </label>
                                        </div>
                                        {isSaving.displayTransactions && (
                                            <div className="mt-2">
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Saving...
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="col-md-6 col-lg-3">
                                    <div className="setting-item">
                                        <div className="form-check d-flex align-items-center">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="displayTransactionsForSalesReturn"
                                                checked={settings.displayTransactionsForSalesReturn || false}
                                                onChange={handleCheckboxChange('displayTransactionsForSalesReturn')}
                                                disabled={isSaving.displayTransactionsForSalesReturn}
                                            />
                                            <label className="form-check-label" htmlFor="displayTransactionsForSalesReturn">
                                                Show Trans. in Sales Rtn
                                            </label>
                                        </div>
                                        {isSaving.displayTransactionsForSalesReturn && (
                                            <div className="mt-2">
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Saving...
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="col-md-6 col-lg-3">
                                    <div className="setting-item">
                                        <div className="form-check d-flex align-items-center">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="displayTransactionsForPurchase"
                                                checked={settings.displayTransactionsForPurchase || false}
                                                onChange={handleCheckboxChange('displayTransactionsForPurchase')}
                                                disabled={isSaving.displayTransactionsForPurchase}
                                            />
                                            <label className="form-check-label" htmlFor="displayTransactionsForPurchase">
                                                Show Trans. in Purchase
                                            </label>
                                        </div>
                                        {isSaving.displayTransactionsForPurchase && (
                                            <div className="mt-2">
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Saving...
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="col-md-6 col-lg-3">
                                    <div className="setting-item">
                                        <div className="form-check d-flex align-items-center">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="displayTransactionsForPurchaseReturn"
                                                checked={settings.displayTransactionsForPurchaseReturn || false}
                                                onChange={handleCheckboxChange('displayTransactionsForPurchaseReturn')}
                                                disabled={isSaving.displayTransactionsForPurchaseReturn}
                                            />
                                            <label className="form-check-label" htmlFor="displayTransactionsForPurchaseReturn">
                                                Show Trans. in Purc. Rtn
                                            </label>
                                        </div>
                                        {isSaving.displayTransactionsForPurchaseReturn && (
                                            <div className="mt-2">
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Saving...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Store Management Section */}
                        <div className="settings-section">
                            <h2><i className="fas fa-store me-2"></i> Store Management</h2>
                            <div className="col-md-6">
                                <div className="setting-item">
                                    <div className="form-check d-flex align-items-center">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="storeManagement"
                                            checked={settings.storeManagement || false}
                                            onChange={handleCheckboxChange('storeManagement')}
                                            disabled={isSaving.storeManagement}
                                        />
                                        <label className="form-check-label" htmlFor="storeManagement">
                                            Enable Store/Rack Management
                                        </label>
                                    </div>
                                    {isSaving.storeManagement && (
                                        <div className="mt-2">
                                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                            Saving...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />

            <style jsx>{`
                .settings-container {
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .settings-card {
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                    overflow: hidden;
                }

                .settings-section {
                    padding: 25px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .settings-section:last-child {
                    border-bottom: none;
                }

                .settings-section h2 {
                    color: #2c3e50;
                    margin-bottom: 25px;
                    font-size: 1.5rem;
                    font-weight: 600;
                }

                .setting-item {
                    margin-bottom: 20px;
                    padding: 15px;
                    background-color: #f8f9fa;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                }

                .setting-item:hover {
                    background-color: #f1f3f5;
                    transform: translateY(-2px);
                }

                .form-check-input {
                    width: 1.2em;
                    height: 1.2em;
                    margin-top: 0.1em;
                }

                .form-check-label {
                    margin-left: 8px;
                    font-size: 1rem;
                    font-weight: 500;
                    color: #495057;
                }

                @media (max-width: 768px) {
                    .setting-item {
                        margin-bottom: 15px;
                    }

                    .settings-section h2 {
                        font-size: 1.3rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default VoucherConfiguration;