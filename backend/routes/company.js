// routes/company.js
const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const User = require('../models/User');
const mongoose = require('mongoose');
const FiscalYear = require('../models/FiscalYear');
const AccountGroup = require('../models/retailer/CompanyGroup');
const Category = require('../models/retailer/Category');
const Settings = require('../models/retailer/Settings');
const { ensureAuthenticated, isLoggedIn } = require('../middleware/auth');
const { default: Store } = require('../models/retailer/Store');
const { default: Rack } = require('../models/retailer/Rack');
const Account = require('../models/retailer/Account');
const itemsCompany = require('../models/retailer/itemsCompany');
const Unit = require('../models/retailer/Unit');
const MainUnit = require('../models/retailer/MainUnit');
const Item = require('../models/retailer/Item');
const barcodePreference = require('../models/retailer/barcodePreference');
const BillCounter = require('../models/retailer/billCounter');
const Composition = require('../models/retailer/Composition');
const CreditNote = require('../models/retailer/CreditNote');
const DebitNote = require('../models/retailer/DebitNote');
const JournalVoucher = require('../models/retailer/JournalVoucher');
const OpeningStock = require('../models/retailer/OpeningStock');
const Payment = require('../models/retailer/Payment');
const PurchaseBill = require('../models/retailer/PurchaseBill');
const PurchaseReturns = require('../models/retailer/PurchaseReturns');
const Receipt = require('../models/retailer/Receipt');
const SalesBill = require('../models/retailer/SalesBill');
const SalesReturn = require('../models/retailer/SalesReturn');
const StockAdjustment = require('../models/retailer/StockAdjustment');
const Transaction = require('../models/retailer/Transaction');
const SalesQuotation = require('../models/retailer/SalesQuotation');


// routes/company.js
router.get('/user-companies', ensureAuthenticated, async (req, res) => {
    try {
        let companies;

        if (req.user.isAdmin) {
            // Admin sees all companies they own
            companies = await Company.find({ owner: req.user._id });
        } else {
            // Regular users see companies they're associated with
            companies = await Company.find({ _id: req.user.company });
        }

        res.json(companies);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch companies' });
    }
});


const defaultCashAccount = {
    name: 'Cash in Hand',
    groupName: 'Cash in Hand',
    groupType: 'Current Assets', // Assuming Cash falls under Current Assets
    openingBalance: { amount: 0, type: 'Dr' }
};

const defaultVatAccount = {
    name: 'VAT',
    groupName: 'Duties & Taxes',
    groupType: 'Current Liabilities',
    openingBalance: { amount: 0, type: 'Dr' }
}

