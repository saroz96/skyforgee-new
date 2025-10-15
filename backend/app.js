const express = require('express');
// const cacheService = require('./Redis/cache')
// const { connectRedis } = require('./Redis/redisClient')
const mongoose = require('mongoose');
require('dotenv').config();
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const cors = require('cors');
const passport = require('passport');
const initializePassport = require('./config/passport-config');

const MongoStore = require('connect-mongo');
const path = require('path');
const app = express();

// const _dirname = path.resolve();

// Import routes
const userRoutes = require('./routes/users');
const companyRoutes = require('./routes/company');
const fiscalYearRoutes = require('./routes/fiscalYear');
const itemRoutes = require('./routes/retailer/items');
const categoryRoutes = require('./routes/retailer/category');
const itemsCompanyRoutes = require('./routes/retailer/itemsCompany');
const unitRoutes = require('./routes/retailer/unit');
const mainUnitRoutes = require('./routes/retailer/mainUnit');
const compositionRroutes = require('./routes/retailer/composition');
const accountRoutes = require('./routes/retailer/account');
const accountGroupRoutes = require('./routes/retailer/companyGroup');
const purchaseRoutes = require('./routes/retailer/purchase');
const salesRoutes = require('./routes/retailer/sales');
const purchaseReturnRoutes = require('./routes/retailer/purchaseReturn');
const salesReturnRoutes = require('./routes/retailer/salesReturn');
const miscRoutes = require('./routes/retailer/miscellaneous');
const paymentRoutes = require('./routes/retailer/payment');
const receiptRoutes = require('./routes/retailer/receipt');
const stockAdjustmentRoutes = require('./routes/retailer/stockAdjustments');
const dashboardV1Routes = require('./routes/retailer/dashboardV1');
const salesQuotationRoutes = require('./routes/retailer/salesQuotation');
const ageingReportRoutes = require('./routes/retailer/ageingReport');
const journalVoucherRoutes = require('./routes/retailer/journalVoucher');
const settingsRoutes = require('./routes/retailer/settings');
const transactionRoutes = require('./routes/retailer/transaction');
const networkStatusRoutes = require('./routes/networkStatus');
const invoiceWiseProfitLossRoutes = require('./routes/retailer/profitAnalysis');
const debitNoteRoutes = require('./routes/retailer/debitNote');

const backupRoutes = require('./routes/backupRoutes');

// Initialize Passport
initializePassport(passport);

// MongoDB connection
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

// // Middleware
app.use(cors({
    // origin: 'https://skyforgee.com',
    origin: 'http://localhost:3000',
    // origin: 'https://web.skyforgee.com',
    // origin: ['https://skyforgee.com', 'https://skyforgee.com'],//this is for desktop app
    // origin: ['https://web.skyforgee.com', 'https://web.skyforgee.com'],//this is for desktop app
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// Configure session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            ttl: 14 * 24 * 60 * 60
        }),
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        }
    }
}))


// app.use(session(sessionConfig));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Flash middleware
app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.messages = req.flash('success');
    res.locals.error = req.flash('error'); // Fixed typo here (was 'errsor')
    res.locals.error = req.flash('error');
    next();
});


// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'frontend/build')));


// Routes
app.use('/api/auth', userRoutes);
app.use('/api', companyRoutes);
app.use('/api', fiscalYearRoutes);
app.use('/api', networkStatusRoutes);

// Retailer routes
app.use('/api/retailer', itemRoutes);
app.use('/api/retailer', categoryRoutes);
app.use('/api/retailer', itemsCompanyRoutes);
app.use('/api/retailer', unitRoutes);
app.use('/api/retailer', mainUnitRoutes);
app.use('/api/retailer', compositionRroutes);
app.use('/api/retailer', accountRoutes);
app.use('/api/retailer', accountGroupRoutes);
app.use('/api/retailer', purchaseRoutes);
app.use('/api/retailer', salesRoutes);
app.use('/api/retailer', purchaseReturnRoutes);
app.use('/api/retailer', salesReturnRoutes);
app.use('/api/retailer', miscRoutes);
app.use('/api/retailer', paymentRoutes);
app.use('/api/retailer', receiptRoutes);
app.use('/api/retailer', stockAdjustmentRoutes);
app.use('/api/retailer', dashboardV1Routes);
app.use('/api/retailer', salesQuotationRoutes)
app.use('/api/retailer', ageingReportRoutes)
app.use('/api/retailer', journalVoucherRoutes)
app.use('/api/retailer', settingsRoutes)
app.use('/api/retailer', transactionRoutes)
app.use('/api/retailer', invoiceWiseProfitLossRoutes)
app.use('/api/retailer', debitNoteRoutes)

app.use('/api/backup', backupRoutes);


// Only handle non-API routes with React
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

app.get('/', (req, res) => {
    res.send('Backend is running');
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})
