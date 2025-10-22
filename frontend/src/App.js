import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React, { useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingProvider, useLoading } from './context/LoadingContext';
import { setupInterceptors } from './components/services/api';
import Loader from './components/Loader';
import Header from './components/retailer/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Unauthorized from './components/retailer/Unauthorized';
import WelcomePage from './components/welcome';
import LoginForm from './components/credential/Login';
import Dashboard from './components/company/Dashboard';
import RegisterForm from './components/credential/Registration';
import VerifyEmail from './components/credential/VerifyEmail';
import ResendVerification from './components/credential/ResendVerification';
import ForgotPassword from './components/credential/ForgotPassword';
import ResetPassword from './components/credential/ResetPassword';
import CompanyForm from './components/company/CompanyForm';
import CompanyDetails from './components/company/CompanyDetails';
import EditCompanyForm from './components/company/EditCompanyForm';
import DashboardV1 from './components/retailer/dashboard/dashboardV1';
import Categories from './components/retailer/Category';
import ItemsCompany from './components/retailer/itemsCompany';
import Units from './components/retailer/Unit';
import MainUnits from './components/retailer/MainUnit';
import Compositions from './components/retailer/Composition';
import Accounts from './components/retailer/accounts/Account';
import AccountGroups from './components/retailer/accounts/AccountGroup';
import AccountDetails from './components/retailer/ViewAccount';
import AddPurchase from './components/retailer/purchase/AddPurchase';
import PurchaseBillsList from './components/retailer/purchase/List';
import EditPurchase from './components/retailer/purchase/EditPurchase';
import { PageNotRefreshProvider } from './components/retailer/PageNotRefreshContext';
import FindPurchase from './components/retailer/purchase/FindPurchase';
import AddSales from './components/retailer/sales/AddSales';
import AddSalesOpen from './components/retailer/sales/AddSalesOpen';
import SalesBillsList from './components/retailer/sales/List';
import PurchaseBillPrint from './components/retailer/purchase/Print';
import SalesBillPrint from './components/retailer/sales/Print';
import AddCashSales from './components/retailer/sales/AddCashSales';
import AddCashSalesOpen from './components/retailer/sales/AddCashSalesOpen';
import AddPurcRtn from './components/retailer/purchaseReturn/AddPurcRtn';
import PurchaseReturnList from './components/retailer/purchaseReturn/List';
import PurchaseReturnPrint from './components/retailer/purchaseReturn/Print';
import AddSalesReturn from './components/retailer/salesReturn/AddSalesReturn';
import SalesReturnList from './components/retailer/salesReturn/List';
import AddCashSalesReturn from './components/retailer/salesReturn/AddCashSalesReturn';
import SalesReturnPrint from './components/retailer/salesReturn/Print';
import SalesVatReport from './components/retailer/sales/SalesVatReport';
import PurchaseVatReport from './components/retailer/purchase/PurchaseVatReport';
import SalesReturnVatReport from './components/retailer/salesReturn/SalesReturnVatRreport';
import PurchaseReturnVatReport from './components/retailer/purchaseReturn/PurchaseReturnVatReport';
import MonthlyVatSummary from './components/retailer/miscellaneous/MonthlyVatSummary';
import AddPayment from './components/retailer/payment/AddPayment';
import PaymentsList from './components/retailer/payment/List';
import PaymentVoucherPrint from './components/retailer/payment/Print';
import EditPayment from './components/retailer/payment/EditPayment';
import VoucherNumberForm from './components/retailer/payment/VoucherNumber';
import AddReceipt from './components/retailer/receipt/AddReceipt';
import ReceiptsList from './components/retailer/receipt/List';
import ReceiptVoucherPrint from './components/retailer/receipt/Print';
import EditReceipt from './components/retailer/receipt/EditReceipt';
import ReceiptVoucherForm from './components/retailer/receipt/VoucherNumber';
import ChangePassword from './components/credential/ChangePassword';
import UserList from './components/credential/UserList';
import CreateUser from './components/credential/CreateUser';
import UserDetail from './components/credential/UserDetail';
import UserPermission from './components/credential/UserPermission';
import ViewAdmin from './components/credential/ViewAdmin';
import Items from './components/retailer/Items/Items';
import ViewItems from './components/retailer/Items/ViewItems';
import AddStockAdjustment from './components/retailer/stockAdjustment/AddStockAdjustment';
import StockAdjustmentsList from './components/retailer/stockAdjustment/List';
import ItemsLedger from './components/retailer/miscellaneous/ItemsLedger';
import StockStatus from './components/retailer/miscellaneous/StockStatus';
import ItemsReOrderLevel from './components/retailer/miscellaneous/ItemsReOrder';
import Statement from './components/retailer/miscellaneous/Statement';
import AddSalesQuotation from './components/retailer/salesQuotation.js/AddSalesQuotation';
import SalesQuotationList from './components/retailer/salesQuotation.js/List';
import SalesQuotationPrint from './components/retailer/salesQuotation.js/Print';
import EditSalesQuotation from './components/retailer/salesQuotation.js/EditSalesQuotation';
import SalesQuotationVoucherNumber from './components/retailer/salesQuotation.js/VoucherNumber';
import PurchaseVoucherNumber from './components/retailer/purchase/VoucherNumber';
import EditCreditSales from './components/retailer/sales/EditCreditSales';
import CreditSalesVoucherNumber from './components/retailer/sales/CreditVoucherNumber';
import EditCashSales from './components/retailer/sales/EditCashSales';
import CashSalesVoucherNumber from './components/retailer/sales/CashVoucherNumber';
import AgeingReportAllAccounts from './components/retailer/ageingReport/AgeingAllAccounts';
import BackgroundWrapper from './components/BackgroundWrapper';
import AddJournalVoucher from './components/retailer/journal/AddJournal';
import JournalList from './components/retailer/journal/List';
import JournalVoucherPrint from './components/retailer/journal/Print';
import EditJournalVoucher from './components/retailer/journal/EditJournal';
import JournalVoucherNumberForm from './components/retailer/journal/VoucherNumber';
import VoucherConfiguration from './components/retailer/settings/VoucherConfiguration';
import EditPurcRtn from './components/retailer/purchaseReturn/EditPurcRtn';
import NetworkStatus from './components/NetworkStatus';
import PurchaseReturnVoucherNumber from './components/retailer/purchaseReturn/VoucherNumber';
import InvoiceWiseProfitLossReport from './components/retailer/InvoiceProfitLossReport';
import DailyProfit from './components/retailer/dailyProfitAnalysis/DailyProfit';
import DailyProfitResult from './components/retailer/dailyProfitAnalysis/DailyProfitResult';
import AddDebitNote from './components/retailer/debitNote/AddDebitNote';
import DebitNoteRegister from './components/retailer/debitNote/List';
import ExistingFiscalYears from './components/fiscalYear/ExistingFiscalYears';
import ChangeNewFiscalYear from './components/fiscalYear/ChangeNewFiscalYear';
import SplitCompany from './components/company/SplitCompany';
import DayWiseAgeing from './components/retailer/ageingReport/DayWiseAgeing';
import BackupPages from './components/backups/BackupPages';
import DebitNotePrint from './components/retailer/debitNote/Print';
import EditDebitNote from './components/retailer/debitNote/EditDebitNote';
import DebitNoteNumberForm from './components/retailer/debitNote/VoucherNumber';

