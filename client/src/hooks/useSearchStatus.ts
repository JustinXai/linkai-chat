import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { searchStatusState, SearchStatusData } from '~/store/searchStatus';

/**
 * Hook to handle search status updates from SSE events
 */
export default function useSearchStatus() {
  const setSearchStatus = useSetRecoilState(searchStatusState);

  /**
   * Handle search status event from SSE
   * @param {Object} eventData - SSE event data containing search status
   */
  const handleSearchStatusEvent = useCallback(
    (eventData: {
      type?: string;
      searchMode?: 'off' | 'auto' | 'deep';
      performed?: boolean;
      success?: boolean;
      resultCount?: number;
      error?: string | null;
    }) => {
      if (eventData.type !== 'search_status') {
        return;
      }

      const { searchMode = 'auto', performed = false, success = false, resultCount = 0, error = null } = eventData;

      let status: SearchStatusData['status'];
      let message = '';

      if (!performed) {
        status = 'idle';
        message = '';
      } else if (!success) {
        status = 'error';
        message = error || '搜索服务暂时不可用';
      } else if (resultCount === 0) {
        status = 'no_results';
        message = '没有检索到足够可靠的实时资料，将基于已有知识回答';
      } else {
        status = 'completed';
        message = `已参考 ${resultCount} 条来源`;
      }

      setSearchStatus({
        status,
        searchMode,
        performed,
        success,
        resultCount,
        error,
        message,
      });
    },
    [setSearchStatus],
  );

  /**
   * Set search status to searching state
   * @param {string} searchMode - The search mode being used
   */
  const setSearching = useCallback(
    (searchMode: 'off' | 'auto' | 'deep' = 'auto') => {
      setSearchStatus({
        status: 'searching',
        searchMode,
        performed: true,
        success: true,
        resultCount: 0,
        error: null,
        message: searchMode === 'deep' ? '正在进行深度搜索...' : '正在搜索资料...',
      });
    },
    [setSearchStatus],
  );

  /**
   * Reset search status to idle
   */
  const resetStatus = useCallback(() => {
    setSearchStatus({
      status: 'idle',
      searchMode: 'off',
      performed: false,
      success: false,
      resultCount: 0,
      error: null,
      message: '',
    });
  }, [setSearchStatus]);

  return {
    handleSearchStatusEvent,
    setSearching,
    resetStatus,
  };
}
