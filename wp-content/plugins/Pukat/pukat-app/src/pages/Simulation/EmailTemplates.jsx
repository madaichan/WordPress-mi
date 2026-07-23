import { useState, useMemo, useCallback } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import HtmlCodeEditor from '../../components/Editor/HtmlCodeEditor.jsx'
import ClientPreview from '../../components/Editor/ClientPreview.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Button from '../../components/UI/Button.jsx'

/* ─── Default Data ───────────────────────────────────────────────────── */

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; }
    .btn { background-color: #6C63FF; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <h3>Aktivitas Akun Tidak Biasa</h3>
    <p>Halo {{.FirstName}},</p>
    <p>Kami mendeteksi adanya upaya sign-in tidak dikenal pada akun Anda.</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="{{.URL}}" class="btn">Verifikasi Akun</a>
    </div>
  </div>
</body>
</html>`

const EMAIL_TEMPLATES = [
  {
    id: 'ms',
    name: 'Microsoft Office 365 Alert',
    category: 'alert',
    description: 'Gaya email security login dengan permintaan pembaruan sandi mendesak.',
    sender: 'Microsoft Security <security@microsoft-update.net>',
    subject: 'Tindakan Diperlukan: Percobaan login tidak sah terdeteksi',
    thumbnail: {
      icon: 'ti-mail-opened',
      bg: 'bg-red-500/20 text-red-500',
      bars: [{ w: 'w-16' }, { w: 'w-24' }]
    },
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; }
    .header { display: flex; align-items: center; gap: 8px; font-weight: bold; color: #555; }
    .logo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; width: 14px; height: 14px; }
    .blue-btn { background-color: #0067b8; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; width: 14px; height: 14px; float: left; margin-right: 6px;">
        <div style="background:#f25022; width: 6px; height: 6px;"></div>
        <div style="background:#7fba00; width: 6px; height: 6px;"></div>
        <div style="background:#00a4ef; width: 6px; height: 6px;"></div>
        <div style="background:#ffb900; width: 6px; height: 6px;"></div>
      </div>
      <span style="font-size: 14px; font-weight: 600; color: #5e5e5e;">Microsoft Account Security</span>
    </div>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0; clear: both;">
    <h3 style="font-size: 16px; font-weight: 600; color: #111;">Security alert</h3>
    <p>Dear {{.FirstName}},</p>
    <p>We detected unusual sign-in activity on your Microsoft 365 Account ({{.Email}}) from an unrecognized device or IP address. If this was not you, please secure your account immediately by verifying your credentials.</p>
    <div style="background: #f9f9f9; border-radius: 6px; padding: 12px; margin: 15px 0; font-size: 12px;">
      <div><strong>Country/Region:</strong> Netherlands</div>
      <div><strong>IP Address:</strong> 185.220.101.4</div>
      <div><strong>Browser:</strong> Chrome / Windows 10</div>
    </div>
    <p>Please click the button below to verify your login credentials and prevent account lockout.</p>
    <div style="text-align: center; margin-top: 20px;">
      <a href="{{.URL}}" class="blue-btn">Verify account</a>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: 'google',
    name: 'Google Security Notification',
    category: 'alert',
    description: 'Menginfokan adanya login tidak dikenal dari perangkat baru.',
    sender: 'Google Security <support@google-help.com>',
    subject: 'Waspada Keamanan: Percobaan sign-in diblokir',
    thumbnail: {
      icon: 'ti-shield',
      bg: 'bg-blue-500/20 text-blue-500',
      bars: [{ w: 'w-20' }, { w: 'w-28' }]
    },
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Roboto, sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-top: 4px solid #ea4335; }
    .google-text { font-size: 18px; font-weight: bold; margin-bottom: 20px; }
    .btn { background-color: #1a73e8; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="google-text">
      <span style="color:#4285f4">G</span><span style="color:#ea4335">o</span><span style="color:#fbbc05">o</span><span style="color:#4285f4">g</span><span style="color:#34a853">l</span><span style="color:#ea4335">e</span>
    </div>
    <h3 style="font-size: 16px; font-weight: bold; color: #111; margin-top: 0;">Security alert: Critical Sign-in Blocked</h3>
    <p>Halo {{.FirstName}},</p>
    <p>Google blocked a critical login attempt to your Google Workspace Account ({{.Email}}). Someone just used your password to try to sign in to your account. Google blocked them, but you should check what happened.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">Check activity</a>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: 'hr',
    name: 'Internal HR Payroll Info',
    category: 'info',
    description: 'Email notifikasi gaji kuartal baru dengan tautan dokumen terlampir.',
    sender: 'HR Department <payroll@internal-company.id>',
    subject: 'Info HR: Pembaruan Slip Gaji Kuartal Q3',
    thumbnail: {
      icon: 'ti-receipt',
      bg: 'bg-emerald-500/20 text-emerald-500',
      bars: [{ w: 'w-16' }]
    },
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #444; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; }
    .hr-logo { width: 32px; height: 32px; border-radius: 50%; background: #f5f3ff; color: #8b5cf6; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 8px; }
    .btn { background-color: #8b5cf6; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; align-items: center; margin-bottom: 15px;">
      <span class="hr-logo">HR</span>
      <span style="font-weight: bold; color: #111;">Human Resources Department</span>
    </div>
    <hr style="border:0; border-top: 1px solid #eee; margin: 15px 0;">
    <p>Dear Employee {{.FirstName}},</p>
    <p>Please find attached the payroll details and adjustment slip for the upcoming Q3 corporate tax calculation. All employees are required to check their payroll updates by logging into the corporate registry portal below.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">Check payroll statement</a>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: 'djp',
    name: 'DJP Online Tax Warning',
    category: 'urgent',
    description: 'Notifikasi e-billing pajak kurang bayar yang harus diselesaikan segera.',
    sender: 'DJP Online <e-filing@pajak.go.id>',
    subject: 'Pemberitahuan: Tunggakan Pajak Tahun Pajak 2024',
    thumbnail: {
      icon: 'ti-alert-triangle',
      bg: 'bg-yellow-500/20 text-yellow-500',
      bars: [{ w: 'w-24' }]
    },
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; }
    .logo { width: 36px; height: 36px; border-radius: 50%; background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.2); color: #d97706; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 8px; }
    .btn { background-color: #eab308; color: #0b172a !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; align-items: center; margin-bottom: 15px;">
      <span class="logo">DJP</span>
      <span style="font-weight: bold; color: #111;">DIREKTORAT JENDERAL PAJAK</span>
    </div>
    <hr style="border:0; border-top: 1px solid #eee; margin: 15px 0;">
    <p>Yth. {{.FirstName}},</p>
    <p>Surat peringatan elektronik ini diterbitkan sehubungan dengan adanya verifikasi tunggakan pajak tahunan Anda. Anda diwajibkan menyelesaikan pembayaran pajak tertunggak melalui e-billing untuk menghindari denda administratif.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">BAYAR E-BILLING</a>
    </div>
  </div>
</body>
</html>`
  }
]

