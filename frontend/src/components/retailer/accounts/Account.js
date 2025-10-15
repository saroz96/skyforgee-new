import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiEye, FiCheck, FiPrinter, FiArrowLeft, FiX } from 'react-icons/fi';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Header from '../Header';
import NotificationToast from '../../NotificationToast';
import ProductModal from '../dashboard/modals/ProductModal';

const Accounts = () => {
    const navigate = useNavigate();
    const [data, setData] = useState({
        accounts: [],
        companyGroups: [],
        company: null,
        currentFiscalYear: null,
        isInitialFiscalYear: false,
        companyId: '',
        currentCompanyName: '',
        user: null,
        theme: 'light',
        isAdminOrSupervisor: false
    });
    const [showProductModal, setShowProductModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentAccount, setCurrentAccount] = useState(null);
    const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        ward: '',
        pan: '',
        email: '',
        creditLimit: '',
        contactperson: '',
        companyGroups: '',
        openingBalance: {
            amount: 0,
            type: 'Dr'
        }
    });

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
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/retailer/companies');

            if (response.data.redirectTo) {
                navigate(response.data.redirectTo);
                return;
            }

            if (response.data.success) {
                setData({
                    accounts: response.data.data.accounts,
                    companyGroups: response.data.data.companyGroups,
                    company: response.data.data.company,
                    currentFiscalYear: response.data.data.currentFiscalYear,
                    isInitialFiscalYear: response.data.data.isInitialFiscalYear,
                    companyId: response.data.data.companyId,
                    currentCompanyName: response.data.data.currentCompanyName,
                    user: response.data.data.user,
                    theme: response.data.data.theme,
                    isAdminOrSupervisor: response.data.data.isAdminOrSupervisor
                });
            } else {
                throw new Error(response.data.error || 'Failed to fetch accounts');
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            address: '',
            phone: '',
            ward: '',
            pan: '',
            email: '',
            creditLimit: '',
            contactperson: '',
            companyGroups: '',
            openingBalance: {
                amount: 0,
                type: 'Dr'
            }
        });
        setCurrentAccount(null);
    };

    const handleApiError = (error) => {
        let errorMessage = 'An error occurred';

        if (error.response) {
            switch (error.response.status) {
                case 400:
                    errorMessage = error.response.data.error || 'Invalid request';
                    break;
                case 401:
                    navigate('/login');
                    return;
                case 403:
                    navigate('/dashboard');
                    return;
                case 409:
                    errorMessage = error.response.data.error || 'Account already exists';
                    break;
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

    const filteredAccounts = data.accounts.filter(account =>
        account.name.toLowerCase().includes(searchTerm) ||
        (account.companyGroups && account.companyGroups.name.toLowerCase().includes(searchTerm))
    ).sort((a, b) => a.name.localeCompare(b.name));

    const handleEdit = (account) => {
        setCurrentAccount(account);
        setFormData({
            name: account.name,
            address: account.address || '',
            phone: account.phone || '',
            ward: account.ward || '',
            pan: account.pan || '',
            email: account.email || '',
            creditLimit: account.creditLimit || '',
            contactperson: account.contactperson || '',
            companyGroups: account.companyGroups?._id || '',
            openingBalance: {
                amount: account.openingBalance?.amount || 0,
                type: account.openingBalance?.type || 'Dr'
            }
        });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this account?')) {
            try {
                const response = await api.delete(`/api/retailer/companies/${id}`);

                if (response.data.success) {
                    showNotificationMessage('Account deleted successfully', 'success');
                    fetchAccounts();
                } else {
                    showNotificationMessage(response.data.error || 'Failed to delete account', 'error');
                }
            } catch (err) {
                handleApiError(err);
            }
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;

        if (name.includes('openingBalance')) {
            const field = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                [name]: value,
                openingBalance: {
                    ...prev.openingBalance,
                    [field]: field === 'amount' ? parseFloat(value) || 0 : value
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));

            // Update search term when name field changes
            if (name === 'name') {
                setSearchTerm(value.toLowerCase());
            }
        }
    };

    const handleSubmit = async (e) => {
        if (e) {
            e.preventDefault();
        }

        setIsSaving(true);

        try {
            if (currentAccount) {
                // Update existing account
                await api.put(`/api/retailer/companies/${currentAccount._id}`, formData);
                showNotificationMessage('Account updated successfully!', 'success');
            } else {
                // Create new account
                await api.post('/api/retailer/companies', formData);
                showNotificationMessage('Account created successfully!', 'success');
                resetForm();
            }
            fetchAccounts();
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsSaving(false);
        }
    };

    const printAccounts = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Accounts Report</title>
                    <style>
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        h1, h2 { text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>Accounts Report</h1>
                    <h2>${data.currentCompanyName}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>S.N.</th>
                                <th>Account Name</th>
                                <th>Account Group</th>
                                <th>Opening Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.accounts.map((account, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${account.name}</td>
                                    <td>${account.companyGroups?.name || 'No Group'}</td>
                                    <td>${account.openingBalance?.amount || 0} ${account.openingBalance?.type || 'Dr'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <p style="margin-top: 20px; text-align: center;">
                        Printed on: ${new Date().toLocaleDateString()}
                    </p>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                setShowSaveConfirmModal(true);
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

    return (
        <div className="container-fluid">
            <NotificationToast
                message={notificationMessage}
                type={notificationType}
                show={showNotification}
                onClose={() => setShowNotification(false)}
            />
            <Header />

            <div className="row g-3">
                {/* Left Column - Add Account Form */}
                <div className="col-lg-6">
                    <div className="card h-100 shadow-lg">
                        <div className="card-body">
                            <h1 className="text-center" style={{ textDecoration: 'underline' }}>
                                {currentAccount ? `Edit Account: ${currentAccount.name}` : 'Create Accounts'}
                            </h1>
                            <Form onSubmit={handleSubmit} id="addAccountForm">
                                <Form.Group className="row mb-3">
                                    <div className="col-md-5">
                                        <Form.Label>Account Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleFormChange}
                                            placeholder="Enter account name"
                                            required
                                            autoFocus
                                            autoComplete="off"
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <Form.Label>Account Group <span className="text-danger">*</span></Form.Label>
                                        <Form.Select
                                            name="companyGroups"
                                            value={formData.companyGroups}
                                            onChange={handleFormChange}
                                            required
                                        >
                                            <option value="" disabled>Select a Group</option>
                                            {data.companyGroups.map(group => (
                                                <option key={group._id} value={group._id}>
                                                    {group.name}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </div>
                                    <div className="col-md-3">
                                        <Form.Label>Op. Balance</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="openingBalance.amount"
                                            value={formData.openingBalance.amount}
                                            onChange={handleFormChange}
                                            step="any"
                                            disabled={!data.isInitialFiscalYear}
                                        />
                                        <Form.Select
                                            name="openingBalance.type"
                                            value={formData.openingBalance.type}
                                            onChange={handleFormChange}
                                            disabled={!data.isInitialFiscalYear}
                                        >
                                            <option value="Dr">Dr.</option>
                                            <option value="Cr">Cr.</option>
                                        </Form.Select>
                                        {!data.isInitialFiscalYear && (
                                            <small className="text-muted">Op. can only be set in init. F.Y year</small>
                                        )}
                                    </div>
                                </Form.Group>
                                <Form.Group className="row mb-3">
                                    <div className="col">
                                        <Form.Label>Credit Limit</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="creditLimit"
                                            value={formData.creditLimit}
                                            onChange={handleFormChange}
                                            step="any"
                                        />
                                    </div>
                                    <div className="col">
                                        <Form.Label>Pan No.:</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="pan"
                                            value={formData.pan}
                                            onChange={handleFormChange}
                                            minLength="9"
                                            maxLength="9"
                                            placeholder="Enter pan/vat number"
                                            autoComplete="off"
                                        />
                                    </div>
                                    <div className="col">
                                        <Form.Label>Address</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="address"
                                            value={formData.address}
                                            onChange={handleFormChange}
                                            placeholder="Enter account address"
                                            autoComplete="off"
                                        />
                                    </div>
                                    <div className="col">
                                        <Form.Label>Ward No.:</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="ward"
                                            value={formData.ward}
                                            onChange={handleFormChange}
                                            placeholder="Enter ward number"
                                            autoComplete="off"
                                        />
                                    </div>
                                </Form.Group>

                                <Form.Group className="row mb-3">
                                    <div className="col-md-4">
                                        <Form.Label>Phone</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleFormChange}
                                            placeholder="Enter account phone"
                                            autoComplete="off"
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <Form.Label>Email</Form.Label>
                                        <Form.Control
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleFormChange}
                                            placeholder="Enter email"
                                            autoComplete="off"
                                            style={{ textTransform: 'lowercase' }}
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <Form.Label>Contact Person</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="contactperson"
                                            value={formData.contactperson}
                                            onChange={handleFormChange}
                                            placeholder="Enter contact person"
                                            autoComplete="off"
                                        />
                                    </div>
                                </Form.Group>

                                <div className="d-flex justify-content-between">
                                    {currentAccount ? (
                                        <Button
                                            variant="secondary"
                                            onClick={resetForm}
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
                                        ) : currentAccount ? (
                                            'Save Changes'
                                        ) : (
                                            'Add Account'
                                        )}
                                    </Button>
                                </div>
                                <small className="ms-2">To Save Press Alt+S</small>
                            </Form>
                        </div>
                    </div>
                </div>

                {/* Right Column - Existing Accounts */}
                <div className="col-lg-6">
                    <div className="card h-100 shadow-lg" style={{ height: '600px' }}>
                        <div className="card-body">
                            <h1 className="text-center" style={{ textDecoration: 'underline' }}>Existing Accounts</h1>

                            <div className="row mb-3">
                                <div className="col-2">
                                    <Button variant="primary" onClick={() => navigate(-1)}>
                                        <FiArrowLeft /> Back
                                    </Button>
                                </div>
                                <div className="col-1">
                                    <Button variant="primary" onClick={printAccounts}>
                                        <FiPrinter />
                                    </Button>
                                </div>
                                <div className="col">
                                    <Form.Control
                                        type="text"
                                        placeholder="Search accounts by name..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                            </div>

                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {loading ? (
                                    <div className="text-center">
                                        <Spinner animation="border" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </Spinner>
                                        <p>Loading accounts...</p>
                                    </div>
                                ) : filteredAccounts.length === 0 ? (
                                    <div className="text-center">
                                        {searchTerm ? 'No matching accounts found' : 'No accounts available'}
                                    </div>
                                ) : (
                                    <Table striped bordered hover>
                                        <thead>
                                            <tr>
                                                <th>Account Name</th>
                                                <th>Account Group</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAccounts.map((account, index) => (
                                                <tr key={account._id}>
                                                    <td>
                                                        <strong>
                                                            {index + 1}. {account.name}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        <small>
                                                            {account.companyGroups?.name || 'No Group'}
                                                        </small>
                                                    </td>
                                                    <td>
                                                        <Button
                                                            variant="info"
                                                            size="sm"
                                                            className="me-2"
                                                            onClick={() => navigate(`/retailer/companies/${account._id}`)}
                                                        >
                                                            <FiEye />
                                                        </Button>
                                                        {data.isAdminOrSupervisor && (
                                                            <>
                                                                <Button
                                                                    variant="warning"
                                                                    size="sm"
                                                                    className="me-2"
                                                                    onClick={() => handleEdit(account)}
                                                                    disabled={!!currentAccount}
                                                                >
                                                                    <FiEdit2 />
                                                                </Button>
                                                                <Button
                                                                    variant="danger"
                                                                    size="sm"
                                                                    onClick={() => handleDelete(account._id)}
                                                                    disabled={!!currentAccount}
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

            {/* Save Confirmation Modal */}
            <Modal show={showSaveConfirmModal} onHide={() => setShowSaveConfirmModal(false)} centered>
                <Modal.Header closeButton className="bg-warning text-dark">
                    <Modal.Title>Confirm Save</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to save this account?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowSaveConfirmModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => {
                        handleSubmit(); // Call handleSubmit directly
                        setShowSaveConfirmModal(false);
                    }}>
                        Save
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Product modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}
        </div>
    );
};

export default Accounts;