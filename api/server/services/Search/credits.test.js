/**
 * Credits System Tests
 * 点数系统测试
 *
 * 测试场景：
 * 1. 新注册用户默认 100 点
 * 2. 发一条普通消息后变成 99 点
 * 3. 开自动搜索后额外扣点
 * 4. 深度搜索 free 用户应提示不可用
 * 5. 点数不足时阻止发送
 */

const { calculateCredits, getDailyLimits, CREDIT_COSTS } = require('./credits');

describe('Credits Service', () => {
  describe('calculateCredits', () => {
    test('普通聊天消耗 1 点', () => {
      const result = calculateCredits({ model: 'gpt-4o-mini', searchMode: 'off' });
      expect(result.totalCredits).toBe(1);
      expect(result.breakdown.chat).toBe(1);
    });

    test('高级模型额外消耗 3 点', () => {
      const result = calculateCredits({ model: 'gpt-5.5', searchMode: 'off' });
      expect(result.totalCredits).toBe(4);
      expect(result.breakdown.advancedModel).toBe(3);
    });

    test('自动搜索额外消耗 1 点', () => {
      const result = calculateCredits({ model: 'gpt-4o-mini', searchMode: 'auto' });
      expect(result.totalCredits).toBe(2);
      expect(result.breakdown.search).toBe(1);
    });

    test('深度搜索额外消耗 8 点', () => {
      const result = calculateCredits({ model: 'gpt-4o-mini', searchMode: 'deep' });
      expect(result.totalCredits).toBe(9);
      expect(result.breakdown.search).toBe(8);
    });

    test('高级模型 + 深度搜索消耗 12 点', () => {
      const result = calculateCredits({ model: 'claude-opus-4-7', searchMode: 'deep' });
      expect(result.totalCredits).toBe(12);
      expect(result.breakdown.chat).toBe(1);
      expect(result.breakdown.advancedModel).toBe(3);
      expect(result.breakdown.search).toBe(8);
    });

    test('默认 searchMode 为 off', () => {
      const result = calculateCredits({ model: 'gpt-4o-mini' });
      expect(result.totalCredits).toBe(1);
    });
  });

  describe('getDailyLimits', () => {
    test('free 用户每日自动搜索限制为 20', () => {
      const limits = getDailyLimits('free');
      expect(limits.autoSearch).toBe(20);
      expect(limits.deepSearch).toBe(0);
    });

    test('weekly 用户每日自动搜索限制为 100，深度搜索为 5', () => {
      const limits = getDailyLimits('weekly');
      expect(limits.autoSearch).toBe(100);
      expect(limits.deepSearch).toBe(5);
    });

    test('monthly 用户同 weekly', () => {
      const limits = getDailyLimits('monthly');
      expect(limits.autoSearch).toBe(100);
      expect(limits.deepSearch).toBe(5);
    });

    test('pro 用户每日自动搜索限制为 300，深度搜索为 20', () => {
      const limits = getDailyLimits('pro');
      expect(limits.autoSearch).toBe(300);
      expect(limits.deepSearch).toBe(20);
    });

    test('未知套餐默认为 free 限制', () => {
      const limits = getDailyLimits('unknown');
      expect(limits.autoSearch).toBe(20);
    });
  });

  describe('CREDIT_COSTS', () => {
    test('CREDIT_COSTS 配置正确', () => {
      expect(CREDIT_COSTS.chat).toBe(1);
      expect(CREDIT_COSTS.advancedModel).toBe(3);
      expect(CREDIT_COSTS.autoSearch).toBe(1);
      expect(CREDIT_COSTS.deepSearch).toBe(8);
    });
  });
});

