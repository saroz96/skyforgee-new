// import React, { useState, useEffect } from 'react';
// import {
//     Modal,
//     Button,
//     Form,
//     Card,
//     Alert,
//     ProgressBar,
//     Row,
//     Col,
//     Badge
// } from 'react-bootstrap';
// import { FaBuilding, FaCalendarAlt, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
// import useCompanySplit from '../hooks/useCompanySplit'

// const CompanySplitWizard = ({ show, onHide, companies, fiscalYears, currentCompany }) => {
//     const [step, setStep] = useState(1);
//     const [formData, setFormData] = useState({
//         sourceCompanyId: '',
//         fiscalYearId: '',
//         newCompanyName: '',
//         deleteAfterSplit: false
//     });
//     const [validationErrors, setValidationErrors] = useState({});

//     const {
//         loading,
//         error,
//         progress,
//         processLog,
//         splitCompanyWithSSE,
//         reset
//     } = useCompanySplit();

//     useEffect(() => {
//         if (show) {
//             // Initialize form with current company
//             if (currentCompany) {
//                 setFormData(prev => ({
//                     ...prev,
//                     sourceCompanyId: currentCompany._id
//                 }));
//             }
//             reset();
//             setStep(1);
//         }
//     }, [show, currentCompany, reset]);

//     const handleInputChange = (field, value) => {
//         setFormData(prev => ({
//             ...prev,
//             [field]: value
//         }));

//         // Clear validation error when user types
//         if (validationErrors[field]) {
//             setValidationErrors(prev => ({
//                 ...prev,
//                 [field]: ''
//             }));
//         }
//     };

//     const validateStep1 = () => {
//         const errors = {};

//         if (!formData.sourceCompanyId) {
//             errors.sourceCompanyId = 'Please select a source company';
//         }

//         if (!formData.fiscalYearId) {
//             errors.fiscalYearId = 'Please select a fiscal year';
//         }

//         setValidationErrors(errors);
//         return Object.keys(errors).length === 0;
//     };

//     const validateStep2 = () => {
//         const errors = {};

//         if (!formData.newCompanyName?.trim()) {
//             errors.newCompanyName = 'Please enter a name for the new company';
//         } else if (formData.newCompanyName.length < 2) {
//             errors.newCompanyName = 'Company name must be at least 2 characters long';
//         }

//         setValidationErrors(errors);
//         return Object.keys(errors).length === 0;
//     };

//     const handleNext = () => {
//         if (step === 1 && validateStep1()) {
//             setStep(2);
//         } else if (step === 2 && validateStep2()) {
//             setStep(3);
//         }
//     };

//     const handleBack = () => {
//         setStep(step - 1);
//     };

//     const handleSubmit = async () => {
//         try {
//             await splitCompanyWithSSE(formData);
//             // Success handled in hook
//         } catch (err) {
//             // Error handled in hook
//         }
//     };

//     const getSelectedCompany = () => {
//         return companies.find(c => c._id === formData.sourceCompanyId);
//     };

//     const getSelectedFiscalYear = () => {
//         return fiscalYears.find(fy => fy._id === formData.fiscalYearId);
//     };

//     const renderStep1 = () => (
//         <div>
//             <h5 className="mb-4">
//                 <FaBuilding className="me-2 text-primary" />
//                 Select Source Company & Fiscal Year
//             </h5>

//             <Form.Group className="mb-4">
//                 <Form.Label>Source Company *</Form.Label>
//                 <Form.Select
//                     value={formData.sourceCompanyId}
//                     onChange={(e) => handleInputChange('sourceCompanyId', e.target.value)}
//                     isInvalid={!!validationErrors.sourceCompanyId}
//                 >
//                     <option value="">Select a company</option>
//                     {companies.map(company => (
//                         <option key={company._id} value={company._id}>
//                             {company.name}
//                             {company._id === currentCompany?._id && ' (Current)'}
//                         </option>
//                     ))}
//                 </Form.Select>
//                 <Form.Control.Feedback type="invalid">
//                     {validationErrors.sourceCompanyId}
//                 </Form.Control.Feedback>
//             </Form.Group>

