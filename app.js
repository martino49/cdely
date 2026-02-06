const express = require('express');
const session = require('express-session');
// const mysql = require('mysql2/promise'); // Already handled in db config
const path = require('path');
const http = require('http'); // Required for socket.io
require('dotenv').config();

const app = express();
const server = http.createServer(app); // Create HTTP server

// Database connection
const db = require('./config/database');
const socketConfig = require('./config/socket'); // Import socket config

// Initialize Socket.io
const io = socketConfig.init(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Global locals middleware
app.use((req, res, next) => {
    if (req.user) {
        res.locals.user = req.user;
    } else if (req.session && req.session.userId) {
        res.locals.user = {
            id: req.session.userId,
            user_type: req.session.userType || 'customer',
            full_name: req.session.userName || 'User' // Using userName from session as full_name for locals
        };
    } else {
        res.locals.user = null;
    }
    res.locals.cartCount = req.session.cartCount || 0;
    res.locals.title = 'QuickDeliver';
    next();
});

// Mock User Middleware for development (remove in prod)
// This strictly sets req.user for testing purposes as user might not have full auth flow ready
// But since I implemented auth middleware, I should probably rely on that. 
// However, to make "Customer Dashboard" work immediately as requested by user's flow often implying easy access...
// I will stick to standard auth flow but ensure passport is initialized if I were using it. 
// The user's code snippet for app.js didn't include passport! 
// But my scaffolding did. I should be careful. 
// The user's snippet uses `req.session.userId` in `auth.middleware.js`.
// So I will stick to the user's `app.js` snippet logic but add `require('./middleware/auth.middleware')` usage where appropriate implicitly via routes.
// User's app.js snippet:
/*
// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth.routes'));
app.use('/customer', require('./routes/customer.routes'));
...
// Error handling
app.use(require('./middleware/error.middleware'));
*/

// Let's stick closely to the user's snippet but add the flash/locals stuff I had before if needed, 
// or just strictly what they gave. They gave a very specific app.js. I will use that + the server/socket stuff I know is needed.

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth.routes'));
app.use('/customer', require('./routes/customer.routes'));
app.use('/seller', require('./routes/seller.routes'));
app.use('/rider', require('./routes/rider.routes'));
app.use('/admin', require('./routes/admin.routes'));
app.use('/api', require('./routes/api.routes'));

// Error handling (User asked for this file but didn't provide code for it, so I'll create a simple placeholder or use inline)
// app.use(require('./middleware/error.middleware')); // I'll assume I need to create this first or comment it out if not provided.
// The user list included error.middleware.js in the tree but no code block. I'll create a basic one.

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('errors/500', { error: err.message });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
