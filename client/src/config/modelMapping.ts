/**
 * Model Mapping Configuration
 *
 * This module defines the mapping between real model IDs and their user-friendly names.
 * Real IDs are used internally for API calls, while friendly names are displayed to users.
 *
 * Display Rules:
 * - Users always see friendly names
 * - Real model IDs are only shown in:
 *   - Admin backend
 *   - Backend logs
 */

/** Available model groups */
export type ModelGroup = 'GPT' | 'Gemini' | 'Claude';

/** Model mapping entry */
export interface ModelMappingEntry {
  /** The real model ID used in API calls and backend */
  realId: string;
  /** The user-friendly display name */
  friendlyName: string;
  /** The model group for organization */
  group: ModelGroup;
  /** Optional description for the model */
  description?: string;
  /** Icon identifier (optional, defaults based on group) */
  icon?: string;
}

/** Record mapping real model IDs to their entries */
export type ModelMapping = Record<string, ModelMappingEntry>;

/** Model mapping configuration */
export const modelMapping: ModelMapping = {
  // GPT Series
  'gpt-4o-mini': {
    realId: 'gpt-4o-mini',
    friendlyName: 'GPT Fast',
    group: 'GPT',
    description: 'Fast and efficient GPT-4 model',
  },
  'gpt-4o': {
    realId: 'gpt-4o',
    friendlyName: 'GPT Pro',
    group: 'GPT',
    description: 'Most capable GPT-4 model',
  },
  'gpt-4-turbo': {
    realId: 'gpt-4-turbo',
    friendlyName: 'GPT Fast',
    group: 'GPT',
    description: 'Turbocharged GPT-4 model',
  },
  'gpt-4': {
    realId: 'gpt-4',
    friendlyName: 'GPT Pro',
    group: 'GPT',
    description: 'Standard GPT-4 model',
  },
  'o1-preview': {
    realId: 'o1-preview',
    friendlyName: 'GPT Thinking',
    group: 'GPT',
    description: 'Advanced reasoning model',
  },
  'o1-mini': {
    realId: 'o1-mini',
    friendlyName: 'GPT Fast',
    group: 'GPT',
    description: 'Compact reasoning model',
  },

  // Gemini Series
  'gemini-2.0-flash': {
    realId: 'gemini-2.0-flash',
    friendlyName: 'Gemini Fast',
    group: 'Gemini',
    description: 'Fast Gemini model',
  },
  'gemini-1.5-pro': {
    realId: 'gemini-1.5-pro',
    friendlyName: 'Gemini Pro',
    group: 'Gemini',
    description: 'Advanced Gemini model',
  },
  'gemini-2.0-flash-thinking': {
    realId: 'gemini-2.0-flash-thinking',
    friendlyName: 'Gemini Thinking',
    group: 'Gemini',
    description: 'Gemini with advanced reasoning',
  },

  // Claude Series
  'claude-3-5-haiku': {
    realId: 'claude-3-5-haiku',
    friendlyName: 'Claude Fast',
    group: 'Claude',
    description: 'Fast and efficient Claude model',
  },
  'claude-3-5-sonnet': {
    realId: 'claude-3-5-sonnet',
    friendlyName: 'Claude Sonnet',
    group: 'Claude',
    description: 'Balanced Claude model',
  },
  'claude-3-opus': {
    realId: 'claude-3-opus',
    friendlyName: 'Claude Opus',
    group: 'Claude',
    description: 'Most capable Claude model',
  },
  'claude-sonnet-4-20250514': {
    realId: 'claude-sonnet-4-20250514',
    friendlyName: 'Claude Sonnet',
    group: 'Claude',
    description: 'Latest Claude Sonnet model',
  },
};

/** Get all models for a specific group */
export function getModelsByGroup(group: ModelGroup): ModelMappingEntry[] {
  return Object.values(modelMapping).filter((entry) => entry.group === group);
}

/** Get friendly name by real model ID */
export function getFriendlyName(realId: string): string {
  return modelMapping[realId]?.friendlyName ?? realId;
}

/** Get real ID by friendly name */
export function getRealId(friendlyName: string): string | undefined {
  const entry = Object.values(modelMapping).find((e) => e.friendlyName === friendlyName);
  return entry?.realId;
}

/** Get model entry by real ID */
export function getModelEntry(realId: string): ModelMappingEntry | undefined {
  return modelMapping[realId];
}

/** Get model entry by friendly name */
export function getModelEntryByFriendlyName(friendlyName: string): ModelMappingEntry | undefined {
  return Object.values(modelMapping).find((e) => e.friendlyName === friendlyName);
}

/** Check if a model ID has a friendly name mapping */
export function hasFriendlyNameMapping(realId: string): boolean {
  return realId in modelMapping;
}

/** Get all unique groups */
export function getAllGroups(): ModelGroup[] {
  return ['GPT', 'Gemini', 'Claude'];
}

/** Get group icon component name */
export function getGroupIcon(group: ModelGroup): string {
  switch (group) {
    case 'GPT':
      return 'Bot';
    case 'Gemini':
      return 'Sparkles';
    case 'Claude':
      return 'Cpu';
    default:
      return 'Bot';
  }
}
