import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { Link, useNavigate } from 'react-router-dom'
import { campaignApi } from '../../api/index.js'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ── Static data ──────────────────────────────────────────────────────────────

const STATIC_CAMPAIGNS = [
  { id: 1, name: 'Q2 phishing wave', status: 'active', difficulty: 4, target_count: 1240, launched_at: '2025-06-18T00:00:00Z' },
  { id: 2, name: 'BEC scenario — finance', status: 'scheduled', difficulty: 4, target_count: 420, launched_at: null },
  { id: 3, name: 'Q1 awareness check', status: 'completed', difficulty: 2, target_count: 800, launched_at: '2025-03-10T00:00:00Z' },
]

const INITIAL_FORM = {
  name: 'Q2 Phishing Wave — Finance',
  desc: '',
  template: 't1',
  templateFilter: 'All',
  mode: 'playbook',
  playbook: 'p1',
  dateStart: '2025-06-28',
  dateEnd: '2025-07-05',
  timezone: 'WIB',
  sendingHours: 'work',
}

const DEMO_TARGET_TOTAL = 1240

const DEMO_TARGETS = [
  { first_name: 'Budi', last_name: 'Santoso', email: 'budi.santoso@company.id', department: 'Finance', position: 'Finance manager' },
  { first_name: 'Sari', last_name: 'Dewi', email: 'sari.dewi@company.id', department: 'HR', position: 'HR generalist' },
]

const TEMPLATES = [
  { id: 't1', name: 'CEO request — invoice', type: 'BEC', icon: 'ti-mail', diff: 4, dot: 'bg-red-500', diffText: 'Difficulty 4/5 (NIST)' },
  { id: 't2', name: 'Microsoft 365 login', type: 'Credential harvest', icon: 'ti-lock', diff: 3, dot: 'bg-amber-500', diffText: 'Difficulty 3/5' },
  { id: 't3', name: 'HR policy update', type: 'Malware lure', icon: 'ti-file', diff: 2, dot: 'bg-emerald-500', diffText: 'Difficulty 2/5' },
]

const PLAYBOOKS = [
  { id: 'p1', name: 'BEC — finance attack', desc: 'CEO impersonation requesting fast invoice approval.', type: 'BEC', typeColor: 'text-red-700', diff: 4 },
  { id: 'p2', name: 'Credential harvest — O365', desc: 'Microsoft login expiration security alert workflow.', type: 'Credential', typeColor: 'text-amber-700', diff: 3 },
  { id: 'p3', name: 'HR policy lure', desc: 'Policy change notification with simulated attachment check.', type: 'Malware', typeColor: 'text-emerald-700', diff: 2 },
  { id: 'p4', name: 'IT support reset', desc: 'IT helpdesk tickets demanding prompt password change.', type: 'Credential', typeColor: 'text-amber-700', diff: 3 },
]

const TEMPLATE_FILTERS = ['All', 'BEC', 'Credential', 'Malware lure']

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Running' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
]

const WORKSPACE_VIEWS = [
  { key: 'overview', label: 'Overview', icon: 'ti-layout-dashboard' },
  { key: 'calendar', label: 'Calendar', icon: 'ti-calendar' },
  { key: 'monitoring', label: 'Monitoring', icon: 'ti-activity' },
  { key: 'report', label: 'Report', icon: 'ti-file-analytics' },
  { key: 'assets', label: 'Assets', icon: 'ti-template' },
]

