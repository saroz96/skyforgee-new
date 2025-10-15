import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import {
    Container,
    Card,
    Row,
    Col,
    Button,
    Badge,
    Navbar,
    Nav,
    Spinner,
    Alert
} from 'react-bootstrap';
import {
    FaBuilding,
    FaInfoCircle,
    FaUserTie,
    FaCalendarAlt,
    FaEdit,
    FaTrashAlt,
    FaPlusCircle,
    FaSignOutAlt,
    FaPhone,
    FaEnvelope,
    FaTachometerAlt
} from 'react-icons/fa';
import NotificationToast from '../NotificationToast';
import Loader from '../Loader';

const CompanyDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [company, setCompany] = useState(null);
    const [companyDataSize, setCompanyDataSize] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success' // or 'error'
    });
    //   const user = useSelector(state => state.auth.user);
    //   const isAdminOrSupervisor = user?.isAdmin || user?.role === 'Supervisor';
    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });
    const [user, setUser] = useState(null);

    const [isAdminOrSupervisor, setIsAdminOrSupervisor] = useState(false);


    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch user data - response contains { user: { ... } }
                const userRes = await axios.get('/api/auth/me');
                const userData = userRes.data.user; // Access the nested user object
                setUser(userData);
                setIsAdminOrSupervisor(userData.isAdmin || userData.role === 'Supervisor');
                const response = await axios.get(`/api/company/${id}`);
                setCompany(response.data.company);
                setCompanyDataSize(response.data.companyDataSizes?.[id] || 0);
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to fetch data');
                setLoading(false);
            }
        };

        fetchData();
    }, []);


    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to delete this company? This action cannot be undone.")) {
            setIsDeleting(true); // Start loading
            try {
                await api.delete(`/api/company/${id}`);
                setNotification({
                    show: true,
                    message: 'Company deleted successfully!',
                    type: 'success'
                });
                navigate('/dashboard');
            } catch (err) {
                setNotification({
                    show: true,
                    message: err.response?.data?.message || 'Error deleting company',
                    type: 'error'
                });
            } finally {
                setIsDeleting(false); // End loading
            }
        }
    };
        if (loading) return <Loader />;

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    if (!company) {
        return <Alert variant="warning">Company not found</Alert>;
    }

    return (
        <>
            {/* Navigation Bar */}
            <Navbar bg="light" expand="lg" className="shadow-sm">
                <Container fluid>
                    <Navbar.Brand as={Link} to="/dashboard">
                        <FaTachometerAlt className="me-2" />
                        Dashboard | {user?.name}
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="ms-auto">
                            {isAdminOrSupervisor && (
                                <Nav.Link as={Link} to="/api/company/new">
                                    <FaPlusCircle className="me-1" />
                                    Create Company
                                </Nav.Link>
                            )}
                            <Nav.Link as={Link} to="/logout">
                                <FaSignOutAlt className="me-1" />
                                Logout
                            </Nav.Link>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>

            {/* Main Content */}
            <Container className="my-4">
                <Card className="shadow">
                    {/* Company Header */}
                    <Card.Header className="d-flex justify-content-between align-items-center">
                        <h1 className="m-0">
                            <FaBuilding className="me-2" />
                            {company.name}
                        </h1>
                        {isAdminOrSupervisor && (
                            <div>
                                <Button
                                    variant="primary"
                                    className="me-2"
                                    as={Link}
                                    to={`/company/edit/${company._id}`}
                                >
                                    <FaEdit className="me-1" />
                                    Edit
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={handleDelete}
                                    disabled={isDeleting} // Disable button while deleting
                                >
                                    {isDeleting ? (
                                        <>
                                            <Spinner
                                                as="span"
                                                animation="border"
                                                size="sm"
                                                role="status"
                                                aria-hidden="true"
                                                className="me-1"
                                            />
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <FaTrashAlt className="me-1" />
                                            Delete
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </Card.Header>

                    <Card.Body>
                        <Row>
                            {/* General Information */}
                            <Col md={6}>
                                <div className="mb-4">
                                    <h3 className="border-bottom pb-2">
                                        <FaInfoCircle className="me-2" />
                                        General Information
                                    </h3>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Name:</span>
                                        <span>{company.name}</span>
                                    </div>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Address:</span>
                                        <span>{company.address}</span>
                                    </div>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Location:</span>
                                        <span>
                                            {company.country}, {company.state}, {company.city}, {company.ward}
                                        </span>
                                    </div>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>PAN:</span>
                                        <span>{company.pan}</span>
                                    </div>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Contact:</span>
                                        <span>
                                            <div><FaPhone className="me-1" /> {company.phone}</div>
                                            <div><FaEnvelope className="me-1" /> {company.email}</div>
                                        </span>
                                    </div>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Trade Type:</span>
                                        <span>
                                            <Badge bg="primary">{company.tradeType}</Badge>
                                        </span>
                                    </div>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Date Format:</span>
                                        <span>
                                            <Badge bg="info" text="dark">
                                                {company.dateFormat.charAt(0).toUpperCase() + company.dateFormat.slice(1)}
                                            </Badge>
                                        </span>
                                    </div>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Status:</span>
                                        <span className="d-flex align-items-center">
                                            <span
                                                className={`rounded-circle me-2 ${company.renewalDate ? 'bg-success' : 'bg-danger'}`}
                                                style={{ width: '10px', height: '10px' }}
                                            ></span>
                                            {company.renewalDate ? `Active until ${company.renewalDate}` : 'Demo Version'}
                                        </span>
                                    </div>
                                </div>
                            </Col>

                            {/* Owner Information */}
                            <Col md={6}>
                                <div className="mb-4">
                                    <h3 className="border-bottom pb-2">
                                        <FaUserTie className="me-2" />
                                        Owner Information
                                    </h3>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Name:</span>
                                        <span>{company.owner?.name}</span>
                                    </div>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Email:</span>
                                        <span>{company.owner?.email}</span>
                                    </div>
                                </div>

                                {/* System Information */}
                                <div className="mb-4">
                                    <h3 className="border-bottom pb-2">
                                        <FaCalendarAlt className="me-2" />
                                        System Information
                                    </h3>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Fiscal Year:</span>
                                        <span>
                                            {company.fiscalYear ? company.fiscalYear._id : 'Not set'}
                                        </span>
                                    </div>

                                    <div className="d-flex mb-3">
                                        <span className="text-muted" style={{ minWidth: '120px' }}>Data Size:</span>
                                        <span>{companyDataSize ? `${companyDataSize} KB` : 'N/A'}</span>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            </Container>
            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />
        </>
    );
};

export default CompanyDetails;