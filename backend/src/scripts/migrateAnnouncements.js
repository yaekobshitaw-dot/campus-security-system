const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');

const TARGET_TABLES = ['announcements', 'announcement_audiences', 'announcement_reads'];
const RECOVERY_CONFIRM = 'DB_MIGRATION_RECOVERY_CONFIRM';
const EXPECTED_ANNOUNCEMENT_COLUMNS = [
  'announcement_id',
  'title',
  'content',
  'priority',
  'status',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
  'published_at',
  'expires_at',
  'deleted_at'
];
const EXPECTED_ANNOUNCEMENT_INDEXES = [
  'created_by',
  'updated_by',
  'idx_announcements_visibility',
  'idx_announcements_created_at'
];
const EXPECTED_TARGET = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3307',
  DB_NAME: 'campus_security'
};

const validateMigrationEnvironment = () => {
  for (const [name, expected] of Object.entries(EXPECTED_TARGET)) {
    if (process.env[name] !== expected) {
      throw new Error(`Announcement migration refused: ${name} must be ${expected}`);
    }
  }
  if (process.env.DB_MIGRATION_CONFIRM !== 'true') {
    throw new Error('Announcement migration refused: DB_MIGRATION_CONFIRM=true is required');
  }
  if (!process.env.DB_USER) {
    throw new Error('Announcement migration refused: DB_USER is required');
  }
};

const uuidColumn = (allowNull = false, withDefault = false) => ({
  type: DataTypes.UUID,
  allowNull,
  ...(withDefault ? { defaultValue: DataTypes.UUIDV4 } : {})
});

const getExistingTargetTables = async (queryInterface) => {
  const existingTables = new Set((await queryInterface.showAllTables()).map((table) => String(table).toLowerCase()));
  return TARGET_TABLES.filter((table) => existingTables.has(table));
};

const assertKnownPartialAnnouncements = async (queryInterface, transaction) => {
  const existingTables = await getExistingTargetTables(queryInterface);
  const isKnownPartialState = existingTables.length === 1 && existingTables[0] === 'announcements';
  if (!isKnownPartialState) {
    throw new Error(`Announcement migration refused: unexpected target table state: ${existingTables.join(', ') || 'none'}`);
  }

  const [[{ row_count: rowCount }]] = await sequelize.query(
    'SELECT COUNT(*) AS row_count FROM `announcements`',
    { transaction }
  );
  if (Number(rowCount) !== 0) {
    throw new Error('Announcement migration refused: announcements is not empty');
  }

  const [metadata] = await sequelize.query(
    "SELECT TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'campus_security' AND TABLE_NAME = 'announcements'",
    { transaction }
  );
  if (metadata[0]?.TABLE_COLLATION !== 'utf8mb4_bin') {
    throw new Error('Announcement migration refused: announcements does not have the expected utf8mb4_bin collation');
  }

  const users = await queryInterface.describeTable('users');
  if (!users.user_id) {
    throw new Error('Announcement migration refused: users.user_id does not exist');
  }
  const announcementColumns = await queryInterface.describeTable('announcements');
  const missingColumns = EXPECTED_ANNOUNCEMENT_COLUMNS.filter((column) => !announcementColumns[column]);
  if (missingColumns.length) {
    throw new Error(`Announcement migration refused: announcements is missing expected column(s): ${missingColumns.join(', ')}`);
  }

  const [primaryKey] = await sequelize.query(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'campus_security' AND TABLE_NAME = 'announcements' AND INDEX_NAME = 'PRIMARY'",
    { transaction }
  );
  if (primaryKey.length) {
    throw new Error('Announcement migration refused: announcements already has a primary key');
  }

  const [indexes] = await sequelize.query(
    "SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'campus_security' AND TABLE_NAME = 'announcements'",
    { transaction }
  );
  const actualIndexes = new Set(indexes.map(({ INDEX_NAME }) => INDEX_NAME));
  const missingIndexes = EXPECTED_ANNOUNCEMENT_INDEXES.filter((index) => !actualIndexes.has(index));
  if (missingIndexes.length) {
    throw new Error(`Announcement migration refused: announcements is missing expected index(es): ${missingIndexes.join(', ')}`);
  }

  const [foreignKeys] = await sequelize.query(
    "SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE CONSTRAINT_SCHEMA = 'campus_security' AND TABLE_NAME = 'announcements' AND REFERENCED_TABLE_NAME IS NOT NULL",
    { transaction }
  );
  const actualForeignKeys = new Set(foreignKeys.map(({ COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME }) => `${COLUMN_NAME}->${REFERENCED_TABLE_NAME}.${REFERENCED_COLUMN_NAME}`));
  for (const expectedForeignKey of ['created_by->users.user_id', 'updated_by->users.user_id']) {
    if (!actualForeignKeys.has(expectedForeignKey)) {
      throw new Error(`Announcement migration refused: announcements is missing expected foreign key ${expectedForeignKey}`);
    }
  }

  if (process.env[RECOVERY_CONFIRM] !== 'true') {
    throw new Error(`Announcement migration refused: known empty partial announcements table detected; set ${RECOVERY_CONFIRM}=true to recover`);
  }

  console.warn('Recovering the verified empty partial announcements table created by the failed announcement migration.');
  await queryInterface.dropTable('announcements', { transaction });
};

