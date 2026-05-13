/**
 * Link-AI Credits Service
 * 点数计费系统
 *
 * 功能:
 * - 计算预估扣点
 * - 扣点和余额管理
 * - 每日使用统计
 * - 限流检查
 */

const { logger } = require('@librechat/data-schemas');

/** 点数消耗配置 */
const CREDIT_COSTS = {
  // 普通聊天：1 点
  chat: 1,
  // 高级模型：额外点数（根据模型）
  advancedModel: {
    // Fast 系列
    'gpt-4o-mini': 0,
    'gpt-4o': 0,
    'gemini-2.0-flash': 0,
    'claude-3-5-haiku': 0,
    // Pro 系列
    'gpt-4-turbo': 3,
    'gpt-4': 3,
    'gemini-1.5-pro': 3,
    'claude-3-opus': 5,
    'claude-3-sonnet': 3,
    // Thinking/Reasoning 系列
    'o1-preview': 8,
    'o1-mini': 4,
    'claude-3-5-sonnet': 2,
    'gemini-2.0-flash-thinking': 6,
  },
  // 自动轻搜索：额外 1 点
  autoSearch: 1,
  // 深度搜索 Beta：额外 8 点
  deepSearch: 8,
};

/** 每日限制配置 */
const DAILY_LIMITS = {
  free: {
    autoSearch: parseInt(process.env.FREE_AUTO_SEARCH_DAILY_LIMIT || '20', 10),
    deepSearch: 0, // 免费用户默认不可用深度搜索
  },
  trial: {
    autoSearch: 50,
    deepSearch: 3,
  },
  weekly: {
    autoSearch: 100,
    deepSearch: 5,
  },
  monthly_lite: {
    autoSearch: 150,
    deepSearch: 8,
  },
  monthly: {
    autoSearch: 100,
    deepSearch: 5,
  },
  monthly_pro: {
    autoSearch: 300,
    deepSearch: 15,
  },
  pro: {
    autoSearch: 300,
    deepSearch: 20,
  },
  heavy: {
    autoSearch: 1000,
    deepSearch: 50,
  },
};

/** 预设套餐配置 */
const PRESET_PACKAGES = {
  free: { credits: 100, days: 7, label: '免费体验' },
  trial: { credits: 300, days: 3, label: '试用版' },
  weekly: { credits: 1200, days: 7, label: '周卡' },
  monthly_lite: { credits: 3000, days: 30, label: '月卡 Lite' },
  monthly: { credits: 3000, days: 30, label: '月卡' },
  monthly_pro: { credits: 9000, days: 30, label: '月卡 Pro' },
  pro: { credits: 9000, days: 30, label: '专业版' },
  heavy: { credits: 25000, days: 30, label: '重度用户' },
};

/** 高级模型列表（消耗更多点数） */
const ADVANCED_MODELS = [
  'gpt-5.5',
  'gemini-3.1-pro-preview',
  'claude-opus-4-7',
  'claude-sonnet-4-6',
];

/**
 * 计算预估扣点数
 * @param {Object} params
 * @param {string} params.model - 模型名称
 * @param {string} params.searchMode - 搜索模式: 'off' | 'auto' | 'deep'
 * @returns {Object} { totalCredits, breakdown }
 */
function calculateCredits({ model, searchMode = 'off' }) {
  let totalCredits = CREDIT_COSTS.chat;
  const breakdown = {
    chat: CREDIT_COSTS.chat,
    advancedModel: 0,
    search: 0,
  };

  // 高级模型额外扣点（根据具体模型）
  const modelCost = CREDIT_COSTS.advancedModel[model];
  if (modelCost !== undefined && modelCost > 0) {
    totalCredits += modelCost;
    breakdown.advancedModel = modelCost;
  }

  // 搜索模式额外扣点
  if (searchMode === 'auto') {
    totalCredits += CREDIT_COSTS.autoSearch;
    breakdown.search = CREDIT_COSTS.autoSearch;
  } else if (searchMode === 'deep') {
    totalCredits += CREDIT_COSTS.deepSearch;
    breakdown.search = CREDIT_COSTS.deepSearch;
  }

  return { totalCredits, breakdown };
}

/**
 * 获取每日使用限制
 * @param {string} plan - 套餐类型
 * @returns {Object}
 */
function getDailyLimits(plan = 'free') {
  return DAILY_LIMITS[plan] || DAILY_LIMITS.free;
}

