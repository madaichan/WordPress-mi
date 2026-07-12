import { useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { FALLBACK_USERS } from '../../data/fallbacks.js'
import AssignmentBadge from '../../components/UI/AssignmentBadge.jsx'
import AssignmentPanel from '../../components/UI/AssignmentPanel.jsx'
import TableActionButton from '../../components/UI/TableActionButton.jsx'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import { normalizePukatRole } from '../../utils/roles.js'


const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Sign in to your account</title>
  <style>
    body { margin:0; font-family:sans-serif; background:#f3f4f6; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:380px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:32px; }
    input { width:100%; box-sizing:border-box; border:1px solid #d1d5db; border-radius:6px; padding:8px 12px; margin-bottom:12px; }
    button { width:100%; background:#2563eb; color:#fff; border:none; border-radius:6px; padding:10px; font-weight:700; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Sign In</h2>
    <form action="" method="POST">
      <input type="email" name="email" placeholder="Email" />
      <input type="password" name="password" placeholder="Password" />
      <button type="submit">Continue</button>
    </form>
  </div>
</body>
</html>`

const INITIAL_PAGES = [
  {
    id: 'lp-m365',
    name: 'Microsoft 365 Login',
    category: 'login',
    description: 'Corporate Outlook 365 login clone for credential simulations.',
    html: DEFAULT_HTML,
    redirectUrl: 'https://portal.office.com',
    badges: ['Data', 'Pass'],
    assignedTo: 'all',
    users: [],
    thumbnail: {
      accent: <div className="h-2.5 w-12 rounded bg-blue-500/80" />,
      bars: [{ w: 'w-full' }, { w: 'w-4/5' }],
    },
  },
  {
    id: 'lp-hr-data',
    name: 'HR Portal — Data Update',
    category: 'form',
    description: 'Employee data update form for HR-themed simulations.',
    html: `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <form style="width:400px;background:white;border:1px solid #e5e7eb;border-radius:8px;padding:32px">
    <h2>Employee Data Update</h2>
    <input name="fullname" placeholder="Full name" style="width:100%;padding:8px;margin-bottom:12px" />
    <input name="employee_id" placeholder="Employee ID" style="width:100%;padding:8px;margin-bottom:12px" />
    <input name="email" placeholder="Corporate email" style="width:100%;padding:8px;margin-bottom:12px" />
    <button style="width:100%;padding:10px;background:#dc2626;color:white;border:0">Submit data</button>
  </form>
</body>
</html>`,
    redirectUrl: 'https://hr.example.com',
    badges: ['Data'],
    assignedTo: 'specific',
    users: [2],
    thumbnail: {
      accent: <div className="h-2.5 w-12 rounded bg-red-500/80" />,
      bars: [{ w: 'w-full' }, { w: 'w-4/5' }],
    },
  },
  {
    id: 'lp-redirect',
    name: 'Security Awareness Redirect',
    category: 'redirect',
    description: 'Redirect-only education page after link click.',
    html: `<!DOCTYPE html>
<html>
<head><meta http-equiv="refresh" content="3;url=https://example.com/security-awareness"></head>
<body style="font-family:sans-serif;background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div style="text-align:center">
    <h2>Thank you</h2>
    <p>You will be redirected to the official page.</p>
  </div>
</body>
</html>`,
    redirectUrl: 'https://example.com/security-awareness',
    badges: ['Data'],
    assignedTo: 'specific',
    users: [1, 3],
    thumbnail: {
      accent: <div className="h-2.5 w-12 rounded bg-emerald-500/80" />,
      bars: [{ w: 'w-3/4' }],
    },
  },
]

function normalizeUser(user) {
  return {
    id: Number(user.id),
    name: user.display_name || user.name || user.email || `User ${user.id}`,
    email: user.email || '',
    role: normalizePukatRole(user.pukat_role ?? user.role),
  }
}

function categoryForBadges(badges) {
  if (badges.includes('Pass')) return 'login'
  if (badges.includes('Data')) return 'form'
  return 'redirect'
}

function CaptureBadge({ label }) {
  const isPass = label === 'Pass'
  return (
    <span className={clsx('rounded-full px-1.5 py-0.5 text-[9px] font-semibold', isPass ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
      {label} ✓
    </span>
  )
}

function LandingPagesTable({ pages, usersById, onEdit, onPreview, onAssign }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              <th className="p-4">Landing page</th>
              <th className="p-4">Type</th>
              <th className="p-4">Capture</th>
              <th className="p-4">Assignment</th>
              <th className="p-4">Redirect URL</th>
              <th className="w-32 p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pages.map(page => (
              <tr key={page.id} className="transition-colors hover:bg-gray-50/70">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#EEEDFE] text-[#6C63FF]">
                      <i className="ti ti-browser text-sm" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">{page.name}</div>
                      <div className="mt-0.5 max-w-xs truncate text-[11px] text-gray-500">{page.description || page.id}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-gray-700">
                    {page.category}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1.5">
                    {page.badges.map(badge => <CaptureBadge key={badge} label={badge} />)}
                  </div>
                </td>
                <td className="p-4">
                  <AssignmentBadge item={page} usersById={usersById} />
                </td>
                <td className="p-4">
                  <span className="block max-w-[220px] truncate font-mono text-[11px] text-gray-500">
                    {page.redirectUrl || '-'}
                  </span>
                </td>
                <td className="w-32 p-4 pr-6 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <TableActionButton icon="ti-edit" label={`Edit ${page.name}`} title="Edit" onClick={() => onEdit(page.id)} />
                    <TableActionButton icon="ti-eye" label={`Preview ${page.name}`} title="Preview" tone="blue" onClick={() => onPreview(page.id)} />
                    <TableActionButton icon="ti-user-check" label={`Assign ${page.name}`} title="Assign" onClick={() => onAssign(page.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-gray-400">
                  No landing pages found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BrowserPreview({ html, redirectUrl }) {
  const [viewport, setViewport] = useState('desktop')
  const widthClass = {
    desktop: 'w-full max-w-5xl',
    tablet: 'w-[768px]',
    mobile: 'w-[375px]',
  }[viewport]

  return (
    <div className="flex w-full flex-col items-center space-y-4 animate-fade-in">
      <div className="flex w-full max-w-5xl items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="mr-2 font-semibold text-gray-500">Viewport:</span>
          {[
            ['desktop', 'ti-device-desktop', 'Desktop'],
            ['tablet', 'ti-device-tablet', 'Tablet (768px)'],
            ['mobile', 'ti-device-mobile', 'Mobile (375px)'],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewport(key)}
              className={clsx('flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-all', viewport === key ? 'bg-violet-50 text-violet-600' : 'text-gray-600 hover:bg-gray-50')}
            >
              <i className={clsx('ti text-sm', icon)} /> {label}
            </button>
          ))}
        </div>
        <div className="flex select-none items-center gap-1 text-[10px] text-gray-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live Sandbox
        </div>
      </div>

      <div className={clsx('flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300', widthClass)}>
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="flex flex-1 select-none items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-xs text-gray-500">
            <i className="ti ti-lock text-emerald-600" />
            <span className="truncate">{redirectUrl || 'https://portal.office.com'}</span>
          </div>
        </div>
        <div className="flex min-h-[500px] w-full items-center justify-center bg-gray-50 p-4">
          <iframe srcDoc={html || '<h3>No HTML content</h3>'} title="Landing Page Preview" className="min-h-[480px] w-full rounded-lg border border-gray-200/80 bg-white shadow-sm" sandbox="allow-scripts" />
        </div>
      </div>
    </div>
  )
}

function HtmlEditor({ value, onChange }) {
  const lineCount = value.split('\n').length

  return (
    <div className="relative flex h-[420px] bg-[#1e1e1e] font-mono text-[11px] text-gray-300">
      <div className="w-12 flex-shrink-0 select-none overflow-hidden border-r border-gray-800 px-3 py-4 text-right text-gray-600">
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index} className="leading-relaxed">{index + 1}</div>
        ))}
      </div>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        spellCheck={false}
        className="h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-[11px] leading-relaxed text-gray-200 outline-none"
      />
    </div>
  )
}

export default function MasterLandingPages() {
  const [pages, setPages] = useState(INITIAL_PAGES)
  const [activeTab, setActiveTab] = useState('list')
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingHtml, setEditingHtml] = useState('')
  const [editingRedirectUrl, setEditingRedirectUrl] = useState('https://portal.office.com')
  const [editingCaptureData, setEditingCaptureData] = useState(true)
  const [editingCapturePass, setEditingCapturePass] = useState(true)
  const [previewTitle, setPreviewTitle] = useState('Microsoft 365 Login')
  const [assignmentId, setAssignmentId] = useState(null)

  const { data: usersData } = useUsers({ per_page: 100 })

  const users = useMemo(() => {
    const source = usersData?.users?.length ? usersData.users : FALLBACK_USERS
    return source.map(normalizeUser)
  }, [usersData])

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])

  const categories = useMemo(() => [
    { key: 'all', label: 'All', count: pages.length },
    { key: 'login', label: 'Login page', count: pages.filter(page => page.category === 'login').length },
    { key: 'form', label: 'Form submission', count: pages.filter(page => page.category === 'form').length },
    { key: 'redirect', label: 'Redirect only', count: pages.filter(page => page.category === 'redirect').length },
  ], [pages])
  const availableToAllCount = pages.filter(page => page.assignedTo === 'all').length
  const assignedToSpecificCount = pages.length - availableToAllCount

  const filteredPages = useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    return pages.filter(page => {
      const matchesFilter = activeFilter === 'all' || page.category === activeFilter
      const matchesSearch = !term || page.name.toLowerCase().includes(term) || page.description?.toLowerCase().includes(term)
      return matchesFilter && matchesSearch
    })
  }, [activeFilter, pages, searchQuery])

  const assignmentPage = pages.find(page => page.id === assignmentId)

  const tabBtnClass = tab => clsx(
    'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-semibold transition-all',
    activeTab === tab ? 'border-[#6C63FF] text-[#6C63FF]' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
  )

  const pillClass = key => clsx(
    'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
    activeFilter === key ? 'bg-gray-950 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
  )

  function resetEditor() {
    setEditingId(null)
    setEditingName('')
    setEditingHtml('')
    setEditingRedirectUrl('https://portal.office.com')
    setEditingCaptureData(true)
    setEditingCapturePass(true)
  }

  function switchTab(tab) {
    setActiveTab(tab)
    if (tab === 'list') resetEditor()
  }

  const handleCreate = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingHtml(DEFAULT_HTML)
    setEditingRedirectUrl('https://portal.office.com')
    setEditingCaptureData(true)
    setEditingCapturePass(true)
    setActiveTab('editor')
  }, [])

  const handleEdit = useCallback((id) => {
    const page = pages.find(item => item.id === id)
    if (!page) return
    setEditingId(page.id)
    setEditingName(page.name)
    setEditingHtml(page.html || '')
    setEditingRedirectUrl(page.redirectUrl || 'https://portal.office.com')
    setEditingCaptureData(page.badges?.includes('Data') ?? true)
    setEditingCapturePass(page.badges?.includes('Pass') ?? true)
    setActiveTab('editor')
  }, [pages])

  const handlePreview = useCallback((id) => {
    const page = pages.find(item => item.id === id)
    if (!page) return
    setEditingId(page.id)
    setEditingName(page.name)
    setEditingHtml(page.html || '')
    setEditingRedirectUrl(page.redirectUrl || 'https://portal.office.com')
    setEditingCaptureData(page.badges?.includes('Data') ?? true)
    setEditingCapturePass(page.badges?.includes('Pass') ?? true)
    setPreviewTitle(page.name)
    setActiveTab('preview')
  }, [pages])

  function handleSave() {
    const name = editingName.trim()
    if (!name || !editingHtml.trim()) {
      toast.error('Name and HTML source are required.')
      return
    }

    const badges = [
      ...(editingCaptureData ? ['Data'] : []),
      ...(editingCapturePass ? ['Pass'] : []),
    ]

    if (editingId) {
      setPages(current => current.map(page => page.id === editingId ? {
        ...page,
        name,
        html: editingHtml,
        redirectUrl: editingRedirectUrl,
        badges,
        category: categoryForBadges(badges),
      } : page))
      toast.success(`Landing page "${name}" saved.`)
    } else {
      setPages(current => [{
        id: `lp-${Date.now().toString(36)}`,
        name,
        category: categoryForBadges(badges),
        description: 'Custom master landing page.',
        html: editingHtml,
        redirectUrl: editingRedirectUrl,
        badges,
        assignedTo: 'all',
        users: [],
        thumbnail: {
          accent: <div className="h-2.5 w-12 rounded bg-violet-500/80" />,
          bars: [{ w: 'w-3/4' }, { w: 'w-1/2' }],
        },
      }, ...current])
      toast.success(`Landing page "${name}" created.`)
    }

    switchTab('list')
  }

  function saveAssignment(nextAssignment) {
    setPages(current => current.map(page => page.id === assignmentId ? { ...page, ...nextAssignment } : page))
    toast.success('Assignment updated.')
    setAssignmentId(null)
  }

  return (
    <div className="space-y-6 animate-fade-in lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master landing pages</h1>
          <p className="mt-0.5 text-sm text-gray-500">Landing page templates available to assigned users.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <i className="ti ti-search text-base" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search landing pages..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-950 outline-none placeholder:text-gray-400 focus:border-violet-500"
            />
          </div>
          <button onClick={() => toast.success('GoPhish sync will be connected to backend next.')} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50">
            <i className="ti ti-refresh text-base" />
            <span>Sync GoPhish</span>
          </button>
          <button onClick={handleCreate} className="flex items-center gap-1.5 rounded-xl bg-[#6C63FF] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#5B52E1]">
            <i className="ti ti-plus text-base" />
            <span>Create landing page</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#D1FAE5] text-[#059669]">
            <i className="ti ti-browser text-xl" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{pages.length}</div>
            <div className="text-xs font-semibold text-gray-500">Master assets</div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{availableToAllCount}</div>
          <div className="mt-1 text-xs font-semibold text-gray-500">Available to all users</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{assignedToSpecificCount}</div>
          <div className="mt-1 text-xs font-semibold text-gray-500">Assigned to specific users</div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Landing page subtabs">
          <button onClick={() => switchTab('list')} className={tabBtnClass('list')}>
            <i className="ti ti-list text-base" />
            <span>Landing page list</span>
          </button>
          <button onClick={() => setActiveTab('editor')} className={tabBtnClass('editor')}>
            <i className="ti ti-edit text-base" />
            <span>Editor</span>
          </button>
          <button onClick={() => setActiveTab('preview')} className={tabBtnClass('preview')}>
            <i className="ti ti-eye text-base" />
            <span>Preview</span>
          </button>
        </nav>
      </div>

      <div className="space-y-6 overflow-y-auto pb-4">
        {activeTab === 'list' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              {categories.map(category => (
                <button key={category.key} onClick={() => setActiveFilter(category.key)} className={pillClass(category.key)}>
                  {category.label} ({category.count})
                </button>
              ))}
            </div>
            <LandingPagesTable
              pages={filteredPages}
              usersById={usersById}
              onEdit={handleEdit}
              onPreview={handlePreview}
              onAssign={setAssignmentId}
            />
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editingId ? `Edit: ${editingName}` : 'Create landing page'}</h2>
                <p className="mt-0.5 text-xs text-gray-500">Configure the HTML template and capture behavior.</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => switchTab('list')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} className="rounded-xl bg-[#6C63FF] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#5B52E1]">Save template</button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
                <h3 className="border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">Template configuration</h3>
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-gray-700">Template name *</span>
                  <input value={editingName} onChange={event => setEditingName(event.target.value)} placeholder="Example: Microsoft 365 Login" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500" />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-gray-700">Redirect URL after submit</span>
                  <input value={editingRedirectUrl} onChange={event => setEditingRedirectUrl(event.target.value)} placeholder="https://..." className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500" />
                </label>
                <div className="space-y-3 pt-2 text-xs">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" checked={editingCaptureData} onChange={event => setEditingCaptureData(event.target.checked)} className="mt-0.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                    <span>
                      <span className="block font-semibold text-gray-900">Capture submitted data</span>
                      <span className="mt-0.5 block text-[10px] text-gray-400">Capture parameters entered by the target user.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" checked={editingCapturePass} onChange={event => setEditingCapturePass(event.target.checked)} className="mt-0.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                    <span>
                      <span className="block font-semibold text-gray-900">Capture passwords</span>
                      <span className="mt-0.5 block text-[10px] text-gray-400">Capture password inputs for controlled simulations.</span>
                    </span>
                  </label>
                </div>
              </div>
              <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:col-span-3">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    <span className="ml-2 font-mono text-gray-500">template.html</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span>{editingHtml.split('\n').length} lines</span>
                    <span className="text-gray-400">HTML Source</span>
                  </div>
                </div>
                <HtmlEditor value={editingHtml} onChange={setEditingHtml} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{previewTitle}</h2>
                <p className="mt-0.5 text-xs text-gray-500">Preview how the landing page appears to the target.</p>
              </div>
              <button onClick={() => switchTab('list')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50">Back to list</button>
            </div>
            <div className="flex min-h-[450px] flex-col items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100 p-6">
              {editingHtml ? (
                <BrowserPreview html={editingHtml} redirectUrl={editingRedirectUrl} />
              ) : (
                <div className="space-y-2 py-12 text-center text-gray-400">
                  <i className="ti ti-eye-off text-3xl" />
                  <p className="text-xs font-medium">Select a landing page to preview or open the editor.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {assignmentPage && (
        <AssignmentPanel
          item={assignmentPage}
          resourceLabel="landing page"
          showUserRole={false}
          users={users}
          onClose={() => setAssignmentId(null)}
          onSave={saveAssignment}
        />
      )}
    </div>
  )
}
