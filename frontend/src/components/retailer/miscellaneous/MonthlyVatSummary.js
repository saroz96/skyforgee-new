import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import NepaliDate from 'nepali-date';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import NotificationToast from '../../NotificationToast';
import Loader from '../../Loader';

const MonthlyVatSummary = () => {
    const { draftSave, setDraftSave } = usePageNotRefreshContext();
    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });
    const navigate = useNavigate();
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [formValues, setFormValues] = useState(draftSave?.formValues || {
        companyDateFormat: 'nepali',
        month: null,
        year: null,
        nepaliMonth: null,
        nepaliYear: null,
    });

    const [reportData, setReportData] = useState(draftSave?.reportData || {
        company: null,
        currentFiscalYear: null,
        totals: null,
        currentNepaliYear: new NepaliDate().getYear(),
        reportDateRange: '',
        currentCompanyName: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Save draft data
    useEffect(() => {
        if (reportData.totals || formValues.month || formValues.year || formValues.nepaliMonth || formValues.nepaliYear) {
            setDraftSave({
                ...draftSave,
                monthlyVatReportData: {
                    ...formValues,
                    ...reportData
                }
            });
        }
    }, [formValues, reportData]);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setFormValues(prev => ({
            ...prev,
            [name]: value === '' ? null : value
        }));
    };

    const handleGenerateReport = async (e) => {
        e.preventDefault();

        // Validation
        if (formValues.companyDateFormat === 'nepali') {

            if (!formValues.nepaliMonth || !formValues.nepaliYear) {
                setNotification({
                    show: true,
                    message: `Please select both Nepali month and year`,
                    type: 'error'
                });
                return;
            }
        } else {
            if (!formValues.month || !formValues.year) {
                setNotification({
                    show: true,
                    message: `Please select both Nepali month and year`,
                    type: 'error'
                });
                return;
            }
        }

        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (formValues.companyDateFormat === 'english') {
                params.append('month', formValues.month);
                params.append('year', formValues.year);
            } else {
                params.append('nepaliMonth', formValues.nepaliMonth);
                params.append('nepaliYear', formValues.nepaliYear);
            }

            const response = await api.get('/api/retailer/monthly-vat-summary', { params });
            setReportData(prev => ({
                ...prev,
                ...response.data.data,
                currentCompanyName: response.data.data.currentCompanyName || ''
            }));
        } catch (err) {
            setNotification({
                show: true,
                message: err.response?.data?.error || 'Failed to fetch monthly VAT report',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        if (!reportData.totals) {
            setNotification({
                show: true,
                message: error.response?.data?.error || 'No data to export',
                type: 'error'
            });
            return;
        }
        console.log('Export to Excel functionality would go here');
    };

    // const formatCurrency = (amount) => {
    //     return parseFloat(amount || 0).toLocaleString('en-US', {
    //         minimumFractionDigits: 2,
    //         maximumFractionDigits: 2
    //     });
    // };
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

    const getNetValueClass = (value) => {
        return value >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold';
    };

    if (loading) return <Loader />;

    const handleKeyDown = (e, nextFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextFieldId) {
                document.getElementById(nextFieldId)?.focus();
            }
        }
    };

    return (
        <div className="container-fluid mt-4">
            <Header />
            <div className="card mt-4 p-4">
                <div className="report-header bg-light p-4 rounded-3 shadow-sm mb-4">
                    <h2 className="text-center mb-4 text-decoration-underline">Monthly VAT Summary</h2>
                    <form onSubmit={handleGenerateReport}>
                        <div className="row g-3">
                            {formValues.companyDateFormat === 'english' ? (
                                <>
                                    <div className="col-md-3">
                                        <label htmlFor="month" className="form-label fw-semibold">Month</label>
                                        <select
                                            name="month"
                                            id="month"
                                            className="form-select"
                                            value={formValues.month || ''}
                                            onChange={handleDateChange}
                                        >
                                            <option value="">Select Month</option>
                                            {["January", "February", "March", "April", "May", "June",
                                                "July", "August", "September", "October", "November", "December"]
                                                .map((monthName, index) => (
                                                    <option key={monthName} value={index + 1}>
                                                        {monthName}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label htmlFor="year" className="form-label fw-semibold">Year</label>
                                        <input
                                            type="number"
                                            name="year"
                                            id="year"
                                            className="form-control"
                                            value={formValues.year || ''}
                                            onKeyDown={handleKeyDown}
                                            onChange={handleDateChange}
                                            placeholder={`e.g. ${new Date().getFullYear()}`}
                                            autoComplete='off'
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="col-md-3">
                                        <label htmlFor="nepaliMonth" className="form-label fw-semibold">Month (Nepali)</label>
                                        <select
                                            name="nepaliMonth"
                                            id="nepaliMonth"
                                            className="form-select"
                                            value={formValues.nepaliMonth || ''}
                                            onChange={handleDateChange}
                                            autoFocus
                                            onKeyDown={(e) => handleKeyDown(e, 'nepaliYear')}
                                        >
                                            <option value="">Select Month</option>
                                            {["Baisakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashoj",
                                                "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"]
                                                .map((monthName, index) => (
                                                    <option key={monthName} value={index + 1}>
                                                        {monthName}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label htmlFor="nepaliYear" className="form-label fw-semibold">Year (Nepali)</label>
                                        <input
                                            type="text"
                                            name="nepaliYear"
                                            id="nepaliYear"
                                            className="form-control"
                                            value={formValues.nepaliYear || ''}
                                            onChange={handleDateChange}
                                            placeholder={`e.g. ${reportData.currentNepaliYear}`}
                                            autoComplete='off'
                                            onKeyDown={(e) => handleKeyDown(e, 'generateReport')}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="col-md-3 d-flex align-items-end">
                                <button type="submit" className="btn btn-primary w-100"
                                    id="generateReport"
                                >
                                    <i className="fas fa-search me-2"></i> Generate Report
                                </button>
                            </div>
                            <div className="col-md-3 d-flex align-items-end">
                                <button
                                    type="button"
                                    id="exportExcel"
                                    className="btn btn-success w-100"
                                    onClick={handleExportExcel}
                                    disabled={!reportData.totals}
                                >
                                    <i className="fas fa-file-excel me-2"></i> Export to Excel
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {reportData.totals ? (
                    <div className="table-container mt-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        <table className="table table-bordered table-hover" id="vatReportTable">
                            <thead>
                                <tr>
                                    <th rowSpan="2" className="text-center align-middle bg-primary text-white">Date Range</th>
                                    <th colSpan="4" className="text-center bg-primary text-white">Purchase</th>
                                    <th className="bg-light" style={{ width: '10px' }}></th>
                                    <th colSpan="4" className="text-center bg-primary text-white">Purchase Return</th>
                                    <th className="bg-light" style={{ width: '10px' }}></th>
                                    <th colSpan="3" className="text-center bg-primary text-white">Net Purchase</th>
                                    <th className="bg-light" style={{ width: '10px' }}></th>
                                    <th colSpan="4" className="text-center bg-primary text-white">Sales</th>
                                    <th className="bg-light" style={{ width: '10px' }}></th>
                                    <th colSpan="4" className="text-center bg-primary text-white">Sales Return</th>
                                    <th className="bg-light" style={{ width: '10px' }}></th>
                                    <th colSpan="3" className="text-center bg-primary text-white">Net Sales</th>
                                    <th className="bg-light" style={{ width: '10px' }}></th>
                                    <th colSpan="3" className="text-center bg-primary text-white">Net VAT</th>
                                </tr>
                                <tr>
                                    <th>Taxable</th>
                                    <th>Non-VAT</th>
                                    <th>VAT</th>
                                    <th>Total</th>
                                    <th className="bg-light"></th>
                                    <th>Taxable</th>
                                    <th>Non-VAT</th>
                                    <th>VAT</th>
                                    <th>Total</th>
                                    <th className="bg-light"></th>
                                    <th>Taxable</th>
                                    <th>Non-VAT</th>
                                    <th>Total</th>
                                    <th className="bg-light"></th>
                                    <th>Taxable</th>
                                    <th>Non-VAT</th>
                                    <th>VAT</th>
                                    <th>Total</th>
                                    <th className="bg-light"></th>
                                    <th>Taxable</th>
                                    <th>Non-VAT</th>
                                    <th>VAT</th>
                                    <th>Total</th>
                                    <th className="bg-light"></th>
                                    <th>Taxable</th>
                                    <th>Non-VAT</th>
                                    <th>Total</th>
                                    <th className="bg-light"></th>
                                    <th>Purc VAT</th>
                                    <th>Sales VAT</th>
                                    <th>Net Payable</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="align-middle"><strong>{reportData.reportDateRange}</strong></td>
                                    <td>{formatCurrency(reportData.totals.purchase?.taxableAmount)}</td>
                                    <td>{formatCurrency(reportData.totals.purchase?.nonVatAmount)}</td>
                                    <td>{formatCurrency(reportData.totals.purchase?.vatAmount)}</td>
                                    <td className="fw-bold">
                                        {formatCurrency(
                                            (reportData.totals.purchase?.taxableAmount || 0) +
                                            (reportData.totals.purchase?.nonVatAmount || 0) +
                                            (reportData.totals.purchase?.vatAmount || 0)
                                        )}
                                    </td>
                                    <td className="bg-light"></td>
                                    <td>{formatCurrency(reportData.totals.purchaseReturn?.taxableAmount)}</td>
                                    <td>{formatCurrency(reportData.totals.purchaseReturn?.nonVatAmount)}</td>
                                    <td>{formatCurrency(reportData.totals.purchaseReturn?.vatAmount)}</td>
                                    <td className="fw-bold">
                                        {formatCurrency(
                                            (reportData.totals.purchaseReturn?.taxableAmount || 0) +
                                            (reportData.totals.purchaseReturn?.nonVatAmount || 0) +
                                            (reportData.totals.purchaseReturn?.vatAmount || 0)
                                        )}
                                    </td>
                                    <td className="bg-light"></td>
                                    <td className={getNetValueClass(
                                        (reportData.totals.purchase?.taxableAmount || 0) -
                                        (reportData.totals.purchaseReturn?.taxableAmount || 0)
                                    )}>
                                        {formatCurrency(
                                            (reportData.totals.purchase?.taxableAmount || 0) -
                                            (reportData.totals.purchaseReturn?.taxableAmount || 0)
                                        )}
                                    </td>
                                    <td className={getNetValueClass(
                                        (reportData.totals.purchase?.nonVatAmount || 0) -
                                        (reportData.totals.purchaseReturn?.nonVatAmount || 0)
                                    )}>
                                        {formatCurrency(
                                            (reportData.totals.purchase?.nonVatAmount || 0) -
                                            (reportData.totals.purchaseReturn?.nonVatAmount || 0)
                                        )}
                                    </td>
                                    <td className={`fw-bold ${getNetValueClass(
                                        ((reportData.totals.purchase?.taxableAmount || 0) +
                                            (reportData.totals.purchase?.nonVatAmount || 0) +
                                            (reportData.totals.purchase?.vatAmount || 0)) -
                                        ((reportData.totals.purchaseReturn?.taxableAmount || 0) +
                                            (reportData.totals.purchaseReturn?.nonVatAmount || 0) +
                                            (reportData.totals.purchaseReturn?.vatAmount || 0))
                                    )}`}>
                                        {formatCurrency(
                                            ((reportData.totals.purchase?.taxableAmount || 0) +
                                                (reportData.totals.purchase?.nonVatAmount || 0) +
                                                (reportData.totals.purchase?.vatAmount || 0)) -
                                            ((reportData.totals.purchaseReturn?.taxableAmount || 0) +
                                                (reportData.totals.purchaseReturn?.nonVatAmount || 0) +
                                                (reportData.totals.purchaseReturn?.vatAmount || 0))
                                        )}
                                    </td>
                                    <td className="bg-light"></td>
                                    <td>{formatCurrency(reportData.totals.sales?.taxableAmount)}</td>
                                    <td>{formatCurrency(reportData.totals.sales?.nonVatAmount)}</td>
                                    <td>{formatCurrency(reportData.totals.sales?.vatAmount)}</td>
                                    <td className="fw-bold">
                                        {formatCurrency(
                                            (reportData.totals.sales?.taxableAmount || 0) +
                                            (reportData.totals.sales?.nonVatAmount || 0) +
                                            (reportData.totals.sales?.vatAmount || 0)
                                        )}
                                    </td>
                                    <td className="bg-light"></td>
                                    <td>{formatCurrency(reportData.totals.salesReturn?.taxableAmount)}</td>
                                    <td>{formatCurrency(reportData.totals.salesReturn?.nonVatAmount)}</td>
                                    <td>{formatCurrency(reportData.totals.salesReturn?.vatAmount)}</td>
                                    <td className="fw-bold">
                                        {formatCurrency(
                                            (reportData.totals.salesReturn?.taxableAmount || 0) +
                                            (reportData.totals.salesReturn?.nonVatAmount || 0) +
                                            (reportData.totals.salesReturn?.vatAmount || 0)
                                        )}
                                    </td>
                                    <td className="bg-light"></td>
                                    <td className={getNetValueClass(
                                        (reportData.totals.sales?.taxableAmount || 0) -
                                        (reportData.totals.salesReturn?.taxableAmount || 0)
                                    )}>
                                        {formatCurrency(
                                            (reportData.totals.sales?.taxableAmount || 0) -
                                            (reportData.totals.salesReturn?.taxableAmount || 0)
                                        )}
                                    </td>
                                    <td className={getNetValueClass(
                                        (reportData.totals.sales?.nonVatAmount || 0) -
                                        (reportData.totals.salesReturn?.nonVatAmount || 0)
                                    )}>
                                        {formatCurrency(
                                            (reportData.totals.sales?.nonVatAmount || 0) -
                                            (reportData.totals.salesReturn?.nonVatAmount || 0)
                                        )}
                                    </td>
                                    <td className={`fw-bold ${getNetValueClass(
                                        ((reportData.totals.sales?.taxableAmount || 0) +
                                            (reportData.totals.sales?.nonVatAmount || 0) +
                                            (reportData.totals.sales?.vatAmount || 0)) -
                                        ((reportData.totals.salesReturn?.taxableAmount || 0) +
                                            (reportData.totals.salesReturn?.nonVatAmount || 0) +
                                            (reportData.totals.salesReturn?.vatAmount || 0))
                                    )}`}>
                                        {formatCurrency(
                                            ((reportData.totals.sales?.taxableAmount || 0) +
                                                (reportData.totals.sales?.nonVatAmount || 0) +
                                                (reportData.totals.sales?.vatAmount || 0)) -
                                            ((reportData.totals.salesReturn?.taxableAmount || 0) +
                                                (reportData.totals.salesReturn?.nonVatAmount || 0) +
                                                (reportData.totals.salesReturn?.vatAmount || 0))
                                        )}
                                    </td>
                                    <td className="bg-light"></td>
                                    <td>{formatCurrency(reportData.totals.netPurchaseVat)}</td>
                                    <td>{formatCurrency(reportData.totals.netSalesVat)}</td>
                                    <td className={`fw-bold ${reportData.totals.netVat >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatCurrency(reportData.totals.netVat)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="alert alert-info text-center py-4">
                        <i className="fas fa-info-circle me-2"></i>
                        Select month and year to generate the VAT report
                    </div>
                )}
            </div>
            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />
        </div>
    );
};

export default MonthlyVatSummary;