
module.exports = {
    // Middleware to check if user is logged in
    isLoggedIn: function (req, res, next) {
        console.log('REQ.USER', req.user); // Fixed missing console.log
        if (!req.isAuthenticated()) {
            req.flash('error', 'You must be signed in first!');
            return res.redirect('/api/auth/login');
        }
        next();
    },

    // Middleware to store returnTo URL in locals
    storeReturnTo: function (req, res, next) {
        if (req.session.returnTo) {
            res.locals.returnTo = req.session.returnTo;
        }
        next();
    },

    // Middleware to ensure user is authenticated and active
    ensureAuthenticated: function (req, res, next) {
        if (req.isAuthenticated()) {
            // Check if the user is deactivated
            if (req.user.isActive === false) {
                return req.logout(err => {
                    if (err) return next(err);
                    req.flash('error', 'Your account has been deactivated. Please contact the admin.');
                    return res.redirect('/api/auth/login');
                });
            }
            return next();
        }
        req.flash('error', 'Please log in to view that resource');
        res.redirect('/api/auth/login');
    },

    // Middleware to forward authenticated users away from auth pages
    forwardAuthenticated: function (req, res, next) {
        if (!req.isAuthenticated()) {
            return next();
        }
        res.redirect('/dashboard');
    },

    // Middleware to ensure company is selected
ensureCompanySelected: function (req, res, next) {
    // Debug: Log the session data
    console.log('Session data:', {
        currentCompany: req.session.currentCompany,
        currentCompanyName: req.session.currentCompanyName,
        currentFiscalYear: req.session.currentFiscalYear
    });

    if (req.session.currentCompany) {
        res.locals.currentCompanyName = req.session.currentCompanyName;
        return next();
    }
    
    // For API routes, return JSON response
    if (req.originalUrl.startsWith('/api')) {
        return res.status(400).json({ 
            success: false,
            error: 'No company selected',
            redirectTo: '/select-company'
        });
    }
    
    // For regular routes, redirect
    req.flash('error', 'Please select a company first');
    res.redirect('/select-company');
}
};