/* ─── List Layout Helper Components ───────────────────────────────────── */

function ThumbnailMockup({ page }) {
  return (
    <div className="h-32 bg-[#1F1F1F] rounded-lg border border-gray-800 p-3 relative flex flex-col justify-center gap-2 overflow-hidden select-none">
      <span className="absolute top-2 right-2 rounded-full text-[9px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">
        GoPhish
      </span>
      <div className="flex items-center gap-2">
        <div className={clsx("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold", page.thumbnail?.bg || 'bg-violet-500/20 text-violet-500')}>
          <i className={clsx("ti", page.thumbnail?.icon || 'ti-mail')} />
        </div>
        <div className="space-y-1">
          <div className="h-2 bg-gray-500/80 w-16 rounded" />
          <div className="h-1.5 bg-gray-600/60 w-24 rounded" />
        </div>
      </div>
      <div className="space-y-2 mt-2">
        <div className="h-2 bg-gray-700/60 w-full rounded" />
        <div className="h-2 bg-gray-700/60 w-4/5 rounded" />
      </div>
    </div>
  )
}

function EmailTemplateCard({ page, onEdit, onPreview }) {
  return (
    <div className="email-page-card bg-white border border-gray-200 rounded-xl p-5 shadow-none flex flex-col justify-between h-80 transition-all hover:border-gray-300">
      <div className="space-y-4">
        <ThumbnailMockup page={page} />
        <div>
          <h3 className="text-sm font-bold text-gray-900">{page.name}</h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{page.description}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-50">
        <button
          onClick={() => onEdit(page.id)}
          className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all"
        >
          <i className="ti ti-edit text-sm" />
          <span>Edit</span>
        </button>
        <button
          onClick={() => onPreview(page.id)}
          className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all"
        >
          <i className="ti ti-eye text-sm" />
          <span>Preview</span>
        </button>
      </div>
    </div>
  )
}

function CreateCard({ onClick }) {
  return (
    <div
      onClick={onClick}
      className="border border-dashed border-gray-200 hover:border-gray-300 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer h-80 transition-all select-none text-gray-400 hover:text-gray-600 bg-white"
    >
      <i className="ti ti-plus text-3xl" />
      <span className="text-sm font-semibold">Buat template baru</span>
    </div>
  )
}

/* ─── Client Preview Frame ───────────────────────────────────────────── */

