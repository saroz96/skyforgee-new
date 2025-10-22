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

// const MainUnits = () => {
//     const navigate = useNavigate();
//     const [mainUnits, setMainUnits] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [searchTerm, setSearchTerm] = useState('');
//     const [currentUnit, setCurrentUnit] = useState(null);
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
//         fetchMainUnits();
//     }, []);

//     const fetchMainUnits = async () => {
//         try {
//             setLoading(true);
//             const response = await api.get('/api/retailer/mainUnits');

//             if (response.data.success) {
//                 setMainUnits(response.data.data.mainUnits || []);
//                 setCompanyData(response.data.data.company);
//                 setCurrentFiscalYear(response.data.data.currentFiscalYear);
//             } else {
//                 throw new Error(response.data.error || 'Failed to fetch main units');
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
//                     errorMessage = error.response.data.error || 'Main unit already exists';
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

//     const filteredUnits = mainUnits
//         .filter(unit => unit?.name?.toLowerCase().includes(searchTerm))
//         .sort((a, b) => a.name.localeCompare(b.name));

//     const handleEdit = (unit) => {
//         setCurrentUnit(unit);
//         setFormData({ name: unit.name });
//     };

//     const handleCancel = () => {
//         setCurrentUnit(null);
//         setFormData({ name: '' });
//     };

//     const handleDelete = async (id) => {
//         if (window.confirm('Are you sure you want to delete this main unit?')) {
//             try {
//                 const response = await api.delete(`/api/retailer/mainUnits/${id}`);

