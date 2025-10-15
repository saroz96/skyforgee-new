
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
// const bcrypt = require('bcryptjs');
// const nodemailer = require('nodemailer');
// const crypto = require('crypto'); // Add this line at the top with other requires
const passport = require('passport');
const User = require('../models/User');
const { forwardAuthenticated, ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../middleware/auth');
// const Company = require('../models/Company');
// const FiscalYear = require('../models/FiscalYear');
// const ensureAdminOrSupervisor = require('../middleware/isAdminMiddleware');
// const { transporter, generateToken } = require('../config/email'); // Import from config
const authController = require('../controllers/authControllers'); // Import auth controller
const FiscalYear = require('../models/FiscalYear');
const Company = require('../models/Company');
const ensureAdminOrSupervisor = require('../middleware/isAdminMiddleware');


// Register
router.post('/register', forwardAuthenticated, async (req, res) => {
    const { name, email, password, password2 } = req.body;

    // Validation checks remain the same...
    let errors = [];
    if (!name || !email || !password || !password2) {
        errors.push({ msg: 'Please fill in all fields' });
    }
    if (password !== password2) {
        errors.push({ msg: 'Passwords do not match' });
    }
    if (password.length < 6) {
        errors.push({ msg: 'Password should be at least 6 characters' });
    }
    if (errors.length > 0) {
        return res.render('register', {
            errors,
            name,
            email,
            password,
            password2,
            theme: req.user.preferences?.theme || 'light', // Default to light if not set
        });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Email already exists');
            return res.redirect('/register');
        }

        // Create user with plain password - the pre-save hook will hash it
        const newUser = new User({
            name,
            email,
            password, // <-- No manual hashing here
            isAdmin: true,
            role: 'Admin',
            isEmailVerified: false // Add email verification status
        });

        await newUser.save();

        // Use the controller method to send verification email
        await authController.sendVerificationEmail(newUser, req);

        res.json({
            success: true,
            message: 'Registration successful! Please check your email to verify your account.'
        });

    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred during registration');
        res.redirect('/register');
    }
});

// Verify email
router.get('/verify-email/:token', authController.verifyEmail);

// Resend verification email
router.post('/resend-verification', authController.resendVerificationEmail);


// Password reset routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// Admin route to view user details by ID
router.get('/admin/users/view/:id', ensureAuthenticated, ensureCompanySelected, ensureAdminOrSupervisor, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            // Fetch the fiscal year from the database if available in the session
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // If no fiscal year is found in session or currentCompany, throw an error
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

            // Assign fiscal year ID for use
            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company.'
            });
        }

        // Ensure that only the admin or supervisor of the current company can view the users
        if (!req.user.isAdmin && req.user.role !== 'Supervisor') {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to view this page'
            });
        }

        // Fetch the user by ID
        const user = await User.findById(req.params.id).select('-password -resetPasswordToken -resetPasswordExpires');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found.'
            });
        }

        // Return the user details as JSON
        res.json({
            success: true,
            data: {
                company: {
                    renewalDate: company.renewalDate,
                    fiscalYear: company.fiscalYear,
                    dateFormat: company.dateFormat
                },
                currentFiscalYear: currentFiscalYear ? {
                    id: currentFiscalYear._id,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    name: currentFiscalYear.name,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                } : null,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive,
                    preferences: user.preferences,
                    lastLogin: user.lastLogin,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                },
                currentCompanyName: req.session.currentCompanyName,
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching user details.'
        });
    }
});

