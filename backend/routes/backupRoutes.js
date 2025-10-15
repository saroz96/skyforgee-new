
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Your authentication middleware
const zlib = require('zlib');

const SalesBill = require('../models/retailer/SalesBill');
const Company = require('../models/Company');
const Account = require('../models/retailer/Account');
const BillCounter = require('../models/retailer/billCounter');
const Category = require('../models/retailer/Category');
const CompanyGroup = require('../models/retailer/CompanyGroup');
const Composition = require('../models/retailer/Composition');

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Manual Backup Trigger
router.get('/json/backup', async (req, res) => {
    try {
        // 1. Get user's company ID from the authenticated session
        const userId = req.user.id;
        const company = await Company.findOne({ owner: userId }); // or check `users` array
        if (!company) {
            return res.status(404).json({ error: 'Company not found.' });
        }

        // 2. Fetch all data related to the user's company
        const salesBill = await SalesBill.find({ company: company._id });
        const account = await Account.find({ company: company._id });
        const billCounter = await BillCounter.find({ company: company._id });
        const category = await Category.find({ company: company._id });
        const companyGroup = await CompanyGroup.find({ company: company._id });
        const composition = await Composition.find({ company: company._id });
        // ... fetch other collections (Products, Transactions, etc.)

        // 3. Combine into a single backup object - ONLY COMPANY DETAILS ADDED
        const backupData = {
            exportedAt: new Date().toISOString(),
            company: {
                // Complete company details from your schema
                _id: company._id,
                name: company.name,
                address: company.address,
                country: company.country,
                state: company.state,
                city: company.city,
                pan: company.pan,
                phone: company.phone,
                ward: company.ward,
                email: company.email,
                tradeType: company.tradeType,
                owner: company.owner,
                users: company.users,
                settings: company.settings,
                dateFormat: company.dateFormat,
                fiscalYear: company.fiscalYear,
                renewalDate: company.renewalDate,
                fiscalYearStartDate: company.fiscalYearStartDate,
                vatEnabled: company.vatEnabled,
                storeManagement: company.storeManagement,
                notificationEmails: company.notificationEmails,
                createdAt: company.createdAt,
                updatedAt: company.updatedAt
            },
            data: {
                salesBill,
                account,
                billCounter,
                category,
                companyGroup,
                composition
                /* ... other data */
            }
        };

        // 4. Convert to JSON string and compress
        const jsonString = JSON.stringify(backupData);
        zlib.gzip(jsonString, (err, compressedBuffer) => {
            if (err) throw err;

            // 5. Set headers to force a download dialog in the browser
            const timestamp = new Date().toISOString().split('T')[0];
            res.setHeader('Content-Disposition', `attachment; filename="backup_${company.name}_${timestamp}.json.gz"`);
            res.setHeader('Content-Type', 'application/gzip');

            // 6. Send the compressed file
            res.send(compressedBuffer);
        });

    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).send('Server error during backup creation.');
    }
});


router.get('/download', async (req, res) => {
    try {
        const timestamp = new Date().toISOString().split('T')[0];
        const backupDir = path.join(__dirname, '../backups');
        const backupFile = path.join(backupDir, `backup_${timestamp}.gz`);

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }
        
        // ✅ FIXED: no extra quotes around mongoUri
        const mongoUri = process.env.MONGO_URI || 'mongodb+srv://saroj:12345@cluster0.vgu4kmg.mongodb.net/skyforgee';
        // const dumpCommand = `mongodump --uri=${mongoUri} --archive=${backupFile} --gzip`;
        const dumpCommand = `mongodump --uri="${mongoUri}" --archive="${backupFile}" --gzip`;


        exec(dumpCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('mongodump error:', stderr);
                return res.status(500).json({ error: 'Backup failed.' });
            }

            res.setHeader('Content-Disposition', `attachment; filename="backup_${timestamp}.gz"`);
            res.setHeader('Content-Type', 'application/gzip');

            const readStream = fs.createReadStream(backupFile);
            readStream.pipe(res);

            readStream.on('close', () => {
                fs.unlinkSync(backupFile);
            });
        });

    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).send('Server error during backup.');
    }
});


module.exports = router;