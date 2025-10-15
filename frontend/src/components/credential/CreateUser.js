import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { FaUserPlus, FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import Header from '../retailer/Header';
import NotificationToast from '../NotificationToast';

const CreateUser = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        password2: '',
        role: 'User'
    });
    const [passwordStrength, setPasswordStrength] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        strength: 0
    });
    const [showPassword, setShowPassword] = useState({
        password: false,
        password2: false
    });
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emailError, setEmailError] = useState('');

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear email error when typing
        if (name === 'email' && emailError) {
            setEmailError('');
        }

        // Check password strength when password changes
        if (name === 'password') {
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
        if (formData.password !== formData.password2) {
            setNotification({
                show: true,
                message: 'Passwords do not match',
                type: 'error'
            });
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await api.post('/api/auth/admin/create-user/new', formData);
            
            if (response.data.success) {
                setNotification({
                    show: true,
                    message: response.data.message || 'User created successfully',
                    type: 'success'
                });
                // Reset form on success
                setFormData({
                    name: '',
                    email: '',
                    password: '',
                    password2: '',
                    role: 'User'
                });
            }
        } catch (err) {
            let errorMessage = 'An error occurred while creating the user';
            
            if (err.response) {
                // Handle specific error cases
                if (err.response.status === 409) {
                    errorMessage = 'User with this email already exists';
                    setEmailError('This email is already registered');
                } else if (err.response.data?.error) {
                    errorMessage = err.response.data.error;
                } else if (err.response.data?.message) {
                    errorMessage = err.response.data.message;
                }
            } else if (err.request) {
                errorMessage = 'No response from server. Please check your network connection.';
            }

            setNotification({
                show: true,
                message: errorMessage,
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
            <div className="container user-container mt-4">
                <div className="card user-card animate__animated animate__fadeInUp">
                    <div className="card-header text-center">
                        <h2 className="card-title">
                            <FaUserPlus className="me-2" />
                            Create a New User
                        </h2>
                    </div>
                    <div className="card-body p-4">
                        <form onSubmit={handleSubmit}>
                            {/* Name */}
                            <div className="mb-4">
                                <label htmlFor="name" className="form-label">Full Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Email */}
                            <div className="mb-4">
                                <label htmlFor="email" className="form-label">Email Address</label>
                                <input
                                    type="email"
                                    className={`form-control ${emailError ? 'is-invalid' : ''}`}
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                    autoComplete="off"
                                />
                                {emailError && (
                                    <div className="invalid-feedback d-block">
                                        {emailError}
                                    </div>
                                )}
                            </div>

                            {/* Password */}
                            <div className="mb-3">
                                <label htmlFor="password" className="form-label">Password</label>
                                <div className="input-group">
                                    <input
                                        type={showPassword.password ? "text" : "password"}
                                        className="form-control"
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        required
                                        pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
                                        title="Must contain at least 8 characters, including uppercase, lowercase and numbers"
                                        autoComplete="off"
                                    />
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={() => togglePasswordVisibility('password')}
                                    >
                                        {showPassword.password ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
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
                                <div className="password-requirements mt-2">
                                    <div className={`requirement ${passwordStrength.length ? 'valid' : 'invalid'}`}>
                                        <i className={`fas ${passwordStrength.length ? 'fa-check-circle' : 'fa-circle'} me-2`}></i>
                                        <span>At least 8 characters</span>
                                    </div>
                                    <div className={`requirement ${passwordStrength.uppercase ? 'valid' : 'invalid'}`}>
                                        <i className={`fas ${passwordStrength.uppercase ? 'fa-check-circle' : 'fa-circle'} me-2`}></i>
                                        <span>At least 1 uppercase letter</span>
                                    </div>
                                    <div className={`requirement ${passwordStrength.lowercase ? 'valid' : 'invalid'}`}>
                                        <i className={`fas ${passwordStrength.lowercase ? 'fa-check-circle' : 'fa-circle'} me-2`}></i>
                                        <span>At least 1 lowercase letter</span>
                                    </div>
                                    <div className={`requirement ${passwordStrength.number ? 'valid' : 'invalid'}`}>
                                        <i className={`fas ${passwordStrength.number ? 'fa-check-circle' : 'fa-circle'} me-2`}></i>
                                        <span>At least 1 number</span>
                                    </div>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="mb-4">
                                <label htmlFor="password2" className="form-label">Confirm Password</label>
                                <div className="input-group">
                                    <input
                                        type={showPassword.password2 ? "text" : "password"}
                                        className={`form-control ${formData.password2 && formData.password !== formData.password2 ? 'is-invalid' : ''}`}
                                        id="password2"
                                        name="password2"
                                        value={formData.password2}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={() => togglePasswordVisibility('password2')}
                                    >
                                        {showPassword.password2 ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                                {formData.password2 && formData.password !== formData.password2 && (
                                    <div className="invalid-feedback d-block">
                                        Passwords do not match
                                    </div>
                                )}
                            </div>

                            {/* Role */}
                            <div className="mb-4">
                                <label htmlFor="role" className="form-label">User Role</label>
                                <select
                                    className="form-select"
                                    id="role"
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="User">User</option>
                                    <option value="Sales">Sales Department</option>
                                    <option value="Purchase">Purchase Department</option>
                                    <option value="Account">Account Department</option>
                                    <option value="Supervisor">Supervisor</option>
                                    <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                                </select>
                            </div>

                            <div className="d-flex justify-content-between">
                                <Link to="/auth/admin/users/list" className="btn btn-secondary">
                                    <FaArrowLeft className="me-2" />
                                    Back to User List
                                </Link>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isSubmitting || passwordStrength.strength < 4 || formData.password !== formData.password2 || emailError}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <FaUserPlus className="me-2" />
                                            Create User
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

export default CreateUser;