describe('Credits API Integration', () => {
  const mockUser = {
    _id: { toString: () => 'test-user-id' },
    id: 'test-user-id',
    linkai: {
      plan: 'free',
      credits: 100,
      creditsTotal: 100,
      expiresAt: null,
      dailyUsage: {
        autoSearchCount: 0,
        deepSearchCount: 0,
        lastResetDate: null,
      },
      totalUsage: {
        chatCount: 0,
        searchCount: 0,
        deepSearchCount: 0,
      },
      planConfig: {
        free: { dailyAutoSearchLimit: 20, dailyDeepSearchLimit: 0, deepSearchEnabled: false },
        weekly: { dailyAutoSearchLimit: 100, dailyDeepSearchLimit: 5, deepSearchEnabled: true },
        monthly: { dailyAutoSearchLimit: 100, dailyDeepSearchLimit: 5, deepSearchEnabled: true },
        pro: { dailyAutoSearchLimit: 300, dailyDeepSearchLimit: 20, deepSearchEnabled: true },
      },
    },
  };

  describe('getUserStatus', () => {
    test('新用户默认 100 点，体验版', () => {
      const { creditsService } = require('./credits');
      const status = creditsService.getUserStatus(mockUser);

      expect(status.credits).toBe(100);
      expect(status.plan).toBe('free');
      expect(status.planName).toBe('体验版');
      expect(status.dailyLimits.autoSearch).toBe(20);
      expect(status.dailyRemaining.autoSearch).toBe(20);
    });

    test('深度搜索默认不可用（free 用户）', () => {
      const { creditsService } = require('./credits');
      const status = creditsService.getUserStatus(mockUser);

      expect(status.deepSearchEnabled).toBe(false);
    });
  });

  describe('checkSearchAccess', () => {
    test('free 用户深度搜索应被拒绝', () => {
      const { creditsService } = require('./credits');
      const check = creditsService.checkSearchAccess(mockUser, 'deep');

      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('deep_search_not_enabled');
    });

    test('free 用户自动搜索在限制内应通过', () => {
      const { creditsService } = require('./credits');
      const check = creditsService.checkSearchAccess(mockUser, 'auto');

      expect(check.allowed).toBe(true);
      expect(check.remaining).toBe(20);
    });

    test('深度搜索次数用完后应拒绝', () => {
      const { creditsService } = require('./credits');
      const { DAILY_LIMITS } = require('./credits');

      // 模拟用户已用完深度搜索次数（weekly 用户）
      const weeklyUser = {
        ...mockUser,
        linkai: {
          ...mockUser.linkai,
          plan: 'weekly',
          dailyUsage: {
            autoSearchCount: 0,
            deepSearchCount: DAILY_LIMITS.weekly.deepSearch, // 用完
            lastResetDate: new Date().toISOString().split('T')[0],
          },
        },
      };

      const check = creditsService.checkSearchAccess(weeklyUser, 'deep');
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('daily_limit_exceeded');
    });
  });

  describe('checkBalance', () => {
    test('余额充足时允许', () => {
      const { creditsService } = require('./credits');
      const check = creditsService.checkBalance(mockUser, 50);

      expect(check.allowed).toBe(true);
      expect(check.balance).toBe(100);
    });

    test('余额不足时拒绝', () => {
      const { creditsService } = require('./credits');
      const check = creditsService.checkBalance(mockUser, 150);

      expect(check.allowed).toBe(false);
      expect(check.shortfall).toBe(50);
    });
  });
});

describe('Integration Scenarios', () => {
  describe('场景测试', () => {
    test('场景1: 新注册用户默认 100 点', () => {
      const { creditsService } = require('./credits');
      const newUser = {
        _id: { toString: () => 'new-user' },
        id: 'new-user',
        linkai: {
          plan: 'free',
          credits: 100,
          creditsTotal: 100,
          expiresAt: null,
          dailyUsage: { autoSearchCount: 0, deepSearchCount: 0, lastResetDate: null },
          totalUsage: { chatCount: 0, searchCount: 0, deepSearchCount: 0 },
          planConfig: {},
        },
      };

      const status = creditsService.getUserStatus(newUser);
      expect(status.credits).toBe(100);
      expect(status.plan).toBe('free');
    });

    test('场景2: 普通聊天扣 1 点', () => {
      const { calculateCredits } = require('./credits');
      const result = calculateCredits({ model: 'gpt-4o-mini', searchMode: 'off' });
      expect(result.totalCredits).toBe(1);
    });

    test('场景3: 自动搜索额外扣 1 点', () => {
      const { calculateCredits } = require('./credits');
      const result = calculateCredits({ model: 'gpt-4o-mini', searchMode: 'auto' });
      expect(result.totalCredits).toBe(2); // 1 + 1
    });

    test('场景4: free 用户深度搜索不可用', () => {
      const { creditsService } = require('./credits');
      const freeUser = {
        _id: { toString: () => 'free-user' },
        id: 'free-user',
        linkai: {
          plan: 'free',
          credits: 100,
          creditsTotal: 100,
          expiresAt: null,
          dailyUsage: { autoSearchCount: 0, deepSearchCount: 0, lastResetDate: null },
          totalUsage: { chatCount: 0, searchCount: 0, deepSearchCount: 0 },
          planConfig: {
            free: { dailyAutoSearchLimit: 20, dailyDeepSearchLimit: 0, deepSearchEnabled: false },
          },
        },
      };

      const check = creditsService.checkSearchAccess(freeUser, 'deep');
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('deep_search_not_enabled');
    });

    test('场景5: 点数不足时计算 shortfall', () => {
      const { creditsService } = require('./credits');
      const poorUser = {
        _id: { toString: () => 'poor-user' },
        id: 'poor-user',
        linkai: {
          plan: 'free',
          credits: 5,
          creditsTotal: 100,
          expiresAt: null,
          dailyUsage: { autoSearchCount: 0, deepSearchCount: 0, lastResetDate: null },
          totalUsage: { chatCount: 0, searchCount: 0, deepSearchCount: 0 },
          planConfig: {},
        },
      };

      // 深度搜索需要 9 点（1 + 8）
      const check = creditsService.checkBalance(poorUser, 9);
      expect(check.allowed).toBe(false);
      expect(check.shortfall).toBe(4); // 需要 9，只有 5
    });
  });
});
