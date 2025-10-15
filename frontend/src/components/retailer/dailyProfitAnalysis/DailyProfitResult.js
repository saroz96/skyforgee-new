import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import Header from '../Header';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

const DailyProfitResult = () => {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const location = useLocation();
    const navigate = useNavigate();
    const tableRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        const fetchResults = async () => {
            try {
                // Extract query parameters from URL
                const searchParams = new URLSearchParams(location.search);
                const fromDate = searchParams.get('fromDate');
                const toDate = searchParams.get('toDate');

                if (!fromDate || !toDate) {
                    setError('Date range parameters are required');
                    setLoading(false);
                    return;
                }

                const response = await api.post('/api/retailer/daily-profit/sales-analysis', {
                    fromDate,
                    toDate
                });

                if (response.data.success) {
                    setResults(response.data.data);
                } else {
                    setError(response.data.error);
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch profit analysis results');
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [location.search]);

    // Filter and paginate data
    const filteredData = results?.dailyProfit?.filter(day => {
        const matchesSearch = day.date.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === '' ||
            (filter === 'profit' && day.netProfit >= 0) ||
            (filter === 'loss' && day.netProfit < 0);
        return matchesSearch && matchesFilter;
    }) || [];

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        // Implement Excel export functionality
        alert('Excel export functionality would be implemented here');
    };

    const formatCurrency = (amount) => {
        return `Rs. ${amount?.toFixed(2) || '0.00'}`;
    };

    const formatPercentage = (value, total) => {
        if (!total || total === 0) return '0.00%';
        return `${((value / total) * 100).toFixed(2)}%`;
    };

    if (loading) {
        return (
            <div className="container expanded-container">
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3">Loading profit analysis results...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container expanded-container">
                <div className="alert alert-danger mt-4" role="alert">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    {error}
                </div>
                <button className="btn btn-secondary" onClick={() => navigate('/daily-profit/sales-analysis')}>
                    <i className="fas fa-arrow-left me-2"></i> Back to Form
                </button>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="container expanded-container">
                <div className="alert alert-warning" role="alert">
                    No results found for the selected date range.
                </div>
            </div>
        );
    }

    // Chart data
    const chartData = {
        labels: results.dailyProfit.map(day => day.date),
        datasets: [
            {
                label: 'Net Profit',
                data: results.dailyProfit.map(day => day.netProfit),
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderWidth: 2,
                tension: 0.1,
            },
        ],
    };

    const revenueData = {
        labels: ['Net Sales', 'Returns'],
        datasets: [
            {
                data: [results.summary.totalNetSales, results.summary.totalSalesReturns],
                backgroundColor: ['rgba(40, 167, 69, 0.8)', 'rgba(220, 53, 69, 0.8)'],
                borderColor: ['rgba(40, 167, 69, 1)', 'rgba(220, 53, 69, 1)'],
                borderWidth: 1,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                    },
                },
            },
        },
        scales: {
            y: {
                beginAtZero: false,
                ticks: {
                    callback: (value) => formatCurrency(value),
                },
            },
        },
    };

    const revenueOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const label = context.label || '';
                        const value = context.raw;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(2);
                        return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                    },
                },
            },
        },
    };

    return (
        <div className="container-fluid">
            <Header />
            {/* Print Header */}
            <div className="d-none print-only">
                <div className="print-header text-center">
                    <h2>Profit Analysis Report</h2>
                    <p>
                        Date Range: {results.fromDate} to {results.toDate}
                        <br />
                        Generated on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                    </p>
                    <hr />
                </div>
            </div>

            <div className="card expanded-card">
                <h1 className="mb-4 text-center" style={{ textDecoration: 'underline' }}>
                    Profit Analysis Results
                </h1>
                <h4 className="text-center mb-4">
                    Date: {results.fromDate} to {results.toDate}
                </h4>

                {/* Summary Cards */}
                <div className="row mb-4">
                    <div className="col-md-3 col-sm-6">
                        <div className="card summary-card border-left-success">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 className="text-uppercase text-muted mb-0">Total Net Sales</h6>
                                        <h3 className="mb-0 text-success text-end">
                                            {formatCurrency(results.summary.totalNetSales)}
                                        </h3>
                                    </div>
                                    <div className="summary-icon text-success">
                                        <i className="fas fa-line-chart"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-3 col-sm-6">
                        <div className="card summary-card border-left-danger">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 className="text-uppercase text-muted mb-0">Total Net Purchases</h6>
                                        <h3 className="mb-0 text-danger">
                                            {formatCurrency(results.summary.totalNetPurchases)}
                                        </h3>
                                    </div>
                                    <div className="summary-icon text-danger">
                                        <i className="fas fa-shopping-cart"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-3 col-sm-6">
                        <div className={`card summary-card border-left-${results.summary.totalNetProfit >= 0 ? 'primary' : 'danger'}`}>
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 className="text-uppercase text-muted mb-0">Total Net Profit</h6>
                                        <h3 className={`mb-0 text-${results.summary.totalNetProfit >= 0 ? 'primary' : 'danger'}`}>
                                            {formatCurrency(results.summary.totalNetProfit)}
                                        </h3>
                                        {/* <small className="text-muted">
                                            {formatPercentage(results.summary.totalNetProfit, results.summary.totalNetSales)} On S.P
                                        </small> */}
                                    </div>
                                    <div className={`summary-icon text-${results.summary.totalNetProfit >= 0 ? 'primary' : 'danger'}`}>
                                        <i className="fas fa-money-bill-wave"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-3 col-sm-6">
                        <div className="card summary-card border-left-warning">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 className="text-uppercase text-muted mb-0">Profit/Loss Days</h6>
                                        <h3 className="mb-0">
                                            <span className="text-success">{results.summary.daysWithProfit}</span> /{' '}
                                            <span className="text-danger">{results.summary.daysWithLoss}</span>
                                        </h3>
                                        {/* <small className="text-muted">
                                            {formatPercentage(
                                                results.summary.daysWithProfit,
                                                results.summary.daysWithProfit + results.summary.daysWithLoss
                                            )} Profitable
                                        </small> */}
                                    </div>
                                    <div className="summary-icon text-warning">
                                        <i className="fas fa-calendar-alt"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="row mb-4 no-print">
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-header bg-primary text-white">
                                <h3 className="card-title">Daily Profit Trend</h3>
                            </div>
                            <div className="card-body">
                                <div style={{ height: '300px' }}>
                                    <Line data={chartData} options={chartOptions} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-header bg-info text-white">
                                <h3 className="card-title">Revenue Composition</h3>
                            </div>
                            <div className="card-body">
                                <div style={{ height: '300px' }}>
                                    <Doughnut data={revenueData} options={revenueOptions} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search and Filter Section */}
                <div className="row search-filter-container no-print">
                    <div className="col">
                        <div className="input-group">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search by date..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button
                                className="btn btn-outline-secondary"
                                type="button"
                                onClick={() => setSearchQuery('')}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => navigate('/retailer/daily-profit/sales-analysis')}
                            >
                                <i className="fas fa-arrow-left me-2"></i> Back to Form
                            </button>
                            <button className="btn btn-primary ms-2" onClick={handlePrint}>
                                <i className="fas fa-print me-2"></i> Print Report
                            </button>
                            <button className="btn btn-success ms-2" onClick={handleExportExcel}>
                                <i className="fas fa-file-excel me-2"></i> Export to Excel
                            </button>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="d-flex align-items-center">
                            <label htmlFor="profitFilter" className="form-label me-2 mb-0">
                                Filter:
                            </label>
                            <select
                                className="form-select"
                                id="profitFilter"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="">All Days</option>
                                <option value="profit">Profit Days Only</option>
                                <option value="loss">Loss Days Only</option>
                            </select>
                        </div>
                    </div>
                </div>
                <br />
                {/* Daily Profit Table */}
                <div className="card">
                    <div className="card-header bg-gray-light d-flex justify-content-between align-items-center">
                        <h3 className="card-title">Daily Profit Details</h3>
                    </div>
                    <div className="card-body table-responsive p-0">
                        <table className="table table-hover" ref={tableRef}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th className="text-end">Gross Sales</th>
                                    <th className="text-end">Sales Returns</th>
                                    <th className="text-end">Net Sales</th>
                                    <th className="text-end">Gross Purchases</th>
                                    <th className="text-end">Purchase Returns</th>
                                    <th className="text-end">Net Purchases</th>
                                    <th className="text-end">Net Profit</th>
                                    <th className="text-end">S.P (%)</th>
                                    <th className="text-end">C.P (%)</th>
                                    <th>Transactions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.map((day) => (
                                    <tr
                                        key={day.date}
                                        className={`profit-row ${day.netProfit >= 0 ? 'profit' : 'loss'}`}
                                    >
                                        <td>{day.date}</td>
                                        <td className="text-end text-success">{formatCurrency(day.grossSales)}</td>
                                        <td className="text-end text-danger">{formatCurrency(day.returns)}</td>
                                        <td className={`text-end ${day.netSales >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {formatCurrency(day.netSales)}
                                        </td>
                                        <td className="text-end text-success">{formatCurrency(day.grossPurchases)}</td>
                                        <td className="text-end text-danger">{formatCurrency(day.purchaseReturns)}</td>
                                        <td className={`text-end ${day.netPurchases >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {formatCurrency(day.netPurchases)}
                                        </td>
                                        <td className={`text-end ${day.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                            <strong>{formatCurrency(day.netProfit)}</strong>
                                            {day.netProfit >= 0 ? (
                                                <i className="fas fa-caret-up text-success ms-1"></i>
                                            ) : (
                                                <i className="fas fa-caret-down text-danger ms-1"></i>
                                            )}
                                        </td>
                                        <td className={`text-end ${day.netProfit / day.netSales >= 0 ? 'text-success' : 'text-danger'}`}>
                                            <strong>{formatPercentage(day.netProfit, day.netSales)}</strong>
                                        </td>
                                        <td className={`text-end ${day.netProfit / day.netCost >= 0 ? 'text-success' : 'text-danger'}`}>
                                            <strong>{formatPercentage(day.netProfit, day.netCost)}</strong>
                                        </td>
                                        <td>
                                            {day.salesCount > 0 && (
                                                <span className="badge bg-success me-1">
                                                    <i className="fas fa-arrow-up"></i>
                                                    {day.salesCount} sales
                                                </span>
                                            )}
                                            {day.purchaseCount > 0 && (
                                                <span className="badge bg-danger me-1">
                                                    <i className="fas fa-arrow-down"></i>
                                                    {day.purchaseCount} purchases
                                                </span>
                                            )}
                                            {day.returnCount > 0 && (
                                                <span className="badge bg-warning">
                                                    <i className="fas fa-exchange-alt"></i>
                                                    {day.returnCount} returns
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-light">
                                <tr>
                                    <th>Totals</th>
                                    <th className="text-end text-success">{formatCurrency(results.summary.totalGrossSales)}</th>
                                    <th className="text-end text-danger">{formatCurrency(results.summary.totalSalesReturns)}</th>
                                    <th className={`text-end ${results.summary.totalNetSales >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatCurrency(results.summary.totalNetSales)}
                                    </th>
                                    <th className="text-end text-success">{formatCurrency(results.summary.totalGrossPurchases)}</th>
                                    <th className="text-end text-danger">{formatCurrency(results.summary.totalPurchaseReturns)}</th>
                                    <th className={`text-end ${results.summary.totalNetPurchases >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatCurrency(results.summary.totalNetPurchases)}
                                    </th>
                                    <th className={`text-end ${results.summary.totalNetProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatCurrency(results.summary.totalNetProfit)}
                                    </th>
                                    <th className={`text-end ${results.summary.totalNetProfit / results.summary.totalNetSales >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatPercentage(results.summary.totalNetProfit, results.summary.totalNetSales)}
                                    </th>
                                    <th className={`text-end ${results.summary.totalNetProfit / results.summary.totalNetPurchases >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatPercentage(results.summary.totalNetProfit, results.summary.totalNetPurchases)}
                                    </th>
                                    <th>
                                        <span className="badge bg-secondary">
                                            {results.dailyProfit.reduce((sum, day) => sum + day.salesCount + day.purchaseCount + day.returnCount, 0)}
                                        </span>
                                    </th>
                                </tr>
                            </tfoot>
                        </table>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="row mt-3">
                                <div className="col-sm-12 col-md-5">
                                    <div className="dataTables_info" role="status" aria-live="polite">
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of{' '}
                                        {filteredData.length} entries
                                    </div>
                                </div>
                                <div className="col-sm-12 col-md-7">
                                    <nav>
                                        <ul className="pagination justify-content-end">
                                            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => paginate(currentPage - 1)}>
                                                    Previous
                                                </button>
                                            </li>
                                            {[...Array(totalPages)].map((_, index) => (
                                                <li key={index} className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}>
                                                    <button className="page-link" onClick={() => paginate(index + 1)}>
                                                        {index + 1}
                                                    </button>
                                                </li>
                                            ))}
                                            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => paginate(currentPage + 1)}>
                                                    Next
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Report Footer */}
                <div className="mt-3 text-muted text-end no-print">
                    <small>Report generated on {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</small>
                </div>
            </div>
        </div>
    );
};

export default DailyProfitResult;