//                 if (response.data.success) {
//                     showNotificationMessage('Main unit deleted successfully', 'success');
//                     fetchMainUnits();
//                 } else {
//                     showNotificationMessage(response.data.error || 'Failed to delete main unit', 'error');
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
//             if (currentUnit) {
//                 // Update existing unit
//                 await api.put(`/api/retailer/mainUnits/${currentUnit._id}`, formData);
//                 showNotificationMessage('Main unit updated successfully!', 'success');
//             } else {
//                 // Create new unit
//                 await api.post('/api/retailer/mainUnits', formData);
//                 showNotificationMessage('Main unit created successfully!', 'success');
//             }
//             fetchMainUnits();
//             handleCancel();
//         } catch (err) {
//             handleApiError(err);
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     const printUnits = () => {
//         const printWindow = window.open('', '_blank');
//         printWindow.document.write(`
//             <html>
//                 <head>
//                     <title>Main Units Report</title>
//                     <style>
//                         table { width: 100%; border-collapse: collapse; }
//                         th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
//                         th { background-color: #f2f2f2; }
//                         h1, h2 { text-align: center; }
//                     </style>
//                 </head>
//                 <body>
//                     <h1>Main Units Report</h1>
//                     <h2>${companyData?.name || 'Company'}</h2>
//                     <table>
//                         <thead>
//                             <tr>
//                                 <th>S.N.</th>
//                                 <th>Unit Name</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             ${mainUnits.map((unit, index) => `
//                                 <tr>
//                                     <td>${index + 1}</td>
//                                     <td>${unit.name}</td>
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
//                     Error loading main units: {error}
//                     <Button variant="secondary" onClick={fetchMainUnits} className="ms-3">
//                         Retry
//                     </Button>
//                 </div>
//             ) : (
//                 <div className="row g-3">
//                     {/* Left Column - Add/Edit Unit Form */}
//                     <div className="col-lg-6">
//                         <div className="card h-100 shadow-lg">
//                             <div className="card-body">
//                                 <h1 className="text-center">
//                                     {currentUnit ? `Edit Unit: ${currentUnit.name}` : 'Add New Main Unit'}
//                                 </h1>
//                                 <Form onSubmit={handleSubmit}>
//                                     <Form.Group className="mb-3">
//                                         <Form.Label>Unit Name <span className="text-danger">*</span></Form.Label>
//                                         <Form.Control
//                                             type="text"
//                                             name="name"
//                                             value={formData.name}
//                                             onChange={handleFormChange}
//                                             placeholder="Enter unit (e.g., kg, liters, pieces)"
//                                             required
//                                             autoFocus
//                                             autoComplete="off"
//                                         />
//                                     </Form.Group>
//                                     <div className="d-flex justify-content-between">
//                                         {currentUnit ? (
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
//                                             ) : currentUnit ? (
//                                                 <>
//                                                     <FiCheck className="me-1" /> Save Changes
//                                                 </>
//                                             ) : (
//                                                 'Add Unit'
//                                             )}
//                                         </Button>
//                                     </div>
//                                 </Form>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Right Column - Existing Units */}
//                     <div className="col-lg-6">
//                         <div className="card h-100 shadow-lg" style={{ height: '600px' }}>
//                             <div className="card-body">
//                                 <h1 className="text-center">Existing Main Units</h1>

//                                 <div className="row mb-3">
//                                     <div className="col-2">
//                                         <Button variant="primary" onClick={() => navigate(-1)}>
//                                             <FiArrowLeft /> Back
//                                         </Button>
//                                     </div>
//                                     <div className="col-1">
//                                         <Button variant="primary" onClick={printUnits}>
//                                             <FiPrinter />
//                                         </Button>
//                                     </div>
//                                     <div className="col">
//                                         <Form.Control
//                                             type="text"
//                                             placeholder="Search units by name..."
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
//                                             <p>Loading main units...</p>
//                                         </div>
//                                     ) : filteredUnits.length === 0 ? (
//                                         <div className="text-center">
//                                             {searchTerm ? 'No matching units found' : 'No main units available'}
//                                         </div>
//                                     ) : (
//                                         <Table striped bordered hover>
//                                             <thead>
//                                                 <tr>
//                                                     <th>Unit Name</th>
//                                                     <th>Actions</th>
//                                                 </tr>
//                                             </thead>
//                                             <tbody>
//                                                 {filteredUnits.map((unit, index) => (
//                                                     <tr key={unit._id}>
//                                                         <td>
//                                                             <strong>
//                                                                 {index + 1}. {unit.name}
//                                                             </strong>
//                                                         </td>
//                                                         <td>
//                                                             <Button
//                                                                 variant="warning"
//                                                                 size="sm"
//                                                                 className="me-2"
//                                                                 onClick={() => handleEdit(unit)}
//                                                                 disabled={!!currentUnit}
//                                                             >
//                                                                 <FiEdit2 />
//                                                             </Button>
//                                                             <Button
//                                                                 variant="danger"
//                                                                 size="sm"
//                                                                 onClick={() => handleDelete(unit._id)}
//                                                                 disabled={!!currentUnit}
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

// export default MainUnits;

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

const MainUnits = () => {
    const navigate = useNavigate();
    const [mainUnits, setMainUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUnit, setCurrentUnit] = useState(null);
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
        fetchMainUnits();
    }, []);

    const fetchMainUnits = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/retailer/mainUnits');

            if (response.data.success) {
                setMainUnits(response.data.data.mainUnits || []);
                setCompanyData(response.data.data.company);
                setCurrentFiscalYear(response.data.data.currentFiscalYear);
            } else {
                throw new Error(response.data.error || 'Failed to fetch main units');
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
                    errorMessage = error.response.data.error || 'Main unit already exists';
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

    const filteredUnits = mainUnits
        .filter(unit => unit?.name?.toLowerCase().includes(searchTerm))
        .sort((a, b) => a.name.localeCompare(b.name));

    const handleEdit = (unit) => {
        setCurrentUnit(unit);
        setFormData({ name: unit.name });
    };

    const handleCancel = () => {
        setCurrentUnit(null);
        setFormData({ name: '' });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this main unit?')) {
            try {
                const response = await api.delete(`/api/retailer/mainUnits/${id}`);

                if (response.data.success) {
                    showNotificationMessage('Main unit deleted successfully', 'success');
                    fetchMainUnits();
                } else {
                    showNotificationMessage(response.data.error || 'Failed to delete main unit', 'error');
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
            if (currentUnit) {
                // Update existing unit
                await api.put(`/api/retailer/mainUnits/${currentUnit._id}`, formData);
                showNotificationMessage('Main unit updated successfully!', 'success');
            } else {
                // Create new unit
                await api.post('/api/retailer/mainUnits', formData);
                showNotificationMessage('Main unit created successfully!', 'success');
            }
            fetchMainUnits();
            handleCancel();
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsSaving(false);
        }
    };

    const printUnits = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Main Units Report</title>
                    <style>
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        h1, h2 { text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>Main Units Report</h1>
                    <h2>${companyData?.name || 'Company'}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>S.N.</th>
                                <th>Unit Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mainUnits.map((unit, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${unit.name}</td>
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
                    Error loading main units: {error}
                    <Button variant="secondary" onClick={fetchMainUnits} className="ms-3">
                        Retry
                    </Button>
                </div>
            ) : (
                <div className="row g-3">
                    {/* Left Column - Add/Edit Unit Form */}
                    <div className="col-lg-6">
                        <div className="card h-100 shadow-lg">
                            <div className="card-body">
                                <h1 className="text-center" style={{ textDecoration: 'underline' }}>
                                    {currentUnit ? `Edit Unit: ${currentUnit.name}` : 'Add New Main Unit'}
                                </h1>
                                <Form onSubmit={handleSubmit} id="addMainUnitForm"> {/* Add an ID to the form */}
                                    <Form.Group className="mb-3">
                                        <Form.Label>Unit Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleFormChange}
                                            placeholder="Enter unit (e.g., kg, liters, pieces)"
                                            required
                                            autoFocus
                                            autoComplete="off"
                                        />
                                    </Form.Group>
                                    <div className="d-flex justify-content-between">
                                        {currentUnit ? (
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
                                            ) : currentUnit ? (
                                                <>
                                                    <FiCheck className="me-1" /> Save Changes
                                                </>
                                            ) : (
                                                'Add Unit'
                                            )}
                                        </Button>
                                    </div>
                                    <small className="ms-2">To Save Press Alt+S</small> {/* Add shortcut hint */}
                                </Form>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Existing Units */}
                    <div className="col-lg-6">
                        <div className="card h-100 shadow-lg" style={{ height: '600px' }}>
                            <div className="card-body">
                                <h1 className="text-center" style={{ textDecoration: 'underline' }}>Existing Main Units</h1>

                                <div className="row mb-3">
                                    <div className="col-2">
                                        <Button variant="primary" onClick={() => navigate(-1)}>
                                            <FiArrowLeft /> Back
                                        </Button>
                                    </div>
                                    <div className="col-1">
                                        <Button variant="primary" onClick={printUnits}>
                                            <FiPrinter />
                                        </Button>
                                    </div>
                                    <div className="col">
                                        <Form.Control
                                            type="text"
                                            placeholder="Search units by name..."
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
                                            <p>Loading main units...</p>
                                        </div>
                                    ) : filteredUnits.length === 0 ? (
                                        <div className="text-center">
                                            {searchTerm ? 'No matching units found' : 'No main units available'}
                                        </div>
                                    ) : (
                                        <Table striped bordered hover>
                                            <thead>
                                                <tr>
                                                    <th>Unit Name</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredUnits.map((unit, index) => (
                                                    <tr key={unit._id}>
                                                        <td>
                                                            <strong>
                                                                {index + 1}. {unit.name}
                                                            </strong>
                                                        </td>
                                                        <td>
                                                            <Button
                                                                variant="warning"
                                                                size="sm"
                                                                className="me-2"
                                                                onClick={() => handleEdit(unit)}
                                                                disabled={!!currentUnit}
                                                            >
                                                                <FiEdit2 />
                                                            </Button>
                                                            <Button
                                                                variant="danger"
                                                                size="sm"
                                                                onClick={() => handleDelete(unit._id)}
                                                                disabled={!!currentUnit}
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
                    <p>Are you sure you want to save this main unit?</p>
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

export default MainUnits;