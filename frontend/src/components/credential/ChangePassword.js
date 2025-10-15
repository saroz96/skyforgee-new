import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NotificationToast from '../NotificationToast';
import Header from '../retailer/Header';

const ChangePassword = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
    });
    const [passwordStrength, setPasswordStrength] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        strength: 0
    });
    const [showPassword, setShowPassword] = useState({
        currentPassword: false,
        newPassword: false,
        confirmNewPassword: false
    });
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Check password strength when new password changes
        if (name === 'newPassword') {
            checkPasswordStrength(value);
        }
    };

    const checkPasswordStrength = (password) => {
        const strength = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password)
        };

        const strengthScore = Object.values(strength).filter(Boolean).length;

        setPasswordStrength({
            ...strength,
            strength: strengthScore
        });
    };

    const togglePasswordVisibility = (field) => {
        setShowPassword(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Validate passwords match
        if (formData.newPassword !== formData.confirmNewPassword) {
            setNotification({
                show: true,
                message: 'New passwords do not match',
                type: 'error'
            });
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await api.post('/api/auth/user/change-password', formData);
            
            if (response.data.success) {
                setNotification({
                    show: true,
                    message: response.data.message || 'Password updated successfully',
                    type: 'success'
                });
                // Reset form on success
                setFormData({
                    currentPassword: '',
                    newPassword: '',
                    confirmNewPassword: ''
                });
            } else {
                setNotification({
                    show: true,
                    message: response.data.error || 'Failed to update password',
                    type: 'error'
                });
            }
        } catch (err) {
            setNotification({
                show: true,
                message: err.response?.data?.error || 'An error occurred while changing the password',
                type: 'error'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStrengthColor = () => {
        switch (passwordStrength.strength) {
            case 0: return 'bg-danger';
            case 1: return 'bg-danger';
            case 2: return 'bg-warning';
            case 3: return 'bg-info';
            case 4: return 'bg-success';
            default: return 'bg-danger';
        }
    };

    return (
        <div className='Container-fluid'>
            <Header />
            <div className="container mt-4">
                <div className="card shadow-lg p-4" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div className="card-header text-center bg-light">
                        <h4 className="mb-0">
                            <i className="fas fa-key me-2"></i>Change Your Password
                        </h4>
                    </div>
                    <div className="card-body p-4">
                        <form onSubmit={handleSubmit}>
                            {/* Current Password */}
                            <div className="mb-4">
                                <label htmlFor="currentPassword" className="form-label">Current Password</label>
                                <div className="input-group">
                                    <input
                                        type={showPassword.currentPassword ? "text" : "password"}
                                        className="form-control"
                                        id="currentPassword"
                                        name="currentPassword"
                                        value={formData.currentPassword}
                                        onChange={handleInputChange}
                                        required
                                        autoFocus
                                    />
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={() => togglePasswordVisibility('currentPassword')}
                                    >
                                        <i className={`fas ${showPassword.currentPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                            </div>
                            
                            {/* New Password */}
                            <div className="mb-3">
                                <label htmlFor="newPassword" className="form-label">New Password</label>
                                <div className="input-group">
                                    <input
                                        type={showPassword.newPassword ? "text" : "password"}
                                        className="form-control"
                                        id="newPassword"
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleInputChange}
                                        required
                                        pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
                                        title="Must contain at least 8 characters, including uppercase, lowercase and numbers"
                                    />
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={() => togglePasswordVisibility('newPassword')}
                                    >
                                        <i className={`fas ${showPassword.newPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                                
                                {/* Password Strength Meter */}
                                <div className="progress mt-2" style={{ height: '5px' }}>
                                    <div
                                        className={`progress-bar ${getStrengthColor()}`}
                                        role="progressbar"
                                        style={{ width: `${passwordStrength.strength * 25}%` }}
                                        aria-valuenow={passwordStrength.strength * 25}
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                    ></div>
                                </div>
                                
                                {/* Password Requirements */}
                                <div className="mt-2 small text-muted">
                                    <div className={`d-flex align-items-center ${passwordStrength.length ? 'text-success' : 'text-danger'}`}>
                                        <i className={`fas ${passwordStrength.length ? 'fa-check-circle' : 'fa-circle'} me-2`}></i>
                                        <span>At least 8 characters</span>
                                    </div>
                                    <div className={`d-flex align-items-center ${passwordStrength.uppercase ? 'text-success' : 'text-danger'}`}>
                                        <i className={`fas ${passwordStrength.uppercase ? 'fa-check-circle' : 'fa-circle'} me-2`}></i>
                                        <span>At least 1 uppercase letter</span>
                                    </div>
                                    <div className={`d-flex align-items-center ${passwordStrength.lowercase ? 'text-success' : 'text-danger'}`}>
                                        <i className={`fas ${passwordStrength.lowercase ? 'fa-check-circle' : 'fa-circle'} me-2`}></i>
                                        <span>At least 1 lowercase letter</span>
                                    </div>
                                    <div className={`d-flex align-items-center ${passwordStrength.number ? 'text-success' : 'text-danger'}`}>
                                        <i className={`fas ${passwordStrength.number ? 'fa-check-circle' : 'fa-circle'} me-2`}></i>
                                        <span>At least 1 number</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Confirm New Password */}
                            <div className="mb-4">
                                <label htmlFor="confirmNewPassword" className="form-label">Confirm New Password</label>
                                <div className="input-group">
                                    <input
                                        type={showPassword.confirmNewPassword ? "text" : "password"}
                                        className={`form-control ${formData.newPassword && formData.confirmNewPassword && formData.newPassword !== formData.confirmNewPassword ? 'is-invalid' : ''}`}
                                        id="confirmNewPassword"
                                        name="confirmNewPassword"
                                        value={formData.confirmNewPassword}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={() => togglePasswordVisibility('confirmNewPassword')}
                                    >
                                        <i className={`fas ${showPassword.confirmNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                                {formData.newPassword && formData.confirmNewPassword && formData.newPassword !== formData.confirmNewPassword && (
                                    <div className="invalid-feedback d-block">
                                        Passwords do not match
                                    </div>
                                )}
                            </div>
                            
                            <div className="d-grid">
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg"
                                    disabled={isSubmitting || passwordStrength.strength < 4 || formData.newPassword !== formData.confirmNewPassword}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-save me-2"></i>Update Password
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
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

export default ChangePassword;