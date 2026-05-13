import { SystemRoles } from 'librechat-data-provider';
import { logger } from '@librechat/data-schemas';
import { DAILY_LIMITS, PRESET_PACKAGES } from '~/server/services/Search/credits';

/**
 * Get admin logs
 */
export async function getAdminLogs(req, res) {
  try {
    const { page = 1, limit = 20, action, targetUserId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (action) filter.action = action;
    if (targetUserId) filter.targetUserId = targetUserId;

    const logs = await req.db.AdminLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await req.db.AdminLog.countDocuments(filter);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('[AdminHandler] getAdminLogs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch admin logs' });
  }
}

/**
 * List all users with pagination
 */
export async function listUsers(req, res) {
  try {
    const { page = 1, limit = 20, search, role, plan, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) filter.role = role;
    if (plan) filter['linkai.plan'] = plan;
    if (status) filter.status = status;

    const users = await req.db.User.find(filter)
      .select('-password -totpSecret -backupCodes -pendingTotpSecret -pendingBackupCodes')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await req.db.User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('[AdminHandler] listUsers error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
}

/**
 * Get single user details
 */
export async function getUser(req, res) {
  try {
    const { userId } = req.params;

    const user = await req.db.User.findById(userId)
      .select('-password -totpSecret -backupCodes -pendingTotpSecret -pendingBackupCodes')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('[AdminHandler] getUser error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
}

/**
 * Add credits to user
 */
export async function addCredits(req, res) {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;
    const adminUser = req.user;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    const user = await req.db.User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const before = { credits: user.linkai?.credits || 0 };
    const newCredits = (user.linkai?.credits || 0) + amount;

    user.linkai = user.linkai || {};
    user.linkai.credits = newCredits;
    user.linkai.creditsTotal = Math.max(user.linkai.creditsTotal || 0, newCredits);
    await user.save();

    // Log admin action
    await req.db.AdminLog.create({
      adminUserId: adminUser._id.toString(),
      adminEmail: adminUser.email,
      targetUserId: user._id.toString(),
      targetEmail: user.email,
      action: 'add_credits',
      before,
      after: { credits: newCredits },
      reason: reason || '',
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({
      success: true,
      data: {
        credits: user.linkai.credits,
        creditsTotal: user.linkai.creditsTotal,
      },
    });
  } catch (error) {
    logger.error('[AdminHandler] addCredits error:', error);
    res.status(500).json({ success: false, error: 'Failed to add credits' });
  }
}

/**
 * Deduct credits from user
 */
export async function deductCredits(req, res) {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;
    const adminUser = req.user;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    const user = await req.db.User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const before = { credits: user.linkai?.credits || 0 };
    const currentCredits = user.linkai?.credits || 0;
    const newCredits = Math.max(0, currentCredits - amount);

    user.linkai = user.linkai || {};
    user.linkai.credits = newCredits;
    await user.save();

    // Log admin action
    await req.db.AdminLog.create({
      adminUserId: adminUser._id.toString(),
      adminEmail: adminUser.email,
      targetUserId: user._id.toString(),
      targetEmail: user.email,
      action: 'deduct_credits',
      before,
      after: { credits: newCredits },
      reason: reason || '',
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({
      success: true,
      data: {
        credits: user.linkai.credits,
        creditsTotal: user.linkai.creditsTotal,
      },
    });
  } catch (error) {
    logger.error('[AdminHandler] deductCredits error:', error);
    res.status(500).json({ success: false, error: 'Failed to deduct credits' });
  }
}

/**
 * Set user plan with preset packages
 */
export async function setPlan(req, res) {
  try {
    const { userId } = req.params;
    const { plan, reason } = req.body;
    const adminUser = req.user;

    const validPlans = Object.keys(PRESET_PACKAGES);
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    const user = await req.db.User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const before = {
      plan: user.linkai?.plan,
      credits: user.linkai?.credits,
      expiresAt: user.linkai?.expiresAt,
    };

    // 使用预设套餐
    const pkg = PRESET_PACKAGES[plan];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + pkg.days * 24 * 60 * 60 * 1000);

    user.linkai = user.linkai || {};
    user.linkai.plan = plan;
    user.linkai.credits = pkg.credits;
    user.linkai.creditsTotal = pkg.credits;
    user.linkai.expiresAt = expiresAt;
    user.linkai.dailyUsage = {
      autoSearchCount: 0,
      deepSearchCount: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    };

    // Update planConfig based on plan
    const limits = DAILY_LIMITS[plan] || DAILY_LIMITS.free;
    user.linkai.planConfig = user.linkai.planConfig || new Map();
    user.linkai.planConfig.set(plan, {
      dailyAutoSearchLimit: limits.autoSearch,
      dailyDeepSearchLimit: limits.deepSearch,
      deepSearchEnabled: limits.deepSearch > 0,
    });

    await user.save();

    // Log admin action
    await req.db.AdminLog.create({
      adminUserId: adminUser._id.toString(),
      adminEmail: adminUser.email,
      targetUserId: user._id.toString(),
      targetEmail: user.email,
      action: 'set_plan',
      before,
      after: {
        plan,
        credits: pkg.credits,
        expiresAt,
      },
      reason: reason || `Set to ${plan} plan`,
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({
      success: true,
      data: {
        plan: user.linkai.plan,
        credits: user.linkai.credits,
        expiresAt: user.linkai.expiresAt,
      },
    });
  } catch (error) {
    logger.error('[AdminHandler] setPlan error:', error);
    res.status(500).json({ success: false, error: 'Failed to set plan' });
  }
}

/**
 * Set user expiration time
 */
export async function setExpiresAt(req, res) {
  try {
    const { userId } = req.params;
    const { expiresAt, reason } = req.body;
    const adminUser = req.user;

    const user = await req.db.User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const before = { expiresAt: user.linkai?.expiresAt };
    const newExpiresAt = expiresAt ? new Date(expiresAt) : null;

    user.linkai = user.linkai || {};
    user.linkai.expiresAt = newExpiresAt;
    await user.save();

    // Log admin action
    await req.db.AdminLog.create({
      adminUserId: adminUser._id.toString(),
      adminEmail: adminUser.email,
      targetUserId: user._id.toString(),
      targetEmail: user.email,
      action: 'set_expires_at',
      before,
      after: { expiresAt: newExpiresAt },
      reason: reason || '',
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({
      success: true,
      data: { expiresAt: user.linkai.expiresAt },
    });
  } catch (error) {
    logger.error('[AdminHandler] setExpiresAt error:', error);
    res.status(500).json({ success: false, error: 'Failed to set expiration' });
  }
}

/**
 * Reset user's daily search usage
 */
export async function resetSearchUsage(req, res) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminUser = req.user;

    const user = await req.db.User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const before = { dailyUsage: user.linkai?.dailyUsage || {} };

    user.linkai = user.linkai || {};
    user.linkai.dailyUsage = {
      autoSearchCount: 0,
      deepSearchCount: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    };
    await user.save();

    // Log admin action
    await req.db.AdminLog.create({
      adminUserId: adminUser._id.toString(),
      adminEmail: adminUser.email,
      targetUserId: user._id.toString(),
      targetEmail: user.email,
      action: 'reset_search_usage',
      before,
      after: { dailyUsage: user.linkai.dailyUsage },
      reason: reason || 'Manual reset',
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({
      success: true,
      data: { dailyUsage: user.linkai.dailyUsage },
    });
  } catch (error) {
    logger.error('[AdminHandler] resetSearchUsage error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset usage' });
  }
}

/**
 * Ban user
 */
export async function banUser(req, res) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminUser = req.user;

    const user = await req.db.User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Prevent admin from banning themselves
    if (user._id.toString() === adminUser._id.toString()) {
      return res.status(400).json({ success: false, error: 'Cannot ban yourself' });
    }

    const before = { status: user.status };

    user.status = 'banned';
    await user.save();

    // Log admin action
    await req.db.AdminLog.create({
      adminUserId: adminUser._id.toString(),
      adminEmail: adminUser.email,
      targetUserId: user._id.toString(),
      targetEmail: user.email,
      action: 'ban_user',
      before,
      after: { status: 'banned' },
      reason: reason || '',
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({ success: true, data: { status: user.status } });
  } catch (error) {
    logger.error('[AdminHandler] banUser error:', error);
    res.status(500).json({ success: false, error: 'Failed to ban user' });
  }
}

/**
 * Unban user
 */
export async function unbanUser(req, res) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminUser = req.user;

    const user = await req.db.User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const before = { status: user.status };

    user.status = 'active';
    await user.save();

    // Log admin action
    await req.db.AdminLog.create({
      adminUserId: adminUser._id.toString(),
      adminEmail: adminUser.email,
      targetUserId: user._id.toString(),
      targetEmail: user.email,
      action: 'unban_user',
      before,
      after: { status: 'active' },
      reason: reason || '',
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({ success: true, data: { status: user.status } });
  } catch (error) {
    logger.error('[AdminHandler] unbanUser error:', error);
    res.status(500).json({ success: false, error: 'Failed to unban user' });
  }
}

/**
 * Update user role
 */
export async function updateUserRole(req, res) {
  try {
    const { userId } = req.params;
    const { role, reason } = req.body;
    const adminUser = req.user;

    const validRoles = [SystemRoles.USER, SystemRoles.ADMIN];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const user = await req.db.User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Prevent admin from demoting themselves
    if (user._id.toString() === adminUser._id.toString()) {
      return res.status(400).json({ success: false, error: 'Cannot change your own role' });
    }

    const before = { role: user.role };

    user.role = role;
    await user.save();

    // Log admin action
    await req.db.AdminLog.create({
      adminUserId: adminUser._id.toString(),
      adminEmail: adminUser.email,
      targetUserId: user._id.toString(),
      targetEmail: user.email,
      action: 'update_role',
      before,
      after: { role },
      reason: reason || '',
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({ success: true, data: { role: user.role } });
  } catch (error) {
    logger.error('[AdminHandler] updateUserRole error:', error);
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
}

/**
 * Get admin statistics
 */
export async function getStats(req, res) {
  try {
    const totalUsers = await req.db.User.countDocuments();
    const activeUsers = await req.db.User.countDocuments({ status: 'active' });
    const bannedUsers = await req.db.User.countDocuments({ status: 'banned' });
    const adminUsers = await req.db.User.countDocuments({ role: SystemRoles.ADMIN });

    // Credits stats
    const creditStats = await req.db.User.aggregate([
      {
        $match: { 'linkai.credits': { $exists: true } },
      },
      {
        $group: {
          _id: null,
          totalCredits: { $sum: '$linkai.credits' },
          avgCredits: { $avg: '$linkai.credits' },
          maxCredits: { $max: '$linkai.credits' },
        },
      },
    ]);

    // Plan distribution
    const planDistribution = await req.db.User.aggregate([
      {
        $match: { 'linkai.plan': { $exists: true } },
      },
      {
        $group: {
          _id: '$linkai.plan',
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent admin actions (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActions = await req.db.AdminLog.countDocuments({ createdAt: { $gte: yesterday } });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          banned: bannedUsers,
          admins: adminUsers,
        },
        credits: creditStats[0] || { totalCredits: 0, avgCredits: 0, maxCredits: 0 },
        planDistribution: planDistribution.reduce((acc, item) => {
          acc[item._id || 'free'] = item.count;
          return acc;
        }, {}),
        recentActions,
      },
    });
  } catch (error) {
    logger.error('[AdminHandler] getStats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
}

/**
 * Get request logs with pagination
 */
export async function getRequestLogs(req, res) {
  try {
    const { page = 1, limit = 50, userId, model, searchMode, success, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (userId) filter.userId = userId;
    if (model) filter.model = { $regex: model, $options: 'i' };
    if (searchMode) filter.searchMode = searchMode;
    if (success !== undefined) filter.success = success === 'true';

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const logs = await req.db.RequestLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await req.db.RequestLog.countDocuments(filter);

    // 计算汇总统计
    const summary = await req.db.RequestLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalCredits: { $sum: '$deductedCredits' },
          successfulRequests: { $sum: { $cond: ['$success', 1, 0] } },
          failedRequests: { $sum: { $cond: ['$success', 0, 1] } },
          totalSearchRequests: { $sum: { $cond: ['$searchPerformed', 1, 0] } },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        summary: summary[0] || {
          totalRequests: 0,
          totalCredits: 0,
          successfulRequests: 0,
          failedRequests: 0,
          totalSearchRequests: 0,
        },
      },
    });
  } catch (error) {
    logger.error('[AdminHandler] getRequestLogs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch request logs' });
  }
}

/**
 * Get user consumption ranking
 */
export async function getConsumptionRanking(req, res) {
  try {
    const { period = 'all', limit = 20, startDate, endDate } = req.query;

    // 构建时间过滤器
    const timeFilter = {};
    if (period !== 'all') {
      const now = new Date();
      if (period === 'today') {
        timeFilter.$gte = new Date(now.setHours(0, 0, 0, 0));
      } else if (period === 'week') {
        timeFilter.$gte = new Date(now.setDate(now.getDate() - 7));
      } else if (period === 'month') {
        timeFilter.$gte = new Date(now.setMonth(now.getMonth() - 1));
      }
    }
    if (startDate) timeFilter.$gte = new Date(startDate);
    if (endDate) timeFilter.$lte = new Date(endDate);

    const matchStage = Object.keys(timeFilter).length > 0 ? { createdAt: timeFilter } : {};

    // 按用户聚合消耗
    const ranking = await req.db.RequestLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          userEmail: { $first: '$userEmail' },
          totalRequests: { $sum: 1 },
          totalCredits: { $sum: '$deductedCredits' },
          successfulRequests: { $sum: { $cond: ['$success', 1, 0] } },
          searchRequests: { $sum: { $cond: ['$searchPerformed', 1, 0] } },
          deepSearchRequests: {
            $sum: { $cond: [{ $eq: ['$searchMode', 'deep'] }, 1, 0] },
          },
        },
      },
      { $sort: { totalCredits: -1 } },
      { $limit: parseInt(limit) },
    ]);

    // 整体统计
    const overallStats = await req.db.RequestLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalCredits: { $sum: '$deductedCredits' },
          totalRequests: { $sum: 1 },
          avgCreditsPerRequest: { $avg: '$deductedCredits' },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        ranking: ranking.map((item, index) => ({
          rank: index + 1,
          userId: item._id,
          userEmail: item.userEmail,
          ...item,
        })),
        overall: overallStats[0] || {
          totalCredits: 0,
          totalRequests: 0,
          avgCreditsPerRequest: 0,
        },
        period,
      },
    });
  } catch (error) {
    logger.error('[AdminHandler] getConsumptionRanking error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch consumption ranking' });
  }
}

/**
 * Get today's overview data for admin dashboard
 */
export async function getTodayOverview(req, res) {
  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Request stats for today
    const todayRequestStats = await req.db.RequestLog.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          successfulRequests: { $sum: { $cond: ['$success', 1, 0] } },
          failedRequests: { $sum: { $cond: ['$success', 0, 1] } },
          totalDeductedCredits: { $sum: '$deductedCredits' },
          autoSearchCount: {
            $sum: { $cond: [{ $and: [{ $eq: ['$searchPerformed', true] }, { $eq: ['$searchMode', 'auto'] }] }, 1, 0] },
          },
          deepSearchCount: {
            $sum: { $cond: [{ $eq: ['$searchMode', 'deep'] }, 1, 0] },
          },
        },
      },
    ]);

    // New users today
    const newUsersToday = await req.db.User.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
    });

    // Total users
    const totalUsers = await req.db.User.countDocuments();

    // Top 10 high consumption users (all time)
    const topUsers = await req.db.RequestLog.aggregate([
      {
        $group: {
          _id: '$userId',
          email: { $first: '$userEmail' },
          totalCredits: { $sum: '$deductedCredits' },
        },
      },
      { $sort: { totalCredits: -1 } },
      { $limit: 10 },
    ]);

    // Top 10 high consumption models (all time)
    const topModels = await req.db.RequestLog.aggregate([
      {
        $group: {
          _id: '$model',
          requestCount: { $sum: 1 },
          totalCredits: { $sum: '$deductedCredits' },
        },
      },
      { $sort: { totalCredits: -1 } },
      { $limit: 10 },
    ]);

    const stats = todayRequestStats[0] || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalDeductedCredits: 0,
      autoSearchCount: 0,
      deepSearchCount: 0,
    };

    res.json({
      success: true,
      data: {
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        totalDeductedCredits: stats.totalDeductedCredits,
        autoSearchCount: stats.autoSearchCount,
        deepSearchCount: stats.deepSearchCount,
        newUsers: newUsersToday,
        totalUsers: totalUsers,
        topUsers: topUsers.map(u => ({
          userId: u._id,
          email: u.email,
          totalCredits: u.totalCredits,
        })),
        topModels: topModels.map(m => ({
          model: m._id,
          requestCount: m.requestCount,
          totalCredits: m.totalCredits,
        })),
      },
    });
  } catch (error) {
    logger.error('[AdminHandler] getTodayOverview error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch today overview' });
  }
}

/**
 * Get user's request history
 */
export async function getUserRequestHistory(req, res) {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await req.db.RequestLog.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await req.db.RequestLog.countDocuments({ userId });

    // 用户汇总
    const summary = await req.db.RequestLog.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalCredits: { $sum: '$deductedCredits' },
          totalRequests: { $sum: 1 },
          successfulRequests: { $sum: { $cond: ['$success', 1, 0] } },
          searchRequests: { $sum: { $cond: ['$searchPerformed', 1, 0] } },
          deepSearchRequests: {
            $sum: { $cond: [{ $eq: ['$searchMode', 'deep'] }, 1, 0] },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        summary: summary[0] || {
          totalCredits: 0,
          totalRequests: 0,
          successfulRequests: 0,
          searchRequests: 0,
          deepSearchRequests: 0,
        },
      },
    });
  } catch (error) {
    logger.error('[AdminHandler] getUserRequestHistory error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user request history' });
  }
}
