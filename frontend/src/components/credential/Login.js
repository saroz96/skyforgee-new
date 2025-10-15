import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { useAuth } from '../../context/AuthContext';
import '../../stylesheet/credential/Login.css';
import { FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import NotificationToast from '../NotificationToast';

const LoginForm = () => {
    const { login } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [modalType, setModalType] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingPercentage, setLoadingPercentage] = useState(0);
    const [messages, setMessages] = useState('');
    const [error, setError] = useState('');
    const [isButtonClicked, setIsButtonClicked] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const msg = urlParams.get('message');
        const err = urlParams.get('error');

        if (msg) {
            setModalMessage(msg);
            setModalType('success');
            setShowModal(true);
        }
        if (err) {
            setModalMessage(err);
            setModalType('error');
            setShowModal(true);
        }
    }, []);

    useEffect(() => {
        if (loading) {
            const interval = setInterval(() => {
                setLoadingPercentage(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        return 100;
                    }
                    return prev + 10;
                });
            }, 100);

            return () => clearInterval(interval);
        }
    }, [loading]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isButtonClicked) return;

        setLoading(true);
        setLoadingPercentage(0);

        try {
            const response = await login({ email, password });

            setModalMessage('Login successful! Redirecting...');
            setModalType('success');
            setShowModal(true);

            setTimeout(() => {
                setShowModal(false);
                navigate('/dashboard');
            }, 3000);

        } catch (error) {
            setLoading(false);
            setModalMessage(error === 'Invalid email or password'
                ? 'Invalid email or password. Please try again.'
                : error);
            setModalType('error');
            setShowModal(true);
        }
    };

    const handleSocialLogin = (provider) => {
        setLoading(true);
        console.log(`Logging in with ${provider}`);
    };

    const moveToNextInput = (e, currentIndex) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = e.target.form;
            if (form.elements[currentIndex + 1]) {
                form.elements[currentIndex + 1].focus();
            }
        }
    };

    return (
        <div className="login-container">
            <NotificationToast 
                message={modalMessage}
                type={modalType}
                show={showModal}
                onClose={() => setShowModal(false)}
            />

            <section className="login-section">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-xl-6 col-lg-8 col-md-10">
                            <div className="login-card">
                                <div className="login-header text-center mb-5">
                                    <img
                                        src="/logo/logo.jpg"
                                        alt="Company Logo"
                                        className="login-logo"
                                    />
                                    <h1 className="login-title">Welcome</h1>
                                    <p className="login-subtitle">Sign in to access your account</p>
                                </div>

                                <div className="login-body">
                                    <form onSubmit={handleSubmit} id="login-form">
                                        <div className="form-group mb-4">
                                            <label htmlFor="email" className="form-label">Email Address</label>
                                            <input
                                                type="email"
                                                id="email"
                                                name="email"
                                                className="form-control form-control-lg"
                                                placeholder="Enter your email address"
                                                autoComplete="email"
                                                autoFocus
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                onKeyDown={(e) => moveToNextInput(e, 0)}
                                            />
                                        </div>

                                        <div className="form-group mb-4">
                                            <label htmlFor="password" className="form-label">Password</label>
                                            <div className="input-group">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    id="password"
                                                    name="password"
                                                    className="form-control form-control-lg"
                                                    placeholder="Enter your password"
                                                    autoComplete="current-password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    onKeyDown={(e) => moveToNextInput(e, 2)}
                                                />
                                                <button
                                                    className="btn btn-outline-secondary"
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="d-flex justify-content-between align-items-center mb-4">
                                            <Link to="/auth/verify-email">Verify Email</Link>
                                            <Link to="/auth/forgot-password" className="forgot-password">
                                                Forgot password?
                                            </Link>
                                        </div>

                                        <button
                                            type="submit"
                                            className="btn btn-primary btn-lg w-100 mb-3"
                                            id="login-btn"
                                            onClick={() => setIsButtonClicked(true)}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                    Signing in...
                                                </>
                                            ) : (
                                                'Sign In'
                                            )}
                                        </button>

                                        <div className="text-center mt-4">
                                            <p className="register-text">
                                                Don't have an account?{' '}
                                                <Link to="/auth/register" className="register-link">
                                                    Register here
                                                </Link>
                                            </p>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default LoginForm;