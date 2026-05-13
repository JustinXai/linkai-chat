import React, { memo, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { Bot, Sparkles, Search, Image, Video, Cpu } from 'lucide-react';
import { EModelEndpoint } from 'librechat-data-provider';
import { useLocalize, useNewConvo } from '~/hooks';
import { useGetStartupConfig } from '~/data-provider';
import { cn } from '~/utils';
import store from '~/store';

/** Model mode types */
export type ModelMode = 'gpt' | 'gemini' | 'claude' | 'search' | 'image' | 'video';

/** Model mode to group mapping */
const MODE_GROUP_MAP: Record<ModelMode, string> = {
  gpt: 'GPT',
  gemini: 'Gemini',
  claude: 'Claude',
  search: 'AI 搜索',
  image: 'AI 绘图',
  video: 'AI 视频',
};

/** Icons for each model mode */
const MODE_ICONS: Record<ModelMode, React.ElementType> = {
  gpt: Bot,
  gemini: Sparkles,
  claude: Cpu,
  search: Search,
  image: Image,
  video: Video,
};

interface ModelModeItem {
  id: ModelMode;
  icon: React.ElementType;
  labelKey: string;
  descriptionKey: string;
  comingSoon?: boolean;
  /** The first available model name in this mode group */
  defaultModel?: string;
}

const STATIC_MODES: ModelModeItem[] = [
  {
    id: 'gpt',
    icon: Bot,
    labelKey: 'com_linkai_gpt',
    descriptionKey: 'com_linkai_gpt_desc',
  },
  {
    id: 'gemini',
    icon: Sparkles,
    labelKey: 'com_linkai_gemini',
    descriptionKey: 'com_linkai_gemini_desc',
  },
  {
    id: 'claude',
    icon: Cpu,
    labelKey: 'com_linkai_claude',
    descriptionKey: 'com_linkai_claude_desc',
  },
  {
    id: 'search',
    icon: Search,
    labelKey: 'com_linkai_search',
    descriptionKey: 'com_linkai_search_desc',
    comingSoon: true,
  },
  {
    id: 'image',
    icon: Image,
    labelKey: 'com_linkai_image',
    descriptionKey: 'com_linkai_image_desc',
    comingSoon: true,
  },
  {
    id: 'video',
    icon: Video,
    labelKey: 'com_linkai_video',
    descriptionKey: 'com_linkai_video_desc',
    comingSoon: true,
  },
];

const ModelModeSelector = memo(function ModelModeSelector() {
  const localize = useLocalize();
  const { newConversation } = useNewConvo();
  const [currentMode, setCurrentMode] = useRecoilState(store.modelMode);
  const { data: startupConfig } = useGetStartupConfig();

  /** Get available models from modelSpecs based on group */
  const availableModes = useMemo(() => {
    const modelSpecs = startupConfig?.modelSpecs?.list ?? [];
    const result: ModelModeItem[] = [];

    for (const mode of STATIC_MODES) {
      const groupName = MODE_GROUP_MAP[mode.id];
      const specsInGroup = modelSpecs.filter((spec) => spec.group === groupName);

      // If no specs found for this group and it's not a "coming soon" mode, skip it
      if (specsInGroup.length === 0 && !mode.comingSoon) {
        continue;
      }

      result.push({
        ...mode,
        defaultModel: specsInGroup[0]?.preset?.model,
      });
    }

    return result;
  }, [startupConfig?.modelSpecs?.list]);

  const handleModeSelect = (mode: ModelModeItem) => {
    if (mode.comingSoon) {
      return;
    }

    // Set the model mode
    setCurrentMode(mode.id);

    // Create new conversation with the first available model in this group
    if (mode.defaultModel) {
      newConversation({
        endpoint: EModelEndpoint.custom,
        model: mode.defaultModel,
      });
    } else {
      newConversation();
    }
  };

  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
        {localize('com_linkai_model_mode')}
      </div>
      {availableModes.map((mode) => {
        const isActive = currentMode === mode.id;
        const Icon = mode.icon;
        return (
          <button
            key={mode.id}
            onClick={() => handleModeSelect(mode)}
            disabled={mode.comingSoon}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all',
              isActive
                ? 'bg-surface-active-alt text-text-primary'
                : mode.comingSoon
                  ? 'cursor-not-allowed text-text-secondary opacity-50'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            )}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {localize(mode.labelKey)}
                </span>
                {mode.comingSoon && (
                  <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium">
                    {localize('com_linkai_coming_soon')}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-text-secondary">
                {localize(mode.descriptionKey)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
});

export default ModelModeSelector;
