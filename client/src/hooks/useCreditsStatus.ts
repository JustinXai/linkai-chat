import { useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import store from '~/store';

/**
 * Hook to manage credits status with API fetching
 */
export default function useCreditsStatus() {
  const [creditsStatus, setCreditsStatus] = useRecoilState(store.creditsStatus);

  const fetchCreditsStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/credits/status', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data) {
        setCreditsStatus(data.data);
      }
    } catch (error) {
      console.error('[useCreditsStatus] Failed to fetch credits status:', error);
    }
  }, [setCreditsStatus]);

  return {
    creditsStatus,
    setCreditsStatus,
    fetchCreditsStatus,
  };
}
