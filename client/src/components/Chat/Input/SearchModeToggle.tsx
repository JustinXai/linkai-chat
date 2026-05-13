import React, { memo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

type SearchMode = 'off' | 'auto' | 'deep';

interface SearchModeOption {
  id: SearchMode;
  labelKey: string;
  descriptionKey: string;
}

const searchModeOptions: SearchModeOption[] = [
  {
    id: 'off',
    labelKey: 'com_linkai_search_off',
    descriptionKey: 'com_linkai_search_off_desc',
  },
  {
    id: 'auto',
    labelKey: 'com_linkai_search_auto',
    descriptionKey: 'com_linkai_search_auto_desc',
  },
  {
    id: 'deep',
    labelKey: 'com_linkai_search_deep',
    descriptionKey: 'com_linkai_search_deep_desc',
  },
];

const SearchModeToggle = memo(function SearchModeToggle() {
  const localize = useLocalize();
  const [searchMode, setSearchMode] = useRecoilState(store.searchMode);
  const creditsStatus = useRecoilValue(store.creditsStatus);

  const isDeepDisabled = !creditsStatus.deepSearchEnabled;

  const handleModeChange = (mode: SearchMode) => {
    if (mode === 'deep' && isDeepDisabled) {
      return;
    }
    setSearchMode(mode);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {localize('com_linkai_search_mode')}
      </div>
      <div className="flex gap-1 rounded-lg bg-surface-secondary p-1">
        {searchModeOptions.map((option) => {
          const isActive = searchMode === option.id;
          const isDisabled = option.id === 'deep' && isDeepDisabled;

          return (
            <button
              key={option.id}
              onClick={() => handleModeChange(option.id)}
              disabled={isDisabled}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-xs transition-all',
                isActive
                  ? 'bg-surface-active-alt text-text-primary shadow-sm'
                  : isDisabled
                    ? 'cursor-not-allowed text-text-secondary opacity-40'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
              )}
            >
              <span className="font-medium">{localize(option.labelKey)}</span>
              <span className="text-[10px] opacity-70">{localize(option.descriptionKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default SearchModeToggle;
