// // components/CompanyManagement.js
// import React, { useState, useEffect } from 'react';
// import { Container, Badge, Card, Button, Row, Col, Alert } from 'react-bootstrap';
// import { FaBuilding, FaCodeBranch } from 'react-icons/fa';
// import CompanySplitWizard from './CompanySplitWizard';
// import axios from 'axios';
// import DashboardLayout from './DashboardLayout';

// const SplitCompany = () => {
//     const [companies, setCompanies] = useState([]);
//     const [fiscalYears, setFiscalYears] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [showSplitWizard, setShowSplitWizard] = useState(false);
//       const [filteredCompanies, setFilteredCompanies] = useState([]);
    
//       const [user, setUser] = useState(null);
//       const [isAdminOrSupervisor, setIsAdminOrSupervisor] = useState(false);

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//      useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setLoading(true);

//         // Fetch user data - response contains { user: { ... } }
//         const userRes = await api.get('/api/auth/me');
//         const userData = userRes.data.user;
//         setUser(userData);
//         setIsAdminOrSupervisor(userData.isAdmin || userData.role === 'Supervisor');

//         // Fetch companies
//         const companiesRes = await api.get('/api/user-companies');
//         setCompanies(companiesRes.data);
//         setFilteredCompanies(companiesRes.data);

//         setLoading(false);
//       } catch (err) {
//         setError(err.response?.data?.message || 'Failed to fetch data');
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, []);


//     useEffect(() => {
//         fetchData();
//     }, []);

//     const fetchData = async () => {
//         try {
//             setLoading(true);
//             setError(null);

//             console.log('Fetching companies and fiscal years...');

//             // Use your actual endpoints
//             const [companiesResponse, fiscalYearsResponse] = await Promise.all([
//                 api.get('/api/user-companies'), // Your actual endpoint
//                 api.get('/api/switch-fiscal-year')      // Your actual endpoint
//             ]);

//             console.log('Companies response:', companiesResponse);
//             console.log('Fiscal years response:', fiscalYearsResponse);

//             // Handle companies response - it returns array directly
//             let companiesData = [];
//             if (Array.isArray(companiesResponse.data)) {
//                 companiesData = companiesResponse.data;
//             } else if (companiesResponse.data && companiesResponse.data.success) {
//                 companiesData = companiesResponse.data.data || [];
//             }

//             console.log('Companies data:', companiesData);
//             setCompanies(companiesData);

//             // Handle fiscal years response - from your switch-fiscal-year endpoint
//             let fiscalYearsData = [];
//             if (fiscalYearsResponse.data && fiscalYearsResponse.data.success) {
//                 fiscalYearsData = fiscalYearsResponse.data.data?.fiscalYears || [];
//             } else if (fiscalYearsResponse.data && fiscalYearsResponse.data.fiscalYears) {
//                 fiscalYearsData = fiscalYearsResponse.data.fiscalYears;
//             }

//             console.log('Fiscal years data:', fiscalYearsData);
//             setFiscalYears(fiscalYearsData);

//         } catch (err) {
//             console.error('Error fetching data:', err);
//             setError(`Failed to load data: ${err.response?.data?.message || err.message}`);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleSplitSuccess = () => {
//         setShowSplitWizard(false);
//         fetchData();
//     };

//     if (loading) {
//         return (
//             <Container className="mt-4">
//                 <div className="text-center">
//                     <div className="spinner-border text-primary" role="status">
//                         <span className="visually-hidden">Loading...</span>
//                     </div>
//                     <p className="mt-2">Loading companies...</p>
//                 </div>
//             </Container>
//         );
//     }

//     return (
//         <DashboardLayout user={user} isAdminOrSupervisor={isAdminOrSupervisor}>
//             <Container className="py-4">
//                 <Row className="mb-4">
//                     <Col>
//                         <h1 className="d-flex align-items-center">
//                             <FaBuilding className="me-3 text-primary" />
//                             Company Management
//                         </h1>
//                         <p className="text-muted">
//                             Manage your companies and split them by fiscal year
//                         </p>
//                     </Col>
//                     <Col xs="auto">
//                         <Button
//                             variant="primary"
//                             onClick={() => setShowSplitWizard(true)}
//                             className="d-flex align-items-center"
//                             disabled={companies.length === 0}
//                         >
//                             <FaCodeBranch className="me-2" />
//                             Split Company by Fiscal Year
//                             {companies.length === 0 && ' (No companies)'}
//                         </Button>
//                     </Col>
//                 </Row>

