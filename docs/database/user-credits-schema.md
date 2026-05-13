-- ============================================
-- Link-AI Chat 用户点数系统数据库字段设计
-- ============================================

-- 在 User 表中添加以下字段（MongoDB）

-- 用户套餐信息
{
  "linkai": {
    "plan": "free",              -- 套餐类型: free(体验版), weekly(周卡), monthly(月卡), pro(专业版)
    "credits": 100,              -- 当前剩余点数
    "creditsTotal": 100,         -- 累计获得的点数（不含消耗）
    "expiresAt": null,           -- 套餐到期时间（周卡/月卡有效，free/null 为永久）

    -- 每日搜索使用统计
    "dailyUsage": {
      "autoSearchCount": 0,     -- 今日自动搜索次数
      "deepSearchCount": 0,     -- 今日深度搜索次数
      "lastResetDate": "2026-05-11"  -- 最后重置日期
    },

    -- 使用统计
    "totalUsage": {
      "chatCount": 0,           -- 累计对话次数
      "searchCount": 0,         -- 累计搜索次数
      "deepSearchCount": 0       -- 累计深度搜索次数
    },

    -- 套餐配置（不可改）
    "planConfig": {
      "free": {
        "dailyAutoSearchLimit": 20,   -- 免费用户每日自动搜索次数
        "dailyDeepSearchLimit": 0,    -- 免费用户每日深度搜索次数（默认不可用）
        "deepSearchEnabled": false      -- 是否启用深度搜索（需管理员开启）
      },
      "weekly": {
        "dailyAutoSearchLimit": 100,
        "dailyDeepSearchLimit": 5,
        "deepSearchEnabled": true
      },
      "monthly": {
        "dailyAutoSearchLimit": 100,
        "dailyDeepSearchLimit": 5,
        "deepSearchEnabled": true
      },
      "pro": {
        "dailyAutoSearchLimit": 300,
        "dailyDeepSearchLimit": 20,
        "deepSearchEnabled": true
      }
    }
  }
}

-- ============================================
-- 字段说明
-- ============================================

-- 1. plan (套餐类型)
--    - "free": 体验版（新注册用户默认）
--    - "weekly": 周卡
--    - "monthly": 月卡
--    - "pro": 专业版

-- 2. credits (剩余点数)
--    - 新用户默认 100 点
--    - 每次对话消耗点数
--    - 消耗后不可恢复

-- 3. expiresAt (到期时间)
--    - null: 永久有效（体验版）
--    - Date: 到期日期（周卡/月卡）

-- 4. dailyUsage (每日使用)
--    - 每天 00:00 UTC 重置
--    - 记录当日搜索次数

-- 5. deepSearchEnabled (深度搜索权限)
--    - 免费用户默认 false
--    - 管理员可通过 MongoDB 直接设置为 true

-- ============================================
-- 索引设计
-- ============================================

db.users.createIndex({ "linkai.plan": 1 })
db.users.createIndex({ "linkai.expiresAt": 1 })
db.users.createIndex({ "linkai.dailyUsage.lastResetDate": 1 })

-- ============================================
-- MongoDB 操作示例
-- ============================================

-- 查看用户点数信息
db.users.findOne(
  { _id: ObjectId("用户ID") },
  { projection: { linkai: 1, email: 1 } }
)

-- 为免费用户开启深度搜索
db.users.updateOne(
  { _id: ObjectId("用户ID") },
  { $set: { "linkai.planConfig.free.deepSearchEnabled": true } }
)

-- 重置每日使用统计（定时任务）
db.users.updateMany(
  {},
  [
    {
      $set: {
        "linkai.dailyUsage": {
          "autoSearchCount": 0,
          "deepSearchCount": 0,
          "lastResetDate": new Date().toISOString().split('T')[0]
        }
      }
    }
  ]
)

-- 查看所有用户点数余额
db.users.find(
  {},
  { projection: { email: 1, "linkai.credits": 1, "linkai.plan": 1 } }
).sort({ "linkai.credits": -1 })

-- 管理员修改用户点数
db.users.updateOne(
  { _id: ObjectId("用户ID") },
  { $set: { "linkai.credits": 500 } }
)

-- 管理员设置用户套餐
db.users.updateOne(
  { _id: ObjectId("用户ID") },
  {
    $set: {
      "linkai.plan": "monthly",
      "linkai.expiresAt": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  -- 30天后
    }
  }
)
