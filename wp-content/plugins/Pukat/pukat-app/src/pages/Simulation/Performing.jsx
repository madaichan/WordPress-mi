import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'
import { DataTable } from '../../components/DataTable/index.js'
import { PlaybookPreviewModal } from '../../components/playbooks/PlaybookFormControls.jsx'
import { useCampaignGroups, useCampaignGroupReport } from '../../hooks/queries/useCampaignGroupQueries.js'
import { useCampaignRun, useCampaignRunReport } from '../../hooks/queries/useCampaignQueries.js'
import { useSyncCampaignRunResultsMutation, useBulkSyncCampaignRunResultsMutation } from '../../hooks/mutations/useCampaignMutations.js'
import { campaignApi, campaignGroupApi } from '../../api/index.js'
import { downloadBlob } from '../../utils/downloadBlob.js'
import { parseServerDate } from '../../utils/serverDate.js'

// Report is a live-ish dashboard, not a one-time snapshot — poll for updates
// so a PIC watching this page sees GoPhish activity without pressing Refresh.
// This only re-reads the already-synced metrics_json (cheap DB read); it does
// not call GoPhish itself — that still only happens via the Refresh button or
// the 1-minute cron (see useSyncCampaignRunResultsMutation).
const REPORT_REFRESH_INTERVAL_MS = 30000