/**
 * 获取每日重置时间（次日 00:00 UTC）
 * @returns {number}
 */
function getNextResetTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

/**
 * 获取今日日期字符串
 * @returns {string}
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * 检查是否需要重置每日统计
 * @param {string} lastResetDate
 * @returns {boolean}
 */
function shouldResetDaily(lastResetDate) {
  if (!lastResetDate) {
    return true;
  }
  return lastResetDate !== getTodayString();
}

class CreditsService {
  constructor() {
    // 内存缓存用户数据（生产环境应使用 Redis）
    this.userCache = new Map();
  }

  /**
   * 获取用户 Link-AI 信息（带缓存）
   * @param {Object} user - Mongoose User 对象
   * @returns {Object}
   */
  getUserLinkAI(user) {
    const cacheKey = user._id?.toString() || user.id;

    if (this.userCache.has(cacheKey)) {
      return this.userCache.get(cacheKey);
    }

    const linkai = user.linkai || {};
    const result = {
      plan: linkai.plan || 'free',
      credits: linkai.credits ?? 100, // 默认 100 点
      creditsTotal: linkai.creditsTotal || 100,
      expiresAt: linkai.expiresAt || null,
      dailyUsage: linkai.dailyUsage || {
        autoSearchCount: 0,
        deepSearchCount: 0,
        lastResetDate: null,
      },
      totalUsage: linkai.totalUsage || {
        chatCount: 0,
        searchCount: 0,
        deepSearchCount: 0,
      },
      planConfig: linkai.planConfig || DAILY_LIMITS,
    };

    // 检查是否需要重置每日统计
    if (shouldResetDaily(result.dailyUsage.lastResetDate)) {
      result.dailyUsage = {
        autoSearchCount: 0,
        deepSearchCount: 0,
        lastResetDate: getTodayString(),
      };
    }

    this.userCache.set(cacheKey, result);
    return result;
  }

  /**
   * 清除用户缓存
   * @param {string} userId
   */
  clearCache(userId) {
    this.userCache.delete(userId);
  }

  /**
   * 检查用户是否可使用搜索
   * @param {Object} user - Mongoose User 对象
   * @param {'auto' | 'deep'} searchType
   * @returns {Object} { allowed: boolean, reason?: string, remaining: number }
   */
  checkSearchAccess(user, searchType) {
    const linkai = this.getUserLinkAI(user);
    const limits = getDailyLimits(linkai.plan);
    const { dailyUsage } = linkai;

    const countField = searchType === 'deep' ? 'deepSearchCount' : 'autoSearchCount';
    const limitField = searchType === 'deep' ? 'deepSearch' : 'autoSearch';
    const used = dailyUsage[countField];
    const limit = limits[limitField];

    // 检查每日限制
    if (used >= limit) {
      return {
        allowed: false,
        reason: 'daily_limit_exceeded',
        message: '今日搜索额度已用完，请明天再试或升级套餐。',
        remaining: 0,
        resetAt: getNextResetTime(),
      };
    }

    // 检查深度搜索权限
    if (searchType === 'deep' && limits.deepSearch === 0) {
      return {
        allowed: false,
        reason: 'deep_search_not_enabled',
        message: '深度搜索暂未开放，请升级套餐体验。',
        remaining: 0,
      };
    }

    return {
      allowed: true,
      remaining: limit - used,
      resetAt: getNextResetTime(),
    };
  }

  /**
   * 检查点数余额是否足够
   * @param {Object} user
   * @param {number} requiredCredits
   * @returns {Object} { allowed: boolean, balance: number, shortfall?: number }
   */
  checkBalance(user, requiredCredits) {
    const linkai = this.getUserLinkAI(user);
    const balance = linkai.credits;

    if (balance < requiredCredits) {
      return {
        allowed: false,
        balance,
        shortfall: requiredCredits - balance,
        message: `余额不足，当前剩余 ${balance} 点，需要 ${requiredCredits} 点。`,
      };
    }

    return {
      allowed: true,
      balance,
      remaining: balance - requiredCredits,
    };
  }

