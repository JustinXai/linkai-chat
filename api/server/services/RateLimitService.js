/**
 * RateLimitService.js
 * 通用限流服务
 *
 * 使用内存 Map 存储限流数据，预留 Redis 接口
 *
 * 功能：
 * 1. IP 级别限流（注册、API 请求）
 * 2. 用户级别限流（消息数、搜索次数、并发控制）
 * 3. 邮箱级别限流（登录失败次数）
 */

const { logger } = require('@librechat/data-schemas');

// ==================== 限流规则配置 ====================

/** IP 级别限流规则 */
const IP_LIMITS = {
  // 注册限流
  register: {
    hourly: {
      max: parseInt(process.env.IP_REGISTER_HOURLY_MAX || '3', 10),
      windowMs: 60 * 60 * 1000, // 1小时
    },
    daily: {
      max: parseInt(process.env.IP_REGISTER_DAILY_MAX || '10', 10),
      windowMs: 24 * 60 * 60 * 1000, // 24小时
    },
  },
  // API 请求限流
  apiRequest: {
    perMinute: {
      max: parseInt(process.env.IP_API_MINUTE_MAX || '30', 10),
      windowMs: 60 * 1000, // 1分钟
    },
  },
};

/** 用户级别限流规则 */
const USER_LIMITS = {
  // 普通消息
  message: {
    free: {
      daily: {
        max: parseInt(process.env.FREE_USER_MESSAGE_DAILY_MAX || '30', 10),
        windowMs: 24 * 60 * 60 * 1000,
      },
    },
  },
  // 自动搜索
  autoSearch: {
    free: {
      daily: {
        max: parseInt(process.env.FREE_AUTO_SEARCH_DAILY_MAX || '20', 10),
        windowMs: 24 * 60 * 60 * 1000,
      },
    },
  },
  // 深度搜索
  deepSearch: {
    free: {
      daily: {
        max: parseInt(process.env.FREE_DEEP_SEARCH_DAILY_MAX || '0', 10),
        windowMs: 24 * 60 * 60 * 1000,
      },
    },
  },
  // 并发请求
  concurrent: {
    free: {
      max: parseInt(process.env.FREE_USER_CONCURRENT_MAX || '2', 10),
    },
    default: {
      max: parseInt(process.env.DEFAULT_USER_CONCURRENT_MAX || '5', 10),
    },
  },
};

/** 登录失败限流规则（按邮箱） */
const LOGIN_LIMITS = {
  failure: {
    max: parseInt(process.env.LOGIN_FAILURE_MAX || '5', 10),
    windowMs: parseInt(process.env.LOGIN_FAILURE_WINDOW || '10', 10) * 60 * 1000, // 10分钟
  },
};

// ==================== 存储结构 ====================

/**
 * @typedef {Object} RateLimitEntry
 * @property {number} count - 当前计数
 * @property {number} resetAt - 重置时间戳
 */

/**
 * @typedef {Object} ConcurrentEntry
 * @property {Set<string>} requestIds - 进行中的请求 ID 集合
 */

/**
 * @typedef {Object} LoginFailureEntry
 * @property {number} count - 失败次数
 * @property {number} resetAt - 重置时间戳
 */

// 内存存储
const storage = {
  /** @type {Map<string, RateLimitEntry>} IP 注册每小时 */
  ipRegisterHourly: new Map(),
  /** @type {Map<string, RateLimitEntry>} IP 注册每天 */
  ipRegisterDaily: new Map(),
  /** @type {Map<string, RateLimitEntry>} IP API 每分钟 */
  ipApiMinute: new Map(),
  /** @type {Map<string, RateLimitEntry>} 用户消息每天 */
  userMessageDaily: new Map(),
  /** @type {Map<string, RateLimitEntry>} 用户自动搜索每天 */
  userAutoSearchDaily: new Map(),
  /** @type {Map<string, RateLimitEntry>} 用户深度搜索每天 */
  userDeepSearchDaily: new Map(),
  /** @type {Map<string, ConcurrentEntry>} 用户并发请求 */
  userConcurrent: new Map(),
  /** @type {Map<string, LoginFailureEntry>} 登录失败（同邮箱） */
  loginFailure: new Map(),
};

// ==================== 日志记录 ====================