//             <Form.Group className="mb-4">
//                 <Form.Label>Fiscal Year to Split *</Form.Label>
//                 <Form.Select
//                     value={formData.fiscalYearId}
//                     onChange={(e) => handleInputChange('fiscalYearId', e.target.value)}
//                     isInvalid={!!validationErrors.fiscalYearId}
//                     disabled={!formData.sourceCompanyId}
//                 >
//                     <option value="">Select fiscal year</option>
//                     {fiscalYears
//                         .filter(fy => fy.company === formData.sourceCompanyId)
//                         .map(fiscalYear => (
//                             <option key={fiscalYear._id} value={fiscalYear._id}>
//                                 {fiscalYear.name} ({new Date(fiscalYear.startDate).toLocaleDateString()} - {new Date(fiscalYear.endDate).toLocaleDateString()})
//                             </option>
//                         ))
//                     }
//                 </Form.Select>
//                 <Form.Control.Feedback type="invalid">
//                     {validationErrors.fiscalYearId}
//                 </Form.Control.Feedback>
//                 <Form.Text className="text-muted">
//                     Select the fiscal year you want to separate into a new company
//                 </Form.Text>
//             </Form.Group>

//             {formData.sourceCompanyId && formData.fiscalYearId && (
//                 <Alert variant="info">
//                     <FaInfoCircle className="me-2" />
//                     <strong>Preview:</strong> This will create a new company containing all data from{' '}
//                     <strong>{getSelectedCompany()?.name}</strong> for fiscal year{' '}
//                     <strong>{getSelectedFiscalYear()?.name}</strong>
//                 </Alert>
//             )}
//         </div>
//     );

//     const renderStep2 = () => (
//         <div>
//             <h5 className="mb-4">
//                 <FaBuilding className="me-2 text-primary" />
//                 New Company Details
//             </h5>

//             <Form.Group className="mb-4">
//                 <Form.Label>New Company Name *</Form.Label>
//                 <Form.Control
//                     type="text"
//                     placeholder="Enter name for the new company"
//                     value={formData.newCompanyName}
//                     onChange={(e) => handleInputChange('newCompanyName', e.target.value)}
//                     isInvalid={!!validationErrors.newCompanyName}
//                 />
//                 <Form.Control.Feedback type="invalid">
//                     {validationErrors.newCompanyName}
//                 </Form.Control.Feedback>
//                 <Form.Text className="text-muted">
//                     This will be the name of your new separated company
//                 </Form.Text>
//             </Form.Group>

//             <Form.Group className="mb-4">
//                 <Form.Check
//                     type="checkbox"
//                     label={
//                         <span>
//                             <strong>Remove the split fiscal year from source company after separation</strong>
//                             <br />
//                             <small className="text-muted">
//                                 If checked, the selected fiscal year and its data will be removed from the source company
//                             </small>
//                         </span>
//                     }
//                     checked={formData.deleteAfterSplit}
//                     onChange={(e) => handleInputChange('deleteAfterSplit', e.target.checked)}
//                 />
//             </Form.Group>

//             <Alert variant="warning">
//                 <FaExclamationTriangle className="me-2" />
//                 <strong>Important:</strong> This process may take several minutes depending on your data size.
//                 Please do not close this window until the process is complete.
//             </Alert>
//         </div>
//     );

//     const renderStep3 = () => (
//         <div>
//             <h5 className="mb-4">
//                 <FaBuilding className="me-2 text-primary" />
//                 Splitting Company
//             </h5>

//             {!loading && !error && (
//                 <Alert variant="info">
//                     Ready to split company. Click "Start Split" to begin the process.
//                 </Alert>
//             )}

//             {loading && (
//                 <div className="mb-4">
//                     <div className="d-flex justify-content-between align-items-center mb-2">
//                         <span>Progress: {progress}%</span>
//                         <Badge bg="primary">Processing...</Badge>
//                     </div>
//                     <ProgressBar
//                         now={progress}
//                         label={`${progress}%`}
//                         className="mb-3"
//                     />
//                 </div>
//             )}

