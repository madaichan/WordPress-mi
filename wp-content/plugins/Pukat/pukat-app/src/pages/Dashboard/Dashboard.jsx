import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { campaignApi, reportApi } from '../../api/index.js'
import clsx from 'clsx'

// Static data for sections without live API endpointsts yet
const DEPT_RATES = [
  { dept: 'Finance',     pct: 52, color: 'bg-red-500',    text: 'text-red-600' },
  { dept: 'HR',          pct: 40, color: 'bg-amber-500',  text: 'text-amber-600' },
  { dept: 'Marketing',   pct: 24, color: 'bg-amber-500',  text: 'text-amber-600' },
  { dept: 'Engineering', pct: 6,  color: 'bg-emerald-500', text: 'text-emerald-600' },
  { dept: 'Legal',       pct: 4,  color: 'bg-emerald-500', text: 'text-emerald-600' },
]

const ACTIVITY = [
  { icon: 'ti-forms',   bg: 'bg-red-100',     fg: 'text-red-600',     actor: 'Budi Santoso', action: 'submit form phishing',    meta: ['Finance', '2 minutes ago'] },
  { icon: 'ti-pointer', bg: 'bg-red-100',     fg: 'text-red-600',     actor: 'Sari Dewi',    action: 'menglink click phishing',   meta: ['HR', '14 minutes ago'] },
  { icon: 'ti-check',   bg: 'bg-emerald-100', fg: 'text-emerald-600', actor: '38 user',      action: 'completed the simulation quiz', meta: ['1 hour ago'] },
  { icon: 'ti-school',  bg: 'bg-amber-100',   fg: 'text-amber-600',   actor: '42 user',      action: 'were assigned coaching modules', meta: ['3 hours ago'] },
]

const HIGH_RISK = [
  { initials: 'BS', name: 'Budi Santoso', dept: 'Finance',   risk: 'High',   ab: 'bg-red-100',     af: 'text-red-600',     bb: 'bg-red-100',     bf: 'text-red-700' },
  { initials: 'SD', name: 'Sari Dewi',    dept: 'HR',        risk: 'High',   ab: 'bg-red-100',     af: 'text-red-600',     bb: 'bg-red-100',     bf: 'text-red-700' },
  { initials: 'AP', name: 'Andi Pratama', dept: 'Marketing', risk: 'Medium', ab: 'bg-amber-100',   af: 'text-amber-600',   bb: 'bg-amber-100',   bf: 'text-amber-700' },
  { initials: 'RW', name: 'Rina Wijaya',  dept: 'Legal',     risk: 'Low',    ab: 'bg-emerald-100', af: 'text-emerald-600', bb: 'bg-emerald-100', bf: 'text-emerald-700' },
]

const STATIC_CAMPAIGNS = [
  { name: 'Q2 phishing wave',      date: '18 Jun – 25 Jun', status: 'active' },
  { name: 'BEC scenario — finance', date: '28 Jun 2025',     status: 'scheduled' },
  { name: 'Q1 awareness check',    date: '10 Mar 2025',      status: 'completed' },
]

const STEPS = ['Pre sim', 'Preparation', 'Performing', 'Post sim', 'Follow up']

