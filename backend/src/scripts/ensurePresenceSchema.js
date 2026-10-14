const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

async function ensurePresenceSchema() {
    const columns = await sequelize.query('SHOW COLUMNS FROM users', { type: QueryTypes.SELECT });
    if (!columns.some((column) => column.Field === 'last_seen_at')) {
        await sequelize.query('ALTER TABLE users ADD COLUMN last_seen_at DATETIME(3) NULL');
    }
}

if (require.main === module) {
    ensurePresenceSchema()
        .then(() => console.log('Presence schema migration completed safely.'))
        .catch((error) => {
            console.error(`Presence schema migration failed: ${error.message}`);
            process.exitCode = 1;
        })
        .finally(() => sequelize.close());
}

module.exports = ensurePresenceSchema;