// Normal user route to view self user details by ID
router.get('/account/users/view/:id', ensureAuthenticated, ensureCompanySelected, async (req, res) => {
    try {
        // Verify the user can only view their own details
        if (req.params.id !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'You can only view your own account details'
            });
        }

        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            // Fetch the fiscal year from the database if available in the session
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // If no fiscal year is found in session or currentCompany, throw an error
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

            // Assign fiscal year ID for use
            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company.'
            });
        }

        // Fetch the user by ID (only the authenticated user's own details)
        const user = await User.findById(req.user._id).select('-password -resetPasswordToken -resetPasswordExpires');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found.'
            });
        }

        // Return the user details as JSON
        res.json({
            success: true,
            data: {
                company: {
                    renewalDate: company.renewalDate,
                    fiscalYear: company.fiscalYear,
                    dateFormat: company.dateFormat
                },
                currentFiscalYear: currentFiscalYear ? {
                    id: currentFiscalYear._id,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    name: currentFiscalYear.name,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                } : null,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive,
                    preferences: user.preferences,
                    lastLogin: user.lastLogin,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                },
                currentCompanyName: req.session.currentCompanyName
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching user details.'
        });
    }
});

//Users List
router.get('/admin/users/list', ensureAuthenticated, async (req, res) => {
    try {
        // Authorization check
        if (!req.user.isAdmin && req.user.role !== 'Supervisor') {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to view this page'
            });
        }

        // Fetch the company ID from the authenticated user's data
        const companyId = req.session.currentCompany;

        // Validate company association
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'No company is associated with your account'
            });
        }

        // Fetch company data with necessary fields
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat owner')
            .populate('fiscalYear')
            .populate('owner');

        // Handle fiscal year data
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;
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

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // Fetch users and handle ownership
        const users = await User.find({ company: companyId });

        if (company.owner) {
            const ownerExists = users.some(user => user._id.toString() === company.owner._id.toString());
            if (!ownerExists) {
                users.push({ ...company.owner.toObject(), isOwner: true });
            } else {
                users.forEach(user => {
                    if (user._id.toString() === company.owner._id.toString()) {
                        user.isOwner = true;
                    }
                });
            }
        }

        // Sort users with owner first
        users.sort((a, b) => {
            if (a.isOwner) return -1;
            if (b.isOwner) return 1;
            return 0;
        });

        // Prepare response data
        const responseData = {
            success: true,
            data: {
                company: {
                    id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    owner: company.owner ? {
                        id: company.owner._id,
                        name: company.owner.name,
                        email: company.owner.email,
                        role: company.owner.role
                    } : null
                },
                currentFiscalYear: currentFiscalYear ? {
                    id: currentFiscalYear._id,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    name: currentFiscalYear.name,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                } : null,
                users: users.map(user => ({
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive,
                    isEmailVerified: user.isEmailVerified,
                    isOwner: user.isOwner || false,
                    preferences: user.preferences,
                    lastLogin: user.lastLogin,
                    createdAt: user.createdAt
                })),
                currentCompanyName: req.session.currentCompanyName,
                currentUser: {
                    id: req.user._id,
                    name: req.user.name,
                    role: req.user.role,
                    isAdmin: req.user.isAdmin,
                    theme: req.user.preferences?.theme || 'light'
                },
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        };

        res.json(responseData);

    } catch (err) {
        console.error('Error in users list route:', err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching users'
        });
    }
});

router.get('/admin/create-user/new', isLoggedIn, ensureAdminOrSupervisor, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;

        // Validate company ID
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'No company is associated with your account'
            });
        }

        // Fetch company data
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat')
            .populate('fiscalYear');

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // Handle fiscal year data
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;
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

        // Prepare response data
        const responseData = {
            success: true,
            data: {
                company: {
                    id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    fiscalYear: company.fiscalYear ? {
                        id: company.fiscalYear._id,
                        name: company.fiscalYear.name,
                        startDate: company.fiscalYear.startDate,
                        endDate: company.fiscalYear.endDate,
                        isActive: company.fiscalYear.isActive
                    } : null
                },
                currentFiscalYear: currentFiscalYear ? {
                    id: currentFiscalYear._id,
                    name: currentFiscalYear.name,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                } : null,
                currentCompanyName: req.session.currentCompanyName,
                currentUser: {
                    id: req.user._id,
                    name: req.user.name,
                    role: req.user.role,
                    isAdmin: req.user.isAdmin,
                    theme: req.user.preferences?.theme || 'light'
                },
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        };

        res.json(responseData);

    } catch (err) {
        console.error('Error in create user route:', err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while loading user creation form'
        });
    }
});

