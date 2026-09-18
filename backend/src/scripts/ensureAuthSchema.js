const { sequelize } = require('../models');

async function ensureAuthSchema() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS user_identities (
      identity_id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
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
      user_id CHAR(36) NOT NULL,
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