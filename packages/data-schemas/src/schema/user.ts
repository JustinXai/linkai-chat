import { Schema } from 'mongoose';
import { SystemRoles } from 'librechat-data-provider';
import { IUser } from '~/types';

// Session sub-schema
const SessionSchema = new Schema(
  {
    refreshToken: {
      type: String,
      default: '',
    },
  },
  { _id: false },
);

// Backup code sub-schema
const BackupCodeSchema = new Schema(
  {
    codeHash: { type: String, required: true },
    used: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },
  },
  { _id: false },
);

// Link-AI Credits sub-schema
const DailyUsageSchema = new Schema(
  {
    autoSearchCount: { type: Number, default: 0 },
    deepSearchCount: { type: Number, default: 0 },
    lastResetDate: { type: String, default: null },
  },
  { _id: false },
);

const TotalUsageSchema = new Schema(
  {
    chatCount: { type: Number, default: 0 },
    searchCount: { type: Number, default: 0 },
    deepSearchCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const PlanConfigSchema = new Schema(
  {
    dailyAutoSearchLimit: { type: Number, default: 20 },
    dailyDeepSearchLimit: { type: Number, default: 0 },
    deepSearchEnabled: { type: Boolean, default: false },
  },
  { _id: false },
);

const LinkAISchema = new Schema(
  {
    plan: { type: String, default: 'free' },
    credits: { type: Number, default: 100 },
    creditsTotal: { type: Number, default: 100 },
    expiresAt: { type: Date, default: null },
    dailyUsage: { type: DailyUsageSchema, default: () => ({}) },
    totalUsage: { type: TotalUsageSchema, default: () => ({}) },
    planConfig: {
      type: Map,
      of: PlanConfigSchema,
      default: () => new Map([
        ['free', { dailyAutoSearchLimit: 20, dailyDeepSearchLimit: 0, deepSearchEnabled: false }],
        ['weekly', { dailyAutoSearchLimit: 100, dailyDeepSearchLimit: 5, deepSearchEnabled: true }],
        ['monthly', { dailyAutoSearchLimit: 100, dailyDeepSearchLimit: 5, deepSearchEnabled: true }],
        ['pro', { dailyAutoSearchLimit: 300, dailyDeepSearchLimit: 20, deepSearchEnabled: true }],
      ]),
    },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
    },
    username: {
      type: String,
      lowercase: true,
      default: '',
    },
    email: {
      type: String,
      required: [true, "can't be blank"],
      lowercase: true,
      match: [/\S+@\S+\.\S+/, 'is invalid'],
      index: true,
    },
    emailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    password: {
      type: String,
      trim: true,
      minlength: 8,
      maxlength: 128,
      select: false,
    },
    avatar: {
      type: String,
      required: false,
    },
    provider: {
      type: String,
      required: true,
      default: 'local',
    },
    role: {
      type: String,
      default: SystemRoles.USER,
    },
    status: {
      type: String,
      enum: ['active', 'banned'],
      default: 'active',
    },
    googleId: {
      type: String,
    },
    facebookId: {
      type: String,
    },
    openidId: {
      type: String,
    },
    openidIssuer: {
      type: String,
    },
    samlId: {
      type: String,
    },
    ldapId: {
      type: String,
    },
    githubId: {
      type: String,
    },
    discordId: {
      type: String,
    },
    appleId: {
      type: String,
    },
    plugins: {
      type: Array,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    totpSecret: {
      type: String,
      select: false,
    },
    backupCodes: {
      type: [BackupCodeSchema],
      select: false,
    },
    pendingTotpSecret: {
      type: String,
      select: false,
    },
    pendingBackupCodes: {
      type: [BackupCodeSchema],
      select: false,
      default: undefined,
    },
    refreshToken: {
      type: [SessionSchema],
    },
    expiresAt: {
      type: Date,
      expires: 604800, // 7 days in seconds
    },
    termsAccepted: {
      type: Boolean,
      default: false,
    },
    personalization: {
      type: {
        memories: {
          type: Boolean,
          default: true,
        },
      },
      default: {},
    },
    favorites: {
      type: [
        {
          _id: false,
          agentId: { type: String, maxlength: 256 },
          model: { type: String, maxlength: 256 },
          endpoint: { type: String, maxlength: 256 },
          spec: { type: String, maxlength: 256 },
        },
      ],
      default: [],
    },
    skillStates: {
      type: Map,
      of: Boolean,
      default: () => new Map(),
    },
    /** Field for external source identification (for consistency with TPrincipal schema) */
    idOnTheSource: {
      type: String,
      sparse: true,
    },
    tenantId: {
      type: String,
      index: true,
    },
    /** Link-AI Chat credits and subscription information */
    linkai: {
      type: LinkAISchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

userSchema.index({ email: 1, tenantId: 1 }, { unique: true });
userSchema.index({ role: 1, tenantId: 1 });
userSchema.index({ status: 1 });
// Link-AI credits indexes
userSchema.index({ 'linkai.plan': 1 });
userSchema.index({ 'linkai.expiresAt': 1 });
userSchema.index({ 'linkai.dailyUsage.lastResetDate': 1 });

const oAuthIdFields = [
  'googleId',
  'facebookId',
  'openidId',
  'samlId',
  'ldapId',
  'githubId',
  'discordId',
  'appleId',
] as const;

for (const field of oAuthIdFields) {
  if (field === 'openidId') {
    userSchema.index(
      { openidId: 1, openidIssuer: 1, tenantId: 1 },
      { unique: true, partialFilterExpression: { openidId: { $exists: true } } },
    );
    continue;
  }

  userSchema.index(
    { [field]: 1, tenantId: 1 },
    { unique: true, partialFilterExpression: { [field]: { $exists: true } } },
  );
}

export default userSchema;
