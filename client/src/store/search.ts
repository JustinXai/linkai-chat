import { atom } from 'recoil';

/**
 * 搜索模式类型
 * - off: 不联网
 * - auto: 自动搜索
 * - deep: 深度搜索 Beta
 */
export type SearchMode = 'off' | 'auto' | 'deep';

/**
 * 当前搜索模式
 */
const searchMode = atom<SearchMode>({
  key: 'searchMode',
  default: 'auto', // 默认自动搜索
});

/**
 * 搜索模式配置（从服务端获取）
 */
const searchConfig = atom({
  key: 'searchConfig',
  default: {
    costs: {
      chat: 1,
      advancedModel: 3,
      autoSearch: 1,
      deepSearch: 8,
    },
    dailyLimits: {
      free: { autoSearch: 20, deepSearch: 0 },
      weekly: { autoSearch: 100, deepSearch: 5 },
      monthly: { autoSearch: 100, deepSearch: 5 },
      pro: { autoSearch: 300, deepSearch: 20 },
    },
    planNames: {
      free: '体验版',
      weekly: '周卡',
      monthly: '月卡',
      pro: '专业版',
    },
  },
});

/**
 * 用户额度状态
 */
const creditsStatus = atom({
  key: 'creditsStatus',
  default: {
    plan: 'free',
    planName: '体验版',
    credits: 100,
    expiresAt: null,
    dailyLimits: { autoSearch: 20, deepSearch: 0 },
    dailyUsage: { autoSearch: 0, deepSearch: 0 },
    dailyRemaining: { autoSearch: 20, deepSearch: 0 },
    deepSearchEnabled: false,
    nextResetAt: null,
  },
});

export default { searchMode, searchConfig, creditsStatus };
