// components/company/CompanyForm.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Form, Button, Alert, Container, Card, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import PropTypes from 'prop-types';
import '../../stylesheet/company/CompanyForm.css'
import DashboardLayout from '../company/DashboardLayout';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';

import NotificationToast from '../NotificationToast';

const CompanyForm = () => {
    // console.log('Received user in CompanyForm:', user);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    // const [nepaliDate, setNepaliDate] = useState(''); // Format: "YYYY/MM/DD"
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [user, setUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const [isAdminOrSupervisor, setIsAdminOrSupervisor] = useState(false);
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success' // or 'error'
    });
    const [dateErrors, setDateErrors] = useState({
        startDateNepali: '',
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch user data - response contains { user: { ... } }
                const userRes = await axios.get('/api/auth/me');
                const userData = userRes.data.user; // Access the nested user object
                setUser(userData);
                setIsAdminOrSupervisor(userData.isAdmin || userData.role === 'Supervisor');

                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to fetch data');
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    CompanyForm.propTypes = {
        user: PropTypes.shape({
            _id: PropTypes.string.isRequired,
            // Add other expected user properties here
        }).isRequired
    };

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        country: 'Nepal',
        state: '',
        city: '',
        pan: '',
        phone: '',
        ward: '',
        email: '',
        tradeType: '',
        dateFormat: '',
        startDateEnglish: new Date().toISOString().split('T')[0],
        endDateEnglish: '',
        startDateNepali: currentNepaliDate,
        endDateNepali: '',
        vatEnabled: false
    });

    // Trade type options
    const tradeTypeOptions = [
        { value: 'retailer', label: 'Retailer' },
    ];

    // Date format options
    const dateFormatOptions = [
        { value: 'nepali', label: 'Nepali Date' },
        { value: 'english', label: 'English Date' }
    ];

    // Handle form input changes
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Handle select changes
    const handleSelectChange = (name, selectedOption) => {
        setFormData(prev => ({
            ...prev,
            [name]: selectedOption.value
        }));
    };

    // Calculate end date when start date changes
    useEffect(() => {
        if (formData.dateFormat === 'english' && formData.startDateEnglish) {
            const startDate = new Date(formData.startDateEnglish);
            const endDate = new Date(startDate);
            endDate.setFullYear(endDate.getFullYear() + 1);
            endDate.setDate(endDate.getDate() - 1);

            setFormData(prev => ({
                ...prev,
                endDateEnglish: endDate.toISOString().split('T')[0]
            }));
        }
    }, [formData.startDateEnglish, formData.dateFormat]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post('/api/company/new', {
                ...formData,
                owner: user._id,
                vatEnabled: Boolean(formData.vatEnabled) // Ensure boolean
            });

            if (response.data.success) {
                // Handle both full success and partial success cases
                // const successMsg = response.data.warning
                //     ? `Company created! (Note: ${response.data.warning})`
                //     : 'Company created successfully!';
                setNotification({
                    show: true,
                    message: 'Company created successfully!',
                    type: 'success'
                });
                // setSuccess(successMsg);
                setShowModal(true);
                setTimeout(() => navigate('/dashboard'), 2000);
            } else {
                setError(response.data.error || 'Failed to create company');
                setShowModal(true);
            }
        } catch (err) {
            console.error('Full error:', err);
            // setError(err.response?.data?.error || 'Error creating company. Please try again.');
            setNotification({
                show: true,
                message: 'Error creating company. Please try again.',
                type: 'error'
            });
            setShowModal(true);
        } finally {
            setLoading(false);
        }
    };
    return (
        <DashboardLayout user={user} isAdminOrSupervisor={isAdminOrSupervisor}>
            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />
            <Container className="company-form-container">
                <Card className="company-form-card">
                    <Card.Header className="company-form-header">
                        <h2 className="company-form-title">
                            <i className="fas fa-building me-2"></i>
                            Create New Company
                        </h2>
                    </Card.Header>
                    <Card.Body>
                        {/* Loading Overlay */}
                        {loading && (
                            <div className="text-center py-4">
                                <Spinner animation="border" role="status" variant="primary" />
                                <p className="mt-2">Creating company...</p>
                            </div>
                        )}

                        <Form onSubmit={handleSubmit}>
                            <div className="row g-3 mb-4">
                                {/* Company Name */}
                                <div className="col-md-6">
                                    <Form.Label>Company Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                {/* Country */}
                                <div className="col-md-6">
                                    <Form.Label>Country</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="country"
                                        value={formData.country}
                                        onChange={handleChange}
                                        required
                                        readOnly
                                    />
                                </div>
                            </div>

                            <div className="row g-3 mb-4">
                                {/* State */}
                                <div className="col-md-6">
                                    <Form.Label>State/Province</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="state"
                                        value={formData.state}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                {/* City */}
                                <div className="col-md-6">
                                    <Form.Label>City</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="row g-3 mb-4">
                                {/* Address */}
                                <div className="col-md-6">
                                    <Form.Label>Address</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                {/* PAN */}
                                <div className="col-md-6">
                                    <Form.Label>PAN Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="pan"
                                        value={formData.pan}
                                        onChange={handleChange}
                                        minLength="9"
                                        maxLength="9"
                                        placeholder="Enter 9-digit PAN number"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="row g-3 mb-4">
                                {/* Phone */}
                                <div className="col-md-6">
                                    <Form.Label>Phone Number</Form.Label>
                                    <Form.Control
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        pattern="^\+?[0-9]{1,4}[- ]?[0-9]{7,10}$"
                                        placeholder="+977-9801234567 or 9801234567"
                                        required
                                    />
                                </div>

                                {/* Ward */}
                                <div className="col-md-6">
                                    <Form.Label>Ward Number</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="ward"
                                        value={formData.ward}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="row g-3 mb-4">
                                {/* Email */}
                                <div className="col-md-6">
                                    <Form.Label>Company Email</Form.Label>
                                    <Form.Control
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                {/* Trade Type */}
                                <div className="col-md-6">
                                    <Form.Label>Business Type</Form.Label>
                                    <Select
                                        options={tradeTypeOptions}
                                        onChange={(selected) => handleSelectChange('tradeType', selected)}
                                        value={tradeTypeOptions.find(option => option.value === formData.tradeType)}
                                        placeholder="Select business type"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="row g-3 mb-4">
                                {/* Date Format */}
                                <div className="col-md-6">
                                    <Form.Label>Date Format</Form.Label>
                                    <Select
                                        options={dateFormatOptions}
                                        onChange={(selected) => handleSelectChange('dateFormat', selected)}
                                        value={dateFormatOptions.find(option => option.value === formData.dateFormat)}
                                        placeholder="Select date format"
                                        required
                                    />
                                </div>

                                {/* Fiscal Year Start Date (dynamic based on date format) */}
                                <div className="col-md-6">
                                    {formData.dateFormat === 'english' && (
                                        <>
                                            <Form.Label>Fiscal Year Start Date (English)</Form.Label>
                                            <Form.Control
                                                type="date"
                                                name="startDateEnglish"
                                                value={formData.startDateEnglish}
                                                onChange={handleChange}
                                                required
                                            />
                                        </>
                                    )}

                                    {formData.dateFormat === 'nepali' && (
                                        <>
                                            <Form.Label>Fiscal Year Start Date (Nepali)</Form.Label>
                                            <div className="mb-3"> {/* Added margin-bottom for spacing */}
                                                <input
                                                    type="date"
                                                    autoComplete='off'
                                                    className={`form-control ${dateErrors.startDateNepali ? 'is-invalid' : ''}`}
                                                    value={formData.startDateNepali ?
                                                        new Date(formData.startDateNepali).toISOString().split('T')[0] :
                                                        ''}
                                                    onChange={(e) => {
                                                        setFormData({ ...formData, startDateNepali: e.target.value });
                                                        setDateErrors(prev => ({ ...prev, startDateNepali: '' }));
                                                    }}
                                                    onBlur={(e) => {
                                                        try {
                                                            const dateStr = e.target.value;
                                                            if (!dateStr) {
                                                                setDateErrors(prev => ({ ...prev, startDateNepali: 'Date is required' }));
                                                                return;
                                                            }
                                                            if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
                                                                return;
                                                            }
                                                            const [year, month, day] = dateStr.split('/').map(Number);
                                                            if (month < 1 || month > 12) throw new Error("Month must be between 1-12");
                                                            if (day < 1 || day > 33) throw new Error("Day must be between 1-32");
                                                            const nepaliDate = new NepaliDate(year, month - 1, day);

                                                            setFormData({
                                                                ...formData,
                                                                startDateNepali: nepaliDate.format('MM/DD/YYYY')
                                                            });
                                                            setDateErrors(prev => ({ ...prev, startDateNepali: '' }));
                                                        } catch (error) {
                                                            setDateErrors(prev => ({
                                                                ...prev,
                                                                startDateNepali: error.message || 'Invalid Nepali date'
                                                            }));
                                                        }
                                                    }}
                                                    required
                                                />
                                                {formData.startDateNepali && (
                                                    <Form.Text className="text-muted">
                                                        Selected: {formData.startDateNepali}
                                                    </Form.Text>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* VAT Enabled Toggle */}
                            <div className="row g-3 mb-4">
                                <div className="col-md-6">
                                    <Form.Check
                                        type="switch"
                                        id="vatEnabled"
                                        label="Enable VAT"
                                        name="vatEnabled"
                                        checked={formData.vatEnabled}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="d-grid gap-2 mt-4">
                                <Button variant="primary" type="submit" size="lg" disabled={loading}>
                                    <i className="fas fa-save me-2"></i>
                                    Create Company
                                </Button>
                            </div>
                        </Form>
                    </Card.Body>
                </Card>
            </Container>
        </DashboardLayout>
    );
};

export default CompanyForm;