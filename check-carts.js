const db = require('./config/database');

async function checkSchema() {
    try {
        const [rows] = await db.execute('DESCRIBE carts');
        console.log('COLUMNS_START');
        console.log(JSON.stringify(rows, null, 2));
        console.log('COLUMNS_END');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkSchema();