//                 {error && (
//                     <Alert variant="danger" className="mb-4">
//                         <strong>Error:</strong> {error}
//                     </Alert>
//                 )}

//                 {/* Debug info */}
//                 <Alert variant="info" className="mb-4">
//                     <strong>Data Status:</strong>
//                     <br />
//                     Companies: {companies.length}
//                     <br />
//                     Fiscal Years: {fiscalYears.length}
//                     {fiscalYears.length > 0 && (
//                         <div className="mt-2">
//                             <small>
//                                 Fiscal years from: {fiscalYears[0]?.company?.name || 'current company'}
//                             </small>
//                         </div>
//                     )}
//                 </Alert>

//                 {companies.length === 0 ? (
//                     <Alert variant="warning">
//                         <h5>No Companies Found</h5>
//                         <p>
//                             You don't have access to any companies yet.
//                             {/* {req.user?.isAdminOrSupervisor && " Create a company to get started."} */}
//                         </p>
//                     </Alert>
//                 ) : (
//                     <Row>
//                         {companies.map(company => (
//                             <Col md={6} lg={4} key={company._id} className="mb-4">
//                                 <Card className="h-100">
//                                     <Card.Header className="bg-light d-flex justify-content-between align-items-center">
//                                         <h5 className="mb-0">{company.name}</h5>
//                                         <Badge bg="primary">{company.tradeType}</Badge>
//                                     </Card.Header>
//                                     <Card.Body>
//                                         <p className="text-muted mb-2">
//                                             <strong>Email:</strong> {company.email || 'N/A'}
//                                         </p>
//                                         <p className="text-muted mb-2">
//                                             <strong>Phone:</strong> {company.phone || 'N/A'}
//                                         </p>
//                                         <p className="text-muted mb-2">
//                                             <strong>Date Format:</strong> {company.dateFormat || 'N/A'}
//                                         </p>
//                                         <p className="text-muted mb-0">
//                                             <strong>ID:</strong> <code>{company._id}</code>
//                                         </p>
//                                     </Card.Body>
//                                     <Card.Footer>
//                                         <small className="text-muted">
//                                             Created: {new Date(company.createdAt).toLocaleDateString()}
//                                         </small>
//                                     </Card.Footer>
//                                 </Card>
//                             </Col>
//                         ))}
//                     </Row>
//                 )}

//                 {companies.length > 0 && (
//                     <CompanySplitWizard
//                         show={showSplitWizard}
//                         onHide={() => setShowSplitWizard(false)}
//                         companies={companies}
//                         fiscalYears={fiscalYears}
//                         currentCompany={companies[0]}
//                         onSuccess={handleSplitSuccess}
//                     />
//                 )}
//             </Container>
//         </DashboardLayout>
//     );
// };

// export default SplitCompany;

// components/CompanyManagement.js
import React, { useState, useEffect } from 'react';
import { 
    Container, 
    Badge, 
    Card, 
    Button, 
    Row, 
    Col, 
    Alert,
    InputGroup,
    Form,
    Spinner,
    Placeholder
} from 'react-bootstrap';
import { 
    FaBuilding, 
    FaCodeBranch, 
    FaSearch, 
    FaFilter,
    FaEnvelope,
    FaPhone,
    FaCalendar,
    FaIdCard,
    FaPlus,
    FaSync
} from 'react-icons/fa';
import CompanySplitWizard from './CompanySplitWizard';
import axios from 'axios';
import DashboardLayout from './DashboardLayout';

