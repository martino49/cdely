const db = require('./config/database');

async function checkAddressSchema() {
    try {
        const [rows] = await db.execute('DESCRIBE user_addresses');
        console.log('COLUMNS_START');
        console.log(JSON.stringify(rows, null, 2));
        console.log('COLUMNS_END');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkAddressSchema();
