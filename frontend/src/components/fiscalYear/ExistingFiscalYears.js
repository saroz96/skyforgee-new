import React, { useState, useEffect } from 'react';
import {
    Container,
    Card,
    Row,
    Col,
    Table,
    Button,
    Badge,
    Modal,
    Form,
    Alert
} from 'react-bootstrap';
import { FaCalendarAlt, FaCheckCircle, FaTrashAlt, FaExclamationTriangle } from 'react-icons/fa';
import axios from 'axios';
import NotificationToast from '../NotificationToast';
import Header from '../retailer/Header';

const ExistingFiscalYears = () => {
    const [fiscalYears, setFiscalYears] = useState([]);
    const [currentFiscalYear, setCurrentFiscalYear] = useState('');
    const [currentCompanyName, setCurrentCompanyName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [fiscalYearToDelete, setFiscalYearToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        fetchFiscalYears();
    }, []);

    const fetchFiscalYears = async () => {
        try {
            const response = await api.get('/api/switch-fiscal-year');
            if (response.data.success) {
                const { data } = response.data;
                setFiscalYears(data.fiscalYears || []);
                setCurrentFiscalYear(data.currentFiscalYear || '');
                setCurrentCompanyName(data.currentCompanyName || '');
            } else {
                throw new Error(response.data.error || 'Failed to fetch fiscal years');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to fetch fiscal years');
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFiscalYearChange = async (event) => {
        const fiscalYearId = event.target.value;
        const selectedOption = event.target.options[event.target.selectedIndex];
        const fiscalYearName = selectedOption.text.split(' (')[0];

        try {
            const response = await api.post('/api/switch-fiscal-year', {
                fiscalYearId
            });

            if (response.data.success) {
                setToast({
                    show: true,
                    message: `Successfully switched to ${fiscalYearName} fiscal year`,
                    type: 'success'
                });
                
                // Update current fiscal year and reload data
                setCurrentFiscalYear(fiscalYearId);
                // Optionally refetch to get updated data
                setTimeout(() => {
                    fetchFiscalYears();
                }, 1000);
            } else {
                throw new Error(response.data.error || 'Failed to change fiscal year');
            }
        } catch (err) {
            setToast({
                show: true,
                message: err.response?.data?.error || err.message || 'Failed to change fiscal year',
                type: 'error'
            });
            // Reset select to current value by refetching
            fetchFiscalYears();
        }
    };

    const confirmDeleteFiscalYear = (fiscalYear) => {
        setFiscalYearToDelete(fiscalYear);
        setShowDeleteModal(true);
    };

    // const handleDeleteFiscalYear = async () => {
    //     if (!fiscalYearToDelete) return;

    //     setDeleteLoading(true);
    //     try {
    //         const response = await api.delete(`/api/delete-fiscal-year/${fiscalYearToDelete._id}`);

    //         if (response.data.success) {
    //             setToast({
    //                 show: true,
    //                 message: 'Fiscal year deleted successfully',
    //                 type: 'success'
    //             });
    //             setShowDeleteModal(false);
    //             setFiscalYearToDelete(null);
                
    //             // Refresh the list
    //             fetchFiscalYears();
    //         } else {
    //             throw new Error(response.data.error || 'Failed to delete fiscal year');
    //         }
    //     } catch (err) {
    //         setToast({
    //             show: true,
    //             message: err.response?.data?.error || err.message || 'Failed to delete fiscal year',
    //             type: 'error'
    //         });
    //     } finally {
    //         setDeleteLoading(false);
    //     }
    // };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };

    if (loading) {
        return (
            <Container className="mt-4">
                <div className="text-center">Loading fiscal years...</div>
            </Container>
        );
    }

    if (error && fiscalYears.length === 0) {
        return (
            <Container className="mt-4">
                <Alert variant="danger">{error}</Alert>
            </Container>
        );
    }

    return (
        <div className="bg-light min-vh-100">
            <Header />
            <NotificationToast
                show={toast.show}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast({ ...toast, show: false })}
            />

            <Container className="py-4">
                <Card className="shadow border-0">
                    <Card.Body className="p-4">
                        <div className="d-flex align-items-center mb-4">
                            <FaCalendarAlt className="text-primary me-3 fs-2" />
                            <div>
                                <h2 className="mb-0">Fiscal Years Management</h2>
                                {currentCompanyName && (
                                    <small className="text-muted">
                                        for {currentCompanyName}
                                    </small>
                                )}
                            </div>
                        </div>

                        {error && (
                            <Alert variant="warning" className="mb-4">
                                {error}
                            </Alert>
                        )}

                        {/* Fiscal Year Selector */}
                        <Row className="mb-4">
                            <Col md={6}>
                                <Form.Label htmlFor="fiscalYearSelect" className="fw-bold mb-2">
                                    Change Active Fiscal Year:
                                </Form.Label>
                                <Form.Select 
                                    id="fiscalYearSelect"
                                    value={currentFiscalYear}
                                    onChange={handleFiscalYearChange}
                                    className="border-2"
                                >
                                    {fiscalYears.map(fiscalYear => (
                                        <option 
                                            key={fiscalYear._id} 
                                            value={fiscalYear._id}
                                        >
                                            {fiscalYear.name} ({formatDate(fiscalYear.startDate)} - {formatDate(fiscalYear.endDate)})
                                        </option>
                                    ))}
                                </Form.Select>
                            </Col>
                        </Row>

                        {/* Fiscal Years Table */}
                        <div className="table-responsive">
                            <Table hover className="align-middle mb-0">
                                <thead className="bg-primary text-white">
                                    <tr>
                                        <th className="ps-3">#</th>
                                        <th>Fiscal Year ID</th>
                                        <th>Name</th>
                                        <th>Start Date</th>
                                        <th>End Date</th>
                                        <th>Status</th>
                                        {/* <th className="text-center">Actions</th> */}
                                    </tr>
                                </thead>
                                <tbody>
                                    {fiscalYears.length > 0 ? (
                                        fiscalYears.map((fiscalYear, index) => (
                                            <tr key={fiscalYear._id} className={fiscalYear._id === currentFiscalYear ? 'bg-light' : ''}>
                                                <td className="ps-3 fw-medium">{index + 1}</td>
                                                <td className="text-muted small">{fiscalYear._id}</td>
                                                <td>
                                                    <strong>{fiscalYear.name}</strong>
                                                </td>
                                                <td>{formatDate(fiscalYear.startDate)}</td>
                                                <td>{formatDate(fiscalYear.endDate)}</td>
                                                <td>
                                                    <Badge 
                                                        bg={fiscalYear._id === currentFiscalYear ? 'success' : 'secondary'}
                                                        className="d-flex align-items-center justify-content-center"
                                                        style={{width: 'fit-content'}}
                                                    >
                                                        {fiscalYear._id === currentFiscalYear ? 'Active' : 'Inactive'}
                                                        {fiscalYear._id === currentFiscalYear && (
                                                            <FaCheckCircle className="ms-2" />
                                                        )}
                                                    </Badge>
                                                </td>
                                                {/* <td className="text-center">
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        onClick={() => confirmDeleteFiscalYear(fiscalYear)}
                                                        className="px-3"
                                                        disabled={fiscalYear._id === currentFiscalYear}
                                                    >
                                                        <FaTrashAlt className="me-1" />
                                                        Delete
                                                    </Button>
                                                </td> */}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="text-center py-5">
                                                <FaCalendarAlt className="text-muted mb-3 fs-1" />
                                                <p className="text-muted mb-0">No fiscal years found</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </Card.Body>
                </Card>
            </Container>

            {/* Delete Confirmation Modal */}
            {/* <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
                <Modal.Header closeButton className="bg-danger text-white">
                    <Modal.Title className="d-flex align-items-center">
                        <FaExclamationTriangle className="me-2" />
                        Confirm Deletion
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    {fiscalYearToDelete && (
                        <>
                            <p className="mb-3">
                                Are you sure you want to delete the fiscal year{' '}
                                <strong className="text-danger">"{fiscalYearToDelete.name}"</strong>?
                            </p>
                            <p className="text-danger mb-0">
                                <strong>Warning:</strong> This action cannot be undone and all associated data will be lost!
                            </p>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer className="border-0">
                    <Button 
                        variant="outline-secondary" 
                        onClick={() => setShowDeleteModal(false)}
                        disabled={deleteLoading}
                        className="px-4"
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={handleDeleteFiscalYear}
                        disabled={deleteLoading}
                        className="px-4"
                    >
                        {deleteLoading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <FaTrashAlt className="me-2" />
                                Delete Fiscal Year
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal> */}
        </div>
    );
};

export default ExistingFiscalYears;