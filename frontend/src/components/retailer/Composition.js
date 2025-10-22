// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';
// import { FiEdit2, FiTrash2, FiPrinter, FiArrowLeft, FiX, FiCheck } from 'react-icons/fi';
// import Button from 'react-bootstrap/Button';
// import Form from 'react-bootstrap/Form';
// import Table from 'react-bootstrap/Table';
// import Spinner from 'react-bootstrap/Spinner';
// import Header from '../retailer/Header';
// import NotificationToast from '../NotificationToast';
// import ProductModal from './dashboard/modals/ProductModal';

// const Compositions = () => {
//     const navigate = useNavigate();
//     const [compositions, setCompositions] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [searchTerm, setSearchTerm] = useState('');
//     const [currentComposition, setCurrentComposition] = useState(null);
//     const [formData, setFormData] = useState({ name: '' });
//     const [isSaving, setIsSaving] = useState(false);
//     const [showNotification, setShowNotification] = useState(false);
//     const [notificationMessage, setNotificationMessage] = useState('');
//     const [notificationType, setNotificationType] = useState('');
//     const [companyData, setCompanyData] = useState(null);
//     const [currentFiscalYear, setCurrentFiscalYear] = useState(null);
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

//     useEffect(() => {
//         fetchCompositions();
//     }, []);

//     const fetchCompositions = async () => {
//         try {
//             setLoading(true);
//             const response = await api.get('/api/retailer/compositions');

//             if (response.data.success) {
//                 setCompositions(response.data.data.compositions || []);
//                 setCompanyData(response.data.data.company);
//                 setCurrentFiscalYear(response.data.data.currentFiscalYear);
//             } else {
//                 throw new Error(response.data.error || 'Failed to fetch compositions');
//             }
//         } catch (err) {
//             setError(err.message);
//             handleApiError(err);
//         } finally {
//             setLoading(false);
//         }
//     };

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
//                     errorMessage = error.response.data.error || 'Composition already exists';
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

//     const filteredCompositions = compositions
//         .filter(comp => comp?.name?.toLowerCase().includes(searchTerm))
//         .sort((a, b) => a.name.localeCompare(b.name));

//     const handleEdit = (composition) => {
//         setCurrentComposition(composition);
//         setFormData({ name: composition.name });
//     };

//     const handleCancel = () => {
//         setCurrentComposition(null);
//         setFormData({ name: '' });
//     };

//     const handleDelete = async (id) => {
//         if (window.confirm('Are you sure you want to delete this composition?')) {
//             try {
//                 const response = await api.delete(`/api/retailer/compositions/${id}`);

