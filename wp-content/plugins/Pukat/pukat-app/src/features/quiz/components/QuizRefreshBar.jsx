import Button from '../../../components/UI/Button.jsx'
import { parseServerDate } from '../../../utils/serverDate.js'

/**
 * When the quiz answers on screen were last pulled from GoPhish, and a way to
 * pull them again.
 *
 * The dashboard reads the local database, which the monitoring cron fills on
 * its own schedule, so "how old is this" is a real question — this answers it
 * in the open rather than letting the page imply it is live.
 *
 * A failed refresh is reported as a warning, not an error: the numbers on
 * screen are still the real last-known ones, and the timestamp already says
 * how old they are.
 */
export default function QuizRefreshBar({ refresh = null, isRefreshing = false, onRefresh }) {
  const refreshedAt = parseServerDate(refresh?.refreshed_at)
  const warnings = refresh?.warnings || []

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 space-y-1">
        <p className="text-[11px] text-ink-faint">
          {isRefreshing
            ? 'Checking GoPhish for new answers…'
            : refreshedAt
              ? `Answers pulled from GoPhish at ${refreshedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
              : 'Showing the last answers the results sync stored.'}
          {!isRefreshing && refresh?.polled > 0 && ` · ${refresh.polled} active run(s) checked`}
        </p>

        {warnings.map(warning => (
          <p key={warning} className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            <i className="ti ti-alert-triangle mt-px shrink-0 text-xs" />
            <span>{warning}</span>
          </p>
        ))}
      </div>

      <Button variant="outline" onClick={onRefresh} disabled={isRefreshing}>
        <i className={`ti ti-refresh text-base ${isRefreshing ? 'animate-spin' : ''}`} />
        <span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
      </Button>
    </div>
  )
}