/**
 * 记录限流日志
 * @param {Object} params
 * @param {string} params.ip - IP 地址
 * @param {string} [params.userId] - 用户 ID
 * @param {string} params.action - 操作类型
 * @param {string} params.reason - 限流原因
 */
async function logRateLimit({ ip, userId, action, reason }) {
  const logEntry = {
    ip,
    userId: userId || null,
    action,
    reason,
    timestamp: new Date().toISOString(),
  };

  logger.warn(`[RateLimit] Blocked: ${JSON.stringify(logEntry)}`);

  // TODO: 未来可写入数据库
  // await LogModel.create(logEntry);
}

// ==================== 辅助函数 ====================

/**
 * 获取 IP 地址（移除端口）
 * @param {Object} req - Express 请求对象
 * @returns {string}
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim().split(':')[0];
  }
  return (req.ip || req.connection?.remoteAddress || '').split(':').pop();
}

/**
 * 获取用户 ID
 * @param {Object} req
 * @returns {string|null}
 */
function getUserId(req) {
  return req.user?.id || req.user?._id?.toString() || null;
}

/**
 * 清理过期条目（定期清理，防止内存泄漏）
 */
function cleanupExpired() {
  const now = Date.now();

  // 清理 IP 注册每小时
  for (const [key, entry] of storage.ipRegisterHourly) {
    if (now > entry.resetAt) {
      storage.ipRegisterHourly.delete(key);
    }
  }

  // 清理 IP 注册每天
  for (const [key, entry] of storage.ipRegisterDaily) {
    if (now > entry.resetAt) {
      storage.ipRegisterDaily.delete(key);
    }
  }

  // 清理 IP API 每分钟
  for (const [key, entry] of storage.ipApiMinute) {
    if (now > entry.resetAt) {
      storage.ipApiMinute.delete(key);
    }
  }

  // 清理用户消息每天
  for (const [key, entry] of storage.userMessageDaily) {
    if (now > entry.resetAt) {
      storage.userMessageDaily.delete(key);
    }
  }

  // 清理用户自动搜索每天
  for (const [key, entry] of storage.userAutoSearchDaily) {
    if (now > entry.resetAt) {
      storage.userAutoSearchDaily.delete(key);
    }
  }

  // 清理用户深度搜索每天
  for (const [key, entry] of storage.userDeepSearchDaily) {
    if (now > entry.resetAt) {
      storage.userDeepSearchDaily.delete(key);
    }
  }

  // 清理登录失败
  for (const [key, entry] of storage.loginFailure) {
    if (now > entry.resetAt) {
      storage.loginFailure.delete(key);
    }
  }

  logger.debug('[RateLimitService] Cleaned up expired entries');
}

// 启动定时清理（每小时清理一次）
setInterval(cleanupExpired, 60 * 60 * 1000);

// ==================== IP 级别限流 ====================

/**
 * 检查 IP 注册限流（每小时 + 每天）
 * @param {string} ip
 * @returns {{allowed: boolean, reason?: string, limits?: Object}}
 */
function checkIPRegister(ip) {
  const now = Date.now();

  // 检查每小时限制
  let hourlyEntry = storage.ipRegisterHourly.get(ip);
  if (!hourlyEntry || now > hourlyEntry.resetAt) {
    hourlyEntry = {
      count: 0,
      resetAt: now + IP_LIMITS.register.hourly.windowMs,
    };
    storage.ipRegisterHourly.set(ip, hourlyEntry);
  }

  if (hourlyEntry.count >= IP_LIMITS.register.hourly.max) {
    const remainingMs = hourlyEntry.resetAt - now;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return {
      allowed: false,
      reason: `同一IP每小时注册次数超限，请 ${remainingMinutes} 分钟后重试`,
      limits: {
        hourly: {
          limit: IP_LIMITS.register.hourly.max,
          remaining: 0,
          resetIn: remainingMs,
        },
      },
    };
  }

  // 检查每天限制
  let dailyEntry = storage.ipRegisterDaily.get(ip);
  if (!dailyEntry || now > dailyEntry.resetAt) {
    dailyEntry = {
      count: 0,
      resetAt: now + IP_LIMITS.register.daily.windowMs,
    };
    storage.ipRegisterDaily.set(ip, dailyEntry);
  }

  if (dailyEntry.count >= IP_LIMITS.register.daily.max) {
    const remainingMs = dailyEntry.resetAt - now;
    const remainingHours = Math.ceil(remainingMs / 3600000);
    return {
      allowed: false,
      reason: `同一IP每天注册次数超限，请 ${remainingHours} 小时后重试`,
      limits: {
        daily: {
          limit: IP_LIMITS.register.daily.max,
          remaining: 0,
          resetIn: remainingMs,
        },
      },
    };
  }

  return { allowed: true };
}

