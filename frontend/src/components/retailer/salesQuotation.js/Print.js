import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Table } from 'react-bootstrap';
import { BiPrinter, BiArrowBack, BiSolidFilePdf } from 'react-icons/bi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const SalesQuotationPrint = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [quotationData, setQuotationData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const printableRef = useRef();

    useEffect(() => {
        const fetchQuotationData = async () => {
            try {
                const response = await fetch(`/api/retailer/sales-quotation/${id}/print`, {
                    credentials: 'include'
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch quotation data');
                }

                setQuotationData(data.data);
                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchQuotationData();
    }, [id]);

    const printQuotation = () => {
        const printContents = document.getElementById('printableContent').cloneNode(true);
        const styles = document.getElementById('printStyles').innerHTML;

        const printWindow = window.open('', '_blank', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Sales_Quotation_${quotationData.salesQuotation.billNumber}</title>
                    <style>${styles}</style>
                </head>
                <body>
                    ${printContents.innerHTML}
                    <script>
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
            const originalText = document.querySelector('.pdf-button-text');
            if (originalText) {
                originalText.textContent = 'Generating PDF...';
            }

            const element = printableRef.current.cloneNode(true);
            element.style.display = 'block';
            element.style.width = '210mm';
            element.style.margin = '0 auto';

            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.appendChild(element);
            document.body.appendChild(tempContainer);

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });

            document.body.removeChild(tempContainer);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210;
            const pageHeight = 295;
            const imgHeight = canvas.height * imgWidth / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`Sales_Quotation_${quotationData.salesQuotation.billNumber}.pdf`);

            if (originalText) {
                originalText.textContent = 'PDF';
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');

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

    const handleBack = () => {
        navigate(-1);
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!quotationData) return <div>No quotation data found</div>;

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

                    .print-quotation-container {
                        width: 100%;
                        max-width: 210mm;
                        margin: 0 auto;
                        padding: 2mm;
                    }

                    .print-quotation-header {
                        text-align: center;
                        margin-bottom: 3mm;
                        border-bottom: 1px solid #000;
                        padding-bottom: 2mm;
                    }

                    .print-quotation-title {
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
                        margin: 1mm 0;
                        font-weight:bold;
                    }

                    .print-quotation-details {
                        display: flex;
                        justify-content: space-between;
                        margin: 2mm 0;
                        font-size: 8pt;
                    }

                    .print-quotation-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 3mm 0;
                        font-size: 8pt;
                        border: none;
                    }

                    .print-quotation-table thead {
                        border-top: 1px solid #000;
                        border-bottom: 1px solid #000;
                    }

                    .print-quotation-table th {
                        background-color: transparent;
                        border: none;
                        padding: 1mm;
                        text-align: left;
                        font-weight: bold;
                    }

                    .print-quotation-table td {
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
                        border-top: 1px solid #000;
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
                        border-top: 1px solid #000;
                        padding-top: 1mm;
                    }

                    .no-print {
                        display: none;
                    }

                    .screen-version {
                        display: none;
                    }
                }

                @media screen {
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
                        border-top: 1px solid #000;
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

            {/* Screen Version */}
            <div className="screen-version">
                <Container>
                    <div className="d-flex justify-content-end mb-3">
                        <Button variant="secondary" className="me-2" onClick={handleBack}>
                            <BiArrowBack /> Back
                        </Button>
                        <Button variant="primary" className="me-2" onClick={generatePdf}>
                            <BiSolidFilePdf /> <span className="pdf-button-text">PDF</span>
                        </Button>
                        <Button variant="info" onClick={printQuotation}>
                            <BiPrinter /> Print
                        </Button>
                    </div>

                    <Card>
                        <div className="header">
                            <h1>{quotationData.currentCompanyName}</h1>
                            <h4>
                                {quotationData.currentCompany.address}, {quotationData.currentCompany.city}
                                <br />
                                Tel: {quotationData.currentCompany.phone} | PAN: {quotationData.currentCompany.pan}
                            </h4>
                            <h2>SALES QUOTATION</h2>
                        </div>

                        <div className="details-container">
                            <div className="left">
                                <div><strong>M/S:</strong> {quotationData.salesQuotation.account?.name || quotationData.salesQuotation.cashAccount || 'Account Not Found'}</div>
                                <div><strong>Address:</strong> {quotationData.salesQuotation.account?.address || quotationData.salesQuotation.cashAccountAddress || 'N/A'}</div>
                                <div><strong>PAN:</strong> {quotationData.salesQuotation.account?.pan || quotationData.salesQuotation.cashAccountPan || 'N/A'} | <strong>Tel:</strong> {quotationData.salesQuotation.account?.phone || quotationData.salesQuotation.cashAccountPhone || 'N/A'}</div>
                                <div><strong>Email:</strong> {quotationData.salesQuotation.account?.email || quotationData.salesQuotation.cashAccountEmail || 'N/A'}</div>
                            </div>
                            <div className="right">
                                <div><strong>Quotation No:</strong> {quotationData.salesQuotation.billNumber}</div>
                                <div><strong>Validity Periods:</strong> {new Date(quotationData.salesQuotation.transactionDate).toLocaleDateString()}</div>
                                <div><strong>Quotation Issue Date:</strong> {new Date(quotationData.salesQuotation.date).toLocaleDateString()}</div>
                                <div><strong>Mode of Payment:</strong> {quotationData.salesQuotation.paymentMode}</div>
                            </div>
                        </div>

                        <hr />

                        <Table bordered>
                            <thead>
                                <tr>
                                    <th>S.N.</th>
                                    <th>#</th>
                                    <th>HSN</th>
                                    <th>Description of Goods</th>
                                    <th>Description</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
                                    <th>Rate (Rs.)</th>
                                    <th>Total (Rs.)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotationData.salesQuotation.items.map((item, i) => (
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
                                        <td>{item.description}</td>
                                        <td>{item.quantity}</td>
                                        <td>{item.item.unit?.name || ''}</td>
                                        <td>{item.price.toFixed(2)}</td>
                                        <td>{(item.quantity * item.price).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>

                        <div className="total-table">
                            <table className="table">
                                <tbody>
                                    <tr>
                                        <td><strong>Sub-Total:</strong></td>
                                        <td className="text-right">{quotationData.salesQuotation.subTotal.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Discount ({quotationData.salesQuotation.discountPercentage}%):</strong></td>
                                        <td className="text-right">{quotationData.salesQuotation.discountAmount.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Non-Taxable:</strong></td>
                                        <td className="text-right">{quotationData.salesQuotation.nonVatSales.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Taxable Amount:</strong></td>
                                        <td className="text-right">{quotationData.salesQuotation.taxableAmount.toFixed(2)}</td>
                                    </tr>
                                    {!quotationData.salesQuotation.isVatExempt && (
                                        <tr>
                                            <td><strong>VAT ({quotationData.salesQuotation.vatPercentage}%):</strong></td>
                                            <td className="text-right">{(quotationData.salesQuotation.taxableAmount * quotationData.salesQuotation.vatPercentage / 100).toFixed(2)}</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td><strong>Round Off:</strong></td>
                                        <td className="text-right">{quotationData.salesQuotation.roundOffAmount.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Grand Total:</strong></td>
                                        <td className="text-right">{quotationData.salesQuotation.totalAmount.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="amount-in-words">
                            <strong>In Words:</strong> {numberToWordsWithPaisa(quotationData.salesQuotation.totalAmount)} Only.
                        </div>

                        {quotationData.salesQuotation.description && (
                            <div className="mt-3">
                                <strong>Note:</strong> {quotationData.salesQuotation.description}
                            </div>
                        )}

                        <div className="signature-area">
                            <div className="signature-box">Received By</div>
                            <div className="signature-box">Prepared By: {quotationData.salesQuotation.user.name}</div>
                            <div className="signature-box">For: {quotationData.currentCompanyName}</div>
                        </div>
                    </Card>
                </Container>
            </div>

            {/* Printable Version */}
            <div id="printableContent" className="print-version" ref={printableRef}>
                <div className="print-quotation-container">
                    <div className="print-quotation-header">
                        <div className="print-company-name">{quotationData.currentCompanyName}</div>
                        <div className="print-company-details">
                            {quotationData.currentCompany.address} | Tel: {quotationData.currentCompany.phone} | PAN: {quotationData.currentCompany.pan}
                        </div>
                        <div className="print-quotation-title">SALES QUOTATION</div>
                    </div>

                    <div className="print-quotation-details">
                        <div>
                            <div><strong>M/S:</strong> {quotationData.salesQuotation.account?.name || quotationData.salesQuotation.cashAccount || 'Account Not Found'}</div>
                            <div><strong>Address:</strong> {quotationData.salesQuotation.account?.address || quotationData.salesQuotation.cashAccountAddress || 'N/A'}</div>
                            <div><strong>PAN:</strong> {quotationData.salesQuotation.account?.pan || quotationData.salesQuotation.cashAccountPan || 'N/A'} | <strong>Tel:</strong> {quotationData.salesQuotation.account?.phone || quotationData.salesQuotation.cashAccountPhone || 'N/A'}</div>
                            <div><strong>Email:</strong> {quotationData.salesQuotation.account?.email || quotationData.salesQuotation.cashAccountEmail || 'N/A'}</div>
                        </div>
                        <div>
                            <div><strong>Quotation No:</strong> {quotationData.salesQuotation.billNumber}</div>
                            <div><strong>Validity Periods:</strong> {new Date(quotationData.salesQuotation.transactionDate).toLocaleDateString()}</div>
                            <div><strong>Quotation Issue Date:</strong> {new Date(quotationData.salesQuotation.date).toLocaleDateString()}</div>
                            <div><strong>Mode of Payment:</strong> {quotationData.salesQuotation.paymentMode}</div>
                        </div>
                    </div>

                    <table className="print-quotation-table">
                        <thead>
                            <tr>
                                <th>S.N.</th>
                                <th>#</th>
                                <th>HSN</th>
                                <th>Description of Goods</th>
                                <th>Description</th>
                                <th>Qty</th>
                                <th>Unit</th>
                                <th>Rate (Rs.)</th>
                                <th>Total (Rs.)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotationData.salesQuotation.items.map((item, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>{item.item.uniqueNumber}</td>
                                    <td>{item.item.hscode}</td>
                                    <td>
                                        {item.item.vatStatus === 'vatExempt' ? (
                                            `${item.item.name} *`
                                        ) : (
                                            item.item.name
                                        )}
                                    </td>
                                    <td>{item.description}</td>
                                    <td>{item.quantity}</td>
                                    <td>{item.item.unit?.name || ''}</td>
                                    <td>{item.price.toFixed(2)}</td>
                                    <td>{(item.quantity * item.price).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tr>
                            <td colSpan="9" style={{ borderBottom: '1px solid #000' }}></td>
                        </tr>
                    </table>

                    <table className="print-totals-table">
                        <tbody>
                            <tr>
                                <td><strong>Sub-Total:</strong></td>
                                <td className="print-text-right">{quotationData.salesQuotation.subTotal.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td><strong>Discount ({quotationData.salesQuotation.discountPercentage}%):</strong></td>
                                <td className="print-text-right">{quotationData.salesQuotation.discountAmount.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td><strong>Non-Taxable:</strong></td>
                                <td className="print-text-right">{quotationData.salesQuotation.nonVatSales.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td><strong>Taxable Amount:</strong></td>
                                <td className="print-text-right">{quotationData.salesQuotation.taxableAmount.toFixed(2)}</td>
                            </tr>
                            {!quotationData.salesQuotation.isVatExempt && (
                                <tr>
                                    <td><strong>VAT ({quotationData.salesQuotation.vatPercentage}%):</strong></td>
                                    <td className="print-text-right">{(quotationData.salesQuotation.taxableAmount * quotationData.salesQuotation.vatPercentage / 100).toFixed(2)}</td>
                                </tr>
                            )}
                            <tr>
                                <td><strong>Round Off:</strong></td>
                                <td className="print-text-right">{quotationData.salesQuotation.roundOffAmount.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td><strong>Grand Total:</strong></td>
                                <td className="print-text-right">{quotationData.salesQuotation.totalAmount.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="print-amount-in-words">
                        <strong>In Words:</strong> {numberToWordsWithPaisa(quotationData.salesQuotation.totalAmount)} Only.
                    </div>

                    {quotationData.salesQuotation.description && (
                        <div className="mt-3 print-note">
                            <strong>Note:</strong> {quotationData.salesQuotation.description}
                        </div>
                    )}

                    <div className="print-signature-area">
                        <div className="print-signature-box">Received By</div>
                        <div className="print-signature-box">Prepared By: {quotationData.salesQuotation.user.name}</div>
                        <div className="print-signature-box">For: {quotationData.currentCompanyName}</div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SalesQuotationPrint;