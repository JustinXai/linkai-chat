import React, { memo, useEffect } from 'react';
import { useLocalize } from '~/hooks';
import useCreditsStatus from '~/hooks/useCreditsStatus';

const CreditsDisplay = memo(function CreditsDisplay() {
  const localize = useLocalize();
  const { creditsStatus, fetchCreditsStatus } = useCreditsStatus();

  // Fetch credits status on mount
  useEffect(() => {
    fetchCreditsStatus();
  }, [fetchCreditsStatus]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-light bg-surface-secondary p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">
          {localize('com_linkai_current_plan')}
        </span>
        <span className="text-sm font-medium text-text-primary">
          {creditsStatus.planName}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">
          {localize('com_linkai_remaining_credits')}
        </span>
        <span className="text-sm font-medium text-text-primary">
          {creditsStatus.credits} {localize('com_linkai_points')}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">
          {localize('com_linkai_daily_search')}
        </span>
        <span className="text-xs text-text-primary">
          {creditsStatus.dailyRemaining?.autoSearch ?? creditsStatus.dailyUsage?.autoSearch ?? 0}
          /
          {creditsStatus.dailyLimits?.autoSearch ?? 20}
        </span>
      </div>

      <button
        disabled
        className="mt-1 w-full rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white opacity-50 cursor-not-allowed"
      >
        {localize('com_linkai_upgrade_plan')}
      </button>
    </div>
  );
});

export default CreditsDisplay;