const DEPARTMENTS = [
  { name: 'Finance', targets: 240, clicks: 124, rate: 52, risk: 'High', cls: 'bg-red-500', text: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  { name: 'HR', targets: 180, clicks: 72, rate: 40, risk: 'Med', cls: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  { name: 'Marketing', targets: 320, clicks: 78, rate: 24, risk: 'Med', cls: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  { name: 'Engineering', targets: 280, clicks: 18, rate: 6, risk: 'Low', cls: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  { name: 'Legal', targets: 220, clicks: 9, rate: 4, risk: 'Low', cls: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
]

const ACTIVITY_FEED = [
  { icon: 'ti-forms', color: 'bg-red-100 text-red-600', title: 'Budi Santoso', body: 'submit form phishing', meta: 'Finance · 2 minutes ago' },
  { icon: 'ti-pointer', color: 'bg-red-100 text-red-600', title: 'Sari Dewi', body: 'menglink click phishing', meta: 'HR · 14 minutes ago' },
  { icon: 'ti-check', color: 'bg-emerald-100 text-emerald-600', title: '38 user', body: 'completed the simulation quiz', meta: '1 hour ago' },
  { icon: 'ti-school', color: 'bg-amber-100 text-amber-600', body: 'were assigned coaching modules', title: '42 user', meta: '3 hours ago' },
]

const RISK_USERS = [
  { initials: 'BS', name: 'Budi Santoso', dept: 'Finance', level: 'High', badge: 'bg-red-100 text-red-700', avatar: 'bg-red-100 text-red-600' },
  { initials: 'SD', name: 'Sari Dewi', dept: 'HR', level: 'High', badge: 'bg-red-100 text-red-700', avatar: 'bg-red-100 text-red-600' },
  { initials: 'AP', name: 'Andi Pratama', dept: 'Marketing', level: 'Medium', badge: 'bg-amber-100 text-amber-700', avatar: 'bg-amber-100 text-amber-600' },
  { initials: 'RW', name: 'Rina Wijaya', dept: 'Legal', level: 'Low', badge: 'bg-emerald-100 text-emerald-700', avatar: 'bg-emerald-100 text-emerald-600' },
]

const HOURLY_ACTIVITY = [4, 8, 18, 32, 40, 45, 38, 28, 20, 10]

const TIMELINE_EVENTS = [
  { time: '14:32', color: 'bg-red-500', title: 'Budi Santoso — Submit form', meta: 'Finance · credential harvested' },
  { time: '14:31', color: 'bg-red-500', title: 'Sari Dewi — Link clicks', meta: 'HR · landing page visited' },
  { time: '14:29', color: 'bg-emerald-500', title: 'Rina Wijaya — Quiz completed', meta: 'Legal · passed 80%' },
  { time: '14:25', color: 'bg-amber-500', title: 'Andi Pratama — Email opened', meta: 'Marketing · has not clicked' },
  { time: '14:18', color: 'bg-red-500', title: 'Dewi Rahayu — Link clicks', meta: 'Finance · landing page visited' },
  { time: '14:10', color: 'bg-amber-500', title: 'Putri Ayu — Email opened', meta: 'HR · has not clicked' },
  { time: '13:55', color: 'bg-red-500', title: 'Raka Firmansyah — Submit form', meta: 'Finance · credential harvested' },
  { time: '13:40', color: 'bg-violet-500', title: 'Batch email batch 3 sent', meta: '420 email · Finance & HR' },
]

const REPORT_USERS = [
  { name: 'Budi Santoso', dept: 'Finance', clicked: 'Yes', submit: 'Yes', quiz: 'Failed', score: 91, level: 'High', badge: 'bg-red-100 text-red-700', scoreCls: 'text-red-600' },
  { name: 'Sari Dewi', dept: 'HR', clicked: 'Yes', submit: 'Yes', quiz: 'Passed', score: 78, level: 'High', badge: 'bg-red-100 text-red-700', scoreCls: 'text-red-600' },
  { name: 'Andi Pratama', dept: 'Marketing', clicked: 'Yes', submit: 'No', quiz: 'Passed', score: 54, level: 'Medium', badge: 'bg-amber-100 text-amber-700', scoreCls: 'text-amber-600' },
  { name: 'Rina Wijaya', dept: 'Legal', clicked: 'No', submit: 'No', quiz: 'Passed', score: 12, level: 'Low', badge: 'bg-emerald-100 text-emerald-700', scoreCls: 'text-emerald-600' },
]

const EMAIL_TEMPLATES = [
  { name: 'Microsoft Office 365 alert', desc: 'Security-login email style with an urgent password update request.', meta: 'sender: security@microsoft-update.net' },
  { name: 'Google security notification', desc: 'Reports an unknown login from a new device.', meta: 'sender: support@google-help.com' },
  { name: 'Internal HR payroll info', desc: 'New-quarter payroll notification email with an attached document link.', meta: 'sender: payroll@internal-company.id' },
]

const LANDING_PAGES = [
  { name: 'Microsoft account authentication', desc: 'Cloned login form for the corporate Outlook 365 email portal.', badge: 'high-risk', cls: 'bg-red-100 text-red-700' },
  { name: 'Google login SSO interface', desc: 'Cloned single sign-on authentication form for Google Workspace.', badge: 'high-risk', cls: 'bg-red-100 text-red-700' },
  { name: 'Awareness instruction guide', desc: 'Instant education landing page after a user clicks a phishing link.', badge: 'low', cls: 'bg-emerald-100 text-emerald-700' },
]

// ── Helper functions ──────────────────────────────────────────────────────────

function statusLabel(status) {
  switch (status) {
    case 'active': return { label: 'Running', cls: 'bg-blue-100 text-blue-700' }
    case 'completed': return { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' }
    case 'paused': return { label: 'Paused', cls: 'bg-amber-100 text-amber-700' }
    case 'draft': return { label: 'Draft', cls: 'bg-gray-100 text-gray-500' }
    default: return { label: 'Scheduled', cls: 'bg-gray-100 text-gray-600' }
  }
}
function dotColor(status) {
  if (status === 'active') return 'bg-blue-500'
  if (status === 'completed') return 'bg-emerald-500'
  if (status === 'paused') return 'bg-amber-500'
  return 'bg-gray-400'
}

function formatDate(date, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!date) return null
  return new Date(date).toLocaleDateString('en-US', options)
}

// ── Stepper ───────────────────────────────────────────────────────────────────

const WIZARD_STEPS = ['Preparation', 'Performing', 'Review & launch']

function WizardStepper({ step, onStepChange }) {
  const progress = ((step - 1) / (WIZARD_STEPS.length - 1)) * 100

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="relative flex items-center justify-between w-full px-12 sm:px-24">
        <div className="absolute left-20 right-20 sm:left-32 sm:right-32 top-4 h-0.5 bg-gray-200 z-0">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {WIZARD_STEPS.map((label, i) => {
          const done = i + 1 < step
          const current = i + 1 === step
          return (
            <button
              key={label}
              type="button"
              onClick={() => onStepChange?.(i + 1)}
              className="flex flex-col items-center z-10 focus:outline-none"
            >
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300',
                done && 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                current && 'bg-violet-500 text-white',
                !done && !current && 'bg-gray-100 text-gray-400 border border-gray-200',
              )}>
                {done ? <i className="ti ti-check text-base" /> : i + 1}
              </div>
              <span className={clsx(
                'text-xs mt-2 transition-all duration-300',
                done && 'font-semibold text-emerald-700',
                current && 'font-semibold text-violet-500',
                !done && !current && 'font-medium text-gray-400',
              )}>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Delete modal ──────────────────────────────────────────────────────────────

function DeleteModal({ campaign, onConfirm, onCancel, isPending }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <i className="ti ti-trash text-red-600 text-lg" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Delete campaign?</h3>
            <p className="text-xs text-gray-500 mt-1">
              <strong className="text-gray-700">{campaign.name}</strong> will be permanently deleted.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isPending}
            className="bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Preparation ───────────────────────────────────────────────────────

function Step1({ form, setForm, csvData, setCsvData, onCancel, onNext }) {
  const [csvErrors, setCsvErrors] = useState([])

  const onDrop = useCallback((files) => {
    const file = files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const errors = []
        const rows = data.filter((r, i) => {
          if (!r.email || !r.email.includes('@')) { errors.push(`Row ${i + 2}: invalid email`); return false }
          return true
        })
        setCsvData(rows)
        setCsvErrors(errors)
        toast.success(`${rows.length} targets loaded successfully.${errors.length ? ` (${errors.length} skipped)` : ''}`)
      },
      error: (err) => toast.error('Failed to read CSV: ' + err.message),
    })
  }, [setCsvData])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1,
  })

  const filteredTemplates = form.templateFilter === 'All'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.type.toLowerCase().includes(form.templateFilter.toLowerCase()))

  return (
    <div className="space-y-6">
      {/* Card 1 — Informasi campaign */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Informasi campaign</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Campaign name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Q2 Phishing Wave — Finance"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Description</label>
            <input
              type="text"
              value={form.desc}
              onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
              placeholder="Optional"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>
      </div>

      {/* Card 2 — Select phishing template */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Select phishing template</h3>
          <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">gophish</span>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TEMPLATE_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setForm(fr => ({ ...fr, templateFilter: f }))}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                form.templateFilter === f ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Template cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {filteredTemplates.map(t => (
            <div
              key={t.id}
              onClick={() => setForm(f => ({ ...f, template: t.id }))}
              className={clsx(
                'rounded-xl p-4 flex flex-col justify-between h-36 cursor-pointer select-none transition-all',
                form.template === t.id
                  ? 'border-2 border-violet-500 bg-violet-50/20'
                  : 'border border-gray-200 hover:border-gray-300',
              )}
            >
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">
                  <i className={clsx('ti text-lg', t.icon)} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-900">{t.name}</h4>
                  <span className="text-[10px] text-gray-500">{t.type}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={clsx('w-1.5 h-1.5 rounded-full', t.dot)} />
                <span className="text-[10px] font-medium text-gray-500">{t.diffText}</span>
              </div>
            </div>
          ))}
        </div>

        <a href="#" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-500 hover:text-violet-600">
          <i className="ti ti-external-link" />
          <span>Create a new template in GoPhish</span>
        </a>
      </div>

      {/* Card 3 — Import targets */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Import targets</h3>

        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-7 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all',
            isDragActive ? 'border-violet-500 bg-violet-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50/50',
          )}
        >
          <input {...getInputProps()} />
          <i className="ti ti-upload text-3xl text-gray-300" />
          <span className="text-xs font-semibold text-gray-700">Upload CSV file</span>
          <span className="text-[10px] text-gray-400">Columns: name, email, department, position</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <a href="#" className="inline-flex items-center gap-1 font-semibold text-violet-500 hover:text-violet-600">
            <i className="ti ti-download" />
            <span>Download template CSV</span>
          </a>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
            <i className="ti ti-circle-check" />
            <span>{(csvData.length || DEMO_TARGET_TOTAL).toLocaleString('en-US')} targets imported successfully</span>
          </span>
        </div>

        {/* Preview table */}
        {csvData.length > 0 ? (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-[11px] text-gray-700">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2 px-4">Name</th>
                  <th className="py-2 px-4">Email</th>
                  <th className="py-2 px-4">Department</th>
                  <th className="py-2 px-4">Position</th>
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 2).map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 px-4 font-semibold text-gray-900">{r.first_name || r.firstname || ''} {r.last_name || r.lastname || ''}</td>
                    <td className="py-2 px-4">{r.email}</td>
                    <td className="py-2 px-4">{r.department || '—'}</td>
                    <td className="py-2 px-4">{r.position || '—'}</td>
                  </tr>
                ))}
                {csvData.length > 2 && (
                  <tr className="bg-gray-50/50">
                    <td colSpan={4} className="py-2 px-4 italic text-gray-400 text-center">
                      + {(csvData.length - 2).toLocaleString('en-US')} more targets
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Static demo table */
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-[11px] text-gray-700">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2 px-4">Name</th>
                  <th className="py-2 px-4">Email</th>
                  <th className="py-2 px-4">Department</th>
                  <th className="py-2 px-4">Position</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-4 font-semibold text-gray-900">Budi Santoso</td>
                  <td className="py-2 px-4">budi.santoso@company.id</td>
                  <td className="py-2 px-4">Finance</td>
                  <td className="py-2 px-4">Finance manager</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-4 font-semibold text-gray-900">Sari Dewi</td>
                  <td className="py-2 px-4">sari.dewi@company.id</td>
                  <td className="py-2 px-4">HR</td>
                  <td className="py-2 px-4">HR generalist</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td colSpan={4} className="py-2 px-4 italic text-gray-400 text-center">+ {(DEMO_TARGET_TOTAL - DEMO_TARGETS.length).toLocaleString('en-US')} more targets</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button onClick={onCancel} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
          Cancel
        </button>
        <button onClick={onNext} className="bg-violet-500 text-white hover:bg-violet-600 px-5 py-2 text-sm font-semibold rounded-xl transition-all">
          Continue to performing →
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Performing ────────────────────────────────────────────────────────

function Step2({ form, setForm, onBack, onNext }) {
  return (
    <div className="space-y-6">
      {/* Card 1 — Campaign mode */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Campaign mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => setForm(f => ({ ...f, mode: 'playbook' }))}
            className={clsx(
              'rounded-xl p-4 cursor-pointer select-none transition-all',
              form.mode === 'playbook' ? 'border-2 border-violet-500 bg-violet-50/20' : 'border border-gray-200 hover:border-gray-300',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Use playbook</h4>
              <div className="flex gap-1.5">
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-violet-100 text-violet-700">Fast</span>
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700">Recommendation</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">Choose a ready-made simulation scenario and launch quickly.</p>
          </div>
          <div
            onClick={() => setForm(f => ({ ...f, mode: 'custom' }))}
            className={clsx(
              'rounded-xl p-4 cursor-pointer select-none transition-all',
              form.mode === 'custom' ? 'border-2 border-violet-500 bg-violet-50/20' : 'border border-gray-200 hover:border-gray-300',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Custom campaign</h4>
              <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-700">Flexible</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">Configure the email template, landing page, and SMTP relay manually.</p>
          </div>
        </div>
      </div>

      {/* Card 2 — Select playbook */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Select playbook</h3>
          <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">gophish</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLAYBOOKS.map(pb => (
            <div
              key={pb.id}
              onClick={() => setForm(f => ({ ...f, playbook: pb.id }))}
              className={clsx(
                'rounded-xl p-4 cursor-pointer select-none transition-all',
                form.playbook === pb.id ? 'border-2 border-violet-500 bg-violet-50/20' : 'border border-gray-200 hover:border-gray-300',
              )}
            >
              <h4 className="text-xs font-semibold text-gray-900">{pb.name}</h4>
              <p className="text-[10px] text-gray-500 mt-1">{pb.desc}</p>
              <div className="flex items-center justify-between mt-3 text-[10px] font-semibold">
                <span className={pb.typeColor}>{pb.type}</span>
                <span className="text-gray-500">Difficulty {pb.diff}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card 3 — Sending schedule */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Sending schedule</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Start date *</label>
            <input type="date" value={form.dateStart} onChange={e => setForm(f => ({ ...f, dateStart: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">End date *</label>
            <input type="date" value={form.dateEnd} onChange={e => setForm(f => ({ ...f, dateEnd: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Timezone</label>
            <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500">
              <option value="WIB">WIB (Asia/Jakarta)</option>
              <option value="WITA">WITA (Asia/Makassar)</option>
              <option value="WIT">WIT (Asia/Jayapura)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Sending hours</label>
            <select value={form.sendingHours} onChange={e => setForm(f => ({ ...f, sendingHours: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500">
              <option value="work">08:00 – 17:00 (Business hours)</option>
              <option value="24h">Full 24 hours</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Blackout period</label>
            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-emerald-600 font-semibold flex items-center gap-1.5">
              <i className="ti ti-shield-check" />
              <span>No active blackout</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button onClick={onBack} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
          ← Back
        </button>
        <button onClick={onNext} className="bg-violet-500 text-white hover:bg-violet-600 px-5 py-2 text-sm font-semibold rounded-xl transition-all">
          Continue to review →
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Review & launch ───────────────────────────────────────────────────

function Step3({ form, csvData, onBack, onLaunch, onDraft, isLaunching }) {
  const selectedPlaybook = PLAYBOOKS.find(p => p.id === form.playbook)
  const selectedTemplate = TEMPLATES.find(t => t.id === form.template)
  const targetCount = csvData.length || DEMO_TARGET_TOTAL

  const checklist = [
    { ok: true, text: `${targetCount.toLocaleString('en-US')} targets imported successfully` },
    { ok: !!form.template, text: form.template ? `Selected email template — ${selectedTemplate?.name} (${selectedTemplate?.type}, difficulty ${selectedTemplate?.diff})` : 'Select phishing template' },
    { ok: true, text: 'SMTP sending profile validated' },
    { ok: true, text: 'Landing page configured in GoPhish' },
    { ok: !!(form.dateStart && form.dateEnd), text: form.dateStart && form.dateEnd ? `Schedule set — ${form.dateStart} to ${form.dateEnd} (${form.timezone})` : 'Set sending schedule' },
    { ok: true, text: 'No active blackout period' },
  ]

  const formatDate = (d) => {
    if (!d) return '—'
    const dt = new Date(d)
    return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-6">
      {/* Card 1 — Pre-launch checklist */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Pre-launch checklist</h3>
        <div className="space-y-2">
          {checklist.map(({ ok, text }, i) => (
            <div key={i} className={clsx(
              'rounded-lg px-4 py-2.5 text-xs font-medium flex items-center justify-between',
              ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100',
            )}>
              <span>{ok ? '✓' : '✗'} {text}</span>
            </div>
          ))}
          {/* Static warning */}
          <div className="bg-amber-50 text-amber-800 border border-amber-100 rounded-lg px-4 py-2.5 text-xs font-medium flex items-center justify-between">
            <span>⚠ Pre-simulation announcement has not been sent to all targets</span>
            <Link to="/pre/socialization" className="underline font-semibold whitespace-nowrap ml-4">Send now</Link>
          </div>
        </div>
      </div>

      {/* Card 2 — Summary + Post-launch */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Campaign summary</h3>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Name', value: form.name || '—' },
              { label: 'Playbook', value: selectedPlaybook?.name || '—' },
              { label: 'Total targets', value: `${targetCount.toLocaleString('en-US')} user` },
              { label: 'Duration', value: form.dateStart && form.dateEnd ? `${formatDate(form.dateStart)} – ${formatDate(form.dateEnd)}` : '—' },
              { label: 'Difficulty', value: selectedPlaybook?.diff ? `${selectedPlaybook.diff}/5 (NIST)` : selectedTemplate?.diff ? `${selectedTemplate.diff}/5 (NIST)` : '—', red: true },
            ].map(({ label, value, red }) => (
              <div key={label} className="flex items-baseline justify-between">
                <span className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</span>
                <span className={clsx('text-xs font-bold text-right', red ? 'text-red-600' : 'text-gray-900')}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* After running */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">After the campaign starts</h3>
          <div className="space-y-3">
            {[
              'Monitoring real-time enabled automatically',
              'Quiz sent to users who click',
              'Report generated automatically when complete',
              'Coaching sent to high-risk users',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-gray-700">
                <i className="ti ti-circle-check text-emerald-600 text-base flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button onClick={onBack} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onDraft} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            Save as draft
          </button>
          <button onClick={onLaunch} disabled={isLaunching}
            className="bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 px-5 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all">
            <i className="ti ti-player-play-filled text-sm" />
            {isLaunching ? 'Launching...' : 'Launch campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Campaign workspace views ─────────────────────────────────────────────────

function WorkspaceHeader({ total, activeCount, completedCount, onNew }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {total} total campaigns · {activeCount} running · {completedCount} completed
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => toast.success('Campaign workspace export is being prepared.')}
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
        >
          Export
        </button>
        <button
          onClick={onNew}
          className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all"
        >
          <i className="ti ti-circle-plus text-base" />
          <span>New campaign</span>
        </button>
      </div>
    </div>
  )
}

function WorkspaceTabs({ active, onChange }) {
  return (
    <div className="border-b border-gray-200 overflow-x-auto no-scrollbar">
      <nav className="flex gap-5 min-w-max" aria-label="Campaign workspace">
        {WORKSPACE_VIEWS.map(item => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={clsx(
              'flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none',
              active === item.key
                ? 'border-violet-500 text-violet-500'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            )}
          >
            <i className={clsx('ti text-base', item.icon)} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function MetricCard({ label, value, helper, icon, helperClass = 'text-gray-500' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
      <div className="space-y-1 min-w-0">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="block text-2xl font-bold text-gray-900">{value}</span>
        <span className={clsx('block text-xs font-semibold', helperClass)}>{helper}</span>
      </div>
      <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 flex-shrink-0">
        <i className={clsx('ti text-lg', icon)} />
      </div>
    </div>
  )
}

function CampaignStatusCard({ activeCampaign }) {
  const campaignName = activeCampaign?.name || 'Q2 phishing wave — finance'
  const sent = activeCampaign?.target_count ? Math.round(activeCampaign.target_count * 0.9) : 1118
  const total = activeCampaign?.target_count || 1240

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Status active campaigns</h3>
          <p className="text-xs text-gray-500 mt-0.5">{campaignName}</p>
        </div>
        <span className="rounded-full text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700">Running</span>
      </div>

      <div className="relative flex items-center justify-between w-full px-4 mb-8">
        <div className="absolute left-10 right-10 top-4 h-0.5 bg-gray-200 z-0">
          <div className="h-full bg-emerald-500" style={{ width: '50%' }} />
        </div>
        {['Pre sim', 'Preparation', 'Performing', 'Post sim', 'Follow up'].map((label, index) => {
          const done = index < 2
          const current = index === 2
          return (
            <div key={label} className="flex flex-col items-center z-10 flex-1 min-w-0">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm',
                done && 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                current && 'bg-violet-500 text-white',
                !done && !current && 'bg-gray-100 text-gray-400 border border-gray-200',
              )}>
                {done ? <i className="ti ti-check text-base" /> : index + 1}
              </div>
              <span className={clsx(
                'text-xs mt-2 truncate max-w-full',
                current ? 'font-semibold text-violet-500' : done ? 'font-medium text-gray-600' : 'font-medium text-gray-400',
              )}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Emails sent', value: sent.toLocaleString('en-US'), helper: `${Math.round((sent / total) * 100)}% of targets`, cls: 'text-emerald-600' },
          { label: 'Link clicks', value: '201', helper: '18% click rate', cls: 'text-amber-600' },
          { label: 'Data submitted', value: '87', helper: '43% of clickers', cls: 'text-red-600' },
        ].map(item => (
          <div key={item.label} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <span className="text-xs font-medium text-gray-500">{item.label}</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-gray-900">{item.value}</span>
              <span className={clsx('text-xs font-semibold', item.cls)}>{item.helper}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DepartmentBars({ title = 'Click rate by department' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3">
      <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {DEPARTMENTS.map(dept => (
          <div key={dept.name} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-gray-700">{dept.name}</span>
              <span className={clsx('font-bold', dept.text)}>{dept.rate}%</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div className={clsx('h-full rounded-full', dept.cls)} style={{ width: `${dept.rate}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CampaignListCard({ campaigns, onNew }) {
  const shown = campaigns.slice(0, 4)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">Campaigns</h3>
        <button
          onClick={onNew}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-violet-500 hover:bg-violet-50 transition-colors"
          title="New campaign"
        >
          <i className="ti ti-plus text-lg" />
        </button>
      </div>
      <div className="space-y-4">
        {shown.map((campaign, index) => {
          const { label, cls } = statusLabel(campaign.status)
          const date = formatDate(campaign.launched_at || campaign.scheduled_at, { day: 'numeric', month: 'short', year: 'numeric' })
          return (
            <div key={campaign.id || index} className={clsx('flex items-center justify-between gap-3', index < shown.length - 1 && 'border-b border-gray-100 pb-3')}>
              <div className="flex items-start gap-2.5 min-w-0">
                <span className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', dotColor(campaign.status))} />
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">{campaign.name}</h4>
                  <span className="text-xs text-gray-500">{date || 'Not scheduled'}</span>
                </div>
              </div>
              <span className={clsx('rounded-full text-xs font-semibold px-2 py-0.5 flex-shrink-0', cls)}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityFeedCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Recent activity</h3>
      <div className="space-y-4">
        {ACTIVITY_FEED.map(item => (
          <div key={`${item.title}-${item.body}`} className="flex gap-3 text-sm">
            <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', item.color)}>
              <i className={clsx('ti text-base', item.icon)} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-800">
                <strong className="font-semibold text-gray-950">{item.title}</strong> {item.body}
              </p>
              <p className="mt-1 text-xs text-gray-400">{item.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RiskUsersCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-4">High-risk users</h3>
      <div className="space-y-4">
        {RISK_USERS.map(user => (
          <div key={user.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={clsx('w-8 h-8 rounded-full font-semibold text-xs flex items-center justify-center select-none flex-shrink-0', user.avatar)}>
                {user.initials}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 truncate">{user.name}</h4>
                <span className="text-xs text-gray-500">{user.dept}</span>
              </div>
            </div>
            <span className={clsx('rounded-full text-xs font-semibold px-2 py-0.5 flex-shrink-0', user.badge)}>{user.level}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CampaignTable({ items, search, setSearch, statusFilter, setFilter, isLoading, onNew, onDelete }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-5 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-gray-900">All campaigns</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage draft, scheduled, running, and completed campaigns.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full sm:w-56 bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          <button
            onClick={onNew}
            className="bg-violet-500 text-white hover:bg-violet-600 px-3 py-2 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition-all"
          >
            <i className="ti ti-plus" /> New campaign
          </button>
        </div>
      </div>

      <div className="px-5 pt-4 flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
              statusFilter === key ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto p-5">
        <table className="w-full text-left border-collapse text-xs text-gray-700">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <th className="py-2.5 px-4">Campaigns</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Target</th>
              <th className="py-2.5 px-4">Difficulty</th>
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td colSpan={6} className="py-3 px-4">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-gray-500">
                  No matching campaigns.
                </td>
              </tr>
            ) : items.map(campaign => {
              const { label, cls } = statusLabel(campaign.status)
              const date = formatDate(campaign.launched_at || campaign.scheduled_at)
              return (
                <tr key={campaign.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <div className="flex items-start gap-2.5">
                      <span className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', dotColor(campaign.status))} />
                      <div>
                        <p className="font-semibold text-gray-900">{campaign.name}</p>
                        <p className="text-[10px] text-gray-400">ID #{campaign.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', cls)}>{label}</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-gray-900">{campaign.target_count?.toLocaleString('en-US') ?? '—'}</td>
                  <td className="py-3 px-4">{campaign.difficulty ? `${campaign.difficulty}/5` : '—'}</td>
                  <td className="py-3 px-4 text-gray-500">{date || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/reports/${campaign.id}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                        title="Lihat laporan"
                      >
                        <i className="ti ti-report-analytics text-sm" />
                      </Link>
                      <button
                        onClick={() => onDelete(campaign)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete campaign"
                      >
                        <i className="ti ti-trash text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OverviewView({ campaigns, items, totalTargets, activeCount, completedCount, search, setSearch, statusFilter, setFilter, isLoading, onNew, onDelete }) {
  const activeCampaign = campaigns.find(c => c.status === 'active') || campaigns[0]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Active campaigns" value={activeCount} helper="+1 from last month" helperClass="text-emerald-600" icon="ti-player-play-filled" />
        <MetricCard label="Total targets" value={totalTargets.toLocaleString('en-US')} helper={`Active in ${activeCount} campaign`} icon="ti-users" />
        <MetricCard label="Click rate" value="18%" helper="▲ 3% vs previous simulation" helperClass="text-red-600" icon="ti-pointer" />
        <MetricCard label="High-risk users" value="42" helper="Coaching incomplete" helperClass="text-amber-600" icon="ti-alert-triangle" />
      </div>

      <CampaignStatusCard activeCampaign={activeCampaign} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <DepartmentBars />
        <CampaignListCard campaigns={campaigns} onNew={onNew} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityFeedCard />
        <RiskUsersCard />
      </div>

      <CampaignTable
        items={items}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setFilter={setFilter}
        isLoading={isLoading}
        onNew={onNew}
        onDelete={onDelete}
      />
    </div>
  )
}

function CalendarView({ campaigns, onNew }) {
  const days = [
    26, 27, 28, 29, 30, 31, 1,
    2, 3, 4, 5, 6, 7, 8,
    9, 10, 11, 12, 13, 14, 15,
    16, 17, 18, 19, 20, 21, 22,
    23, 24, 25, 26, 27, 28, 29,
    30, 1, 2, 3, 4, 5, 6,
  ]

  const campaignDays = new Set([18, 19, 20, 21, 22, 23, 24, 25])
  const draftDays = new Set([28])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Simulation calendar</h2>
          <p className="text-sm text-gray-500 mt-0.5">Phishing simulation delivery schedule — June 2025</p>
        </div>
        <button onClick={onNew} className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 transition-all">
          <i className="ti ti-calendar-plus" />
          Create campaign
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-gray-500 border-b border-gray-100 pb-3 mb-3">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2 min-h-[24rem]">
          {days.map((day, index) => {
            const muted = index < 6 || index > 34
            const active = campaignDays.has(day) && index >= 23 && index <= 30
            const draft = draftDays.has(day) && index === 33
            return (
              <div
                key={`${day}-${index}`}
                className={clsx(
                  'border rounded-lg p-2 text-xs font-medium relative min-h-14',
                  muted && 'border-gray-100 text-gray-400 bg-gray-50',
                  !muted && !active && !draft && 'border-gray-200 text-gray-700 bg-white',
                  active && 'border-blue-200 bg-blue-50/50 text-blue-900',
                  draft && 'border-gray-200 bg-gray-50/50 text-gray-800',
                )}
              >
                {day}
                {active && (
                  <div className="absolute bottom-1 left-1 right-1 bg-blue-100 text-blue-700 text-[9px] px-1 rounded truncate font-semibold">
                    Q2 phishing
                  </div>
                )}
                {draft && (
                  <div className="absolute bottom-1 left-1 right-1 bg-gray-100 text-gray-600 text-[9px] px-1 rounded truncate font-semibold">
                    BEC scenario
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {campaigns.slice(0, 3).map(campaign => {
          const { label, cls } = statusLabel(campaign.status)
          return (
            <div key={campaign.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{campaign.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(campaign.launched_at || campaign.scheduled_at) || 'Draft schedule'}</p>
                </div>
                <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', cls)}>{label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonitoringView({ campaigns }) {
  const activeCampaign = campaigns.find(c => c.status === 'active') || campaigns[0]
  const max = Math.max(...HOURLY_ACTIVITY)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Monitoring real-time</h2>
          <p className="text-sm text-gray-500 mt-0.5">Updates automatically every 5 seconds</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-red-50 text-red-600 rounded-full px-3 py-1 text-xs font-semibold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>Live</span>
          </div>
          <select className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:border-violet-500">
            {campaigns.map(campaign => <option key={campaign.id}>{campaign.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Sent', value: '1,118', helper: 'of 1,240 targets', icon: 'ti-send', cls: 'text-gray-500' },
          { label: 'Opened', value: '634', helper: '57% open rate', icon: 'ti-eye', cls: 'text-amber-600' },
          { label: 'Link clicks', value: '201', helper: '18% click rate', icon: 'ti-pointer', cls: 'text-red-600' },
          { label: 'Data submitted', value: '87', helper: '43% of clickers', icon: 'ti-forms', cls: 'text-red-600' },
          { label: 'High-risk', value: '42', helper: 'needs coaching', icon: 'ti-alert-triangle', cls: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <i className={clsx('ti text-sm', card.icon)} />
              <span>{card.label}</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 mt-2 block">{card.value}</span>
            <span className={clsx('text-xs font-semibold mt-1 block', card.cls)}>{card.helper}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Simulation funnel</h3>
            <p className="text-xs text-gray-500 mt-0.5">{activeCampaign?.name}</p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Emails sent', value: '1,118', rate: 100, cls: 'bg-violet-100 text-violet-700' },
              { label: 'Emails opened', value: '634', rate: 57, cls: 'bg-amber-200 text-amber-700' },
              { label: 'Link clicks', value: '201', rate: 18, cls: 'bg-red-200 text-red-700' },
              { label: 'Submit form', value: '87', rate: 8, cls: 'bg-red-400 text-white' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 text-xs">
                <span className="min-w-[100px] font-semibold text-gray-600">{row.label}</span>
                <div className="flex-grow bg-gray-100 h-6 rounded overflow-hidden relative">
                  <div className={clsx('absolute inset-y-0 left-0 flex items-center px-3 font-bold transition-all duration-300', row.cls)} style={{ width: `${row.rate}%` }}>
                    {row.value}
                  </div>
                </div>
                <span className="font-bold text-gray-500 w-10 text-right">{row.rate}%</span>
              </div>
            ))}
          </div>

          <hr className="border-gray-100" />

          <h3 className="text-base font-semibold text-gray-900">By department</h3>
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
                {DEPARTMENTS.map(dept => (
                  <tr key={dept.name} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-4 font-semibold text-gray-900">{dept.name}</td>
                    <td className="py-2.5 px-4">{dept.targets}</td>
                    <td className="py-2.5 px-4">{dept.clicks}</td>
                    <td className="py-2.5 px-4">
                      <div className={clsx('h-1.5 rounded-full inline-block mr-1', dept.cls)} style={{ width: `${dept.rate}px` }} />
                      <span className={clsx('font-semibold align-middle', dept.text)}>{dept.rate}%</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', dept.badge)}>{dept.risk}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Activity per hour</h3>
            <div className="flex items-end gap-1 h-12 mb-2 select-none">
              {HOURLY_ACTIVITY.map((value, index) => (
                <div
                  key={`${value}-${index}`}
                  className={clsx('flex-1 rounded-t transition-all duration-300', value === max ? 'bg-red-500' : 'bg-gray-200')}
                  title={`${value} clicks`}
                  style={{ height: `${(value / max) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 font-semibold px-0.5">
              <span>08:00</span>
              <span>12:00</span>
              <span>17:00</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Live event feed</h3>
              <button className="text-xs font-semibold text-violet-500 hover:text-violet-600">All</button>
            </div>
            <div className="space-y-3.5">
              {ACTIVITY_FEED.map((item, index) => (
                <div key={`${item.title}-${index}`} className={clsx('flex gap-3 text-sm pb-2', index < ACTIVITY_FEED.length - 1 && 'border-b border-gray-50')}>
                  <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', item.color)}>
                    <i className={clsx('ti text-xs', item.icon)} />
                  </div>
                  <div>
                    <p className="text-gray-800 text-xs">
                      <strong className="font-semibold text-gray-900">{item.title}</strong> {item.body}
                      {index < 2 && <span className="bg-red-100 text-red-600 px-1.5 rounded-full text-[9px] font-semibold animate-pulse ml-1">NEW</span>}
                    </p>
                    <span className="text-gray-400 text-[10px] block mt-0.5">{item.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <TimelineCard />
    </div>
  )
}

function TimelineCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
        <h3 className="text-sm font-semibold text-gray-900">Today's event timeline</h3>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {['All', 'Click', 'Submit', 'Open'].map((label, index) => (
              <button key={label} className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', index === 0 ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => toast.success('Log export is being prepared.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1 text-xs font-semibold rounded-lg transition-all">
            Export Log
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {[0, 1].map(column => (
          <div key={column} className="space-y-4">
            {TIMELINE_EVENTS.filter((_, index) => index % 2 === column).map(event => (
              <div key={`${event.time}-${event.title}`} className="flex gap-3">
                <span className="w-10 text-right text-gray-400 text-[11px] mt-0.5 flex-shrink-0">{event.time}</span>
                <div className="flex flex-col items-center flex-shrink-0 mt-1">
                  <span className={clsx('w-[9px] h-[9px] rounded-full flex-shrink-0', event.color)} />
                  <div className="w-px bg-gray-200 flex-grow h-10 mt-1" />
                </div>
                <div>
                  <h4 className="text-xs font-medium text-gray-900">{event.title}</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">{event.meta}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function AssetsView({ onNew }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Campaign assets</h2>
        <p className="text-sm text-gray-500 mt-0.5">Playbooks, email templates, and landing pages for simulations.</p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Playbooks</h3>
          <Link to="/setup/playbooks" className="text-xs font-semibold text-violet-500 hover:text-violet-600">Manage playbooks</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { badge: 'wordpress-plugin', cls: 'bg-indigo-100 text-indigo-700', title: 'New hire training', desc: 'Automated simulation for new employees in their first 30 days.' },
            { badge: 'gophish', cls: 'bg-amber-100 text-amber-700', title: 'Finance spear phishing', desc: 'Transfer-fraud or account-update scenario for finance staff.' },
            { badge: 'wordpress-plugin', cls: 'bg-indigo-100 text-indigo-700', title: 'Executive impersonation', desc: 'Spoofed executive email that appears to come from company leadership.' },
          ].map(item => (
            <div key={item.title} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between h-48">
              <div>
                <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', item.cls)}>{item.badge}</span>
                <h4 className="text-base font-semibold text-gray-900 mt-2">{item.title}</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
              </div>
              <button onClick={onNew} className="text-xs font-semibold text-violet-500 hover:text-violet-600 text-left">Use playbook →</button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Email templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {EMAIL_TEMPLATES.map(template => (
            <div key={template.name} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between h-40">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{template.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{template.desc}</p>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">{template.meta}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Landing pages</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {LANDING_PAGES.map(page => (
            <div key={page.name} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between h-40">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{page.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{page.desc}</p>
              </div>
              <span className={clsx('rounded-full text-xs font-semibold px-2 py-0.5 w-fit', page.cls)}>{page.badge}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ReportView({ activeTab, onTabChange, onNew }) {
  const tabs = [
    { key: 'report', label: 'Report', icon: 'ti-file-analytics' },
    { key: 'quiz', label: 'Quiz', icon: 'ti-help' },
    { key: 'coaching', label: 'Coaching', icon: 'ti-school' },
    { key: 'planning', label: 'Next planning', icon: 'ti-calendar-plus' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Q2 Phishing Wave — Finance</h2>
          <p className="text-sm text-gray-500 mt-0.5">Completed 5 Jul 2025 · Duration 7 days · 1,240 targets</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => toast.success('CSV export is being prepared.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            Export CSV
          </button>
          <button onClick={() => toast.success('PDF download is being prepared.')} className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all">
            <i className="ti ti-download text-base" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 overflow-x-auto no-scrollbar">
        <nav className="flex gap-6 min-w-max" aria-label="Report tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={clsx(
                'flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none',
                activeTab === tab.key
                  ? 'border-violet-500 text-violet-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              <i className={clsx('ti text-base', tab.icon)} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'report' && <ReportPane />}
      {activeTab === 'quiz' && <QuizReportPane />}
      {activeTab === 'coaching' && <CoachingReportPane />}
      {activeTab === 'planning' && <PlanningReportPane onNew={onNew} />}
    </div>
  )
}

function ReportPane() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Click rate" value="18%" helper="▲ 3% vs previous simulation" helperClass="text-red-600" icon="ti-pointer" />
        <MetricCard label="Submit rate" value="8%" helper="▲ 2% vs previous simulation" helperClass="text-red-600" icon="ti-forms" />
        <MetricCard label="Risk score org." value="64" helper="Medium — needs attention" helperClass="text-amber-600" icon="ti-alert-triangle" />
        <MetricCard label="High-risk users" value="42" helper="▲ 8 from the Q1 simulation" helperClass="text-red-600" icon="ti-users" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <DepartmentBars />
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Benchmark vs. previous simulation</h4>
            {[
              { label: 'Q2 (current)', rate: 18, cls: 'bg-red-500', text: 'text-red-600' },
              { label: 'Q1 2025', rate: 15, cls: 'bg-violet-500', text: 'text-violet-500' },
              { label: 'Q4 2024', rate: 22, cls: 'bg-gray-400', text: 'text-gray-500' },
            ].map(row => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-gray-700">{row.label}</span>
                  <span className={clsx('font-bold', row.text)}>{row.rate}%</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full', row.cls)} style={{ width: `${row.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Organizational risk score</h3>
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full border-2 border-red-500 flex flex-col items-center justify-center flex-shrink-0 select-none">
                <span className="text-2xl font-bold text-red-500 leading-none">64</span>
                <span className="text-[10px] text-gray-400 font-medium mt-0.5">/ 100</span>
              </div>
              <div className="flex-grow space-y-2">
                {[
                  ['Click history', '40 points'],
                  ['Quiz score', '15 points'],
                  ['Submit form', '9 points'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs border-b border-gray-50 pb-1.5 last:border-b-0">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <i className="ti ti-bulb text-lg" />
              <h3 className="text-sm font-semibold text-gray-900">Recommendation</h3>
            </div>
            {[
              ['Coaching focus — Finance & HR', '52% of Finance and 40% of HR clicked. Send the BEC awareness module immediately.'],
              ['42 users need mandatory coaching', "Assign the Recognize BEC module to all high-risk users within 48 hours."],
              ['Schedule the next simulation', 'Reduce click rate to <12% in Q3.'],
            ].map(([title, body]) => (
              <div key={title} className="bg-gray-50 rounded-lg p-3 text-xs">
                <h4 className="font-bold text-gray-900">{title}</h4>
                <p className="text-gray-500 mt-1">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Risk score per user</h3>
          <button onClick={() => toast.success('Risk score CSV export is being prepared.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-gray-700">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Click</th>
                <th className="py-2.5 px-4">Submit</th>
                <th className="py-2.5 px-4">Quiz</th>
                <th className="py-2.5 px-4">Risk score</th>
                <th className="py-2.5 px-4">Level</th>
              </tr>
            </thead>
            <tbody>
              {REPORT_USERS.map(user => (
                <tr key={user.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="py-2.5 px-4 font-semibold text-gray-900">{user.name}</td>
                  <td className="py-2.5 px-4">{user.dept}</td>
                  <td className={clsx('py-2.5 px-4 font-semibold', user.clicked === 'Yes' ? 'text-red-600' : 'text-emerald-600')}>{user.clicked}</td>
                  <td className={clsx('py-2.5 px-4 font-semibold', user.submit === 'Yes' ? 'text-red-600' : 'text-emerald-600')}>{user.submit}</td>
                  <td className={clsx('py-2.5 px-4 font-semibold', user.quiz === 'Failed' ? 'text-red-600' : 'text-emerald-600')}>{user.quiz}</td>
                  <td className={clsx('py-2.5 px-4 font-bold', user.scoreCls)}>{user.score}</td>
                  <td className="py-2.5 px-4">
                    <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', user.badge)}>{user.level}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function QuizReportPane() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="Assigned" value="201" helper="users who clicked" icon="ti-users" />
        <MetricCard label="Completed" value="143" helper="71% completion rate" helperClass="text-emerald-600" icon="ti-circle-check" />
        <MetricCard label="Failed (< 60%)" value="38" helper="needs coaching escalation" helperClass="text-red-600" icon="ti-circle-x" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Status per user</h3>
            <button onClick={() => toast.success('Reminder sent to target users.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Send reminder
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-gray-700">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Dept</th>
                  <th className="py-2.5 px-4">Score</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Budi Santoso', 'Finance', '40%', 'Failed', '8 Jul', 'bg-red-100 text-red-700', 'text-red-600'],
                  ['Sari Dewi', 'HR', '75%', 'Passed', '8 Jul', 'bg-emerald-100 text-emerald-700', 'text-emerald-600'],
                  ['Andi Pratama', 'Marketing', '—', 'Pending', '8 Jul', 'bg-amber-100 text-amber-700', 'text-gray-400'],
                ].map(([name, dept, score, status, deadline, badge, scoreCls]) => (
                  <tr key={name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2.5 px-4 font-semibold text-gray-900">{name}</td>
                    <td className="py-2.5 px-4">{dept}</td>
                    <td className={clsx('py-2.5 px-4 font-semibold', scoreCls)}>{score}</td>
                    <td className="py-2.5 px-4"><span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', badge)}>{status}</span></td>
                    <td className="py-2.5 px-4 text-gray-500">{deadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Active question bank</h3>
            <button onClick={() => toast.success('The simulation question builder is open.')} className="bg-violet-500 text-white hover:bg-violet-600 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Add question
            </button>
          </div>
          {[
            ['What should you do if you receive an email from the CEO requesting a fund transfer?', 'Multiple choice · Correct: 61%'],
            ['Which signs of a phishing email are correct?', 'Multiple choice · Correct: 74%'],
            ['Which link is safe to click?', 'Multiple choice · Correct: 58%'],
          ].map(([question, meta]) => (
            <div key={question} className="border border-gray-200 rounded-xl p-3 bg-white space-y-1.5 text-xs">
              <h4 className="font-medium text-gray-900 leading-relaxed">{question}</h4>
              <p className="text-gray-500 text-[10px] font-semibold">{meta}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CoachingReportPane() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="High-risk assigned" value="42" helper="100% already assigned modules" helperClass="text-emerald-600" icon="ti-school" />
        <MetricCard label="Completed coaching" value="18" helper="43% completion" icon="ti-circle-check" />
        <MetricCard label="Active drip campaigns" value="3" helper="Weekly tips running" icon="ti-mail" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Progress by user</h3>
            <button onClick={() => toast.success('Escalation notification sent to department managers.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Notif. manager
            </button>
          </div>
          {[
            ['BS', 'Budi Santoso', 'Finance · Module: Recognize BEC', 20, 'text-amber-600', 'bg-red-100 text-red-600'],
            ['SD', 'Sari Dewi', 'HR · Module: Recognize BEC + Social Engineering', 60, 'text-blue-600', 'bg-red-100 text-red-600'],
            ['AP', 'Andi Pratama', 'Marketing · Module: Phishing 101', 100, 'text-emerald-600', 'bg-amber-100 text-amber-700'],
          ].map(([initials, name, meta, progress, textCls, avatar]) => (
            <div key={name} className="flex items-center gap-3 text-xs">
              <div className={clsx('w-8 h-8 rounded-full font-semibold flex items-center justify-center flex-shrink-0 select-none', avatar)}>{initials}</div>
              <div className="flex-grow">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-gray-900">{name}</span>
                  <span className={clsx('font-semibold', textCls)}>{progress === 100 ? 'Completed' : `${progress}%`}</span>
                </div>
                <p className="text-gray-400 text-[10px] mt-0.5">{meta}</p>
                <div className="w-full bg-gray-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className={clsx('h-1.5 rounded-full', progress === 100 ? 'bg-emerald-500' : 'bg-violet-500')} style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Active drip campaigns</h3>
            <button onClick={() => toast.success('Opening the new drip campaign dialog.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Create new
            </button>
          </div>
          {[
            ['Weekly Security Tips', 'Every Monday · 42 recipients', 'Open rate: 68%'],
            ['BEC Awareness Drip', '3x weekly · Finance & HR · 24 recipients', 'Open rate: 74%'],
          ].map(([title, meta, rate]) => (
            <div key={title} className="border border-gray-200 rounded-xl p-4 bg-white space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-900">{title}</h4>
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700">Active</span>
              </div>
              <p className="text-gray-400 text-[10px]">{meta}</p>
              <p className="text-gray-700 font-medium text-[10px] pt-1">{rate}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlanningReportPane({ onNew }) {
  const historical = [28, 19, 22, 15, 18, 12]
  const max = Math.max(...historical)

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-amber-500">
          <i className="ti ti-sparkles text-lg animate-pulse" />
          <h3 className="text-base font-semibold text-gray-900">Recommended next scenarios</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            ['Q3 — Finance Deep Dive', 'Focus on Finance, which still has a click rate 52%. Use a more complex wire-fraud scenario.', 'Recommendation', 'border-2 border-violet-500 bg-violet-50/5'],
            ['Q3 — Org-wide Awareness', 'A light simulation for the whole organization. Focus on raising the awareness baseline across all departments.', 'Credential', 'border border-gray-200 bg-white'],
            ['Q3 — Vishing + Smishing', 'Add a new dimension: phishing simulations by phone and SMS.', 'Vishing', 'border border-gray-200 bg-white'],
          ].map(([title, desc, badge, cls]) => (
            <button key={title} onClick={onNew} className={clsx('rounded-xl p-4 flex flex-col justify-between h-44 text-left', cls)}>
              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h4 className="text-xs font-bold text-gray-900">{title}</h4>
                  <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700">{badge}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-2">
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-red-100 text-red-700">BEC</span>
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600">Difficulty 5</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">Tren click rate historis</h3>
          <div className="pt-4">
            <div className="flex items-end gap-2 h-20 select-none">
              {historical.map((value, index) => (
                <div key={`${value}-${index}`} className={clsx('flex-1 rounded-t', index === 4 ? 'bg-violet-500' : index === 5 ? 'bg-emerald-500' : 'bg-gray-300')} style={{ height: `${(value / max) * 100}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 font-semibold mt-2 px-1">
              {["Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", 'Target Q3'].map(label => (
                <span key={label} className={label === "Q2'25" ? 'text-violet-500 font-bold' : undefined}>{label}</span>
              ))}
            </div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2.5 text-xs text-emerald-800 flex items-start gap-2 mt-3 select-none">
            <i className="ti ti-shield-check text-base text-emerald-600 flex-shrink-0" />
            <span>Q3 targets: click rate down to &lt;12% with harder scenarios</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Simulation calendar</h3>
            <button onClick={onNew} className="bg-violet-500 text-white hover:bg-violet-600 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Create campaign
            </button>
          </div>
          {[
            ['Q2 Phishing Wave', '28 Jun – 5 Jul 2025 · Completed', 'Completed', 'bg-emerald-500', 'bg-emerald-100 text-emerald-700'],
            ['Q3 — Finance Deep Dive', 'Draft · Audience: Sep 2025', 'Draft', 'bg-violet-500', 'bg-violet-100 text-violet-700'],
          ].map(([title, meta, badge, dot, badgeCls]) => (
            <div key={title} className="bg-gray-50 rounded-lg p-3 text-xs flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className={clsx('w-2 h-2 rounded-full mt-1 flex-shrink-0', dot)} />
                <div>
                  <h4 className="font-semibold text-gray-900">{title}</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">{meta}</p>
                </div>
              </div>
              <span className={clsx('rounded-full text-[9px] font-semibold px-2 py-0.5', badgeCls)}>{badge}</span>
            </div>
          ))}
          <button onClick={onNew} className="w-full border border-dashed border-gray-200 rounded-lg p-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer text-gray-400 hover:text-gray-600 hover:border-gray-300 select-none">
            <i className="ti ti-plus text-base" />
            <span className="font-semibold">Add Q4 2025 simulation</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Campaigns() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  // View state: 'overview' | 'calendar' | 'monitoring' | 'report' | 'assets' | 'new'
  const [view, setView] = useState('new')
  const [reportTab, setReportTab] = useState('report')

  // List state
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setFilter] = useState('all')
  const [deleteTarget, setDelete] = useState(null)

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [csvData, setCsvData] = useState([])
  const [isLaunching, setIsLaunching] = useState(false)

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', page],
    queryFn: () => campaignApi.list({ page, per_page: 10 }),
    placeholderData: prev => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: id => campaignApi.delete(id),
    onSuccess: () => {
      toast.success('Campaign deleted successfully.')
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      setDelete(null)
    },
    onError: err => toast.error(err.message),
  })

  const rawItems = data?.items ?? STATIC_CAMPAIGNS
  const total = data?.total ?? STATIC_CAMPAIGNS.length
  const lastPage = data?.last_page ?? 1

  const items = rawItems.filter(c => {
    const ok1 = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const ok2 = statusFilter === 'all' || c.status === statusFilter
    return ok1 && ok2
  })

  const activeCount = rawItems.filter(c => c.status === 'active').length
  const completedCount = rawItems.filter(c => c.status === 'completed').length

  const resetWizard = () => {
    setWizardStep(1)
    setForm(INITIAL_FORM)
    setCsvData([])
    setIsLaunching(false)
  }

  const handleLaunch = async () => {
    if (!form.name.trim()) { toast.error('Campaign name is required.'); return }
    setIsLaunching(true)
    try {
      await campaignApi.create({ name: form.name, difficulty: PLAYBOOKS.find(p => p.id === form.playbook)?.diff ?? 3, timezone: `Asia/${form.timezone === 'WIB' ? 'Jakarta' : form.timezone === 'WITA' ? 'Makassar' : 'Jayapura'}` })
      toast.success('Campaign launched successfully!')
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      resetWizard()
      navigate('/monitoring')
    } catch (err) {
      toast.error(err.message || 'Failed meluncurkan campaign.')
    } finally {
      setIsLaunching(false)
    }
  }

  // ── New campaign wizard view ──
  if (view === 'new') {
    return (
      <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New campaign</h1>
          <p className="text-sm text-gray-500 mt-0.5">Simulation / New campaign</p>
        </div>

        {/* Stepper */}
        <WizardStepper step={wizardStep} onStepChange={setWizardStep} />

        {/* Step content */}
        {wizardStep === 1 && (
          <Step1
            form={form} setForm={setForm}
            csvData={csvData} setCsvData={setCsvData}
            onCancel={() => { resetWizard(); navigate('/dashboard') }}
            onNext={() => setWizardStep(2)}
          />
        )}
        {wizardStep === 2 && (
          <Step2
            form={form} setForm={setForm}
            onBack={() => setWizardStep(1)}
            onNext={() => setWizardStep(3)}
          />
        )}
        {wizardStep === 3 && (
          <Step3
            form={form} csvData={csvData}
            onBack={() => setWizardStep(2)}
            onLaunch={handleLaunch}
            onDraft={() => { toast.success('Saved as draft.'); resetWizard(); navigate('/dashboard') }}
            isLaunching={isLaunching}
          />
        )}
      </div>
    )
  }

  const totalTargets = rawItems.reduce((sum, campaign) => sum + (Number(campaign.target_count) || 0), 0) || 1240
  const openNewCampaign = () => { resetWizard(); setView('new') }

  // ── Campaign workspace view ──
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        total={total}
        activeCount={activeCount}
        completedCount={completedCount}
        onNew={openNewCampaign}
      />

      <WorkspaceTabs active={view} onChange={setView} />

      {view === 'overview' && (
        <OverviewView
          campaigns={rawItems}
          items={items}
          totalTargets={totalTargets}
          activeCount={activeCount}
          completedCount={completedCount}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setFilter={setFilter}
          isLoading={isLoading}
          onNew={openNewCampaign}
          onDelete={setDelete}
        />
      )}

      {view === 'calendar' && (
        <CalendarView
          campaigns={rawItems}
          onNew={openNewCampaign}
        />
      )}

      {view === 'monitoring' && (
        <MonitoringView campaigns={rawItems} />
      )}

      {view === 'report' && (
        <ReportView
          activeTab={reportTab}
          onTabChange={setReportTab}
          onNew={openNewCampaign}
        />
      )}

      {view === 'assets' && (
        <AssetsView onNew={openNewCampaign} />
      )}

      {deleteTarget && (
        <DeleteModal
          campaign={deleteTarget}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDelete(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
