/**
 * Credits API Routes
 * 点数系统 API
 */

const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const { creditsService, calculateCredits, CREDIT_COSTS, DAILY_LIMITS } = require('./credits');

const router = express.Router();

/**
 * GET /api/credits/status
 * 获取用户点数状态
 */
router.get('/status', requireJwtAuth, async (req, res) => {
  try {
    const user = req.user;
    const status = creditsService.getUserStatus(user);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('[CreditsAPI] Error getting status:', error);
    res.status(500).json({
      success: false,
      error: '获取状态失败',
    });
  }
});

/**
 * POST /api/credits/preview
 * 预览扣点（不实际扣点）
 *
 * Body: { model, searchMode }
 */
router.post('/preview', requireJwtAuth, async (req, res) => {
  try {
    const { model, searchMode } = req.body;

    const preview = calculateCredits({ model, searchMode });
    const user = req.user;
    const balance = creditsService.checkBalance(user, preview.totalCredits);

    res.json({
      success: true,
      data: {
        ...preview,
        balance: balance.balance,
        canAfford: balance.allowed,
        balanceAfter: balance.allowed ? balance.remaining : balance.balance,
      },
    });
  } catch (error) {
    logger.error('[CreditsAPI] Error preview:', error);
    res.status(500).json({
      success: false,
      error: '预览失败',
    });
  }
});

/**
 * POST /api/credits/check-search
 * 检查搜索权限
 *
 * Body: { searchType: 'auto' | 'deep' }
 */
router.post('/check-search', requireJwtAuth, async (req, res) => {
  try {
    const { searchType } = req.body;
    const user = req.user;

    const check = creditsService.checkSearchAccess(user, searchType);

    res.json({
      success: true,
      data: check,
    });
  } catch (error) {
    logger.error('[CreditsAPI] Error checking search:', error);
    res.status(500).json({
      success: false,
      error: '检查失败',
    });
  }
});

/**
 * GET /api/credits/config
 * 获取计费配置（不含敏感信息）
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      costs: CREDIT_COSTS,
      dailyLimits: DAILY_LIMITS,
      planNames: {
        free: '体验版',
        weekly: '周卡',
        monthly: '月卡',
        pro: '专业版',
      },
    },
  });
});

/**
 * POST /api/credits/deduct
 * 扣点（内部接口，通常由消息处理调用）
 *
 * Body: { credits, searchMode }
 */
router.post('/deduct', requireJwtAuth, async (req, res) => {
  try {
    const { credits, searchMode } = req.body;
    const user = req.user;

    // 验证扣点数量
    if (!credits || credits < 1) {
      return res.status(400).json({
        success: false,
        error: '无效的扣点数量',
      });
    }

    // 扣点
    const result = await creditsService.deductCredits(user, credits, { searchMode });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: {
        deducted: result.deducted,
        newBalance: result.newBalance,
      },
    });
  } catch (error) {
    logger.error('[CreditsAPI] Error deducting:', error);
    res.status(500).json({
      success: false,
      error: '扣点失败',
    });
  }
});

/**
 * POST /api/credits/initialize
 * 初始化用户点数（新用户注册时调用）
 */
router.post('/initialize', requireJwtAuth, async (req, res) => {
  try {
    const user = req.user;
    const result = await creditsService.initializeCredits(user);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: {
        credits: result.credits,
        plan: result.plan,
      },
    });
  } catch (error) {
    logger.error('[CreditsAPI] Error initializing:', error);
    res.status(500).json({
      success: false,
      error: '初始化失败',
    });
  }
});

module.exports = router;