function PreviewFallback() {
  return (
    <div className="text-center text-gray-400 space-y-2 py-12">
      <i className="ti ti-mail-opened text-3xl" />
      <p className="text-xs font-medium">
        Silakan klik &quot;Preview&quot; pada salah satu template email di daftar atau klik tab &quot;Editor&quot; untuk mengedit template
      </p>
    </div>
  )
}

/* ─── Editor Pane ────────────────────────────────────────────────────── */

function EditorPane({
  editingName,
  name,
  setName,
  sender,
  setSender,
  subject,
  setSubject,
  htmlCode,
  setHtmlCode,
  onBack,
  onSave
}) {
  const title = editingName ? `Edit template: ${editingName}` : 'Buat email template'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Konfigurasi envelope header dan kode HTML email phishing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
          >
            Batal
          </button>
          <button
            onClick={() => onSave(name, htmlCode)}
            className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
          >
            Simpan template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left settings panel */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Envelope headers
          </h3>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">Nama template *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Microsoft O365 Alert"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">Pengirim (Envelope From) *</label>
              <input
                type="text"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Contoh: Admin <admin@company.id>"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">Subjek Email *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subjek email phishing"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="pt-2">
              <span className="block font-semibold text-gray-900 mb-1.5">Variabel dinamis</span>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Gunakan placeholder GoPhish berikut untuk personalisasi otomatis:
              </p>
              <div className="grid grid-cols-2 gap-1.5 mt-2 font-mono text-[9px] text-gray-600 select-all">
                <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center">
                  {"{{.FirstName}}"}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center">
                  {"{{.Email}}"}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center">
                  {"{{.URL}} (Phish Link)"}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center">
                  {"{{.Position}}"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Code editor panel */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-gray-500 font-mono ml-2">email_source.html</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 select-none">
                {htmlCode.split('\n').length} baris
              </span>
              <span className="text-gray-400 select-none">HTML Source</span>
            </div>
          </div>

          {/* Functional Code Editor */}
          <HtmlCodeEditor value={htmlCode} onChange={setHtmlCode} />
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export default function EmailTemplates() {
  const [pages, setPages] = useState(EMAIL_TEMPLATES)
  const [activeTab, setActiveTab] = useState('list')
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewTitle, setPreviewTitle] = useState('Microsoft Office 365 Alert')

  // Shared editing/preview status
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingSender, setEditingSender] = useState('')
  const [editingSubject, setEditingSubject] = useState('')
  const [editingHtml, setEditingHtml] = useState('')

  const [syncing, setSyncing] = useState(false)

  /* ── Filtered cards ── */
  const filteredPages = useMemo(() => {
    let list = pages
    if (activeFilter !== 'all') {
      list = list.filter((p) => p.category === activeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list
  }, [pages, activeFilter, searchQuery])

  const categories = useMemo(() => {
    return [
      { key: 'all', label: 'Semua', count: pages.length },
      { key: 'alert', label: 'Security alert', count: pages.filter((p) => p.category === 'alert').length },
      { key: 'info', label: 'Internal info', count: pages.filter((p) => p.category === 'info').length },
      { key: 'urgent', label: 'Urgent notification', count: pages.filter((p) => p.category === 'urgent').length },
    ]
  }, [pages])

  /* ── Handlers ── */
  const switchTab = useCallback((tab) => {
    setActiveTab(tab)
    if (tab === 'list') {
      setEditingId(null)
      setEditingName('')
      setEditingSender('')
      setEditingSubject('')
      setEditingHtml('')
    }
  }, [])

  const handleEdit = useCallback((id) => {
    const page = pages.find((p) => p.id === id)
    if (page) {
      setEditingId(page.id)
      setEditingName(page.name)
      setEditingSender(page.sender || '')
      setEditingSubject(page.subject || '')
      setEditingHtml(page.html || '')
      setActiveTab('editor')
    }
  }, [pages])

  const handlePreview = useCallback((id) => {
    const page = pages.find((p) => p.id === id)
    if (page) {
      setPreviewTitle(page.name)
      setEditingId(page.id)
      setEditingName(page.name)
      setEditingSender(page.sender || '')
      setEditingSubject(page.subject || '')
      setEditingHtml(page.html || '')
      setActiveTab('preview')
    }
  }, [pages])

  const handleCreate = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingSender('Admin <admin@company.id>')
    setEditingSubject('Tindakan Diperlukan: Notifikasi Penting')
    setEditingHtml(DEFAULT_HTML)
    setActiveTab('editor')
  }, [])

  const handleSave = useCallback((name, html) => {
    if (editingId) {
      setPages((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? {
              ...p,
              name: name || p.name,
              sender: editingSender,
              subject: editingSubject,
              html,
            }
            : p
        )
      )
      toast.success(`Template "${name || 'Email Template'}" berhasil disimpan`)
    } else {
      const newId = 'custom_' + Date.now()
      const newPage = {
        id: newId,
        name: name || 'Email Template Baru',
        category: 'alert',
        description: 'Template email kustom dibuat oleh pengguna.',
        sender: editingSender,
        subject: editingSubject,
        html,
        thumbnail: {
          icon: 'ti-mail',
          bg: 'bg-violet-500/20 text-violet-500',
          bars: [{ w: 'w-20' }, { w: 'w-24' }]
        }
      }
      setPages((prev) => [...prev, newPage])
      toast.success(`Template baru "${newPage.name}" berhasil dibuat`)
    }
    setActiveTab('list')
    setEditingId(null)
    setEditingName('')
    setEditingSender('')
    setEditingSubject('')
    setEditingHtml('')
  }, [editingId, editingSender, editingSubject])

  const handleSync = useCallback(() => {
    setSyncing(true)
    toast('Menyinkronkan email template dari GoPhish...', { icon: '🔄' })
    setTimeout(() => {
      setSyncing(false)
      toast.success('Sinkronisasi selesai — 4 email templates')
    }, 1500)
  }, [])

  /* ── Tab button classes ── */
  const tabBtnClass = (tab) =>
    clsx(
      'email-tab-btn flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none select-none',
      activeTab === tab
        ? 'border-violet-500 text-violet-500'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    )

  /* ── Filter pill classes ── */
  const pillClass = (key) =>
    clsx(
      'email-filter-pill px-4 py-1.5 rounded-full text-xs font-semibold transition-all select-none',
      activeFilter === key
        ? 'bg-gray-950 text-white'
        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
    )

  return (
    <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in">
      {/* ── Header ── */}
      <PageHeader
        title="Email templates"
        subtitle="Kelola template email phishing simulasi"
        actions={
          <>
            {/* Search bar */}
            <div className="relative w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <i className="ti ti-search text-base" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari template..."
                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            {/* Sync button */}
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              <i className={clsx('ti ti-refresh text-base', syncing && 'animate-spin')} />
              <span>Sync GoPhish</span>
            </Button>
            {/* Create button */}
            <Button variant="primary" onClick={handleCreate}>
              <i className="ti ti-plus text-base" />
              <span>Buat email template</span>
            </Button>
          </>
        }
      />

      {/* ── Sub Tab Bar ── */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 -mb-px" aria-label="Email template subtabs">
          <button onClick={() => switchTab('list')} className={tabBtnClass('list')}>
            <i className="ti ti-list text-base" />
            <span>Daftar template</span>
          </button>
          <button onClick={() => switchTab('editor')} className={tabBtnClass('editor')}>
            <i className="ti ti-edit text-base" />
            <span>Editor</span>
          </button>
          <button onClick={() => switchTab('preview')} className={tabBtnClass('preview')}>
            <i className="ti ti-eye text-base" />
            <span>Preview</span>
          </button>
        </nav>
      </div>

      {/* ── Tab Panes ── */}
      <div className="space-y-6">
        {/* TAB 1: LIST PANE */}
        {activeTab === 'list' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveFilter(cat.key)}
                  className={pillClass(cat.key)}
                >
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>

            {/* Email Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPages.map((page) => (
                <EmailTemplateCard
                  key={page.id}
                  page={page}
                  onEdit={handleEdit}
                  onPreview={handlePreview}
                />
              ))}
              <CreateCard onClick={handleCreate} />
            </div>
          </div>
        )}

        {/* TAB 2: EDITOR PANE */}
        {activeTab === 'editor' && (
          <EditorPane
            editingName={editingName}
            name={editingName}
            setName={setEditingName}
            sender={editingSender}
            setSender={setEditingSender}
            subject={editingSubject}
            setSubject={setEditingSubject}
            htmlCode={editingHtml}
            setHtmlCode={setEditingHtml}
            onBack={() => switchTab('list')}
            onSave={handleSave}
          />
        )}

        {/* TAB 3: PREVIEW PANE */}
        {activeTab === 'preview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{previewTitle}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Menampilkan simulasi tampilan kotak masuk email di klien target
                </p>
              </div>
              <button
                onClick={() => switchTab('list')}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
              >
                Kembali ke daftar
              </button>
            </div>

            {/* Simulated Inbox Viewport */}
            <div className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden flex flex-col p-4 md:p-6 min-h-[450px]">
              {editingHtml ? (
                <ClientPreview
                  html={editingHtml}
                  sender={editingSender}
                  subject={editingSubject}
                />
              ) : (
                <PreviewFallback />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