function statusLabel(status) {
  switch (status) {
    case 'active':    return { label: 'Running',  cls: 'bg-blue-100 text-blue-700' }
    case 'completed': return { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-700' }
    case 'paused':    return { label: 'Paused',    cls: 'bg-amber-100 text-amber-700' }
    default:          return { label: 'Scheduled', cls: 'bg-gray-100 text-gray-600' }
  }
}

function dotColor(status) {
  if (status === 'active')    return 'bg-blue-500'
  if (status === 'completed') return 'bg-emerald-500'
  return 'bg-gray-400'
}

export default function Dashboard() {
  const navigate = useNavigate()

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignApi.list({ per_page: 5 }),
  })

  const { data: riskScores } = useQuery({
    queryKey: ['risk-scores'],
    queryFn: () => reportApi.riskScores({}),
  })

  const items  = campaigns?.items ?? []
  const scores = riskScores ?? []

  const activeCampaigns = items.filter(c => c.status === 'active').length
  const totalTargets    = items.reduce((n, c) => n + (c.target_count ?? 0), 0)
  const highRiskCount   = scores.filter(s => s.risk_tier === 'high' || s.risk_tier === 'critical').length

  const campaignRows = items.length > 0
    ? items.slice(0, 4).map(c => ({
        name:   c.name,
        date:   c.launched_at
          ? new Date(c.launched_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—',
        status: c.status,
      }))
    : STATIC_CAMPAIGNS

  return (
    <div className="space-y-6">

      {/* ── 1. Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overview security simulation — Q2 2025</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            Export
          </button>
          <button
            onClick={() => navigate('/campaigns')}
            className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all"
          >
            <i className="ti ti-circle-plus text-base" />
            <span>New campaign</span>
          </button>
        </div>
      </div>

      {/* ── 2. Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500">Active campaigns</span>
            <span className="block text-2xl font-bold text-gray-900">
              {isLoading ? '—' : activeCampaigns}
            </span>
            <span className="block text-xs font-semibold text-emerald-600">+1 from last month</span>
          </div>
          <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
            <i className="ti ti-player-play-filled text-lg" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500">Total targets</span>
            <span className="block text-2xl font-bold text-gray-900">
              {isLoading ? '—' : totalTargets > 0 ? totalTargets.toLocaleString('en-US') : '1,240'}
            </span>
            <span className="block text-xs text-gray-500">Active in {isLoading ? '—' : activeCampaigns} campaign</span>
          </div>
          <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
            <i className="ti ti-users text-lg" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500">Click rate</span>
            <span className="block text-2xl font-bold text-gray-900">18%</span>
            <span className="block text-xs font-semibold text-red-600">▲ 3% vs previous simulation</span>
          </div>
          <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
            <i className="ti ti-pointer text-lg" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500">High-risk users</span>
            <span className="block text-2xl font-bold text-gray-900">
              {scores.length > 0 ? highRiskCount : 42}
            </span>
            <span className="block text-xs font-semibold text-amber-600">Coaching incomplete</span>
          </div>
          <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
            <i className="ti ti-alert-triangle text-lg" />
          </div>
        </div>
      </div>

      {/* ── 3. Active campaign status card ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Status active campaigns</h3>
            <p className="text-xs text-gray-500 mt-0.5">Q2 phishing wave — finance</p>
          </div>
          <span className="rounded-full text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700">Running</span>
        </div>

        {/* Stepper */}
        <div className="relative flex items-center justify-between w-full px-4 mb-8">
          <div className="absolute left-10 right-10 top-4 h-0.5 bg-gray-200 z-0">
            <div className="h-full bg-emerald-500" style={{ width: '50%' }} />
          </div>
          {STEPS.map((label, i) => {
            const done    = i + 1 <= 2
            const current = i + 1 === 3
            return (
              <div key={label} className="flex flex-col items-center z-10 flex-1">
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm',
                  done    && 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                  current && 'bg-[#6C63FF] text-white',
                  !done && !current && 'bg-gray-100 text-gray-400 border border-gray-200',
                )}>
                  {done ? <i className="ti ti-check text-base" /> : i + 1}
                </div>
                <span className={clsx(
                  'text-xs mt-2',
                  done    && 'font-medium text-gray-600',
                  current && 'font-semibold text-[#6C63FF]',
                  !done && !current && 'font-medium text-gray-400',
                )}>{label}</span>
              </div>
            )
          })}
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Emails sent', value: '1,118', sub: '90% of targets',  subCls: 'text-emerald-600' },
            { label: 'Link clicks',      value: '201',   sub: '18% click rate',   subCls: 'text-amber-600' },
            { label: 'Data submitted',    value: '87',    sub: '43% of clickers', subCls: 'text-red-600' },
          ].map(({ label, value, sub, subCls }) => (
            <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs font-medium text-gray-500">{label}</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-gray-900">{value}</span>
                <span className={clsx('text-xs font-semibold', subCls)}>{sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. Click rate per dept + Campaign list ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Click rate bars (3fr) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 flex flex-col">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Click rate by department</h3>
          <div className="space-y-4 flex-1">
            {DEPT_RATES.map(({ dept, pct, color, text }) => (
              <div key={dept} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-gray-700">{dept}</span>
                  <span className={clsx('font-bold', text)}>{pct}%</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign list (2fr) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Campaigns</h3>
            <Link
              to="/campaigns"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-violet-500 hover:bg-violet-50 transition-colors"
            >
              <i className="ti ti-plus text-lg" />
            </Link>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            {isLoading
              ? [...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))
              : campaignRows.map(({ name, date, status }, i) => {
                  const { label, cls } = statusLabel(status)
                  return (
                    <div
                      key={name}
                      className={clsx(
                        'flex items-center justify-between pb-3',
                        i < campaignRows.length - 1 && 'border-b border-gray-100',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', dotColor(status))} />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{name}</h4>
                          <span className="text-xs text-gray-500">{date}</span>
                        </div>
                      </div>
                      <span className={clsx('rounded-full text-xs font-semibold px-2 py-0.5 whitespace-nowrap', cls)}>
                        {label}
                      </span>
                    </div>
                  )
                })
            }
          </div>
        </div>
      </div>

      {/* ── 5. Recent activity + High-risk users ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent activity */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Recent activity</h3>
          <div className="space-y-4 flex-1">
            {ACTIVITY.map(({ icon, bg, fg, actor, action, meta }) => (
              <div key={actor + action} className="flex gap-3 text-sm">
                <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', bg, fg)}>
                  <i className={clsx('ti text-base', icon)} />
                </div>
                <div className="flex-grow">
                  <p className="text-gray-800">
                    <strong className="font-semibold text-gray-950">{actor}</strong>
                    {' '}{action}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                    {meta.map((m, j) => (
                      <span key={j} className="flex items-center gap-1.5">
                        {j > 0 && <span>•</span>}
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High-risk users */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
          <h3 className="text-base font-semibold text-gray-900 mb-4">High-risk users</h3>
          <div className="space-y-4 flex-1">
            {HIGH_RISK.map(({ initials, name, dept, risk, ab, af, bb, bf }) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-8 h-8 rounded-full font-semibold text-xs flex items-center justify-center select-none',
                    ab, af,
                  )}>
                    {initials}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{name}</h4>
                    <span className="text-xs text-gray-500">{dept}</span>
                  </div>
                </div>
                <span className={clsx('rounded-full text-xs font-semibold px-2 py-0.5', bb, bf)}>{risk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
