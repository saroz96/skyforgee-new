const crypto = require('crypto'); // Add this at the top
const User = require('../models/User');
const { transporter, generateToken } = require('../config/email');
const { sendResetEmail } = require('../config/sendResetEmail');


// Send verification email
exports.sendVerificationEmail = async (user, req) => {
    try {
        // Generate token
        const token = crypto.randomBytes(20).toString('hex');
        user.emailVerificationToken = token;
        user.emailVerificationExpires = Date.now() + 24 * 3600000; // 24 hours

        await user.save();

        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

        // Send email using the imported transporter
        await transporter.sendMail({
            to: user.email,
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            subject: 'Email Verification',
            html: `
                <h2>Please verify your email</h2>
                <p>Click the link below to verify your email address:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't create this account, please ignore this email.</p>
            `
        });
    } catch (err) {
        console.error('Error sending verification email:', err);
        throw err; // Rethrow to handle in the route
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: Date.now() }
        });

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'Email successfully verified. You can now log in.'
        });
    } catch (err) {
        console.error(err);
    }
};

// // Resend verification email
// exports.resendVerificationEmail = async (req, res) => {
//     try {
//         const { email } = req.body;

//         // Find user by email
//         const user = await User.findOne({ email });
//         if (!user) {
//             req.flash('error', 'No account found with that email');
//             return res.redirect('/login');
//         }

//         // Check if already verified
//         if (user.isEmailVerified) {
//             req.flash('error', 'Email is already verified');
//             return res.redirect('/api/auth/login');
//         }

//         // Generate new token and update user
//         const token = crypto.randomBytes(20).toString('hex');
//         user.emailVerificationToken = token;
//         user.emailVerificationExpires = Date.now() + 24 * 3600000; // 24 hours
//         await user.save();

//         // Send verification email
//         const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

//         await transporter.sendMail({
//             to: user.email,
//             from: process.env.EMAIL_FROM,
//             subject: 'Email Verification (Resent)',
//             html: `
//                 <h2>Please verify your email</h2>
//                 <p>Click the link below to verify your email address:</p>
//                 <a href="${verificationUrl}">Verify Email</a>
//                 <p>This link will expire in 24 hours.</p>
//             `
//         });

//         req.flash('success', 'Verification email resent. Please check your inbox.');
//         res.redirect('/api/auth/login');
//     } catch (err) {
//         console.error('Error resending verification email:', err);
//         req.flash('error', 'Error resending verification email');
//         res.redirect('/api/auth/login');
//     }
// };
// authController.js
exports.resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'No account found with that email' 
            });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is already verified' 
            });
        }

        const token = crypto.randomBytes(20).toString('hex');
        user.emailVerificationToken = token;
        user.emailVerificationExpires = Date.now() + 24 * 3600000;
        await user.save();

        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

        await transporter.sendMail({
            to: user.email,
            from: process.env.EMAIL_FROM,
            subject: 'Email Verification (Resent)',
            html: `
                <h2>Please verify your email</h2>
                <p>Click the link below to verify your email address:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>This link will expire in 24 hours.</p>
            `
        });

        res.json({ 
            success: true, 
            message: 'Verification email resent. Please check your inbox.' 
        });
    } catch (err) {
        console.error('Error resending verification email:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error resending verification email' 
        });
    }
};
// authController.js

// Forgot password - returns JSON instead of rendering
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'No user found with that email address'
            });
        }

        // Generate and save reset token
        const resetToken = generateToken();
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save({ validateBeforeSave: false });

        // Create reset URL
        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        // Send email
        await sendResetEmail(user.email, resetURL);

        res.json({ 
            success: true,
            message: 'Password reset link sent to your email!'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Error processing your request. Please try again later.'
        });
    }
};

// Reset password - returns JSON instead of rendering
exports.resetPassword = async (req, res) => {
    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Token is invalid or has expired'
            });
        }

        if (req.body.password !== req.body.passwordConfirm) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully! You can now log in with your new password.'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Error resetting your password. Please try again.'
        });
    }
};