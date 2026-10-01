const { User } = require('../models');

const MAX_ADMIN_ACCOUNTS = 3;

async function withAdminAccountsLocked(operation) {
  return User.sequelize.transaction(async (transaction) => {
    const admins = await User.findAll({
      where: { role: 'admin' },
      attributes: ['user_id', 'role', 'is_active'],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    return operation(transaction, admins);
  });
}

function assertAdminCapacity(admins, alreadyAdmin = false) {
  if (!alreadyAdmin && admins.length >= MAX_ADMIN_ACCOUNTS) {
    const error = new Error('The maximum number of Admin accounts is 3.');
    error.statusCode = 409;
    throw error;
  }
}

function assertUsableAdminRemains(admins, userId, updates) {
  const targetIsActiveAdmin = admins.some((admin) => admin.user_id === userId && admin.is_active);
  const targetRemainsActiveAdmin = updates.role !== undefined
    ? updates.role === 'admin' && updates.is_active !== false
    : updates.is_active !== false;
  if (!targetIsActiveAdmin || targetRemainsActiveAdmin) return;

  const anotherActiveAdminExists = admins.some((admin) => admin.user_id !== userId && admin.is_active);
  if (!anotherActiveAdminExists) {
    const error = new Error('At least one active Admin account must remain.');
    error.statusCode = 409;
    throw error;
  }
}

module.exports = {
  MAX_ADMIN_ACCOUNTS,
  withAdminAccountsLocked,
  assertAdminCapacity,
  assertUsableAdminRemains
};