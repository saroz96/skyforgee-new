const nodemailer = require('nodemailer');
const crypto = require('crypto');

//for gmail emails
// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

//for cPanel emails
const transporter = nodemailer.createTransport({
    host: 'mail.skyforgee.com', // Replace with your domain's mail server (e.g., mail.yourdomain.com)
    port: 465, // Use 465 for SSL or 587 for TLS
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER, // Your cPanel email address (e.g., noreply@yourdomain.com)
        pass: process.env.EMAIL_PASS  // Password for that email account
    }
});

const generateToken = () => crypto.randomBytes(20).toString('hex');

module.exports = {
    transporter,
    generateToken
};