function AppContent() {
  const { currentUser } = useAuth();
  const { showLoading, hideLoading } = useLoading();

  useEffect(() => {
    setupInterceptors(showLoading, hideLoading);
  }, [showLoading, hideLoading]);

  return (

    <Router>
      <NetworkStatus pingUrl="/api/ping" pingInterval={10000} />
      <BackgroundWrapper>
        <PageNotRefreshProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<WelcomePage />} />
            <Route path="/auth/register" element={<RegisterForm />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />
            <Route path="/auth/verify-email" element={<ResendVerification />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route
              path="/auth/login"
              element={!currentUser ? <LoginForm /> : <Navigate to="/dashboard" replace />}
            />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/company/new" element={
              <ProtectedRoute>
                <CompanyForm user={!currentUser} />
              </ProtectedRoute>
            }
            />
            <Route path="/company/:id" element={
              <ProtectedRoute>
                <CompanyDetails user={!currentUser} />
              </ProtectedRoute>
            }
            />
            <Route path="/company/edit/:id" element={
              <ProtectedRoute>
                <EditCompanyForm user={!currentUser} />
              </ProtectedRoute>
            }
            />
            <Route path="/split/company" element={
              <ProtectedRoute>
                <SplitCompany user={!currentUser} />
              </ProtectedRoute>
            }
            />

            {/**dashboardV1 */}
            <Route path="/retailerDashboard/indexv1" element={
              <ProtectedRoute>
                <DashboardV1 user={!currentUser} />
              </ProtectedRoute>
            }
            />

            {/**Items */}
            <Route
              path="/retailer/items"
              element={
                <ProtectedRoute>
                  <Items />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/items/:id"
              element={
                <ProtectedRoute>
                  <ViewItems />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/items-ledger"
              element={
                <ProtectedRoute>
                  <ItemsLedger />
                </ProtectedRoute>
              }
            />

            <Route
              path="/retailer/categories"
              element={
                <ProtectedRoute>
                  <Categories />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/items-company"
              element={
                <ProtectedRoute>
                  <ItemsCompany />
                </ProtectedRoute>
              }
            />

            <Route
              path="/retailer/units"
              element={
                <ProtectedRoute>
                  <Units />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/mainUnits"
              element={
                <ProtectedRoute>
                  <MainUnits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/compositions"
              element={
                <ProtectedRoute>
                  <Compositions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/accounts"
              element={
                <ProtectedRoute>
                  <Accounts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/companies/:id"
              element={
                <ProtectedRoute>
                  <AccountDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/account-group"
              element={
                <ProtectedRoute>
                  <AccountGroups />
                </ProtectedRoute>
              }
            />

            {/**Purchase */}
            <Route
              path="/retailer/purchase"
              element={
                <ProtectedRoute>
                  <AddPurchase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/purchase/edit/:id"
              element={
                <ProtectedRoute>
                  <EditPurchase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/purchase-register"
              element={
                <ProtectedRoute>
                  <PurchaseBillsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/purchase/:id/print"
              element={
                <ProtectedRoute>
                  <PurchaseBillPrint />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/purchase-vat-report"
              element={
                <ProtectedRoute>
                  <PurchaseVatReport />
                </ProtectedRoute>
              }
            />

            <Route
              path="/retailer/purchase/finds"
              element={
                <ProtectedRoute>
                  <PurchaseVoucherNumber />
                </ProtectedRoute>
              }
            />

            {/**Sales */}
            <Route
              path="/retailer/credit-sales"
              element={
                <ProtectedRoute>
                  <AddSales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/credit-sales/open"
              element={
                <ProtectedRoute>
                  <AddSalesOpen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/sales-register"
              element={
                <ProtectedRoute>
                  <SalesBillsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/cash-sales"
              element={
                <ProtectedRoute>
                  <AddCashSales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/cash-sales/open"
              element={
                <ProtectedRoute>
                  <AddCashSalesOpen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/credit-sales/finds"
              element={
                <ProtectedRoute>
                  <CreditSalesVoucherNumber />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/cash-sales/finds"
              element={
                <ProtectedRoute>
                  <CashSalesVoucherNumber />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/credit-sales/edit/:id"
              element={
                <ProtectedRoute>
                  <EditCreditSales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/cash-sales/edit/:id"
              element={
                <ProtectedRoute>
                  <EditCashSales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/sales-vat-report"
              element={
                <ProtectedRoute>
                  <SalesVatReport />
                </ProtectedRoute>
              }
            />

            <Route
              path="/retailer/sales/:id/print"
              element={
                <ProtectedRoute>
                  <SalesBillPrint />
                </ProtectedRoute>
              }
            />
            {/**Purchase Return */}
            <Route
              path="/retailer/purchase-return"
              element={
                <ProtectedRoute>
                  <AddPurcRtn />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/purchase-return/finds"
              element={
                <ProtectedRoute>
                  <PurchaseReturnVoucherNumber />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/purchase-return/edit/:id"
              element={
                <ProtectedRoute>
                  <EditPurcRtn />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/purchase-return/register"
              element={
                <ProtectedRoute>
                  <PurchaseReturnList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/purchase-return/:id/print"
              element={
                <ProtectedRoute>
                  <PurchaseReturnPrint />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/purchaseReturn-vat-report"
              element={
                <ProtectedRoute>
                  <PurchaseReturnVatReport />
                </ProtectedRoute>
              }
            />

            {/**Sales Return */}
            <Route
              path="/retailer/sales-return"
              element={
                <ProtectedRoute>
                  <AddSalesReturn />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/cash/sales-return"
              element={
                <ProtectedRoute>
                  <AddCashSalesReturn />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/sales-return/register"
              element={
                <ProtectedRoute>
                  <SalesReturnList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/sales-return/:id/print"
              element={
                <ProtectedRoute>
                  <SalesReturnPrint />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/salesReturn-vat-report"
              element={
                <ProtectedRoute>
                  <SalesReturnVatReport />
                </ProtectedRoute>
              }
            />

            {/**Stock Adjustment */}
            <Route
              path="/retailer/stockAdjustments/new"
              element={
                <ProtectedRoute>
                  <AddStockAdjustment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/stockAdjustments/register"
              element={
                <ProtectedRoute>
                  <StockAdjustmentsList />
                </ProtectedRoute>
              }
            />

            {/**Monthly Vat Summary */}
            <Route
              path="/retailer/monthly-vat-summary"
              element={
                <ProtectedRoute>
                  <MonthlyVatSummary />
                </ProtectedRoute>
              }
            />
            {/**Payment */}
            <Route
              path="/retailer/payments"
              element={
                <ProtectedRoute>
                  <AddPayment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/payments/register"
              element={
                <ProtectedRoute>
                  <PaymentsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/payments/:id/print"
              element={
                <ProtectedRoute>
                  <PaymentVoucherPrint />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/payments/finds"
              element={
                <ProtectedRoute>
                  <VoucherNumberForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/payments/:id"
              element={
                <ProtectedRoute>
                  <EditPayment />
                </ProtectedRoute>
              }
            />
            {/**Receipt */}
            <Route
              path="/retailer/receipts"
              element={
                <ProtectedRoute>
                  <AddReceipt />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/receipts/register"
              element={
                <ProtectedRoute>
                  <ReceiptsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/receipts/finds"
              element={
                <ProtectedRoute>
                  <ReceiptVoucherForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/receipts/:id"
              element={
                <ProtectedRoute>
                  <EditReceipt />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/receipts/:id/print"
              element={
                <ProtectedRoute>
                  <ReceiptVoucherPrint />
                </ProtectedRoute>
              }
            />
            {/**Change Password */}
            <Route
              path="/auth/user/change-password"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            {/**User List */}
            <Route
              path="/auth/admin/users/list"
              element={
                <ProtectedRoute>
                  <UserList />
                </ProtectedRoute>
              }
            />
            {/**Create New User */}
            <Route
              path="/auth/admin/create-user/new"
              element={
                <ProtectedRoute>
                  <CreateUser />
                </ProtectedRoute>
              }
            />
            {/**View Individual User Detail */}
            <Route
              path="/auth/users/view/:id"
              element={
                <ProtectedRoute>
                  <UserDetail />
                </ProtectedRoute>
              }
            />

            {/**User Permissions */}
            <Route
              path="/auth/admin/users/user-permissions/:id"
              element={
                <ProtectedRoute>
                  <UserPermission />
                </ProtectedRoute>
              }
            />

            {/**View Admin Details */}
            <Route
              path="/auth/admin/users/view/:id"
              element={
                <ProtectedRoute>
                  <ViewAdmin />
                </ProtectedRoute>
              }
            />

            {/**Miscellaneous */}
            <Route
              path="/retailer/stock-status"
              element={
                <ProtectedRoute>
                  <StockStatus />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/items/reorder"
              element={
                <ProtectedRoute>
                  <ItemsReOrderLevel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/statement"
              element={
                <ProtectedRoute>
                  <Statement />
                </ProtectedRoute>
              }
            />
            {/**===================== Sales Quotation ================ */}
            <Route
              path="/retailer/sales-quotation"
              element={
                <ProtectedRoute>
                  <AddSalesQuotation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/sales-quotation/register"
              element={
                <ProtectedRoute>
                  <SalesQuotationList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/sales-quotation/:id/print"
              element={
                <ProtectedRoute>
                  <SalesQuotationPrint />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/sales-quotation/edit/:id"
              element={
                <ProtectedRoute>
                  <EditSalesQuotation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/sales-quotation/finds"
              element={
                <ProtectedRoute>
                  <SalesQuotationVoucherNumber />
                </ProtectedRoute>
              }
            />
            {/**======================================================*/}

            {/**===================== Ageing Report ================ */}
            <Route
              path="/retailer/ageing-report/all-accounts"
              element={
                <ProtectedRoute>
                  <AgeingReportAllAccounts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/day-count-aging"
              element={
                <ProtectedRoute>
                  <DayWiseAgeing />
                </ProtectedRoute>
              }
            />
            {/**======================================================*/}

            {/**===================== Journal Voucher ================ */}
            <Route
              path="/retailer/journal"
              element={
                <ProtectedRoute>
                  <AddJournalVoucher />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/journal/register"
              element={
                <ProtectedRoute>
                  <JournalList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/journal/finds"
              element={
                <ProtectedRoute>
                  <JournalVoucherNumberForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/journal/:id"
              element={
                <ProtectedRoute>
                  <EditJournalVoucher />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/journal/:id/print"
              element={
                <ProtectedRoute>
                  <JournalVoucherPrint />
                </ProtectedRoute>
              }
            />
            {/**======================================================*/}

            {/**===================== Journal Voucher ================ */}
            <Route
              path="/retailer/debit-note"
              element={
                <ProtectedRoute>
                  <AddDebitNote />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/debit-note/register"
              element={
                <ProtectedRoute>
                  <DebitNoteRegister />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/debit-note/finds"
              element={
                <ProtectedRoute>
                  <DebitNoteNumberForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/debit-note/:id"
              element={
                <ProtectedRoute>
                  <EditDebitNote />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/debit-note/:id/print"
              element={
                <ProtectedRoute>
                  <DebitNotePrint />
                </ProtectedRoute>
              }
            />

            {/**======================================================*/}


            {/**===================== Voucher Configuration ================ */}
            <Route
              path="/retailer/voucherConfiguration"
              element={
                <ProtectedRoute>
                  <VoucherConfiguration />
                </ProtectedRoute>
              }
            />
            {/**======================================================*/}

            {/**===================== Invoice Wise Profit Loss & Daily Profit Analysis================ */}
            <Route
              path="/retailer/invoicewise/profitloss"
              element={
                <ProtectedRoute>
                  <InvoiceWiseProfitLossReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/daily-profit/sales-analysis"
              element={
                <ProtectedRoute>
                  <DailyProfit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retailer/daily-profit/sales-analysis/results"
              element={
                <ProtectedRoute>
                  <DailyProfitResult />
                </ProtectedRoute>
              }
            />
            {/**======================================================*/}

            {/**===================== List of All Existing FiscalYear ================ */}
            <Route
              path="/list-of-existing/fiscalYears"
              element={
                <ProtectedRoute>
                  <ExistingFiscalYears />
                </ProtectedRoute>
              }
            />
            <Route
              path="/change-fiscal-year"
              element={
                <ProtectedRoute>
                  <ChangeNewFiscalYear />
                </ProtectedRoute>
              }
            />
            <Route
              path="/backups"
              element={
                <ProtectedRoute>
                  <BackupPages />
                </ProtectedRoute>
              }
            />
            {/**======================================================*/}

            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PageNotRefreshProvider>
      </BackgroundWrapper>
    </Router>
  );
}

function App() {
  return (
    <LoadingProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LoadingProvider>
  );
}

export default App;