
import React, { useState, useEffect, useRef } from 'react';
import {
    Card,
    Row,
    Col,
    Form,
    Button,
    Modal,
    ProgressBar,
    Alert
} from 'react-bootstrap';
import { FaCalendarAlt, FaCheck, FaExclamationTriangle, FaInfoCircle, FaSync } from 'react-icons/fa';
import axios from 'axios';
import Header from '../retailer/Header';

const ChangeNewFiscalYear = () => {
    const [fiscalData, setFiscalData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processLog, setProcessLog] = useState([]);
    const [showConsole, setShowConsole] = useState(false);
    const [endDate, setEndDate] = useState('');
    
    const eventSourceRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        fetchFiscalData();
        
        // Cleanup function to close SSE connection
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    const fetchFiscalData = async () => {
        try {
            const response = await api.get('/api/change-fiscal-year');
            if (response.data.success) {
                const data = response.data.data;
                setFiscalData(data);
                
                // Calculate default end date (start date + 1 year - 1 day)
                if (data.nextFiscalYearStartDate) {
                    const startDate = new Date(data.nextFiscalYearStartDate);
                    const endDate = new Date(startDate);
                    endDate.setFullYear(endDate.getFullYear() + 1);
                    endDate.setDate(endDate.getDate() - 1);
                    setEndDate(endDate.toISOString().split('T')[0]);
                }
            } else {
                throw new Error(response.data.error || 'Failed to fetch fiscal data');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to fetch fiscal data');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setShowConfirmationModal(true);
    };

    const confirmCreateFiscalYear = () => {
        setShowConfirmationModal(false);
        startFiscalYearCreation();
    };

    const startFiscalYearCreation = async () => {
        setCreating(true);
        setProgress(0);
        setProcessLog([]);
        setShowConsole(true);
        setError(null);

        try {
            // Close any existing connection
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const params = new URLSearchParams();
            params.append('dateFormat', fiscalData.companyDateFormat);
            
            if (fiscalData.companyDateFormat === 'nepali') {
                params.append('startDateNepali', fiscalData.nextFiscalYearStartDate);
                if (endDate) {
                    params.append('endDateNepali', endDate);
                }
            } else {
                params.append('startDateEnglish', fiscalData.nextFiscalYearStartDate);
                if (endDate) {
                    params.append('endDateEnglish', endDate);
                }
            }

            addToLog("Initializing fiscal year creation process...");
            addToLog("This process will:");
            addToLog("1. Create a new fiscal year");
            addToLog("2. Clone settings and configurations");
            addToLog("3. Migrate items with stock calculations");
            addToLog("4. Update accounts with opening balances");
            addToLog("5. Initialize bill counters");
            addToLog("Starting process now...");

            // Create EventSource with error handling
            const eventSourceUrl = `${process.env.REACT_APP_API_BASE_URL}/api/change-fiscal-year-stream?${params.toString()}`;
            addToLog(`Connecting to: ${eventSourceUrl}`);
            
            const eventSource = new EventSource(eventSourceUrl, { 
                withCredentials: true 
            });
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                addToLog("✓ Connected to server successfully");
                addToLog("Starting fiscal year creation...");
            };

            eventSource.onmessage = (event) => {
                try {
                    if (!event.data) {
                        addToLog("⚠ Received empty message from server");
                        return;
                    }

                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'progress') {
                        setProgress(data.value);
                        addToLog(`📊 Progress: ${data.value}% complete`);
                    } 
                    else if (data.type === 'log') {
                        addToLog(`📝 ${data.message}`);
                    }
                    else if (data.type === 'complete') {
                        addToLog("✅ Process completed successfully!");
                        eventSource.close();
                        setCreating(false);
                        setShowSuccessModal(true);
                        // Refresh data to show the new fiscal year
                        setTimeout(() => {
                            fetchFiscalData();
                        }, 2000);
                    }
                    else if (data.type === 'error') {
                        addToLog(`❌ Error: ${data.message}`);
                        eventSource.close();
                        setCreating(false);
                        setError(data.message);
                    }
                    else {
                        addToLog(`📨 Unknown message type: ${data.type}`);
                    }
                } catch (parseError) {
                    console.error('Error parsing SSE data:', parseError);
                    addToLog('❌ Error processing server response');
                    addToLog(`Raw data: ${event.data}`);
                }
            };

            eventSource.onerror = (error) => {
                console.error('SSE Connection Error:', error);
                
                // Check the readyState to determine the type of error
                if (eventSource.readyState === EventSource.CLOSED) {
                    addToLog("❌ Connection closed by server");
                    setError("Connection closed by server. Please check if the fiscal year was created successfully.");
                } else {
                    addToLog("❌ Connection error occurred");
                    setError("Unable to connect to server. Please check your internet connection and try again.");
                }
                
                eventSource.close();
                setCreating(false);
            };

        } catch (err) {
            console.error('Error setting up SSE:', err);
            setCreating(false);
            addToLog(`❌ Initialization error: ${err.message}`);
            setError(`Failed to start process: ${err.message}`);
        }
    };

    const addToLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        setProcessLog(prev => [...prev, { timestamp, message }]);
    };

    const formatDate = (dateString, dateFormat) => {
        if (!dateString) return 'N/A';
        if (dateFormat === 'nepali') {
            return new Date(dateString).toLocaleDateString('ne-NP');
        } else {
            return new Date(dateString).toLocaleDateString();
        }
    };

    const getStepStatus = (stepNumber) => {
        const stepProgress = (stepNumber - 1) * 33;
        return progress >= stepProgress ? 'complete' : 'incomplete';
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
    };

    const retryProcess = () => {
        setError(null);
        startFiscalYearCreation();
    };

    const cancelProcess = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        setCreating(false);
        setProgress(0);
        addToLog("Process cancelled by user");
    };

    // Calculate suggested end date (start date + 1 year - 1 day)
    const getSuggestedEndDate = () => {
        if (!fiscalData?.nextFiscalYearStartDate) return '';
        const startDate = new Date(fiscalData.nextFiscalYearStartDate);
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setDate(endDate.getDate() - 1);
        return endDate.toISOString().split('T')[0];
    };

    if (loading) {
        return (
            <div className="container mt-4">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">Loading fiscal year data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-light min-vh-100">
            <Header />
            
            {/* Success Modal */}
            <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
                <Modal.Header closeButton className="bg-success text-white border-0">
                    <Modal.Title className="d-flex align-items-center">
                        <FaCheck className="me-2" />
                        Fiscal Year Created Successfully
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <div className="text-center">
                        <FaCheck className="text-success mb-3" size={48} />
                        <h5 className="text-success mb-3">Fiscal Year Creation Complete!</h5>
                        <p className="mb-0">
                            Your new fiscal year has been created successfully. 
                            All items, accounts, and settings have been migrated.
                        </p>
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-0">
                    <Button 
                        variant="success" 
                        onClick={() => {
                            setShowSuccessModal(false);
                            window.location.reload(); // Refresh to show new data
                        }}
                        className="px-4"
                    >
                        Continue
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Confirmation Modal */}
            <Modal show={showConfirmationModal} onHide={() => setShowConfirmationModal(false)} centered size="lg">
                <Modal.Header closeButton className="bg-warning text-dark border-0">
                    <Modal.Title className="d-flex align-items-center">
                        <FaExclamationTriangle className="me-2" />
                        Confirm New Fiscal Year Creation
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <Alert variant="info" className="d-flex align-items-start">
                        <FaInfoCircle className="me-2 mt-1 flex-shrink-0" />
                        <div>
                            <strong>This process will:</strong>
                            <ul className="mb-0 mt-2">
                                <li>Create a new fiscal year</li>
                                <li>Clone all settings and configurations</li>
                                <li>Migrate items with current stock levels</li>
                                <li>Update accounts with opening balances</li>
                                <li>Initialize transaction counters</li>
                            </ul>
                        </div>
                    </Alert>
                    <p className="mb-3">
                        Are you sure you want to create a new fiscal year with the following dates?
                    </p>
                    <div className="bg-light p-3 rounded">
                        <Row>
                            <Col md={6}>
                                <strong>Start Date:</strong><br />
                                {formatDate(fiscalData?.nextFiscalYearStartDate, fiscalData?.companyDateFormat)}
                            </Col>
                            <Col md={6}>
                                <strong>End Date:</strong><br />
                                {formatDate(endDate, fiscalData?.companyDateFormat)}
                            </Col>
                        </Row>
                    </div>
                    <p className="text-muted small mt-3 mb-0">
                        This process may take several minutes depending on your data size.
                    </p>
                </Modal.Body>
                <Modal.Footer className="border-0">
                    <Button 
                        variant="outline-secondary" 
                        onClick={() => setShowConfirmationModal(false)}
                        className="px-4"
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={confirmCreateFiscalYear}
                        className="px-4"
                    >
                        Start Creation Process
                    </Button>
                </Modal.Footer>
            </Modal>

            <div className="container py-4">
                <Card className="shadow border-0 rounded-3">
                    <Card.Body className="p-4 p-md-5">
                        {/* Header Section */}
                        <div className="d-flex align-items-center mb-4 pb-3 border-bottom">
                            <div className="bg-primary rounded-circle p-3 me-3">
                                <FaCalendarAlt className="text-white fs-2" />
                            </div>
                            <div>
                                <h1 className="h2 mb-1 text-dark">Create New Fiscal Year</h1>
                                {fiscalData?.currentCompanyName && (
                                    <p className="text-muted mb-0 fs-6">
                                        for <strong>{fiscalData.currentCompanyName}</strong>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Error Alert with Retry Option */}
                        {error && (
                            <Alert variant="danger" className="mb-4 rounded-3">
                                <Alert.Heading className="h6 mb-2 d-flex align-items-center">
                                    <FaExclamationTriangle className="me-2" />
                                    Process Error
                                </Alert.Heading>
                                {error}
                                <hr />
                                <div className="d-flex gap-2 mt-2">
                                    <Button 
                                        variant="outline-danger" 
                                        size="sm" 
                                        onClick={retryProcess}
                                        className="d-flex align-items-center"
                                    >
                                        <FaSync className="me-1" />
                                        Retry
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        size="sm" 
                                        onClick={cancelProcess}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </Alert>
                        )}

                        {/* Current Fiscal Year Display */}
                        {fiscalData?.currentFiscalYear && (
                            <Card className="mb-4 border-primary shadow-sm">
                                <Card.Header className="bg-primary text-white py-3">
                                    <h5 className="mb-0 d-flex align-items-center">
                                        <FaCalendarAlt className="me-2" />
                                        Current Active Fiscal Year
                                    </h5>
                                </Card.Header>
                                <Card.Body className="p-4">
                                    <Row className="g-3">
                                        <Col md={4}>
                                            <div className="border-end-md pe-md-3">
                                                <small className="text-muted d-block mb-1">Fiscal Year</small>
                                                <strong className="fs-6 text-dark">{fiscalData.currentFiscalYear.name}</strong>
                                            </div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="border-end-md pe-md-3">
                                                <small className="text-muted d-block mb-1">Start Date</small>
                                                <strong className="fs-6 text-dark">
                                                    {formatDate(fiscalData.currentFiscalYear.startDate, fiscalData.companyDateFormat)}
                                                </strong>
                                            </div>
                                        </Col>
                                        <Col md={4}>
                                            <div>
                                                <small className="text-muted d-block mb-1">End Date</small>
                                                <strong className="fs-6 text-dark">
                                                    {formatDate(fiscalData.currentFiscalYear.endDate, fiscalData.companyDateFormat)}
                                                </strong>
                                            </div>
                                        </Col>
                                    </Row>
                                </Card.Body>
                            </Card>
                        )}

                        {/* Progress Section - Only show when process is running */}
                        {(creating || progress > 0) && (
                            <Card className="mb-4 border-0 bg-light">
                                <Card.Body className="p-4">
                                    <div className="d-flex justify-content-between align-items-center mb-4">
                                        <h4 className="mb-0 text-dark">Creation Progress</h4>
                                        {creating && (
                                            <Button 
                                                variant="outline-danger" 
                                                size="sm" 
                                                onClick={cancelProcess}
                                            >
                                                Cancel Process
                                            </Button>
                                        )}
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="mb-4">
                                        <ProgressBar 
                                            now={progress} 
                                            label={`${progress}%`}
                                            className="rounded-pill"
                                            style={{ height: '28px' }}
                                            variant={progress === 100 ? 'success' : 'primary'}
                                        />
                                    </div>

                                    {/* Step Indicators */}
                                    <div className="steps mt-4">
                                        <Row className="text-center">
                                            <Col md={4} className="mb-3 mb-md-0">
                                                <div className={`step ${getStepStatus(1)} d-flex flex-column align-items-center`}>
                                                    <div className={`rounded-circle mb-2 d-flex align-items-center justify-content-center ${getStepStatus(1) === 'complete' ? 'bg-success' : progress >= 0 ? 'bg-primary' : 'bg-secondary'} text-white`} 
                                                         style={{width: '40px', height: '40px'}}>
                                                        {getStepStatus(1) === 'complete' ? '✓' : '1'}
                                                    </div>
                                                    <span className="step-label fw-bold small">
                                                        Create Fiscal Year
                                                    </span>
                                                </div>
                                            </Col>
                                            <Col md={4} className="mb-3 mb-md-0">
                                                <div className={`step ${getStepStatus(2)} d-flex flex-column align-items-center`}>
                                                    <div className={`rounded-circle mb-2 d-flex align-items-center justify-content-center ${getStepStatus(2) === 'complete' ? 'bg-success' : progress >= 33 ? 'bg-primary' : 'bg-secondary'} text-white`} 
                                                         style={{width: '40px', height: '40px'}}>
                                                        {getStepStatus(2) === 'complete' ? '✓' : '2'}
                                                    </div>
                                                    <span className="step-label fw-bold small">
                                                        Migrate Items
                                                    </span>
                                                </div>
                                            </Col>
                                            <Col md={4}>
                                                <div className={`step ${getStepStatus(3)} d-flex flex-column align-items-center`}>
                                                    <div className={`rounded-circle mb-2 d-flex align-items-center justify-content-center ${getStepStatus(3) === 'complete' ? 'bg-success' : progress >= 66 ? 'bg-primary' : 'bg-secondary'} text-white`} 
                                                         style={{width: '40px', height: '40px'}}>
                                                        {getStepStatus(3) === 'complete' ? '✓' : '3'}
                                                    </div>
                                                    <span className="step-label fw-bold small">
                                                        Update Accounts
                                                    </span>
                                                </div>
                                            </Col>
                                        </Row>
                                    </div>
                                </Card.Body>
                            </Card>
                        )}

                        {/* Fiscal Year Creation Form */}
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-white py-3 border-bottom">
                                <h5 className="mb-0 text-dark">New Fiscal Year Details</h5>
                            </Card.Header>
                            <Card.Body className="p-4">
                                <Form onSubmit={handleSubmit}>
                                    <Row>
                                        <Col md={6}>
                                            {fiscalData?.companyDateFormat === 'nepali' ? (
                                                <>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label className="fw-semibold text-dark mb-2">
                                                            Date Format
                                                        </Form.Label>
                                                        <Form.Select name="dateFormat" value="nepali" readOnly className="border-2">
                                                            <option value="nepali">Nepali Date</option>
                                                        </Form.Select>
                                                    </Form.Group>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label className="fw-semibold text-dark mb-2">
                                                            Start Date
                                                        </Form.Label>
                                                        <Form.Control
                                                            type="date"
                                                            name="startDateNepali"
                                                            value={fiscalData?.nextFiscalYearStartDate || ''}
                                                            readOnly
                                                            required
                                                            className="border-2"
                                                        />
                                                        <Form.Text className="text-muted">
                                                            Automatically calculated from current fiscal year end date
                                                        </Form.Text>
                                                    </Form.Group>
                                                    <Form.Group className="mb-4">
                                                        <Form.Label className="fw-semibold text-dark mb-2">
                                                            End Date
                                                        </Form.Label>
                                                        <Form.Control
                                                            type="date"
                                                            name="endDateNepali"
                                                            value={endDate}
                                                            onChange={handleEndDateChange}
                                                            required
                                                            className="border-2"
                                                        />
                                                        <Form.Text className="text-muted">
                                                            Suggested: {getSuggestedEndDate()} (Start Date + 1 year)
                                                        </Form.Text>
                                                    </Form.Group>
                                                </>
                                            ) : (
                                                <>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label className="fw-semibold text-dark mb-2">
                                                            Date Format
                                                        </Form.Label>
                                                        <Form.Select name="dateFormat" value="english" readOnly className="border-2">
                                                            <option value="english">English Date</option>
                                                        </Form.Select>
                                                    </Form.Group>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label className="fw-semibold text-dark mb-2">
                                                            Start Date
                                                        </Form.Label>
                                                        <Form.Control
                                                            type="date"
                                                            name="startDateEnglish"
                                                            value={fiscalData?.nextFiscalYearStartDate || ''}
                                                            readOnly
                                                            required
                                                            className="border-2"
                                                        />
                                                        <Form.Text className="text-muted">
                                                            Automatically calculated from current fiscal year end date
                                                        </Form.Text>
                                                    </Form.Group>
                                                    <Form.Group className="mb-4">
                                                        <Form.Label className="fw-semibold text-dark mb-2">
                                                            End Date
                                                        </Form.Label>
                                                        <Form.Control
                                                            type="date"
                                                            name="endDateEnglish"
                                                            value={endDate}
                                                            onChange={handleEndDateChange}
                                                            required
                                                            className="border-2"
                                                        />
                                                        <Form.Text className="text-muted">
                                                            Suggested: {getSuggestedEndDate()} (Start Date + 1 year)
                                                        </Form.Text>
                                                    </Form.Group>
                                                </>
                                            )}
                                        </Col>
                                    </Row>

                                    <div className="d-flex align-items-center">
                                        <Button
                                            variant="primary"
                                            type="submit"
                                            disabled={creating || !endDate}
                                            className="px-5 py-2 rounded-pill fw-semibold"
                                            size="lg"
                                        >
                                            {creating ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" />
                                                    Creating Fiscal Year...
                                                </>
                                            ) : (
                                                <>
                                                    <FaCalendarAlt className="me-2" />
                                                    Create New Fiscal Year
                                                </>
                                            )}
                                        </Button>
                                        {creating && (
                                            <div className="ms-3">
                                                <small className="text-muted">
                                                    Please wait while we create your new fiscal year...
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                </Form>

                                {/* Process Console Output */}
                                {showConsole && processLog.length > 0 && (
                                    <div className="console-output mt-4 p-4 bg-dark text-light rounded-3">
                                        <div className="d-flex align-items-center justify-content-between mb-3">
                                            <h6 className="text-white mb-0">Process Log</h6>
                                            <small className="text-muted">Real-time updates</small>
                                        </div>
                                        <div 
                                            className="font-monospace small bg-black rounded p-3"
                                            style={{ maxHeight: '300px', overflowY: 'auto' }}
                                        >
                                            {processLog.map((log, index) => (
                                                <div key={index} className="log-entry border-bottom border-dark pb-2 mb-2">
                                                    <span className="text-info">[{log.timestamp}]</span>{' '}
                                                    <span className={
                                                        log.message.includes('✅') || log.message.includes('✓') ? 'text-success' :
                                                        log.message.includes('❌') || log.message.includes('✗') ? 'text-danger' :
                                                        log.message.includes('⚠') ? 'text-warning' :
                                                        log.message.includes('📊') ? 'text-primary' :
                                                        'text-light'
                                                    }>{log.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </Card.Body>
                </Card>
            </div>
        </div>
    );
};

export default ChangeNewFiscalYear;