//             {processLog.length > 0 && (
//                 <Card className="mb-4">
//                     <Card.Header>
//                         <strong>Process Log</strong>
//                     </Card.Header>
//                     <Card.Body style={{ maxHeight: '200px', overflowY: 'auto' }}>
//                         {processLog.map((log, index) => (
//                             <div key={index} className="border-bottom pb-1 mb-1 small">
//                                 <span className="text-muted">[{log.timestamp}]</span> {log.message}
//                             </div>
//                         ))}
//                     </Card.Body>
//                 </Card>
//             )}

//             {error && (
//                 <Alert variant="danger">
//                     <strong>Error:</strong> {error}
//                 </Alert>
//             )}
//         </div>
//     );

//     const renderStepContent = () => {
//         switch (step) {
//             case 1: return renderStep1();
//             case 2: return renderStep2();
//             case 3: return renderStep3();
//             default: return null;
//         }
//     };

//     const getStepTitle = () => {
//         switch (step) {
//             case 1: return 'Select Source';
//             case 2: return 'New Company Details';
//             case 3: return 'Split Company';
//             default: return '';
//         }
//     };

//     return (
//         <Modal show={show} onHide={onHide} size="lg" centered>
//             <Modal.Header closeButton>
//                 <Modal.Title>
//                     <FaBuilding className="me-2 text-primary" />
//                     Split Company by Fiscal Year
//                     <br />
//                     <small className="text-muted fs-6">{getStepTitle()}</small>
//                 </Modal.Title>
//             </Modal.Header>

//             <Modal.Body>
//                 {/* Progress Steps */}
//                 <div className="steps mb-4">
//                     <Row className="text-center">
//                         <Col>
//                             <div className={`step ${step >= 1 ? 'active' : ''} d-flex flex-column align-items-center`}>
//                                 <div className={`rounded-circle mb-2 d-flex align-items-center justify-content-center ${step >= 1 ? 'bg-primary' : 'bg-secondary'} text-white`}
//                                     style={{ width: '30px', height: '30px' }}>
//                                     1
//                                 </div>
//                                 <small>Select Source</small>
//                             </div>
//                         </Col>
//                         <Col>
//                             <div className={`step ${step >= 2 ? 'active' : ''} d-flex flex-column align-items-center`}>
//                                 <div className={`rounded-circle mb-2 d-flex align-items-center justify-content-center ${step >= 2 ? 'bg-primary' : 'bg-secondary'} text-white`}
//                                     style={{ width: '30px', height: '30px' }}>
//                                     2
//                                 </div>
//                                 <small>New Company</small>
//                             </div>
//                         </Col>
//                         <Col>
//                             <div className={`step ${step >= 3 ? 'active' : ''} d-flex flex-column align-items-center`}>
//                                 <div className={`rounded-circle mb-2 d-flex align-items-center justify-content-center ${step >= 3 ? 'bg-primary' : 'bg-secondary'} text-white`}
//                                     style={{ width: '30px', height: '30px' }}>
//                                     3
//                                 </div>
//                                 <small>Split</small>
//                             </div>
//                         </Col>
//                     </Row>
//                 </div>

//                 {renderStepContent()}
//             </Modal.Body>

//             <Modal.Footer>
//                 {step > 1 && !loading && (
//                     <Button variant="outline-secondary" onClick={handleBack}>
//                         Back
//                     </Button>
//                 )}

//                 {step < 3 && (
//                     <Button variant="primary" onClick={handleNext}>
//                         Next
//                     </Button>
//                 )}

//                 {step === 3 && !loading && (
//                     <Button variant="success" onClick={handleSubmit}>
//                         Start Split
//                     </Button>
//                 )}

//                 {loading && (
//                     <Button variant="primary" disabled>
//                         Processing...
//                     </Button>
//                 )}