/**
 * 记录 IP 注册
 * @param {string} ip
 */
function recordIPRegister(ip) {
  const now = Date.now();

  // 更新每小时计数
  let hourlyEntry = storage.ipRegisterHourly.get(ip);
  if (!hourlyEntry || now > hourlyEntry.resetAt) {
    hourlyEntry = {
      count: 0,
      resetAt: now + IP_LIMITS.register.hourly.windowMs,
    };
  }
  hourlyEntry.count++;
  storage.ipRegisterHourly.set(ip, hourlyEntry);

  // 更新每天计数
  let dailyEntry = storage.ipRegisterDaily.get(ip);
  if (!dailyEntry || now > dailyEntry.resetAt) {
    dailyEntry = {
      count: 0,
      resetAt: now + IP_LIMITS.register.daily.windowMs,
    };
  }
  dailyEntry.count++;
  storage.ipRegisterDaily.set(ip, dailyEntry);
}

/**
 * 检查 IP API 请求限流（每分钟）
 * @param {string} ip
 * @returns {{allowed: boolean, reason?: string, remaining?: number}}
 */
function checkIPApiRequest(ip) {
  const now = Date.now();

  let entry = storage.ipApiMinute.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + IP_LIMITS.apiRequest.perMinute.windowMs,
    };
    storage.ipApiMinute.set(ip, entry);
  }

  if (entry.count >= IP_LIMITS.apiRequest.perMinute.max) {
    const remainingMs = entry.resetAt - now;
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    return {
      allowed: false,
      reason: `请求过于频繁，请 ${remainingSeconds} 秒后重试`,
      remaining: 0,
      resetIn: remainingMs,
    };
  }

  return {
    allowed: true,
    remaining: IP_LIMITS.apiRequest.perMinute.max - entry.count - 1,
  };
}

/**
 * 记录 IP API 请求
 * @param {string} ip
 */
function recordIPApiRequest(ip) {
  const now = Date.now();

  let entry = storage.ipApiMinute.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + IP_LIMITS.apiRequest.perMinute.windowMs,
    };
  }
  entry.count++;
  storage.ipApiMinute.set(ip, entry);
}

// ==================== 用户级别限流 ====================

/**
 * 获取用户等级（从用户对象或数据库）
 * @param {Object} req
 * @returns {string} 'free' | 'default' | 'pro'
 */
function getUserLevel(req) {
  // 优先从 req.user 获取
  if (req.user?.linkai?.plan) {
    return req.user.linkai.plan;
  }
  return 'free';
}

/**
 * 检查用户消息限流
 * @param {string} userId
 * @param {string} userLevel
 * @returns {{allowed: boolean, reason?: string, remaining?: number}}
 */
function checkUserMessage(userId, userLevel = 'free') {
  const now = Date.now();
  const config = USER_LIMITS.message[userLevel] || USER_LIMITS.message.free;
  const dailyConfig = config.daily;

  let entry = storage.userMessageDaily.get(userId);
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + dailyConfig.windowMs,
    };
    storage.userMessageDaily.set(userId, entry);
  }

  if (entry.count >= dailyConfig.max) {
    const remainingMs = entry.resetAt - now;
    const remainingHours = Math.ceil(remainingMs / 3600000);
    return {
      allowed: false,
      reason: `免费用户每天消息数量超限（${dailyConfig.max}条），请 ${remainingHours} 小时后重试`,
      remaining: 0,
      resetIn: remainingMs,
    };
  }

  return {
    allowed: true,
    remaining: dailyConfig.max - entry.count - 1,
  };
}

/**
 * 记录用户消息
 * @param {string} userId
 */
function recordUserMessage(userId) {
  const now = Date.now();

  let entry = storage.userMessageDaily.get(userId);
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + USER_LIMITS.message.free.daily.windowMs,
    };
  }
  entry.count++;
  storage.userMessageDaily.set(userId, entry);
}

