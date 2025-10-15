// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import { useAuth } from '../../../context/AuthContext';
// import { usePageNotRefreshContext } from '../PageNotRefreshContext';

// const StatsCards = () => {
//     const { statsCardDraftSave, setStatsCardDraftSave } = usePageNotRefreshContext();
//     const [company] = useState({
//         dateFormat: 'nepali',
//         vatEnabled: true,
//         fiscalYear: {}
//     });
//     const [stats, setStats] = useState({
//         cashBalance: statsCardDraftSave?.cashBalance || 0,
//         netSales: statsCardDraftSave?.netSales || 0,
//         bankBalance: statsCardDraftSave?.bankBalance || 0,
//         totalStock: statsCardDraftSave?.totalStock || 0,
//         loading: !statsCardDraftSave,
//         error: null,
//         isFresh: false
//     });

//     const { currentCompany } = useAuth();

//     const formatCurrency = (num) => {
//         const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
//         if (company.dateFormat === 'nepali') {
//             return number.toLocaleString('en-IN', {
//                 minimumFractionDigits: 2,
//                 maximumFractionDigits: 2
//             });
//         }
//         return number.toLocaleString('en-US', {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2
//         });
//     };

//     useEffect(() => {
//         if (!currentCompany) return;

//         const fetchFreshData = async () => {
//             try {
//                 const response = await axios.get('/api/retailer/retailerDashboard/indexv1', {
//                     headers: { 'Content-Type': 'application/json' },
//                     withCredentials: true
//                 });

//                 if (response.data.success) {
//                     const { financialSummary } = response.data.data;
//                     const freshData = {
//                         cashBalance: financialSummary.cashBalance,
//                         netSales: financialSummary.netSales,
//                         bankBalance: financialSummary.bankBalance,
//                         totalStock: financialSummary.totalStockValue,
//                         loading: false,
//                         error: null,
//                         isFresh: true
//                     };

//                     setStats(freshData);
//                     setStatsCardDraftSave({
//                         cashBalance: financialSummary.cashBalance,
//                         netSales: financialSummary.netSales,
//                         bankBalance: financialSummary.bankBalance,
//                         totalStock: financialSummary.totalStockValue
//                     });
//                 } else {
//                     throw new Error(response.data.error || 'Failed to load dashboard data');
//                 }
//             } catch (error) {
//                 console.error('Background refresh failed:', error);
//                 // Only show error if we don't have draft data
//                 if (!statsCardDraftSave) {
//                     setStats(prev => ({
//                         ...prev,
//                         loading: false,
//                         error: error.response?.data?.error || error.message,
//                         isFresh: false
//                     }));
//                 }
//             }
//         };

//         // If we have draft data, show it immediately and fetch fresh in background
//         if (statsCardDraftSave) {
//             fetchFreshData().catch(e => console.log('Background update failed:', e));
//         } 
//         // If no draft data, fetch fresh data (will show loading state)
//         else {
//             fetchFreshData();
//         }

//         // Set up auto-refresh every 5 minutes
//         const interval = setInterval(fetchFreshData, 300000);
//         return () => clearInterval(interval);
//     }, [currentCompany, statsCardDraftSave, setStatsCardDraftSave]);

//     // Render loading state only if we have no data at all
//     if (stats.loading && !statsCardDraftSave) {
//         return (
//             <div className="row">
//                 {[1, 2, 3, 4].map((item) => (
//                     <div key={item} className="col-lg-3 col-md-6 col-12 mb-4">
//                         <div className="card">
//                             <div className="card-body">
//                                 <div className="placeholder-glow">
//                                     <h6 className="text-muted mb-1 placeholder col-5"></h6>
//                                     <h3 className="mb-0 placeholder col-8"></h3>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 ))}
//             </div>
//         );
//     }

//     // Show error only if we have no draft data to fall back to
//     if (stats.error && !statsCardDraftSave) {
//         return (
//             <div className="alert alert-danger">
//                 <i className="bi bi-exclamation-triangle-fill me-2"></i>
//                 {stats.error}
//                 <button
//                     className="btn btn-sm btn-outline-danger ms-3"
//                     onClick={() => setStats(prev => ({ ...prev, error: null, loading: true }))}
//                 >
//                     Retry
//                 </button>
//             </div>
//         );
//     }