//                 <Button variant="secondary" onClick={onHide}>
//                     {step === 3 && !loading ? 'Close' : 'Cancel'}
//                 </Button>
//             </Modal.Footer>
//         </Modal>
//     );
// };

// export default CompanySplitWizard;

import React, { useState, useEffect } from 'react';
import {
    Modal,
    Button,
    Form,
    Card,
    Alert,
    ProgressBar,
    Row,
    Col,
    Badge,
    InputGroup
} from 'react-bootstrap';
import { FaBuilding, FaCalendarAlt, FaExclamationTriangle, FaInfoCircle, FaSync } from 'react-icons/fa';
import useCompanySplit from '../hooks/useCompanySplit'

const CompanySplitWizard = ({ show, onHide, companies, fiscalYears, currentCompany, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        sourceCompanyId: '',
        fiscalYearId: '',
        newCompanyName: '',
        deleteAfterSplit: false
    });
    const [validationErrors, setValidationErrors] = useState({});
    const [autoGeneratedName, setAutoGeneratedName] = useState('');

    const {
        loading,
        error,
        progress,
        processLog,
        splitCompanyWithSSE,
        reset
    } = useCompanySplit();

    useEffect(() => {
        if (show) {
            // Initialize form with current company
            if (currentCompany) {
                setFormData(prev => ({
                    ...prev,
                    sourceCompanyId: currentCompany._id
                }));
            }
            reset();
            setStep(1);
            setAutoGeneratedName('');
        }
    }, [show, currentCompany, reset]);

    // Auto-generate company name when source company or fiscal year changes
    useEffect(() => {
        if (formData.sourceCompanyId && formData.fiscalYearId) {
            generateCompanyName();
        }
    }, [formData.sourceCompanyId, formData.fiscalYearId]);

    const generateCompanyName = () => {
        const sourceCompany = companies.find(c => c._id === formData.sourceCompanyId);
        const fiscalYear = fiscalYears.find(fy => fy._id === formData.fiscalYearId);
        
        if (sourceCompany && fiscalYear) {
            const newName = `${sourceCompany.name} (${fiscalYear.name})`;
            setAutoGeneratedName(newName);
            
            // Auto-fill the form field with the generated name
            setFormData(prev => ({
                ...prev,
                newCompanyName: newName
            }));
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear validation error when user types
        if (validationErrors[field]) {
            setValidationErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const handleRegenerateName = () => {
        generateCompanyName();
    };

    const validateStep1 = () => {
        const errors = {};

        if (!formData.sourceCompanyId) {
            errors.sourceCompanyId = 'Please select a source company';
        }

        if (!formData.fiscalYearId) {
            errors.fiscalYearId = 'Please select a fiscal year';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep2 = () => {
        const errors = {};

        if (!formData.newCompanyName?.trim()) {
            errors.newCompanyName = 'Please enter a name for the new company';
        } else if (formData.newCompanyName.length < 2) {
            errors.newCompanyName = 'Company name must be at least 2 characters long';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) {
            setStep(2);
        } else if (step === 2 && validateStep2()) {
            setStep(3);
        }
    };

    const handleBack = () => {
        setStep(step - 1);
    };

    const handleSubmit = async () => {
        try {
            await splitCompanyWithSSE(formData);
            if (onSuccess) {
                onSuccess();
            }
        } catch (err) {
            // Error handled in hook
        }
    };

    const getSelectedCompany = () => {
        return companies.find(c => c._id === formData.sourceCompanyId);
    };

    const getSelectedFiscalYear = () => {
        return fiscalYears.find(fy => fy._id === formData.fiscalYearId);
    };

    const renderStep1 = () => (
        <div>
            <h5 className="mb-4">
                <FaBuilding className="me-2 text-primary" />
                Select Source Company & Fiscal Year
            </h5>

            <Form.Group className="mb-4">
                <Form.Label>Source Company *</Form.Label>
                <Form.Select
                    value={formData.sourceCompanyId}
                    onChange={(e) => handleInputChange('sourceCompanyId', e.target.value)}
                    isInvalid={!!validationErrors.sourceCompanyId}
                >
                    <option value="">Select a company</option>
                    {companies.map(company => (
                        <option key={company._id} value={company._id}>
                            {company.name}
                            {company._id === currentCompany?._id && ' (Current)'}
                        </option>
                    ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                    {validationErrors.sourceCompanyId}
                </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-4">
                <Form.Label>Fiscal Year to Split *</Form.Label>
                <Form.Select
                    value={formData.fiscalYearId}
                    onChange={(e) => handleInputChange('fiscalYearId', e.target.value)}
                    isInvalid={!!validationErrors.fiscalYearId}
                    disabled={!formData.sourceCompanyId}
                >
                    <option value="">Select fiscal year</option>
                    {fiscalYears
                        .filter(fy => fy.company === formData.sourceCompanyId)
                        .map(fiscalYear => (
                            <option key={fiscalYear._id} value={fiscalYear._id}>
                                {fiscalYear.name} ({new Date(fiscalYear.startDate).toLocaleDateString()} - {new Date(fiscalYear.endDate).toLocaleDateString()})
                            </option>
                        ))
                    }
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                    {validationErrors.fiscalYearId}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                    Select the fiscal year you want to separate into a new company
                </Form.Text>
            </Form.Group>

            {formData.sourceCompanyId && formData.fiscalYearId && (
                <Alert variant="info">
                    <FaInfoCircle className="me-2" />
                    <strong>Preview:</strong> This will create a new company containing all data from{' '}
                    <strong>{getSelectedCompany()?.name}</strong> for fiscal year{' '}
                    <strong>{getSelectedFiscalYear()?.name}</strong>
                    {autoGeneratedName && (
                        <div className="mt-2">
                            <strong>New company name:</strong> {autoGeneratedName}
                        </div>
                    )}
                </Alert>
            )}
        </div>
    );

    const renderStep2 = () => (
        <div>
            <h5 className="mb-4">
                <FaBuilding className="me-2 text-primary" />
                New Company Details
            </h5>

            <Form.Group className="mb-4">
                <Form.Label>New Company Name *</Form.Label>
                <InputGroup>
                    <Form.Control
                        type="text"
                        placeholder="Enter name for the new company"
                        value={formData.newCompanyName}
                        onChange={(e) => handleInputChange('newCompanyName', e.target.value)}
                        isInvalid={!!validationErrors.newCompanyName}
                    />
                    <Button 
                        variant="outline-secondary" 
                        onClick={handleRegenerateName}
                        title="Regenerate name from source company and fiscal year"
                    >
                        <FaSync />
                    </Button>
                </InputGroup>
                <Form.Control.Feedback type="invalid">
                    {validationErrors.newCompanyName}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                    {autoGeneratedName && (
                        <span>
                            Auto-generated name: <strong>{autoGeneratedName}</strong>. 
                            You can modify this or click the refresh button to regenerate.
                        </span>
                    )}
                    {!autoGeneratedName && (
                        <span>This will be the name of your new separated company</span>
                    )}
                </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
                <Form.Check
                    type="checkbox"
                    label={
                        <span>
                            <strong>Remove the split fiscal year from source company after separation</strong>
                            <br />
                            <small className="text-muted">
                                If checked, the selected fiscal year and its data will be removed from the source company
                            </small>
                        </span>
                    }
                    checked={formData.deleteAfterSplit}
                    onChange={(e) => handleInputChange('deleteAfterSplit', e.target.checked)}
                />
            </Form.Group>

            <Alert variant="warning">
                <FaExclamationTriangle className="me-2" />
                <strong>Important:</strong> This process may take several minutes depending on your data size.
                Please do not close this window until the process is complete.
            </Alert>
        </div>
    );

    const renderStep3 = () => (
        <div>
            <h5 className="mb-4">
                <FaBuilding className="me-2 text-primary" />
                Splitting Company
            </h5>

            {!loading && !error && (
                <Alert variant="info">
                    <strong>Ready to split company:</strong>
                    <br />
                    Source: {getSelectedCompany()?.name}
                    <br />
                    Fiscal Year: {getSelectedFiscalYear()?.name}
                    <br />
                    New Company: {formData.newCompanyName}
                    <br />
                    <br />
                    Click "Start Split" to begin the process.
                </Alert>
            )}

            {loading && (
                <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <span>Progress: {progress}%</span>
                        <Badge bg="primary">Processing...</Badge>
                    </div>
                    <ProgressBar
                        now={progress}
                        label={`${progress}%`}
                        className="mb-3"
                    />
                </div>
            )}

            {processLog.length > 0 && (
                <Card className="mb-4">
                    <Card.Header>
                        <strong>Process Log</strong>
                    </Card.Header>
                    <Card.Body style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {processLog.map((log, index) => (
                            <div key={index} className="border-bottom pb-1 mb-1 small">
                                <span className="text-muted">[{log.timestamp}]</span> {log.message}
                            </div>
                        ))}
                    </Card.Body>
                </Card>
            )}

            {error && (
                <Alert variant="danger">
                    <strong>Error:</strong> {error}
                </Alert>
            )}
        </div>
    );

    const renderStepContent = () => {
        switch (step) {
            case 1: return renderStep1();
            case 2: return renderStep2();
            case 3: return renderStep3();
            default: return null;
        }
    };

    const getStepTitle = () => {
        switch (step) {
            case 1: return 'Select Source';
            case 2: return 'New Company Details';
            case 3: return 'Split Company';
            default: return '';
        }
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>
                    <FaBuilding className="me-2 text-primary" />
                    Split Company by Fiscal Year
                    <br />
                    <small className="text-muted fs-6">{getStepTitle()}</small>
                </Modal.Title>
            </Modal.Header>

            <Modal.Body>
                {/* Progress Steps */}
                <div className="steps mb-4">
                    <Row className="text-center">
                        <Col>
                            <div className={`step ${step >= 1 ? 'active' : ''} d-flex flex-column align-items-center`}>
                                <div className={`rounded-circle mb-2 d-flex align-items-center justify-content-center ${step >= 1 ? 'bg-primary' : 'bg-secondary'} text-white`}
                                    style={{ width: '30px', height: '30px' }}>
                                    1
                                </div>
                                <small>Select Source</small>
                            </div>
                        </Col>
                        <Col>
                            <div className={`step ${step >= 2 ? 'active' : ''} d-flex flex-column align-items-center`}>
                                <div className={`rounded-circle mb-2 d-flex align-items-center justify-content-center ${step >= 2 ? 'bg-primary' : 'bg-secondary'} text-white`}
                                    style={{ width: '30px', height: '30px' }}>
                                    2
                                </div>
                                <small>New Company</small>
                            </div>
                        </Col>
                        <Col>
                            <div className={`step ${step >= 3 ? 'active' : ''} d-flex flex-column align-items-center`}>
                                <div className={`rounded-circle mb-2 d-flex align-items-center justify-content-center ${step >= 3 ? 'bg-primary' : 'bg-secondary'} text-white`}
                                    style={{ width: '30px', height: '30px' }}>
                                    3
                                </div>
                                <small>Split</small>
                            </div>
                        </Col>
                    </Row>
                </div>

                {renderStepContent()}
            </Modal.Body>

            <Modal.Footer>
                {step > 1 && !loading && (
                    <Button variant="outline-secondary" onClick={handleBack}>
                        Back
                    </Button>
                )}

                {step < 3 && (
                    <Button variant="primary" onClick={handleNext}>
                        Next
                    </Button>
                )}

                {step === 3 && !loading && (
                    <Button variant="success" onClick={handleSubmit}>
                        Start Split
                    </Button>
                )}

                {loading && (
                    <Button variant="primary" disabled>
                        Processing...
                    </Button>
                )}

                <Button variant="secondary" onClick={onHide}>
                    {step === 3 && !loading ? 'Close' : 'Cancel'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default CompanySplitWizard;