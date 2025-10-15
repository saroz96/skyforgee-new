// import React, { useState, useEffect, useRef } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';
// import { FiEdit2, FiTrash2, FiEye, FiCheck, FiPrinter, FiArrowLeft, FiX, FiPlus } from 'react-icons/fi';
// import Modal from 'react-bootstrap/Modal';
// import Button from 'react-bootstrap/Button';
// import Form from 'react-bootstrap/Form';
// import Table from 'react-bootstrap/Table';
// import Badge from 'react-bootstrap/Badge';
// import Spinner from 'react-bootstrap/Spinner';
// import NotificationToast from '../../NotificationToast';

// const AccountsModal = ({ show, onClose, onAccountCreated }) => {
//     const navigate = useNavigate();
//     const [data, setData] = useState({
//         accounts: [],
//         companyGroups: [],
//         company: null,
//         currentFiscalYear: null,
//         isInitialFiscalYear: false,
//         companyId: '',
//         currentCompanyName: '',
//         user: null,
//         theme: 'light',
//         isAdminOrSupervisor: false
//     });
//     const [showProductModal, setShowProductModal] = useState(false);
//     const [loading, setLoading] = useState(true);
//     const [searchTerm, setSearchTerm] = useState('');
//     const [currentAccount, setCurrentAccount] = useState(null);
//     const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
//     const [isSaving, setIsSaving] = useState(false);
//     const [showNotification, setShowNotification] = useState(false);
//     const [notificationMessage, setNotificationMessage] = useState('');
//     const [notificationType, setNotificationType] = useState('');

