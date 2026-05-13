/**
 * Credits Check Middleware
 * 点数检查中间件
 *
 * 在聊天请求前检查：
 * 1. 用户余额是否足够
 * 2. 搜索次数是否超限
 *
 * 采用"先扣后回滚"策略：
 * - 请求开始时预扣点数
 * - 模型返回成功后才正式确认
 * - 模型失败时回滚预扣
 */

const { logger } = require('@librechat/data-schemas');
const {
  creditsService,
  calculateCredits,
  ADVANCED_MODELS,
} = require('~/server/services/Search/credits');

/**
 * 检查并预扣点数
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function creditsCheck(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 检查并初始化老用户的 linkai 字段
    const initialized = await ensureLinkAIInitialized(user);
    if (!initialized) {
      return res.status(500).json({ error: 'Failed to initialize user credits' });
    }

    // 获取请求参数
    const { model, searchMode = 'off' } = req.body;

    // 计算预估扣点
    const { totalCredits, breakdown } = calculateCredits({ model, searchMode });

    // 检查余额
    const balanceCheck = creditsService.checkBalance(user, totalCredits);
    if (!balanceCheck.allowed) {
      logger.warn(`[CreditsCheck] Insufficient balance for user ${user.id}: need ${totalCredits}, have ${balanceCheck.balance}`);
      return res.status(402).json({
        error: 'INSUFFICIENT_BALANCE',
        message: `余额不足，当前剩余 ${balanceCheck.balance} 点，需要 ${totalCredits} 点。`,
        required: totalCredits,
        current: balanceCheck.balance,
        shortfall: balanceCheck.shortfall,
      });
    }

    // 如果是搜索模式，检查搜索权限
    if (searchMode === 'auto' || searchMode === 'deep') {
      const searchType = searchMode === 'deep' ? 'deep' : 'auto';
      const searchCheck = creditsService.checkSearchAccess(user, searchType);

      if (!searchCheck.allowed) {
        logger.warn(`[CreditsCheck] Search access denied for user ${user.id}: ${searchCheck.reason}`);
        return res.status(429).json({
          error: 'SEARCH_LIMIT_EXCEEDED',
          message: searchCheck.message,
          reason: searchCheck.reason,
          resetAt: searchCheck.resetAt,
        });
      }
    }

    // 预扣点数
    const deductResult = await creditsService.deductCredits(user, totalCredits, { searchMode });

    if (!deductResult.success) {
      logger.error(`[CreditsCheck] Failed to deduct credits: ${deductResult.error}`);
      return res.status(500).json({
        error: 'DEDUCT_FAILED',
        message: '扣点失败，请重试',
      });
    }

    // 将扣点信息挂载到 req 上，供后续流程使用
    req.creditsDeducted = {
      credits: totalCredits,
      breakdown,
      newBalance: deductResult.newBalance,
      searchMode,
    };

    logger.info(`[CreditsCheck] Deducted ${totalCredits} credits from user ${user.id}, new balance: ${deductResult.newBalance}`);

    next();
  } catch (error) {
    logger.error('[CreditsCheck] Error:', error);
    // 出错时不阻止请求，让流程继续
    next();
  }
}

/**
 * 回滚预扣的点数（当模型调用失败时）
 * @param {Object} req
 * @param {string} reason - 回滚原因
 */
async function rollbackCredits(req, reason = 'unknown') {
  if (!req.creditsDeducted) {
    return;
  }

  const { credits, searchMode } = req.creditsDeducted;
  const user = req.user;

  try {
    // 返还点数（增加余额）
    const User = require('~/models').User;
    const userId = user._id?.toString() || user.id;
    const linkai = creditsService.getUserLinkAI(user);
    const newBalance = linkai.credits + credits;

    await User.findByIdAndUpdate(userId, {
      $inc: {
        'linkai.credits': credits,
      },
      // 回滚使用统计
      ...(searchMode === 'auto' && {
        $inc: {
          'linkai.dailyUsage.autoSearchCount': -1,
          'linkai.totalUsage.searchCount': -1,
        },
      }),
      ...(searchMode === 'deep' && {
        $inc: {
          'linkai.dailyUsage.deepSearchCount': -1,
          'linkai.totalUsage.deepSearchCount': -1,
        },
      }),
      $inc: {
        'linkai.totalUsage.chatCount': -1,
      },
    });

    // 清除缓存
    creditsService.clearCache(userId);

    logger.info(`[CreditsRollback] Rolled back ${credits} credits for user ${userId}, reason: ${reason}`);
  } catch (error) {
    logger.error(`[CreditsRollback] Failed to rollback credits:`, error);
  }
}

/**
 * 确保用户的 linkai 字段已初始化
 * 老用户（linkai 为空）首次访问时自动初始化
 * @param {Object} user - Mongoose User 对象
 * @returns {Promise<boolean>}
 */
async function ensureLinkAIInitialized(user) {
  const User = require('~/models').User;
  const userId = user._id?.toString() || user.id;

  // 检查是否已有 linkai 字段
  const existingUser = await User.findById(userId).select('linkai').lean();
  if (existingUser?.linkai && existingUser.linkai.credits !== undefined) {
    // 已有 linkai 字段，检查是否需要重置每日统计
    if (existingUser.linkai.dailyUsage?.lastResetDate) {
      const today = new Date().toISOString().split('T')[0];
      if (existingUser.linkai.dailyUsage.lastResetDate !== today) {
        // 重置每日统计
        await User.findByIdAndUpdate(userId, {
          $set: {
            'linkai.dailyUsage.autoSearchCount': 0,
            'linkai.dailyUsage.deepSearchCount': 0,
            'linkai.dailyUsage.lastResetDate': today,
          },
        });
        creditsService.clearCache(userId);
      }
    }
    return true;
  }

  // 老用户首次初始化
  const today = new Date().toISOString().split('T')[0];
  const initialCredits = {
    'linkai.plan': 'free',
    'linkai.credits': 100,
    'linkai.creditsTotal': 100,
    'linkai.expiresAt': null,
    'linkai.dailyUsage': {
      autoSearchCount: 0,
      deepSearchCount: 0,
      lastResetDate: today,
    },
    'linkai.totalUsage': {
      chatCount: 0,
      searchCount: 0,
      deepSearchCount: 0,
    },
  };

  try {
    await User.findByIdAndUpdate(userId, { $set: initialCredits });
    creditsService.clearCache(userId);
    logger.info(`[CreditsCheck] Initialized linkai for old user ${userId}`);
    return true;
  } catch (error) {
    logger.error(`[CreditsCheck] Failed to initialize linkai for user ${userId}:`, error);
    return false;
  }
}

/**
 * 获取点数扣除信息的响应头
 * @param {Object} req
 * @returns {Object}
 */
function getCreditsHeaders(req) {
  if (!req.creditsDeducted) {
    return {};
  }

  return {
    'X-Credits-Deducted': req.creditsDeducted.credits.toString(),
    'X-Credits-Remaining': req.creditsDeducted.newBalance.toString(),
  };
}

module.exports = {
  creditsCheck,
  rollbackCredits,
  getCreditsHeaders,
};