//     // Determine which data to display (prefer fresh data if available)
//     const displayData = stats.isFresh ? stats : statsCardDraftSave || stats;

//     return (
//         <div className="row">
//             {/* Cash Card */}
//             <div className="col-lg-3 col-md-6 col-12 mb-4">
//                 <div className="card border-start border-primary border-4">
//                     <div className="card-body">
//                         <div className="d-flex justify-content-between align-items-center">
//                             <div>
//                                 <h6 className="text-muted mb-1">Cash Balance</h6>
//                                 <h3 className="mb-0">
//                                     {formatCurrency(displayData.cashBalance)}
//                                     <small className="text-muted fs-6"> Rs.</small>
//                                 </h3>
//                             </div>
//                             <div className="bg-primary bg-opacity-10 p-3 rounded">
//                                 <i className="bi bi-cash-coin fs-4 text-primary"></i>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             {/* Sales Card */}
//             <div className="col-lg-3 col-md-6 col-12 mb-4">
//                 <div className="card border-start border-success border-4">
//                     <div className="card-body">
//                         <div className="d-flex justify-content-between align-items-center">
//                             <div>
//                                 <h6 className="text-muted mb-1">Net Sales</h6>
//                                 <h3 className="mb-0">
//                                     {formatCurrency(displayData.netSales)}
//                                     <small className="text-muted fs-6"> Rs.</small>
//                                 </h3>
//                             </div>
//                             <div className="bg-success bg-opacity-10 p-3 rounded">
//                                 <i className="bi bi-graph-up fs-4 text-success"></i>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             {/* Bank Card */}
//             <div className="col-lg-3 col-md-6 col-12 mb-4">
//                 <div className="card border-start border-info border-4">
//                     <div className="card-body">
//                         <div className="d-flex justify-content-between align-items-center">
//                             <div>
//                                 <h6 className="text-muted mb-1">Bank Balance</h6>
//                                 <h3 className="mb-0">
//                                     {formatCurrency(displayData.bankBalance)}
//                                     <small className="text-muted fs-6"> Rs.</small>
//                                 </h3>
//                             </div>
//                             <div className="bg-info bg-opacity-10 p-3 rounded">
//                                 <i className="bi bi-bank fs-4 text-info"></i>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             {/* Inventory Card */}
//             <div className="col-lg-3 col-md-6 col-12 mb-4">
//                 <div className="card border-start border-warning border-4">
//                     <div className="card-body">
//                         <div className="d-flex justify-content-between align-items-center">
//                             <div>
//                                 <h6 className="text-muted mb-1">Total Inventory</h6>
//                                 <h3 className="mb-0">
//                                     {formatCurrency(displayData.totalStock)}
//                                     <small className="text-muted fs-6"> Rs.</small>
//                                 </h3>
//                             </div>
//                             <div className="bg-warning bg-opacity-10 p-3 rounded">
//                                 <i className="bi bi-box-seam fs-4 text-warning"></i>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default StatsCards;

//---------------------------------------------------------------------

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';

