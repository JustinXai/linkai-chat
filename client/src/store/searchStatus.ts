import { atom } from 'recoil';

/**
 * 搜索状态类型
 */
export type SearchStatus =
  | 'idle'           // 空闲
  | 'searching'      // 搜索中
  | 'completed'      // 搜索完成
  | 'no_results'     // 无结果
  | 'error';         // 搜索失败

/**
 * 搜索状态数据
 */
export interface SearchStatusData {
  status: SearchStatus;
  searchMode: 'off' | 'auto' | 'deep';
  performed: boolean;
  success: boolean;
  resultCount: number;
  error: string | null;
  message: string;
}

/**
 * 当前搜索状态
 */
const searchStatusState = atom<SearchStatusData>({
  key: 'searchStatusState',
  default: {
    status: 'idle',
    searchMode: 'off',
    performed: false,
    success: false,
    resultCount: 0,
    error: null,
    message: '',
  },
});

/**
 * 获取搜索状态消息
 */
function getSearchStatusMessage(data: SearchStatusData): string {
  switch (data.status) {
    case 'searching':
      if (data.searchMode === 'deep') {
        return '正在进行深度搜索...';
      }
      return '正在搜索资料...';
    case 'completed':
      return `已参考 ${data.resultCount} 条来源`;
    case 'no_results':
      return '没有检索到足够可靠的实时资料，将基于已有知识回答';
    case 'error':
      return data.error || '搜索服务暂时不可用';
    default:
      return '';
  }
}

export { searchStatusState, getSearchStatusMessage };
export default { searchStatusState, getSearchStatusMessage };
