# Link-AI Chat 点数系统文档

## 概述

Link-AI Chat 点数系统为用户提供搜索功能的计费管理。

## 一、数据库字段设计

### User 表新增字段

```javascript
{
  linkai: {
    // 套餐信息
    plan: "free",              // free | weekly | monthly | pro
    credits: 100,              // 当前剩余点数
    creditsTotal: 100,         // 累计获得点数
    expiresAt: null,           // 套餐到期时间

    // 每日使用统计
    dailyUsage: {
      autoSearchCount: 0,     // 今日自动搜索次数
      deepSearchCount: 0,     // 今日深度搜索次数
      lastResetDate: "2026-05-11"  // 最后重置日期
    },

    // 使用统计
    totalUsage: {
      chatCount: 0,           // 累计对话次数
      searchCount: 0,         // 累计搜索次数
      deepSearchCount: 0      // 累计深度搜索次数
    },

    // 套餐配置
    planConfig: {
      free: { dailyAutoSearchLimit: 20, dailyDeepSearchLimit: 0, deepSearchEnabled: false },
      weekly: { dailyAutoSearchLimit: 100, dailyDeepSearchLimit: 5, deepSearchEnabled: true },
      monthly: { dailyAutoSearchLimit: 100, dailyDeepSearchLimit: 5, deepSearchEnabled: true },
      pro: { dailyAutoSearchLimit: 300, dailyDeepSearchLimit: 20, deepSearchEnabled: true }
    }
  }
}
```

### 索引

```javascript
db.users.createIndex({ "linkai.plan": 1 })
db.users.createIndex({ "linkai.expiresAt": 1 })
db.users.createIndex({ "linkai.dailyUsage.lastResetDate": 1 })
```

---

## 二、API 接口设计

### 基础信息

- 基础路径: `/api/credits`
- 认证: JWT Token

### 接口列表

#### 1. 获取用户点数状态

```
GET /api/credits/status
```

响应:
```json
{
  "success": true,
  "data": {
    "plan": "free",
    "planName": "体验版",
    "credits": 100,
    "expiresAt": null,
    "dailyLimits": { "autoSearch": 20, "deepSearch": 0 },
    "dailyUsage": { "autoSearch": 5, "deepSearch": 0 },
    "dailyRemaining": { "autoSearch": 15, "deepSearch": 0 },
    "deepSearchEnabled": false,
    "nextResetAt": 1746912000000
  }
}
```

#### 2. 预览扣点

```
POST /api/credits/preview
Body: { "model": "gpt-5.4-mini", "searchMode": "auto" }
```

响应:
```json
{
  "success": true,
  "data": {
    "totalCredits": 2,
    "breakdown": { "chat": 1, "advancedModel": 0, "search": 1 },
    "balance": 100,
    "canAfford": true,
    "balanceAfter": 98
  }
}
```

#### 3. 检查搜索权限

```
POST /api/credits/check-search
Body: { "searchType": "auto" }
```

响应:
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "remaining": 15,
    "resetAt": 1746912000000
  }
}
```

#### 4. 获取计费配置

```
GET /api/credits/config
```

响应:
```json
{
  "success": true,
  "data": {
    "costs": {
      "chat": 1,
      "advancedModel": 3,
      "autoSearch": 1,
      "deepSearch": 8
    },
    "dailyLimits": {
      "free": { "autoSearch": 20, "deepSearch": 0 },
      "weekly": { "autoSearch": 100, "deepSearch": 5 },
      "monthly": { "autoSearch": 100, "deepSearch": 5 },
      "pro": { "autoSearch": 300, "deepSearch": 20 }
    },
    "planNames": {
      "free": "体验版",
      "weekly": "周卡",
      "monthly": "月卡",
      "pro": "专业版"
    }
  }
}
```

#### 5. 初始化点数

```
POST /api/credits/initialize
```

响应:
```json
{
  "success": true,
  "data": {
    "credits": 100,
    "plan": "free"
  }
}
```

---

## 三、扣点规则

| 操作 | 消耗点数 |
|------|----------|
| 普通聊天 | 1 点 |
| 高级模型（GPT Pro/Gemini Pro/Claude Opus） | +3 点 |
| 自动搜索 | +1 点 |
| 深度搜索 Beta | +8 点 |

### 示例计算

| 场景 | 消耗点数 |
|------|----------|
| GPT Fast 普通聊天 | 1 点 |
| GPT Fast + 自动搜索 | 2 点 |
| GPT Pro 普通聊天 | 4 点 |
| GPT Pro + 深度搜索 | 12 点 |

---

## 四、每日限制

| 套餐 | 自动搜索/天 | 深度搜索/天 |
|------|-------------|-------------|
| 体验版 | 20 | 0（不可用） |
| 周卡 | 100 | 5 |
| 月卡 | 100 | 5 |
| 专业版 | 300 | 20 |

---

## 五、测试步骤

### 1. 环境准备

```bash
# 确保 MongoDB 运行中
# 确保 Redis 运行中（如使用）