const prepareAnnouncementTables = async (queryInterface, transaction) => {
  const existingTables = await getExistingTargetTables(queryInterface);
  if (existingTables.length === TARGET_TABLES.length) {
    console.log('Announcement tables already exist; no changes required.');
    return false;
  }
  if (existingTables.length === 0) return true;

  await assertKnownPartialAnnouncements(queryInterface, transaction);
  return true;
};

const createAnnouncements = async () => {
  validateMigrationEnvironment();
  const queryInterface = sequelize.getQueryInterface();

  await sequelize.transaction(async (transaction) => {
    const shouldCreateTables = await prepareAnnouncementTables(queryInterface, transaction);
    if (!shouldCreateTables) return;

    await queryInterface.createTable('announcements', {
      announcement_id: {
        ...uuidColumn(false, true),
        primaryKey: true
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium'
      },
      status: {
        type: DataTypes.ENUM('draft', 'published', 'unpublished'),
        allowNull: false,
        defaultValue: 'draft'
      },
      created_by: {
        ...uuidColumn(),
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      updated_by: {
        ...uuidColumn(),
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      published_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      transaction,
      charset: 'utf8mb4',
      collate: 'utf8mb4_bin'
    });

    await queryInterface.addIndex('announcements', ['status', 'deleted_at', 'expires_at'], {
      name: 'idx_announcements_visibility',
      transaction
    });
    await queryInterface.addIndex('announcements', ['created_at'], {
      name: 'idx_announcements_created_at',
      transaction
    });

    await queryInterface.createTable('announcement_audiences', {
      announcement_audience_id: uuidColumn(false, true),
      announcement_id: {
        ...uuidColumn(),
        references: { model: 'announcements', key: 'announcement_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      role: {
        type: DataTypes.ENUM('student', 'faculty', 'staff', 'security', 'admin'),
        allowNull: false
      }
    }, {
      transaction,
      charset: 'utf8mb4',
      collate: 'utf8mb4_bin'
    });

    await queryInterface.addIndex('announcement_audiences', ['announcement_id', 'role'], {
      name: 'uq_announcement_audiences_announcement_role',
      unique: true,
      transaction
    });

    await queryInterface.createTable('announcement_reads', {
      announcement_read_id: uuidColumn(false, true),
      announcement_id: {
        ...uuidColumn(),
        references: { model: 'announcements', key: 'announcement_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        ...uuidColumn(),
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    }, {
      transaction,
      charset: 'utf8mb4',
      collate: 'utf8mb4_bin'
    });

    await queryInterface.addIndex('announcement_reads', ['announcement_id', 'user_id'], {
      name: 'uq_announcement_reads_announcement_user',
      unique: true,
      transaction
    });
    await queryInterface.addIndex('announcement_reads', ['user_id'], {
      name: 'idx_announcement_reads_user',
      transaction
    });
  });
};

createAnnouncements()
  .then(async () => {
    console.log('Announcement tables created successfully.');
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(`Announcement migration failed: ${error.message}`);
    await sequelize.close();
    process.exitCode = 1;
  });
