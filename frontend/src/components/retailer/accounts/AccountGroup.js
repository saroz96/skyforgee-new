// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';
// import { FiEdit2, FiTrash2, FiPrinter, FiArrowLeft, FiX, FiCheck } from 'react-icons/fi';
// import Button from 'react-bootstrap/Button';
// import Form from 'react-bootstrap/Form';
// import Table from 'react-bootstrap/Table';
// import Spinner from 'react-bootstrap/Spinner';
// import Header from '../Header';
// import NotificationToast from '../../NotificationToast';
// import ProductModal from '../dashboard/modals/ProductModal';

// const AccountGroups = () => {
//     const navigate = useNavigate();
//     const [groups, setGroups] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [searchTerm, setSearchTerm] = useState('');
//     const [currentGroup, setCurrentGroup] = useState(null);
//     const [formData, setFormData] = useState({ name: '', type: '' });
//     const [isSaving, setIsSaving] = useState(false);
//     const [showNotification, setShowNotification] = useState(false);
//     const [notificationMessage, setNotificationMessage] = useState('');
//     const [notificationType, setNotificationType] = useState('');
//     const [companyData, setCompanyData] = useState(null);
//     const [showProductModal, setShowProductModal] = useState(false);

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     const showNotificationMessage = (message, type) => {
//         setNotificationMessage(message);
//         setNotificationType(type);
//         setShowNotification(true);
//     };
//     const fetchAccountGroups = React.useCallback(async () => {
//         try {
//             setLoading(true);
//             const response = await api.get('/api/retailer/account-group');

//             if (response.data) {
//                 setGroups(response.data.companiesGroups || []);
//                 setCompanyData({
//                     name: response.data.currentCompanyName,
//                     renewalDate: response.data.company.renewalDate,
//                     dateFormat: response.data.company.dateFormat
//                 });
//             } else {
//                 throw new Error(response.data.error || 'Failed to fetch account groups');
//             }
//         } catch (err) {
//             setError(err.message);
//             handleApiError(err);
//         } finally {
//             setLoading(false);
//         }
//     }, []); // Add any dependencies this function uses

//     useEffect(() => {
//         fetchAccountGroups();
//     }, [fetchAccountGroups]); // Now safe to include in dependencies

//     const handleApiError = (error) => {
//         let errorMessage = 'An error occurred';

//         if (error.response) {
//             switch (error.response.status) {
//                 case 400:
//                     errorMessage = error.response.data.error || 'Invalid request';
//                     break;
//                 case 401:
//                     navigate('/login');
//                     return;
//                 case 403:
//                     navigate('/dashboard');
//                     return;
//                 case 409:
//                     errorMessage = error.response.data.error || 'Account group already exists';
//                     break;
//                 default:
//                     errorMessage = error.response.data.message || 'Request failed';
//             }
//         } else if (error.request) {
//             errorMessage = 'No response from server. Please check your connection.';
//         } else {
//             errorMessage = error.message || 'An error occurred';
//         }

//         showNotificationMessage(errorMessage, 'error');
//     };

//     const handleSearch = (e) => {
//         setSearchTerm(e.target.value.toLowerCase());
//     };

//     const filteredGroups = groups
//         .filter(group => group?.name?.toLowerCase().includes(searchTerm))
//         .sort((a, b) => a.name.localeCompare(b.name));

//     const handleEdit = (group) => {
//         setCurrentGroup(group);
//         setFormData({ name: group.name, type: group.type });
//     };

//     const handleCancel = () => {
//         setCurrentGroup(null);
//         setFormData({ name: '', type: '' });
//     };

//     const handleDelete = async (id) => {
//         if (window.confirm('Are you sure you want to delete this account group?')) {
//             try {
//                 const response = await api.delete(`/api/retailer/account-group/${id}`);

//                 if (response.data.success) {
//                     showNotificationMessage('Account group deleted successfully', 'success');
//                     fetchAccountGroups();
//                 } else {
//                     showNotificationMessage(response.data.error || 'Failed to delete account group', 'error');
//                 }
//             } catch (err) {
//                 handleApiError(err);
//             }
//         }
//     };

//     // Handle keyboard shortcuts
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             if (e.altKey && e.key.toLowerCase() === 's') {
//                 e.preventDefault();
//             } else if (e.key === 'F6') {
//                 e.preventDefault();
//             } else if (e.key === 'Enter') {
//                 e.preventDefault();
//                 const form = e.target.form;
//                 if (form) {
//                     const index = Array.prototype.indexOf.call(form, e.target);
//                     if (index < form.length - 1) {
//                         form.elements[index + 1].focus();
//                     }
//                 }
//             }
//         };

//         document.addEventListener('keydown', handleKeyDown);
//         return () => document.removeEventListener('keydown', handleKeyDown);
//     }, []);

//     useEffect(() => {
//         // Add F9 key handler here
//         const handF9leKeyDown = (e) => {
//             if (e.key === 'F9') {
//                 e.preventDefault();
//                 setShowProductModal(prev => !prev); // Toggle modal visibility
//             }
//         };
//         window.addEventListener('keydown', handF9leKeyDown);
//         return () => {
//             window.removeEventListener('keydown', handF9leKeyDown);
//         };
//     }, []);


//     const handleFormChange = (e) => {
//         const { name, value } = e.target;
//         setFormData(prev => ({
//             ...prev,
//             [name]: value
//         }));
//         // If the field being changed is the name field, also update the search term
//         if (name === 'name') {
//             setSearchTerm(value.toLowerCase());
//         }
//     };

//     const handleSubmit = async (e) => {
//         e.preventDefault();
//         setIsSaving(true);
//         try {
//             if (currentGroup) {
//                 // Update existing group
//                 await api.put(`/api/retailer/account-group/${currentGroup._id}`, formData);
//                 showNotificationMessage('Account group updated successfully!', 'success');
//             } else {
//                 // Create new group
//                 await api.post('/api/retailer/account-group', formData);
//                 showNotificationMessage('Account group created successfully!', 'success');
//             }
//             fetchAccountGroups();
//             handleCancel();
//         } catch (err) {
//             handleApiError(err);
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     const printGroups = () => {
//         const printWindow = window.open('', '_blank');
//         printWindow.document.write(`
//             <html>
//                 <head>
//                     <title>Account Groups Report</title>
//                     <style>
//                         table { width: 100%; border-collapse: collapse; }
//                         th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
//                         th { background-color: #f2f2f2; }
//                         h1, h2 { text-align: center; }
//                     </style>
//                 </head>
//                 <body>
//                     <h1>Account Groups Report</h1>
//                     <h2>${companyData?.name || 'Company'}</h2>
//                     <table>
//                         <thead>
//                             <tr>
//                                 <th>S.N.</th>
//                                 <th>Group Name</th>
//                                 <th>Group Type</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             ${groups.map((group, index) => `
//                                 <tr>
//                                     <td>${index + 1}</td>
//                                     <td>${group.name}</td>
//                                     <td>${group.type}</td>
//                                 </tr>
//                             `).join('')}
//                         </tbody>
//                     </table>
//                     <p style="margin-top: 20px; text-align: center;">
//                         Printed on: ${new Date().toLocaleDateString()}
//                     </p>
//                 </body>
//             </html>
//         `);
//         printWindow.document.close();
//         printWindow.print();
//     };

//     const groupTypes = [
//         "Current Assets",
//         "Current Liabilities",
//         "Fixed Assets",
//         "Loans(Liability)",
//         "Capital Account",
//         "Revenue Accounts",
//         "Primary"
//     ];

//     return (
//         <div className="container-fluid">
//             <NotificationToast
//                 message={notificationMessage}
//                 type={notificationType}
//                 show={showNotification}
//                 onClose={() => setShowNotification(false)}
//             />
//             <Header />

//             {error ? (
//                 <div className="alert alert-danger">
//                     Error loading account groups: {error}
//                     <Button variant="secondary" onClick={fetchAccountGroups} className="ms-3">
//                         Retry
//                     </Button>
//                 </div>
//             ) : (
//                 <div className="row g-3">
//                     {/* Left Column - Add/Edit Group Form */}
//                     <div className="col-lg-6">
//                         <div className="card h-100 shadow-lg">
//                             <div className="card-body">
//                                 <h1 className="text-center">
//                                     {currentGroup ? `Edit Group: ${currentGroup.name}` : 'Add New Account Group'}
//                                 </h1>
//                                 <Form onSubmit={handleSubmit}>
//                                     <div className="row">
//                                         <div className="col">
//                                             <Form.Group className="mb-3">
//                                                 <Form.Label>Group Name <span className="text-danger">*</span></Form.Label>
//                                                 <Form.Control
//                                                     type="text"
//                                                     name="name"
//                                                     value={formData.name}
//                                                     onChange={handleFormChange}
//                                                     placeholder="Enter group name"
//                                                     required
//                                                     autoFocus
//                                                     autoComplete="off"
//                                                 />
//                                             </Form.Group>
//                                         </div>
//                                         <div className="col">
//                                             <Form.Group className="mb-3">
//                                                 <Form.Label>Group Type <span className="text-danger">*</span></Form.Label>
//                                                 <Form.Select
//                                                     name="type"
//                                                     value={formData.type}
//                                                     onChange={handleFormChange}
//                                                     required
//                                                 >
//                                                     <option value="">Select a type</option>
//                                                     {groupTypes.map(type => (
//                                                         <option key={type} value={type}>{type}</option>
//                                                     ))}
//                                                 </Form.Select>
//                                             </Form.Group>
//                                         </div>
//                                     </div>
//                                     <div className="d-flex justify-content-between">
//                                         {currentGroup ? (
//                                             <Button
//                                                 variant="secondary"
//                                                 onClick={handleCancel}
//                                                 disabled={isSaving}
//                                             >
//                                                 <FiX className="me-1" /> Cancel
//                                             </Button>
//                                         ) : (
//                                             <div></div>
//                                         )}
//                                         <Button variant="primary" type="submit" disabled={isSaving}
//                                             onKeyDown={(e) => {
//                                                 if (e.key === 'Enter') {
//                                                     e.preventDefault();
//                                                     handleSubmit(e);
//                                                 }
//                                             }}
//                                         >
//                                             {isSaving ? (
//                                                 <>
//                                                     <Spinner
//                                                         as="span"
//                                                         animation="border"
//                                                         size="sm"
//                                                         role="status"
//                                                         aria-hidden="true"
//                                                         className="me-2"
//                                                     />
//                                                     Saving...
//                                                 </>
//                                             ) : currentGroup ? (
//                                                 <>
//                                                     <FiCheck className="me-1" /> Save Changes
//                                                 </>
//                                             ) : (
//                                                 'Add Group'
//                                             )}
//                                         </Button>
//                                     </div>
//                                 </Form>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Right Column - Existing Groups */}
//                     <div className="col-lg-6">
//                         <div className="card h-100 shadow-lg" style={{ height: '600px' }}>
//                             <div className="card-body">
//                                 <h1 className="text-center">Existing Account Groups</h1>

//                                 <div className="row mb-3">
//                                     <div className="col-2">
//                                         <Button variant="primary" onClick={() => navigate(-1)}>
//                                             <FiArrowLeft /> Back
//                                         </Button>
//                                     </div>
//                                     <div className="col-1">
//                                         <Button variant="primary" onClick={printGroups}>
//                                             <FiPrinter />
//                                         </Button>
//                                     </div>
//                                     <div className="col">
//                                         <Form.Control
//                                             type="text"
//                                             placeholder="Search groups by name..."
//                                             value={searchTerm}
//                                             onChange={handleSearch}
//                                         />
//                                     </div>
//                                 </div>

//                                 <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
//                                     {loading ? (
//                                         <div className="text-center">
//                                             <Spinner animation="border" role="status">
//                                                 <span className="visually-hidden">Loading...</span>
//                                             </Spinner>
//                                             <p>Loading account groups...</p>
//                                         </div>
//                                     ) : filteredGroups.length === 0 ? (
//                                         <div className="text-center">
//                                             {searchTerm ? 'No matching groups found' : 'No account groups available'}
//                                         </div>
//                                     ) : (
//                                         <Table striped bordered hover>
//                                             <thead>
//                                                 <tr>
//                                                     <th>Group Name</th>
//                                                     <th>Group Type</th>
//                                                     <th>Actions</th>
//                                                 </tr>
//                                             </thead>
//                                             <tbody>
//                                                 {filteredGroups.map((group, index) => (
//                                                     <tr key={group._id}>
//                                                         <td>
//                                                             <strong>
//                                                                 {index + 1}. {group.name}
//                                                             </strong>
//                                                         </td>
//                                                         <td>
//                                                             <strong>
//                                                                 {group.type}
//                                                             </strong>
//                                                         </td>
//                                                         <td>
//                                                             <Button
//                                                                 variant="warning"
//                                                                 size="sm"
//                                                                 className="me-2"
//                                                                 onClick={() => handleEdit(group)}
//                                                                 disabled={!!currentGroup}
//                                                             >
//                                                                 <FiEdit2 />
//                                                             </Button>
//                                                             <Button
//                                                                 variant="danger"
//                                                                 size="sm"
//                                                                 onClick={() => handleDelete(group._id)}
//                                                                 disabled={!!currentGroup}
//                                                             >
//                                                                 <FiTrash2 />
//                                                             </Button>
//                                                         </td>
//                                                     </tr>
//                                                 ))}
//                                             </tbody>
//                                         </Table>
//                                     )}
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             )}

//             {/* Product modal */}
//             {showProductModal && (
//                 <ProductModal onClose={() => setShowProductModal(false)} />
//             )}
//         </div>
//     );
// };

// export default AccountGroups;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPrinter, FiArrowLeft, FiX, FiCheck } from 'react-icons/fi';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import Header from '../Header';
import NotificationToast from '../../NotificationToast';
import ProductModal from '../dashboard/modals/ProductModal';
import Modal from 'react-bootstrap/Modal'; // Import Modal for the confirmation

const AccountGroups = () => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentGroup, setCurrentGroup] = useState(null);
    const [formData, setFormData] = useState({ name: '', type: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState('');
    const [companyData, setCompanyData] = useState(null);
    const [showProductModal, setShowProductModal] = useState(false);
    const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false); // New state for save confirmation modal


    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    const showNotificationMessage = (message, type) => {
        setNotificationMessage(message);
        setNotificationType(type);
        setShowNotification(true);
    };
    const fetchAccountGroups = React.useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/retailer/account-group');

            if (response.data) {
                setGroups(response.data.companiesGroups || []);
                setCompanyData({
                    name: response.data.currentCompanyName,
                    renewalDate: response.data.company.renewalDate,
                    dateFormat: response.data.company.dateFormat
                });
            } else {
                throw new Error(response.data.error || 'Failed to fetch account groups');
            }
        } catch (err) {
            setError(err.message);
            handleApiError(err);
        } finally {
            setLoading(false);
        }
    }, []); // Add any dependencies this function uses

    useEffect(() => {
        fetchAccountGroups();
    }, [fetchAccountGroups]); // Now safe to include in dependencies

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
                    errorMessage = error.response.data.error || 'Account group already exists';
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

    const filteredGroups = groups
        .filter(group => group?.name?.toLowerCase().includes(searchTerm))
        .sort((a, b) => a.name.localeCompare(b.name));

    const handleEdit = (group) => {
        setCurrentGroup(group);
        setFormData({ name: group.name, type: group.type });
    };

    const handleCancel = () => {
        setCurrentGroup(null);
        setFormData({ name: '', type: '' });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this account group?')) {
            try {
                const response = await api.delete(`/api/retailer/account-group/${id}`);

                if (response.data.success) {
                    showNotificationMessage('Account group deleted successfully', 'success');
                    fetchAccountGroups();
                } else {
                    showNotificationMessage(response.data.error || 'Failed to delete account group', 'error');
                }
            } catch (err) {
                handleApiError(err);
            }
        }
    };

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                setShowSaveConfirmModal(true); // Show confirmation modal on Alt+S
            } else if (e.key === 'F6') {
                e.preventDefault();
                // Add F6 specific logic here if needed
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
        if (e) {
            e.preventDefault();
        }
        setIsSaving(true);
        try {
            if (currentGroup) {
                // Update existing group
                await api.put(`/api/retailer/account-group/${currentGroup._id}`, formData);
                showNotificationMessage('Account group updated successfully!', 'success');
            } else {
                // Create new group
                await api.post('/api/retailer/account-group', formData);
                showNotificationMessage('Account group created successfully!', 'success');
            }
            fetchAccountGroups();
            handleCancel();
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsSaving(false);
        }
    };

    const printGroups = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Account Groups Report</title>
                    <style>
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        h1, h2 { text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>Account Groups Report</h1>
                    <h2>${companyData?.name || 'Company'}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>S.N.</th>
                                <th>Group Name</th>
                                <th>Group Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${groups.map((group, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${group.name}</td>
                                    <td>${group.type}</td>
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

    const groupTypes = [
        "Current Assets",
        "Current Liabilities",
        "Fixed Assets",
        "Loans(Liability)",
        "Capital Account",
        "Revenue Accounts",
        "Primary"
    ];

    return (
        <div className="container-fluid">
            <NotificationToast
                message={notificationMessage}
                type={notificationType}
                show={showNotification}
                onClose={() => setShowNotification(false)}
            />
            <Header />

            {error ? (
                <div className="alert alert-danger">
                    Error loading account groups: {error}
                    <Button variant="secondary" onClick={fetchAccountGroups} className="ms-3">
                        Retry
                    </Button>
                </div>
            ) : (
                <div className="row g-3">
                    {/* Left Column - Add/Edit Group Form */}
                    <div className="col-lg-6">
                        <div className="card h-100 shadow-lg">
                            <div className="card-body">
                                <h1 className="text-center">
                                    {currentGroup ? `Edit Group: ${currentGroup.name}` : 'Add New Account Group'}
                                </h1>
                                <Form onSubmit={handleSubmit}>
                                    <div className="row">
                                        <div className="col">
                                            <Form.Group className="mb-3">
                                                <Form.Label>Group Name <span className="text-danger">*</span></Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleFormChange}
                                                    placeholder="Enter group name"
                                                    required
                                                    autoFocus
                                                    autoComplete="off"
                                                />
                                            </Form.Group>
                                        </div>
                                        <div className="col">
                                            <Form.Group className="mb-3">
                                                <Form.Label>Group Type <span className="text-danger">*</span></Form.Label>
                                                <Form.Select
                                                    name="type"
                                                    value={formData.type}
                                                    onChange={handleFormChange}
                                                    required
                                                >
                                                    <option value="">Select a type</option>
                                                    {groupTypes.map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </div>
                                    </div>
                                    <div className="d-flex justify-content-between">
                                        {currentGroup ? (
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
                                            ) : currentGroup ? (
                                                <>
                                                    <FiCheck className="me-1" /> Save Changes
                                                </>
                                            ) : (
                                                'Add Group'
                                            )}
                                        </Button>
                                    </div>
                                    <small className="ms-2">To Save Press Alt+S</small> {/* Added shortcut hint */}
                                </Form>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Existing Groups */}
                    <div className="col-lg-6">
                        <div className="card h-100 shadow-lg" style={{ height: '600px' }}>
                            <div className="card-body">
                                <h1 className="text-center">Existing Account Groups</h1>

                                <div className="row mb-3">
                                    <div className="col-2">
                                        <Button variant="primary" onClick={() => navigate(-1)}>
                                            <FiArrowLeft /> Back
                                        </Button>
                                    </div>
                                    <div className="col-1">
                                        <Button variant="primary" onClick={printGroups}>
                                            <FiPrinter />
                                        </Button>
                                    </div>
                                    <div className="col">
                                        <Form.Control
                                            type="text"
                                            placeholder="Search groups by name..."
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
                                            <p>Loading account groups...</p>
                                        </div>
                                    ) : filteredGroups.length === 0 ? (
                                        <div className="text-center">
                                            {searchTerm ? 'No matching groups found' : 'No account groups available'}
                                        </div>
                                    ) : (
                                        <Table striped bordered hover>
                                            <thead>
                                                <tr>
                                                    <th>Group Name</th>
                                                    <th>Group Type</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredGroups.map((group, index) => (
                                                    <tr key={group._id}>
                                                        <td>
                                                            <strong>
                                                                {index + 1}. {group.name}
                                                            </strong>
                                                        </td>
                                                        <td>
                                                            <strong>
                                                                {group.type}
                                                            </strong>
                                                        </td>
                                                        <td>
                                                            <Button
                                                                variant="warning"
                                                                size="sm"
                                                                className="me-2"
                                                                onClick={() => handleEdit(group)}
                                                                disabled={!!currentGroup}
                                                            >
                                                                <FiEdit2 />
                                                            </Button>
                                                            <Button
                                                                variant="danger"
                                                                size="sm"
                                                                onClick={() => handleDelete(group._id)}
                                                                disabled={!!currentGroup}
                                                            >
                                                                <FiTrash2 />
                                                            </Button>
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
            )}

            {/* Save Confirmation Modal */}
            <Modal show={showSaveConfirmModal} onHide={() => setShowSaveConfirmModal(false)} centered>
                <Modal.Header closeButton className="bg-warning text-dark">
                    <Modal.Title>Confirm Save</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to save this account group?</p>
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

export default AccountGroups;