# 启动服务
cd linkai-chat
docker compose up -d
```

### 2. 初始化测试用户

```javascript
// 在 MongoDB 中创建测试用户
db.users.insertOne({
  email: "test@example.com",
  name: "Test User",
  password: "hashed_password",
  provider: "local",
  emailVerified: true,
  role: "USER",
  linkai: {
    plan: "free",
    credits: 100,
    creditsTotal: 100,
    expiresAt: null,
    dailyUsage: {
      autoSearchCount: 0,
      deepSearchCount: 0,
      lastResetDate: null
    },
    totalUsage: {
      chatCount: 0,
      searchCount: 0,
      deepSearchCount: 0
    },
    planConfig: {
      free: { dailyAutoSearchLimit: 20, dailyDeepSearchLimit: 0, deepSearchEnabled: false },
      weekly: { dailyAutoSearchLimit: 100, dailyDeepSearchLimit: 5, deepSearchEnabled: true },
      monthly: { dailyAutoSearchLimit: 100, dailyDeepSearchLimit: 5, deepSearchEnabled: true },
      pro: { dailyAutoSearchLimit: 300, dailyDeepSearchLimit: 20, deepSearchEnabled: true }
    }
  }
})
```

### 3. 获取 JWT Token

```bash
curl -X POST http://localhost:3080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 4. 测试 API

```bash
# 获取 Token（替换 YOUR_TOKEN）
TOKEN="your_jwt_token"

# 获取点数状态
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3080/api/credits/status

# 预览扣点
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.4-mini","searchMode":"auto"}' \
  http://localhost:3080/api/credits/preview

# 检查搜索权限
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"searchType":"auto"}' \
  http://localhost:3080/api/credits/check-search

# 获取配置
curl http://localhost:3080/api/credits/config
```

### 5. 测试超限

```javascript
// 模拟超限：在 MongoDB 中设置已使用次数
db.users.updateOne(
  { email: "test@example.com" },
  { $set: { "linkai.dailyUsage.autoSearchCount": 20 } }
)

// 再次检查
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"searchType":"auto"}' \
  http://localhost:3080/api/credits/check-search

// 预期返回: { "allowed": false, "reason": "daily_limit_exceeded" }
```

### 6. 测试深度搜索权限

```javascript
// 为免费用户开启深度搜索
db.users.updateOne(
  { email: "test@example.com" },
  { $set: { "linkai.planConfig.free.deepSearchEnabled": true } }
)

// 检查深度搜索权限
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"searchType":"deep"}' \
  http://localhost:3080/api/credits/check-search

// 预期返回: { "allowed": true }
```

---

## 六、管理员操作

### 查看所有用户余额

```javascript
db.users.find(
  {},
  { projection: { email: 1, "linkai.credits": 1, "linkai.plan": 1 } }
).sort({ "linkai.credits": -1 })
```

### 修改用户余额

```javascript
// 增加余额
db.users.updateOne(
  { _id: ObjectId("用户ID") },
  { $inc: { "linkai.credits": 100 } }
)

// 设置特定余额
db.users.updateOne(
  { _id: ObjectId("用户ID") },
  { $set: { "linkai.credits": 500 } }
)
```

### 设置用户套餐

```javascript
// 设置月卡
db.users.updateOne(
  { _id: ObjectId("用户ID") },
  {
    $set: {
      "linkai.plan": "monthly",
      "linkai.expiresAt": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  }
)
```

### 开启免费用户深度搜索

```javascript
db.users.updateOne(
  { _id: ObjectId("用户ID") },
  { $set: { "linkai.planConfig.free.deepSearchEnabled": true } }
)
```

---

## 七、后续扩展

1. **支付接入**: 添加支付接口，支持充值
2. **订阅系统**: 对接 Stripe/微信/支付宝
3. **Redis 缓存**: 替换内存缓存，支持分布式部署
4. **每日重置定时任务**: 添加 cron job 自动重置每日统计
5. **积分商城**: 增加积分兑换功能