const SplitCompany = () => {
    const [companies, setCompanies] = useState([]);
    const [fiscalYears, setFiscalYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showSplitWizard, setShowSplitWizard] = useState(false);
    const [filteredCompanies, setFilteredCompanies] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTradeType, setFilterTradeType] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    
    const [user, setUser] = useState(null);
    const [isAdminOrSupervisor, setIsAdminOrSupervisor] = useState(false);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        filterCompanies();
    }, [companies, searchTerm, filterTradeType]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch user data
            const userRes = await api.get('/api/auth/me');
            const userData = userRes.data.user;
            setUser(userData);
            setIsAdminOrSupervisor(userData.isAdmin || userData.role === 'Supervisor');

            // Fetch companies and fiscal years
            const [companiesResponse, fiscalYearsResponse] = await Promise.all([
                api.get('/api/user-companies'),
                api.get('/api/switch-fiscal-year')
            ]);

            // Handle companies response
            let companiesData = [];
            if (Array.isArray(companiesResponse.data)) {
                companiesData = companiesResponse.data;
            } else if (companiesResponse.data && companiesResponse.data.success) {
                companiesData = companiesResponse.data.data || [];
            }
            setCompanies(companiesData);

            // Handle fiscal years response
            let fiscalYearsData = [];
            if (fiscalYearsResponse.data && fiscalYearsResponse.data.success) {
                fiscalYearsData = fiscalYearsResponse.data.data?.fiscalYears || [];
            } else if (fiscalYearsResponse.data && fiscalYearsResponse.data.fiscalYears) {
                fiscalYearsData = fiscalYearsResponse.data.fiscalYears;
            }
            setFiscalYears(fiscalYearsData);

        } catch (err) {
            console.error('Error fetching data:', err);
            setError(`Failed to load data: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const filterCompanies = () => {
        let filtered = companies;

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(company =>
                company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                company.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                company.phone?.includes(searchTerm)
            );
        }

        // Apply trade type filter
        if (filterTradeType !== 'all') {
            filtered = filtered.filter(company => 
                company.tradeType?.toLowerCase() === filterTradeType.toLowerCase()
            );
        }

        setFilteredCompanies(filtered);
    };

    const handleSplitSuccess = () => {
        setShowSplitWizard(false);
        fetchData();
    };

    const getTradeTypeVariant = (tradeType) => {
        const variants = {
            'retailer': 'success',
            'pharmacy': 'info',
            'other': 'secondary'
        };
        return variants[tradeType?.toLowerCase()] || 'primary';
    };

    const getUniqueTradeTypes = () => {
        const tradeTypes = companies.map(company => company.tradeType?.toLowerCase());
        return ['all', ...new Set(tradeTypes.filter(Boolean))];
    };

    const LoadingSkeleton = () => (
        <Row>
            {[1, 2, 3].map(item => (
                <Col md={6} lg={4} key={item} className="mb-4">
                    <Card className="h-100">
                        <Card.Header className="bg-light">
                            <Placeholder as={Card.Title} animation="wave">
                                <Placeholder xs={8} />
                            </Placeholder>
                        </Card.Header>
                        <Card.Body>
                            <Placeholder as="p" animation="wave">
                                <Placeholder xs={12} />
                            </Placeholder>
                            <Placeholder as="p" animation="wave">
                                <Placeholder xs={10} />
                            </Placeholder>
                            <Placeholder as="p" animation="wave">
                                <Placeholder xs={6} />
                            </Placeholder>
                        </Card.Body>
                    </Card>
                </Col>
            ))}
        </Row>
    );

    if (loading && !refreshing) {
        return (
            <DashboardLayout user={user} isAdminOrSupervisor={isAdminOrSupervisor}>
                <Container className="py-4">
                    <div className="text-center">
                        <Spinner animation="border" role="status" className="text-primary">
                            <span className="visually-hidden">Loading...</span>
                        </Spinner>
                        <p className="mt-2">Loading companies...</p>
                    </div>
                </Container>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout user={user} isAdminOrSupervisor={isAdminOrSupervisor}>
            <Container className="py-4">
                {/* Header Section */}
                <Row className="mb-4 align-items-center">
                    <Col>
                        <div className="d-flex align-items-center">
                            <div className="bg-primary rounded p-3 me-3">
                                <FaBuilding size={32} className="text-white" />
                            </div>
                            <div>
                                <h1 className="h2 mb-1">Company Management</h1>
                                <p className="text-muted mb-0">
                                    Manage your companies and split them by fiscal year
                                </p>
                            </div>
                        </div>
                    </Col>
                    <Col xs="auto">
                        <div className="d-flex gap-2">
                            <Button
                                variant="outline-primary"
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="d-flex align-items-center"
                            >
                                <FaSync className={`me-2 ${refreshing ? 'fa-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => setShowSplitWizard(true)}
                                className="d-flex align-items-center"
                                disabled={companies.length === 0}
                            >
                                <FaCodeBranch className="me-2" />
                                Split Company
                            </Button>
                        </div>
                    </Col>
                </Row>

                {error && (
                    <Alert variant="danger" className="mb-4">
                        <strong>Error:</strong> {error}
                    </Alert>
                )}

                {/* Stats and Filters Section */}
                <Card className="mb-4">
                    <Card.Body>
                        <Row className="align-items-center">
                            <Col md={4}>
                                <div className="d-flex align-items-center">
                                    <div className="bg-light rounded p-2 me-3">
                                        <FaBuilding className="text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="mb-0">{companies.length}</h4>
                                        <small className="text-muted">Total Companies</small>
                                    </div>
                                </div>
                            </Col>
                            <Col md={8}>
                                <Row className="g-2">
                                    <Col md={6}>
                                        <InputGroup>
                                            <InputGroup.Text>
                                                <FaSearch />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type="text"
                                                placeholder="Search companies..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </InputGroup>
                                    </Col>
                                    <Col md={6}>
                                        <InputGroup>
                                            <InputGroup.Text>
                                                <FaFilter />
                                            </InputGroup.Text>
                                            <Form.Select
                                                value={filterTradeType}
                                                onChange={(e) => setFilterTradeType(e.target.value)}
                                            >
                                                <option value="all">All Types</option>
                                                {getUniqueTradeTypes()
                                                    .filter(type => type !== 'all')
                                                    .map(type => (
                                                        <option key={type} value={type}>
                                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                                        </option>
                                                    ))
                                                }
                                            </Form.Select>
                                        </InputGroup>
                                    </Col>
                                </Row>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Results Info */}
                {filteredCompanies.length !== companies.length && (
                    <Alert variant="info" className="mb-4">
                        Showing {filteredCompanies.length} of {companies.length} companies
                        {searchTerm && ` matching "${searchTerm}"`}
                        {filterTradeType !== 'all' && ` with type "${filterTradeType}"`}
                    </Alert>
                )}

                {/* Companies Grid */}
                {refreshing ? (
                    <LoadingSkeleton />
                ) : filteredCompanies.length === 0 ? (
                    <Card className="text-center py-5">
                        <Card.Body>
                            <FaBuilding size={48} className="text-muted mb-3" />
                            <h4>No Companies Found</h4>
                            <p className="text-muted mb-3">
                                {companies.length === 0 
                                    ? "You don't have access to any companies yet."
                                    : "No companies match your search criteria."
                                }
                            </p>
                            {companies.length === 0 && isAdminOrSupervisor && (
                                <Button variant="primary">
                                    <FaPlus className="me-2" />
                                    Create Your First Company
                                </Button>
                            )}
                        </Card.Body>
                    </Card>
                ) : (
                    <Row>
                        {filteredCompanies.map(company => (
                            <Col md={6} lg={4} key={company._id} className="mb-4">
                                <Card className="h-100 shadow-sm hover-shadow">
                                    <Card.Header className="bg-light d-flex justify-content-between align-items-center border-0">
                                        <h5 className="mb-0 text-truncate" title={company.name}>
                                            {company.name}
                                        </h5>
                                        <Badge bg={getTradeTypeVariant(company.tradeType)}>
                                            {company.tradeType || 'Unknown'}
                                        </Badge>
                                    </Card.Header>
                                    <Card.Body>
                                        <div className="d-flex align-items-center mb-3">
                                            <FaEnvelope className="text-muted me-2" />
                                            <span className="text-truncate" title={company.email}>
                                                {company.email || 'No email'}
                                            </span>
                                        </div>
                                        <div className="d-flex align-items-center mb-3">
                                            <FaPhone className="text-muted me-2" />
                                            <span>{company.phone || 'No phone'}</span>
                                        </div>
                                        <div className="d-flex align-items-center mb-3">
                                            <FaCalendar className="text-muted me-2" />
                                            <span>Date Format: {company.dateFormat || 'N/A'}</span>
                                        </div>
                                        <div className="d-flex align-items-center">
                                            <FaIdCard className="text-muted me-2" />
                                            <small className="text-muted font-monospace">
                                                ID: {company._id.substring(0, 8)}...
                                            </small>
                                        </div>
                                    </Card.Body>
                                    <Card.Footer className="bg-transparent border-0">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <small className="text-muted">
                                                Created: {new Date(company.createdAt).toLocaleDateString()}
                                            </small>
                                            <Badge bg="outline-secondary" text="dark">
                                                {company.vatEnabled ? 'VAT Enabled' : 'VAT Disabled'}
                                            </Badge>
                                        </div>
                                    </Card.Footer>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                )}

                {/* Company Split Wizard */}
                {companies.length > 0 && (
                    <CompanySplitWizard
                        show={showSplitWizard}
                        onHide={() => setShowSplitWizard(false)}
                        companies={companies}
                        fiscalYears={fiscalYears}
                        currentCompany={companies[0]}
                        onSuccess={handleSplitSuccess}
                    />
                )}
            </Container>
        </DashboardLayout>
    );
};

export default SplitCompany;