//                 if (response.data.success) {
//                     showNotificationMessage('Composition deleted successfully', 'success');
//                     fetchCompositions();
//                 } else {
//                     showNotificationMessage(response.data.error || 'Failed to delete composition', 'error');
//                 }
//             } catch (err) {
//                 handleApiError(err);
//             }
//         }
//     };

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
//             if (currentComposition) {
//                 // Update existing composition
//                 await api.put(`/api/retailer/compositions/${currentComposition._id}`, formData);
//                 showNotificationMessage('Composition updated successfully!', 'success');
//             } else {
//                 // Create new composition
//                 await api.post('/api/retailer/compositions', formData);
//                 showNotificationMessage('Composition created successfully!', 'success');
//             }
//             fetchCompositions();
//             handleCancel();
//         } catch (err) {
//             handleApiError(err);
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     const printCompositions = () => {
//         const printWindow = window.open('', '_blank');
//         printWindow.document.write(`
//             <html>
//                 <head>
//                     <title>Compositions Report</title>
//                     <style>
//                         table { width: 100%; border-collapse: collapse; }
//                         th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
//                         th { background-color: #f2f2f2; }
//                         h1, h2 { text-align: center; }
//                     </style>
//                 </head>
//                 <body>
//                     <h1>Compositions Report</h1>
//                     <h2>${companyData?.name || 'Company'}</h2>
//                     <table>
//                         <thead>
//                             <tr>
//                                 <th>S.N.</th>
//                                 <th>Composition Name</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             ${compositions.map((comp, index) => `
//                                 <tr>
//                                     <td>${index + 1}</td>
//                                     <td>${comp.name}</td>
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
//                     Error loading compositions: {error}
//                     <Button variant="secondary" onClick={fetchCompositions} className="ms-3">
//                         Retry
//                     </Button>
//                 </div>
//             ) : (
//                 <div className="row g-3">
//                     {/* Left Column - Add/Edit Composition Form */}
//                     <div className="col-lg-6">
//                         <div className="card h-100 shadow-lg">
//                             <div className="card-body">
//                                 <h1 className="text-center">
//                                     {currentComposition ? `Edit Composition: ${currentComposition.name}` : 'Add New Composition'}
//                                 </h1>
//                                 <Form onSubmit={handleSubmit}>
//                                     <Form.Group className="mb-3">
//                                         <Form.Label>Composition Name <span className="text-danger">*</span></Form.Label>
//                                         <Form.Control
//                                             type="text"
//                                             name="name"
//                                             value={formData.name}
//                                             onChange={handleFormChange}
//                                             placeholder="Enter composition"
//                                             required
//                                             autoFocus
//                                             autoComplete="off"
//                                         />
//                                     </Form.Group>
//                                     <div className="d-flex justify-content-between">
//                                         {currentComposition ? (
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
//                                             ) : currentComposition ? (
//                                                 <>
//                                                     <FiCheck className="me-1" /> Save Changes
//                                                 </>
//                                             ) : (
//                                                 'Add Composition'
//                                             )}
//                                         </Button>
//                                     </div>
//                                 </Form>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Right Column - Existing Compositions */}
//                     <div className="col-lg-6">
//                         <div className="card h-100 shadow-lg" style={{ height: '600px' }}>
//                             <div className="card-body">
//                                 <h1 className="text-center">Existing Compositions</h1>

//                                 <div className="row mb-3">
//                                     <div className="col-2">
//                                         <Button variant="primary" onClick={() => navigate(-1)}>
//                                             <FiArrowLeft /> Back
//                                         </Button>
//                                     </div>
//                                     <div className="col-1">
//                                         <Button variant="primary" onClick={printCompositions}>
//                                             <FiPrinter />
//                                         </Button>
//                                     </div>
//                                     <div className="col">
//                                         <Form.Control
//                                             type="text"
//                                             placeholder="Search compositions by name..."
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
//                                             <p>Loading compositions...</p>
//                                         </div>
//                                     ) : filteredCompositions.length === 0 ? (
//                                         <div className="text-center">
//                                             {searchTerm ? 'No matching compositions found' : 'No compositions available'}
//                                         </div>
//                                     ) : (
//                                         <Table striped bordered hover>
//                                             <thead>
//                                                 <tr>
//                                                     <th>Composition Name</th>
//                                                     <th>Actions</th>
//                                                 </tr>
//                                             </thead>
//                                             <tbody>
//                                                 {filteredCompositions.map((comp, index) => (
//                                                     <tr key={comp._id}>
//                                                         <td>
//                                                             <strong>
//                                                                 {index + 1}. {comp.name}
//                                                             </strong>
//                                                         </td>
//                                                         <td>
//                                                             <Button
//                                                                 variant="warning"
//                                                                 size="sm"
//                                                                 className="me-2"
//                                                                 onClick={() => handleEdit(comp)}
//                                                                 disabled={!!currentComposition}
//                                                             >
//                                                                 <FiEdit2 />
//                                                             </Button>
//                                                             <Button
//                                                                 variant="danger"
//                                                                 size="sm"
//                                                                 onClick={() => handleDelete(comp._id)}
//                                                                 disabled={!!currentComposition}
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

// export default Compositions;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPrinter, FiArrowLeft, FiX, FiCheck } from 'react-icons/fi';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import Header from '../retailer/Header';
import NotificationToast from '../NotificationToast';
import ProductModal from './dashboard/modals/ProductModal';
import Modal from 'react-bootstrap/Modal'; // Import Modal

const Compositions = () => {
    const navigate = useNavigate();
    const [compositions, setCompositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentComposition, setCurrentComposition] = useState(null);
    const [formData, setFormData] = useState({ name: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState('');
    const [companyData, setCompanyData] = useState(null);
    const [currentFiscalYear, setCurrentFiscalYear] = useState(null);
    const [showProductModal, setShowProductModal] = useState(false);
    const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false); // Add state for save confirm modal

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
        fetchCompositions();
    }, []);

    const fetchCompositions = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/retailer/compositions');

            if (response.data.success) {
                setCompositions(response.data.data.compositions || []);
                setCompanyData(response.data.data.company);
                setCurrentFiscalYear(response.data.data.currentFiscalYear);
            } else {
                throw new Error(response.data.error || 'Failed to fetch compositions');
            }
        } catch (err) {
            setError(err.message);
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
                    errorMessage = error.response.data.error || 'Invalid request';
                    break;
                case 401:
                    navigate('/login');
                    return;
                case 403:
                    navigate('/dashboard');
                    return;
                case 409:
                    errorMessage = error.response.data.error || 'Composition already exists';
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

    const filteredCompositions = compositions
        .filter(comp => comp?.name?.toLowerCase().includes(searchTerm))
        .sort((a, b) => a.name.localeCompare(b.name));

    const handleEdit = (composition) => {
        setCurrentComposition(composition);
        setFormData({ name: composition.name });
    };

    const handleCancel = () => {
        setCurrentComposition(null);
        setFormData({ name: '' });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this composition?')) {
            try {
                const response = await api.delete(`/api/retailer/compositions/${id}`);

                if (response.data.success) {
                    showNotificationMessage('Composition deleted successfully', 'success');
                    fetchCompositions();
                } else {
                    showNotificationMessage(response.data.error || 'Failed to delete composition', 'error');
                }
            } catch (err) {
                handleApiError(err);
            }
        }
    };

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
        if (e) { // Only prevent default if event object exists (i.e., not called from modal)
            e.preventDefault();
        }
        setIsSaving(true);
        try {
            if (currentComposition) {
                // Update existing composition
                await api.put(`/api/retailer/compositions/${currentComposition._id}`, formData);
                showNotificationMessage('Composition updated successfully!', 'success');
            } else {
                // Create new composition
                await api.post('/api/retailer/compositions', formData);
                showNotificationMessage('Composition created successfully!', 'success');
            }
            fetchCompositions();
            handleCancel();
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsSaving(false);
        }
    };

    const printCompositions = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Compositions Report</title>
                    <style>
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        h1, h2 { text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>Compositions Report</h1>
                    <h2>${companyData?.name || 'Company'}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>S.N.</th>
                                <th>Composition Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${compositions.map((comp, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${comp.name}</td>
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
                setShowSaveConfirmModal(true); // Show confirmation modal on Alt+S
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
                    Error loading compositions: {error}
                    <Button variant="secondary" onClick={fetchCompositions} className="ms-3">
                        Retry
                    </Button>
                </div>
            ) : (
                <div className="row g-3">
                    {/* Left Column - Add/Edit Composition Form */}
                    <div className="col-lg-6">
                        <div className="card h-100 shadow-lg">
                            <div className="card-body">
                                <h1 className="text-center" style={{ textDecoration: 'underline' }}>
                                    {currentComposition ? `Edit Composition: ${currentComposition.name}` : 'Add New Composition'}
                                </h1>
                                <Form onSubmit={handleSubmit} id="addCompositionForm"> {/* Add an ID to the form */}
                                    <Form.Group className="mb-3">
                                        <Form.Label>Composition Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleFormChange}
                                            placeholder="Enter composition"
                                            required
                                            autoFocus
                                            autoComplete="off"
                                        />
                                    </Form.Group>
                                    <div className="d-flex justify-content-between">
                                        {currentComposition ? (
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
                                            ) : currentComposition ? (
                                                <>
                                                    <FiCheck className="me-1" /> Save Changes
                                                </>
                                            ) : (
                                                'Add Composition'
                                            )}
                                        </Button>
                                    </div>
                                    <small className="ms-2">To Save Press Alt+S</small> {/* Add shortcut hint */}
                                </Form>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Existing Compositions */}
                    <div className="col-lg-6">
                        <div className="card h-100 shadow-lg" style={{ height: '600px' }}>
                            <div className="card-body">
                                <h1 className="text-center" style={{ textDecoration: 'underline' }}>Existing Compositions</h1>

                                <div className="row mb-3">
                                    <div className="col-2">
                                        <Button variant="primary" onClick={() => navigate(-1)}>
                                            <FiArrowLeft /> Back
                                        </Button>
                                    </div>
                                    <div className="col-1">
                                        <Button variant="primary" onClick={printCompositions}>
                                            <FiPrinter />
                                        </Button>
                                    </div>
                                    <div className="col">
                                        <Form.Control
                                            type="text"
                                            placeholder="Search compositions by name..."
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
                                            <p>Loading compositions...</p>
                                        </div>
                                    ) : filteredCompositions.length === 0 ? (
                                        <div className="text-center">
                                            {searchTerm ? 'No matching compositions found' : 'No compositions available'}
                                        </div>
                                    ) : (
                                        <Table striped bordered hover>
                                            <thead>
                                                <tr>
                                                    <th>Composition Name</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCompositions.map((comp, index) => (
                                                    <tr key={comp._id}>
                                                        <td>
                                                            <strong>
                                                                {index + 1}. {comp.name}
                                                            </strong>
                                                        </td>
                                                        <td>
                                                            <Button
                                                                variant="warning"
                                                                size="sm"
                                                                className="me-2"
                                                                onClick={() => handleEdit(comp)}
                                                                disabled={!!currentComposition}
                                                            >
                                                                <FiEdit2 />
                                                            </Button>
                                                            <Button
                                                                variant="danger"
                                                                size="sm"
                                                                onClick={() => handleDelete(comp._id)}
                                                                disabled={!!currentComposition}
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
                    <p>Are you sure you want to save this composition?</p>
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

export default Compositions;