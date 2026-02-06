const db = require('../config/database');

async function inspectTable() {
    try {
        console.log('Inspecting sellers table...');
        const [rows] = await db.execute('DESCRIBE sellers');
        console.log('Columns in sellers table:', rows.map(r => r.Field));
        process.exit(0);
    } catch (error) {
        console.error('Error describing table:', error);
        process.exit(1);
    }
}

inspectTable();