// Styling per department risk_level, as computed server-side by
// CampaignRunService::department_risk_level() (click_rate >= 40 High,
// >= 15 Med, else Low).
const RISK_STYLE = {
  High: { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  Med: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  Low: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
}

// Styling per live-feed event message (CampaignRunService::FEED_EVENT_TYPES).
const EVENT_META = {
  'Clicked Link': { icon: 'ti-pointer', tone: 'bg-red-500/15 text-red-600 dark:text-red-400', label: 'Clicked phishing link' },
  'Submitted Data': { icon: 'ti-forms', tone: 'bg-red-500/15 text-red-600 dark:text-red-400', label: 'Submitted data — credential harvested' },
  'Email Reported': { icon: 'ti-shield-check', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', label: 'Reported as phishing' },
}

// Column schema for the "Target details" DataTable — same shape TableRegistry
// would hand back for a server-driven table, but built inline since this data
// comes from one already-fetched report payload (CampaignRunService::target_details()),
// not a paginated wpdb table.
const TARGET_DETAILS_SCHEMA = {
  columns: [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true, renderer: 'email' },
    { key: 'department', label: 'Department', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      renderer: 'status_badge',
      tone: 'gray',
      toneMap: {
        'Email Sent': 'info',
        'Email Opened': 'warning',
        'Clicked Link': 'danger',
        'Submitted Data': 'critical',
        'Email Reported': 'success',
      },
    },
    { key: 'opened_at', label: 'Opened', sortable: true, renderer: 'datetime' },
    { key: 'clicked_at', label: 'Clicked', sortable: true, renderer: 'datetime' },
    { key: 'submitted_at', label: 'Submitted', sortable: true, renderer: 'datetime' },
    { key: 'reported_at', label: 'Reported', sortable: true, renderer: 'datetime' },
  ],
  search: { placeholder: 'Search name, email, department...' },
}
const TARGET_DETAILS_DEFAULT_STATE = { search: '', sort: 'name', order: 'asc', page: 1, perPage: 25 }

const STAT_CARDS = [
  { key: 'email_sent', label: 'Sent', icon: 'ti-send', cls: 'text-ink-muted' },
  { key: 'email_opened', label: 'Opened', icon: 'ti-eye', cls: 'text-amber-600 dark:text-amber-400', rateKey: 'open_rate' },
  { key: 'clicked', label: 'Link clicks', icon: 'ti-pointer', cls: 'text-red-600 dark:text-red-400', rateKey: 'click_rate' },
  { key: 'submitted_data', label: 'Data submitted', icon: 'ti-forms', cls: 'text-red-600 dark:text-red-400', rateKey: 'submit_rate' },
]

// Mirrors the campaign_runs toneMap in TableRegistry.php.
const STATUS_META = {
  draft_run: { label: 'Draft', cls: 'bg-panel-muted text-ink-muted' },
  ready_for_sync: { label: 'Ready to sync', cls: 'bg-panel-muted text-ink-muted' },
  synced: { label: 'Synced', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  scheduled: { label: 'Scheduled', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  running: { label: 'Running', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  completed: { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
}

function formatDateTime(value) {
  const date = parseServerDate(value)
  if (!date) return '—'
  return date.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function InfoField({ label, value }) {
  return (
    <div>
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      <span className="mt-0.5 block font-semibold text-ink-soft">{value}</span>
    </div>
  )
}

function formatEventTime(value) {
  const date = parseServerDate(value)
  if (!date) return '—'

  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffMinutes < 24 * 60) return `${Math.round(diffMinutes / 60)}h ago`

  return date.toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function EmptySection({ children }) {
  return <p className="py-6 text-center text-xs text-ink-faint">{children}</p>
}

// One row of a Campaign Run summary — name/status, playbook/launch/targets/
// clicks, and a View action. Shared by the "campaigns in this selection"
// list (under Simulation funnel) and the "Campaign funnel" section (inside
// Live event feed) so both stay visually identical.
function CampaignSummaryRow({ run, onView }) {
  const meta = STATUS_META[run.status] || { label: run.status, cls: 'bg-panel-muted text-ink-muted' }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-2 last:border-0 hover:bg-panel-subtle">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold text-ink-soft">{run.name}</span>
          <span className={clsx('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', meta.cls)}>
            {meta.label}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-ink-muted">
          <span>{run.playbook_name || 'No playbook'}</span>
          <span>{formatDateTime(run.launched_at || run.schedule_at)}</span>
          <span>{(run.target_count ?? 0).toLocaleString('en-US')} targets</span>
          <span>{(run.stats?.clicked ?? 0).toLocaleString('en-US')} clicked ({run.stats?.click_rate ?? 0}%)</span>
          <span className="italic text-ink-faint" title="Monitoring isn't live — this is from the last GoPhish sync, not real-time">
            {run.synced_at ? `Synced ${formatEventTime(run.synced_at)}` : 'Never synced'}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onView}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-ink-muted hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400"
      >
        <i className="ti ti-eye text-xs" /> View
      </button>
    </div>
  )
}

/**
 * Real Monitoring: group selector + top-level funnel stats, department
 * breakdown, hourly click activity, and live event feed — all backed by
 * CampaignGroupService::report()/report_active() and CampaignRunService::report(),
 * which sum/merge each Campaign Run's already-computed metrics_json (see
 * CampaignRunService::build_result_metrics(), populated at result-sync time).
 */
export default function Performing() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const runId = searchParams.get('run')

  const [selectedGroupId, setSelectedGroupId] = useState('active') // 'active' | 'ungrouped' | group id
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingData, setIsExportingData] = useState(false)
  const [showExportDataMenu, setShowExportDataMenu] = useState(false)
  const exportDataMenuRef = useRef(null)
  const [funnelCampaignSearch, setFunnelCampaignSearch] = useState('')
  const [targetTableState, setTargetTableState] = useState(TARGET_DETAILS_DEFAULT_STATE)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!showExportDataMenu) return

    function handlePointerDown(event) {
      if (!exportDataMenuRef.current?.contains(event.target)) setShowExportDataMenu(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [showExportDataMenu])

  const { data: groups = [] } = useCampaignGroups()
  const { data: groupReport, isLoading: isGroupReportLoading } = useCampaignGroupReport(selectedGroupId, { enabled: !runId })
  const {
    data: runReport,
    isLoading: isRunReportLoading,
    isFetching: isRunReportFetching,
    error: runReportError,
  } = useCampaignRunReport(runId, { enabled: Boolean(runId), refetchInterval: runId ? REPORT_REFRESH_INTERVAL_MS : false })
  const { data: runDetail } = useCampaignRun(runId, { refetchInterval: runId ? REPORT_REFRESH_INTERVAL_MS : false })
  const syncResultsMutation = useSyncCampaignRunResultsMutation()
  const bulkSyncResultsMutation = useBulkSyncCampaignRunResultsMutation()

  const report = runId ? runReport : groupReport
  const isLoading = runId ? isRunReportLoading : isGroupReportLoading

  const stats = report?.stats
  const campaignRuns = report?.campaign_runs || []
  const total = stats?.total || 0

  const departmentBreakdown = report?.department_breakdown || []
  const hourlyActivity = report?.hourly_activity?.length === 24 ? report.hourly_activity : new Array(24).fill(0)
  const maxHourly = Math.max(...hourlyActivity, 1)
  const recentEvents = report?.recent_events || []
  const targetDetails = report?.target_details

  // Chained education/quiz follow-up columns/cards (G4) only appear once the
  // simulation actually has that activity — keeping the view clean for runs
  // launched without an education follow-up.
  const hasEducationData = (stats?.education_completed ?? 0) > 0
  const hasQuizData = (stats?.quiz_completed ?? 0) > 0
  const statCards = useMemo(() => {
    const cards = [...STAT_CARDS]
    if (hasEducationData) cards.push({ key: 'education_completed', label: 'Education viewed', icon: 'ti-book', cls: 'text-emerald-600 dark:text-emerald-400', rateKey: 'education_rate' })
    if (hasQuizData) cards.push({ key: 'quiz_completed', label: 'Quiz completed', icon: 'ti-checkbox', cls: 'text-emerald-600 dark:text-emerald-400', rateKey: 'quiz_rate' })
    return cards
  }, [hasEducationData, hasQuizData])
  const targetSchema = useMemo(() => {
    const columns = [...TARGET_DETAILS_SCHEMA.columns]
    if (hasEducationData) columns.push({ key: 'education_at', label: 'Education', sortable: true, renderer: 'datetime' })
    if (hasQuizData) columns.push({ key: 'quiz_at', label: 'Quiz', sortable: true, renderer: 'datetime' })
    return { ...TARGET_DETAILS_SCHEMA, columns }
  }, [hasEducationData, hasQuizData])

  // Client-side search/sort/pagination over the report's already-fetched
  // target_details array — mirrors the server-driven DataTable's contract
  // (state/meta shape) without needing a paginated backend endpoint, since
  // this data is a one-shot array computed from GoPhish results, not a wpdb table.
  const targetSearchQuery = targetTableState.search?.trim().toLowerCase() || ''
  const sortedFilteredTargets = useMemo(() => {
    let rows = (targetDetails || []).map(target => ({ ...target, id: target.email }))

    if (targetSearchQuery) {
      rows = rows.filter(row =>
        row.name?.toLowerCase().includes(targetSearchQuery)
        || row.email?.toLowerCase().includes(targetSearchQuery)
        || row.department?.toLowerCase().includes(targetSearchQuery)
      )
    }

    const sortKey = targetTableState.sort || 'name'
    const sortDir = targetTableState.order === 'desc' ? -1 : 1
    rows = [...rows].sort((a, b) => {
      const aValue = a[sortKey] ?? ''
      const bValue = b[sortKey] ?? ''
      if (aValue < bValue) return -1 * sortDir
      if (aValue > bValue) return 1 * sortDir
      return 0
    })

    return rows
  }, [targetDetails, targetSearchQuery, targetTableState.sort, targetTableState.order])

  const targetPerPage = targetTableState.perPage || 25
  const targetTotalPages = Math.max(1, Math.ceil(sortedFilteredTargets.length / targetPerPage))
  const targetPage = Math.min(targetTableState.page || 1, targetTotalPages)
  const targetPageRows = sortedFilteredTargets.slice((targetPage - 1) * targetPerPage, targetPage * targetPerPage)
  const targetTableMeta = { total: sortedFilteredTargets.length, per_page: targetPerPage }

  // Only the "Campaign funnel" list (inside Live event feed) is searchable —
  // the "campaigns in this selection" list under Simulation funnel stays
  // unfiltered.
  const funnelCampaignQuery = funnelCampaignSearch.trim().toLowerCase()
  const funnelCampaignRuns = funnelCampaignQuery
    ? campaignRuns.filter(run => run.name.toLowerCase().includes(funnelCampaignQuery))
    : campaignRuns

  // Most recent per-run synced_at across the current group selection — each
  // run's own timestamp comes from CampaignRunService::build_result_metrics()
  // at its last GoPhish pull, so this is the oldest-data bound a PIC is
  // looking at, not a report-generation timestamp (report generation just
  // re-reads whatever's already cached).
  const lastSyncedAt = useMemo(() => {
    return campaignRuns.reduce((latest, run) => {
      if (!run.synced_at) return latest
      if (!latest || parseServerDate(run.synced_at) > parseServerDate(latest)) return run.synced_at
      return latest
    }, null)
  }, [campaignRuns])

  const statusMeta = runDetail ? (STATUS_META[runDetail.status] || { label: runDetail.status, cls: 'bg-panel-muted text-ink-muted' }) : null
  const runGroupName = runDetail?.campaign_group_id
    ? groups.find(group => String(group.id) === String(runDetail.campaign_group_id))?.name || `Group #${runDetail.campaign_group_id}`
    : 'Ungrouped'

  // Frozen at launch (CampaignRunService::build_snapshot()) — a locked run's
  // snapshot already carries the full template/landing page HTML, so no
  // extra fetch is needed to preview what targets actually saw.
  const emailTemplate = runDetail?.snapshot?.email_template
  const landingPage = runDetail?.snapshot?.landing_page

  function viewEmailTemplate() {
    if (!emailTemplate) return
    const label = emailTemplate.name || emailTemplate.subject || `Template #${emailTemplate.master_id}`
    setPreview({
      type: 'email',
      value: label,
      label,
      subject: emailTemplate.subject,
      html: emailTemplate.html_body,
    })
  }

  function viewLandingPage() {
    if (!landingPage) return
    const label = landingPage.name || `Landing page #${landingPage.master_id}`
    setPreview({
      type: 'landing',
      value: label,
      label,
      html: landingPage.html_body,
      redirectUrl: landingPage.redirect_settings?.redirect_url || '',
    })
  }

  function clearRunSelection() {
    setSearchParams(params => {
      params.delete('run')
      return params
    })
  }

  function handleRefresh() {
    syncResultsMutation.mutate(runId)
  }

  function handleSyncGroup() {
    const ids = campaignRuns.map(run => run.campaign_run_id)
    if (ids.length === 0) return
    bulkSyncResultsMutation.mutate(ids)
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const blob = runId
        ? await campaignApi.runReportExportPdf(runId)
        : await campaignGroupApi.reportExportPdf(selectedGroupId)
      const scope = runId ? `campaign-${runId}` : selectedGroupId
      downloadBlob(blob, `pukat-monitoring-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      toast.error(err.message || 'Failed to export monitoring report.')
    } finally {
      setIsExporting(false)
    }
  }

  // "Download data" (CSV/XLSX) — docs/PRD_MONITORING_DATA_EXPORT.md. Mirrors
  // handleExport() above but targets the raw-data endpoints (Target details
  // per Campaign Run, or the Campaign funnel summary per group/all-active).
  async function handleExportData(format) {
    setShowExportDataMenu(false)
    setIsExportingData(true)
    try {
      const blob = runId
        ? await campaignApi.runReportExportData(runId, format)
        : await campaignGroupApi.reportExportData(selectedGroupId, format)
      const scope = runId ? `campaign-${runId}` : selectedGroupId
      downloadBlob(blob, `pukat-monitoring-${scope}-${new Date().toISOString().slice(0, 10)}.${format}`)
    } catch (err) {
      toast.error(err.message || 'Failed to download monitoring data.')
    } finally {
      setIsExportingData(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Monitoring"
        subtitle={
          runId
            ? `Showing one campaign${report?.name ? ` — ${report.name}` : ''}`
            : 'Campaign activity, filtered by the groups you set up in Manage'
        }
        actions={
          <>
            {runId ? (
              <>
                <Button variant="outline" onClick={handleRefresh} disabled={syncResultsMutation.isPending}>
                  <i className={clsx('ti ti-refresh text-sm', syncResultsMutation.isPending && 'animate-spin')} />
                  {syncResultsMutation.isPending ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button variant="outline" onClick={clearRunSelection}>
                  <i className="ti ti-arrow-left text-sm" /> Back to groups
                </Button>
              </>
            ) : (
              <>
                <select
                  value={selectedGroupId}
                  onChange={e => setSelectedGroupId(e.target.value)}
                  className="bg-panel border border-line text-ink-soft text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:border-violet-500"
                >
                  <option value="active">All active groups</option>
                  <option value="0">Ungrouped</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <span
                  className="text-[10px] italic text-ink-faint"
                  title="Oldest data point across the campaigns in this selection — each is only as fresh as its own last GoPhish pull"
                >
                  {lastSyncedAt ? `Last synced ${formatEventTime(lastSyncedAt)}` : 'Never synced'}
                </span>
                <Button
                  variant="outline"
                  onClick={handleSyncGroup}
                  disabled={bulkSyncResultsMutation.isPending || campaignRuns.length === 0}
                  title="Pull the latest results from GoPhish for every campaign in this selection"
                >
                  <i className={clsx('ti ti-refresh text-sm', bulkSyncResultsMutation.isPending && 'animate-spin')} />
                  {bulkSyncResultsMutation.isPending ? 'Syncing...' : 'Sync'}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </Button>
            <div className="relative" ref={exportDataMenuRef}>
              <Button
                variant="outline"
                onClick={() => setShowExportDataMenu(open => !open)}
                disabled={isExportingData}
                aria-haspopup="menu"
                aria-expanded={showExportDataMenu}
              >
                <i className={clsx('ti text-sm', isExportingData ? 'ti-loader-2 animate-spin' : 'ti-download')} />
                {isExportingData ? 'Downloading...' : 'Download data'}
              </Button>
              {showExportDataMenu && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExportData('csv')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-ink-soft hover:bg-panel-subtle"
                  >
                    <i className="ti ti-file-type-csv text-sm" /> CSV
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExportData('xlsx')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-ink-soft hover:bg-panel-subtle"
                  >
                    <i className="ti ti-file-type-xls text-sm" /> Excel (.xlsx)
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      {runId && runDetail && (
        <div className="bg-panel border border-line rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-ink">{runDetail.name}</h3>
                {statusMeta && (
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', statusMeta.cls)}>
                    {statusMeta.label}
                  </span>
                )}
              </div>
              {runDetail.source_playbook?.description && (
                <p className="mt-1 max-w-2xl text-xs text-ink-muted">{runDetail.source_playbook.description}</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <InfoField label="Playbook" value={runDetail.source_playbook?.name || '—'} />
            <InfoField
              label="Scenario"
              value={runDetail.source_playbook ? `${runDetail.source_playbook.scenario || '—'} · Difficulty ${runDetail.source_playbook.difficulty}/5` : '—'}
            />
            <InfoField label={runDetail.launched_at ? 'Launched' : 'Scheduled'} value={formatDateTime(runDetail.launched_at || runDetail.schedule_at)} />
            <InfoField label="Group" value={runGroupName} />
            <InfoField label="Targets" value={`${total.toLocaleString('en-US')} people`} />
            <InfoField
              label="Data as of"
              value={runDetail.metrics?.synced_at ? formatEventTime(runDetail.metrics.synced_at) : 'Never synced'}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line-soft pt-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line-soft px-3 py-2.5">
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Email template used</span>
                {emailTemplate ? (
                  <>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-ink-soft">
                      {emailTemplate.name || emailTemplate.subject || `Template #${emailTemplate.master_id}`}
                    </span>
                    <span className="block truncate text-[10px] text-ink-faint">v{emailTemplate.version} · {emailTemplate.subject || 'No subject'}</span>
                  </>
                ) : (
                  <span className="mt-0.5 block text-xs text-ink-faint">Not available until launch</span>
                )}
              </div>
              {emailTemplate && (
                <button
                  type="button"
                  onClick={viewEmailTemplate}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-ink-muted hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400"
                >
                  <i className="ti ti-eye text-xs" /> View
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-line-soft px-3 py-2.5">
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Landing page used</span>
                {landingPage ? (
                  <>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-ink-soft">
                      {landingPage.name || `Landing page #${landingPage.master_id}`}
                    </span>
                    <span className="block truncate text-[10px] text-ink-faint">
                      v{landingPage.version}{landingPage.redirect_settings?.redirect_url ? ` · redirects to ${landingPage.redirect_settings.redirect_url}` : ''}
                    </span>
                  </>
                ) : (
                  <span className="mt-0.5 block text-xs text-ink-faint">Not available until launch</span>
                )}
              </div>
              {landingPage && (
                <button
                  type="button"
                  onClick={viewLandingPage}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-ink-muted hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400"
                >
                  <i className="ti ti-eye text-xs" /> View
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <PlaybookPreviewModal preview={preview} onClose={() => setPreview(null)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.key} className="bg-panel border border-line rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs text-ink-muted font-medium">
              <i className={clsx('ti text-sm', card.icon)} />
              <span>{card.label}</span>
            </div>
            <span className="text-2xl font-bold text-ink mt-2">
              {isLoading ? '—' : (stats?.[card.key] ?? 0).toLocaleString('en-US')}
            </span>
            <span className={clsx('text-xs font-semibold mt-1', card.cls)}>
              {card.key === 'email_sent' ? `of ${total.toLocaleString('en-US')} targets` : `${stats?.[card.rateKey] ?? 0}% rate`}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-panel border border-line rounded-xl p-5 lg:col-span-3 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-ink">Simulation funnel</h3>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Emails sent', value: stats?.email_sent ?? 0, pct: 100, cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
              { label: 'Emails opened', value: stats?.email_opened ?? 0, pct: stats?.open_rate ?? 0, cls: 'bg-amber-500/25 text-amber-700 dark:text-amber-300' },
              { label: 'Link clicks', value: stats?.clicked ?? 0, pct: stats?.click_rate ?? 0, cls: 'bg-red-500/25 text-red-700 dark:text-red-300' },
              { label: 'Data Submitted', value: stats?.submitted_data ?? 0, pct: stats?.submit_rate ?? 0, cls: 'bg-red-400 text-white' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 text-xs">
                <span className="min-w-[100px] font-semibold text-ink-muted">{row.label}</span>
                <div className="flex-grow bg-panel-muted h-6 rounded overflow-hidden relative">
                  <div className={clsx('absolute inset-y-0 left-0 flex items-center px-3 font-bold transition-all duration-300', row.cls)} style={{ width: `${row.pct}%` }}>
                    {row.value.toLocaleString('en-US')}
                  </div>
                </div>
                <span className="font-bold text-ink-muted w-10 text-right">{row.pct}%</span>
              </div>
            ))}
          </div>

          <hr className="border-line-soft" />

          <h3 className="text-base font-semibold text-ink">By department</h3>
          {departmentBreakdown.length === 0 ? (
            <EmptySection>No results synced yet — department breakdown appears once GoPhish results are pulled in.</EmptySection>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line-soft bg-panel-subtle text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      <th className="p-4">Dept</th>
                      <th className="p-4">Target</th>
                      <th className="p-4">Click</th>
                      <th className="p-4">Rate</th>
                      <th className="p-4">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {departmentBreakdown.map(row => {
                      const style = RISK_STYLE[row.risk_level] || RISK_STYLE.Low
                      return (
                        <tr key={row.department} className="transition-colors hover:bg-panel-subtle/70">
                          <td className="p-4 font-semibold text-ink">{row.department}</td>
                          <td className="p-4 text-ink-soft">{row.total}</td>
                          <td className="p-4 text-ink-soft">{row.clicked}</td>
                          <td className="p-4">
                            <div className={clsx('h-1.5 rounded-full inline-block mr-1', style.bar)} style={{ width: `${row.click_rate}px` }} />
                            <span className={clsx('font-semibold align-middle', style.text)}>{row.click_rate}%</span>
                          </td>
                          <td className="p-4">
                            <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', style.badge)}>{row.risk_level}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6 flex flex-col">
          <div className="bg-panel border border-line rounded-xl p-5">
            <h3 className="text-sm font-semibold text-ink mb-3">Activity per hour</h3>
            {!hourlyActivity.some(value => value > 0) ? (
              <EmptySection>No click activity yet.</EmptySection>
            ) : (
              <>
                <div className="flex items-end gap-0.5 h-12 mb-2 select-none">
                  {hourlyActivity.map((value, hour) => (
                    <div
                      key={hour}
                      className={clsx('flex-1 rounded-t transition-all duration-300', value === maxHourly && value > 0 ? 'bg-red-500' : 'bg-panel-strong')}
                      title={`${String(hour).padStart(2, '0')}:00 — ${value} click${value === 1 ? '' : 's'}`}
                      style={{ height: `${(value / maxHourly) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-ink-faint font-semibold px-0.5">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </>
            )}
          </div>

          <div className="bg-panel border border-line rounded-xl p-5 flex-grow">
            {!runId && campaignRuns.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-ink">Campaign funnel</h3>
                <p className="text-xs text-ink-muted mt-0.5 mb-3">
                  {campaignRuns.length} campaign{campaignRuns.length === 1 ? '' : 's'} in this selection
                </p>
                <div className="relative mb-2">
                  <i className="ti ti-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint" />
                  <input
                    type="text"
                    value={funnelCampaignSearch}
                    onChange={e => setFunnelCampaignSearch(e.target.value)}
                    placeholder="Search campaigns..."
                    className="w-full rounded-lg border border-line py-1.5 pl-7 pr-3 text-xs focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line-soft">
                  {funnelCampaignRuns.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[11px] text-ink-faint">No campaigns match &quot;{funnelCampaignSearch}&quot;.</p>
                  ) : (
                    funnelCampaignRuns.map(run => (
                      <CampaignSummaryRow key={run.campaign_run_id} run={run} onView={() => navigate(`/monitoring?run=${run.campaign_run_id}`)} />
                    ))
                  )}
                </div>
                <hr className="my-4 border-line-soft" />
              </>
            )}

            <h3 className="text-sm font-semibold text-ink mb-4">Live event feed</h3>
            {recentEvents.length === 0 ? (
              <EmptySection>No clicks, submissions, or reports yet.</EmptySection>
            ) : (
              <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                {recentEvents.map((event, index) => {
                  const meta = EVENT_META[event.message] || { icon: 'ti-activity', tone: 'bg-panel-muted text-ink-muted', label: event.message }
                  return (
                    <div key={`${event.email || event.name}-${index}`} className={clsx('flex gap-3 text-sm pb-2', index < recentEvents.length - 1 && 'border-b border-line-soft')}>
                      <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', meta.tone)}>
                        <i className={clsx('ti text-xs', meta.icon)} />
                      </div>
                      <div>
                        <p className="text-ink-soft text-xs">
                          <strong className="font-semibold text-ink">{event.name}</strong> {meta.label}
                          {event.department && event.department !== 'Unassigned' ? ` — ${event.department}` : ''}
                        </p>
                        <span className="text-ink-faint text-[10px] block mt-0.5">{formatEventTime(event.time)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {runId && (
        <div className="bg-panel border border-line rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-ink">Target details</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                {(targetDetails || []).length} target{(targetDetails || []).length === 1 ? '' : 's'} in this campaign
              </p>
            </div>
          </div>

          {(targetDetails || []).length === 0 && !isRunReportLoading && !runReportError ? (
            <EmptySection>No results synced yet — target details appear once GoPhish results are pulled in.</EmptySection>
          ) : (
            <DataTable
              tableKey="campaign_run_targets"
              schema={targetSchema}
              rows={targetPageRows}
              meta={targetTableMeta}
              state={{ ...targetTableState, page: targetPage }}
              loading={isRunReportLoading}
              refetching={isRunReportFetching && !isRunReportLoading}
              error={runReportError ? { message: runReportError.message } : null}
              onStateChange={setTargetTableState}
            />
          )}
        </div>
      )}
    </PageShell>
  )
}
