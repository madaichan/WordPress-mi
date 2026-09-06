import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'
import { useCampaignGroups, useCampaignGroupReport } from '../../hooks/queries/useCampaignGroupQueries.js'
import { useCampaignRunReport } from '../../hooks/queries/useCampaignQueries.js'
import { campaignApi, campaignGroupApi } from '../../api/index.js'
import { downloadBlob } from '../../utils/downloadBlob.js'

// Static — no backend aggregation exists yet for these three sections (see
// docs/PRD_CAMPAIGN_GROUP_MONITORING.md §4 Non-Tujuan). Kept as illustrative
// placeholders, clearly labeled, alongside the real funnel stats above them.
const DEPARTMENTS = [
  { dept: 'Finance', targets: 240, click: 124, rate: 52, risk: 'High', bar: 'bg-red-500', text: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  { dept: 'HR', targets: 180, click: 72, rate: 40, risk: 'Med', bar: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  { dept: 'Marketing', targets: 320, click: 78, rate: 24, risk: 'Med', bar: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  { dept: 'Engineering', targets: 280, click: 18, rate: 6, risk: 'Low', bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  { dept: 'Legal', targets: 220, click: 9, rate: 4, risk: 'Low', bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
]

const HOURLY = [4, 8, 18, 32, 40, 45, 38, 28, 20, 10]

const LIVE_EVENTS = [
  { icon: 'ti-pointer', tone: 'bg-red-100 text-red-600', name: 'Hendra Wijaya', event: 'Clicked phishing link — Marketing', time: 'just now' },
  { icon: 'ti-pointer', tone: 'bg-red-100 text-red-600', name: 'Indah Permata', event: 'Clicked phishing link — Marketing', time: 'just now' },
  { icon: 'ti-forms', tone: 'bg-red-100 text-red-600', name: 'Raka Firmansyah', event: 'Submit form — credential harvested', time: 'just now' },
]

const STAT_CARDS = [
  { key: 'email_sent', label: 'Sent', icon: 'ti-send', cls: 'text-gray-500' },
  { key: 'email_opened', label: 'Opened', icon: 'ti-eye', cls: 'text-amber-600', rateKey: 'open_rate' },
  { key: 'clicked', label: 'Link clicks', icon: 'ti-pointer', cls: 'text-red-600', rateKey: 'click_rate' },
  { key: 'submitted_data', label: 'Data submitted', icon: 'ti-forms', cls: 'text-red-600', rateKey: 'submit_rate' },
]

function SampleDataBadge() {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-400" title="Not backed by real data yet — coming soon">
      Sample data
    </span>
  )
}

/**
 * Real Monitoring: group selector + top-level funnel stats, backed by
 * CampaignGroupService::report()/report_active() (sums each Campaign Run's
 * already-computed metrics_json.stats). Department breakdown, hourly chart,
 * and live event feed stay illustrative placeholders — no backend
 * aggregation exists for those yet (docs/PRD_CAMPAIGN_GROUP_MONITORING.md §4).
 */
export default function Performing() {
  const [searchParams, setSearchParams] = useSearchParams()
  const runId = searchParams.get('run')

  const [selectedGroupId, setSelectedGroupId] = useState('active') // 'active' | 'ungrouped' | group id
  const [isExporting, setIsExporting] = useState(false)

  const { data: groups = [] } = useCampaignGroups()
  const { data: groupReport, isLoading: isGroupReportLoading } = useCampaignGroupReport(selectedGroupId, { enabled: !runId })
  const { data: runReport, isLoading: isRunReportLoading } = useCampaignRunReport(runId, { enabled: Boolean(runId) })

  const report = runId ? runReport : groupReport
  const isLoading = runId ? isRunReportLoading : isGroupReportLoading

  const stats = report?.stats
  const campaignRuns = report?.campaign_runs || []
  const total = stats?.total || 0
  const maxHourly = Math.max(...HOURLY)

  function clearRunSelection() {
    setSearchParams(params => {
      params.delete('run')
      return params
    })
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
              <Button variant="outline" onClick={clearRunSelection}>
                <i className="ti ti-arrow-left text-sm" /> Back to groups
              </Button>
            ) : (
              <select
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:border-violet-500"
              >
                <option value="active">All active groups</option>
                <option value="0">Ungrouped</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            )}
            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(card => (
          <div key={card.key} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <i className={clsx('ti text-sm', card.icon)} />
              <span>{card.label}</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 mt-2">
              {isLoading ? '—' : (stats?.[card.key] ?? 0).toLocaleString('en-US')}
            </span>
            <span className={clsx('text-xs font-semibold mt-1', card.cls)}>
              {card.key === 'email_sent' ? `of ${total.toLocaleString('en-US')} targets` : `${stats?.[card.rateKey] ?? 0}% rate`}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Simulation funnel</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {campaignRuns.length} campaign{campaignRuns.length === 1 ? '' : 's'} in this selection
            </p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Emails sent', value: stats?.email_sent ?? 0, pct: 100, cls: 'bg-violet-100 text-violet-700' },
              { label: 'Emails opened', value: stats?.email_opened ?? 0, pct: stats?.open_rate ?? 0, cls: 'bg-amber-200 text-amber-700' },
              { label: 'Link clicks', value: stats?.clicked ?? 0, pct: stats?.click_rate ?? 0, cls: 'bg-red-200 text-red-700' },
              { label: 'Submit form', value: stats?.submitted_data ?? 0, pct: stats?.submit_rate ?? 0, cls: 'bg-red-400 text-white' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 text-xs">
                <span className="min-w-[100px] font-semibold text-gray-600">{row.label}</span>
                <div className="flex-grow bg-gray-100 h-6 rounded overflow-hidden relative">
                  <div className={clsx('absolute inset-y-0 left-0 flex items-center px-3 font-bold transition-all duration-300', row.cls)} style={{ width: `${row.pct}%` }}>
                    {row.value.toLocaleString('en-US')}
                  </div>
                </div>
                <span className="font-bold text-gray-500 w-10 text-right">{row.pct}%</span>
              </div>
            ))}
          </div>

          <hr className="border-gray-100" />

          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">By department</h3>
            <SampleDataBadge />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-gray-700">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2 px-4">Dept</th>
                  <th className="py-2 px-4">Target</th>
                  <th className="py-2 px-4">Click</th>
                  <th className="py-2 px-4">Rate</th>
                  <th className="py-2 px-4">Risk</th>
                </tr>
              </thead>
              <tbody>
                {DEPARTMENTS.map(row => (
                  <tr key={row.dept} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-4 font-semibold text-gray-900">{row.dept}</td>
                    <td className="py-2.5 px-4">{row.targets}</td>
                    <td className="py-2.5 px-4">{row.click}</td>
                    <td className="py-2.5 px-4">
                      <div className={clsx('h-1.5 rounded-full inline-block mr-1', row.bar)} style={{ width: `${row.rate}px` }} />
                      <span className={clsx('font-semibold align-middle', row.text)}>{row.rate}%</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', row.badge)}>{row.risk}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6 flex flex-col">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Activity per hour</h3>
              <SampleDataBadge />
            </div>
            <div className="flex items-end gap-1 h-12 mb-2 select-none">
              {HOURLY.map((value, index) => (
                <div
                  key={`${value}-${index}`}
                  className={clsx('flex-1 rounded-t transition-all duration-300', value === maxHourly ? 'bg-red-500' : 'bg-gray-200')}
                  title={`${value} clicks`}
                  style={{ height: `${(value / maxHourly) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 font-semibold px-0.5">
              <span>08:00</span>
              <span>12:00</span>
              <span>17:00</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 flex-grow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Live event feed</h3>
                <SampleDataBadge />
              </div>
            </div>
            <div className="space-y-3.5">
              {LIVE_EVENTS.map((event, index) => (
                <div key={`${event.name}-${index}`} className={clsx('flex gap-3 text-sm pb-2', index < LIVE_EVENTS.length - 1 && 'border-b border-gray-50')}>
                  <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', event.tone)}>
                    <i className={clsx('ti text-xs', event.icon)} />
                  </div>
                  <div>
                    <p className="text-gray-800 text-xs">
                      <strong className="font-semibold text-gray-900">{event.name}</strong> {event.event}
                    </p>
                    <span className="text-gray-400 text-[10px] block mt-0.5">{event.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