  /**
   * 扣除点数
   * @param {Object} user - Mongoose User 对象
   * @param {number} credits - 扣除点数
   * @param {Object} options - 其他选项
   * @returns {Promise<Object>}
   */
  async deductCredits(user, credits, options = {}) {
    const User = require('~/models').User;
    const userId = user._id?.toString() || user.id;
    const linkai = this.getUserLinkAI(user);

    // 计算新余额
    const newCredits = Math.max(0, linkai.credits - credits);

    // 更新用户数据
    const updateData = {
      'linkai.credits': newCredits,
      'linkai.totalUsage.chatCount': (linkai.totalUsage?.chatCount || 0) + 1,
    };

    // 更新每日搜索统计
    if (options.searchMode === 'auto') {
      updateData['linkai.dailyUsage.autoSearchCount'] =
        (linkai.dailyUsage?.autoSearchCount || 0) + 1;
      updateData['linkai.totalUsage.searchCount'] =
        (linkai.totalUsage?.searchCount || 0) + 1;
    } else if (options.searchMode === 'deep') {
      updateData['linkai.dailyUsage.deepSearchCount'] =
        (linkai.dailyUsage?.deepSearchCount || 0) + 1;
      updateData['linkai.totalUsage.deepSearchCount'] =
        (linkai.totalUsage?.deepSearchCount || 0) + 1;
    }

    try {
      await User.findByIdAndUpdate(userId, { $set: updateData });

      // 清除缓存
      this.clearCache(userId);

      logger.info(`[CreditsService] Deducted ${credits} credits from user ${userId}`);

      return {
        success: true,
        deducted: credits,
        newBalance: newCredits,
      };
    } catch (error) {
      logger.error(`[CreditsService] Failed to deduct credits:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 初始化新用户点数
   * @param {Object} user - Mongoose User 对象
   * @returns {Promise<Object>}
   */
  async initializeCredits(user) {
    const User = require('~/models').User;
    const userId = user._id?.toString() || user.id;

    const initialCredits = {
      'linkai.plan': 'free',
      'linkai.credits': 100,
      'linkai.creditsTotal': 100,
      'linkai.expiresAt': null,
      'linkai.dailyUsage': {
        autoSearchCount: 0,
        deepSearchCount: 0,
        lastResetDate: getTodayString(),
      },
      'linkai.totalUsage': {
        chatCount: 0,
        searchCount: 0,
        deepSearchCount: 0,
      },
      'linkai.planConfig': DAILY_LIMITS,
    };

    try {
      await User.findByIdAndUpdate(userId, { $set: initialCredits });
      this.clearCache(userId);

      logger.info(`[CreditsService] Initialized credits for user ${userId}`);

      return {
        success: true,
        credits: 100,
        plan: 'free',
      };
    } catch (error) {
      logger.error(`[CreditsService] Failed to initialize credits:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取用户完整信息（用于前端显示）
   * @param {Object} user
   * @returns {Object}
   */
  getUserStatus(user) {
    const linkai = this.getUserLinkAI(user);
    const limits = getDailyLimits(linkai.plan);

    // 套餐名称映射
    const planNames = {
      free: '体验版',
      weekly: '周卡',
      monthly: '月卡',
      pro: '专业版',
    };

    return {
      plan: linkai.plan,
      planName: planNames[linkai.plan] || '体验版',
      credits: linkai.credits,
      expiresAt: linkai.expiresAt,
      dailyLimits: {
        autoSearch: limits.autoSearch,
        deepSearch: limits.deepSearch,
      },
      dailyUsage: {
        autoSearch: linkai.dailyUsage?.autoSearchCount || 0,
        deepSearch: linkai.dailyUsage?.deepSearchCount || 0,
      },
      dailyRemaining: {
        autoSearch: Math.max(0, limits.autoSearch - (linkai.dailyUsage?.autoSearchCount || 0)),
        deepSearch: Math.max(0, limits.deepSearch - (linkai.dailyUsage?.deepSearchCount || 0)),
      },
      totalUsage: {
        chatCount: linkai.totalUsage?.chatCount || 0,
        searchCount: linkai.totalUsage?.searchCount || 0,
        deepSearchCount: linkai.totalUsage?.deepSearchCount || 0,
      },
      deepSearchEnabled: linkai.planConfig?.free?.deepSearchEnabled || linkai.plan !== 'free',
      nextResetAt: getNextResetTime(),
    };
  }
}

// 导出
const creditsService = new CreditsService();

module.exports = {
  CreditsService,
  creditsService,
  calculateCredits,
  getDailyLimits,
  CREDIT_COSTS,
  DAILY_LIMITS,
  PRESET_PACKAGES,
  ADVANCED_MODELS,
};