/**
 * 检查用户搜索限流
 * @param {string} userId
 * @param {'auto' | 'deep'} searchType
 * @param {string} userLevel
 * @returns {{allowed: boolean, reason?: string, remaining?: number}}
 */
function checkUserSearch(userId, searchType, userLevel = 'free') {
  const now = Date.now();
  const config = searchType === 'deep'
    ? USER_LIMITS.deepSearch[userLevel] || USER_LIMITS.deepSearch.free
    : USER_LIMITS.autoSearch[userLevel] || USER_LIMITS.autoSearch.free;

  const dailyConfig = config.daily;

  // 检查是否完全禁用
  if (dailyConfig.max === 0) {
    return {
      allowed: false,
      reason: searchType === 'deep'
        ? '免费用户无法使用深度搜索功能'
        : '搜索次数已用完',
      remaining: 0,
    };
  }

  const storageKey = searchType === 'deep' ? userDeepSearchDaily : userAutoSearchDaily;
  const storageMap = searchType === 'deep' ? storage.userDeepSearchDaily : storage.userAutoSearchDaily;

  let entry = storageMap.get(userId);
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + dailyConfig.windowMs,
    };
    storageMap.set(userId, entry);
  }

  if (entry.count >= dailyConfig.max) {
    const remainingMs = entry.resetAt - now;
    const remainingHours = Math.ceil(remainingMs / 3600000);
    return {
      allowed: false,
      reason: searchType === 'deep'
        ? `免费用户每天深度搜索 ${dailyConfig.max} 次，请 ${remainingHours} 小时后重试`
        : `免费用户每天自动搜索 ${dailyConfig.max} 次，请 ${remainingHours} 小时后重试`,
      remaining: 0,
      resetIn: remainingMs,
    };
  }

  return {
    allowed: true,
    remaining: dailyConfig.max - entry.count - 1,
  };
}

/**
 * 记录用户搜索
 * @param {string} userId
 * @param {'auto' | 'deep'} searchType
 */
function recordUserSearch(userId, searchType) {
  const now = Date.now();
  const storageMap = searchType === 'deep' ? storage.userDeepSearchDaily : storage.userAutoSearchDaily;

  let entry = storageMap.get(userId);
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + (searchType === 'deep'
        ? USER_LIMITS.deepSearch.free.daily.windowMs
        : USER_LIMITS.autoSearch.free.daily.windowMs),
    };
  }
  entry.count++;
  storageMap.set(userId, entry);
}

/**
 * 检查用户并发请求
 * @param {string} userId
 * @param {string} requestId - 唯一请求 ID
 * @param {string} userLevel
 * @returns {{allowed: boolean, reason?: string, concurrent?: number}}
 */
function checkUserConcurrent(userId, requestId, userLevel = 'free') {
  const config = USER_LIMITS.concurrent[userLevel] || USER_LIMITS.concurrent.free;
  const maxConcurrent = config.max;

  let entry = storage.userConcurrent.get(userId);
  if (!entry) {
    entry = { requestIds: new Set() };
    storage.userConcurrent.set(userId, entry);
  }

  // 如果请求已存在，说明是同一个请求（幂等性）
  if (entry.requestIds.has(requestId)) {
    return {
      allowed: true,
      concurrent: entry.requestIds.size,
    };
  }

  // 检查并发数是否超限
  if (entry.requestIds.size >= maxConcurrent) {
    return {
      allowed: false,
      reason: `同时进行的请求数超限（最多 ${maxConcurrent} 个），请等待当前请求完成`,
      concurrent: entry.requestIds.size,
    };
  }

  return {
    allowed: true,
    concurrent: entry.requestIds.size,
  };
}

/**
 * 添加用户并发请求
 * @param {string} userId
 * @param {string} requestId
 */
function addUserConcurrent(userId, requestId) {
  let entry = storage.userConcurrent.get(userId);
  if (!entry) {
    entry = { requestIds: new Set() };
    storage.userConcurrent.set(userId, entry);
  }
  entry.requestIds.add(requestId);
}

/**
 * 移除用户并发请求
 * @param {string} userId
 * @param {string} requestId
 */
