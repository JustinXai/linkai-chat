const express = require('express');
const { requireAdmin } = require('~/server/middleware');
const { logger } = require('@librechat/data-schemas');
const {
  listUsers,
  getUser,
  getStats,
  getAdminLogs,
  addCredits,
  deductCredits,
  setPlan,
  setExpiresAt,
  resetSearchUsage,
  banUser,
  unbanUser,
  updateUserRole,
  getRequestLogs,
  getConsumptionRanking,
  getUserRequestHistory,
  getTodayOverview,
} = require('./linkaiAdmin');

const router = express.Router();

// Apply admin authentication to all routes
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 */
router.get('/stats', getStats);

/**
 * GET /api/admin/users
 * List users with pagination and filters
 * Query: page, limit, search, role, plan, status
 */
router.get('/users', listUsers);

/**
 * GET /api/admin/users/:userId
 * Get single user details
 */
router.get('/users/:userId', getUser);

/**
 * GET /api/admin/users/:userId/history
 * Get user's request history
 * Query: page, limit
 */
router.get('/users/:userId/history', getUserRequestHistory);

/**
 * POST /api/admin/users/:userId/credits
 * Add credits to user
 * Body: { amount: number, reason?: string }
 */
router.post('/users/:userId/credits', addCredits);

/**
 * DELETE /api/admin/users/:userId/credits
 * Deduct credits from user
 * Body: { amount: number, reason?: string }
 */
router.delete('/users/:userId/credits', deductCredits);

/**
 * POST /api/admin/users/:userId/plan
 * Set user plan
 * Body: { plan: 'free' | 'weekly' | 'monthly' | 'pro', reason?: string }
 */
router.post('/users/:userId/plan', setPlan);

/**
 * POST /api/admin/users/:userId/expires
 * Set user expiration time
 * Body: { expiresAt: ISO date string | null, reason?: string }
 */
router.post('/users/:userId/expires', setExpiresAt);

/**
 * POST /api/admin/users/:userId/reset-usage
 * Reset user's daily search usage
 * Body: { reason?: string }
 */
router.post('/users/:userId/reset-usage', resetSearchUsage);

/**
 * POST /api/admin/users/:userId/ban
 * Ban user
 * Body: { reason?: string }
 */
router.post('/users/:userId/ban', banUser);

/**
 * POST /api/admin/users/:userId/unban
 * Unban user
 * Body: { reason?: string }
 */
router.post('/users/:userId/unban', unbanUser);

/**
 * POST /api/admin/users/:userId/role
 * Update user role
 * Body: { role: 'user' | 'admin', reason?: string }
 */
router.post('/users/:userId/role', updateUserRole);

/**
 * GET /api/admin/logs
 * Get admin operation logs
 * Query: page, limit, action, targetUserId
 */
router.get('/logs', getAdminLogs);

/**
 * GET /api/admin/request-logs
 * Get request logs
 * Query: page, limit, userId, model, searchMode, success, startDate, endDate
 */
router.get('/request-logs', getRequestLogs);

/**
 * GET /api/admin/ranking
 * Get consumption ranking
 * Query: period (all|today|week|month), limit
 */
router.get('/ranking', getConsumptionRanking);

/**
 * GET /api/admin/today-overview
 * Get today's overview data for admin dashboard
 */
router.get('/today-overview', getTodayOverview);

module.exports = router;
