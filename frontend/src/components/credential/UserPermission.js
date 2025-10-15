import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
    FaUser,
    FaEnvelope,
    FaUserTag,
    FaToggleOn,
    FaUserShield,
    FaArrowLeft,
    FaSave,
    FaInfoCircle,
    FaLock,
    FaLockOpen,
    FaChevronDown,
    FaChevronUp
} from 'react-icons/fa';
import NotificationToast from '../NotificationToast';
import Header from '../retailer/Header';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const UserPermission = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [company, setCompany] = useState(null);
    const [fiscalYear, setFiscalYear] = useState(null);
    const [currentCompanyName, setCurrentCompanyName] = useState('');
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [expandedSections, setExpandedSections] = useState({
        dashboard: true,
        items: true,
        accounts: true,
        sales: true,
        salesReturn: true,
        purchase: true,
        purchaseReturn: true,
        inventory: true,
        accountDepartment: true,
        outstanding: true,
        vatSummary: true,
        configuration: true
    });

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        const fetchUserPermissions = async () => {
            try {
                const response = await api.get(`/api/auth/admin/users/user-permissions/${id}`);
                if (response.data.success) {
                    const { user, permissions, company, currentFiscalYear, currentCompanyName } = response.data.data;
                    setUser(user);
                    setPermissions(permissions);
                    setCompany(company);
                    setFiscalYear(currentFiscalYear);
                    setCurrentCompanyName(currentCompanyName);
                } else {
                    setError(response.data.error || 'Failed to load user permissions');
                    if (response.status === 403) {
                        navigate('/dashboard');
                    }
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load user permissions');
                if (err.response?.status === 403) {
                    navigate('/dashboard');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchUserPermissions();
    }, [id]);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const handlePermissionChange = (permissionName) => (e) => {
        setPermissions(prev => ({
            ...prev,
            [permissionName]: e.target.checked
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.put(`/api/auth/admin/users/user-permissions/${id}`, {
                permissions
            });

            if (response.data.success) {
                setNotification({
                    show: true,
                    message: 'Permissions updated successfully',
                    type: 'success'
                });
                setUser(prev => ({
                    ...prev,
                    menuPermissions: new Map(Object.entries(permissions)),
                    lastPermissionUpdate: new Date(),
                    grantedBy: {
                        _id: response.data.data.updatedBy,
                        name: 'You'
                    }
                }));
            } else {
                throw new Error(response.data.error || 'Failed to update permissions');
            }
        } catch (err) {
            setNotification({
                show: true,
                message: err.response?.data?.error || 'Failed to update permissions',
                type: 'danger'
            });
        }
    };

    if (loading) {
        return (
            <div className='container-fluid'>
                <Header />
                <div className="container mt-5">
                    <div className="card mt-4 shadow-lg p-4">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <Skeleton width={200} height={40} />
                            <Skeleton width={150} height={40} />
                        </div>
                        <Skeleton height={80} className="mb-4" />
                        <Skeleton count={5} height={60} className="mb-2" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className='container-fluid'>
                <Header />
                <div className="container mt-4">
                    <div className="alert alert-danger">
                        <div className="d-flex align-items-center">
                            <i className="fas fa-exclamation-circle me-2"></i>
                            <div>{error}</div>
                        </div>
                        <div className="d-flex mt-3">
                            <button
                                className="btn btn-sm btn-outline-danger me-2"
                                onClick={() => window.location.reload()}
                            >
                                Try Again
                            </button>
                            <Link to="/auth/admin/users/list" className="btn btn-sm btn-outline-secondary">
                                <FaArrowLeft className="me-1" /> Back to Users
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isAdminRole = ['Admin', 'ADMINISTRATOR', 'Supervisor'].includes(user.role);

    // Permission categories with all permissions from the template
    const permissionCategories = [
        {
            id: 'dashboard',
            title: 'Dashboard',
            permissions: [
                { id: 'dashboard', label: 'Dashboard Access', description: 'Access to the main dashboard' }
            ]
        },
        {
            id: 'items',
            title: 'Items Management',
            permissions: [
                { id: 'itemsHeader', label: 'Items Menu', description: 'Access to items header menu' },
                { id: 'createItem', label: 'Create Items', description: 'Create new items in the system' },
                { id: 'category', label: 'Category', description: 'Access to item-category module' },
                { id: 'company', label: 'Company', description: 'Access to item-company module' },
                { id: 'unit', label: 'Unit', description: 'Access to item-unit module' },
                { id: 'mainUnit', label: 'Main Unit', description: 'Access to item mainUnit module' },
                { id: 'composition', label: 'Composition', description: 'Access to item composition/generic module' }
            ]
        },
        {
            id: 'accounts',
            title: 'Accounts',
            permissions: [
                { id: 'accountsHeader', label: 'Accounts Menu', description: 'Access to accounts header' },
                { id: 'account', label: 'Account', description: 'Access to account module' },
                { id: 'accountGroup', label: 'Account Group', description: 'Access to account group module' }
            ]
        },
        {
            id: 'sales',
            title: 'Sales',
            permissions: [
                { id: 'salesQuotation', label: 'Sales Quotation', description: 'Access to sales quotation module' },
                { id: 'salesDepartment', label: 'Sales Department', description: 'Access to sales department header' },
                { id: 'creditSales', label: 'Credit Sales', description: 'Access to credit sales module' },
                { id: 'creditSalesModify', label: 'Credit Sales Modify', description: 'Access to credit sales modify' },
                { id: 'cashSales', label: 'Cash Sales', description: 'Access to cash sales module' },
                { id: 'cashSalesModify', label: 'Cash Sales Modify', description: 'Access to cash sales modify' },
                { id: 'salesRegister', label: 'Sales Register', description: 'Access to sales register module' }
            ]
        },
        {
            id: 'salesReturn',
            title: 'Sales Return',
            permissions: [
                { id: 'creditSalesRtn', label: 'Credit Sales Return', description: 'Access to credit sales return module' },
                { id: 'cashSalesRtn', label: 'Cash Sales Return', description: 'Access to cash sales return module' },
                { id: 'salesRtnRegister', label: 'Sales Return Register', description: 'Access to sales return register module' }
            ]
        },
        {
            id: 'purchase',
            title: 'Purchase',
            permissions: [
                { id: 'purchaseDepartment', label: 'Purchase Department', description: 'Access to purchase department header' },
                { id: 'createPurchase', label: 'Purchase Entry', description: 'Access to purchase module' },
                { id: 'purchaseModify', label: 'Purchase Modify', description: 'Access to purchase entry modify' },
                { id: 'purchaseRegister', label: 'Purchase Register', description: 'Access to purchase register module' }
            ]
        },
        {
            id: 'purchaseReturn',
            title: 'Purchase Return',
            permissions: [
                { id: 'createPurchaseRtn', label: 'Purchase Return Entry', description: 'Access to purchase return module' },
                { id: 'purchaseRtnModify', label: 'Purchase Return Modify', description: 'Access to purchase return modify' },
                { id: 'purchaseRtnRegister', label: 'Purchase Return Register', description: 'Access to purchase return register module' }
            ]
        },
        {
            id: 'inventory',
            title: 'Inventory',
            permissions: [
                { id: 'inventoryHeader', label: 'Inventory', description: 'Access to inventory header' },
                { id: 'itemLedger', label: 'Item Ledger', description: 'Access to item ledger' },
                { id: 'createStockAdj', label: 'Stock Adjustment', description: 'Access to stock adjustment module' },
                { id: 'stockAdjRegister', label: 'Stock Adj. Register', description: 'Access to stock adjustment register' },
                { id: 'storeRackSubHeader', label: 'Store/Rack', description: 'Access to store and rack management' },
                { id: 'store', label: 'Store', description: 'Access to store management' },
                { id: 'rack', label: 'Rack', description: 'Access to rack management' },
                { id: 'stockStatus', label: 'Stock Status', description: 'Access to stock details report' },
                { id: 'reorderLevel', label: 'Re-Order level', description: 'Access to re-order level management' },
                { id: 'itemSalesReport', label: 'Item Sales Report', description: 'Access to view item sales report' }
            ]
        },
        {
            id: 'accountDepartment',
            title: 'Account Department',
            permissions: [
                { id: 'accountDepartment', label: 'Account Department', description: 'Access to account department header' },
                { id: 'payment', label: 'Payment', description: 'Access to payment entry module' },
                { id: 'paymentModify', label: 'Payment Modify', description: 'Access to payment entry modify' },
                { id: 'paymentRegister', label: 'Payment Register', description: 'Access to payment register' },
                { id: 'receipt', label: 'Receipt', description: 'Access to receipt entry module' },
                { id: 'receiptModify', label: 'Receipt Modify', description: 'Access to receipt entry modify' },
                { id: 'receiptRegister', label: 'Receipt Register', description: 'Access to receipt register' },
                { id: 'journal', label: 'Journal', description: 'Access to journal entry module' },
                { id: 'journalModify', label: 'Journal Modify', description: 'Access to journal entry modify' },
                { id: 'journalRegister', label: 'Journal Register', description: 'Access to journal register' },
                { id: 'debitNote', label: 'Debit Note', description: 'Access to debit note entry module' },
                { id: 'debitNoteModify', label: 'Debit Note Modify', description: 'Access to debit note modify' },
                { id: 'debitNoteRegister', label: 'Debit Note Register', description: 'Access to debit note register' },
                { id: 'creditNote', label: 'Credit Note', description: 'Access to credit note entry module' },
                { id: 'creditNoteModify', label: 'Credit Note Modify', description: 'Access to credit note modify' },
                { id: 'creditNoteRegister', label: 'Credit Note Register', description: 'Access to credit note register' }
            ]
        },
        {
            id: 'outstanding',
            title: 'Outstanding',
            permissions: [
                { id: 'outstandingHeader', label: 'Outstanding', description: 'Access to outstanding header' },
                { id: 'ageingSubHeader', label: 'Ageing Sub Header', description: 'Access to ageing sub header' },
                { id: 'ageingFIFO', label: 'AgeingFIFO', description: 'Access to ageing reporting (FIFO Basis)' },
                { id: 'ageingDayWise', label: 'Ageing Day Wise', description: 'Access to ageing reporting day wise' },
                { id: 'ageingAllParty', label: 'Ageing All Party', description: 'Access to ageing reporting all party' },
                { id: 'statements', label: 'Statements', description: 'Access to view statement of party' },
                { id: 'reportsSubHeader', label: 'Reports', description: 'Access to reports sub header' },
                { id: 'dailyProfitSaleAnalysis', label: 'Daily Profit/Sale Analysis', description: 'Access to daily profit/sales analytics' },
                { id: 'invoiceWiseProfitLoss', label: 'Invoice-Wise Profit/Loss', description: 'Access to view invoice-wise profit and loss' }
            ]
        },
        {
            id: 'vatSummary',
            title: 'Vat Summary',
            permissions: [
                { id: 'vatSummaryHeader', label: 'Vat Summary', description: 'Access to vat summary header' },
                { id: 'salesVatRegister', label: 'Sales Vat Register', description: 'Access to sales vat report' },
                { id: 'salesRtnVatRegister', label: 'Sales Return Register', description: 'Access to sales return vat report' },
                { id: 'purchaseVatRegister', label: 'Purchase Vat Register', description: 'Access to purchase vat report' },
                { id: 'purchaseRtnVatRegister', label: 'Purchase Return Register', description: 'Access to purchase return vat report' },
                { id: 'monthlyVatSummary', label: 'Monthly Vat Summary', description: 'Access to monthly vat summary report' }
            ]
        },
        {
            id: 'configuration',
            title: 'Configuration',
            permissions: [
                { id: 'configurationHeader', label: 'Configuration', description: 'Access to configuration header' },
                { id: 'voucherConfiguration', label: 'Voucher Configuration', description: 'Access to voucher configuration' },
                { id: 'changeFiscalYear', label: 'Change Fiscal Year', description: 'Access to change or create new fiscal year' },
                { id: 'existingFiscalYear', label: 'Existing Fiscal Year', description: 'Access to view and manage existing fiscal year' },
                { id: 'importExportSubHeader', label: 'Import/Export', description: 'Access to import and export sub header' },
                { id: 'itemsImport', label: 'Items Import', description: 'Access to manage import and export of items' }
            ]
        }
    ];

    return (
        <div className='container-fluid'>
            <Header />
            <div className="container mt-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="mb-0">User Permissions</h2>
                    <Link to="/auth/admin/users/list" className="btn btn-outline-secondary">
                        <FaArrowLeft className="me-2" /> Back to Users
                    </Link>
                </div>

                <div className="card shadow-lg mb-4">
                    <div className="card-header bg-primary text-white">
                        <h4 className="mb-0">User Information</h4>
                    </div>
                    <div className="card-body">
                        <div className="row">
                            <div className="col-md-8">
                                <div className="d-flex align-items-center mb-3">
                                    <div className="user-avatar-lg me-4">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="mb-1">{user.name}</h3>
                                        <div className="d-flex flex-wrap gap-2">
                                            <span className="badge bg-primary">
                                                <FaUserTag className="me-1" /> {user.role}
                                            </span>
                                            <span className="badge bg-secondary">
                                                <FaEnvelope className="me-1" /> {user.email}
                                            </span>
                                            {company && (
                                                <span className="badge bg-info text-dark">
                                                    <FaUserShield className="me-1" /> {currentCompanyName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="card bg-light">
                                    <div className="card-body">
                                        <h6 className="card-title">Last Permission Update</h6>
                                        <p className="card-text">
                                            {user.lastPermissionUpdate ? 
                                                new Date(user.lastPermissionUpdate).toLocaleString() : 
                                                'Never updated'}
                                        </p>
                                        {user.grantedBy && (
                                            <p className="card-text small">
                                                By: {user.grantedBy.name || 'System Admin'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {isAdminRole ? (
                    <div className="alert alert-info d-flex align-items-center">
                        <FaInfoCircle className="me-3 fs-4" />
                        <div>
                            <h5 className="alert-heading">Administrative User Detected</h5>
                            <p className="mb-0">
                                This user has the <strong>{user.role}</strong> role and has full access to all system features.
                                Permissions cannot be modified for users with this role.
                            </p>
                        </div>
                    </div>
                ) : (
                    <form id="permissionForm" onSubmit={handleSubmit}>
                        <div className="card shadow-lg">
                            <div className="card-header bg-primary text-white">
                                <div className="d-flex justify-content-between align-items-center">
                                    <h4 className="mb-0">Menu Access Permissions</h4>
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="selectAllPermissions"
                                            checked={Object.values(permissions).every(val => val)}
                                            onChange={(e) => {
                                                const newPermissions = {};
                                                Object.keys(permissions).forEach(key => {
                                                    newPermissions[key] = e.target.checked;
                                                });
                                                setPermissions(newPermissions);
                                            }}
                                        />
                                        <label className="form-check-label" htmlFor="selectAllPermissions">
                                            Toggle All
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="card-body">
                                {permissionCategories.map(category => (
                                    <div key={category.id} className="mb-4">
                                        <div 
                                            className="d-flex justify-content-between align-items-center category-header p-3 bg-light rounded cursor-pointer"
                                            onClick={() => toggleSection(category.id)}
                                        >
                                            <h5 className="mb-0">
                                                {category.title}
                                            </h5>
                                            {expandedSections[category.id] ? <FaChevronUp /> : <FaChevronDown />}
                                        </div>
                                        
                                        {expandedSections[category.id] && (
                                            <div className="table-responsive mt-3">
                                                <table className="table table-hover">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th width="25%">Permission</th>
                                                            <th width="55%">Description</th>
                                                            <th width="20%" className="text-center">Access</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {category.permissions.map(permission => (
                                                            <tr key={permission.id}>
                                                                <td>
                                                                    <label htmlFor={permission.id} className="form-label mb-0">
                                                                        {permission.label}
                                                                    </label>
                                                                </td>
                                                                <td>{permission.description}</td>
                                                                <td className="text-center">
                                                                    <div className="form-check form-switch d-inline-block">
                                                                        <input
                                                                            className="form-check-input"
                                                                            type="checkbox"
                                                                            id={permission.id}
                                                                            checked={permissions[permission.id] || false}
                                                                            onChange={handlePermissionChange(permission.id)}
                                                                            disabled={permission.id === 'dashboard'}
                                                                        />
                                                                        <label className="form-check-label" htmlFor={permission.id}>
                                                                            {permissions[permission.id] ? (
                                                                                <span className="text-success"><FaLockOpen /></span>
                                                                            ) : (
                                                                                <span className="text-danger"><FaLock /></span>
                                                                            )}
                                                                        </label>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="d-flex justify-content-between mt-4">
                                    <div className="text-muted small">
                                        <FaInfoCircle className="me-1" />
                                        Changes will take effect immediately after saving
                                    </div>
                                    <button type="submit" className="btn btn-primary px-4">
                                        <FaSave className="me-2" /> Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                )}
            </div>

            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />

            <style jsx>{`
                .user-avatar-lg {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background-color: #0d6efd;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    font-weight: bold;
                }
                
                .category-header {
                    transition: all 0.3s ease;
                }
                
                .category-header:hover {
                    background-color: #e9ecef !important;
                }
                
                .cursor-pointer {
                    cursor: pointer;
                }
                
                .form-check-input {
                    width: 3em;
                    height: 1.5em;
                }
                
                table.table-hover tbody tr:hover {
                    background-color: rgba(13, 110, 253, 0.05);
                }

                /* Additional styles from the template */
                .permission-container {
                    max-width: 1000px;
                    margin: 2rem auto;
                    padding: 0 15px;
                }

                .permission-card {
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                    border: none;
                }

                .user-header {
                    display: flex;
                    align-items: center;
                    padding: 1.5rem;
                    border-bottom: 1px solid #eee;
                }

                .user-avatar {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background-color: #0d6efd;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    font-weight: bold;
                    margin-right: 1.5rem;
                }

                .user-info h3 {
                    margin-bottom: 0.25rem;
                }

                .user-info p {
                    margin-bottom: 0;
                    color: #6c757d;
                }

                .permission-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .permission-table th {
                    background-color: #f8f9fa;
                    padding: 1rem;
                    text-align: left;
                    border-bottom: 2px solid #dee2e6;
                }

                .permission-table td {
                    padding: 1rem;
                    border-bottom: 1px solid #dee2e6;
                    vertical-align: middle;
                }

                .permission-name {
                    font-weight: 500;
                }

                .form-check-input {
                    width: 1.5em;
                    height: 1.5em;
                }

                .form-switch .form-check-input {
                    width: 2.5em;
                    margin-left: 0;
                }

                .save-btn {
                    min-width: 150px;
                }

                .note-text {
                    font-size: 0.875rem;
                    color: #6c757d;
                    margin-top: 1rem;
                }

                @media (max-width: 768px) {
                    .user-header {
                        flex-direction: column;
                        text-align: center;
                    }

                    .user-avatar {
                        margin-right: 0;
                        margin-bottom: 1rem;
                    }

                    .permission-table th,
                    .permission-table td {
                        padding: 0.75rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default UserPermission;