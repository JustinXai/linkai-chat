import { useContext, useMemo } from 'react';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { useHasAccess, AuthContext } from '~/hooks';

/**
 * Hook to determine if the Agent Marketplace should be shown.
 * For Link-AI Chat, we hide the Agent Marketplace for end users.
 *
 * @returns Whether the Agent Marketplace should be displayed
 */
export default function useShowMarketplace(): boolean {
  // Link-AI Chat: Always hide Agent Marketplace for end users
  return false;
}
