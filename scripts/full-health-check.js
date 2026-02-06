const axios = require('axios');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

const routes = [
    // Public Routes
    { path: '/', method: 'GET', expectedStatus: 200, description: 'Home Page' },
    { path: '/auth/login', method: 'GET', expectedStatus: 200, description: 'Login Page' },
    { path: '/auth/register', method: 'GET', expectedStatus: 200, description: 'Register Page' },

    // Protected Routes (Expect redirect or behavior depending on auth state, 
    // but here we expect them to be reachable. Since we aren't logging in, 
    // they might redirect (302) or return 401/403. Let's accept 200, 302, 401, 403)
    { path: '/customer/dashboard', method: 'GET', expectedStatus: [200, 302, 401, 403], description: 'Customer Dashboard (Prot)' },
    { path: '/customer/stores', method: 'GET', expectedStatus: [200, 302, 401, 403], description: 'Stores List (Prot)' },

    // API Routes
    // Note: /api/track likely needs parameters, so it might 400 or 404, but as long as it responds, the server is up.
    { path: '/api/track', method: 'GET', expectedStatus: [200, 400, 404], description: 'API Track Endpoint' }
];

async function checkHealth() {
    console.log(`Starting Health Check on ${BASE_URL}...\n`);
    let passCount = 0;
    let failCount = 0;

    for (const route of routes) {
        try {
            const url = `${BASE_URL}${route.path}`;
            const response = await axios({
                method: route.method,
                url: url,
                validateStatus: () => true, // Don't throw on error status
                maxRedirects: 0 // Don't follow redirects automatically so we can check for 302
            });

            const status = response.status;
            let passed = false;

            if (Array.isArray(route.expectedStatus)) {
                passed = route.expectedStatus.includes(status);
            } else {
                passed = status === route.expectedStatus;
            }

            if (passed) {
                console.log(`[PASS] ${route.description} (${route.path}) - Status: ${status}`);
                passCount++;
            } else {
                console.error(`[FAIL] ${route.description} (${route.path}) - Expected: ${route.expectedStatus}, Got: ${status}`);
                failCount++;
            }

        } catch (error) {
            console.error(`[ERR ] ${route.description} (${route.path}) - Connection Failed: ${error.message}`);
            failCount++;
        }
    }

    console.log(`\nHealth Check Complete.`);
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${failCount}`);

    if (failCount > 0) {
        console.error('\nResult: FAILED');
        process.exit(1);
    } else {
        console.log('\nResult: SUCCESS');
        process.exit(0);
    }
}

// Wait for a moment to ensure server adds might be up if running concurrently (manual run assumption)
checkHealth();
