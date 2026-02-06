exports.isCustomer = (req, res, next) => {
    if (req.user.user_type !== 'customer') {
        return res.status(403).render('errors/403', {
            message: 'Access denied. Customer account required.'
        });
    }
    next();
};

exports.isSeller = (req, res, next) => {
    if (req.user.user_type !== 'seller') {
        return res.status(403).render('errors/403', {
            message: 'Access denied. Seller account required.'
        });
    }
    next();
};

exports.isRider = (req, res, next) => {
    if (req.user.user_type !== 'rider') {
        return res.status(403).render('errors/403', {
            message: 'Access denied. Rider account required.'
        });
    }
    next();
};

exports.isAdmin = (req, res, next) => {
    if (req.user.user_type !== 'admin') {
        return res.status(403).render('errors/403', {
            message: 'Access denied. Admin privileges required.'
        });
    }
    next();
};