router.post('/admin/create-user/new', ensureAdminOrSupervisor, async (req, res) => {
    const { name, email, password, password2, role } = req.body;

    try {
        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear?.id;
        const userId = req.user._id;
        const errors = [];

        // Validation
        if (!name || !email || !password || !password2) {
            errors.push({ field: 'general', msg: 'Please enter all fields' });
        }

        if (password !== password2) {
            errors.push({ field: 'password2', msg: 'Passwords do not match' });
        }

        if (password.length < 5) {
            errors.push({ field: 'password', msg: 'Password must be at least 5 characters' });
        }

        if (!companyId) {
            errors.push({ field: 'general', msg: 'No company associated with your session' });
        }

        // Check if the role is valid
        const validRoles = ['Admin', 'Sales', 'Purchase', 'Supervisor', 'User'];
        if (!validRoles.includes(role)) {
            errors.push({ field: 'role', msg: 'Invalid role' });
        }

        // Check if user exists
        if (email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                errors.push({ field: 'email', msg: 'User with this email already exists' });
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors: errors,
                formData: { name, email, role }
            });
        }

        // Create new user
        const newUser = new User({
            name,
            email,
            password, // Will be hashed by pre-save hook
            role,
            company: companyId,
            createdBy: userId,
            fiscalYear: currentFiscalYear
        });

        await newUser.save();

        res.status(201).json({
            success: true,
            message: `User ${name} created successfully with role ${role}`,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while creating the user',
            message: err.message
        });
    }
});

router.get('/users/view/:id', ensureAuthenticated, ensureCompanySelected, async (req, res) => {
    try {
        // Authorization check
        if (!req.user.isAdmin && req.user.role !== 'Supervisor') {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to view this page'
            });
        }

        // Fetch company ID from session
        const companyId = req.session.currentCompany;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'No company is associated with your account'
            });
        }

        // Fetch company data
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat owner')
            .populate('fiscalYear')
            .populate('owner');

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // Handle fiscal year data
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;
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

        // Fetch user details
        const userById = await User.findById(req.params.id)
            .populate('company', 'name')
            .populate('fiscalYear', 'name');

        if (!userById) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Prepare response data
        const responseData = {
            success: true,
            data: {
                user: {
                    id: userById._id,
                    name: userById.name,
                    email: userById.email,
                    role: userById.role,
                    isActive: userById.isActive,
                    isAdmin: userById.isAdmin,
                    createdAt: userById.createdAt,
                    lastLogin: userById.lastLogin,
                    company: userById.company ? {
                        id: userById.company._id,
                        name: userById.company.name
                    } : null,
                    fiscalYear: userById.fiscalYear ? {
                        id: userById.fiscalYear._id,
                        name: userById.fiscalYear.name
                    } : null
                },
                company: {
                    id: company._id,
                    name: company.name,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    owner: company.owner ? {
                        id: company.owner._id,
                        name: company.owner.name
                    } : null
                },
                currentFiscalYear: currentFiscalYear ? {
                    id: currentFiscalYear._id,
                    name: currentFiscalYear.name,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                } : null,
                currentCompanyName: req.session.currentCompanyName,
                currentUser: {
                    id: req.user._id,
                    name: req.user.name,
                    role: req.user.role,
                    isAdmin: req.user.isAdmin,
                    theme: req.user.preferences?.theme || 'light'
                },
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        };

        res.json(responseData);

    } catch (err) {
        console.error('Error in user view route:', err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching user details'
        });
    }
});