//     // Form state
//     const [formData, setFormData] = useState({
//         name: '',
//         address: '',
//         phone: '',
//         ward: '',
//         pan: '',
//         email: '',
//         creditLimit: '',
//         contactperson: '',
//         companyGroups: '',
//         openingBalance: {
//             amount: 0,
//             type: 'Dr'
//         }
//     });

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     const showNotificationMessage = (message, type) => {
//         setNotificationMessage(message);
//         setNotificationType(type);
//         setShowNotification(true);
//     };

//     useEffect(() => {
//         if (show) {
//             fetchAccounts();
//         }
//     }, [show]);

//     const fetchAccounts = async () => {
//         try {
//             setLoading(true);
//             const response = await api.get('/api/retailer/companies');

//             if (response.data.redirectTo) {
//                 navigate(response.data.redirectTo);
//                 return;
//             }

//             if (response.data.success) {
//                 setData({
//                     accounts: response.data.data.accounts,
//                     companyGroups: response.data.data.companyGroups,
//                     company: response.data.data.company,
//                     currentFiscalYear: response.data.data.currentFiscalYear,
//                     isInitialFiscalYear: response.data.data.isInitialFiscalYear,
//                     companyId: response.data.data.companyId,
//                     currentCompanyName: response.data.data.currentCompanyName,
//                     user: response.data.data.user,
//                     theme: response.data.data.theme,
//                     isAdminOrSupervisor: response.data.data.isAdminOrSupervisor
//                 });
//             } else {
//                 throw new Error(response.data.error || 'Failed to fetch accounts');
//             }
//         } catch (err) {
//             handleApiError(err);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const resetForm = () => {
//         setFormData({
//             name: '',
//             address: '',
//             phone: '',
//             ward: '',
//             pan: '',
//             email: '',
//             creditLimit: '',
//             contactperson: '',
//             companyGroups: '',
//             openingBalance: {
//                 amount: 0,
//                 type: 'Dr'
//             }
//         });
//         setCurrentAccount(null);
//     };

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
//                     errorMessage = error.response.data.error || 'Account already exists';
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

//     const filteredAccounts = data.accounts.filter(account =>
//         account.name.toLowerCase().includes(searchTerm) ||
//         (account.companyGroups && account.companyGroups.name.toLowerCase().includes(searchTerm))
//     ).sort((a, b) => a.name.localeCompare(b.name));

//     const handleEdit = (account) => {
//         setCurrentAccount(account);
//         setFormData({
//             name: account.name,
//             address: account.address || '',
//             phone: account.phone || '',
//             ward: account.ward || '',
//             pan: account.pan || '',
//             email: account.email || '',
//             creditLimit: account.creditLimit || '',
//             contactperson: account.contactperson || '',
//             companyGroups: account.companyGroups?._id || '',
//             openingBalance: {
//                 amount: account.openingBalance?.amount || 0,
//                 type: account.openingBalance?.type || 'Dr'
//             }
//         });
//     };

//     const handleDelete = async (id) => {
//         if (window.confirm('Are you sure you want to delete this account?')) {
//             try {
//                 const response = await api.delete(`/api/retailer/companies/${id}`);

//                 if (response.data.success) {
//                     showNotificationMessage('Account deleted successfully', 'success');
//                     fetchAccounts();
//                 } else {
//                     showNotificationMessage(response.data.error || 'Failed to delete account', 'error');
//                 }
//             } catch (err) {
//                 handleApiError(err);
//             }
//         }
//     };

//     const handleFormChange = (e) => {
//         const { name, value } = e.target;

//         if (name.includes('openingBalance')) {
//             const field = name.split('.')[1];
//             setFormData(prev => ({
//                 ...prev,
//                 [name]: value,
//                 openingBalance: {
//                     ...prev.openingBalance,
//                     [field]: field === 'amount' ? parseFloat(value) || 0 : value
//                 }
//             }));
//         } else {
//             setFormData(prev => ({ ...prev, [name]: value }));

//             // Update search term when name field changes
//             if (name === 'name') {
//                 setSearchTerm(value.toLowerCase());
//             }
//         }
//     };

//     const handleSubmit = async (e) => {
//         if (e) {
//             e.preventDefault();
//         }

//         setIsSaving(true);

//         try {
//             if (currentAccount) {
//                 // Update existing account
//                 await api.put(`/api/retailer/companies/${currentAccount._id}`, formData);
//                 showNotificationMessage('Account updated successfully!', 'success');
//             } else {
//                 // Create new account
//                 await api.post('/api/retailer/companies', formData);
//                 showNotificationMessage('Account created successfully!', 'success');
//                 resetForm();
//             }
//             fetchAccounts();
//             if (onAccountCreated) {
//                 onAccountCreated(formData);
//             }
//         } catch (err) {
//             handleApiError(err);
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     const printAccounts = () => {
//         const printWindow = window.open('', '_blank');
//         printWindow.document.write(`
//             <html>
//                 <head>
//                     <title>Accounts Report</title>
//                     <style>
//                         table { width: 100%; border-collapse: collapse; }
//                         th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
//                         th { background-color: #f2f2f2; }
//                         h1, h2 { text-align: center; }
//                     </style>
//                 </head>
//                 <body>
//                     <h1>Accounts Report</h1>
//                     <h2>${data.currentCompanyName}</h2>
//                     <table>
//                         <thead>
//                             <tr>
//                                 <th>S.N.</th>
//                                 <th>Account Name</th>
//                                 <th>Account Group</th>
//                                 <th>Opening Balance</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             ${data.accounts.map((account, index) => `
//                                 <tr>
//                                     <td>${index + 1}</td>
//                                     <td>${account.name}</td>
//                                     <td>${account.companyGroups?.name || 'No Group'}</td>
//                                     <td>${account.openingBalance?.amount || 0} ${account.openingBalance?.type || 'Dr'}</td>
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

//     // Handle keyboard shortcuts
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             if (e.altKey && e.key.toLowerCase() === 's') {
//                 e.preventDefault();
//                 setShowSaveConfirmModal(true);
//             } else if (e.key === 'Enter') {
//                 e.preventDefault();
//                 const form = e.target.form;
//                 if (form) {
//                     const index = Array.prototype.indexOf.call(form, e.target);
//                     if (index < form.length - 1) {
//                         form.elements[index + 1].focus();
//                     }
//                 }
//             } else if (e.key === 'Escape' && show) {
//                 e.preventDefault();
//                 handleClose();
//             } else if (e.key === 'F9' && show) {
//                 e.preventDefault();
//                 setShowProductModal(prev => !prev);
//             }
//         };
        
//         if (show) {
//             document.addEventListener('keydown', handleKeyDown);
//         }
        
//         return () => document.removeEventListener('keydown', handleKeyDown);
//     }, [show]);

//     const handleClose = () => {
//         resetForm();
//         onClose();
//     };

//     if (!show) return null;

//     return (
//         <div className="modal fade show" style={{
//             display: 'block',
//             backgroundColor: 'rgba(0,0,0,0.5)',
//             position: 'fixed',
//             top: 0,
//             left: 0,
//             right: 0,
//             bottom: 0,
//             zIndex: 1050
//         }}>
//             <div className="modal-dialog modal-xl" style={{
//                 maxWidth: '95%',
//                 height: '95%',
//                 margin: '2.5% auto'
//             }}>
//                 <div className="modal-content" style={{
//                     height: '100%',
//                     display: 'flex',
//                     flexDirection: 'column'
//                 }}>
//                     {/* Modal Header */}
//                     <div className="modal-header" style={{
//                         background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
//                         color: 'white',
//                         borderBottom: '3px solid #1f618d'
//                     }}>
//                         <h5 className="modal-title" style={{ fontWeight: '700', fontSize: '1.3rem' }}>
//                             👥 ACCOUNTS MANAGEMENT
//                         </h5>
//                         <button
//                             type="button"
//                             className="btn-close"
//                             onClick={handleClose}
//                             style={{ filter: 'brightness(0) invert(1)' }}
//                         ></button>
//                     </div>

//                     {/* Modal Body */}
//                     <div className="modal-body" style={{
//                         flex: 1,
//                         padding: 0,
//                         overflow: 'hidden'
//                     }}>
//                         <div className="ims-container" style={{
//                             background: '#ecf0f1',
//                             height: '100%',
//                             display: 'flex'
//                         }}>
//                             {/* Left Column - Add Account Form */}
//                             <div className="col-lg-6" style={{
//                                 background: 'white',
//                                 borderRight: '3px solid #bdc3c7',
//                                 padding: '20px',
//                                 overflowY: 'auto'
//                             }}>
//                                 <div className="card h-100 shadow-lg" style={{ border: 'none' }}>
//                                     <div className="card-body">
//                                         <h1 className="text-center" style={{ 
//                                             textDecoration: 'underline',
//                                             color: '#2c3e50',
//                                             fontSize: '1.5rem',
//                                             marginBottom: '20px'
//                                         }}>
//                                             {currentAccount ? `Edit Account: ${currentAccount.name}` : 'Create Accounts'}
//                                         </h1>
//                                         <Form onSubmit={handleSubmit} id="addAccountForm">
//                                             <Form.Group className="row mb-3">
//                                                 <div className="col-md-5">
//                                                     <Form.Label>Account Name <span className="text-danger">*</span></Form.Label>
//                                                     <Form.Control
//                                                         type="text"
//                                                         name="name"
//                                                         value={formData.name}
//                                                         onChange={handleFormChange}
//                                                         placeholder="Enter account name"
//                                                         required
//                                                         autoFocus
//                                                         autoComplete="off"
//                                                         style={{
//                                                             border: '2px solid #3498db',
//                                                             borderRadius: '8px',
//                                                             padding: '10px'
//                                                         }}
//                                                     />
//                                                 </div>
//                                                 <div className="col-md-4">
//                                                     <Form.Label>Account Group <span className="text-danger">*</span></Form.Label>
//                                                     <Form.Select
//                                                         name="companyGroups"
//                                                         value={formData.companyGroups}
//                                                         onChange={handleFormChange}
//                                                         required
//                                                         style={{
//                                                             border: '2px solid #3498db',
//                                                             borderRadius: '8px',
//                                                             padding: '10px'
//                                                         }}
//                                                     >
//                                                         <option value="" disabled>Select a Group</option>
//                                                         {data.companyGroups.map(group => (
//                                                             <option key={group._id} value={group._id}>
//                                                                 {group.name}
//                                                             </option>
//                                                         ))}
//                                                     </Form.Select>
//                                                 </div>
//                                                 <div className="col-md-3">
//                                                     <Form.Label>Op. Balance</Form.Label>
//                                                     <Form.Control
//                                                         type="number"
//                                                         name="openingBalance.amount"
//                                                         value={formData.openingBalance.amount}
//                                                         onChange={handleFormChange}
//                                                         step="any"
//                                                         disabled={!data.isInitialFiscalYear}
//                                                         style={{
//                                                             border: '2px solid #bdc3c7',
//                                                             borderRadius: '8px',
//                                                             padding: '10px',
//                                                             marginBottom: '5px'
//                                                         }}
//                                                     />
//                                                     <Form.Select
//                                                         name="openingBalance.type"
//                                                         value={formData.openingBalance.type}
//                                                         onChange={handleFormChange}
//                                                         disabled={!data.isInitialFiscalYear}
//                                                         style={{
//                                                             border: '2px solid #bdc3c7',
//                                                             borderRadius: '8px',
//                                                             padding: '10px'
//                                                         }}
//                                                     >
//                                                         <option value="Dr">Dr.</option>
//                                                         <option value="Cr">Cr.</option>
//                                                     </Form.Select>
//                                                     {!data.isInitialFiscalYear && (
//                                                         <small className="text-muted">Op. can only be set in init. F.Y year</small>
//                                                     )}
//                                                 </div>
//                                             </Form.Group>
//                                             <Form.Group className="row mb-3">
//                                                 <div className="col">
//                                                     <Form.Label>Credit Limit</Form.Label>
//                                                     <Form.Control
//                                                         type="number"
//                                                         name="creditLimit"
//                                                         value={formData.creditLimit}
//                                                         onChange={handleFormChange}
//                                                         step="any"
//                                                         style={{
//                                                             border: '2px solid #bdc3c7',
//                                                             borderRadius: '8px',
//                                                             padding: '10px'
//                                                         }}
//                                                     />
//                                                 </div>
//                                                 <div className="col">
//                                                     <Form.Label>Pan No.:</Form.Label>
//                                                     <Form.Control
//                                                         type="text"
//                                                         name="pan"
//                                                         value={formData.pan}
//                                                         onChange={handleFormChange}
//                                                         minLength="9"
//                                                         maxLength="9"
//                                                         placeholder="Enter pan/vat number"
//                                                         autoComplete="off"
//                                                         style={{
//                                                             border: '2px solid #bdc3c7',
//                                                             borderRadius: '8px',
//                                                             padding: '10px'
//                                                         }}
//                                                     />
//                                                 </div>
//                                                 <div className="col">
//                                                     <Form.Label>Address</Form.Label>
//                                                     <Form.Control
//                                                         type="text"
//                                                         name="address"
//                                                         value={formData.address}
//                                                         onChange={handleFormChange}
//                                                         placeholder="Enter account address"
//                                                         autoComplete="off"
//                                                         style={{
//                                                             border: '2px solid #bdc3c7',
//                                                             borderRadius: '8px',
//                                                             padding: '10px'
//                                                         }}
//                                                     />
//                                                 </div>
//                                                 <div className="col">
//                                                     <Form.Label>Ward No.:</Form.Label>
//                                                     <Form.Control
//                                                         type="number"
//                                                         name="ward"
//                                                         value={formData.ward}
//                                                         onChange={handleFormChange}
//                                                         placeholder="Enter ward number"
//                                                         autoComplete="off"
//                                                         style={{
//                                                             border: '2px solid #bdc3c7',
//                                                             borderRadius: '8px',
//                                                             padding: '10px'
//                                                         }}
//                                                     />
//                                                 </div>
//                                             </Form.Group>

//                                             <Form.Group className="row mb-3">
//                                                 <div className="col-md-4">
//                                                     <Form.Label>Phone</Form.Label>
//                                                     <Form.Control
//                                                         type="text"
//                                                         name="phone"
//                                                         value={formData.phone}
//                                                         onChange={handleFormChange}
//                                                         placeholder="Enter account phone"
//                                                         autoComplete="off"
//                                                         style={{
//                                                             border: '2px solid #bdc3c7',
//                                                             borderRadius: '8px',
//                                                             padding: '10px'
//                                                         }}
//                                                     />
//                                                 </div>
//                                                 <div className="col-md-4">
//                                                     <Form.Label>Email</Form.Label>
//                                                     <Form.Control
//                                                         type="email"
//                                                         name="email"
//                                                         value={formData.email}
//                                                         onChange={handleFormChange}
//                                                         placeholder="Enter email"
//                                                         autoComplete="off"
//                                                         style={{
//                                                             border: '2px solid #bdc3c7',
//                                                             borderRadius: '8px',
//                                                             padding: '10px',
//                                                             textTransform: 'lowercase'
//                                                         }}
//                                                     />
//                                                 </div>
//                                                 <div className="col-md-4">
//                                                     <Form.Label>Contact Person</Form.Label>
//                                                     <Form.Control
//                                                         type="text"
//                                                         name="contactperson"
//                                                         value={formData.contactperson}
//                                                         onChange={handleFormChange}
//                                                         placeholder="Enter contact person"
//                                                         autoComplete="off"
//                                                         style={{
//                                                             border: '2px solid #bdc3c7',
//                                                             borderRadius: '8px',
//                                                             padding: '10px'
//                                                         }}
//                                                     />
//                                                 </div>
//                                             </Form.Group>

//                                             <div className="d-flex justify-content-between">
//                                                 {currentAccount ? (
//                                                     <Button
//                                                         variant="secondary"
//                                                         onClick={resetForm}
//                                                         disabled={isSaving}
//                                                         style={{
//                                                             borderRadius: '8px',
//                                                             padding: '10px 20px',
//                                                             fontWeight: '600'
//                                                         }}
//                                                     >
//                                                         <FiX className="me-1" /> Cancel
//                                                     </Button>
//                                                 ) : (
//                                                     <div></div>
//                                                 )}
//                                                 <Button 
//                                                     variant="primary" 
//                                                     type="submit" 
//                                                     disabled={isSaving}
//                                                     style={{
//                                                         borderRadius: '8px',
//                                                         padding: '10px 20px',
//                                                         fontWeight: '600',
//                                                         background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
//                                                         border: 'none'
//                                                     }}
//                                                 >
//                                                     {isSaving ? (
//                                                         <>
//                                                             <Spinner
//                                                                 as="span"
//                                                                 animation="border"
//                                                                 size="sm"
//                                                                 role="status"
//                                                                 aria-hidden="true"
//                                                                 className="me-2"
//                                                             />
//                                                             Saving...
//                                                         </>
//                                                     ) : currentAccount ? (
//                                                         'Save Changes'
//                                                     ) : (
//                                                         <>
//                                                             <FiPlus className="me-1" /> Add Account
//                                                         </>
//                                                     )}
//                                                 </Button>
//                                             </div>
//                                             <small className="ms-2 text-muted">To Save Press Alt+S</small>
//                                         </Form>
//                                     </div>
//                                 </div>
//                             </div>

//                             {/* Right Column - Existing Accounts */}
//                             <div className="col-lg-6" style={{
//                                 padding: '20px',
//                                 overflowY: 'auto'
//                             }}>
//                                 <div className="card h-100 shadow-lg" style={{ 
//                                     border: 'none',
//                                     height: '100%'
//                                 }}>
//                                     <div className="card-body">
//                                         <h1 className="text-center" style={{ 
//                                             textDecoration: 'underline',
//                                             color: '#2c3e50',
//                                             fontSize: '1.5rem',
//                                             marginBottom: '20px'
//                                         }}>Existing Accounts</h1>

//                                         <div className="row mb-3">
//                                             <div className="col-2">
//                                                 <Button 
//                                                     variant="primary" 
//                                                     onClick={handleClose}
//                                                     style={{
//                                                         borderRadius: '8px',
//                                                         padding: '8px 15px',
//                                                         fontWeight: '600'
//                                                     }}
//                                                 >
//                                                     <FiArrowLeft /> Back
//                                                 </Button>
//                                             </div>
//                                             <div className="col-1">
//                                                 <Button 
//                                                     variant="primary" 
//                                                     onClick={printAccounts}
//                                                     style={{
//                                                         borderRadius: '8px',
//                                                         padding: '8px 15px',
//                                                         fontWeight: '600'
//                                                     }}
//                                                 >
//                                                     <FiPrinter />
//                                                 </Button>
//                                             </div>
//                                             <div className="col">
//                                                 <Form.Control
//                                                     type="text"
//                                                     placeholder="Search accounts by name..."
//                                                     value={searchTerm}
//                                                     onChange={handleSearch}
//                                                     style={{
//                                                         border: '2px solid #3498db',
//                                                         borderRadius: '8px',
//                                                         padding: '10px'
//                                                     }}
//                                                 />
//                                             </div>
//                                         </div>

//                                         <div style={{ 
//                                             maxHeight: 'calc(100% - 120px)', 
//                                             overflowY: 'auto',
//                                             borderRadius: '8px',
//                                             border: '1px solid #dee2e6'
//                                         }}>
//                                             {loading ? (
//                                                 <div className="text-center" style={{ padding: '40px' }}>
//                                                     <Spinner animation="border" role="status" variant="primary">
//                                                         <span className="visually-hidden">Loading...</span>
//                                                     </Spinner>
//                                                     <p style={{ marginTop: '10px', color: '#7f8c8d' }}>Loading accounts...</p>
//                                                 </div>
//                                             ) : filteredAccounts.length === 0 ? (
//                                                 <div className="text-center" style={{ padding: '40px', color: '#7f8c8d' }}>
//                                                     {searchTerm ? 'No matching accounts found' : 'No accounts available'}
//                                                 </div>
//                                             ) : (
//                                                 <Table striped bordered hover style={{ margin: 0 }}>
//                                                     <thead style={{
//                                                         background: 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)',
//                                                         color: 'white',
//                                                         position: 'sticky',
//                                                         top: 0,
//                                                         zIndex: 10
//                                                     }}>
//                                                         <tr>
//                                                             <th style={{ 
//                                                                 padding: '12px 8px',
//                                                                 fontWeight: '600',
//                                                                 borderRight: '1px solid #46627f'
//                                                             }}>Account Name</th>
//                                                             <th style={{ 
//                                                                 padding: '12px 8px',
//                                                                 fontWeight: '600',
//                                                                 borderRight: '1px solid #46627f'
//                                                             }}>Account Group</th>
//                                                             <th style={{ 
//                                                                 padding: '12px 8px',
//                                                                 fontWeight: '600'
//                                                             }}>Actions</th>
//                                                         </tr>
//                                                     </thead>
//                                                     <tbody>
//                                                         {filteredAccounts.map((account, index) => (
//                                                             <tr key={account._id} style={{
//                                                                 transition: 'background-color 0.2s ease'
//                                                             }}>
//                                                                 <td style={{ padding: '12px 8px' }}>
//                                                                     <strong style={{ color: '#2c3e50' }}>
//                                                                         {index + 1}. {account.name}
//                                                                     </strong>
//                                                                 </td>
//                                                                 <td style={{ padding: '12px 8px' }}>
//                                                                     <small style={{ color: '#7f8c8d' }}>
//                                                                         {account.companyGroups?.name || 'No Group'}
//                                                                     </small>
//                                                                 </td>
//                                                                 <td style={{ padding: '12px 8px' }}>
//                                                                     <Button
//                                                                         variant="info"
//                                                                         size="sm"
//                                                                         className="me-2"
//                                                                         onClick={() => navigate(`/retailer/companies/${account._id}`)}
//                                                                         style={{ borderRadius: '6px' }}
//                                                                     >
//                                                                         <FiEye />
//                                                                     </Button>
//                                                                     {data.isAdminOrSupervisor && (
//                                                                         <>
//                                                                             <Button
//                                                                                 variant="warning"
//                                                                                 size="sm"
//                                                                                 className="me-2"
//                                                                                 onClick={() => handleEdit(account)}
//                                                                                 disabled={!!currentAccount}
//                                                                                 style={{ borderRadius: '6px' }}
//                                                                             >
//                                                                                 <FiEdit2 />
//                                                                             </Button>
//                                                                             <Button
//                                                                                 variant="danger"
//                                                                                 size="sm"
//                                                                                 onClick={() => handleDelete(account._id)}
//                                                                                 disabled={!!currentAccount}
//                                                                                 style={{ borderRadius: '6px' }}
//                                                                             >
//                                                                                 <FiTrash2 />
//                                                                             </Button>
//                                                                         </>
//                                                                     )}
//                                                                 </td>
//                                                             </tr>
//                                                         ))}
//                                                     </tbody>
//                                                 </Table>
//                                             )}
//                                         </div>
//                                     </div>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             {/* Save Confirmation Modal */}
//             <Modal show={showSaveConfirmModal} onHide={() => setShowSaveConfirmModal(false)} centered>
//                 <Modal.Header closeButton className="bg-warning text-dark">
//                     <Modal.Title>Confirm Save</Modal.Title>
//                 </Modal.Header>
//                 <Modal.Body>
//                     <p>Are you sure you want to save this account?</p>
//                 </Modal.Body>
//                 <Modal.Footer>
//                     <Button variant="secondary" onClick={() => setShowSaveConfirmModal(false)}>
//                         Cancel
//                     </Button>
//                     <Button variant="primary" onClick={() => {
//                         handleSubmit();
//                         setShowSaveConfirmModal(false);
//                     }}>
//                         Save
//                     </Button>
//                 </Modal.Footer>
//             </Modal>

//             <NotificationToast
//                 message={notificationMessage}
//                 type={notificationType}
//                 show={showNotification}
//                 onClose={() => setShowNotification(false)}
//             />
//         </div>
//     );
// };

// export default AccountsModal;


import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiEye, FiCheck, FiPrinter, FiArrowLeft, FiX, FiPlus, FiArrowUp, FiArrowDown, FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import InputGroup from 'react-bootstrap/InputGroup';
import NotificationToast from '../../NotificationToast';

const AccountsModal = ({ show, onClose, onAccountCreated }) => {
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

    // Navigation state
    const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [scrollPosition, setScrollPosition] = useState(0);

    // Refs
    const tableContainerRef = useRef(null);
    const tableBodyRef = useRef(null);
    const searchInputRef = useRef(null);

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
        if (show) {
            fetchAccounts();
            // Focus search input when modal opens
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [show]);

    // Navigation effects
    useEffect(() => {
        if (selectedRowIndex >= 0 && tableBodyRef.current) {
            const selectedRow = tableBodyRef.current.querySelector(`tr[data-row-index="${selectedRowIndex}"]`);
            if (selectedRow) {
                selectedRow.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex]);

    useEffect(() => {
        setSelectedRowIndex(-1);
        setCurrentPage(1);
    }, [searchTerm, itemsPerPage]);

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

    // Pagination calculations
    const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = filteredAccounts.slice(startIndex, endIndex);

    // Navigation handlers
    const handleRowNavigation = (direction) => {
        if (currentItems.length === 0) return;

        let newIndex;
        if (direction === 'down') {
            newIndex = selectedRowIndex < currentItems.length - 1 ? selectedRowIndex + 1 : 0;
        } else {
            newIndex = selectedRowIndex > 0 ? selectedRowIndex - 1 : currentItems.length - 1;
        }
        setSelectedRowIndex(newIndex);
    };

    const handlePageNavigation = (direction) => {
        if (direction === 'next' && currentPage < totalPages) {
            setCurrentPage(prev => prev + 1);
        } else if (direction === 'prev' && currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
    };

    const handleRowClick = (index, account) => {
        setSelectedRowIndex(index);
    };

    const handleKeyDown = (e) => {
        if (!show) return;

        const focusedElement = document.activeElement;
        const isInputFocused = focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'TEXTAREA' || focusedElement.tagName === 'SELECT';

        if (!isInputFocused) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    handleRowNavigation('down');
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    handleRowNavigation('up');
                    break;
                case 'PageDown':
                    e.preventDefault();
                    handlePageNavigation('next');
                    break;
                case 'PageUp':
                    e.preventDefault();
                    handlePageNavigation('prev');
                    break;
                case 'Home':
                    e.preventDefault();
                    setSelectedRowIndex(0);
                    setCurrentPage(1);
                    break;
                case 'End':
                    e.preventDefault();
                    setSelectedRowIndex(currentItems.length - 1);
                    setCurrentPage(totalPages);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedRowIndex >= 0 && selectedRowIndex < currentItems.length) {
                        handleEdit(currentItems[selectedRowIndex]);
                    }
                    break;
                case 'Delete':
                    e.preventDefault();
                    if (selectedRowIndex >= 0 && selectedRowIndex < currentItems.length) {
                        handleDelete(currentItems[selectedRowIndex]._id);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    setSelectedRowIndex(-1);
                    break;
                case 'F2':
                    e.preventDefault();
                    searchInputRef.current?.focus();
                    searchInputRef.current?.select();
                    break;
            }
        }

        // Global shortcuts (work even when inputs are focused)
        if (e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            setShowSaveConfirmModal(true);
        } else if (e.key === 'F9' && show) {
            e.preventDefault();
            setShowProductModal(prev => !prev);
        }
    };

    // Enhanced keyboard shortcuts
    useEffect(() => {
        if (show) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [show, selectedRowIndex, currentPage, currentItems, totalPages]);

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
                    setSelectedRowIndex(-1);
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
                await api.put(`/api/retailer/companies/${currentAccount._id}`, formData);
                showNotificationMessage('Account updated successfully!', 'success');
            } else {
                await api.post('/api/retailer/companies', formData);
                showNotificationMessage('Account created successfully!', 'success');
                resetForm();
            }
            fetchAccounts();
            if (onAccountCreated) {
                onAccountCreated(formData);
            }
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

    const handleClose = () => {
        resetForm();
        setSelectedRowIndex(-1);
        setCurrentPage(1);
        onClose();
    };

    if (!show) return null;

    return (
        <div className="modal fade show" style={{
            display: 'block',
            backgroundColor: 'rgba(0,0,0,0.5)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1050
        }}>
            <div className="modal-dialog modal-xl" style={{
                maxWidth: '95%',
                height: '95%',
                margin: '2.5% auto'
            }}>
                <div className="modal-content" style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Modal Header */}
                    <div className="modal-header" style={{
                        background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                        color: 'white',
                        borderBottom: '3px solid #1f618d'
                    }}>
                        <h5 className="modal-title" style={{ fontWeight: '700', fontSize: '1.3rem' }}>
                            👥 ACCOUNTS MANAGEMENT
                        </h5>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={handleClose}
                            style={{ filter: 'brightness(0) invert(1)' }}
                        ></button>
                    </div>

                    {/* Modal Body */}
                    <div className="modal-body" style={{
                        flex: 1,
                        padding: 0,
                        overflow: 'hidden'
                    }}>
                        <div className="ims-container" style={{
                            background: '#ecf0f1',
                            height: '100%',
                            display: 'flex'
                        }}>
                            {/* Left Column - Add Account Form */}
                            <div className="col-lg-6" style={{
                                background: 'white',
                                borderRight: '3px solid #bdc3c7',
                                padding: '20px',
                                overflowY: 'auto'
                            }}>
                                <div className="card h-100 shadow-lg" style={{ border: 'none' }}>
                                    <div className="card-body">
                                        <h1 className="text-center" style={{ 
                                            textDecoration: 'underline',
                                            color: '#2c3e50',
                                            fontSize: '1.5rem',
                                            marginBottom: '20px'
                                        }}>
                                            {currentAccount ? `Edit Account: ${currentAccount.name}` : 'Create Accounts'}
                                        </h1>
                                        <Form onSubmit={handleSubmit} id="addAccountForm">
                                            {/* Form fields remain the same */}
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
                                                        style={{
                                                            border: '2px solid #3498db',
                                                            borderRadius: '8px',
                                                            padding: '10px'
                                                        }}
                                                    />
                                                </div>
                                                <div className="col-md-4">
                                                    <Form.Label>Account Group <span className="text-danger">*</span></Form.Label>
                                                    <Form.Select
                                                        name="companyGroups"
                                                        value={formData.companyGroups}
                                                        onChange={handleFormChange}
                                                        required
                                                        style={{
                                                            border: '2px solid #3498db',
                                                            borderRadius: '8px',
                                                            padding: '10px'
                                                        }}
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
                                                        style={{
                                                            border: '2px solid #bdc3c7',
                                                            borderRadius: '8px',
                                                            padding: '10px',
                                                            marginBottom: '5px'
                                                        }}
                                                    />
                                                    <Form.Select
                                                        name="openingBalance.type"
                                                        value={formData.openingBalance.type}
                                                        onChange={handleFormChange}
                                                        disabled={!data.isInitialFiscalYear}
                                                        style={{
                                                            border: '2px solid #bdc3c7',
                                                            borderRadius: '8px',
                                                            padding: '10px'
                                                        }}
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
                                                        style={{
                                                            border: '2px solid #bdc3c7',
                                                            borderRadius: '8px',
                                                            padding: '10px'
                                                        }}
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
                                                        style={{
                                                            border: '2px solid #bdc3c7',
                                                            borderRadius: '8px',
                                                            padding: '10px'
                                                        }}
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
                                                        style={{
                                                            border: '2px solid #bdc3c7',
                                                            borderRadius: '8px',
                                                            padding: '10px'
                                                        }}
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
                                                        style={{
                                                            border: '2px solid #bdc3c7',
                                                            borderRadius: '8px',
                                                            padding: '10px'
                                                        }}
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
                                                        style={{
                                                            border: '2px solid #bdc3c7',
                                                            borderRadius: '8px',
                                                            padding: '10px'
                                                        }}
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
                                                        style={{
                                                            border: '2px solid #bdc3c7',
                                                            borderRadius: '8px',
                                                            padding: '10px',
                                                            textTransform: 'lowercase'
                                                        }}
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
                                                        style={{
                                                            border: '2px solid #bdc3c7',
                                                            borderRadius: '8px',
                                                            padding: '10px'
                                                        }}
                                                    />
                                                </div>
                                            </Form.Group>

                                            <div className="d-flex justify-content-between">
                                                {currentAccount ? (
                                                    <Button
                                                        variant="secondary"
                                                        onClick={resetForm}
                                                        disabled={isSaving}
                                                        style={{
                                                            borderRadius: '8px',
                                                            padding: '10px 20px',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        <FiX className="me-1" /> Cancel
                                                    </Button>
                                                ) : (
                                                    <div></div>
                                                )}
                                                <Button 
                                                    variant="primary" 
                                                    type="submit" 
                                                    disabled={isSaving}
                                                    style={{
                                                        borderRadius: '8px',
                                                        padding: '10px 20px',
                                                        fontWeight: '600',
                                                        background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
                                                        border: 'none'
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
                                                        <>
                                                            <FiPlus className="me-1" /> Add Account
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                            <small className="ms-2 text-muted">To Save Press Alt+S</small>
                                        </Form>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Existing Accounts with Enhanced Navigation */}
                            <div className="col-lg-6" style={{
                                padding: '20px',
                                overflowY: 'auto'
                            }}>
                                <div className="card h-100 shadow-lg" style={{ 
                                    border: 'none',
                                    height: '100%'
                                }}>
                                    <div className="card-body">
                                        <h1 className="text-center" style={{ 
                                            textDecoration: 'underline',
                                            color: '#2c3e50',
                                            fontSize: '1.5rem',
                                            marginBottom: '20px'
                                        }}>Existing Accounts</h1>

                                        {/* Enhanced Controls Bar */}
                                        <div className="row mb-3">
                                            <div className="col-2">
                                                <Button 
                                                    variant="primary" 
                                                    onClick={handleClose}
                                                    style={{
                                                        borderRadius: '8px',
                                                        padding: '8px 15px',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    <FiArrowLeft /> Back
                                                </Button>
                                            </div>
                                            <div className="col-1">
                                                <Button 
                                                    variant="primary" 
                                                    onClick={printAccounts}
                                                    style={{
                                                        borderRadius: '8px',
                                                        padding: '8px 15px',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    <FiPrinter />
                                                </Button>
                                            </div>
                                            <div className="col">
                                                <InputGroup>
                                                    <InputGroup.Text style={{ 
                                                        background: '#3498db', 
                                                        color: 'white',
                                                        border: '2px solid #3498db'
                                                    }}>
                                                        <FiSearch />
                                                    </InputGroup.Text>
                                                    <Form.Control
                                                        ref={searchInputRef}
                                                        type="text"
                                                        placeholder="Search accounts by name..."
                                                        value={searchTerm}
                                                        onChange={handleSearch}
                                                        style={{
                                                            border: '2px solid #3498db',
                                                            borderRadius: '0 8px 8px 0',
                                                            padding: '10px'
                                                        }}
                                                    />
                                                </InputGroup>
                                            </div>
                                        </div>

                                        {/* Navigation Controls */}
                                        <div className="row mb-3">
                                            <div className="col-md-6">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="small text-muted">Show:</span>
                                                    <Form.Select
                                                        size="sm"
                                                        value={itemsPerPage}
                                                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                                        style={{ width: '80px' }}
                                                    >
                                                        <option value={10}>10</option>
                                                        <option value={20}>20</option>
                                                        <option value={50}>50</option>
                                                        <option value={100}>100</option>
                                                    </Form.Select>
                                                    <span className="small text-muted">
                                                        {filteredAccounts.length} accounts
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="d-flex justify-content-end align-items-center gap-2">
                                                    <Button
                                                        variant="outline-secondary"
                                                        size="sm"
                                                        onClick={() => handlePageNavigation('prev')}
                                                        disabled={currentPage === 1}
                                                    >
                                                        <FiChevronLeft />
                                                    </Button>
                                                    <span className="small">
                                                        Page {currentPage} of {totalPages}
                                                    </span>
                                                    <Button
                                                        variant="outline-secondary"
                                                        size="sm"
                                                        onClick={() => handlePageNavigation('next')}
                                                        disabled={currentPage === totalPages}
                                                    >
                                                        <FiChevronRight />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Keyboard Shortcuts Info */}
                                        <div className="row mb-2">
                                            <div className="col-12">
                                                <small className="text-muted">
                                                    <strong>Navigation:</strong> ↑↓ Arrow Keys • 
                                                    <strong> Edit:</strong> Enter • 
                                                    <strong> Delete:</strong> Del • 
                                                    <strong> Search:</strong> F2
                                                </small>
                                            </div>
                                        </div>

                                        {/* Accounts Table with Enhanced Navigation */}
                                        <div 
                                            ref={tableContainerRef}
                                            style={{ 
                                                maxHeight: 'calc(100% - 180px)', 
                                                overflowY: 'auto',
                                                borderRadius: '8px',
                                                border: '1px solid #dee2e6'
                                            }}
                                        >
                                            {loading ? (
                                                <div className="text-center" style={{ padding: '40px' }}>
                                                    <Spinner animation="border" role="status" variant="primary">
                                                        <span className="visually-hidden">Loading...</span>
                                                    </Spinner>
                                                    <p style={{ marginTop: '10px', color: '#7f8c8d' }}>Loading accounts...</p>
                                                </div>
                                            ) : filteredAccounts.length === 0 ? (
                                                <div className="text-center" style={{ padding: '40px', color: '#7f8c8d' }}>
                                                    {searchTerm ? 'No matching accounts found' : 'No accounts available'}
                                                </div>
                                            ) : (
                                                <Table striped bordered hover style={{ margin: 0 }}>
                                                    <thead style={{
                                                        background: 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)',
                                                        color: 'white',
                                                        position: 'sticky',
                                                        top: 0,
                                                        zIndex: 10
                                                    }}>
                                                        <tr>
                                                            <th style={{ 
                                                                padding: '12px 8px',
                                                                fontWeight: '600',
                                                                borderRight: '1px solid #46627f',
                                                                width: '5%'
                                                            }}>#</th>
                                                            <th style={{ 
                                                                padding: '12px 8px',
                                                                fontWeight: '600',
                                                                borderRight: '1px solid #46627f',
                                                                width: '50%'
                                                            }}>Account Name</th>
                                                            <th style={{ 
                                                                padding: '12px 8px',
                                                                fontWeight: '600',
                                                                borderRight: '1px solid #46627f',
                                                                width: '25%'
                                                            }}>Account Group</th>
                                                            <th style={{ 
                                                                padding: '12px 8px',
                                                                fontWeight: '600',
                                                                width: '20%'
                                                            }}>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody ref={tableBodyRef}>
                                                        {currentItems.map((account, index) => (
                                                            <tr 
                                                                key={account._id} 
                                                                data-row-index={index}
                                                                onClick={() => handleRowClick(index, account)}
                                                                style={{
                                                                    transition: 'background-color 0.2s ease',
                                                                    background: index === selectedRowIndex ? '#e3f2fd' : 'transparent',
                                                                    cursor: 'pointer'
                                                                }}
                                                                className={index === selectedRowIndex ? 'selected-row' : ''}
                                                            >
                                                                <td style={{ padding: '12px 8px', fontWeight: '600' }}>
                                                                    {startIndex + index + 1}
                                                                </td>
                                                                <td style={{ padding: '12px 8px' }}>
                                                                    <strong style={{ color: '#2c3e50' }}>
                                                                        {account.name}
                                                                    </strong>
                                                                </td>
                                                                <td style={{ padding: '12px 8px' }}>
                                                                    <small style={{ color: '#7f8c8d' }}>
                                                                        {account.companyGroups?.name || 'No Group'}
                                                                    </small>
                                                                </td>
                                                                <td style={{ padding: '12px 8px' }}>
                                                                    <Button
                                                                        variant="info"
                                                                        size="sm"
                                                                        className="me-2"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigate(`/retailer/companies/${account._id}`);
                                                                        }}
                                                                        style={{ borderRadius: '6px' }}
                                                                    >
                                                                        <FiEye />
                                                                    </Button>
                                                                    {data.isAdminOrSupervisor && (
                                                                        <>
                                                                            <Button
                                                                                variant="warning"
                                                                                size="sm"
                                                                                className="me-2"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleEdit(account);
                                                                                }}
                                                                                disabled={!!currentAccount}
                                                                                style={{ borderRadius: '6px' }}
                                                                            >
                                                                                <FiEdit2 />
                                                                            </Button>
                                                                            <Button
                                                                                variant="danger"
                                                                                size="sm"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDelete(account._id);
                                                                                }}
                                                                                disabled={!!currentAccount}
                                                                                style={{ borderRadius: '6px' }}
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

                                        {/* Bottom Navigation Controls */}
                                        {filteredAccounts.length > 0 && (
                                            <div className="row mt-3">
                                                <div className="col-12">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <small className="text-muted">
                                                            Showing {startIndex + 1} to {Math.min(endIndex, filteredAccounts.length)} of {filteredAccounts.length} accounts
                                                        </small>
                                                        <div className="d-flex gap-2">
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                onClick={() => handleRowNavigation('up')}
                                                                disabled={selectedRowIndex <= 0}
                                                            >
                                                                <FiArrowUp /> Prev
                                                            </Button>
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                onClick={() => handleRowNavigation('down')}
                                                                disabled={selectedRowIndex >= currentItems.length - 1}
                                                            >
                                                                <FiArrowDown /> Next
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
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
                        handleSubmit();
                        setShowSaveConfirmModal(false);
                    }}>
                        Save
                    </Button>
                </Modal.Footer>
            </Modal>

            <NotificationToast
                message={notificationMessage}
                type={notificationType}
                show={showNotification}
                onClose={() => setShowNotification(false)}
            />
        </div>
    );
};

export default AccountsModal;