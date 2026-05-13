import { createUserModel } from './user';
import { createTokenModel } from './token';
import { createSessionModel } from './session';
import { createBalanceModel } from './balance';
import { createConversationModel } from './convo';
import { createMessageModel } from './message';
import { createAgentModel } from './agent';
import { createAgentApiKeyModel } from './agentApiKey';
import { createAgentCategoryModel } from './agentCategory';
import { createMCPServerModel } from './mcpServer';
import { createRoleModel } from './role';
import { createActionModel } from './action';
import { createAssistantModel } from './assistant';
import { createFileModel } from './file';
import { createBannerModel } from './banner';
import { createKeyModel } from './key';
import { createPluginAuthModel } from './pluginAuth';
import { createTransactionModel } from './transaction';
import { createPresetModel } from './preset';
import { createPromptModel } from './prompt';
import { createPromptGroupModel } from './promptGroup';
import { createSkillModel } from './skill';
import { createSkillFileModel } from './skillFile';
import { createConversationTagModel } from './conversationTag';
import { createSharedLinkModel } from './sharedLink';
import { createToolCallModel } from './toolCall';
import { createMemoryModel } from './memory';
import { createAccessRoleModel } from './accessRole';
import { createAclEntryModel } from './aclEntry';
import { createSystemGrantModel } from './systemGrant';
import { createGroupModel } from './group';
import { createConfigModel } from './config';

/**
 * Creates all database models for all collections
 */
export function createModels(mongoose: typeof import('mongoose')) {
  return {
    User: createUserModel(mongoose),
    Token: createTokenModel(mongoose),
    Session: createSessionModel(mongoose),
    Balance: createBalanceModel(mongoose),
    Conversation: createConversationModel(mongoose),
    Message: createMessageModel(mongoose),
    Agent: createAgentModel(mongoose),
    AgentApiKey: createAgentApiKeyModel(mongoose),
    AgentCategory: createAgentCategoryModel(mongoose),
    MCPServer: createMCPServerModel(mongoose),
    Role: createRoleModel(mongoose),
    Action: createActionModel(mongoose),
    Assistant: createAssistantModel(mongoose),
    File: createFileModel(mongoose),
    Banner: createBannerModel(mongoose),
    Key: createKeyModel(mongoose),
    PluginAuth: createPluginAuthModel(mongoose),
    Transaction: createTransactionModel(mongoose),
    Preset: createPresetModel(mongoose),
    Prompt: createPromptModel(mongoose),
    PromptGroup: createPromptGroupModel(mongoose),
    Skill: createSkillModel(mongoose),
    SkillFile: createSkillFileModel(mongoose),
    ConversationTag: createConversationTagModel(mongoose),
    SharedLink: createSharedLinkModel(mongoose),
    ToolCall: createToolCallModel(mongoose),
    MemoryEntry: createMemoryModel(mongoose),
    AccessRole: createAccessRoleModel(mongoose),
    AclEntry: createAclEntryModel(mongoose),
    SystemGrant: createSystemGrantModel(mongoose),
    Group: createGroupModel(mongoose),
    Config: createConfigModel(mongoose),
    AdminLog: createAdminLogModel(mongoose),
    RequestLog: createRequestLogModel(mongoose),
  };
}

/**
 * AdminLog Model Factory
 */
function createAdminLogModel(mongoose: typeof import('mongoose')) {
  const adminLogSchema = new mongoose.Schema(
    {
      adminUserId: { type: String, required: true, index: true },
      adminEmail: { type: String, required: true },
      targetUserId: { type: String, required: true, index: true },
      targetEmail: { type: String, required: true },
      action: {
        type: String,
        required: true,
        enum: [
          'add_credits',
          'deduct_credits',
          'set_plan',
          'set_expires_at',
          'reset_search_usage',
          'ban_user',
          'unban_user',
          'update_role',
        ],
      },
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null },
      reason: { type: String, default: '' },
      ip: { type: String, default: '' },
      userAgent: { type: String, default: '' },
    },
    {
      timestamps: true,
      collection: 'admin_logs',
    },
  );

  adminLogSchema.index({ createdAt: -1 });
  adminLogSchema.index({ adminUserId: 1, createdAt: -1 });
  adminLogSchema.index({ targetUserId: 1, createdAt: -1 });
  adminLogSchema.index({ action: 1, createdAt: -1 });
  // TTL index: auto-delete logs older than 90 days
  adminLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

  return mongoose.models.AdminLog || mongoose.model('AdminLog', adminLogSchema);
}

/**
 * RequestLog Model Factory
 * 记录每次 API 请求的成本统计
 */
function createRequestLogModel(mongoose: typeof import('mongoose')) {
  const requestLogSchema = new mongoose.Schema(
    {
      userId: { type: String, required: true, index: true },
      userEmail: { type: String, default: '' },
      conversationId: { type: String, default: '' },
      messageId: { type: String, default: '' },
      model: { type: String, required: true },
      endpoint: { type: String, default: '' },
      searchMode: {
        type: String,
        enum: ['off', 'auto', 'deep'],
        default: 'off',
      },
      // 预估扣点
      estimatedCredits: { type: Number, default: 0 },
      // 实际扣点
      deductedCredits: { type: Number, default: 0 },
      // 成功/失败
      success: { type: Boolean, default: true },
      // 错误信息
      error: { type: String, default: null },
      errorCode: { type: String, default: null },
      // 搜索相关
      searchPerformed: { type: Boolean, default: false },
      searchResultCount: { type: Number, default: 0 },
      // 成本统计（预留）
      providerCost: { type: Number, default: null },
      providerTokenCount: { type: Number, default: null },
      // 用户信息快照
      userPlan: { type: String, default: 'free' },
      userCreditsBefore: { type: Number, default: 0 },
      userCreditsAfter: { type: Number, default: 0 },
      // 请求元数据
      ip: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      responseTimeMs: { type: Number, default: null },
    },
    {
      timestamps: true,
      collection: 'request_logs',
    },
  );

  // 索引
  requestLogSchema.index({ createdAt: -1 });
  requestLogSchema.index({ userId: 1, createdAt: -1 });
  requestLogSchema.index({ model: 1, createdAt: -1 });
  requestLogSchema.index({ success: 1, createdAt: -1 });
  // TTL index: auto-delete logs older than 90 days
  requestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

  return mongoose.models.RequestLog || mongoose.model('RequestLog', requestLogSchema);
}