// Route to deactivate a user
router.post('/admin/users/:id/deactivate', ensureAuthenticated, async (req, res) => {
    try {
        // Check if user has admin privileges
        if (!req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Only admins can deactivate users'
            });
        }

        const userId = req.params.id;

        // Find the user and set isActive to false
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { isActive: false },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'User deactivated successfully',
            user: updatedUser
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Error deactivating user',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Route to activate a user
router.post('/admin/users/:id/activate', ensureAuthenticated, async (req, res) => {
    try {
        // Check if user has admin privileges
        if (!req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Only admins can activate users'
            });
        }

        const userId = req.params.id;

        // Find the user and set isActive to true
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { isActive: true },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'User activated successfully',
            user: updatedUser
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Error activating user',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Admin route to change user role
router.post('/admin/users/:id/role', ensureAuthenticated, async (req, res) => {
    try {
        // Only admin can change the role
        if (!req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to change user roles.'
            });
        }

        const userId = req.params.id;
        const newRole = req.body.role;

        // Validate the role to prevent invalid role assignments
        const validRoles = ['Account', 'Sales', 'Purchase', 'Supervisor', 'ADMINISTRATOR', 'User'];
        if (!validRoles.includes(newRole)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role.',
                validRoles: validRoles // Optionally include valid roles in response
            });
        }

        // Update the user's role
        const user = await User.findByIdAndUpdate(
            userId,
            { role: newRole },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        res.json({
            success: true,
            message: `Role of ${user.name} has been updated to ${newRole}.`,
            user: user
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating the user role.',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// // Updated login route (server-side)
// router.post('/login', forwardAuthenticated, (req, res, next) => {
//     passport.authenticate('local', (err, user, info) => {
//         if (err) {
//             console.error('Login error:', err);
//             return res.status(500).json({
//                 success: false,
//                 message: 'An error occurred during authentication'
//             });
//         }

//         if (!user) {
//             return res.status(401).json({
//                 success: false,
//                 message: info.message || 'Invalid email or password'
//             });
//         }

//         // Check email verification
//         if (!user.isEmailVerified) {
//             return res.status(401).json({
//                 success: false,
//                 requiresEmailVerification: true,
//                 message: 'Please verify your email before logging in',
//                 email: user.email
//             });
//         }

//         req.logIn(user, (err) => {
//             if (err) {
//                 console.error('Session error:', err);
//                 return res.status(500).json({
//                     success: false,
//                     message: 'Session error'
//                 });
//             }

//             // Update last login
//             User.findByIdAndUpdate(user._id, { lastLogin: Date.now() })
//                 .catch(err => console.error('Error updating last login:', err));

//             // Return user data without token (since we're using sessions)
//             return res.json({
//                 success: true,
//                 user: {
//                     id: user._id,
//                     name: user.name,
//                     email: user.email,
//                     role: user.role
//                 }
//             });
//         });
//     })(req, res, next);
// });

router.post('/login', forwardAuthenticated, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({
                success: false,
                message: 'An error occurred during authentication'
            });
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password' // Consistent message
            });
        }

        // Check email verification
        if (!user.isEmailVerified) {
            return res.status(401).json({
                success: false,
                requiresEmailVerification: true,
                message: 'Please verify your email before logging in',
                email: user.email
            });
        }

        req.logIn(user, (err) => {
            if (err) {
                console.error('Session error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Session error'
                });
            }

            // Update last login
            User.findByIdAndUpdate(user._id, { lastLogin: Date.now() })
                .catch(err => console.error('Error updating last login:', err));

            return res.json({
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        });
    })(req, res, next);
});

