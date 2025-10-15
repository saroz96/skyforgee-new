import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Table } from 'react-bootstrap';
import { BiPrinter, BiArrowBack, BiSolidFilePdf, BiReceipt } from 'react-icons/bi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const JournalVoucherPrint = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [journalData, setJournalData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const printableRef = useRef();

    useEffect(() => {
        const fetchJournalData = async () => {
            try {
                const response = await fetch(`/api/retailer/journal/${id}/print`, {
                    credentials: 'include'
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch journal data');
                }

                setJournalData(data.data);
                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchJournalData();
    }, [id]);

    const printVoucher = () => {
        const printContents = document.getElementById('printableContent').cloneNode(true);
        const styles = document.getElementById('printStyles').innerHTML;

        const printWindow = window.open('', '_blank', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Journal_Voucher_${journalData.journalVoucher.billNumber}</title>
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

            pdf.save(`Journal_Voucher_${journalData.journalVoucher.billNumber}.pdf`);

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

    if (loading) return <div className="text-center py-5">Loading...</div>;
    if (error) return <div className="alert alert-danger text-center py-5">{error}</div>;
    if (!journalData) return <div className="text-center py-5">No journal data found</div>;

    function formatTo2Decimal(num) {
        const rounded = Math.round(num * 100) / 100;
        const parts = rounded.toString().split(".");
        if (!parts[1]) return parts[0] + ".00";
        if (parts[1].length === 1) return parts[0] + "." + parts[1] + "0";
        return rounded.toString();
    }

    // Helper function to format account names with commas
    const formatAccountNames = (accounts) => {
        return accounts.map(account => account.account?.name || 'N/A').join(', ');
    };

    // Helper function to format amounts with commas
    const formatAmounts = (accounts, amountType) => {
        return accounts.map(account => formatTo2Decimal(account[amountType] || 0)).join(', ');
    };

    // Calculate total debit and credit
    const totalDebit = journalData.journalVoucher.debitAccounts.reduce((sum, account) => sum + (account.debit || 0), 0);
    const totalCredit = journalData.journalVoucher.creditAccounts.reduce((sum, account) => sum + (account.credit || 0), 0);

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

                    .print-voucher-container {
                        width: 100%;
                        max-width: 210mm;
                        margin: 0 auto;
                        padding: 2mm;
                    }

                    .print-voucher-header {
                        text-align: center;
                        margin-bottom: 3mm;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 2mm;
                    }

                    .print-voucher-title {
                        font-size: 12pt;
                        font-weight: bold;
                        margin: 2mm 0;
                        text-transform: uppercase;
                        text-decoration: underline;
                        letter-spacing: 1px;
                    }

                    .print-company-name {
                        font-size: 16pt;
                        font-weight: bold;
                    }

                    .print-company-details {
                        font-size: 8pt;
                        margin: 1mm 0;
                    }

                    .print-voucher-details {
                        display: flex;
                        justify-content: space-between;
                        margin: 2mm 0;
                        font-size: 8pt;
                    }

                    .print-voucher-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 3mm 0;
                        font-size: 8pt;
                    }

                    .print-voucher-table thead {
                        border-top: 1px dashed #000;
                        border-bottom: 1px dashed #000;
                    }

                    .print-voucher-table th {
                        background-color: transparent;
                        border: 1px solid #000;
                        padding: 1mm;
                        text-align: left;
                        font-weight: bold;
                    }

                    .print-voucher-table td {
                        border: 1px solid #000;
                        padding: 1mm;
                    }

                    .print-text-right {
                        text-align: right;
                    }

                    .print-text-center {
                        text-align: center;
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
                        font-weight: bold;
                    }

                    .no-print {
                        display: none;
                    }

                    .bordered-digit {
                        display: inline-block;
                        border: 1px solid #000;
                        padding: 0 2px;
                        margin: 0 1px;
                        min-width: 12px;
                        text-align: center;
                    }

                    .text-danger {
                        color: #dc3545 !important;
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

                    .header h2 {
                        margin: 0;
                        font-size: 24px;
                        font-weight: bold;
                    }

                    .header h4 {
                        font-size: 14px;
                        margin: 10px 0;
                    }

                    .voucher-header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 15px;
                    }

                     .invoice-details {
                        text-align: right;
                        font-size: 14px;
                    }

                    .voucher-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 15px 0;
                    }

                    .voucher-table th, .voucher-table td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }

                    .voucher-table th {
                        background-color: #f0f0f0;
                    }

                    .signature-section {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 30px;
                    }

                    .signature {
                        width: 30%;
                        text-align: center;
                    }

                    .signature p {
                        margin: 0;
                    }

                    hr {
                        border-top: 1px solid #000;
                        margin: 10px 0;
                    }

                    .text-danger {
                        color: #dc3545;
                    }

                }
                `}
            </style>

            {/* Screen Version */}
            <div className="screen-version">
                <Container>
                    <div className="d-flex justify-content-end mb-3">
                        <Button variant="secondary" className="me-2" onClick={() => navigate(-1)}>
                            <BiArrowBack /> Back
                        </Button>
                        <Button variant="primary" className="me-2" onClick={generatePdf}>
                            <BiSolidFilePdf /> <span className="pdf-button-text">PDF</span>
                        </Button>
                        <Button variant="info" className='me-2' onClick={printVoucher}>
                            <BiPrinter /> Print
                        </Button>
                        <Button variant="success" onClick={() => navigate('/journal/new')}>
                            <BiReceipt /> New Journal
                        </Button>
                    </div>

                    <Card>
                        <div className="header">
                            <h2 className="card-subtitle">
                                {journalData.currentCompanyName}
                            </h2>
                            <h4>
                                <b>
                                    {journalData.currentCompany.address}-{journalData.currentCompany.ward}, {journalData.currentCompany.city}
                                </b>
                                <br />
                                Tel: {journalData.currentCompany.phone} | PAN: {journalData.currentCompany.pan}
                            </h4>
                            <hr style={{ border: '0.5px solid' }} />
                        </div>

                        <div className="voucher-header">
                            <h1 className="text-center" style={{ textDecoration: 'underline', letterSpacing: '3px' }}>
                                Journal Voucher
                            </h1>
                            <div className="invoice-details">
                                <p><strong>Vch. No:</strong> {journalData.journalVoucher.billNumber}</p>
                                <p><strong>Date:</strong> {new Date(journalData.journalVoucher.date).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <Table className="voucher-table">
                            <thead>
                                <tr>
                                    <th>S.N</th>
                                    <th>Particular</th>
                                    <th>Debit Amount</th>
                                    <th>Credit Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Debit Accounts */}
                                {journalData.journalVoucher.debitAccounts.map((account, index) => (
                                    <tr key={`debit-${index}`}>
                                        <td>{index + 1}</td>
                                        <td>
                                            {journalData.journalVoucher.isActive ?
                                                account.account?.name :
                                                <span className="text-danger">Canceled</span>}
                                        </td>
                                        <td>
                                            {journalData.journalVoucher.isActive ?
                                                <span>{formatTo2Decimal(account.debit)}</span> :
                                                <span className="text-danger">0.00</span>}
                                        </td>
                                        <td>0.00</td>
                                    </tr>
                                ))}

                                {/* Credit Accounts */}
                                {journalData.journalVoucher.creditAccounts.map((account, index) => (
                                    <tr key={`credit-${index}`}>
                                        <td>{journalData.journalVoucher.debitAccounts.length + index + 1}</td>
                                        <td>
                                            {journalData.journalVoucher.isActive ?
                                                account.account?.name :
                                                <span className="text-danger">Canceled</span>}
                                        </td>
                                        <td>0.00</td>
                                        <td>
                                            {journalData.journalVoucher.isActive ?
                                                <span>{formatTo2Decimal(account.credit)}</span> :
                                                <span className="text-danger">0.00</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th colSpan="2">Total</th>
                                    <th>{journalData.journalVoucher.isActive ?
                                        formatTo2Decimal(totalDebit) :
                                        <span className="text-danger">0.00</span>}
                                    </th>
                                    <th>{journalData.journalVoucher.isActive ?
                                        formatTo2Decimal(totalCredit) :
                                        <span className="text-danger">0.00</span>}
                                    </th>
                                </tr>
                            </tfoot>
                        </Table>

                        <p><strong>Note:</strong> {journalData.journalVoucher.description || 'N/A'}</p>

                        <div className="signature-section">
                            <div className="signature">
                                <p style={{ marginBottom: 0 }}>
                                    <strong>{journalData.journalVoucher.user?.name || 'N/A'}</strong>
                                </p>
                                <p style={{ textDecoration: 'overline', marginTop: '5px' }}>Prepared By:</p>
                            </div>
                            <div className="signature">
                                <p style={{ marginBottom: 0 }}>&nbsp;</p>
                                <p style={{ textDecoration: 'overline', marginTop: '5px' }}>Checked By:</p>
                            </div>
                            <div className="signature">
                                <p style={{ marginBottom: 0 }}>&nbsp;</p>
                                <p style={{ textDecoration: 'overline', marginTop: '5px' }}>Approved By:</p>
                            </div>
                        </div>
                    </Card>
                </Container>
            </div>

            {/* Printable Version */}
            <div id="printableContent" className="print-version" ref={printableRef}>
                <div className="print-voucher-container">
                    <div className="print-voucher-header">
                        <div className="print-company-name">{journalData.currentCompanyName}</div>
                        <div className="print-company-details">
                            {journalData.currentCompany.address}-{journalData.currentCompany.ward}, {journalData.currentCompany.city}
                            <br />
                            Tel: {journalData.currentCompany.phone} | PAN: {journalData.currentCompany.pan ? journalData.currentCompany.pan : 'N/A'}
                        </div>
                        <div className="print-voucher-title">JOURNAL VOUCHER</div>
                    </div>

                    <div className="print-voucher-details">
                        <div>
                            <div><strong>Vch. No:</strong> {journalData.journalVoucher.billNumber}</div>
                        </div>
                        <div>
                            <div><strong>Date:</strong> {new Date(journalData.journalVoucher.date).toLocaleDateString()}</div>
                        </div>
                    </div>

                    <table className="print-voucher-table">
                        <thead>
                            <tr>
                                <th>S.N</th>
                                <th>Particular</th>
                                <th>Debit Amount</th>
                                <th>Credit Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Debit Accounts */}
                            {journalData.journalVoucher.debitAccounts.map((account, index) => (
                                <tr key={`debit-${index}`}>
                                    <td>{index + 1}</td>
                                    <td>
                                        {journalData.journalVoucher.isActive ?
                                            account.account?.name :
                                            <span className="text-danger">Canceled</span>}
                                    </td>
                                    <td>
                                        {journalData.journalVoucher.isActive ?
                                            formatTo2Decimal(account.debit) :
                                            <span className="text-danger">0.00</span>}
                                    </td>
                                    <td>0.00</td>
                                </tr>
                            ))}

                            {/* Credit Accounts */}
                            {journalData.journalVoucher.creditAccounts.map((account, index) => (
                                <tr key={`credit-${index}`}>
                                    <td>{journalData.journalVoucher.debitAccounts.length + index + 1}</td>
                                    <td>
                                        {journalData.journalVoucher.isActive ?
                                            account.account?.name :
                                            <span className="text-danger">Canceled</span>}
                                    </td>
                                    <td>0.00</td>
                                    <td>
                                        {journalData.journalVoucher.isActive ?
                                            formatTo2Decimal(account.credit) :
                                            <span className="text-danger">0.00</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th colSpan="2">Total</th>
                                <th>{journalData.journalVoucher.isActive ? formatTo2Decimal(totalDebit) : <span className="text-danger">0.00</span>}</th>
                                <th>{journalData.journalVoucher.isActive ? formatTo2Decimal(totalCredit) : <span className="text-danger">0.00</span>}</th>
                            </tr>
                        </tfoot>
                    </table>

                    <div style={{ marginTop: '3mm' }}>
                        <strong>Note:</strong> {journalData.journalVoucher.description || 'N/A'}
                    </div>

                    <div className="print-signature-area">
                        <div className="print-signature-box">
                            <div style={{ marginBottom: '1mm' }}>
                                <strong>{journalData.journalVoucher.user?.name || 'N/A'}</strong>
                            </div>
                            Prepared By
                        </div>
                        <div className="print-signature-box">
                            <div style={{ marginBottom: '1mm' }}>&nbsp;</div>
                            Checked By
                        </div>
                        <div className="print-signature-box">
                            <div style={{ marginBottom: '1mm' }}>&nbsp;</div>
                            Approved By
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default JournalVoucherPrint;