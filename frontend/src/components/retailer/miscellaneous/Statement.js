// import React, { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import axios from 'axios';
// import '../../../stylesheet/retailer/purchase/List.css';
// import Header from '../Header';
// // import NepaliDate from 'nepali-date';
// import NepaliDate from 'nepali-date-converter';
// import { usePageNotRefreshContext } from '../PageNotRefreshContext';
// import '../../../stylesheet/noDateIcon.css'
// import Loader from '../../Loader';

// const Statement = () => {
//     const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//     const currentEnglishDate = new Date().toISOString().split('T')[0];
//     const [loading, setLoading] = useState(false);
//     const [company, setCompany] = useState({
//         dateFormat: 'nepali',
//         vatEnabled: true,
//         fiscalYear: {}
//     });

//     const [data, setData] = useState(() => {
//         return {
//             company: null,
//             currentFiscalYear: null,
//             statement: [],
//             accounts: [],
//             fromDate: '',
//             toDate: company.dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
//             paymentMode: 'all',
//             selectedCompany: '',
//             partyName: '',
//             totalDebit: 0,
//             totalCredit: 0,
//             balance: 0,
//             openingBalance: 0,
//         };
//     });

//     // Fetch company and fiscal year info when component mounts
//     useEffect(() => {
//         const fetchInitialData = async () => {
//             try {
//                 const response = await api.get('/api/my-company');
//                 if (response.data.success) {
//                     const { company: companyData, currentFiscalYear } = response.data;

//                     // Set company info
//                     const dateFormat = companyData.dateFormat || 'english';
//                     setCompany({
//                         dateFormat,
//                         isVatExempt: companyData.isVatExempt || false,
//                         vatEnabled: companyData.vatEnabled !== false, // default true
//                         fiscalYear: currentFiscalYear || {}
//                     });

//                     // Set dates based on fiscal year
//                     if (currentFiscalYear?.startDate) {
//                         setData(prev => ({
//                             ...prev,
//                             fromDate: dateFormat === 'nepali'
//                                 ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
//                                 : new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD'),
//                             toDate: dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
//                             company: companyData,
//                             currentFiscalYear
//                         }));
//                     }
//                 }
//             } catch (err) {
//                 console.error('Error fetching initial data:', err);
//             }
//         };

//         fetchInitialData();
//     }, []);

//     const [error, setError] = useState(null);
//     const [searchQuery, setSearchQuery] = useState('');
//     const [selectedRowIndex, setSelectedRowIndex] = useState(0);
//     const [filteredStatement, setFilteredStatement] = useState([]);
//     const [filteredAccounts, setFilteredAccounts] = useState([]);
//     const [showAccountModal, setShowAccountModal] = useState(false);

