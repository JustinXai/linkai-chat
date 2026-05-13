import { useMemo, useCallback } from 'react';
import {
  modelMapping,
  getFriendlyName,
  getRealId,
  getModelEntry,
  getModelsByGroup,
  hasFriendlyNameMapping,
  getAllGroups,
  type ModelGroup,
  type ModelMappingEntry,
} from '~/config/modelMapping';

/**
 * Hook for model ID and friendly name mapping
 *
 * Provides utilities for converting between real model IDs and user-friendly names.
 * - Real IDs are used for API calls and backend communication
 * - Friendly names are displayed to users in the UI
 */
export function useModelMapping() {
  /**
   * Convert a real model ID to its friendly name
   * Returns the real ID if no mapping exists
   */
  const toFriendlyName = useCallback((realId: string | null | undefined): string => {
    if (!realId) {
      return '';
    }
    return getFriendlyName(realId);
  }, []);

  /**
   * Convert a friendly name back to its real model ID
   * Returns undefined if no mapping exists
   */
  const toRealId = useCallback((friendlyName: string): string | undefined => {
    return getRealId(friendlyName);
  }, []);

  /**
   * Get the model entry for a given real ID
   */
  const getModel = useCallback((realId: string): ModelMappingEntry | undefined => {
    return getModelEntry(realId);
  }, []);

  /**
   * Get all models for a specific group
   */
  const getModels = useCallback((group: ModelGroup): ModelMappingEntry[] => {
    return getModelsByGroup(group);
  }, []);

  /**
   * Check if a model ID has a friendly name mapping
   */
  const isMapped = useCallback((realId: string): boolean => {
    return hasFriendlyNameMapping(realId);
  }, []);

  /**
   * Get all available model groups
   */
  const groups = useMemo(() => getAllGroups(), []);

  /**
   * Get all model entries as an array
   */
  const allModels = useMemo(() => Object.values(modelMapping), []);

  /**
   * Get models grouped by their group
   */
  const modelsByGroup = useMemo(() => {
    const result: Record<ModelGroup, ModelMappingEntry[]> = {
      GPT: [],
      Gemini: [],
      Claude: [],
    };
    for (const model of Object.values(modelMapping)) {
      if (model.group in result) {
        result[model.group].push(model);
      }
    }
    return result;
  }, []);

  return {
    toFriendlyName,
    toRealId,
    getModel,
    getModels,
    isMapped,
    groups,
    allModels,
    modelsByGroup,
  };
}

export default useModelMapping;
