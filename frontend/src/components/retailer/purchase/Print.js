import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Table } from 'react-bootstrap';
import { BiPrinter, BiArrowBack, BiSolidFilePdf } from 'react-icons/bi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Loader from '../../Loader';

const PurchaseBillPrint = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [billData, setBillData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [firstBill, setFirstBill] = useState(false);
    const printableRef = useRef();

    useEffect(() => {
        const fetchBillData = async () => {
            try {
                const response = await fetch(`/api/retailer/purchase/${id}/print`, {
                    credentials: 'include'
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch bill data');
                }

                setBillData(data.data);
                setFirstBill(!data.data.bill.firstPrinted);
                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchBillData();
    }, [id]);

    const printBill = () => {
        // Create a clone of the printable content
        const printContents = document.getElementById('printableContent').cloneNode(true);
        const styles = document.getElementById('printStyles').innerHTML;

        // Create a new window for printing
        const printWindow = window.open('', '_blank', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');

        // Write the content to the new window
        printWindow.document.write(`
        <html>
            <head>
                <title>Purchase_Invoice_${billData.bill.billNumber}</title>
                <style>${styles}</style>
            </head>
            <body>
                ${printContents.innerHTML}
                <script>
                    // Automatically trigger print when content is loaded
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 200);
                    };
                </script>
            </body>
        </html>
    `);

        printWindow.document.close();
    };

    const generatePdf = async () => {
        if (!printableRef.current) return;

        try {
            // Show loading indicator
            const originalText = document.querySelector('.pdf-button-text');
            if (originalText) {
                originalText.textContent = 'Generating PDF...';
            }

            // Create a clone of the printable content for PDF generation
            const element = printableRef.current.cloneNode(true);
            element.style.display = 'block';
            element.style.width = '210mm';
            element.style.margin = '0 auto';

            // Create a temporary container for PDF generation
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.appendChild(element);
            document.body.appendChild(tempContainer);

            // Use html2canvas to capture the content
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });

            // Remove the temporary container
            document.body.removeChild(tempContainer);

            // Calculate PDF dimensions
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210; // A4 width in mm
            const pageHeight = 295; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            // Add first page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add additional pages if needed
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Save the PDF
            pdf.save(`Purchase_Invoice_${billData.bill.billNumber}.pdf`);

            // Restore original button text
            if (originalText) {
                originalText.textContent = 'PDF';
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');

            // Restore original button text even if there's an error
            const originalText = document.querySelector('.pdf-button-text');
            if (originalText) {
                originalText.textContent = 'PDF';
            }
        }
    };


    const numberToWords = (num) => {
        const ones = [
            '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen'
        ];

        const tens = [
            '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
        ];

        const scales = ['', 'Thousand', 'Million', 'Billion'];

        const convertHundreds = (num) => {
            let words = '';

            if (num > 99) {
                words += ones[Math.floor(num / 100)] + ' Hundred ';
                num %= 100;
            }

            if (num > 19) {
                words += tens[Math.floor(num / 10)] + ' ';
                num %= 10;
            }

            if (num > 0) {
                words += ones[num] + ' ';
            }

            return words.trim();
        };

        if (num === 0) return 'Zero';
        if (num < 0) return 'Negative ' + numberToWords(Math.abs(num));

        let words = '';

        for (let i = 0; i < scales.length; i++) {
            let unit = Math.pow(1000, scales.length - i - 1);
            let currentNum = Math.floor(num / unit);

            if (currentNum > 0) {
                words += convertHundreds(currentNum) + ' ' + scales[scales.length - i - 1] + ' ';
            }

            num %= unit;
        }

        return words.trim();
    };

    const numberToWordsWithPaisa = (amount) => {
        const rupees = Math.floor(amount);
        const paisa = Math.round((amount - rupees) * 100);

        let result = numberToWords(rupees) + ' Rupees';

        if (paisa > 0) {
            result += ' and ' + numberToWords(paisa) + ' Paisa';
        }

        return result;
    };

    if (loading) return <Loader />;
    if (error) return <div>Error: {error}</div>;
    if (!billData) return <div>No bill data found</div>;

    function formatTo2Decimal(num) {
        const rounded = Math.round(num * 100) / 100;
        const parts = rounded.toString().split(".");
        if (!parts[1]) return parts[0] + ".00";
        if (parts[1].length === 1) return parts[0] + "." + parts[1] + "0";
        return rounded.toString();
    }

    const handleBack = () => {
        navigate(-1);
    };

    return (
        <>
            <style id="printStyles">
                {`
                @media print {
                    @page {
                        size: A4;
                        margin: 5mm;
                    }

                    body {
                        font-family: 'Arial Narrow', Arial, sans-serif;
                        font-size: 9pt;
                        line-height: 1.2;
                        color: #000;
                        background: white;
                        margin: 0;
                        padding: 0;
                    }

                    .print-invoice-container {
                        width: 100%;
                        max-width: 210mm;
                        margin: 0 auto;
                        padding: 2mm;
                    }

                    .print-invoice-header {
                        text-align: center;
                        margin-bottom: 3mm;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 2mm;
                    }

                    .print-invoice-title {
                        font-size: 12pt;
                        font-weight: bold;
                        margin: 2mm 0;
                        text-transform: uppercase;
                    }

                    .print-company-name {
                        font-size: 16pt;
                        font-weight: bold;
                    }

                    .print-company-details {
                        font-size: 8pt;
                        font-weight:bold;
                        margin: 1mm 0;
                    }

                    .print-invoice-details {
                        display: flex;
                        justify-content: space-between;
                        margin: 2mm 0;
                        font-size: 8pt;
                    }

                    .print-invoice-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 3mm 0;
                        font-size: 8pt;
                        border: none;
                    }

                    .print-invoice-table thead {
                        border-top: 1px dashed #000;
                        border-bottom: 1px dashed #000;
                    }

                    .print-invoice-table th {
                        background-color: transparent;
                        border: none;
                        padding: 1mm;
                        text-align: left;
                        font-weight: bold;
                    }

                    .print-invoice-table td {
                        border: none;
                        padding: 1mm;
                        border-bottom: 1px solid #eee;
                    }

                    .print-text-right {
                        text-align: right;
                    }

                    .print-text-center {
                        text-align: center;
                    }

                    .print-amount-in-words {
                        font-size: 8pt;
                        margin: 2mm 0;
                        padding: 1mm;
                        border: 1px dashed #000;
                    }

                    .print-signature-area {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 5mm;
                        font-size: 8pt;
                    }

                    .print-signature-box {
                        text-align: center;
                        width: 30%;
                        border-top: 1px dashed #000;
                        padding-top: 1mm;
                        font-weight:bold;
                    }

                    .print-totals-table {
                        width: 60%;
                        margin-left: auto;
                        border-collapse: collapse;
                        font-size: 8pt;
                    }

                    .print-totals-table td {
                        padding: 1mm;
                    }

                    .print-footer {
                        text-align: center;
                        font-size: 7pt;
                        margin-top: 3mm;
                        border-top: 1px dashed #000;
                        padding-top: 1mm;
                    }

                    .no-print {
                        display: none;
                    }

                    /* Hide screen version when printing */
                    .screen-version {
                        display: none;
                    }
                }

                @media screen {
                    /* Hide print version on screen */
                    .print-version {
                        display: none;
                    }

                    .container {
                        max-width: 100%;
                        padding: 10px;
                    }

                    .card {
                        border: 1px solid #ddd;
                        margin: 10px 0;
                        padding: 15px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    }

                    .header {
                        text-align: center;
                        margin-bottom: 15px;
                    }

                    .header h1 {
                        margin: 0;
                        font-size: 30px;
                        font-weight: bold;
                    }

                    .header h2 {
                        font-size: 18px;
                        margin: 10px 0;
                    }

                    .header h4 {
                        font-size: 14px;
                        margin: 10px 0;
                    }

                    .details-container {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 15px;
                        font-size: 13px;
                    }

                    .table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                        font-size: 13px;
                    }

                    .table th {
                        background-color: #f0f0f0;
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }

                    .table td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }

                    .amount-in-words {
                        font-style: italic;
                        margin-top: 10px;
                        font-size: 13px;
                    }

                    .signature-area {
                        margin-top: 50px;
                        display: flex;
                        justify-content: space-between;
                    }

                    .signature-box {
                        width: 30%;
                        text-align: center;
                        border-top: 1px dashed #000;
                        padding-top: 10px;
                        font-size: 13px;
                    }

                    .total-table {
                        width: 40%;
                        float: right;
                        margin-top: 20px;
                        font-size: 13px;
                    }

                    hr {
                        border-top: 1px solid #000;
                        margin: 10px 0;
                    }
                }
                `}
            </style>

            {/* Screen Version (visible only on screen) */}
            <div className="screen-version">
                <Container>
                    <div className="d-flex justify-content-end mb-3">
                        <Button variant="secondary" className="me-2" onClick={handleBack}>
                            <BiArrowBack /> Back
                        </Button>
                        <Button variant="primary" className="me-2" onClick={generatePdf}>
                            <BiSolidFilePdf /> <span className="pdf-button-text">PDF</span>
                        </Button>
                        <Button variant="info" onClick={printBill}>
                            <BiPrinter /> Print
                        </Button>
                    </div>

                    <Card>
                        <div className="header">
                            <h1>{billData.currentCompanyName}</h1>
                            <h4>
                                {billData.currentCompany.address}, {billData.currentCompany.city}
                                <br />
                                Tel: {billData.currentCompany.phone} | PAN: {billData.currentCompany.pan}
                            </h4>
                            <h2 className="bordered">PURCHASE INVOICE</h2>
                        </div>

                        <div className="details-container">
                            <div className="left">
                                <div><strong>Supplier:</strong> {billData.bill.account.name}</div>
                                <div><strong>Address:</strong> {billData.bill.account.address || 'N/A'}</div>
                                <div><strong>PAN:</strong> {billData.bill.account.pan || 'N/A'}</div>
                                <div><strong>Payment Mode:</strong> {billData.bill.paymentMode}</div>
                            </div>
                            <div className="right">
                                <div><strong>Invoice No:</strong> {billData.bill.billNumber}</div>
                                <div><strong>Supplier Inv No:</strong> {billData.bill.partyBillNumber}</div>
                                <div><strong>Transaction Date:</strong> {new Date(billData.bill.transactionDate).toLocaleDateString()}</div>
                                <div><strong>Inv. Issue Date:</strong> {new Date(billData.bill.date).toLocaleDateString()}</div>
                            </div>
                        </div>

                        <hr />

                        <Table bordered>
                            <thead>
                                <tr>
                                    <th>S.N</th>
                                    <th>Code</th>
                                    <th>HSN</th>
                                    <th>Description of Goods</th>
                                    <th>Batch</th>
                                    <th>Expiry</th>
                                    <th>Unit</th>
                                    <th>Qty</th>
                                    <th>Free</th>
                                    <th>Rate</th>
                                    <th>MRP</th>
                                    <th>%</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {billData.bill.items.map((item, i) => (
                                    <tr key={i}>
                                        <td>{i + 1}</td>
                                        <td>{item.item.uniqueNumber}</td>
                                        <td>{item.item.hscode}</td>
                                        <td>
                                            {item.item.vatStatus === 'vatExempt' ? (
                                                <>
                                                    {item.item.name} <span style={{ color: 'red' }}>*</span>
                                                </>
                                            ) : (
                                                item.item.name
                                            )}
                                        </td>
                                        <td>{item.batchNumber}</td>
                                        <td>{new Date(item.expiryDate).toLocaleDateString()}</td>
                                        <td>{item.item.unit.name}</td>
                                        <td>{item.Altquantity}</td>
                                        <td>{item.Altbonus}</td>
                                        <td>{formatTo2Decimal(item.AltpuPrice)}</td>
                                        <td>{formatTo2Decimal(item.mrp)}</td>
                                        <td>{formatTo2Decimal(item.marginPercentage)}</td>
                                        <td>{formatTo2Decimal(item.Altquantity * item.AltpuPrice)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>

                        <div className="total-table">
                            <table className="table">
                                <tbody>
                                    <tr>
                                        <td><strong>Sub Total:</strong></td>
                                        <td className="text-right">{formatTo2Decimal(billData.bill.subTotal)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Discount ({billData.bill.discountPercentage}%):</strong></td>
                                        <td className="text-right">{formatTo2Decimal(billData.bill.discountAmount)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>CC Charge:</strong></td>
                                        <td className="text-right">{formatTo2Decimal(billData.bill.totalCCAmount)}</td>
                                    </tr>
                                    {!billData.bill.isVatExempt && (
                                        <>
                                            <tr>
                                                <td><strong>Taxable Amount:</strong></td>
                                                <td className="text-right">{formatTo2Decimal(billData.bill.taxableAmount)}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>VAT ({billData.bill.vatPercentage}%):</strong></td>
                                                <td className="text-right">{formatTo2Decimal(billData.bill.taxableAmount * billData.bill.vatPercentage / 100)}</td>
                                            </tr>
                                        </>
                                    )}
                                    <tr>
                                        <td><strong>Round Off:</strong></td>
                                        <td className="text-right">{formatTo2Decimal(billData.bill.roundOffAmount)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Grand Total:</strong></td>
                                        <td className="text-right">{formatTo2Decimal(billData.bill.totalAmount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="amount-in-words">
                            <strong>In Words:</strong> {numberToWordsWithPaisa(billData.bill.totalAmount)} Only.
                        </div>

                        <div className="signature-area">
                            <div className="signature-box">Prepared By</div>
                            <div className="signature-box">Checked By</div>
                            <div className="signature-box">Received By</div>
                        </div>
                    </Card>
                </Container>
            </div>

            {/* Printable Version (hidden on screen, visible when printing) */}
            <div id="printableContent" className="print-version" ref={printableRef}>
                <div className="print-invoice-container">
                    <div className="print-invoice-header">
                        <div className="print-company-name">{billData.currentCompanyName}</div>
                        <div className="print-company-details">
                            {billData.currentCompany.address} {billData.currentCompany.city} |
                            Tel: {billData.currentCompany.phone} | PAN: {billData.currentCompany.pan}
                        </div>
                        <div className="print-invoice-title">PURCHASE INVOICE</div>
                    </div>

                    <div className="print-invoice-details">
                        <div>
                            <div><strong>Supplier:</strong> {billData.bill.account.name}</div>
                            <div><strong>Address:</strong> {billData.bill.account.address || 'N/A'}</div>
                            <div><strong>PAN:</strong> {billData.bill.account.pan || 'N/A'}</div>
                            <div><strong>Payment Mode:</strong> {billData.bill.paymentMode}</div>
                        </div>
                        <div>
                            <div><strong>Invoice No:</strong> {billData.bill.billNumber}</div>
                            <div><strong>Supplier Inv No:</strong> {billData.bill.partyBillNumber || 'N/A'}</div>
                            <div><strong>Transaction Date:</strong> {new Date(billData.bill.transactionDate).toLocaleDateString()}</div>
                            <div><strong>Inv. Issue Date:</strong> {new Date(billData.bill.date).toLocaleDateString()}</div>
                        </div>
                    </div>

                    <table className="print-invoice-table">
                        <thead>
                            <tr>
                                <th>SN</th>
                                <th>Code</th>
                                <th>HSN</th>
                                <th>Description of Goods</th>
                                <th>Batch</th>
                                <th>Expiry</th>
                                <th>Unit</th>
                                <th>Qty</th>
                                <th>Free</th>
                                <th>Rate</th>
                                <th>MRP</th>
                                <th>%</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {billData.bill.items.map((item, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>{item.item.uniqueNumber}</td>
                                    <td>{item.item.hscode}</td>
                                    <td>
                                        {item.item.vatStatus === 'vatExempt' ? (
                                            <>
                                                {item.item.name} <span style={{ color: 'red' }}>*</span>
                                            </>
                                        ) : (
                                            item.item.name
                                        )}
                                    </td>
                                    <td>{item.batchNumber}</td>
                                    <td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}</td>
                                    <td>{item.item.unit.name}</td>
                                    <td>{item.Altquantity}</td>
                                    <td>{item.Altbonus}</td>
                                    <td>{formatTo2Decimal(item.AltpuPrice)}</td>
                                    <td>{formatTo2Decimal(item.mrp)}</td>
                                    <td>{formatTo2Decimal(item.marginPercentage)}</td>
                                    <td>{formatTo2Decimal(item.Altquantity * item.AltpuPrice)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tr>
                            <td colSpan="13" style={{ borderBottom: '1px dashed #000' }}></td>
                        </tr>
                    </table>

                    <table className="print-totals-table">
                        <tbody>
                            <tr>
                                <td><strong>Sub Total:</strong></td>
                                <td className="print-text-right">{formatTo2Decimal(billData.bill.subTotal)}</td>
                            </tr>
                            <tr>
                                <td><strong>Discount ({billData.bill.discountPercentage}%):</strong></td>
                                <td className="print-text-right">{formatTo2Decimal(billData.bill.discountAmount)}</td>
                            </tr>
                            <tr>
                                <td><strong>CC Charge:</strong></td>
                                <td className="print-text-right">{formatTo2Decimal(billData.bill.totalCCAmount)}</td>
                            </tr>
                            {!billData.bill.isVatExempt && (
                                <>
                                    <tr>
                                        <td><strong>Taxable Amount:</strong></td>
                                        <td className="print-text-right">{formatTo2Decimal(billData.bill.taxableAmount)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>VAT ({billData.bill.vatPercentage}%):</strong></td>
                                        <td className="print-text-right">{formatTo2Decimal(billData.bill.taxableAmount * billData.bill.vatPercentage / 100)}</td>
                                    </tr>
                                </>
                            )}
                            <tr>
                                <td><strong>Round Off:</strong></td>
                                <td className="print-text-right">{formatTo2Decimal(billData.bill.roundOffAmount)}</td>
                            </tr>
                            <tr>
                                <td><strong>Grand Total:</strong></td>
                                <td className="print-text-right">{formatTo2Decimal(billData.bill.totalAmount)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="print-amount-in-words">
                        <strong>In Words:</strong> {numberToWordsWithPaisa(billData.bill.totalAmount)} Only.
                    </div>

                    <br /><br />
                    <div className="print-signature-area">
                        <div className="print-signature-box">Prepared By</div>
                        <div className="print-signature-box">Checked By</div>
                        <div className="print-signature-box">Approved By</div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PurchaseBillPrint;