function removeUserConcurrent(userId, requestId) {
  const entry = storage.userConcurrent.get(userId);
  if (entry) {
    entry.requestIds.delete(requestId);
    if (entry.requestIds.size === 0) {
      storage.userConcurrent.delete(userId);
    }
  }
}

// ==================== 登录限流 ====================

/**
 * 检查登录失败限流
 * @param {string} email
 * @returns {{allowed: boolean, reason?: string, attempts?: number}}
 */
function checkLoginFailure(email) {
  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();

  let entry = storage.loginFailure.get(normalizedEmail);
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + LOGIN_LIMITS.failure.windowMs,
    };
    storage.loginFailure.set(normalizedEmail, entry);
  }

  if (entry.count >= LOGIN_LIMITS.failure.max) {
    const remainingMs = entry.resetAt - now;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return {
      allowed: false,
      reason: `登录失败次数过多，请在 ${remainingMinutes} 分钟后重试`,
      attempts: entry.count,
    };
  }

  return {
    allowed: true,
    attempts: entry.count,
  };
}

/**
 * 记录登录失败
 * @param {string} email
 */
function recordLoginFailure(email) {
  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();

  let entry = storage.loginFailure.get(normalizedEmail);
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + LOGIN_LIMITS.failure.windowMs,
    };
  }
  entry.count++;
  storage.loginFailure.set(normalizedEmail, entry);
}

/**
 * 清除登录失败记录（登录成功后调用）
 * @param {string} email
 */
function clearLoginFailure(email) {
  const normalizedEmail = email.toLowerCase().trim();
  storage.loginFailure.delete(normalizedEmail);
}

// ==================== 管理函数 ====================

/**
 * 重置用户的所有限流数据
 * @param {string} userId
 */
function resetUser(userId) {
  storage.userMessageDaily.delete(userId);
  storage.userAutoSearchDaily.delete(userId);
  storage.userDeepSearchDaily.delete(userId);
  storage.userConcurrent.delete(userId);
  logger.info(`[RateLimitService] Reset all limits for user ${userId}`);
}

/**
 * 重置 IP 的所有限流数据
 * @param {string} ip
 */
function resetIP(ip) {
  storage.ipRegisterHourly.delete(ip);
  storage.ipRegisterDaily.delete(ip);
  storage.ipApiMinute.delete(ip);
  logger.info(`[RateLimitService] Reset all limits for IP ${ip}`);
}

/**
 * 清除所有限流数据
 */
function clearAll() {
  storage.ipRegisterHourly.clear();
  storage.ipRegisterDaily.clear();
  storage.ipApiMinute.clear();
  storage.userMessageDaily.clear();
  storage.userAutoSearchDaily.clear();
  storage.userDeepSearchDaily.clear();
  storage.userConcurrent.clear();
  storage.loginFailure.clear();
  logger.info('[RateLimitService] Cleared all rate limit data');
}

/**
 * 获取当前存储状态（调试用）
 */
function getStats() {
  return {
    ipRegisterHourly: storage.ipRegisterHourly.size,
    ipRegisterDaily: storage.ipRegisterDaily.size,
    ipApiMinute: storage.ipApiMinute.size,
    userMessageDaily: storage.userMessageDaily.size,
    userAutoSearchDaily: storage.userAutoSearchDaily.size,
    userDeepSearchDaily: storage.userDeepSearchDaily.size,
    userConcurrent: storage.userConcurrent.size,
    loginFailure: storage.loginFailure.size,
  };
}

// ==================== 导出 ====================

module.exports = {
  // IP 级别
  checkIPRegister,
  recordIPRegister,
  checkIPApiRequest,
  recordIPApiRequest,

  // 用户级别
  getUserLevel,
  checkUserMessage,
  recordUserMessage,
  checkUserSearch,
  recordUserSearch,
  checkUserConcurrent,
  addUserConcurrent,
  removeUserConcurrent,

  // 登录限流
  checkLoginFailure,
  recordLoginFailure,
  clearLoginFailure,

  // 管理
  resetUser,
  resetIP,
  clearAll,
  getStats,
  logRateLimit,

  // 辅助
  getClientIP,
  getUserId,

  // 配置（供中间件使用）
  IP_LIMITS,
  USER_LIMITS,
  LOGIN_LIMITS,
};
