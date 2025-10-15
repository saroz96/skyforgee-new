import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../../stylesheet/credential/Registration.css';

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password2: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    width: '0%',
    color: '#e74c3c'
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-focus name field on component mount
    document.getElementById('name')?.focus();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Special handling for password strength
    if (name === 'password') {
      calculatePasswordStrength(value);
    }
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;

    // Check password length
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;

    // Check for numbers
    if (/\d/.test(password)) strength += 1;

    // Check for special characters
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 1;

    // Check for uppercase and lowercase
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 1;

    // Update strength meter
    let width = 0;
    let color = '#e74c3c'; // Red

    if (strength === 0) {
      width = 0;
    } else if (strength <= 2) {
      width = 33;
      color = '#e74c3c'; // Red
    } else if (strength === 3) {
      width = 66;
      color = '#f39c12'; // Orange
    } else {
      width = 100;
      color = '#2ecc71'; // Green
    }

    setPasswordStrength({ width, color });
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Please enter your full name';
      isValid = false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    // Password validation
    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    }

    // Password match validation
    if (formData.password !== formData.password2) {
      newErrors.password2 = 'Passwords do not match';
      isValid = false;
    }

    // Terms validation
    if (!acceptedTerms) {
      newErrors.terms = 'You must agree to the terms';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Simulate loading progress
      const interval = setInterval(() => {
        setLoadingPercentage(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 100);

      const response = await axios.post('/api/auth/register', formData);

      clearInterval(interval);
      setLoading(false);
      setLoadingPercentage(0);

      if (response.data.success) {
        setMessage('Registration successful! Please check your email to verify your account.');
        setTimeout(() => {
          navigate('/auth/login');
        }, 3000);
      } else {
        setError(response.data.message || 'Registration failed');
      }
    } catch (err) {
      setLoading(false);
      setLoadingPercentage(0);
      setError(err.response?.data?.message || err.message || 'Registration failed');
    }
  };

  return (
  <div className="register-container d-flex justify-content-center align-items-center">
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10 col-xl-8"> {/* Increased column width */}
          <div className="card gradient-custom-3" style={{ maxWidth: '800px', margin: '0 auto' }}>
             <div className="card-body p-4 p-md-5"> 
              <h2 className="text-center mb-4">Create Your Account</h2>

              {loading && (
                <div className="loader">
                  <div className="spinner"></div>
                  <p className="loader-percentage-text">
                    Creating account... <span className="loader-percentage">{loadingPercentage}%</span>
                  </p>
                </div>
              )}

              {message && (
                <div className="alert alert-success alert-dismissible fade show animate__animated animate__fadeIn" role="alert">
                  {message}
                  <button type="button" className="btn-close" onClick={() => setMessage('')} aria-label="Close"></button>
                </div>
              )}

              {error && (
                <div className="alert alert-danger alert-dismissible fade show animate__animated animate__fadeIn" role="alert">
                  {error}
                  <button type="button" className="btn-close" onClick={() => setError('')} aria-label="Close"></button>
                </div>
              )}

              <form onSubmit={handleSubmit} id="registerForm" noValidate>
                <div className="form-outline">
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className={`form-control ${errors.name ? 'is-invalid' : formData.name ? 'is-valid' : ''}`}
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                  <label className="form-label" htmlFor="name">Full Name</label>
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>

                <div className="form-outline">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className={`form-control ${errors.email ? 'is-invalid' : formData.email ? 'is-valid' : ''}`}
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                  <label className="form-label" htmlFor="email">Email Address</label>
                  {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                </div>

                <div className="form-outline">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    className={`form-control ${errors.password ? 'is-invalid' : formData.password ? 'is-valid' : ''}`}
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <label className="form-label" htmlFor="password">Password</label>
                  <i
                    className={`bi ${showPassword ? 'bi-eye' : 'bi-eye-slash'} password-toggle`}
                    onClick={() => setShowPassword(!showPassword)}
                  />
                  {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                  <div className="password-strength">
                    <div className="strength-meter" style={{ width: passwordStrength.width, backgroundColor: passwordStrength.color }}></div>
                  </div>
                  <small className="form-text text-muted">At least 8 characters with numbers and symbols</small>
                </div>

                <div className="form-outline">
                  <input
                    type={showPassword2 ? 'text' : 'password'}
                    id="password2"
                    name="password2"
                    className={`form-control ${errors.password2 ? 'is-invalid' : formData.password2 ? 'is-valid' : ''}`}
                    value={formData.password2}
                    onChange={handleChange}
                    required
                  />
                  <label className="form-label" htmlFor="password2">Confirm Password</label>
                  <i
                    className={`bi ${showPassword2 ? 'bi-eye' : 'bi-eye-slash'} password-toggle`}
                    onClick={() => setShowPassword2(!showPassword2)}
                  />
                  {errors.password2 && <div className="invalid-feedback">{errors.password2}</div>}
                </div>

                <div className="form-check d-flex justify-content-start mb-4">
                  <input
                    className="form-check-input me-2"
                    type="checkbox"
                    id="termsCheck"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    required
                  />
                  <label className="form-check-label" htmlFor="termsCheck">
                    I agree to the <a href="#!" className="terms-link">Terms of Service</a> and <a href="#!" className="terms-link">Privacy Policy</a>
                  </label>
                </div>
                {errors.terms && <div className="invalid-feedback mb-3">{errors.terms}</div>}

                <div className="d-flex justify-content-center">
                  <button type="submit" className="btn btn-success btn-block btn-lg gradient-custom-4 text-white" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Creating account...
                      </>
                    ) : (
                      'Register Now'
                    )}
                  </button>
                </div>

                <p className="text-center mt-4 mb-0">
                  Already have an account? <Link to="/auth/login" className="login-link">Sign in here</Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default RegisterForm;