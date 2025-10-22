import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';
import { BiSun, BiMoon } from 'react-icons/bi';
import '../../stylesheet/retailer/Header.css';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import Footer from './Footer';
import { usePageNotRefreshContext } from './PageNotRefreshContext';
import AccountsModal from './accounts/AccountModal';

const Header = () => {
  const { logout, currentUser } = useAuth();
  const { headerDraftSave, setHeaderDraftSave, clearHeaderDraft } = usePageNotRefreshContext();
  const [showAccountsModal, setShowAccountsModal] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!headerDraftSave);
  const [user, setUser] = useState(headerDraftSave?.user || null);
  const [companyData, setCompanyData] = useState(headerDraftSave?.companyData || {
    name: '',
    renewalDate: null
  });
  const [fiscalYear, setFiscalYear] = useState(headerDraftSave?.fiscalYear || null);
  const [isFresh, setIsFresh] = useState(false);
  const [error, setError] = useState('');


  const fetchFreshData = async () => {
    try {
      const [userRes, companyRes] = await Promise.all([
        axios.get('/api/auth/me'),
        axios.get('/api/my-company'),
      ]);

      const userData = userRes.data.user;
      const newCompanyData = {
        name: companyRes.data.currentCompanyName,
        renewalDate: companyRes.data.company?.renewalDate,
      };
      const newFiscalYear = companyRes.data.currentFiscalYear;

      // Update state with fresh data
      setUser(userData);
      setCompanyData(newCompanyData);
      setFiscalYear(newFiscalYear);
      setIsFresh(true);
      setLoading(false);

      // Save to draft
      setHeaderDraftSave({
        user: userData,
        companyData: newCompanyData,
        fiscalYear: newFiscalYear
      });
    } catch (err) {
      console.error('Background refresh failed:', err);
      if (!headerDraftSave) {
        setError(err.response?.data?.message || 'Failed to fetch data');
        setLoading(false);
      }
    }
  };
  useEffect(() => {
    if (!currentUser) return;

    // If we have draft data, show it immediately and fetch fresh in background
    if (headerDraftSave) {
      fetchFreshData().catch(e => console.log('Background update failed:', e));
    }
    // If no draft data, fetch fresh data (will show loading state)
    else {
      fetchFreshData();
    }

    // Set up auto-refresh every 5 minutes
    const interval = setInterval(fetchFreshData, 300000);
    return () => clearInterval(interval);
  }, [currentUser, headerDraftSave, setHeaderDraftSave]);

  // Determine which data to display (prefer fresh data if available)
  const displayUser = isFresh ? user : headerDraftSave?.user || user;
  const displayCompanyData = isFresh ? companyData : headerDraftSave?.companyData || companyData;
  const displayFiscalYear = isFresh ? fiscalYear : headerDraftSave?.fiscalYear || fiscalYear;

  useEffect(() => {
    if (!headerDraftSave) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const userRes = await axios.get('/api/auth/me');
          const userData = userRes.data.user;
          setUser(userData);

          const [companyRes] = await Promise.all([
            axios.get('/api/my-company'),
          ]);
          const newCompanyData = {
            name: companyRes.data.currentCompanyName,
            renewalDate: companyRes.data.company?.renewalDate,
          };
          setCompanyData(newCompanyData);
          setFiscalYear(companyRes.data.currentFiscalYear);

          setHeaderDraftSave({
            user: userData,
            companyData: newCompanyData,
            fiscalYear: companyRes.data.currentFiscalYear
          });
          setLoading(false);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to fetch data');
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [headerDraftSave, setHeaderDraftSave]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Close mobile menu when route changes
  useEffect(() => {
    const unlisten = navigate.listen?.(() => setMobileMenuOpen(false));
    return () => unlisten?.();
  }, [navigate]);

  // const toggleTheme = () => {
  //   const newTheme = theme === 'light' ? 'dark' : 'light';
  //   setTheme(newTheme);
  //   document.documentElement.setAttribute('data-theme', newTheme);
  // };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const isAdminOrSupervisor = currentUser?.isAdmin || currentUser?.role === 'Supervisor' || user?.role === 'ADMINISTRATOR' || user?.role === 'Admin';

  if (loading && !headerDraftSave) {
    return (
      <div className="header-container">
        <div className="header">
          <div className="header-row container-fluid" role="navigation">
            <div className="header-right">
              <div className="placeholder-glow">
                <div style={{ height: '60px', width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (error && !headerDraftSave) {
    return (
      <div className="header-container">
        <div className="header">
          <div className="header-row container-fluid" role="navigation">
            <div className="header-right">
              <div className="alert alert-danger m-2">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
                <button
                  className="btn btn-sm btn-outline-danger ms-3"
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    setHeaderDraftSave(null); // Clear draft to force fresh fetch
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mainMenuContent = (
    <ul className="main-menu">
      <li className="menu-item">
        <Link to="/retailerDashboard/indexv1" className="active" id="home">
          Home
        </Link>
      </li>
      {/* Accounts Menu */}
      {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
        user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
        user?.menuPermissions?.get('AccountsHeader')) && (
          <li className="menu-item dropdown">
            <Link to="#" className="active">
              Accounts
            </Link>
            <div className="sub-menu-wrapper slideInUp">
              <ul className="sub-menu">
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                  user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('Account')) && (
                    <li className="menu-item">
                      <Link to="/retailer/accounts">Account</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('AccountGroup')) && (
                    <li className="menu-item">
                      <Link to="/retailer/account-group">Account Group</Link>
                    </li>
                  )}
              </ul>
            </div>
          </li>
        )}

      {/* Accounts Menu */}
      {/* {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
        user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
        user?.menuPermissions?.get('AccountsHeader')) && (
          <li className="menu-item dropdown">
            <Link to="#" className="active">
              Accounts
            </Link>
            <div className="sub-menu-wrapper slideInUp">
              <ul className="sub-menu">
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                  user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('Account')) && (
                    <li className="menu-item">
                      <Link
                        to="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowAccountsModal(true);
                        }}
                      >
                        Account
                      </Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('AccountGroup')) && (
                    <li className="menu-item">
                      <Link to="/retailer/account-group">Account Group</Link>
                    </li>
                  )}
              </ul>
            </div>
          </li>
        )} */}

      {/* Items Menu */}
      {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
        user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
        user?.menuPermissions?.get('itemsHeader')) && (
          <li className="menu-item dropdown">
            <Link to="#" className="active">
              Items
            </Link>
            <div className="sub-menu-wrapper slideInUp">
              <ul className="sub-menu">
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                  user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('createItem')) && (
                    <li className="menu-item">
                      <Link to="/retailer/items">Item</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                  user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('category')) && (
                    <li className="menu-item">
                      <Link to="/retailer/categories">Category</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                  user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('company')) && (
                    <li className="menu-item">
                      <Link to="/retailer/items-company">Company</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                  user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('unit')) && (
                    <li className="menu-item">
                      <Link to="/retailer/units">Unit</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                  user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('mainUnit')) && (
                    <li className="menu-item">
                      <Link to="/retailer/mainUnits">Main Unit</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                  user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('composition')) && (
                    <li className="menu-item">
                      <Link to="/retailer/compositions">Composition</Link>
                    </li>
                  )}
              </ul>
            </div>
          </li>
        )}

      {/* Sales Department Menu */}
      {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
        user?.menuPermissions?.get('salesDepartment')) && (
          <li className="menu-item dropdown">
            <Link to="#" className="active">
              Sales Department
            </Link>
            <div className="sub-menu-wrapper slideInUp">
              <ul className="sub-menu">
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                  user?.menuPermissions?.get('salesQuotation')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Sales Quotation</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/sales-quotation">Add</Link>
                        </li>
                        <li className="menu-item">
                          <Link to="/retailer/sales-quotation/finds">Edit</Link>
                        </li>
                        <li className="menu-item">
                          <Link to="/retailer/sales-quotation/register">List</Link>
                        </li>
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                  user?.menuPermissions?.get('creditSales')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Credit Sales</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/credit-sales">Add Sales</Link>
                        </li>
                        <li className="menu-item">
                          <Link to="/retailer/credit-sales/open">Add Sales Open</Link>
                        </li>
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                          user?.menuPermissions?.get('creditSalesModify')) && (
                            <li className="menu-item">
                              <Link to="/retailer/credit-sales/finds">Edit Sales</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                  user?.menuPermissions?.get('cashSales')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Cash Sales</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/cash-sales">Add Sales</Link>
                        </li>
                        <li className="menu-item">
                          <Link to="/retailer/cash-sales/open">Add Sales Open</Link>
                        </li>
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                          user?.menuPermissions?.get('cashSalesModify')) && (
                            <li className="menu-item">
                              <Link to="/retailer/cash-sales/finds">Edit Sales</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                  user?.menuPermissions?.get('salesRegister')) && (
                    <li className="menu-item">
                      <Link to="/retailer/sales-register">Sales Register</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                  user?.menuPermissions?.get('creditSalesRtn')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Credit Sales Rtn</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/sales-return">Add</Link>
                        </li>
                        <li className="menu-item">
                          <Link to="/sales-return/finds">Edit</Link>
                        </li>
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                  user?.menuPermissions?.get('cashSalesRtn')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Cash Sales Rtn</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/cash/sales-return">Add</Link>
                        </li>
                        <li className="menu-item">
                          <Link to="/cash-sales-return/sales-return/finds">Edit</Link>
                        </li>
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                  user?.menuPermissions?.get('salesRtnRegister')) && (
                    <li className="menu-item">
                      <Link to="/retailer/sales-return/register">Sales Rtn Register</Link>
                    </li>
                  )}
              </ul>
            </div>
          </li>
        )}

      {/* Purchase Department Menu */}
      {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
        user?.role === 'Account' || user?.isAdmin ||
        user?.menuPermissions?.get('purchaseDepartment')) && (
          <li className="menu-item dropdown">
            <Link to="#" className="active">
              Purchase Department
            </Link>
            <div className="sub-menu-wrapper slideInUp">
              <ul className="sub-menu">
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                  user?.role === 'Account' || user?.isAdmin ||
                  user?.menuPermissions?.get('createPurchase')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Purchase</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/purchase">Add</Link>
                        </li>
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                          user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('purchaseModify')) && (
                            <li className="menu-item">
                              <Link to="/retailer/purchase/finds">Edit</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                          user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('purchaseRegister')) && (
                            <li className="menu-item">
                              <Link to="/retailer/purchase-register">Purchase Register</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                  user?.isAdmin || user?.menuPermissions?.get('createPurchaseRtn')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Purchase Return</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/purchase-return">Add</Link>
                        </li>
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                          user?.isAdmin || user?.menuPermissions?.get('purchaseRtnModify')) && (
                            <li className="menu-item">
                              <Link to="/retailer/purchase-return/finds">Edit</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                          user?.isAdmin || user?.menuPermissions?.get('purchaseRtnRegister')) && (
                            <li className="menu-item">
                              <Link to="/retailer/purchase-return/register">Purchase Rtn Register</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
              </ul>
            </div>
          </li>
        )}

      {/* Inventory Menu */}
      {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase'
        || user?.role === 'Sales' || user?.role === 'Account' ||
        user?.isAdmin || user?.menuPermissions?.get('inventoryHeader')) && (
          <li className="menu-item dropdown">
            <Link to="#" className="active">
              Inventory
            </Link>
            <div className="sub-menu-wrapper slideInUp">
              <ul className="sub-menu">
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase'
                  || user?.role === 'Sales' || user?.role === 'Account' ||
                  user?.isAdmin || user?.menuPermissions?.get('itemLedger')) && (
                    <li className="menu-item">
                      <Link to="/retailer/items-ledger">Item Ledger</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('createStockAdj')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Stock Adjustment</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/stockAdjustments/new">Add</Link>
                        </li>
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('stockAdjRegister')) && (
                            <li className="menu-item">
                              <Link to="/retailer/stockAdjustments/register">Stock Adj. Register</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('storeRackSubHeader')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Store/Rack</Link>
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('store')) && (
                            <li className="menu-item">
                              <Link to="/retailer/store/management">Store</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('rack')) && (
                            <li className="menu-item">
                              <Link to="/retailer/rack/management">Rack</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('stockStatus')) && (
                    <li className="menu-item">
                      <Link to="/retailer/stock-status">Stock Status</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                  user?.isAdmin || user?.menuPermissions?.get('reorderLevel')) && (
                    <li className="menu-item">
                      <Link to="/retailer/items/reorder">Re Order Level</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                  user?.isAdmin || user?.menuPermissions?.get('itemSalesReport')) && (
                    <li className="menu-item">
                      <Link to="/sold-items">Item Sales Report</Link>
                    </li>
                  )}
              </ul>
            </div>
          </li>
        )}

      {/* Account Department Menu */}
      {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' || user?.role === 'Account' ||
        user?.isAdmin || user?.menuPermissions?.get('accountDepartment')) && (
          <li className="menu-item dropdown">
            <Link to="#" className="active">
              Account Department
            </Link>
            <div className="sub-menu-wrapper slideInUp">
              <ul className="sub-menu">
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' || user?.role === 'Account' ||
                  user?.isAdmin || user?.menuPermissions?.get('payment')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Payment</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/payments">Add</Link>
                        </li>
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('paymentModify')) && (
                            <li className="menu-item">
                              <Link to="/retailer/payments/finds">Edit</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('paymentRegister')) && (
                            <li className="menu-item">
                              <Link to="/retailer/payments/register">List</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                  user?.isAdmin || user?.menuPermissions?.get('receipt')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Receipt</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/receipts">Add</Link>
                        </li>
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('receiptModify')) && (
                            <li className="menu-item">
                              <Link to="/retailer/receipts/finds">Edit</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('receiptRegister')) && (
                            <li className="menu-item">
                              <Link to="/retailer/receipts/register">List</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                  user?.isAdmin || user?.menuPermissions?.get('journal')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Journal</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/journal">Add</Link>
                        </li>
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('journalModify')) && (
                            <li className="menu-item">
                              <Link to="/retailer/journal/finds">Edit</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('journalRegister')) && (
                            <li className="menu-item">
                              <Link to="/retailer/journal/register">List</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                  user?.isAdmin || user?.menuPermissions?.get('debitNote')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Debit Note</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/retailer/debit-note">Add</Link>
                        </li>
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('debitNoteModify')) && (
                            <li className="menu-item">
                              <Link to="/retailer/debit-note/finds">Edit</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('debitNoteRegister')) && (
                            <li className="menu-item">
                              <Link to="/retailer/debit-note/register">List</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                  user?.isAdmin || user?.menuPermissions?.get('creditNote')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Credit Note</Link>
                      <ul className="sub-menu">
                        <li className="menu-item">
                          <Link to="/credit-note/new">Add</Link>
                        </li>
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('creditNoteModify')) && (
                            <li className="menu-item">
                              <Link to="/creditnote/finds">Edit</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('creditNoteRegister')) && (
                            <li className="menu-item">
                              <Link to="/credit-note/list">List</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
              </ul>
            </div>
          </li>
        )}

      {/* Outstanding Menu */}
      {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
        user?.isAdmin || user?.menuPermissions?.get('outstandingHeader')) && (
          <li className="menu-item dropdown">
            <Link to="#" className="active">
              Outstanding
            </Link>
            <div className="sub-menu-wrapper slideInUp">
              <ul className="sub-menu">
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                  user?.isAdmin || user?.menuPermissions?.get('ageingSubHeader')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Ageing</Link>
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('ageingAllParty')) && (
                            <li className="menu-item">
                              <Link to="/retailer/ageing-report/all-accounts">All Party</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('ageingDayWise')) && (
                            <li className="menu-item">
                              <Link to="/retailer/day-count-aging">Day Wise</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                  user?.isAdmin || user?.menuPermissions?.get('statements')) && (
                    <li className="menu-item">
                      <Link to="/retailer/statement">Statements</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                  user?.isAdmin || user?.menuPermissions?.get('reportsSubHeader')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Reports</Link>
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('dailyProfitSaleAnalysis')) && (
                            <li className="menu-item">
                              <Link to="/retailer/daily-profit/sales-analysis">Daily Profit/Sale Analysis</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('invoiceWiseProfitLoss')) && (
                            <li className="menu-item">
                              <Link to="/retailer/invoicewise/profitloss">Invoice Wise Profit & Loss</Link>
                            </li>
                          )}
                      </ul>
                    </li>
                  )}
              </ul>
            </div>
          </li>
        )}

      {/* Vat Summary Menu */}
      {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
        user?.isAdmin || user?.menuPermissions?.get('vatSummaryHeader')) && (
          <li className="menu-item dropdown">
            <Link to="#" className="active">
              Vat Summary
            </Link>
            <div className="sub-menu-wrapper slideInUp">
              <ul className="sub-menu">
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('salesVatRegister')) && (
                    <li className="menu-item">
                      <Link to="/retailer/sales-vat-report">Sales Vat Register</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('salesRtnVatRegister')) && (
                    <li className="menu-item">
                      <Link to="/retailer/salesReturn-vat-report">Sales Return Register</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('purchaseVatRegister')) && (
                    <li className="menu-item">
                      <Link to="/retailer/purchase-vat-report">Purchase Vat Register</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('purchaseRtnVatRegister')) && (
                    <li className="menu-item">
                      <Link to="/retailer/purchaseReturn-vat-report">Purchase Return Register</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('monthlyVatSummary')) && (
                    <li className="menu-item">
                      <Link to="/retailer/monthly-vat-summary">Monthly Vat Summary</Link>
                    </li>
                  )}
              </ul>
            </div>
          </li>
        )}

      {/* Configuration Menu */}
      {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
        user?.isAdmin || user?.menuPermissions?.get('configurationHeader')) && (
          <li className="menu-item dropdown">
            <Link to="#" className="active">
              Configuration
            </Link>
            <div className="sub-menu-wrapper slideInUp">
              <ul className="sub-menu">
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('voucherConfiguration')) && (
                    <li className="menu-item">
                      <Link to="/retailer/voucherConfiguration">Voucher Configuration</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('changeFiscalYear')) && (
                    <li className="menu-item">
                      <Link to="/change-fiscal-year">Change Fiscal Year</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('existingFiscalYear')) && (
                    <li className="menu-item">
                      <Link to="/list-of-existing/fiscalYears">Existing Fiscal Year</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('existingFiscalYear')) && (
                    <li className="menu-item">
                      <Link to="/backups">Backups</Link>
                    </li>
                  )}
                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                  user?.isAdmin || user?.menuPermissions?.get('importExportSubHeader')) && (
                    <li className="menu-item dropdown">
                      <Link to="#">Import</Link>
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('itemsImport')) && (
                            <>
                              <li className="menu-item">
                                <Link to="/items-import">Items Import</Link>
                              </li>
                              <li className="menu-item">
                                <Link to="/accounts-import">Accounts Import</Link>
                              </li>
                            </>
                          )}
                      </ul>
                    </li>
                  )}
              </ul>
            </div>
          </li>
        )}

      {/* User Profile Menu */}
      <li className="menu-item dropdown">
        <Link to="#" className="active">
          <i className="bi bi-person" style={{ fontSize: '20px' }}></i>
        </Link>
        <div className="sub-menu-wrapper slideInUp">
          <ul className="sub-menu">
            {isAdminOrSupervisor ? (
              <li className="menu-item">
                <Link to={`/auth/admin/users/view/${user?._id}`}>{user?.name}</Link>
              </li>
            ) : (
              <li className="menu-item">
                <Link to={`/auth/account/users/view/${user?._id}`}>{user?.name}</Link>
              </li>
            )}
            <li className="menu-item">
              <Link to="/auth/user/change-password">Change Password</Link>
            </li>
            {isAdminOrSupervisor && (
              <>
                <li className="menu-item">
                  <Link to="/auth/admin/users/list">Users</Link>
                </li>
              </>
            )}
            <li className="menu-item">
              <Link to="/dashboard">My Company</Link>
            </li>
            <li className="menu-item">
              <button
                onClick={logout}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
              >
                Logout
              </button>
            </li>
          </ul>
        </div>
      </li>
      {/* Theme Toggle */}
      {/* <li className="menu-item theme-toggle-container">
        <div className="theme-toggle">
          <button
            id="theme-switcher"
            className="btn btn-sm btn-outline-secondary"
            onClick={toggleTheme}
          >
            {theme === 'light' ? <BiMoon /> : <BiSun />}
          </button>
        </div>
      </li> */}
    </ul>
  );

  return (
    <div className='header-container'>
      <Footer
        currentCompanyName={displayCompanyData.name}
        user={displayUser}
        currentFiscalYear={displayFiscalYear}
        company={displayCompanyData}
      />
      <header className="header">
        <div className="header-row container-fluid" role="navigation">
          <div className="header-right">
            {/* Desktop Menu */}
            <nav className="desktop-menu">
              {mainMenuContent}
            </nav>
            {/* Mobile Menu Toggle */}
            {/* Three dots (hamburger) */}
            {!mobileMenuOpen && (
              <button
                id="three-dots"
                className="mobile-toggler"
                onClick={toggleMobileMenu}
                aria-label="Open menu"
              >
                <FaBars />
              </button>
            )}
            {/* Cross (close) icon at the same place */}
            {mobileMenuOpen && (
              <button
                id="mobile-close"
                className="mobile-toggler"
                onClick={toggleMobileMenu}
                aria-label="Close menu"
                style={{
                  position: 'absolute',
                  top: 8, // match your .mobile-toggler margin
                  right: 15,
                  zIndex: 2003
                }}
              >
                <FaTimes />
              </button>
            )}

            {/* Accounts Modal */}
            <AccountsModal
              show={showAccountsModal}
              onClose={() => setShowAccountsModal(false)}
              onAccountCreated={(accountData) => {
                // Handle account creation if needed
                console.log('Account created:', accountData);
              }}
            />


            {/* Mobile Menu */}
            <nav className={`mobile-menu${mobileMenuOpen ? ' open' : ''}`}>
              {mainMenuContent}
            </nav>
          </div>
        </div>
      </header>
    </div>
  );
};

export default Header;