const otherDefaultAccounts = [
    { name: 'Advertisement & Publicity', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Bad Debts Written Off', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Bank Charges', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Books & Periodicals', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Capital Equipments', groupName: 'Fixed Assets', groupType: 'Fixed Assets', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Charity & Donations', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Commission on Sales', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Computers', groupName: 'Fixed Assets', groupType: 'Fixed Assets', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Conveyance Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Customer Entertainment Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Depreciation A/c', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Earnest Money', groupName: 'Securities & Deposits', groupType: 'Current Assets', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Freight & Forwarding Charges', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Furniture & Fixture', groupName: 'Fixed Assets', groupType: 'Fixed Assets', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Legal Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Miscellaneous Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Office Equipments', groupName: 'Fixed Assets', groupType: 'Fixed Assets', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Office Maintenance Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Office Rent', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Plant & Machinery', groupName: 'Fixed Assets', groupType: 'Fixed Assets', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Postal Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Printing & Stationery', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Profit & Loss', groupName: 'Profit & Loss', groupType: 'Primary', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Purchase', groupName: 'Purchase', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Rounded Off', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Salary', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Salary & Bonus Payable', groupName: 'Provisions/Expenses Payable', groupType: 'Current Liabilities', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Sales', groupName: 'Sale', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Stock', groupName: 'Stock in hand', groupType: 'Current Assets', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Sales Promotion Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Service Charges Paid', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Service Charges Receipts', groupName: 'Income (Indirect)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Staff Welfare Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Telephone Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Travelling Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'VAT Refund A/c', groupName: 'Income (Direct/Opr.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'VAT Refundable From Govt.', groupName: 'Current Assets', groupType: 'Primary', openingBalance: { amount: 0, type: 'Dr' } },
    { name: 'Water & Electricity Expenses', groupName: 'Expenses (Indirect/Admn.)', groupType: 'Revenue Accounts', openingBalance: { amount: 0, type: 'Dr' } },
];

// Default account groups
const defaultAccountGroups = [
    { name: 'Sundry Debtors', type: 'Current Assets' },
    { name: 'Sundry Creditors', type: 'Current Liabilities' },
    { name: 'Cash in Hand', type: 'Current Assets' },
    { name: 'Bank Accounts', type: 'Current Assets' },
    { name: 'Bank O/D Account', type: 'Loans(Liability)' },
    { name: 'Duties & Taxes', type: 'Current Liabilities' },
    { name: 'Fixed Assets', type: 'Fixed Assets' },
    { name: 'Reserves & Surplus', type: 'Capital Account' },
    { name: 'Secured Loans', type: 'Loans(Liability)' },
    { name: 'Securities & Deposits', type: 'Current Assets' },
    { name: 'Stock in hand', type: 'Current Assets' },
    { name: 'Unsecured Loans', type: 'Loans(Liability)' },
    { name: 'Expenses (Direct/Mfg.)', type: 'Revenue Accounts' },
    { name: 'Expenses (Indirect/Admn.)', type: 'Revenue Accounts' },
    { name: 'Income (Direct/Opr.)', type: 'Revenue Accounts' },
    { name: 'Income (Indirect)', type: 'Revenue Accounts' },
    { name: 'Loans & Advances', type: 'Current Assets' },
    { name: 'Provisions/Expenses Payable', type: 'Current Liabilities' },
    { name: 'Profit & Loss', type: 'Primary' },
    { name: 'Purchase', type: 'Revenue Accounts' },
    { name: 'Sale', type: 'Revenue Accounts' },
    { name: 'Current Assets', type: 'Primary' },
    // Add more default groups as needed
];

// Function to add the default Cash account
async function addDefaultCashAccount(companyId) {
    try {
        // Find the company by ID and populate its fiscalYear
        const company = await Company.findById(companyId).populate('fiscalYear');

        if (!company) {
            throw new Error('Company not found');
        }

        // Fetch the fiscal year directly from the newly created company
        let currentFiscalYear = company.fiscalYear;

        // Ensure that the fiscal year exists
        if (!currentFiscalYear) {
            throw new Error('No fiscal year found for the newly created company.');
        }

        const cashGroup = await AccountGroup.findOne({
            name: defaultCashAccount.groupName,
            type: defaultCashAccount.groupType,
            company: companyId,
        });

        if (cashGroup) {
            const cashAccount = new Account({
                _id: new mongoose.Types.ObjectId(),
                name: defaultCashAccount.name,
                companyGroups: cashGroup._id, // Correct field for group reference
                openingBalance: {
                    amount: defaultCashAccount.openingBalance.amount,
                    type: defaultCashAccount.openingBalance.type
                },
                company: companyId,
                fiscalYear: currentFiscalYear._id, // Associate the fiscal year directly from company
                defaultCashAccount: true,
            });

            await cashAccount.save();
            (`Default cash account "${defaultCashAccount.name}" added successfully.`);
        } else {
            console.error('Error: "Cash in Hand" group not found for the company.');
        }
    } catch (error) {
        console.error('Error adding default cash account:', error);
    }
}

// Function to add default other accounts
async function addOtherDefaultAccounts(companyId) {
    try {
        // Find the company by ID and populate its fiscalYear
        const company = await Company.findById(companyId).populate('fiscalYear');

        if (!company) {
            throw new Error('Company not found');
        }

        // Fetch the fiscal year directly from the newly created company
        let currentFiscalYear = company.fiscalYear;

        // Ensure that the fiscal year exists
        if (!currentFiscalYear) {
            throw new Error('No fiscal year found for the newly created company.');
        }

        // Iterate over each account in the otherDefaultAccounts array
        for (const accountData of otherDefaultAccounts) {
            // Find the account group for the current account
            const otherDefaultAccountGroup = await AccountGroup.findOne({
                name: accountData.groupName,
                type: accountData.groupType,
                company: companyId,
            });

            if (otherDefaultAccountGroup) {
                // Create the account
                const otherAccount = new Account({
                    _id: new mongoose.Types.ObjectId(),
                    name: accountData.name,
                    companyGroups: otherDefaultAccountGroup._id, // Correct field for group reference
                    openingBalance: {
                        amount: accountData.openingBalance.amount,
                        type: accountData.openingBalance.type,
                    },
                    company: companyId,
                    fiscalYear: currentFiscalYear._id, // Associate the fiscal year directly from company
                    isDefaultAccount: true, // Optional: Mark as a default account
                });

                await otherAccount.save();
                (`Default account "${otherAccount.name}" added successfully.`);
            } else {
                console.error(`Error: Account group "${accountData.groupName}" not found for the company.`);
            }
        }
    } catch (error) {
        console.error('Error adding default other accounts:', error);
    }
}

//function to add other default accounts:
async function addDefaultVatAccount(companyId) {
    try {
        // Find the company by ID and populate its fiscalYear
        const company = await Company.findById(companyId).populate('fiscalYear');

        if (!company) {
            throw new Error('Company not found');
        }

        // Fetch the fiscal year directly from the newly created company
        let currentFiscalYear = company.fiscalYear;

        // Ensure that the fiscal year exists
        if (!currentFiscalYear) {
            throw new Error('No fiscal year found for the newly created company.');
        }

        const dutiesAndTaxGroup = await AccountGroup.findOne({
            name: defaultVatAccount.groupName,
            type: defaultVatAccount.groupType,
            company: companyId,
        });

        if (dutiesAndTaxGroup) {
            const vatAccount = new Account({
                _id: new mongoose.Types.ObjectId(),
                name: defaultVatAccount.name,
                companyGroups: dutiesAndTaxGroup._id, // Correct field for group reference
                openingBalance: {
                    amount: defaultVatAccount.openingBalance.amount,
                    type: defaultVatAccount.openingBalance.type
                },
                company: companyId,
                fiscalYear: currentFiscalYear._id, // Associate the fiscal year directly from company
                defaultVatAccount: true,
            });

            await vatAccount.save();
            (`Default VAT account "${defaultVatAccount.name}" added successfully.`);
        } else {
            console.error('Error: "Duties & Taxes" group not found for the company.');
        }
    } catch (error) {
        console.error('Error adding default VAT account:', error);
    }
}


// Function to add default account groups associated with the company
async function addDefaultAccountGroups(companyId) {
    try {
        const accountGroups = defaultAccountGroups.map(group => ({
            ...group,
            company: companyId // Associate with the newly created company
        }));

        await AccountGroup.insertMany(accountGroups);
        ('Default account groups added successfully.');

        // After adding groups, add the default Cash account under the "Cash in Hand" group
        await addDefaultCashAccount(companyId);

        // After adding groups, add the default VAT account under the "Duties & Taxes" group
        await addDefaultVatAccount(companyId);

        // After adding groups, add the default other account under the "other default" group
        await addOtherDefaultAccounts(companyId);
    } catch (error) {
        console.error('Error adding default account groups:', error);
    }
}

const defaultItemCategory = {
    name: 'General'
}
async function addDefaultItemCategory(companyId) {
    const categories = new Category({
        name: defaultItemCategory.name,
        company: companyId,
    });
    await categories.save();
}

const defaultItemCompany = {
    name: 'General'
}

async function addDefaultItemCompany(companyId) {
    const itemsCompanies = new itemsCompany({
        name: defaultItemCompany.name,
        company: companyId,
    });
    await itemsCompanies.save();
}

const defaultItemUnit = [
    { name: 'Bott' },
    { name: 'Box' },
    { name: 'Dozen' },
    { name: 'Gms.' },
    { name: 'Jar' },
    { name: 'Kgs.' },
    { name: 'Kit' },
    { name: 'Test' },
    { name: 'Mtr' },
    { name: 'Pair' },
    { name: 'Pcs' },
    { name: 'Ph' },
    { name: 'Pkt' },
    { name: 'Roll' },
    { name: 'Set' },
    { name: 'Than' },
    { name: 'Tonne' },
    { name: 'Units' }
];

const defaultItemMainUnit = [
    { name: 'Bott' },
    { name: 'Box' },
    { name: 'Dozen' },
    { name: 'Gms.' },
    { name: 'Jar' },
    { name: 'Kgs.' },
    { name: 'Kit' },
    { name: 'Test' },
    { name: 'Mtr' },
    { name: 'Pair' },
    { name: 'Pcs' },
    { name: 'Ph' },
    { name: 'Pkt' },
    { name: 'Roll' },
    { name: 'Set' },
    { name: 'Than' },
    { name: 'Tonne' },
    { name: 'Units' }
];

async function addDefaultItemUnit(companyId) {
    try {
        const units = defaultItemUnit.map(unit => ({
            ...unit,
            company: companyId,
        }));
        await Unit.insertMany(units);
        ('Default item units added successfully.');
    } catch (error) {
        console.error('Error adding default item unit:', error);
    }
}

async function addDefaultItemMainUnit(companyId) {
    try {
        const mainUnits = defaultItemMainUnit.map(mainUnit => ({
            ...mainUnit,
            company: companyId,
        }));
        await MainUnit.insertMany(mainUnits);
        ('Default item main units added successfully.');
    } catch (error) {
        console.error('Error adding default item main unit:', error);
    }
}


const defaultStore = {
    name: 'Main'
}
async function addDefaultStore(companyId) {
    const store = new Store({
        name: defaultStore.name,
        company: companyId,
    });
    await store.save();
    return store;
}

const defaultRack = {
    name: 'Default'
};

async function addDefaultRack(companyId, storeId) {
    const rack = new Rack({
        name: defaultRack.name,
        store: storeId,
        company: companyId,
    });
    await rack.save();
}


// Route for creating a new company
router.post('/company/new', ensureAuthenticated, async (req, res) => {
    try {
        const {
            name,
            address,
            country,
            state,
            city,
            pan,
            phone,
            ward,
            email,
            dateFormat,
            tradeType,
            startDateEnglish,
            endDateEnglish,
            startDateNepali,
            endDateNepali,
            vatEnabled
        } = req.body;
        const owner = req.user._id;

        if (!tradeType) {
            return res.status(400).json({ success: false, error: 'Trade type is required' });
        }

        // Determine the start and end dates based on dateFormat
        let startDate, endDate;
        if (dateFormat === 'nepali') {
            startDate = startDateNepali;
            endDate = endDateNepali;
        } else if (dateFormat === 'english') {
            startDate = startDateEnglish;
            endDate = endDateEnglish;
        } else {
            return res.status(400).json({ success: false, error: 'Invalid date format' });
        }

        // Set default end date to one year from the start date minus one day if not provided
        if (!endDate) {
            const tempDate = new Date(startDate);
            tempDate.setFullYear(tempDate.getFullYear() + 1);
            tempDate.setDate(tempDate.getDate() - 1);
            endDate = tempDate.toISOString().split('T')[0];
        }

        // Determine the createdAt date based on the company's dateFormat
        let createdAt;
        if (dateFormat === 'nepali') {
            // Keep as Nepali date string without conversion
            createdAt = startDateNepali;
        } else {
            // Use the English start date for createdAt
            createdAt = startDateEnglish;
        }

        // Check if the company already exists
        const existingCompany = await Company.findOne({ name: name });

        if (existingCompany) {
            return res.status(400).json({
                success: false,
                error: 'Company already exists',
                existingCompanyId: existingCompany._id
            });
        }

        // Create the new company
        const newCompany = new Company({
            name,
            address,
            country,
            state,
            city,
            pan,
            phone,
            ward,
            email,
            tradeType,
            dateFormat,
            fiscalYearStartDate: startDate,
            owner,
            createdAt, // Set the calculated createdAt date
            vatEnabled: Boolean(vatEnabled)
        });

        const company = await newCompany.save();

        // Create Fiscal Year entry
        const startDateObject = new Date(startDate);
        const endDateObject = new Date(endDate);

        // Extract the year from the start and end dates
        const startYear = startDateObject.getFullYear();
        const endYear = endDateObject.getFullYear();

        // Create the name in the "YYYY/YY" format
        const fiscalYearName = `${startYear}/${endYear.toString().slice(-2)}`;

        // Create the default fiscal year
        const defaultFiscalYear = new FiscalYear({
            name: fiscalYearName,
            startDate: startDateObject,
            endDate: endDateObject,
            isActive: true,
            dateFormat,
            company: company._id
        });
        await defaultFiscalYear.save();

        // Assign the default fiscal year to the company
        company.fiscalYear = defaultFiscalYear._id;
        await company.save();

        // Add all default configurations
        await addDefaultAccountGroups(company._id);
        await addDefaultItemCategory(company._id);
        await addDefaultItemCompany(company._id);
        await addDefaultItemUnit(company._id);
        await addDefaultItemMainUnit(company._id);

        // Create default store and rack
        const store = await addDefaultStore(company._id);
        await addDefaultRack(company._id, store._id);

        // Update user with new company
        await User.findByIdAndUpdate(req.user._id, { $push: { companies: company._id } });

        // Create default settings
        const newSettings = new Settings({
            companyId: company._id,
            userId: req.user._id,
            roundOffSales: false,
            roundOffPurchase: false,
            roundOffSalesReturn: false,
            roundOffPurchaseReturn: false,
            displayTransactions: false,
            displayTransactionsForPurchase: false,
            displayTransactionsForSalesReturn: false,
            displayTransactionsForPurchaseReturn: false,
            fiscalYear: defaultFiscalYear._id,
            company: company._id
        });
        await newSettings.save();

        // Determine dashboard path based on tradeType
        let dashboardPath;
        switch (tradeType) {
            case 'retailer':
                dashboardPath = '/retailerDashboard';
                break;
            case 'Pharmacy':
                dashboardPath = '/pharmacyDashboard';
                break;
            default:
                dashboardPath = '/defaultDashboard';
                break;
        }

        return res.status(201).json({
            success: true,
            message: 'Company created successfully',
            company,
            fiscalYear: defaultFiscalYear,
            dashboardPath,
            settings: newSettings
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            error: 'Server error while creating company',
            details: err.message
        });
    }
});


// Route to switch to a company and set the latest fiscal year (JSON API version)
router.get('/switch/:id', ensureAuthenticated, async (req, res) => {
    try {
        const companyId = req.params.id;
        const company = await Company.findById(companyId).lean();

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Verify user has access to this company
        if (!req.user.isAdmin && req.user.company.toString() !== companyId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access to this company'
            });
        }

        // Get the latest fiscal year for this company (sorted by startDate to get the most recent)
        const latestFiscalYear = await FiscalYear.findOne({
            company: companyId
        }).sort({ startDate: -1 });

        if (!latestFiscalYear) {
            return res.status(400).json({
                success: false,
                message: 'No fiscal year found for this company',
                redirectPath: '/fiscal-years' // Suggest where to create one
            });
        }

        // Update session data
        req.session.currentCompany = company._id;
        req.session.currentCompanyName = company.name;
        req.session.currentFiscalYear = {
            id: latestFiscalYear._id,
            name: latestFiscalYear.name,
            startDate: latestFiscalYear.startDate,
            endDate: latestFiscalYear.endDate,
            dateFormat: latestFiscalYear.dateFormat || 'YYYY-MM-DD' // Default if not set
        };

        // Save the session
        await new Promise((resolve, reject) => {
            req.session.save(err => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Determine the redirect path based on the company's trade type
        let redirectPath;
        switch ((company.tradeType || '').toLowerCase()) {
            case 'retailer':
                redirectPath = '/retailerDashboard/indexv1';
                break;
            case 'pharmacy':
                redirectPath = '/pharmacyDashboard';
                break;
            default:
                redirectPath = '/dashboard';
                break;
        }

        res.json({
            success: true,
            message: `Switched to: ${company.name}`,
            data: {
                sessionData: {
                    company: {
                        id: company._id,
                        name: company.name,
                        tradeType: company.tradeType
                    },
                    fiscalYear: {
                        id: latestFiscalYear._id,
                        name: latestFiscalYear.name,
                        startDate: latestFiscalYear.startDate,
                        endDate: latestFiscalYear.endDate
                    }
                },
                redirectPath
            }
        });

    } catch (error) {
        console.error('Error switching company:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to switch company',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


// Route to view company details (API version)
router.get('/company/:id', isLoggedIn, ensureAuthenticated, async (req, res) => {
    try {
        const companyId = req.params.id;
        let userCompanies;
        const companyDataSizes = {};

        const company = await Company.findById(companyId)
            .populate('owner', 'name email')
            .populate('users', 'name email')
            .populate('settings')
            .populate('fiscalYear');

        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Check if the user is an admin
        if (req.user.isAdmin) {
            userCompanies = await Company.find({ owner: req.user._id });
        } else {
            userCompanies = await Company.find({ _id: req.user.company });
        }

        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established.');
        }

        // Calculate data size for each company
        for (const comp of userCompanies) {
            let totalSize = 0;
            const relatedCollections = [
                'sales', 'purchases', 'transactions', 'accounts',
                'billcounters', 'categories', 'companies', 'companygroups',
                'creditnotes', 'debitnotes', 'fiscalyears', 'items',
                'journalvouchers', 'payments', 'receipts', 'settings',
                'stockadjustments', 'units', 'users'
            ];

            for (const collectionName of relatedCollections) {
                try {
                    const collection = db.collection(collectionName);
                    const stats = await db.command({ collStats: collectionName });
                    const companyDocsCount = await collection.countDocuments({ company: comp._id });
                    const companySize = (stats.size * companyDocsCount) / stats.count;
                    totalSize += companySize || 0;
                } catch (err) {
                    console.error(`Error processing collection ${collectionName}:`, err);
                }
            }

            companyDataSizes[comp._id] = Math.round(totalSize / 1024);
        }

        res.json({
            company,
            companyDataSizes,
            isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Updated GET route for fetching company data
router.get('/company/edit/:id', isLoggedIn, ensureAuthenticated, async (req, res) => {
    try {
        const companyId = req.params.id;

        // First verify the user has access to this company
        const user = req.user;
        let hasAccess = false;

        // Check if user is admin or supervisor
        if (user.isAdmin || user.role === 'Supervisor') {
            hasAccess = true;
        }
        // Check if user is owner of the company
        else if (user.company && user.company.toString() === companyId) {
            hasAccess = true;
        }

        if (!hasAccess) {
            return res.status(403).json({ message: 'Unauthorized access to company data' });
        }

        // Fetch company data with necessary populations
        const company = await Company.findById(companyId)
            .populate('owner', 'name email')
            .populate('fiscalYear')
            .lean(); // Convert to plain JS object

        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Format dates for the frontend
        const formattedCompany = {
            ...company,
            startDateEnglish: company.fiscalYearStartDate ?
                new Date(company.fiscalYearStartDate).toISOString().split('T')[0] :
                new Date().toISOString().split('T')[0],
            // Add other formatted fields as needed
        };

        res.json({
            success: true,
            company: formattedCompany,
            isAdminOrSupervisor: user.isAdmin || user.role === 'Supervisor'
        });

    } catch (error) {
        console.error('Error fetching company:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
});

// Updated route to handle both HTML and JSON responses
router.put('/company/edit/:id', ensureAuthenticated, async (req, res) => {
    try {
        const {
            name,
            address,
            country,
            state,
            city,
            pan,
            phone,
            ward,
            email,
            tradeType,
            dateFormat,
            startDateEnglish,
            endDateEnglish,
            startDateNepali,
            endDateNepali,
            vatEnabled
        } = req.body;

        // Determine the start and end dates based on dateFormat
        let startDate, endDate;
        if (dateFormat === 'nepali') {
            startDate = startDateNepali;
            endDate = endDateNepali;
        } else {
            startDate = startDateEnglish;
            endDate = endDateEnglish;
        }

        if (!endDate) {
            endDate = new Date(startDate);
            endDate.setFullYear(endDate.getFullYear() + 1);
            endDate.setDate(endDate.getDate() - 1);
        }

        // Update company information
        const company = await Company.findByIdAndUpdate(
            req.params.id,
            {
                name,
                address,
                country,
                state,
                city,
                pan,
                phone,
                ward,
                email,
                tradeType,
                dateFormat,
                fiscalYearStartDate: startDate,
                vatEnabled: vatEnabled === 'on'
            },
            { new: true }
        );


        // Update fiscal year if dateFormat or dates have changed
        const startDateObject = new Date(startDate);
        const endDateObject = new Date(endDate);
        const fiscalYearName = `${startDateObject.getFullYear()}/${endDateObject.getFullYear().toString().slice(-2)}`;

        let fiscalYear = await FiscalYear.findOneAndUpdate(
            { company: company._id },
            { name: fiscalYearName, startDate: startDateObject, endDate: endDateObject },
            { new: true }
        );

        if (!fiscalYear) {
            fiscalYear = new FiscalYear({
                name: fiscalYearName,
                startDate: startDateObject,
                endDate: endDateObject,
                company: company._id
            });
            await fiscalYear.save();
        }

        company.fiscalYear = fiscalYear._id;
        await company.save();


        // Check if the request wants JSON response (from React)
        if (req.accepts('json')) {
            return res.json({
                success: true,
                message: 'Company details updated successfully',
                company,
                fiscalYear,
                redirectPath: determineRedirectPath(tradeType)
            });
        }

        // HTML response fallback (for traditional server-side apps)
        req.flash('success', 'Company details updated successfully');
        res.redirect(determineRedirectPath(tradeType));

    } catch (err) {
        console.error(err);

        // JSON error response
        if (req.accepts('json')) {
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

        // HTML error response fallback
        req.flash('error', err.message);
        res.redirect('back');
    }
});

// Helper function to determine redirect path
function determineRedirectPath(tradeType) {
    switch (tradeType) {
        case 'retailer':
        case 'Retailer':
            return '/retailerDashboard';
        case 'Pharmacy':
            return '/pharmacyDashboard';
        default:
            return '/dashboard';
    }
}


// router.get('/my-company', ensureAuthenticated, ensureCompanySelected, async (req, res) => {
//     try {
//         const currentCompanyName = req.session.currentCompanyName;
//         const companyId = req.session.currentCompany;
//         // Check if fiscal year is already in the session or available in the company
//         let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
//         let currentFiscalYear = null;
//         const company = Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear');
// if (fiscalYear) {
//     // Fetch the fiscal year from the database if available in the session
//     currentFiscalYear = await FiscalYear.findById(fiscalYear).lean();
// }

// // If no fiscal year is found in session but exists in company
// if (!currentFiscalYear && company.fiscalYear) {
//     currentFiscalYear = company.fiscalYear;

//     // Set the fiscal year in the session for future requests
//     req.session.currentFiscalYear = {
//         id: currentFiscalYear._id.toString(),
//         startDate: currentFiscalYear.startDate,
//         endDate: currentFiscalYear.endDate,
//         name: currentFiscalYear.name,
//         dateFormat: currentFiscalYear.dateFormat,
//         isActive: currentFiscalYear.isActive
//     };

//     fiscalYear = req.session.currentFiscalYear.id;
// }

// if (!fiscalYear) {
//     return res.status(400).json({
//         success: false,
//         error: 'No fiscal year found in session or company'
//     });
// }

//         res.json({
//             currentCompanyName,
//             currentFiscalYear,
//             company: {
//                 _id: company._id,
//                 renewalDate: company.renewalDate,
//                 dateFormat: company.dateFormat,
//                 vatEnabled: company.vatEnabled,
//                 fiscalYear: company.fiscalYear
//             },
//         });
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ message: 'Server Error' });
//     }
// });

// routes/auth.js
router.get('/my-company', ensureAuthenticated, async (req, res) => {
    try {
        if (!req.session.currentCompany) {
            return res.status(400).json({
                success: false,
                error: 'No company selected'
            });
        }

        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;

        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat vatEnabled')
            .populate('fiscalYear')
            .lean();

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            // Fetch the fiscal year from the database if available in the session
            currentFiscalYear = await FiscalYear.findById(fiscalYear).lean();
        }

        // If no fiscal year is found in session but exists in company
        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;

            // Set the fiscal year in the session for future requests
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            };

            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company'
            });
        }

        res.json({
            success: true,
            company: {
                ...company,
                currentCompanyName
            },
            currentCompanyName,
            currentFiscalYear: req.session.currentFiscalYear
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});


router.delete('/company/:id', ensureAuthenticated, async (req, res) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const { id } = req.params;

            // Delete related documents
            await Promise.all([
                Item.deleteMany({ company: id }).session(session),
                Unit.deleteMany({ company: id }).session(session),
                Category.deleteMany({ company: id }).session(session),
                Account.deleteMany({ company: id }).session(session),
                barcodePreference.deleteMany({ company: id }).session(session),
                BillCounter.deleteMany({ company: id }).session(session),
                AccountGroup.deleteMany({ company: id }).session(session),
                Composition.deleteMany({ company: id }).session(session),
                CreditNote.deleteMany({ company: id }).session(session),
                DebitNote.deleteMany({ company: id }).session(session),
                FiscalYear.deleteMany({ company: id }).session(session),
                JournalVoucher.deleteMany({ company: id }).session(session),
                MainUnit.deleteMany({ company: id }).session(session),
                OpeningStock.deleteMany({ company: id }).session(session),
                Payment.deleteMany({ company: id }).session(session),
                PurchaseBill.deleteMany({ company: id }).session(session),
                PurchaseReturns.deleteMany({ company: id }).session(session),
                Rack.deleteMany({ company: id }).session(session),
                Receipt.deleteMany({ company: id }).session(session),
                SalesBill.deleteMany({ company: id }).session(session),
                SalesReturn.deleteMany({ company: id }).session(session),
                Settings.deleteMany({ company: id }).session(session),
                StockAdjustment.deleteMany({ company: id }).session(session),
                Store.deleteMany({ company: id }).session(session),
                Transaction.deleteMany({ company: id }).session(session),
                itemsCompany.deleteMany({ company: id }).session(session),
                SalesQuotation.deleteMany({ company: id }).session(session)
            ]);

            // Delete the company
            await Company.deleteOne({ _id: id }, { session });
        });

        res.status(200).json({
            success: true,
            message: 'Company and all related data deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting company:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete company',
            error: error.message
        });
    } finally {
        session.endSession();
    }
});

module.exports = router;