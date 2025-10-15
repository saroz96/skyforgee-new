import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container,
    Card,
    Row,
    Col,
    ListGroup,
    Button,
    Badge,
    Modal,
    Form,
    Alert
} from 'react-bootstrap';
import { FaBarcode, FaArrowLeft } from 'react-icons/fa';
import axios from 'axios';
import NotificationToast from '../../NotificationToast';

const ViewItems = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState({
        show: false,
        message: '',
        type: 'success' // 'success' or 'error'
    });
    const [printSettings, setPrintSettings] = useState({
        labelWidth: 70,
        labelHeight: 40,
        labelsPerRow: 3,
        barcodeType: 'code128',
        quantity: 1,
        saveSettings: false
    });
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [currentPrintEntry, setCurrentPrintEntry] = useState(null);
    // const [statusMessage, setStatusMessage] = useState('');

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // useEffect(() => {
    //     const fetchItemData = async () => {
    //         try {
    //             // First try to get the item data which might include fiscal year info
    //             const itemResponse = await api.get(`/api/retailer/items/${id}`);
    //             if (!itemResponse.data || !itemResponse.data.data) {
    //                 throw new Error('Item data not found in response');
    //             }

    //             const { data: itemData } = itemResponse.data;

    //             // Try to get fiscal year from the item data first
    //             let fiscalYear = itemData.item.fiscalYear;

    //             // Find the opening stock data for the current fiscal year
    //             const currentOpeningStock = itemData.item.openingStockByFiscalYear?.find(
    //                 stock => stock.fiscalYear &&
    //                     (stock.fiscalYear._id?.toString() === fiscalYear?._id?.toString() ||
    //                         stock.fiscalYear.toString() === fiscalYear?._id?.toString())
    //             );

    //             const processedItem = {
    //                 ...itemData.item,
    //                 name: itemData.item.name || 'N/A',
    //                 hscode: itemData.item.hscode || 'N/A',
    //                 vatStatus: itemData.item.vatStatus || 'N/A',
    //                 status: itemData.item.status || 'active',
    //                 currentOpeningStock: currentOpeningStock || {
    //                     openingStock: 0,
    //                     openingStockValue: '0.00',
    //                     salesPrice: 0,
    //                     purchasePrice: '0.00'
    //                 },
    //                 stockEntries: itemData.stockEntries || [],
    //                 printPreferences: itemData.printPreferences || {
    //                     labelWidth: 70,
    //                     labelHeight: 40,
    //                     labelsPerRow: 3,
    //                     barcodeType: 'code128',
    //                     defaultQuantity: 1
    //                 }
    //             };

    //             setItem(processedItem);
    //             setPrintSettings(prev => ({
    //                 ...prev,
    //                 ...processedItem.printPreferences
    //             }));
    //         } catch (err) {
    //             setError(err.message || 'Failed to fetch item details');
    //             console.error('Fetch error:', err);
    //         } finally {
    //             setLoading(false);
    //         }
    //     };

    //     fetchItemData();
    // }, [id]);

    useEffect(() => {
        const fetchItemData = async () => {
            try {
                const itemResponse = await api.get(`/api/retailer/items/${id}`);
                if (!itemResponse.data || !itemResponse.data.data) {
                    throw new Error('Item data not found in response');
                }

                const { data: responseData } = itemResponse.data;
                const { item, stockInfo } = responseData;

                // Use the already-processed stockInfo from the API
                const processedItem = {
                    ...item,
                    name: item.name || 'N/A',
                    hscode: item.hscode || 'N/A',
                    vatStatus: item.vatStatus || 'N/A',
                    status: item.status || 'active',
                    currentOpeningStock: {
                        openingStock: stockInfo.openingStock || 0,
                        openingStockValue: stockInfo.openingStockValue || '0.00',
                        salesPrice: stockInfo.salesPrice || 0,
                        purchasePrice: stockInfo.purchasePrice.toFixed(2) || '0.00'
                    },
                    stockEntries: item.stockEntries || [],
                    printPreferences: responseData.printPreferences || {
                        labelWidth: 70,
                        labelHeight: 40,
                        labelsPerRow: 3,
                        barcodeType: 'code128',
                        defaultQuantity: 1
                    }
                };

                setItem(processedItem);
                setPrintSettings(prev => ({
                    ...prev,
                    ...processedItem.printPreferences
                }));
            } catch (err) {
                setError(err.message || 'Failed to fetch item details');
                console.error('Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchItemData();
    }, [id]);


    const toggleItemStatus = async () => {
        try {
            const newStatus = item.status === 'active' ? 'inactive' : 'active';
            const response = await api.post(`/api/retailer/items/${item._id}/status`, {
                status: newStatus
            });

            if (response.data.success) {
                setItem(prev => ({ ...prev, status: newStatus }));
                setToast({
                    show: true,
                    message: `Item status updated to ${newStatus}`,
                    type: 'success'
                });
            } else {
                throw new Error(response.data.error || 'Failed to update status');
            }
        } catch (err) {
            // setError(err.response?.data?.error || err.message || 'Failed to update status');
            // Show error toast
            setToast({
                show: true,
                message: err.response?.data?.error || err.message || 'Failed to update status',
                type: 'error'
            });
        }
    };

    const handlePrintBarcode = (entry) => {
        setCurrentPrintEntry(entry);
        setShowPrintModal(true);
    };

    const confirmPrint = () => {
        const { labelWidth, labelHeight, labelsPerRow, barcodeType, quantity } = printSettings;
        const printWindow = window.open('', '_blank');

        printWindow.document.write(`
            <html>
            <head>
                <title>Barcode Labels</title>
                <style>
                    @page { size: A4; margin: 0; }
                    .label-grid {
                        display: grid;
                        grid-template-columns: repeat(${labelsPerRow}, 1fr);
                        gap: 0.1in;
                        padding: 0.25in;
                    }
                    .barcode-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        page-break-inside: avoid;
                        height: ${labelHeight * 0.0393701}in;
                        padding: 0.1in;
                    }
                    .barcode-image {
                        width: 100%;
                        height: 70%;
                        object-fit: contain;
                    }
                </style>
            </head>
            <body>
                <div class="label-grid">
                    ${Array.from({ length: quantity }, (_, i) => `
                        <div class="barcode-container">
                            <img src="/api/item/${item._id}/barcode/${currentPrintEntry._id}/${labelWidth}/${labelHeight}/${barcodeType}"
                                class="barcode-image"
                                onload="window.imagesLoaded = (window.imagesLoaded || 0) + 1">
                            <div>${item.name}</div>
                            <div>Batch: ${currentPrintEntry.batchNumber}</div>
                            <div>MRP: ₹${currentPrintEntry.mrp.toFixed(2)}</div>
                            <div>Exp: ${new Date(currentPrintEntry.expiryDate).toLocaleDateString()}</div>
                        </div>
                    `).join('')}
                </div>
                <script>
                    let checkInterval = setInterval(() => {
                        if (window.imagesLoaded >= ${quantity}) {
                            clearInterval(checkInterval);
                            window.print();
                            setTimeout(() => window.close(), 500);
                        }
                    }, 100);
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();

        if (printSettings.saveSettings) {
            api.post('/api/retailer/user/print-preferences', printSettings);
        }

        setShowPrintModal(false);
    };

    if (loading) return (
        <Container className="mt-4">
            <div className="text-center">Loading item details...</div>
        </Container>
    );

    if (error) return (
        <Container className="mt-4">
            <Alert variant="danger">{error}</Alert>
            <Button variant="primary" onClick={() => navigate(-1)}>
                <FaArrowLeft /> Back
            </Button>
        </Container>
    );

    if (!item) return (
        <Container className="mt-4">
            <Alert variant="warning">Item not found</Alert>
            <Button variant="primary" onClick={() => navigate(-1)}>
                <FaArrowLeft /> Back
            </Button>
        </Container>
    );

    return (
        <Container className="mt-4">
            <NotificationToast
                show={toast.show}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast({ ...toast, show: false })}
            />

            <Card className="shadow-lg p-4">
                <Card.Header className="text-center">
                    <h2 style={{ textDecoration: 'underline' }}>Item Details</h2>
                </Card.Header>

                <Card.Body>
                    <Row>
                        <Col md={4}>
                            <h5 className="card-title">Details:</h5>
                            <ListGroup variant="flush">
                                <ListGroup.Item>
                                    <strong>Name:</strong> {item.name}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>HSN:</strong> {item.hscode || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>VAT Status:</strong> {item.vatStatus || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Main Unit:</strong> {item.mainUnit?.name || 'No Main Unit'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>WS Unit:</strong> {item.WSUnit || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Unit:</strong> {item.unit?.name || 'No Unit'}
                                </ListGroup.Item>
                            </ListGroup>
                        </Col>

                        <Col md={4}>
                            <h5 className="card-title">ID: {item._id}</h5>
                            <ListGroup variant="flush">
                                <ListGroup.Item>
                                    <strong>Sales Price:</strong> {item.currentOpeningStock?.salesPrice?.toFixed(2) || '0.00'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Purchase Price:</strong> {item.currentOpeningStock?.purchasePrice || '0.00'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Opening Stock:</strong> {item.currentOpeningStock?.openingStock || 0}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Opening Stock Value:</strong> {item.currentOpeningStock?.openingStockValue || '0.00'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Re-Order Level:</strong> {item.reorderLevel || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Category:</strong> {item.category?.name || 'No Category'}
                                </ListGroup.Item>
                            </ListGroup>
                        </Col>

                        <Col md={4}>
                            <Button
                                variant={item.status === 'active' ? 'danger' : 'success'}
                                onClick={toggleItemStatus}
                                className="status-btn mb-3"
                            >
                                {item.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>

                            <ListGroup variant="flush">
                                <ListGroup.Item>
                                    <strong>Status:</strong>{' '}
                                    <Badge bg={item.status === 'active' ? 'success' : 'danger'}>
                                        {item.status?.toUpperCase() || 'UNKNOWN'}
                                    </Badge>
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Barcode:</strong> {item.barcodeNumber || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Unique ID:</strong> {item.uniqueNumber || 'N/A'}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Created:</strong> {new Date(item.createdAt).toLocaleDateString()}
                                </ListGroup.Item>
                            </ListGroup>
                        </Col>
                    </Row>

                    <hr />

                    <Row>
                        <h5 className="card-title"><strong>Composition: </strong></h5>
                        <ListGroup variant="flush">
                            {item.composition?.length > 0 ? (
                                item.composition.map(comp => (
                                    <ListGroup.Item key={comp._id}>
                                        {comp.uniqueNumber} - {comp.name}
                                    </ListGroup.Item>
                                ))
                            ) : (
                                <ListGroup.Item>No Composition</ListGroup.Item>
                            )}
                        </ListGroup>
                    </Row>
                </Card.Body>

                <Col className="mb-3">
                    <Button variant="primary" onClick={() => navigate(-1)}>
                        <FaArrowLeft /> Back
                    </Button>
                </Col>
            </Card>

            {/* Barcode Printing Section */}
            <Card className="mt-4">
                <Card.Header>
                    <h5 className="mb-0">Barcode Printing</h5>
                </Card.Header>
                <Card.Body>
                    {item.stockEntries?.length > 0 ? (
                        item.stockEntries.map(entry => (
                            <div key={entry._id} className="stock-entry mb-3 p-3 border rounded">
                                <Row>
                                    <Col md={6}>
                                        <strong>Batch:</strong> {entry.batchNumber || 'N/A'}<br />
                                        <strong>Expiry:</strong> {entry.expiryDate ? new Date(entry.expiryDate).toLocaleDateString() : 'N/A'}<br />
                                        <strong>MRP:</strong> {entry.mrp?.toFixed(2) || '0.00'}<br />
                                        <strong>WS Unit:</strong> {entry.WSUnit || 'N/A'}
                                    </Col>
                                    <Col md={6} className="text-end">
                                        <Button
                                            variant="primary"
                                            onClick={() => handlePrintBarcode(entry)}
                                            disabled={!entry._id}
                                        >
                                            <FaBarcode /> Print Barcode
                                        </Button>
                                    </Col>
                                </Row>
                            </div>
                        ))
                    ) : (
                        <Alert variant="info">No stock entries available</Alert>
                    )}
                </Card.Body>
            </Card>

            {/* Print Modal */}
            <Modal show={showPrintModal} onHide={() => setShowPrintModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Print Settings</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Row className="g-3">
                            <Col md={4}>
                                <Form.Label>Label Width (mm)</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="20"
                                    max="200"
                                    value={printSettings.labelWidth}
                                    onChange={(e) => setPrintSettings({ ...printSettings, labelWidth: e.target.value })}
                                />
                            </Col>
                            <Col md={4}>
                                <Form.Label>Label Height (mm)</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="20"
                                    max="200"
                                    value={printSettings.labelHeight}
                                    onChange={(e) => setPrintSettings({ ...printSettings, labelHeight: e.target.value })}
                                />
                            </Col>
                            <Col md={4}>
                                <Form.Label>Barcode Type</Form.Label>
                                <Form.Select
                                    value={printSettings.barcodeType}
                                    onChange={(e) => setPrintSettings({ ...printSettings, barcodeType: e.target.value })}
                                >
                                    <option value="code128">Code 128</option>
                                    <option value="code39">Code 39</option>
                                    <option value="qr">QR Code</option>
                                </Form.Select>
                            </Col>
                            <Col md={4}>
                                <Form.Label>Labels per Row</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="1"
                                    max="6"
                                    value={printSettings.labelsPerRow}
                                    onChange={(e) => setPrintSettings({ ...printSettings, labelsPerRow: e.target.value })}
                                />
                            </Col>
                            <Col md={4}>
                                <Form.Label>Quantity</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={printSettings.quantity}
                                    onChange={(e) => setPrintSettings({ ...printSettings, quantity: e.target.value })}
                                />
                            </Col>
                            <Col xs={12}>
                                <Form.Check
                                    type="checkbox"
                                    label="Save these settings as default"
                                    checked={printSettings.saveSettings}
                                    onChange={(e) => setPrintSettings({ ...printSettings, saveSettings: e.target.checked })}
                                />
                            </Col>
                        </Row>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowPrintModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={confirmPrint}>
                        Print
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default ViewItems;