const StatsCards = () => {
    const { statsCardDraftSave, setStatsCardDraftSave } = usePageNotRefreshContext();
    const [company] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });
    const [stats, setStats] = useState({
        cashBalance: statsCardDraftSave?.cashBalance || 0,
        netSales: statsCardDraftSave?.netSales || 0,
        bankBalance: statsCardDraftSave?.bankBalance || 0,
        totalStock: statsCardDraftSave?.totalStock || 0,
        error: null,
        isFresh: false
    });

    const { currentCompany } = useAuth();

    const formatCurrency = (num) => {
        const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
        if (company.dateFormat === 'nepali') {
            return number.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        return number.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    useEffect(() => {
        if (!currentCompany) return;

        const fetchFreshData = async () => {
            try {
                const response = await axios.get('/api/retailer/retailerDashboard/indexv1', {
                    headers: { 'Content-Type': 'application/json' },
                    withCredentials: true
                });

                if (response.data.success) {
                    const { financialSummary } = response.data.data;
                    const freshData = {
                        cashBalance: financialSummary.cashBalance,
                        netSales: financialSummary.netSales,
                        bankBalance: financialSummary.bankBalance,
                        totalStock: financialSummary.totalStockValue,
                        error: null,
                        isFresh: true
                    };
                    
                    setStats(freshData);
                    setStatsCardDraftSave({
                        cashBalance: financialSummary.cashBalance,
                        netSales: financialSummary.netSales,
                        bankBalance: financialSummary.bankBalance,
                        totalStock: financialSummary.totalStockValue
                    });
                } else {
                    throw new Error(response.data.error || 'Failed to load dashboard data');
                }
            } catch (error) {
                console.error('Background refresh failed:', error);
                // Only show error if we don't have draft data
                if (!statsCardDraftSave) {
                    setStats(prev => ({
                        ...prev,
                        error: error.response?.data?.error || error.message,
                        isFresh: false
                    }));
                }
            }
        };

        // If we have draft data, show it immediately and fetch fresh in background
        if (statsCardDraftSave) {
            fetchFreshData().catch(e => console.log('Background update failed:', e));
        }
        // If no draft data, fetch fresh data
        else {
            fetchFreshData();
        }

        // Set up auto-refresh every 5 minutes
        const interval = setInterval(fetchFreshData, 300000);
        return () => clearInterval(interval);
    }, [currentCompany, statsCardDraftSave, setStatsCardDraftSave]);

    // Show error only if we have no draft data to fall back to
    if (stats.error && !statsCardDraftSave) {
        return (
            <div className="alert alert-danger">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {stats.error}
                <button
                    className="btn btn-sm btn-outline-danger ms-3"
                    onClick={() => setStats(prev => ({ ...prev, error: null }))}
                >
                    Retry
                </button>
            </div>
        );
    }

    // Determine which data to display (prefer fresh data if available)
    const displayData = stats.isFresh ? stats : statsCardDraftSave || stats;

    return (
        <div className="row">
            {/* Cash Card */}
            <div className="col-lg-3 col-md-6 col-12 mb-4">
                <div className="card border-start border-primary border-4">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 className="text-muted mb-1">Cash Balance</h6>
                                <h3 className="mb-0">
                                    {formatCurrency(displayData.cashBalance)}
                                    <small className="text-muted fs-6"> Rs.</small>
                                </h3>
                            </div>
                            <div className="bg-primary bg-opacity-10 p-3 rounded">
                                <i className="bi bi-cash-coin fs-4 text-primary"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sales Card */}
            <div className="col-lg-3 col-md-6 col-12 mb-4">
                <div className="card border-start border-success border-4">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 className="text-muted mb-1">Net Sales</h6>
                                <h3 className="mb-0">
                                    {formatCurrency(displayData.netSales)}
                                    <small className="text-muted fs-6"> Rs.</small>
                                </h3>
                            </div>
                            <div className="bg-success bg-opacity-10 p-3 rounded">
                                <i className="bi bi-graph-up fs-4 text-success"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bank Card */}
            <div className="col-lg-3 col-md-6 col-12 mb-4">
                <div className="card border-start border-info border-4">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 className="text-muted mb-1">Bank Balance</h6>
                                <h3 className="mb-0">
                                    {formatCurrency(displayData.bankBalance)}
                                    <small className="text-muted fs-6"> Rs.</small>
                                </h3>
                            </div>
                            <div className="bg-info bg-opacity-10 p-3 rounded">
                                <i className="bi bi-bank fs-4 text-info"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inventory Card */}
            <div className="col-lg-3 col-md-6 col-12 mb-4">
                <div className="card border-start border-warning border-4">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 className="text-muted mb-1">Total Inventory</h6>
                                <h3 className="mb-0">
                                    {formatCurrency(displayData.totalStock)}
                                    <small className="text-muted fs-6"> Rs.</small>
                                </h3>
                            </div>
                            <div className="bg-warning bg-opacity-10 p-3 rounded">
                                <i className="bi bi-box-seam fs-4 text-warning"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsCards;