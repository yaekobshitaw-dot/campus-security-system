require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const { logger } = require('../utils/logger');

const TABLE_NAME = 'campus_locations';
const CANONICAL_INDEX_NAME = 'uq_campus_locations_name';
const REQUIRED_DATABASE = 'campus_security';

const quoteIdentifier = (identifier) => `\`${String(identifier).replace(/`/g, '``')}\``;
const indexColumns = (index) => (index.fields || []).map((field) => field.attribute || field.name);
const isNameUniqueIndex = (index) => index.unique === true
  && index.primary !== true
  && indexColumns(index).length === 1
  && indexColumns(index)[0] === 'name';

const getIndexes = async () => sequelize.getQueryInterface().showIndex(TABLE_NAME);
const ensureExpectedPrimaryKey = async (indexes) => {
  const primaryKeys = indexes.filter((index) => index.primary === true);
  if (primaryKeys.length !== 1 || indexColumns(primaryKeys[0]).join(',') !== 'location_id') {
    throw new Error('Expected the existing PRIMARY KEY on location_id; refusing to modify indexes.');
  }
};

const logDatabaseIndexState = async (label) => {
  const createTable = await sequelize.query(`SHOW CREATE TABLE ${quoteIdentifier(TABLE_NAME)}`, {
    type: QueryTypes.SELECT
  });
  const statistics = await sequelize.query(
    `SELECT TABLE_NAME, COUNT(*) AS key_count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName
     GROUP BY TABLE_NAME`,
    { replacements: { tableName: TABLE_NAME }, type: QueryTypes.SELECT }
  );
  logger.info(`${label} SHOW CREATE TABLE ${TABLE_NAME}: ${createTable[0]?.['Create Table'] || '(unavailable)'}`);
  logger.info(`${label} index count: ${statistics[0]?.key_count ?? 0}`);
};

const validateRepairTarget = async () => {
  if (process.env.CAMPUS_LOCATION_INDEX_REPAIR_CONFIRM !== 'true') {
    throw new Error('Set CAMPUS_LOCATION_INDEX_REPAIR_CONFIRM=true to approve this targeted repair.');
  }
  if (process.env.DB_NAME !== REQUIRED_DATABASE) {
    throw new Error(`Refusing repair: DB_NAME must be ${REQUIRED_DATABASE}.`);
  }
  const [rows] = await sequelize.query('SELECT DATABASE() AS database_name', { type: QueryTypes.SELECT });
  if (rows.database_name !== REQUIRED_DATABASE) {
    throw new Error(`Refusing repair: connected database is ${rows.database_name || 'unknown'}.`);
  }
  await logDatabaseIndexState('Before repair');
};

async function repairCampusLocationIndexes() {
  try {
    await validateRepairTarget();
    const queryInterface = sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable(TABLE_NAME);
    if (!columns.location_id || !columns.name) {
      throw new Error(`${TABLE_NAME} must already exist with location_id and name columns; no table will be created.`);
    }

    const indexes = await getIndexes();
    await ensureExpectedPrimaryKey(indexes);
    const nameIndexes = indexes.filter(isNameUniqueIndex);
    const canonicalNameIndex = indexes.find((index) => index.name === CANONICAL_INDEX_NAME);
    if (canonicalNameIndex && !isNameUniqueIndex(canonicalNameIndex)) {
      throw new Error(`Index ${CANONICAL_INDEX_NAME} exists but is not a unique index on name.`);
    }

    logger.info(`Existing ${TABLE_NAME} indexes: ${JSON.stringify(indexes.map((index) => ({
      name: index.name,
      unique: index.unique,
      primary: index.primary === true,
      columns: indexColumns(index)
    })))}`);
    logger.info(`Exact redundant-index candidates (unique on name only): ${nameIndexes.map((index) => index.name).join(', ') || '(none)'}`);

    if (canonicalNameIndex && nameIndexes.length === 1) {
      logger.info(`${TABLE_NAME} is already repaired; no index changes required.`);
      await logDatabaseIndexState('After repair');
      return;
    }

    if (!nameIndexes.length) {
      await queryInterface.addIndex(TABLE_NAME, ['name'], {
        name: CANONICAL_INDEX_NAME,
        unique: true
      });
      logger.info(`Added ${CANONICAL_INDEX_NAME}; no existing unique name index was present.`);
    } else if (!canonicalNameIndex) {
      const retainedIndex = nameIndexes[0];
      for (const redundantIndex of nameIndexes.slice(1)) {
        const currentIndexes = await getIndexes();
        await ensureExpectedPrimaryKey(currentIndexes);
        const currentCandidate = currentIndexes.find((index) => index.name === redundantIndex.name);
        const currentNameIndexes = currentIndexes.filter(isNameUniqueIndex);
        if (!currentCandidate || !isNameUniqueIndex(currentCandidate) || currentNameIndexes.length < 2) {
          throw new Error(`Refusing to drop ${redundantIndex.name}: its current index definition or a remaining name constraint could not be verified.`);
        }
        logger.info(`Dropping verified redundant UNIQUE(name) index ${redundantIndex.name}.`);
        await sequelize.query(
          `ALTER TABLE ${quoteIdentifier(TABLE_NAME)} DROP INDEX ${quoteIdentifier(redundantIndex.name)}`
        );
      }

      const beforeReplacement = await getIndexes();
      await ensureExpectedPrimaryKey(beforeReplacement);
      const retainedStillExists = beforeReplacement.find((index) => index.name === retainedIndex.name);
      if (!retainedStillExists || !isNameUniqueIndex(retainedStillExists)) {
        throw new Error(`Refusing to replace ${retainedIndex.name}: it is no longer the verified UNIQUE(name) index.`);
      }
      if (beforeReplacement.some((index) => index.name === CANONICAL_INDEX_NAME)) {
        throw new Error(`${CANONICAL_INDEX_NAME} appeared during repair; refusing to replace indexes.`);
      }

      logger.info(`Replacing ${retainedIndex.name} with ${CANONICAL_INDEX_NAME} in one MariaDB-compatible ALTER TABLE statement.`);
      await sequelize.query(
        `ALTER TABLE ${quoteIdentifier(TABLE_NAME)} DROP INDEX ${quoteIdentifier(retainedIndex.name)}, ADD UNIQUE INDEX ${quoteIdentifier(CANONICAL_INDEX_NAME)} (${quoteIdentifier('name')})`
      );
    } else {
      for (const redundantIndex of nameIndexes.filter((index) => index.name !== CANONICAL_INDEX_NAME)) {
        const currentIndexes = await getIndexes();
        await ensureExpectedPrimaryKey(currentIndexes);
        const currentCandidate = currentIndexes.find((index) => index.name === redundantIndex.name);
        const currentNameIndexes = currentIndexes.filter(isNameUniqueIndex);
        if (!currentCandidate || !isNameUniqueIndex(currentCandidate) || currentNameIndexes.length < 2) {
          throw new Error(`Refusing to drop ${redundantIndex.name}: its current index definition or remaining canonical constraint could not be verified.`);
        }
        if (!currentIndexes.some((index) => index.name === CANONICAL_INDEX_NAME && isNameUniqueIndex(index))) {
          throw new Error(`Refusing to drop ${redundantIndex.name}: canonical name uniqueness is no longer present.`);
        }
        logger.info(`Dropping verified redundant UNIQUE(name) index ${redundantIndex.name}.`);
        await sequelize.query(
          `ALTER TABLE ${quoteIdentifier(TABLE_NAME)} DROP INDEX ${quoteIdentifier(redundantIndex.name)}`
        );
      }
    }

    const verifiedIndexes = await getIndexes();
    await ensureExpectedPrimaryKey(verifiedIndexes);
    const remainingNameIndexes = verifiedIndexes.filter(isNameUniqueIndex);
    if (remainingNameIndexes.length !== 1
      || remainingNameIndexes[0].name !== CANONICAL_INDEX_NAME
    ) {
      throw new Error('Post-repair index verification failed.');
    }

    logger.info(`Campus-location index repair complete; retained ${CANONICAL_INDEX_NAME} and the location_id PRIMARY KEY.`);
    await logDatabaseIndexState('After repair');
  } catch (error) {
    logger.error(`Campus-location index repair failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

repairCampusLocationIndexes();
