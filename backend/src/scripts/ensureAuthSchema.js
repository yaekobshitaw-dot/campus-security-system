const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

async function ensureAuthSchema() {
    const userColumns = await sequelize.query('SHOW COLUMNS FROM users');
    const existingUserColumns = new Set(userColumns[0].map((column) => column.Field));
    if (!existingUserColumns.has('mfa_enabled')) {
        await sequelize.query('ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE');
    }
    if (!existingUserColumns.has('mfa_secret_hash')) {
        await sequelize.query('ALTER TABLE users ADD COLUMN mfa_secret_hash VARCHAR(128) NULL');
    }
    if (!existingUserColumns.has('mfa_recovery_codes_hash')) {
        await sequelize.query('ALTER TABLE users ADD COLUMN mfa_recovery_codes_hash JSON NULL');
    }

    const auditColumns = await sequelize.query('SHOW COLUMNS FROM audit_logs');
    const existingAuditColumns = new Set(auditColumns[0].map((column) => column.Field));
    if (!existingAuditColumns.has('user_agent')) {
        await sequelize.query('ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(512) NULL');
    }
    if (!existingAuditColumns.has('success')) {
        await sequelize.query('ALTER TABLE audit_logs ADD COLUMN success BOOLEAN NOT NULL DEFAULT TRUE');
    }
    if (!existingAuditColumns.has('metadata')) {
        await sequelize.query('ALTER TABLE audit_logs ADD COLUMN metadata JSON NULL');
    }

    await sequelize.query(`
    CREATE TABLE IF NOT EXISTS security_sessions (
      session_id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL COLLATE utf8mb4_bin,
      refresh_token_hash CHAR(64) NOT NULL UNIQUE,
      device_label VARCHAR(255) NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_security_sessions_user (user_id, revoked_at, expires_at),
      CONSTRAINT fk_security_sessions_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

    await sequelize.query(`
    CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
      recovery_code_id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL COLLATE utf8mb4_bin,
      code_hash CHAR(64) NOT NULL,
      consumed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_mfa_recovery_user_code (user_id, code_hash),
      KEY idx_mfa_recovery_active (user_id, code_hash, consumed_at),
      CONSTRAINT fk_mfa_recovery_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

    const usersWithRecoveryCodes = await sequelize.query(
        'SELECT user_id, mfa_recovery_codes_hash FROM users WHERE mfa_recovery_codes_hash IS NOT NULL', { type: QueryTypes.SELECT }
    );
    for (const user of usersWithRecoveryCodes) {
        let recoveryCodeHashes;
        try {
            recoveryCodeHashes = Array.isArray(user.mfa_recovery_codes_hash) ?
                user.mfa_recovery_codes_hash :
                JSON.parse(user.mfa_recovery_codes_hash);
        } catch {
            recoveryCodeHashes = [];
        }
        for (const codeHash of recoveryCodeHashes || []) {
            if (typeof codeHash !== 'string' || !/^[a-f0-9]{64}$/i.test(codeHash)) continue;
            await sequelize.query(
                'INSERT IGNORE INTO mfa_recovery_codes (recovery_code_id, user_id, code_hash) VALUES (UUID(), ?, ?)', { replacements: [user.user_id, codeHash] }
            );
        }
    }

    await sequelize.query(`
    CREATE TABLE IF NOT EXISTS user_identities (
      identity_id CHAR(36) NOT NULL PRIMARY KEY,
          user_id CHAR(36) NOT NULL COLLATE utf8mb4_bin,
      provider VARCHAR(32) NOT NULL,
      provider_subject VARCHAR(255) NOT NULL,
      provider_email VARCHAR(255) NULL,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_identity_provider_subject (provider, provider_subject),
      UNIQUE KEY uq_user_identity_user_provider (user_id, provider),
      CONSTRAINT fk_user_identities_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

    await sequelize.query(`
    CREATE TABLE IF NOT EXISTS oauth_login_tickets (
      ticket_id CHAR(36) NOT NULL PRIMARY KEY,
      ticket_hash CHAR(64) NOT NULL UNIQUE,
          user_id CHAR(36) NOT NULL COLLATE utf8mb4_bin,
      expires_at DATETIME NOT NULL,
      consumed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_oauth_login_tickets_lookup (ticket_hash, expires_at, consumed_at),
      CONSTRAINT fk_oauth_login_tickets_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
}

module.exports = ensureAuthSchema;