// Route to display the change password form
router.get('/user/change-password', ensureAuthenticated, ensureCompanySelected, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            // Fetch the fiscal year from the database if available in the session
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // If no fiscal year is found in session or currentCompany, use company's fiscal year
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

            // Assign fiscal year ID for use
            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company.'
            });
        }

        // Prepare response data
        const responseData = {
            success: true,
            data: {
                company: {
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    fiscalYear: company.fiscalYear
                },
                currentFiscalYear: currentFiscalYear,
                currentCompanyName: req.session.currentCompanyName,
                user: {
                    id: req.user._id,
                    name: req.user.name,
                    email: req.user.email,
                    role: req.user.role,
                    isAdmin: req.user.isAdmin,
                    preferences: req.user.preferences
                },
                theme: req.user.preferences?.theme || 'light',
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error in change password route:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while processing your request'
        });
    }
});

// Route to handle password change form submission
router.post('/user/change-password', ensureAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;

        // Validate required fields
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required'
            });
        }

        // Find the user from the session
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if current password matches
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Check if new password and confirm new password match
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({
                success: false,
                error: 'New passwords do not match'
            });
        }

        // Validate password strength (optional - add your requirements)
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters long'
            });
        }

        // Update the user's password
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (err) {
        console.error('Error changing password:', err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while changing the password'
        });
    }
});


// Get specific user's permissions
router.get('/admin/users/user-permissions/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, async (req, res) => {
    try {

        // Validate the ID parameter
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID format'
            });
        }

        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            // Fetch the fiscal year from the database if available in the session
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // If no fiscal year is found in session or currentCompany, throw an error
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

            // Assign fiscal year ID for use
            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({ error: 'No fiscal year found in session or company.' });
        }

        const user = await User.findById(req.params.id)
            .select('name email role menuPermissions');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Convert Map to plain object for frontend
        const permissions = Object.fromEntries(user.menuPermissions);

        // Return JSON response for React
        res.json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                permissions,
                company: {
                    renewalDate: company.renewalDate,
                    fiscalYear: company.fiscalYear,
                    dateFormat: company.dateFormat
                },
                currentFiscalYear: currentFiscalYear ? {
                    id: currentFiscalYear._id,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    name: currentFiscalYear.name,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                } : null,
                currentCompanyName: req.session.currentCompanyName,
                theme: req.user.preferences?.theme || 'light',
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Update user permissions
router.put('/admin/users/user-permissions/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, async (req, res) => {
    try {
        const { permissions } = req.body;

        // Validate permissions object
        if (!permissions || typeof permissions !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid permissions format',
                details: 'Permissions must be a valid object'
            });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                details: `No user found with ID: ${req.params.id}`
            });
        }

        // Update each permission
        for (const [menu, hasAccess] of Object.entries(permissions)) {
            user.menuPermissions.set(menu, hasAccess);
        }

        // Record who made the change and when
        user.grantedBy = req.user._id;
        user.lastPermissionUpdate = new Date();

        await user.save();

        res.json({
            success: true,
            data: {
                message: 'Permissions updated successfully',
                userId: user._id,
                updatedBy: req.user._id,
                updateTimestamp: user.lastPermissionUpdate,
                permissions: Object.fromEntries(user.menuPermissions)
            },
            metadata: {
                updatedFields: Object.keys(permissions),
                totalPermissionsUpdated: Object.keys(permissions).length
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: 'Failed to update user permissions',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({
                success: false,
                message: 'Error during logout'
            });
        }

        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error destroying session'
                });
            }

            // Clear the session cookie
            res.clearCookie('connect.sid'); // or your session cookie name

            return res.json({
                success: true,
                message: 'Logged out successfully'
            });
        });
    });
});


router.get('/me', ensureAuthenticated, async (req, res) => {
    try {
        // Include name in the select, only exclude sensitive fields
        const user = await User.findById(req.user.id)
            .select('-password -__v');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Convert the Map to an array for JSON serialization
        const permissionsArray = user.menuPermissions
            ? Array.from(user.menuPermissions.entries())
            : [];

        res.json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isAdmin: user.isAdmin,
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor',
                menuPermissions: permissionsArray,
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});



module.exports = router;