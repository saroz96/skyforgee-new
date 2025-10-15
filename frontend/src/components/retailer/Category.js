import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPrinter, FiArrowLeft, FiX, FiCheck, FiPlus } from 'react-icons/fi';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import Header from '../retailer/Header';
import NotificationToast from '../NotificationToast';
import ProductModal from './dashboard/modals/ProductModal';

const Categories = () => {
    const navigate = useNavigate();
    const [data, setData] = useState({
        categories: [],
        company: null,
        currentFiscalYear: null,
        companyId: '',
        currentCompanyName: '',
        user: null,
        theme: 'light',
        isAdminOrSupervisor: false
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentCategory, setCurrentCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState('');

    const [showProductModal, setShowProductModal] = useState(false);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    const showNotificationMessage = (message, type) => {
        setNotificationMessage(message);
        setNotificationType(type);
        setShowNotification(true);
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/retailer/categories');

            if (response.data.redirectTo) {
                navigate(response.data.redirectTo);
                return;
            }

            if (response.data.success) {
                setData({
                    categories: response.data.data.categories,
                    company: response.data.data.company,
                    currentFiscalYear: response.data.data.currentFiscalYear,
                    companyId: response.data.data.companyId,
                    currentCompanyName: response.data.data.currentCompanyName,
                    user: response.data.data.user,
                    theme: response.data.data.theme,
                    isAdminOrSupervisor: response.data.data.isAdminOrSupervisor
                });
            } else {
                throw new Error(response.data.error || 'Failed to fetch categories');
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Add F9 key handler here
        const handF9leKeyDown = (e) => {
            if (e.key === 'F9') {
                e.preventDefault();
                setShowProductModal(prev => !prev); // Toggle modal visibility
            }
        };
        window.addEventListener('keydown', handF9leKeyDown);
        return () => {
            window.removeEventListener('keydown', handF9leKeyDown);
        };
    }, []);

    const handleApiError = (error) => {
        let errorMessage = 'An error occurred';

        if (error.response) {
            switch (error.response.status) {
                case 400:
                    if (error.response.data.error === 'No fiscal year found in session or company.') {
                        navigate('/select-fiscal-year');
                        return;
                    }
                    errorMessage = error.response.data.error || 'Invalid request';
                    break;
                case 401:
                    navigate('/login');
                    return;
                case 403:
                    navigate('/dashboard');
                    return;
                default:
                    errorMessage = error.response.data.message || 'Request failed';
            }
        } else if (error.request) {
            errorMessage = 'No response from server. Please check your connection.';
        } else {
            errorMessage = error.message || 'An error occurred';
        }

        showNotificationMessage(errorMessage, 'error');
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value.toLowerCase());
    };

    const filteredCategories = data.categories.filter(category =>
        category.name.toLowerCase().includes(searchTerm)
    );

    const handleAdd = () => {
        setCurrentCategory(null);
        setFormData({
            name: '',
        });
    };

    const handleEdit = (category) => {
        setCurrentCategory(category);
        setFormData({
            name: category.name,
        });
    };

    const handleCancel = () => {
        setCurrentCategory(null);
        setFormData({
            name: '',
        });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this category?')) {
            try {
                const response = await api.delete(`/api/retailer/categories/${id}`);

                if (response.data.success) {
                    showNotificationMessage('Category deleted successfully', 'success');
                    fetchCategories();
                } else {
                    showNotificationMessage(response.data.message || 'Failed to delete category', 'error');
                }
            } catch (err) {
                if (err.response && err.response.status === 400) {
                    showNotificationMessage(err.response.data.message || 'Category cannot be deleted as it has related items', 'error');
                } else {
                    showNotificationMessage(err.message || 'Failed to delete category', 'error');
                }
            }
        }
    };

    // const handleFormChange = (e) => {
    //     const { name, value } = e.target;
    //     setFormData(prev => ({
    //         ...prev,
    //         [name]: value
    //     }));
    // };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // If the field being changed is the name field, also update the search term
        if (name === 'name') {
            setSearchTerm(value.toLowerCase());
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (currentCategory) {
                await api.put(`/api/retailer/categories/${currentCategory._id}`, formData);
                showNotificationMessage('Category updated successfully!', 'success');
            } else {
                await api.post('/api/retailer/categories', formData);
                showNotificationMessage('Category created successfully!', 'success');
            }
            fetchCategories();
            handleCancel();
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsSaving(false);
        }
    };


    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
            } else if (e.key === 'F6') {
                e.preventDefault();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const form = e.target.form;
                if (form) {
                    const index = Array.prototype.indexOf.call(form, e.target);
                    if (index < form.length - 1) {
                        form.elements[index + 1].focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);


    const printCategories = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Categories Report</title>
                    <style>
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <h2>Categories Report - ${data.currentCompanyName}</h2>
                    <h3>Fiscal Year: ${data.currentFiscalYear?.name || 'N/A'}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>S.N.</th>
                                <th>Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.categories.map((category, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${category.name}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <p style="margin-top: 20px;">
                        Printed on: ${new Date().toLocaleDateString()}
                    </p>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="container-fluid">
            {/* Notification Toast */}
            <NotificationToast
                message={notificationMessage}
                type={notificationType}
                show={showNotification}
                onClose={() => setShowNotification(false)}
            />
            <Header />
            <div className="row g-3">
                {/* Left Column - Add/Edit Category Form */}
                <div className="col-lg-6">
                    <div className="card h-100 shadow-lg">
                        <h1 className="text-center" style={{ textDecoration: 'underline' }}>
                            {currentCategory ? `Edit Category: ${currentCategory.name}` : 'Add New Category'}
                        </h1>
                        <div className="card-body">
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Category Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleFormChange}
                                        placeholder="Enter category name"
                                        required
                                        autoFocus
                                        autoComplete='off'
                                    />
                                </Form.Group>
                                <div className="d-flex justify-content-between">
                                    {currentCategory ? (
                                        <Button
                                            variant="secondary"
                                            onClick={handleCancel}
                                            disabled={isSaving}
                                        >
                                            <FiX className="me-1" /> Cancel
                                        </Button>
                                    ) : (
                                        <div></div>
                                    )}
                                    <Button variant="primary" type="submit" disabled={isSaving}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSubmit(e);
                                            }
                                        }}
                                    >
                                        {isSaving ? (
                                            <>
                                                <Spinner
                                                    as="span"
                                                    animation="border"
                                                    size="sm"
                                                    role="status"
                                                    aria-hidden="true"
                                                    className="me-2"
                                                />
                                                Saving...
                                            </>
                                        ) : currentCategory ? (
                                            'Save Changes'
                                        ) : (
                                            'Add Category'
                                        )}
                                    </Button>
                                </div>
                            </Form>
                        </div>
                    </div>
                </div>

                {/* Right Column - Existing Categories */}
                <div className="col-lg-6">
                    <div className="card h-100 shadow-lg" style={{ height: '600px' }}>
                        <div className="card-body">
                            <h1 className="text-center" style={{ textDecoration: 'underline' }}>Existing Categories</h1>

                            {/* Header with buttons */}
                            <div className="row mb-3">
                                <div className="col-2">
                                    <Button variant="primary" onClick={() => navigate(-1)}>
                                        <FiArrowLeft /> Back
                                    </Button>
                                </div>
                                <div className="col-1">
                                    <Button variant="primary" onClick={printCategories}>
                                        <FiPrinter />
                                    </Button>
                                </div>
                                <div className="col">
                                    <Form.Control
                                        type="text"
                                        placeholder="Search categories by name..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                            </div>

                            {/* Categories Table */}
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {loading ? (
                                    <div className="text-center">
                                        <Spinner animation="border" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </Spinner>
                                        <p>Loading categories...</p>
                                    </div>
                                ) : filteredCategories.length === 0 ? (
                                    <div className="text-center">No categories found</div>
                                ) : (
                                    <Table striped bordered hover>
                                        <thead>
                                            <tr>
                                                <th>Category Name</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCategories.map((category, index) => (
                                                <tr key={category._id}>
                                                    <td>
                                                        <strong>
                                                            {index + 1}. {category.name}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        {data.isAdminOrSupervisor && (
                                                            <>
                                                                <Button
                                                                    variant="warning"
                                                                    size="sm"
                                                                    className="me-1"
                                                                    onClick={() => handleEdit(category)}
                                                                    disabled={!!currentCategory}
                                                                >
                                                                    <FiEdit2 />
                                                                </Button>
                                                                <Button
                                                                    variant="danger"
                                                                    size="sm"
                                                                    className="me-1"
                                                                    onClick={() => handleDelete(category._id)}
                                                                    disabled={!!currentCategory}
                                                                >
                                                                    <FiTrash2 />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Product modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}
        </div>
    );
};

export default Categories;