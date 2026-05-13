/**
 * rateLimitMiddleware.js
 * 限流中间件集合
 *
 * 提供各种限流检查中间件
 */

const crypto = require('crypto');
const RateLimitService = require('~/server/services/RateLimitService');

// ==================== 辅助函数 ====================

/**
 * 生成唯一请求 ID
 * @param {Object} req
 * @returns {string}
 */
function generateRequestId(req) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const ip = RateLimitService.getClientIP(req);
  return `${ip}-${timestamp}-${random}`;
}

/**
 * 创建限流拒绝响应
 * @param {Object} res
 * @param {string} message - 中文错误消息
 * @param {string} [reason] - 限流原因
 */
function sendRateLimitResponse(res, message, reason) {
  return res.status(429).json({
    error: 'RATE_LIMIT_EXCEEDED',
    message,
    reason: reason || 'rate_limit_exceeded',
    retryAfter: null, // 可由具体中间件设置
  });
}

// ==================== IP 级别限流中间件 ====================

/**
 * IP 注册限流中间件
 * 检查同 IP 每小时/每天注册次数
 */
function ipRegisterLimiter(req, res, next) {
  const ip = RateLimitService.getClientIP(req);

  const result = RateLimitService.checkIPRegister(ip);

  if (!result.allowed) {
    RateLimitService.logRateLimit({
      ip,
      action: 'register',
      reason: result.reason,
    });

    return sendRateLimitResponse(res, result.reason, 'ip_register_limit');
  }

  // 记录本次请求
  RateLimitService.recordIPRegister(ip);
  next();
}

/**
 * IP API 请求限流中间件
 * 检查同 IP 每分钟 API 请求数
 */
function ipApiLimiter(req, res, next) {
  const ip = RateLimitService.getClientIP(req);

  const result = RateLimitService.checkIPApiRequest(ip);

  if (!result.allowed) {
    RateLimitService.logRateLimit({
      ip,
      action: 'api_request',
      reason: result.reason,
    });

    return sendRateLimitResponse(res, result.reason, 'ip_api_limit');
  }

  // 记录本次请求
  RateLimitService.recordIPApiRequest(ip);
  next();
}

// ==================== 用户级别限流中间件 ====================

/**
 * 用户消息限流中间件
 * 检查免费用户每天消息数量
 */
function userMessageLimiter(req, res, next) {
  const userId = RateLimitService.getUserId(req);
  if (!userId) {
    return next();
  }

  const userLevel = RateLimitService.getUserLevel(req);

  // 非免费用户跳过检查
  if (userLevel !== 'free') {
    return next();
  }

  const result = RateLimitService.checkUserMessage(userId, userLevel);

  if (!result.allowed) {
    RateLimitService.logRateLimit({
      ip: RateLimitService.getClientIP(req),
      userId,
      action: 'message',
      reason: result.reason,
    });

    return sendRateLimitResponse(res, result.reason, 'user_message_limit');
  }

  // 记录本次消息
  RateLimitService.recordUserMessage(userId);
  next();
}

/**
 * 用户搜索限流中间件
 * 检查免费用户每天搜索次数
 */
function userSearchLimiter(req, res, next) {
  const userId = RateLimitService.getUserId(req);
  if (!userId) {
    return next();
  }

  const { searchMode = 'off' } = req.body || {};
  if (searchMode === 'off') {
    return next();
  }

  const userLevel = RateLimitService.getUserLevel(req);
  const searchType = searchMode === 'deep' ? 'deep' : 'auto';

  const result = RateLimitService.checkUserSearch(userId, searchType, userLevel);

  if (!result.allowed) {
    RateLimitService.logRateLimit({
      ip: RateLimitService.getClientIP(req),
      userId,
      action: 'search',
      reason: result.reason,
    });

    return sendRateLimitResponse(res, result.reason, 'user_search_limit');
  }

  // 记录本次搜索
  RateLimitService.recordUserSearch(userId, searchType);
  next();
}

/**
 * 用户并发限流中间件
 * 检查同一用户并发请求数
 */
function userConcurrentLimiter(req, res, next) {
  const userId = RateLimitService.getUserId(req);
  if (!userId) {
    return next();
  }

  const requestId = generateRequestId(req);
  const userLevel = RateLimitService.getUserLevel(req);

  const result = RateLimitService.checkUserConcurrent(userId, requestId, userLevel);

  if (!result.allowed) {
    RateLimitService.logRateLimit({
      ip: RateLimitService.getClientIP(req),
      userId,
      action: 'concurrent_request',
      reason: result.reason,
    });

    return sendRateLimitResponse(res, result.reason, 'user_concurrent_limit');
  }

  // 添加到并发列表
  RateLimitService.addUserConcurrent(userId, requestId);

  // 将 requestId 挂载到 req 上，用于请求结束时清理
  req.rateLimitRequestId = requestId;

  // 设置响应完成后清理
  const cleanup = () => {
    RateLimitService.removeUserConcurrent(userId, requestId);
  };

  res.on('finish', cleanup);
  res.on('close', cleanup);

  next();
}

// ==================== 登录限流中间件 ====================

/**
 * 邮箱登录失败限流中间件
 * 检查同邮箱登录失败次数
 *
 * 注意：此中间件需要在登录逻辑之后调用，用于记录失败
 * 实际检查在登录逻辑之前进行
 */
function emailLoginFailureLimiter(req, res, next) {
  const { email } = req.body || {};

  if (!email) {
    return next();
  }

  const result = RateLimitService.checkLoginFailure(email);

  if (!result.allowed) {
    RateLimitService.logRateLimit({
      ip: RateLimitService.getClientIP(req),
      action: 'login_failure',
      reason: result.reason,
    });

    return sendRateLimitResponse(res, result.reason, 'login_failure_limit');
  }

  next();
}

/**
 * 记录登录失败（登录失败后调用）
 * @param {string} email
 */
function recordLoginFailure(email) {
  RateLimitService.recordLoginFailure(email);
}

/**
 * 清除登录失败记录（登录成功后调用）
 * @param {string} email
 */
function clearLoginFailure(email) {
  RateLimitService.clearLoginFailure(email);
}

// ==================== 导出 ====================

module.exports = {
  // IP 级别
  ipRegisterLimiter,
  ipApiLimiter,

  // 用户级别
  userMessageLimiter,
  userSearchLimiter,
  userConcurrentLimiter,

  // 登录限流
  emailLoginFailureLimiter,
  recordLoginFailure,
  clearLoginFailure,

  // 辅助
  generateRequestId,
  sendRateLimitResponse,

  // 导出服务（供路由直接使用）
  RateLimitService,
};
