const mongoose = require('mongoose');
const { createMethods } = require('@librechat/data-schemas');
const { matchModelName, findMatchingPattern } = require('@librechat/api');
const getLogStores = require('~/cache/getLogStores');

const methods = createMethods(mongoose, {
  matchModelName,
  findMatchingPattern,
  getCache: getLogStores,
});

/**
 * Sync admin emails from environment variable to user roles
 * ADMIN_EMAILS: comma-separated list of admin emails
 */
const syncAdminEmails = async () => {
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    return;
  }

  const emails = adminEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) {
    return;
  }

  const User = mongoose.models.User;
  if (!User) {
    console.warn('[seedDatabase] User model not available yet');
    return;
  }

  const { SystemRoles } = require('librechat-data-provider');

  try {
    const result = await User.updateMany(
      { email: { $in: emails }, role: { $ne: SystemRoles.ADMIN } },
      { $set: { role: SystemRoles.ADMIN } },
    );

    if (result.modifiedCount > 0) {
      console.log(`[seedDatabase] Granted admin role to ${result.modifiedCount} user(s)`);
    }
  } catch (error) {
    console.error('[seedDatabase] Failed to sync admin emails:', error);
  }
};

const seedDatabase = async () => {
  await methods.initializeRoles();
  await methods.seedDefaultRoles();
  await methods.ensureDefaultCategories();
  await methods.seedSystemGrants();
  await syncAdminEmails();
};

module.exports = {
  ...methods,
  seedDatabase,
};
