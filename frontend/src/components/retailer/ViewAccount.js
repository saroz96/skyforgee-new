import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container,
    Card,
    Row,
    Col,
    ListGroup,
    Button,
    Alert
} from 'react-bootstrap';
import { FaArrowLeft } from 'react-icons/fa';
import axios from 'axios';

const AccountDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState({
        accounts: [],
        companyGroups: [],
        company: null,
        currentFiscalYear: null,
        companyId: '',
        currentCompanyName: '',
        user: null,
        theme: 'light',
        isAdminOrSupervisor: false
    });
    const [account, setAccount] = useState(null);
    const [company, setCompany] = useState(null);
    const [companyGroups, setCompanyGroups] = useState([]);
    const [currentOpeningBalance, setCurrentOpeningBalance] = useState(null);
    const [currentFiscalYear, setCurrentFiscalYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        const fetchAccountDetails = async () => {
            try {
                const response = await api.get(`/api/retailer/companies/${id}`);

                if (!response.data.success) {
                    throw new Error(response.data.error || 'Failed to fetch account details');
                }

                const { data } = response.data;

                setAccount(data.account);
                setCompany(data.company);
                setCompanyGroups(data.companyGroups);
                setCurrentOpeningBalance(data.financialInfo.currentOpeningBalance);
                setCurrentFiscalYear(data.financialInfo.fiscalYear);

            } catch (err) {
                setError(err.response?.data?.error || err.message || 'Failed to fetch account details');
            } finally {
                setLoading(false);
            }
        };

        fetchAccountDetails();
    }, [id]);

    if (loading) {
        return (
            <Container className="mt-4">
                <div className="text-center">Loading account details...</div>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-4">
                <Alert variant="danger">{error}</Alert>
                <Button variant="primary" onClick={() => navigate(-1)}>
                    <FaArrowLeft /> Back
                </Button>
            </Container>
        );
    }

    if (!account) {
        return (
            <Container className="mt-4">
                <Alert variant="warning">Account not found</Alert>
                <Button variant="primary" onClick={() => navigate(-1)}>
                    <FaArrowLeft /> Back
                </Button>
            </Container>
        );
    }

    return (
        <Container className="mt-4">
            <Card className="shadow-lg p-4">
                <Card.Header className="text-center">
                    <h2 style={{ textDecoration: 'underline' }}>A/c Details</h2>
                </Card.Header>

                <Card.Body>
                    <Row>
                        <Col md={6}>
                            <h5 className="card-title">Details:</h5>
                            <ListGroup variant="flush">
                                <ListGroup.Item>
                                    <strong>A/c Name:</strong> {account.name}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>A/c Group:</strong>
                                    {Array.isArray(account.companyGroups)
                                        ? account.companyGroups[0]?.name || 'No Group'
                                        : account.companyGroups?.name || 'No Group'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Op. Bal:</strong>
                                    {currentOpeningBalance ?
                                        `${currentOpeningBalance.amount} ${currentOpeningBalance.type}` :
                                        '0 Dr'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Credit Limit:</strong>
                                    {account.creditLimit || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Pan No.:</strong> {account.pan || 'N/A'}
                                </ListGroup.Item>
                            </ListGroup>
                        </Col>

                        <Col md={6}>
                            <h5 className="card-title">Contact Information:</h5>
                            <ListGroup variant="flush">
                                <ListGroup.Item>
                                    <strong>Address:</strong> {account.address || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Ward No.:</strong> {account.ward || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Contact Person:</strong> {account.contactperson || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Phone:</strong> {account.phone || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Email:</strong> {account.email || 'N/A'}
                                </ListGroup.Item>
                            </ListGroup>
                        </Col>
                    </Row>
                </Card.Body>

                <div className="mb-3">
                    <Button
                        variant="primary"
                        onClick={() => navigate(-1)}
                        style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            fontSize: '16px',
                            borderRadius: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <FaArrowLeft style={{ fontSize: '20px' }} /> Back
                    </Button>
                </div>
            </Card>
        </Container>
    );
};

export default AccountDetails;