//     const fromDateRef = useRef(null);
//     const toDateRef = useRef(null);
//     const searchInputRef = useRef(null);
//     const accountSearchRef = useRef(null);
//     const paymentModeRef = useRef(null);
//     const generateReportRef = useRef(null);
//     const tableBodyRef = useRef(null);
//     const [shouldFetch, setShouldFetch] = useState(false);
//     const navigate = useNavigate();

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     useEffect(() => {
//         if (data.statement.length > 0 || data.fromDate || data.toDate) {
//         }
//     }, [data]);

//     useEffect(() => {
//         // Fetch initial data
//         const fetchInitialData = async () => {
//             try {
//                 const response = await api.get('/api/retailer/statement');
//                 const { data } = response;

//                 // Sort accounts alphabetically
//                 const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));

//                 setCompany(data.data.company);
//                 setData(prev => ({
//                     ...prev,
//                     accounts: sortedAccounts,
//                     company: data.data.company,
//                     currentFiscalYear: data.data.currentFiscalYear
//                 }));
//             } catch (error) {
//                 console.error('Error fetching initial data:', error);
//                 setError('Failed to load initial data');
//             } finally {
//             }
//         };

//         fetchInitialData();
//     }, []);

//     useEffect(() => {
//         const fetchData = async () => {
//             if (!shouldFetch || !data.selectedCompany) return;

//             try {
//                 setLoading(true);
//                 const params = new URLSearchParams();
//                 if (data.fromDate) params.append('fromDate', data.fromDate);
//                 if (data.toDate) params.append('toDate', data.toDate);
//                 if (data.selectedCompany) params.append('account', data.selectedCompany);
//                 if (data.paymentMode) params.append('paymentMode', data.paymentMode);

//                 const response = await api.get(`/api/retailer/statement?${params.toString()}`);
//                 setData(prev => ({
//                     ...prev,
//                     ...response.data.data,
//                     paymentMode: data.paymentMode // Keep the selected payment mode
//                 }));
//                 setError(null);
//                 setSelectedRowIndex(0); // Reset selection when new data loads
//             } catch (err) {
//                 setError(err.response?.data?.error || 'Failed to fetch statement');
//             } finally {
//                 setLoading(false);
//                 setShouldFetch(false);
//             }
//         };

//         fetchData();
//     }, [shouldFetch]); // Only depend on shouldFetch

//     // Filter statement based on search and payment mode
//     useEffect(() => {
//         const filtered = data.statement.filter(item => {
//             // First filter by payment mode
//             const paymentModeMatch =
//                 data.paymentMode === 'all' ||
//                 (data.paymentMode === 'cash' && item.paymentMode === 'cash') ||
//                 (data.paymentMode === 'credit' && item.paymentMode === 'credit') ||
//                 (data.paymentMode === 'exclude-cash' && item.paymentMode !== 'cash');

//             // Then filter by search query if payment mode matches
//             return paymentModeMatch && (
//                 item.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//                 item.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//                 item.type?.toLowerCase().includes(searchQuery.toLowerCase())
//             );
//         });


//         setFilteredStatement(filtered);
//         // Reset selected row when filters change
//         setSelectedRowIndex(0);
//     }, [data.statement, searchQuery, data.paymentMode]);

//     const paymentModeOptions = [
//         { value: 'all', label: 'All (Include Cash)' },
//         { value: 'exclude-cash', label: 'All (Exclude Cash)' },
//         { value: 'cash', label: 'Cash' },
//         { value: 'credit', label: 'Credit' }
//     ];


//     // Filter statement based on search
//     useEffect(() => {
//         const filtered = data.statement.filter(item => {
//             return (
//                 item.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//                 item.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//                 item.type?.toLowerCase().includes(searchQuery.toLowerCase())
//             )
//         });

//         setFilteredStatement(filtered);
//         // Reset selected row when filters change
//         setSelectedRowIndex(0);
//     }, [data.statement, searchQuery]);

//     // Handle keyboard navigation
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             if (filteredStatement.length === 0) return;

//             // Check if focus is inside an input or select element
//             const activeElement = document.activeElement;
//             if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT') {
//                 return;
//             }

//             switch (e.key) {
//                 case 'ArrowUp':
//                     e.preventDefault();
//                     setSelectedRowIndex(prev => Math.max(0, prev - 1));
//                     break;
//                 case 'ArrowDown':
//                     e.preventDefault();
//                     setSelectedRowIndex(prev => Math.min(filteredStatement.length - 1, prev + 1));
//                     break;
//                 default:
//                     break;
//             }
//         };

//         window.addEventListener('keydown', handleKeyDown);
//         return () => window.removeEventListener('keydown', handleKeyDown);
//     }, [filteredStatement, selectedRowIndex]);

//     // Scroll to selected row
//     useEffect(() => {
//         if (tableBodyRef.current && filteredStatement.length > 0) {
//             const rows = tableBodyRef.current.querySelectorAll('tr');
//             if (rows.length > selectedRowIndex) {
//                 rows[selectedRowIndex].scrollIntoView({
//                     behavior: 'smooth',
//                     block: 'nearest'
//                 });
//             }
//         }
//     }, [selectedRowIndex, filteredStatement]);

//     const handleAccountSearch = (e) => {
//         const searchText = e.target.value.toLowerCase();
//         const filtered = data.accounts.filter(account =>
//             account.name.toLowerCase().includes(searchText) ||
//             (account.uniqueNumber && account.uniqueNumber.toString().toLowerCase().includes(searchText))
//         ).sort((a, b) => a.name.localeCompare(b.name));

//         setFilteredAccounts(filtered);
//     };

//     const selectAccount = (account) => {
//         setData(prev => ({
//             ...prev,
//             selectedCompany: account._id,
//             partyName: account.name
//         }));
//         setShowAccountModal(false);

//         setTimeout(() => {
//             const fromDateField = document.getElementById('fromDate');
//             if (fromDateField) {
//                 fromDateField.focus();
//             }
//         }, 50);
//     };

//     const handleDateChange = (e) => {
//         const { name, value } = e.target;
//         setData(prev => ({ ...prev, [name]: value }));
//     };

//     const handlePaymentModeChange = (e) => {
//         setData(prev => ({ ...prev, paymentMode: e.target.value }));
//     };

//     const handleGenerateReport = () => {
//         if (!data.fromDate || !data.toDate) {
//             setError('Please select both from and to dates');
//             return;
//         }
//         if (!data.selectedCompany) {
//             setError('Please select an account');
//             return;
//         }
//         setShouldFetch(true);
//     };
//     const handlePrint = () => {
//         const rowsToPrint = document.querySelectorAll('.statement-row');

//         if (rowsToPrint.length === 0) {
//             alert("No statement to print");
//             return;
//         }

//         const printWindow = window.open("", "_blank");
//         const printHeader = `
//         <div class="print-header">
//                 <h1 style="text-align:center;text-decoration:underline;">Statement</h1>
//             <h1>${data.currentCompanyName || 'Company Name'}</h1>
//             <p>
//                 ${data.company?.address || ''}-${data.company?.ward || ''}, ${data.company?.city || ''},
//             </p>
//             <hr>
//         </div>
//     `;

//         let tableContent = `
//     <style>
//         @page {
//             margin: 10mm;
//         }
//         body { 
//             font-family: Arial, sans-serif; 
//             font-size: 10px; 
//             margin: 0;
//             padding: 10mm;
//         }
//         table { 
//             width: 100%; 
//             border-collapse: collapse; 
//             page-break-inside: auto;
//         }
//         tr { 
//             page-break-inside: avoid; 
//             page-break-after: auto; 
//         }
//         th, td { 
//             border: 1px solid #000; 
//             padding: 4px; 
//             text-align: left; 
//             white-space: nowrap;
//         }
//         th { 
//             background-color: #f2f2f2 !important; 
//             -webkit-print-color-adjust: exact; 
//         }
//         .print-header { 
//             text-align: center; 
//             margin-bottom: 15px; 
//         }
//         .nowrap {
//             white-space: nowrap;
//         }
//         .text-end {
//             text-align: right;
//         }
//         .statement-header {
//             display: flex;
//             justify-content: space-between;
//             align-items: center;
//             margin-bottom: 10px;
//             padding: 0 20px;
//             font-size:10px
//         }
//     </style>
//     ${printHeader}
//     <div class="statement-header">
//         <div><strong>Party Name:</strong> ${data.partyName}</div>
//         <div><strong>From:</strong> ${data.fromDate} To:</strong> ${data.toDate}</div>
//     </div>
//     <table>
//         <thead>
//             <tr>
//                 <th class="nowrap">Date</th>
//                 <th class="nowrap">Vch. No.</th>
//                 <th class="nowrap">Vch. Type</th>
//                 <th class="nowrap">Pay Mode</th>
//                 <th class="nowrap">Account</th>
//                 <th class="nowrap">Debit</th>
//                 <th class="nowrap">Credit</th>
//                 <th class="nowrap">Balance</th>
//             </tr>
//         </thead>
//         <tbody>
//     `;

//         let balance = data.openingBalance; // Start with opening balance

//         // Add statement rows
//         data.statement.forEach((item, index) => {
//             // For the first row, show opening balance
//             if (index === 0) {
//                 tableContent += `
//             <tr>
//                 <td class="nowrap">${new Date(item.date).toLocaleDateString()}</td>
//                 <td class="nowrap">${item.billNumber || ''}</td>
//                 <td class="nowrap">${item.type}</td>
//                 <td class="nowrap">${item.paymentMode || ''}</td>
//                 <td class="nowrap">${item.accountType?.name || item.purchaseSalesType || item.journalAccountType || item.purchaseSalesReturnType || item.drCrNoteAccountType || item.paymentReceiptAccountType || 'Opening'}
//                     ${item.partyBillNumber || ''}
//                 </td>
//                 <td class="text-end">${item.debit ? parseFloat(item.debit).toFixed(2) : '0.00'}</td>
//                 <td class="text-end">${item.credit ? parseFloat(item.credit).toFixed(2) : '0.00'}</td>
//                 <td class="text-end">${formatBalance(balance)}</td>
//             </tr>
//             `;
//             } else {
//                 balance += (item.debit || 0) - (item.credit || 0);
//                 tableContent += `
//             <tr>
//                 <td class="nowrap">${new Date(item.date).toLocaleDateString()}</td>
//                 <td class="nowrap">${item.billNumber || ''}</td>
//                 <td class="nowrap">${item.type}</td>
//                 <td class="nowrap">${item.paymentMode || ''}</td>
//                 <td class="nowrap">${item.accountType?.name || item.purchaseSalesType || item.journalAccountType || item.purchaseSalesReturnType || item.drCrNoteAccountType || item.paymentReceiptAccountType || 'Opening'}
//                     ${item.partyBillNumber || ''}
//                 </td>
//                 <td class="text-end">${item.debit ? parseFloat(item.debit).toFixed(2) : '0.00'}</td>
//                 <td class="text-end">${item.credit ? parseFloat(item.credit).toFixed(2) : '0.00'}</td>
//                 <td class="text-end">${formatBalance(balance)}</td>
//             </tr>
//             `;
//             }
//         });

//         // Add totals row
//         tableContent += `
//         <tr style="font-weight:bold; border-top: 2px solid #000;">
//             <td colspan="5">Totals</td>
//             <td class="text-end">${data.totalDebit.toFixed(2)}</td>
//             <td class="text-end">${data.totalCredit.toFixed(2)}</td>
//             <td class="text-end">${formatBalance(balance)}</td>
//         </tr>
//         </tbody>
//     </table>
//     `;

//         printWindow.document.write(`
//     <html>
//         <head>
//             <title>Statement</title>
//         </head>
//         <body>
//             ${tableContent}
//             <script>
//                 window.onload = function() {
//                     setTimeout(function() {
//                         window.print();
//                     }, 200);
//                 };
//             <\/script>
//         </body>
//     </html>
//     `);
//         printWindow.document.close();
//     };

//     const formatBalance = (amount) => {
//         return amount > 0 ? `${amount.toFixed(2)} Dr` : `${(-amount).toFixed(2)} Cr`;
//     };

//     const formatCurrency = (num) => {
//         const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
//         if (company.dateFormat === 'nepali') {
//             // Indian grouping, two decimals, English digits
//             return number.toLocaleString('en-IN', {
//                 minimumFractionDigits: 2,
//                 maximumFractionDigits: 2
//             });
//         }
//         // English (US) grouping by default
//         return number.toLocaleString('en-US', {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2
//         });
//     };

//     function formatAmountWithType(amount, type = '') {
//         const formatted = formatCurrency(Math.abs(amount));
//         if (type.toLowerCase() === 'dr' && amount > 0) {
//             return `${formatted} Dr`;
//         }
//         if (type.toLowerCase() === 'cr' && amount < 0) {
//             return `${formatted} Cr`;
//         }
//         if (amount > 0) return `${formatted} Dr`;
//         if (amount < 0) return `${formatted} Cr`;
//         return `${formatted}`; // For zero
//     }

//     const handleRowClick = (index) => {
//         setSelectedRowIndex(index);
//     };

//     const handleKeyDown = (e, nextFieldId) => {
//         if (e.key === 'Enter') {
//             e.preventDefault();
//             if (nextFieldId) {
//                 const nextField = document.getElementById(nextFieldId);
//                 if (nextField) {
//                     nextField.focus();
//                 }
//             } else {
//                 // If no nextFieldId provided, try to find the next focusable element
//                 const focusableElements = Array.from(
//                     document.querySelectorAll('input, select, button, [tabindex]:not([tabindex="-1"])')
//                 ).filter(el => !el.disabled && el.offsetParent !== null);

//                 const currentIndex = focusableElements.findIndex(el => el === e.target);

//                 if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
//                     focusableElements[currentIndex + 1].focus();
//                 }
//             }
//         }
//     };

//     if (loading) return <Loader />;
//     if (error) {
//         return <div className="alert alert-danger text-center py-5">{error}</div>;
//     }

//     return (
//         <div className="container-fluid">
//             <Header />
//             <div className="card shadow">
//                 <div className="card-header bg-white py-3">
//                     <h1 className="h3 mb-0 text-center text-primary">Statement</h1>
//                 </div>

//                 <div className="card-body">
//                     {/* Search and Filter Section */}
//                     <div className="row mb-4 g-3">
//                         {/* Account Selection */}
//                         <div className="col-md-3">
//                             <label htmlFor="account">Party Name:</label>
//                             <input
//                                 type="text"
//                                 id="account"
//                                 name="account"
//                                 className="form-control"
//                                 value={data.partyName}
//                                 onClick={() => setShowAccountModal(true)}
//                                 onFocus={() => setShowAccountModal(true)}
//                                 readOnly
//                                 required
//                                 onKeyDown={(e) => {
//                                     if (e.key === 'Enter') {
//                                         handleKeyDown(e, 'fromDate');
//                                     }
//                                 }}
//                             />
//                             <input type="hidden" id="accountId" name="accountId" value={data.selectedCompany} />
//                         </div>

//                         {/* Date Range */}
//                         <div className="col-md-2">
//                             <label htmlFor="fromDate">From Date</label>
//                             <input
//                                 type="text"
//                                 name="fromDate"
//                                 id="fromDate"
//                                 ref={company.dateFormat === 'nepali' ? fromDateRef : null}
//                                 className="form-control no-date-icon"
//                                 value={data.fromDate}
//                                 onChange={handleDateChange}
//                                 required
//                                 autoComplete='off'
//                                 onKeyDown={(e) => handleKeyDown(e, 'toDate')}
//                             />
//                         </div>
//                         <div className="col-md-2">
//                             <label htmlFor="toDate">To Date</label>
//                             <input
//                                 type="text"
//                                 name="toDate"
//                                 id="toDate"
//                                 ref={toDateRef}
//                                 className="form-control no-date-icon"
//                                 value={data.toDate}
//                                 onChange={handleDateChange}
//                                 required
//                                 autoComplete='off'
//                                 onKeyDown={(e) => handleKeyDown(e, 'paymentMode')}
//                             />
//                         </div>

//                         {/* Payment Mode */}
//                         <div className="col-md-2">
//                             <label htmlFor="paymentMode">Payment Mode</label>
//                             <select
//                                 className="form-control"
//                                 id="paymentMode"
//                                 ref={paymentModeRef}
//                                 value={data.paymentMode}
//                                 onChange={handlePaymentModeChange}
//                                 onKeyDown={(e) => handleKeyDown(e, 'searchInput')}
//                             >
//                                 {paymentModeOptions.map(option => (
//                                     <option key={option.value} value={option.value}>
//                                         {option.label}
//                                     </option>
//                                 ))}
//                             </select>
//                         </div>

//                         {/* Search */}
//                         <div className="col-md-3">
//                             <label htmlFor="searchInput">Search</label>
//                             <div className="input-group">
//                                 <input
//                                     type="text"
//                                     className="form-control"
//                                     id="searchInput"
//                                     ref={searchInputRef}
//                                     placeholder="Search statement..."
//                                     value={searchQuery}
//                                     onChange={(e) => setSearchQuery(e.target.value)}
//                                     autoComplete='off'
//                                     onKeyDown={(e) => {
//                                         if (e.key === 'Enter' && !searchQuery) {
//                                             handleKeyDown(e, 'generateReport');
//                                         }
//                                     }}
//                                 />
//                                 <button
//                                     className="btn btn-outline-secondary"
//                                     type="button"
//                                     onClick={() => setSearchQuery('')}
//                                     disabled={data.statement.length === 0}
//                                 >
//                                     <i className="fas fa-times"></i>
//                                 </button>
//                             </div>
//                         </div>

//                         {/* Generate Button */}
//                         <div className="col-md-1 d-flex align-items-end">
//                             <button
//                                 type="button"
//                                 id="generateReport"
//                                 ref={generateReportRef}
//                                 className="btn btn-primary w-100"
//                                 onClick={handleGenerateReport}
//                             >
//                                 <i className="fas fa-chart-line me-2"></i>Generate
//                             </button>
//                         </div>

//                         {/* Print Button */}
//                         <div className="col-md-1 d-flex align-items-end">
//                             <button
//                                 className="btn btn-secondary w-100"
//                                 onClick={handlePrint}
//                                 disabled={data.statement.length === 0}
//                             >
//                                 <i className="fas fa-print"></i>Print
//                             </button>
//                         </div>

//                         <div className="col-md-10 d-flex align-items-end">
//                             <span className="badge bg-primary fs-6">
//                                 <strong>Party Name:</strong> {data.partyName}
//                             </span>
//                         </div>
//                     </div>

//                     {data.statement.length === 0 ? (
//                         <div className="alert alert-info text-center py-3">
//                             <i className="fas fa-info-circle me-2"></i>
//                             Please select account, date range and click "Generate Report" to view statement
//                         </div>
//                     ) : (
//                         <>
//                             {/* Statement Table */}
//                             <div className="table-responsive">
//                                 <table className="table table-hover">
//                                     <thead>
//                                         <tr>
//                                             <th>Date</th>
//                                             <th>Vch. No.</th>
//                                             <th>Vch. Type</th>
//                                             <th>Pay Mode</th>
//                                             <th>Account</th>
//                                             <th className="text-end">Debit</th>
//                                             <th className="text-end">Credit</th>
//                                             <th className="text-end">Balance</th>
//                                         </tr>
//                                     </thead>
//                                     <tbody ref={tableBodyRef}>
//                                         {filteredStatement.map((item, index) => (
//                                             <tr
//                                                 key={index}
//                                                 className={`statement-row ${selectedRowIndex === index ? 'highlighted-row' : ''}`}
//                                                 onClick={() => handleRowClick(index)}
//                                                 style={{ cursor: 'pointer' }}
//                                             >
//                                                 <td>{new NepaliDate(item.date).format('YYYY-MM-DD')}</td>
//                                                 <td>{item.billNumber || ''}</td>
//                                                 <td>{item.type}</td>
//                                                 <td>{item.paymentMode || ''}</td>
//                                                 {/* <td>
//                                                     {item.accountType?.name ||
//                                                         item.purchaseSalesType ||
//                                                         item.journalAccountType ||
//                                                         item.purchaseSalesReturnType ||
//                                                         item.drCrNoteAccountType ||
//                                                         item.paymentReceiptAccountType ||
//                                                         'Opening'}
//                                                     {item.partyBillNumber && (
//                                                         <span style={{ marginLeft: '5px' }}>
//                                                             {item.partyBillNumber}
//                                                         </span>
//                                                     )}
//                                                 </td> */}
//                                                 <td>
//                                                     {item.accountType?.name ||
//                                                         item.purchaseSalesType ||
//                                                         item.journalAccountType ||
//                                                         item.purchaseSalesReturnType ||
//                                                         item.drCrNoteAccountType ||
//                                                         item.paymentReceiptAccountType ||
//                                                         'Opening'}
//                                                     {item.partyBillNumber && (
//                                                         <span style={{ marginLeft: '5px' }}>
//                                                             {item.partyBillNumber}
//                                                         </span>
//                                                     )}
//                                                     {/* Add instrument details if available */}
//                                                     {(item.InstType && item.InstType !== 'N/A') && (
//                                                         <div>
//                                                             <strong>Inst:</strong> {item.InstType} {item.InstNo && `- ${item.InstNo}`}
//                                                         </div>
//                                                     )}
//                                                 </td>
//                                                 <td className="text-end">{formatCurrency(item.debit) ? formatCurrency(item.debit) : '0.00'}</td>
//                                                 <td className="text-end">{formatCurrency(item.credit) ? formatCurrency(item.credit) : '0.00'}</td>
//                                                 <td className="text-end">{formatAmountWithType(item.balance) ? formatAmountWithType(item.balance) : '0.00'}</td>
//                                             </tr>
//                                         ))}
//                                     </tbody>
//                                     <tfoot>
//                                         <tr className="fw-bold">
//                                             <td colSpan="5">Totals:</td>
//                                             <td className="text-end">{formatCurrency(data.totalDebit)}</td>
//                                             <td className="text-end">{formatCurrency(data.totalCredit)}</td>
//                                             <td className="text-end">{formatAmountWithType(data.statement.length > 0 ? data.statement[data.statement.length - 1].balance : 0)}</td>

//                                         </tr>
//                                     </tfoot>
//                                 </table>
//                             </div>

//                             {/* Statement Summary */}
//                             <div className="row mb-3">
//                                 <div className="col-md-6">
//                                     <div className="card">
//                                         <div className="card-body">
//                                             <h5 className="card-title">Statement Summary</h5>
//                                             <div className="row">
//                                                 <div className="col">
//                                                     <p><strong>Opening Balance:</strong> {formatAmountWithType(data.openingBalance)}</p>
//                                                     <p><strong>From Date:</strong> {new Date(data.fromDate).toLocaleDateString()}</p>
//                                                     <p><strong>To Date:</strong> {new Date(data.toDate).toLocaleDateString()}</p>
//                                                 </div>
//                                                 <div className="col">
//                                                     <p><strong>Total Debit:</strong> {formatCurrency(data.totalDebit)}</p>
//                                                     <p><strong>Total Credit:</strong> {formatCurrency(data.totalCredit)}</p>
//                                                     <p><strong>Closing Balance:</strong> {formatAmountWithType(data.statement.length > 0 ? data.statement[data.statement.length - 1].balance : 0)}</p>
//                                                 </div>
//                                             </div>
//                                         </div>
//                                     </div>
//                                 </div>
//                             </div>
//                         </>
//                     )}
//                 </div>
//             </div>

//             {/* Account Modal - Similar to AddPurchase */}
//             {showAccountModal && (
//                 <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block' }}>
//                     <div className="modal-dialog modal-xl modal-dialog-centered">
//                         <div className="modal-content" style={{ height: '500px' }}>
//                             <div className="modal-header">
//                                 <h5 className="modal-title" id="accountModalLabel">Select an Account</h5>
//                                 <button type="button" className="btn-close" onClick={() => setShowAccountModal(false)}></button>
//                             </div>
//                             <div className="p-3 bg-white sticky-top">
//                                 <input
//                                     type="text"
//                                     id="searchAccount"
//                                     className="form-control form-control-sm"
//                                     placeholder="Search Account"
//                                     autoFocus
//                                     autoComplete='off'
//                                     onChange={handleAccountSearch}
//                                     onKeyDown={(e) => {
//                                         if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
//                                             e.preventDefault();
//                                             const firstAccountItem = document.querySelector('.account-item');
//                                             if (firstAccountItem) {
//                                                 firstAccountItem.focus();
//                                             }
//                                         } else if (e.key === 'Enter') {
//                                             e.preventDefault();
//                                             const firstAccountItem = document.querySelector('.account-item.active');
//                                             if (firstAccountItem) {
//                                                 const accountId = firstAccountItem.getAttribute('data-account-id');
//                                                 const account = filteredAccounts.length > 0
//                                                     ? filteredAccounts.find(a => a._id === accountId)
//                                                     : data.accounts.find(a => a._id === accountId);
//                                                 if (account) {
//                                                     selectAccount(account);
//                                                 }
//                                             }
//                                         }
//                                     }}
//                                     ref={accountSearchRef}
//                                 />
//                             </div>
//                             <div className="modal-body p-0">
//                                 <div className="overflow-auto" style={{ height: 'calc(400px - 120px)' }}>
//                                     <ul id="accountList" className="list-group">
//                                         {filteredAccounts.length > 0 ? (
//                                             filteredAccounts
//                                                 .sort((a, b) => a.name.localeCompare(b.name))
//                                                 .map((account, index) => (
//                                                     <li
//                                                         key={account._id}
//                                                         data-account-id={account._id}
//                                                         className={`list-group-item account-item py-2 ${index === 0 ? 'active' : ''}`}
//                                                         onClick={() => selectAccount(account)}
//                                                         style={{ cursor: 'pointer' }}
//                                                         tabIndex={0}
//                                                         onKeyDown={(e) => {
//                                                             if (e.key === 'ArrowDown') {
//                                                                 e.preventDefault();
//                                                                 const nextItem = e.target.nextElementSibling;
//                                                                 if (nextItem) {
//                                                                     e.target.classList.remove('active');
//                                                                     nextItem.classList.add('active');
//                                                                     nextItem.focus();
//                                                                 }
//                                                             } else if (e.key === 'ArrowUp') {
//                                                                 e.preventDefault();
//                                                                 const prevItem = e.target.previousElementSibling;
//                                                                 if (prevItem) {
//                                                                     e.target.classList.remove('active');
//                                                                     prevItem.classList.add('active');
//                                                                     prevItem.focus();
//                                                                 } else {
//                                                                     accountSearchRef.current.focus();
//                                                                 }
//                                                             } else if (e.key === 'Enter') {
//                                                                 e.preventDefault();
//                                                                 selectAccount(account);
//                                                             }
//                                                         }}
//                                                         onFocus={(e) => {
//                                                             document.querySelectorAll('.account-item').forEach(item => {
//                                                                 item.classList.remove('active');
//                                                             });
//                                                             e.target.classList.add('active');
//                                                         }}
//                                                     >
//                                                         <div className="d-flex justify-content-between small">
//                                                             <strong>{account.uniqueNumber || 'N/A'} {account.name}</strong>
//                                                             <span>📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}</span>
//                                                         </div>
//                                                     </li>
//                                                 ))
//                                         ) : (
//                                             accountSearchRef.current?.value ? (
//                                                 <li className="list-group-item text-center text-muted small py-2">No accounts found</li>
//                                             ) : (
//                                                 data.accounts
//                                                     .sort((a, b) => a.name.localeCompare(b.name))
//                                                     .map((account, index) => (
//                                                         <li
//                                                             key={account._id}
//                                                             data-account-id={account._id}
//                                                             className={`list-group-item account-item py-2 ${index === 0 ? 'active' : ''}`}
//                                                             onClick={() => selectAccount(account)}
//                                                             style={{ cursor: 'pointer' }}
//                                                             tabIndex={0}
//                                                             onKeyDown={(e) => {
//                                                                 if (e.key === 'ArrowDown') {
//                                                                     e.preventDefault();
//                                                                     const nextItem = e.target.nextElementSibling;
//                                                                     if (nextItem) {
//                                                                         e.target.classList.remove('active');
//                                                                         nextItem.classList.add('active');
//                                                                         nextItem.focus();
//                                                                     }
//                                                                 } else if (e.key === 'ArrowUp') {
//                                                                     e.preventDefault();
//                                                                     const prevItem = e.target.previousElementSibling;
//                                                                     if (prevItem) {
//                                                                         e.target.classList.remove('active');
//                                                                         prevItem.classList.add('active');
//                                                                         prevItem.focus();
//                                                                     } else {
//                                                                         accountSearchRef.current.focus();
//                                                                     }
//                                                                 } else if (e.key === 'Enter') {
//                                                                     e.preventDefault();
//                                                                     selectAccount(account);
//                                                                 }
//                                                             }}
//                                                             onFocus={(e) => {
//                                                                 document.querySelectorAll('.account-item').forEach(item => {
//                                                                     item.classList.remove('active');
//                                                                 });
//                                                                 e.target.classList.add('active');
//                                                             }}
//                                                         >
//                                                             <div className="d-flex justify-content-between small">
//                                                                 <strong>{account.uniqueNumber || 'N/A'} {account.name}</strong>
//                                                                 <span>📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}</span>
//                                                             </div>
//                                                         </li>
//                                                     ))
//                                             )
//                                         )}
//                                     </ul>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// };

// export default Statement;

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../../stylesheet/retailer/purchase/List.css';
import Header from '../Header';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import '../../../stylesheet/noDateIcon.css'
import Loader from '../../Loader';
import { useStatementContext } from '../../../context/StatementContext';

const Statement = () => {
    const { statementState, setStatementState } = useStatementContext();
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];
    const [loading, setLoading] = useState(false);
    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });

    // const [data, setData] = useState(() => {
    //     return {
    //         company: null,
    //         currentFiscalYear: null,
    //         statement: [],
    //         accounts: [],
    //         fromDate: '',
    //         toDate: company.dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
    //         paymentMode: 'all',
    //         selectedCompany: '',
    //         partyName: '',
    //         totalDebit: 0,
    //         totalCredit: 0,
    //         balance: 0,
    //         openingBalance: 0,
    //     };
    // });

    // Replace your current useState with context state
    const [data, setData] = useState(() => ({
        ...statementState,
        company: null,
        currentFiscalYear: null,
    }));

    // Update context when data changes
    useEffect(() => {
        setStatementState(prev => ({
            ...prev,
            selectedCompany: data.selectedCompany,
            partyName: data.partyName,
            fromDate: data.fromDate,
            toDate: data.toDate,
            paymentMode: data.paymentMode,
            statement: data.statement,
            accounts: data.accounts,
            totalDebit: data.totalDebit,
            totalCredit: data.totalCredit,
            openingBalance: data.openingBalance
        }));
    }, [data, setStatementState]);

    // Fetch company and fiscal year info when component mounts
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/my-company');
                if (response.data.success) {
                    const { company: companyData, currentFiscalYear } = response.data;

                    // Set company info
                    const dateFormat = companyData.dateFormat || 'english';
                    setCompany({
                        dateFormat,
                        isVatExempt: companyData.isVatExempt || false,
                        vatEnabled: companyData.vatEnabled !== false, // default true
                        fiscalYear: currentFiscalYear || {}
                    });

                    // Set dates based on fiscal year
                    if (currentFiscalYear?.startDate) {
                        setData(prev => ({
                            ...prev,
                            fromDate: dateFormat === 'nepali'
                                ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
                                : new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD'),
                            toDate: dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
                            company: companyData,
                            currentFiscalYear
                        }));
                    }
                }
            } catch (err) {
                console.error('Error fetching initial data:', err);
            }
        };

        fetchInitialData();
    }, []);

    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRowIndex, setSelectedRowIndex] = useState(0);
    const [filteredStatement, setFilteredStatement] = useState([]);
    const [filteredAccounts, setFilteredAccounts] = useState([]);
    const [showAccountModal, setShowAccountModal] = useState(false);

    const fromDateRef = useRef(null);
    const toDateRef = useRef(null);
    const searchInputRef = useRef(null);
    const accountSearchRef = useRef(null);
    const paymentModeRef = useRef(null);
    const generateReportRef = useRef(null);
    const tableBodyRef = useRef(null);
    const [shouldFetch, setShouldFetch] = useState(false);
    const navigate = useNavigate();

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        if (data.statement.length > 0 || data.fromDate || data.toDate) {
        }
    }, [data]);

    useEffect(() => {
        // Fetch initial data
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/retailer/statement');
                const { data } = response;

                // Sort accounts alphabetically
                const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));

                setCompany(data.data.company);
                setData(prev => ({
                    ...prev,
                    accounts: sortedAccounts,
                    company: data.data.company,
                    currentFiscalYear: data.data.currentFiscalYear
                }));
            } catch (error) {
                console.error('Error fetching initial data:', error);
                setError('Failed to load initial data');
            } finally {
            }
        };

        fetchInitialData();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!shouldFetch || !data.selectedCompany) return;

            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (data.fromDate) params.append('fromDate', data.fromDate);
                if (data.toDate) params.append('toDate', data.toDate);
                if (data.selectedCompany) params.append('account', data.selectedCompany);
                if (data.paymentMode) params.append('paymentMode', data.paymentMode);

                const response = await api.get(`/api/retailer/statement?${params.toString()}`);
                setData(prev => ({
                    ...prev,
                    ...response.data.data,
                    paymentMode: data.paymentMode // Keep the selected payment mode
                }));
                setError(null);
                setSelectedRowIndex(0); // Reset selection when new data loads
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch statement');
            } finally {
                setLoading(false);
                setShouldFetch(false);
            }
        };

        fetchData();
    }, [shouldFetch]); // Only depend on shouldFetch
    

    // Filter statement based on search and payment mode
    useEffect(() => {
        const filtered = data.statement.filter(item => {
            // First filter by payment mode
            const paymentModeMatch =
                data.paymentMode === 'all' ||
                (data.paymentMode === 'cash' && item.paymentMode === 'cash') ||
                (data.paymentMode === 'credit' && item.paymentMode === 'credit') ||
                (data.paymentMode === 'exclude-cash' && item.paymentMode !== 'cash');

            // Then filter by search query if payment mode matches
            return paymentModeMatch && (
                item.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.type?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        });


        setFilteredStatement(filtered);
        // Reset selected row when filters change
        setSelectedRowIndex(0);
    }, [data.statement, searchQuery, data.paymentMode]);

    const paymentModeOptions = [
        { value: 'all', label: 'All (Include Cash)' },
        { value: 'exclude-cash', label: 'All (Exclude Cash)' },
        { value: 'cash', label: 'Cash' },
        { value: 'credit', label: 'Credit' }
    ];


    // Filter statement based on search
    useEffect(() => {
        const filtered = data.statement.filter(item => {
            return (
                item.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.type?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        });

        setFilteredStatement(filtered);
        // Reset selected row when filters change
        setSelectedRowIndex(0);
    }, [data.statement, searchQuery]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (filteredStatement.length === 0) return;

            // Check if focus is inside an input or select element
            const activeElement = document.activeElement;
            if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT') {
                return;
            }

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.max(0, prev - 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.min(filteredStatement.length - 1, prev + 1));
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredStatement, selectedRowIndex]);

    // Scroll to selected row
    useEffect(() => {
        if (tableBodyRef.current && filteredStatement.length > 0) {
            const rows = tableBodyRef.current.querySelectorAll('tr');
            if (rows.length > selectedRowIndex) {
                rows[selectedRowIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, filteredStatement]);

    const handleAccountSearch = (e) => {
        const searchText = e.target.value.toLowerCase();
        const filtered = data.accounts.filter(account =>
            account.name.toLowerCase().includes(searchText) ||
            (account.uniqueNumber && account.uniqueNumber.toString().toLowerCase().includes(searchText))
        ).sort((a, b) => a.name.localeCompare(b.name));

        setFilteredAccounts(filtered);
    };

    const selectAccount = (account) => {
        setData(prev => ({
            ...prev,
            selectedCompany: account._id,
            partyName: account.name
        }));
        setShowAccountModal(false);

        setTimeout(() => {
            const fromDateField = document.getElementById('fromDate');
            if (fromDateField) {
                fromDateField.focus();
            }
        }, 50);
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    const handlePaymentModeChange = (e) => {
        setData(prev => ({ ...prev, paymentMode: e.target.value }));
    };

    const handleGenerateReport = () => {
        if (!data.fromDate || !data.toDate) {
            setError('Please select both from and to dates');
            return;
        }
        if (!data.selectedCompany) {
            setError('Please select an account');
            return;
        }
        setShouldFetch(true);
    };

    const handleRowDoubleClick = (item) => {
        // Determine the route based on transaction type and payment mode
        let route = '';
        const billId = item.billId || item._id;
        const purchaseBillId = item.purchaseBillId || item._id;
        const purchaseReturnBillId = item.purchaseReturnBillId || item._id;
        const paymentAccountId = item.paymentAccountId || item._id;
        const receiptAccountId = item.receiptAccountId || item._id;
        const journalBillId = item.journalBillId || item._id;
        const debitNoteId = item.debitNoteId || item._id;

        switch (item.type?.toLowerCase()) {
            case 'sale':
                if (item.paymentMode === 'cash') {
                    route = `/retailer/cash-sales/edit/${billId}`;
                } else if (item.paymentMode === 'credit') {
                    route = `/retailer/credit-sales/edit/${billId}`;
                }
                break;

            case 'purc':
                route = `/retailer/purchase/edit/${purchaseBillId}`;
                break;

            case 'prrt':
                route = `/retailer/purchase-return/edit/${purchaseReturnBillId}`;
                break;

            case 'pymt':
                route = `/retailer/payments/${paymentAccountId}`;
                break;

            case 'rcpt':
                route = `/retailer/receipts/${receiptAccountId}`;
                break;

            case 'jrnl':
                route = `/retailer/journal/${journalBillId}`;
                break;

            case 'drnt':
                route = `/retailer/debit-note/${debitNoteId}`;
                break;

            case 'credit note':
                route = `/retailer/credit-note/edit/${billId}`;
                break;

            default:
                console.log('No edit route for transaction type:', item.type);
                // You can show a toast notification here
                return;
        }

        if (route) {
            navigate(route);
        }
    };

    const formatBalance = (amount) => {
        return amount > 0 ? `${amount.toFixed(2)} Dr` : `${(-amount).toFixed(2)} Cr`;
    };

    const formatCurrency = (num) => {
        const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
        if (company.dateFormat === 'nepali') {
            // Indian grouping, two decimals, English digits
            return number.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        // English (US) grouping by default
        return number.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    function formatAmountWithType(amount, type = '') {
        const formatted = formatCurrency(Math.abs(amount));
        if (type.toLowerCase() === 'dr' && amount > 0) {
            return `${formatted} Dr`;
        }
        if (type.toLowerCase() === 'cr' && amount < 0) {
            return `${formatted} Cr`;
        }
        if (amount > 0) return `${formatted} Dr`;
        if (amount < 0) return `${formatted} Cr`;
        return `${formatted}`; // For zero
    }

    const handlePrint = () => {
        const rowsToPrint = document.querySelectorAll('.statement-row');

        if (rowsToPrint.length === 0) {
            alert("No statement to print");
            return;
        }

        const printWindow = window.open("", "_blank");
        const printHeader = `
   <div class="print-header">
                <h1 style="text-align:center;text-decoration:underline;">Statement</h1>
            <h1>${data.currentCompanyName || 'Company Name'}</h1>
            <p>
                ${data.company?.address || ''}-${data.company?.ward || ''}, ${data.company?.city || ''},
            </p>
            <hr>
        </div>
    `;

        let tableContent = `
    <style>
        @page {
            margin: 10mm;
        }
        body { 
            font-family: Arial, sans-serif; 
            font-size: 10px; 
            margin: 0;
            padding: 10mm;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            page-break-inside: auto;
        }
        tr { 
            page-break-inside: avoid; 
            page-break-after: auto; 
        }
        th, td { 
            border: 1px solid #000; 
            padding: 4px; 
            text-align: left; 
            white-space: nowrap;
        }
        th { 
            background-color: #f2f2f2 !important; 
            -webkit-print-color-adjust: exact; 
        }
        .print-header { 
            text-align: center; 
            margin-bottom: 15px; 
        }
        .nowrap {
            white-space: nowrap;
        }
        .text-end {
            text-align: right;
        }
        .statement-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding: 0 20px;
            font-size:10px
        }
        .instrument-details {
            font-size: 0.8em;
        }
    </style>
    ${printHeader}
    <div class="statement-header">
        <div><strong>Party Name:</strong> ${data.partyName}</div>
        <div><strong>From:</strong> ${data.fromDate} To:</strong> ${data.toDate}</div>
    </div>
    <table>
        <thead>
            <tr>
                <th class="nowrap">Date</th>
                <th class="nowrap">Vch. No.</th>
                <th class="nowrap">Vch. Type</th>
                <th class="nowrap">Pay Mode</th>
                <th class="nowrap">Account</th>
                <th class="nowrap">Debit</th>
                <th class="nowrap">Credit</th>
                <th class="nowrap">Balance</th>
            </tr>
        </thead>
        <tbody>
    `;

        let balance = data.openingBalance; // Start with opening balance

        // Add statement rows
        data.statement.forEach((item, index) => {
            // For the first row, show opening balance
            if (index === 0) {
                tableContent += `
            <tr>
                <td class="nowrap">${new Date(item.date).toLocaleDateString()}</td>
                <td class="nowrap">${item.billNumber || ''}</td>
                <td class="nowrap">${item.type}</td>
                <td class="nowrap">${item.paymentMode || ''}</td>
                <td class="nowrap">
                    ${item.accountType?.name || item.purchaseSalesType || item.journalAccountType || item.purchaseSalesReturnType || item.drCrNoteAccountType || item.paymentReceiptAccountType || 'Opening'}
                    ${item.partyBillNumber || ''}
                    ${(item.InstType && item.InstType !== 'N/A') ?
                        `<div class="instrument-details"><strong>Inst:</strong> ${item.InstType} ${item.InstNo ? `- ${item.InstNo}` : ''}</div>`
                        : ''}
                </td>
                <td class="text-end">${item.debit ? parseFloat(item.debit).toFixed(2) : '0.00'}</td>
                <td class="text-end">${item.credit ? parseFloat(item.credit).toFixed(2) : '0.00'}</td>
                <td class="text-end">${formatBalance(balance)}</td>
            </tr>
            `;
            } else {
                balance += (item.debit || 0) - (item.credit || 0);
                tableContent += `
            <tr>
                <td class="nowrap">${new Date(item.date).toLocaleDateString()}</td>
                <td class="nowrap">${item.billNumber || ''}</td>
                <td class="nowrap">${item.type}</td>
                <td class="nowrap">${item.paymentMode || ''}</td>
                <td class="nowrap">
                    ${item.accountType?.name || item.purchaseSalesType || item.journalAccountType || item.purchaseSalesReturnType || item.drCrNoteAccountType || item.paymentReceiptAccountType || 'Opening'}
                    ${item.partyBillNumber || ''}
                    ${(item.InstType && item.InstType !== 'N/A') ?
                        `<div class="instrument-details"><strong>Inst:</strong> ${item.InstType} ${item.InstNo ? `- ${item.InstNo}` : ''}</div>`
                        : ''}
                </td>
                <td class="text-end">${item.debit ? parseFloat(item.debit).toFixed(2) : '0.00'}</td>
                <td class="text-end">${item.credit ? parseFloat(item.credit).toFixed(2) : '0.00'}</td>
                <td class="text-end">${formatBalance(balance)}</td>
            </tr>
            `;
            }
        });

        // Add totals row
        tableContent += `
        <tr style="font-weight:bold; border-top: 2px solid #000;">
            <td colspan="5">Totals</td>
            <td class="text-end">${data.totalDebit.toFixed(2)}</td>
            <td class="text-end">${data.totalCredit.toFixed(2)}</td>
            <td class="text-end">${formatBalance(balance)}</td>
        </tr>
        </tbody>
    </table>
    `;

        printWindow.document.write(`
    <html>
        <head>
            <title>Statement</title>
        </head>
        <body>
            ${tableContent}
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 200);
                };
            <\/script>
        </body>
    </html>
    `);
        printWindow.document.close();
    };

    const handleRowClick = (index) => {
        setSelectedRowIndex(index);
    };

    const handleKeyDown = (e, nextFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextFieldId) {
                const nextField = document.getElementById(nextFieldId);
                if (nextField) {
                    nextField.focus();
                }
            } else {
                // If no nextFieldId provided, try to find the next focusable element
                const focusableElements = Array.from(
                    document.querySelectorAll('input, select, button, [tabindex]:not([tabindex="-1"])')
                ).filter(el => !el.disabled && el.offsetParent !== null);

                const currentIndex = focusableElements.findIndex(el => el === e.target);

                if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
                    focusableElements[currentIndex + 1].focus();
                }
            }
        }
    };

    if (loading) return <Loader />;
    if (error) {
        return <div className="alert alert-danger text-center py-5">{error}</div>;
    }

    return (
        <div className="container-fluid">
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-3">
                    <h1 className="h3 mb-0 text-center text-primary">Statement</h1>
                </div>

                <div className="card-body">
                    {/* Search and Filter Section */}
                    <div className="row mb-4 g-3">
                        {/* Account Selection */}
                        <div className="col-md-3">
                            <label htmlFor="account">Party Name:</label>
                            <input
                                type="text"
                                id="account"
                                name="account"
                                className="form-control"
                                value={data.partyName}
                                onClick={() => setShowAccountModal(true)}
                                onFocus={() => setShowAccountModal(true)}
                                readOnly
                                required
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleKeyDown(e, 'fromDate');
                                    }
                                }}
                            />
                            <input type="hidden" id="accountId" name="accountId" value={data.selectedCompany} />
                        </div>

                        {/* Date Range */}
                        <div className="col-md-2">
                            <label htmlFor="fromDate">From Date</label>
                            <input
                                type="text"
                                name="fromDate"
                                id="fromDate"
                                ref={company.dateFormat === 'nepali' ? fromDateRef : null}
                                className="form-control no-date-icon"
                                value={data.fromDate}
                                onChange={handleDateChange}
                                required
                                autoComplete='off'
                                onKeyDown={(e) => handleKeyDown(e, 'toDate')}
                            />
                        </div>
                        <div className="col-md-2">
                            <label htmlFor="toDate">To Date</label>
                            <input
                                type="text"
                                name="toDate"
                                id="toDate"
                                ref={toDateRef}
                                className="form-control no-date-icon"
                                value={data.toDate}
                                onChange={handleDateChange}
                                required
                                autoComplete='off'
                                onKeyDown={(e) => handleKeyDown(e, 'paymentMode')}
                            />
                        </div>

                        {/* Payment Mode */}
                        <div className="col-md-2">
                            <label htmlFor="paymentMode">Payment Mode</label>
                            <select
                                className="form-control"
                                id="paymentMode"
                                ref={paymentModeRef}
                                value={data.paymentMode}
                                onChange={handlePaymentModeChange}
                                onKeyDown={(e) => handleKeyDown(e, 'searchInput')}
                            >
                                {paymentModeOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Search */}
                        <div className="col-md-3">
                            <label htmlFor="searchInput">Search</label>
                            <div className="input-group">
                                <input
                                    type="text"
                                    className="form-control"
                                    id="searchInput"
                                    ref={searchInputRef}
                                    placeholder="Search statement..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoComplete='off'
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !searchQuery) {
                                            handleKeyDown(e, 'generateReport');
                                        }
                                    }}
                                />
                                <button
                                    className="btn btn-outline-secondary"
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    disabled={data.statement.length === 0}
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="col-md-1 d-flex align-items-end">
                            <button
                                type="button"
                                id="generateReport"
                                ref={generateReportRef}
                                className="btn btn-primary w-100"
                                onClick={handleGenerateReport}
                            >
                                <i className="fas fa-chart-line me-2"></i>Generate
                            </button>
                        </div>

                        {/* Print Button */}
                        <div className="col-md-1 d-flex align-items-end">
                            <button
                                className="btn btn-secondary w-100"
                                onClick={handlePrint}
                                disabled={data.statement.length === 0}
                            >
                                <i className="fas fa-print"></i>Print
                            </button>
                        </div>

                        <div className="col-md-10 d-flex align-items-end">
                            <span className="badge bg-primary fs-6">
                                <strong>Party Name:</strong> {data.partyName}
                            </span>
                        </div>
                    </div>

                    {data.statement.length === 0 ? (
                        <div className="alert alert-info text-center py-3">
                            <i className="fas fa-info-circle me-2"></i>
                            Please select account, date range and click "Generate Report" to view statement
                        </div>
                    ) : (
                        <>
                            {/* Statement Table */}
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Vch. No.</th>
                                            <th>Vch. Type</th>
                                            <th>Pay Mode</th>
                                            <th>Account</th>
                                            <th className="text-end">Debit</th>
                                            <th className="text-end">Credit</th>
                                            <th className="text-end">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody ref={tableBodyRef}>
                                        {filteredStatement.map((item, index) => (
                                            <tr
                                                key={index}
                                                className={`statement-row ${selectedRowIndex === index ? 'highlighted-row' : ''}`}
                                                onClick={() => handleRowClick(index)}
                                                onDoubleClick={() => handleRowDoubleClick(item)}
                                                style={{ cursor: 'pointer' }}
                                                title="Double-click to edit"
                                            >
                                                <td>{new NepaliDate(item.date).format('YYYY-MM-DD')}</td>
                                                <td>{item.billNumber || ''}</td>
                                                <td>{item.type}</td>
                                                <td>{item.paymentMode || ''}</td>
                                                <td>
                                                    {item.accountType?.name ||
                                                        item.purchaseSalesType ||
                                                        item.journalAccountType ||
                                                        item.purchaseSalesReturnType ||
                                                        item.drCrNoteAccountType ||
                                                        item.paymentReceiptAccountType ||
                                                        'Opening'}
                                                    {item.partyBillNumber && (
                                                        <span style={{ marginLeft: '5px' }}>
                                                            {item.partyBillNumber}
                                                        </span>
                                                    )}
                                                    {/* Add instrument details if available */}
                                                    {(item.InstType && item.InstType !== 'N/A') && (
                                                        <div>
                                                            <strong>Inst:</strong> {item.InstType} {item.InstNo && `- ${item.InstNo}`}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-end">{formatCurrency(item.debit) ? formatCurrency(item.debit) : '0.00'}</td>
                                                <td className="text-end">{formatCurrency(item.credit) ? formatCurrency(item.credit) : '0.00'}</td>
                                                <td className="text-end">{formatAmountWithType(item.balance) ? formatAmountWithType(item.balance) : '0.00'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="fw-bold">
                                            <td colSpan="5">Totals:</td>
                                            <td className="text-end">{formatCurrency(data.totalDebit)}</td>
                                            <td className="text-end">{formatCurrency(data.totalCredit)}</td>
                                            <td className="text-end">{formatAmountWithType(data.statement.length > 0 ? data.statement[data.statement.length - 1].balance : 0)}</td>

                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Statement Summary */}
                            <div className="row mb-3">
                                <div className="col-md-6">
                                    <div className="card">
                                        <div className="card-body">
                                            <h5 className="card-title">Statement Summary</h5>
                                            <div className="row">
                                                <div className="col">
                                                    <p><strong>Opening Balance:</strong> {formatAmountWithType(data.openingBalance)}</p>
                                                    <p><strong>From Date:</strong> {new Date(data.fromDate).toLocaleDateString()}</p>
                                                    <p><strong>To Date:</strong> {new Date(data.toDate).toLocaleDateString()}</p>
                                                </div>
                                                <div className="col">
                                                    <p><strong>Total Debit:</strong> {formatCurrency(data.totalDebit)}</p>
                                                    <p><strong>Total Credit:</strong> {formatCurrency(data.totalCredit)}</p>
                                                    <p><strong>Closing Balance:</strong> {formatAmountWithType(data.statement.length > 0 ? data.statement[data.statement.length - 1].balance : 0)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Account Modal - Similar to AddPurchase */}
            {showAccountModal && (
                <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content" style={{ height: '500px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title" id="accountModalLabel">Select an Account</h5>
                                <button type="button" className="btn-close" onClick={() => setShowAccountModal(false)}></button>
                            </div>
                            <div className="p-3 bg-white sticky-top">
                                <input
                                    type="text"
                                    id="searchAccount"
                                    className="form-control form-control-sm"
                                    placeholder="Search Account"
                                    autoFocus
                                    autoComplete='off'
                                    onChange={handleAccountSearch}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item');
                                            if (firstAccountItem) {
                                                firstAccountItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item.active');
                                            if (firstAccountItem) {
                                                const accountId = firstAccountItem.getAttribute('data-account-id');
                                                const account = filteredAccounts.length > 0
                                                    ? filteredAccounts.find(a => a._id === accountId)
                                                    : data.accounts.find(a => a._id === accountId);
                                                if (account) {
                                                    selectAccount(account);
                                                }
                                            }
                                        }
                                    }}
                                    ref={accountSearchRef}
                                />
                            </div>
                            <div className="modal-body p-0">
                                <div className="overflow-auto" style={{ height: 'calc(400px - 120px)' }}>
                                    <ul id="accountList" className="list-group">
                                        {filteredAccounts.length > 0 ? (
                                            filteredAccounts
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((account, index) => (
                                                    <li
                                                        key={account._id}
                                                        data-account-id={account._id}
                                                        className={`list-group-item account-item py-2 ${index === 0 ? 'active' : ''}`}
                                                        onClick={() => selectAccount(account)}
                                                        style={{ cursor: 'pointer' }}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'ArrowDown') {
                                                                e.preventDefault();
                                                                const nextItem = e.target.nextElementSibling;
                                                                if (nextItem) {
                                                                    e.target.classList.remove('active');
                                                                    nextItem.classList.add('active');
                                                                    nextItem.focus();
                                                                }
                                                            } else if (e.key === 'ArrowUp') {
                                                                e.preventDefault();
                                                                const prevItem = e.target.previousElementSibling;
                                                                if (prevItem) {
                                                                    e.target.classList.remove('active');
                                                                    prevItem.classList.add('active');
                                                                    prevItem.focus();
                                                                } else {
                                                                    accountSearchRef.current.focus();
                                                                }
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                selectAccount(account);
                                                            }
                                                        }}
                                                        onFocus={(e) => {
                                                            document.querySelectorAll('.account-item').forEach(item => {
                                                                item.classList.remove('active');
                                                            });
                                                            e.target.classList.add('active');
                                                        }}
                                                    >
                                                        <div className="d-flex justify-content-between small">
                                                            <strong>{account.uniqueNumber || 'N/A'} {account.name}</strong>
                                                            <span>📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}</span>
                                                        </div>
                                                    </li>
                                                ))
                                        ) : (
                                            accountSearchRef.current?.value ? (
                                                <li className="list-group-item text-center text-muted small py-2">No accounts found</li>
                                            ) : (
                                                data.accounts
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((account, index) => (
                                                        <li
                                                            key={account._id}
                                                            data-account-id={account._id}
                                                            className={`list-group-item account-item py-2 ${index === 0 ? 'active' : ''}`}
                                                            onClick={() => selectAccount(account)}
                                                            style={{ cursor: 'pointer' }}
                                                            tabIndex={0}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowDown') {
                                                                    e.preventDefault();
                                                                    const nextItem = e.target.nextElementSibling;
                                                                    if (nextItem) {
                                                                        e.target.classList.remove('active');
                                                                        nextItem.classList.add('active');
                                                                        nextItem.focus();
                                                                    }
                                                                } else if (e.key === 'ArrowUp') {
                                                                    e.preventDefault();
                                                                    const prevItem = e.target.previousElementSibling;
                                                                    if (prevItem) {
                                                                        e.target.classList.remove('active');
                                                                        prevItem.classList.add('active');
                                                                        prevItem.focus();
                                                                    } else {
                                                                        accountSearchRef.current.focus();
                                                                    }
                                                                } else if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    selectAccount(account);
                                                                }
                                                            }}
                                                            onFocus={(e) => {
                                                                document.querySelectorAll('.account-item').forEach(item => {
                                                                    item.classList.remove('active');
                                                                });
                                                                e.target.classList.add('active');
                                                            }}
                                                        >
                                                            <div className="d-flex justify-content-between small">
                                                                <strong>{account.uniqueNumber || 'N/A'} {account.name}</strong>
                                                                <span>📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}</span>
                                                            </div>
                                                        </li>
                                                    ))
                                            )
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Statement;