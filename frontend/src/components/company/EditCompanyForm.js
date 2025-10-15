// components/company/EditCompanyForm.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Form, Button, Alert, Container, Card, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import NepaliDate from 'nepali-date';
import DashboardLayout from '../company/DashboardLayout';
import NotificationToast from '../NotificationToast';
import Loader from '../Loader';

const EditCompanyForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [user, setUser] = useState(null);
    const [isAdminOrSupervisor, setIsAdminOrSupervisor] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success' // or 'error'
    });
    const [dateErrors, setDateErrors] = useState({
        startDateNepali: '',
    });

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
        dateFormat: 'english',
        startDateEnglish: new Date().toISOString().split('T')[0],
        endDateEnglish: '',
        startDateNepali: '',
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

    // Updated data fetching in EditCompanyForm.js
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch user data first
                const userRes = await axios.get('/api/auth/me');
                const userData = userRes.data.user;
                setUser(userData);
                setIsAdminOrSupervisor(userData.isAdmin || userData.role === 'Supervisor');

                // Fetch company data with proper error handling
                const companyRes = await axios.get(`/api/company/edit/${id}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });

                if (!companyRes.data.success) {
                    throw new Error(companyRes.data.message || 'Failed to fetch company data');
                }

                const company = companyRes.data.company;

                // Format dates for the form
                const formattedCompany = {
                    name: company.name || '',
                    address: company.address || '',
                    country: company.country || 'Nepal',
                    state: company.state || '',
                    city: company.city || '',
                    pan: company.pan || '',
                    phone: company.phone || '',
                    ward: company.ward || '',
                    email: company.email || '',
                    tradeType: company.tradeType || '',
                    dateFormat: company.dateFormat || 'english',
                    startDateEnglish: company.startDateEnglish || new Date().toISOString().split('T')[0],
                    endDateEnglish: company.fiscalYear?.endDate ?
                        new Date(company.fiscalYear.endDate).toISOString().split('T')[0] : '',
                    startDateNepali: company.fiscalYearStartDate || '',
                    endDateNepali: company.endDateNepali || '',
                    vatEnabled: company.vatEnabled || false
                };

                setFormData(formattedCompany);
                setError('');
            } catch (err) {
                console.error('Fetch error:', err);
                setError(err.response?.data?.message || err.message || 'Failed to fetch data');
                // Optionally redirect if unauthorized
                if (err.response?.status === 403) {
                    navigate('/unauthorized');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, navigate]);

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
            const response = await axios.put(`/api/company/edit/${id}`, {
                ...formData,
                vatEnabled: formData.vatEnabled ? 'on' : false
            });

            if (response.data) {
                setNotification({
                    show: true,
                    message: 'Company details updated successfully!',
                    type: 'success'
                });

                // Determine redirect path based on tradeType
                let redirectPath;
                switch (formData.tradeType) {
                    case 'retailer':
                    case 'Retailer':
                        redirectPath = `/company/${id}`;
                        break;
                    case 'Pharmacy':
                        redirectPath = '/pharmacyDashboard';
                        break;
                    default:
                        redirectPath = '/dashboard';
                        break;
                }

                setTimeout(() => navigate(redirectPath), 2000);
            }
        } catch (err) {
            console.error('Update error:', err);
            setNotification({
                show: true,
                message: err.response?.data?.error || 'Error updating company. Please try again.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loader />;

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
                            Edit Company Information
                        </h2>
                    </Card.Header>
                    <Card.Body>
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
                                            {formData.endDateEnglish && (
                                                <Form.Text className="text-muted">
                                                    Fiscal year end date: {formData.endDateEnglish}
                                                </Form.Text>
                                            )}
                                        </>
                                    )}

                                    {formData.dateFormat === 'nepali' && (
                                        <>
                                            <Form.Label>Fiscal Year Start Date (Nepali)</Form.Label>
                                            <div className="mb-3">
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
                                    {loading ? (
                                        <>
                                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                                            <span className="ms-2">Updating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-save me-2"></i>
                                            Update Company
                                        </>
                                    )}
                                </Button>
                            </div>
                        </Form>
                    </Card.Body>
                </Card>
            </Container>
        </DashboardLayout>
    );
};

export default EditCompanyForm;