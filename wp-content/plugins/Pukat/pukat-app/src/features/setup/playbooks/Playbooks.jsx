import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const CATEGORY_FILTERS = ['all', 'BEC', 'Credential', 'Malware', 'Vishing']

const INITIAL_PLAYBOOKS = [
  {
    id: 'bec-ceo',
    name: 'BEC — CEO Invoice Request',
    desc: 'CEO impersonation requesting an urgent funds transfer by email',
    longDesc: 'A Business Email Compromise scenario where the attacker impersonates the CEO and requests an immediate funds transfer through an email that feels urgent and personal.',
    category: 'BEC',
    diffScore: '4/5',
    diffText: 'High (4/5)',
    dept: 'Finance',
    deptTag: ['Finance staff', 'Accounting officer', 'Finance manager', 'Vendor management'],
    usedCount: '8x',
    clickAvg: '42%',
    submitAvg: '19%',
    clickSub: 'highest in catalog',
    submitSub: 'of clickers',
    iconColor: '#B91C1C',
    iconBg: '#FEE2E2',
    iconName: 'ti-alert-triangle',
    nistInfo: 'The email uses the recipient name, job title, and realistic contextual details. Strong urgency and conventional domain spoofing make it hard to distinguish from a real CEO email.',
    scenarioText: 'A spoofed CEO sends an email to Finance staff saying an urgent vendor payment of IDR 150 million must be confirmed before EOD. The email asks the recipient to click a link and complete a confirmation form. The landing page mimics the company internal portal.',
    components: [
      { type: 'email', name: 'Email template — "Urgent: Invoice approval needed"', sub: 'From: ceo@{spoofed-domain}.com · Subject includes the recipient name dynamically · HTML with inline styling', badge: 'GoPhish template', bg: '#DBEAFE', icon: 'ti-mail', color: '#1D4ED8' },
      { type: 'page', name: 'Landing page — Fake invoice confirmation portal', sub: 'Captures: click, form submission (name, role, amount confirmation) · Redirects to an education page after submission', badge: 'GoPhish page', bg: '#D1FAE5', icon: 'ti-world', color: '#065F46' },
      { type: 'smtp', name: 'SMTP — Relay pool "finance-relay-01"', sub: 'Sending profile: smtp.relay-pool.internal · Port 587 · TLS · From domain: validated SPF/DKIM', badge: 'Sending profile', bg: '#FEF3C7', icon: 'ti-send', color: '#92400E' },
      { type: 'domain', name: 'Domain — ceo-approval-{random}.corp-internal.net', sub: 'Dynamic domain provisioning · Lookalike pattern · SSL auto-issued · 7-day TTL', badge: 'Dynamic domain', bg: '#F3E8FF', icon: 'ti-network', color: '#7C3AED' },
    ],
    insights: [
      { text: 'The highest click rate occurs on Monday morning (08:00-10:00)', sub: 'Across 8 simulations · 67% of clicks happened in the first 2 hours', icon: 'ti-trending-up', color: '#EF4444' },
      { text: 'Finance is the most vulnerable department for this playbook', sub: 'Avg Finance click rate: 52% vs organization average: 28%', icon: 'ti-building', color: '#F59E0B' },
      { text: 'Avoid running the same playbook within 90 days for the same group', sub: 'Effectiveness drops significantly when the scenario becomes familiar', icon: 'ti-repeat', color: '#6C63FF' },
    ],
  },
  {
    id: 'cred-m365',
    name: 'Credential — Microsoft 365',
    desc: 'Fake Microsoft login page for all departments',
    longDesc: 'A credential phishing scenario that duplicates the Microsoft 365 sign-in page. Targets are directed to revalidate their corporate email session.',
    category: 'Credential',
    diffScore: '3/5',
    diffText: 'Medium (3/5)',
    dept: 'All departments',
    deptTag: ['All Staff', 'IT Admin', 'Operations'],
    usedCount: '12x',
    clickAvg: '31%',
    submitAvg: '15%',
    clickSub: 'high engagement rate',
    submitSub: 'moderate capture rate',
    iconColor: '#1D4ED8',
    iconBg: '#DBEAFE',
    iconName: 'ti-lock',
    nistInfo: 'Uses a standard system notification email. The visual technique is highly accurate, but the email headers reveal a non-corporate external domain.',
    scenarioText: 'Users receive a notification that their email integration will expire within 24 hours. The button links to a fake Microsoft 365 sign-in page that asks for the corporate password.',
    components: [
      { type: 'email', name: 'Email template — "Action Required: Sync your corporate inbox"', sub: 'From: support@microsoft-365.id · Subject references email server maintenance', badge: 'GoPhish template', bg: '#DBEAFE', icon: 'ti-mail', color: '#1D4ED8' },
      { type: 'page', name: 'Landing page — Microsoft Outlook Web Login Clone', sub: 'Captures: Email, Password, User-Agent · Redirects to the real Office portal after login', badge: 'GoPhish page', bg: '#D1FAE5', icon: 'ti-world', color: '#065F46' },
      { type: 'smtp', name: 'SMTP — Relay pool "standard-relay-02"', sub: 'Sending profile: smtp.office-relay.net · Port 587 · STARTTLS', badge: 'Sending profile', bg: '#FEF3C7', icon: 'ti-send', color: '#92400E' },
      { type: 'domain', name: 'Domain — mail.outlook-365-login.net', sub: 'Lookup domain lookalike · Let\'s Encrypt SSL active', badge: 'Dynamic domain', bg: '#F3E8FF', icon: 'ti-network', color: '#7C3AED' },
    ],
    insights: [
      { text: 'The highest click rate appears midweek (Wednesday at 13:00)', sub: 'Many users check email after lunch', icon: 'ti-trending-up', color: '#EF4444' },
      { text: 'Administration and HR staff are most vulnerable to this sync tactic', sub: 'Click rate 40% vs IT Support: 12%', icon: 'ti-building', color: '#F59E0B' },
      { text: 'Auto-lockout warnings increase click conversion by up to 15%', sub: 'Fear of losing access pushes users to act quickly', icon: 'ti-repeat', color: '#6C63FF' },
    ],
  },
  {
    id: 'malware-hr',
    name: 'Malware — HR Policy Update',
    desc: 'Malicious attachment in a fake HR policy email',
    longDesc: 'Simulates a malware delivery scenario where targets are asked to download an HR benefits policy update attachment that contains a macro/executable simulation file.',
    category: 'Malware',
    diffScore: '2/5',
    diffText: 'Low (2/5)',
    dept: 'HR · All departments',
    deptTag: ['All Staff', 'HR Operations', 'Line Manager'],
    usedCount: '6x',
    clickAvg: '28%',
    submitAvg: '8%',
    clickSub: 'average response',
    submitSub: 'average file download',
    iconColor: '#92400E',
    iconBg: '#FEF3C7',
    iconName: 'ti-file-alert',
    nistInfo: 'The email sparks staff interest in salary or benefits information. Anti-virus and spam filters usually block this file extension automatically.',
    scenarioText: 'The HR department sends a circular about employee healthcare benefit updates. Targets are asked to download an Excel document to view adjusted amounts for each division.',
    components: [
      { type: 'email', name: 'Email template — "HR Update: New welfare policy 2025"', sub: 'From: hr-benefits@internal-company.id · Includes a document attachment', badge: 'GoPhish template', bg: '#DBEAFE', icon: 'ti-mail', color: '#1D4ED8' },
      { type: 'page', name: 'Landing page — Direct file download link', sub: 'Serves a simulation file (.docx.exe / macro-enabled xlsm) · Records download click activity', badge: 'GoPhish page', bg: '#D1FAE5', icon: 'ti-world', color: '#065F46' },
      { type: 'smtp', name: 'SMTP — Internal relay server', sub: 'Port 25 · Open SMTP relay bypass configuration', badge: 'Sending profile', bg: '#FEF3C7', icon: 'ti-send', color: '#92400E' },
      { type: 'domain', name: 'Domain — files.hr-benefits-portal.com', sub: 'Storage CDN mock lookalike · SSL verified', badge: 'Dynamic domain', bg: '#F3E8FF', icon: 'ti-network', color: '#7C3AED' },
    ],
    insights: [
      { text: 'Most targets download the file on desktop', sub: 'Only 5% of file downloads happen through mobile browsers', icon: 'ti-trending-up', color: '#EF4444' },
      { text: 'Windows macro warnings prevent 35% of malware executions', sub: 'Built-in OS warning education proved very helpful', icon: 'ti-building', color: '#F59E0B' },
      { text: 'Including the target division name in the filename improves success', sub: 'Example: "Finance_Division_Payslip.xlsm" versus a generic filename', icon: 'ti-repeat', color: '#6C63FF' },
    ],
  },
  {
    id: 'cred-helpdesk',
    name: 'Credential — IT Helpdesk Reset',
    desc: 'Fake password reset notification from IT helpdesk',
    longDesc: 'A social engineering tactic where a fake IT staff member requests an immediate password reset due to a suspected security anomaly on the target Active Directory account.',
    category: 'Credential',
    diffScore: '3/5',
    diffText: 'Medium (3/5)',
    dept: 'All departments',
    deptTag: ['All Staff', 'Developer', 'Security Operations'],
    usedCount: '5x',
    clickAvg: '24%',
    submitAvg: '12%',
    clickSub: 'moderate click rate',
    submitSub: 'moderate submit rate',
    iconColor: '#7C3AED',
    iconBg: '#F3E8FF',
    iconName: 'ti-device-mobile',
    nistInfo: 'Targets often comply with IT security instructions. Using the company logo and the IT division head signature creates instant trust.',
    scenarioText: 'An email sent on behalf of the Network Administrator states that suspicious login anomalies were detected. Recipients are instructed to update their AD password within 1 hour to prevent account deactivation.',
    components: [
      { type: 'email', name: 'Email template — "CRITICAL: Reset your Active Directory password"', sub: 'From: helpdesk@internal-company.id · Internal helpdesk domain spoofing', badge: 'GoPhish template', bg: '#DBEAFE', icon: 'ti-mail', color: '#1D4ED8' },
      { type: 'page', name: 'Landing page — IT Self-Service Password Reset Portal', sub: 'Captures: Username, old password, new password · Fake MFA verification form', badge: 'GoPhish page', bg: '#D1FAE5', icon: 'ti-world', color: '#065F46' },
      { type: 'smtp', name: 'SMTP — Corporate gateway simulator', sub: 'Port 587 · TLS · Validated SPF record', badge: 'Sending profile', bg: '#FEF3C7', icon: 'ti-send', color: '#92400E' },
      { type: 'domain', name: 'Domain — sso.portal-reset-ad.com', sub: 'lookalike domain portal · SSL active', badge: 'Dynamic domain', bg: '#F3E8FF', icon: 'ti-network', color: '#7C3AED' },
    ],
    insights: [
      { text: 'Fake MFA prompts captured 40% of credential submitters', sub: 'Many users are used to entering OTP tokens without pausing', icon: 'ti-trending-up', color: '#EF4444' },
      { text: 'Non-technical divisions show 3x higher vulnerability', sub: 'Customer service: 45% click rate vs Engineering division: 8%', icon: 'ti-building', color: '#F59E0B' },
      { text: 'Lookalike domains that use internal-style naming are highly deceptive', sub: 'For example portal-help.corp.com vs portal-reset.net', icon: 'ti-repeat', color: '#6C63FF' },
    ],
  },
  {
    id: 'bec-vendor',
    name: 'BEC — Vendor Payment Switch',
    desc: 'Urgent vendor bank account change request',
    longDesc: 'An advanced Business Email Compromise scenario targeting accounting and finance staff. The email appears to come from a key vendor announcing an updated bank account for invoice payments.',
    category: 'BEC',
    diffScore: '5/5',
    diffText: 'Very High (5/5)',
    dept: 'Finance · Legal',
    deptTag: ['Finance staff', 'Accounting controller', 'Procurement division'],
    usedCount: '3x',
    clickAvg: '51%',
    submitAvg: '28%',
    clickSub: 'very high',
    submitSub: 'highly vulnerable',
    iconColor: '#9D174D',
    iconBg: '#FCE7F3',
    iconName: 'ti-package',
    nistInfo: 'The email sequence is designed like a real invoice discussion thread. Legal claims and late-payment penalties are inserted to trigger fear in staff.',
    scenarioText: 'A vendor sends an email updating billing details for an invoice due this week. If not updated, the vendor threatens to hold the next logistics stock delivery.',
    components: [
      { type: 'email', name: 'Email template — "URGENT: Change in billing details for invoice #892"', sub: 'From: accounts@billing-vendor.net · Lookalike domain for the primary vendor', badge: 'GoPhish template', bg: '#DBEAFE', icon: 'ti-mail', color: '#1D4ED8' },
      { type: 'page', name: 'Landing page — Vendor Bank Update Portal', sub: 'Captures invoice amount confirmation, previous bank, and new bank', badge: 'GoPhish page', bg: '#D1FAE5', icon: 'ti-world', color: '#065F46' },
      { type: 'smtp', name: 'SMTP — Custom vendor relay server', sub: 'SMTP authentication with validated reverse DNS', badge: 'Sending profile', bg: '#FEF3C7', icon: 'ti-send', color: '#92400E' },
      { type: 'domain', name: 'Domain — vendor-billing-updates.com', sub: 'Dedicated portal lookalike domain', badge: 'Dynamic domain', bg: '#F3E8FF', icon: 'ti-network', color: '#7C3AED' },
    ],
    insights: [
      { text: 'The most dangerous playbook in the catalog', sub: 'Click rate reached 51% because the subject was highly relevant and urgent', icon: 'ti-trending-up', color: '#EF4444' },
      { text: 'Procurement is also highly vulnerable', sub: 'Procurement click rate 45% vs Corporate Legal: 15%', icon: 'ti-building', color: '#F59E0B' },
      { text: 'Secondary phone verification can fully prevent this attack', sub: 'All clicks converted because targets skipped calling the vendor directly', icon: 'ti-repeat', color: '#6C63FF' },
    ],
  },
  {
    id: 'cred-prize',
    name: 'Credential — Prize Notification',
    desc: 'Fake prize notification email with a login link',
    longDesc: 'A classic phishing scenario that exploits excitement by telling targets they have won a giveaway or company anniversary reward.',
    category: 'Credential',
    diffScore: '1/5',
    diffText: 'Very Low (1/5)',
    dept: 'All departments',
    deptTag: ['All Staff', 'Internship', 'General support'],
    usedCount: '2x',
    clickAvg: '18%',
    submitAvg: '5%',
    clickSub: 'low response rate',
    submitSub: 'low capture rate',
    iconColor: '#065F46',
    iconBg: '#D1FAE5',
    iconName: 'ti-award',
    nistInfo: 'A classic scam scenario. Modern security filters detect it easily, and alert users are likely to suspect this kind of email is spam.',
    scenarioText: 'Targets receive good news about a free shopping voucher as appreciation for monthly work performance. The link points to a reward claim form.',
    components: [
      { type: 'email', name: 'Email template — "Congratulations! You won employee of the month rewards"', sub: 'From: info@loyalty-corporate.id · Colorful retail discount layout', badge: 'GoPhish template', bg: '#DBEAFE', icon: 'ti-mail', color: '#1D4ED8' },
      { type: 'page', name: 'Landing page — Prize Claim portal', sub: 'Captures: personal email login details / mobile phone number', badge: 'GoPhish page', bg: '#D1FAE5', icon: 'ti-world', color: '#065F46' },
      { type: 'smtp', name: 'SMTP — Public marketing server pool', sub: 'SMTP Relay with low reputation score', badge: 'Sending profile', bg: '#FEF3C7', icon: 'ti-send', color: '#92400E' },
      { type: 'domain', name: 'Domain — corporate-loyalty-rewards.net', sub: 'External rewards gateway portal', badge: 'Dynamic domain', bg: '#F3E8FF', icon: 'ti-network', color: '#7C3AED' },
    ],
    insights: [
      { text: 'The highest click rate appears on weekends', sub: 'Users tend to be more relaxed at home and tempted by reward offers', icon: 'ti-trending-up', color: '#EF4444' },
      { text: 'New hires and interns are more likely to click this link', sub: 'Internship click rate: 35% vs Senior Staff: 5%', icon: 'ti-building', color: '#F59E0B' },
      { text: 'This tactic is detected by built-in spam filters 90% of the time', sub: 'Poor sender domain reputation makes it harder to reach the primary inbox', icon: 'ti-repeat', color: '#6C63FF' },
    ],
  },
]

const CATEGORY_TAG = {
  BEC: 'bg-red-100 text-red-800',
  Credential: 'bg-blue-100 text-blue-800',
  Malware: 'bg-amber-100 text-amber-800',
  Vishing: 'bg-purple-100 text-purple-800',
}

const DIFFICULTY_TAG = {
  1: 'bg-sky-100 text-sky-700',
  2: 'bg-emerald-100 text-emerald-800',
  3: 'bg-amber-100 text-amber-800',
  4: 'bg-rose-100 text-rose-800',
  5: 'bg-pink-100 text-pink-800',
}

const CATEGORY_META = {
  BEC: { iconBg: '#FEE2E2', iconColor: '#B91C1C', iconName: 'ti-alert-triangle' },
  Credential: { iconBg: '#DBEAFE', iconColor: '#1D4ED8', iconName: 'ti-lock' },
  Malware: { iconBg: '#FEF3C7', iconColor: '#92400E', iconName: 'ti-file-alert' },
  Vishing: { iconBg: '#F3E8FF', iconColor: '#7C3AED', iconName: 'ti-device-mobile' },
}

const DIFFICULTY_TEXT = {
  1: 'Very Low (1/5)',
  2: 'Low (2/5)',
  3: 'Medium (3/5)',
  4: 'High (4/5)',
  5: 'Very High (5/5)',
}

const DEFAULT_FORM = {
  name: '',
  desc: '',
  category: 'BEC',
  dept: 'All departments',
  difficulty: '3',
  email: 'Urgent: Invoice approval needed',
  page: 'Generic credential landing page',
  smtp: 'standard-relay-02',
  domain: 'Domain — campaign-{random}.corp-sim.local',
  scenario: '',
}

const COMPONENT_OPTIONS = {
  email: [
    'Urgent: Invoice approval needed',
    'Action Required: Sync your corporate inbox',
    'HR Update: New welfare policy 2025',
    'CRITICAL: Reset your Active Directory password',
    'URGENT: Change in billing details for invoice #892',
    'Congratulations! You won employee of the month rewards',
  ],
  page: [
    'Generic credential landing page',
    'Fake invoice confirmation portal',
    'Microsoft Outlook Web Login Clone',
    'Direct file download link',
    'IT Self-Service Password Reset Portal',
    'Vendor Bank Update Portal',
    'Prize Claim portal',
  ],
  smtp: [
    'standard-relay-02',
    'finance-relay-01',
    'Internal relay server',
    'Corporate gateway simulator',
    'Custom vendor relay server',
    'Public marketing server pool',
  ],
}

function pillClass(active) {
  return clsx(
    'rounded-full px-3 py-1 text-xs font-semibold transition-all select-none',
    active
      ? 'bg-gray-950 text-white'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  )
}

function Tag({ children, className }) {
  return (
    <span className={clsx('inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold', className)}>
      {children}
    </span>
  )
}

function cleanComponentName(value = '', prefix = '') {
  return value
    .replace(prefix, '')
    .replace(/^["']|["']$/g, '')
    .trim()
}

function getComponentValue(playbook, type, fallback) {
  const component = playbook.components?.find(item => item.type === type)
  if (!component) return fallback

  if (type === 'email') return cleanComponentName(component.name, 'Email template — ')
  if (type === 'page') return cleanComponentName(component.name, 'Landing page — ')
  if (type === 'smtp') return cleanComponentName(component.name, 'SMTP — ')
  return component.name
}

function formFromPlaybook(playbook) {
  if (!playbook) return DEFAULT_FORM

  return {
    name: playbook.name ?? '',
    desc: playbook.longDesc ?? playbook.desc ?? '',
    category: playbook.category ?? 'BEC',
    dept: playbook.dept ?? 'All departments',
    difficulty: playbook.diffScore?.charAt(0) ?? '3',
    email: getComponentValue(playbook, 'email', DEFAULT_FORM.email),
    page: getComponentValue(playbook, 'page', DEFAULT_FORM.page),
    smtp: getComponentValue(playbook, 'smtp', DEFAULT_FORM.smtp),
    domain: getComponentValue(playbook, 'domain', DEFAULT_FORM.domain),
    scenario: playbook.scenarioText ?? '',
  }
}

function buildPlaybookFromForm(form, existing) {
  const meta = CATEGORY_META[form.category] ?? CATEGORY_META.BEC
  const difficulty = form.difficulty || '3'
  const name = form.name.trim()
  const desc = form.desc.trim()
  const dept = form.dept.trim() || 'All departments'
  const scenario = form.scenario.trim()

  return {
    ...(existing ?? {}),
    id: existing?.id ?? `custom-${Date.now()}`,
    name,
    desc,
    longDesc: desc,
    category: form.category,
    diffScore: `${difficulty}/5`,
    diffText: DIFFICULTY_TEXT[difficulty] ?? DIFFICULTY_TEXT[3],
    dept,
    deptTag: [dept],
    usedCount: existing?.usedCount ?? '0x',
    clickAvg: existing?.clickAvg ?? '0%',
    submitAvg: existing?.submitAvg ?? '0%',
    clickSub: existing?.clickSub ?? 'not tested yet',
    submitSub: existing?.submitSub ?? 'not tested yet',
    iconColor: meta.iconColor,
    iconBg: meta.iconBg,
    iconName: meta.iconName,
    nistInfo: `Attack scenario using a ${form.category.toLowerCase()} theme with ${DIFFICULTY_TEXT[difficulty] ?? DIFFICULTY_TEXT[3]} difficulty.`,
    scenarioText: scenario,
    components: [
      { type: 'email', name: `Email template — "${form.email}"`, sub: 'Subject includes the recipient name dynamically', badge: 'GoPhish template', bg: '#DBEAFE', icon: 'ti-mail', color: '#1D4ED8' },
      { type: 'page', name: `Landing page — ${form.page}`, sub: 'Captures credentials / form data', badge: 'GoPhish page', bg: '#D1FAE5', icon: 'ti-world', color: '#065F46' },
      { type: 'smtp', name: `SMTP — ${form.smtp}`, sub: 'Port 587 · TLS · Validated sending profile', badge: 'Sending profile', bg: '#FEF3C7', icon: 'ti-send', color: '#92400E' },
      { type: 'domain', name: form.domain, sub: 'Dynamic lookalike domain provisioning', badge: 'Dynamic domain', bg: '#F3E8FF', icon: 'ti-network', color: '#7C3AED' },
    ],
    insights: existing?.insights ?? [
      { text: 'Click rate is estimated from the simulation parameters', sub: 'No historical data is available yet', icon: 'ti-trending-up', color: '#EF4444' },
      { text: `Affected target department: ${dept}`, sub: 'Secondary verification is recommended', icon: 'ti-building', color: '#F59E0B' },
    ],
  }
}

function PlaybookListItem({ playbook, selected, onSelect }) {
  const difficulty = playbook.diffScore.charAt(0)
  const rate = parseInt(playbook.clickAvg, 10) || 0

  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        'w-full rounded-lg border bg-white p-3.5 text-left transition-all',
        selected
          ? 'border-violet-500 bg-violet-50/40'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <div className="flex gap-3">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: playbook.iconBg }}
        >
          <i className={clsx('ti text-[15px]', playbook.iconName)} style={{ color: playbook.iconColor }} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-900">{playbook.name}</span>
          <span className="mt-0.5 block text-xs leading-snug text-gray-500">{playbook.desc}</span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Tag className={CATEGORY_TAG[playbook.category] ?? 'bg-gray-100 text-gray-700'}>{playbook.category}</Tag>
        <Tag className={DIFFICULTY_TAG[difficulty] ?? 'bg-gray-100 text-gray-700'}>Difficulty {playbook.diffScore}</Tag>
        <Tag className="bg-gray-100 text-gray-700">{playbook.dept}</Tag>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
        <span className="flex-shrink-0">Used {playbook.usedCount}</span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200">
          <span className="block h-full rounded-full bg-violet-500" style={{ width: `${rate}%` }} />
        </span>
        <span className="flex-shrink-0">Click rate avg {playbook.clickAvg}</span>
      </div>
    </button>
  )
}

function StatMini({ label, value, sub, color }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold" style={{ color }}>{sub}</div>
    </div>
  )
}

function ComponentRow({ component, onPreview }) {
  const canPreview = component.type === 'email' || component.type === 'page'

  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: component.bg }}>
        <i className={clsx('ti text-[13px]', component.icon)} style={{ color: component.color }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-gray-800">{component.name}</span>
        <span className="mt-0.5 block text-xs leading-snug text-gray-500">{component.sub}</span>
      </span>
      {canPreview && (
        <button
          type="button"
          onClick={() => onPreview(component)}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
        >
          <i className="ti ti-eye" />
          Preview
        </button>
      )}
      <span
        className="hidden flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-flex"
        style={{ backgroundColor: component.bg, color: component.color }}
      >
        {component.badge}
      </span>
    </div>
  )
}

function Field({ label, required, children, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] leading-relaxed text-gray-400">{hint}</span>}
    </label>
  )
}

function fieldClass() {
  return 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-800 outline-none transition-colors focus:border-violet-500'
}

function ComponentSelect({ icon, bg, color, label, value, options, onChange, onPreview }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 p-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: bg }}>
          <i className={clsx('ti text-[13px]', icon)} style={{ color }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-gray-800">{label}</span>
          <span className="block truncate text-xs font-medium text-gray-500">{value}</span>
        </span>
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] font-semibold text-violet-500 hover:text-violet-600"
          >
            <i className="ti ti-eye" />
            Preview
          </button>
        )}
      </div>
      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <select value={value} onChange={event => onChange(event.target.value)} className={fieldClass()}>
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function PlaybookSlideover({
  mode,
  form,
  dirty,
  onClose,
  onChange,
  onSubmit,
  onDelete,
  onPreviewEmail,
  onPreviewLanding,
}) {
  if (!mode) return null

  const isEdit = mode === 'edit'
  const difficultyScore = Number(form.difficulty || 3)

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-navy/40 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside className="flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl">
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <i className={clsx('ti', isEdit ? 'ti-edit' : 'ti-plus')} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Edit playbook' : 'Create playbook'}</h2>
            <p className="text-xs text-gray-500">Configure a GoPhish simulation playbook</p>
          </div>
          {dirty && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close playbook form"
          >
            <i className="ti ti-x text-lg" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <section className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Basic information</div>
            <Field label="Playbook name" required>
              <input
                value={form.name}
                onChange={event => onChange('name', event.target.value)}
                placeholder="Example: BEC — finance approval"
                className={fieldClass()}
              />
            </Field>
            <Field label="Description" required>
              <textarea
                value={form.desc}
                onChange={event => onChange('desc', event.target.value)}
                placeholder="Brief playbook summary"
                rows={3}
                className={clsx(fieldClass(), 'resize-none')}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Attack type">
                <select value={form.category} onChange={event => onChange('category', event.target.value)} className={fieldClass()}>
                  {CATEGORY_FILTERS.filter(item => item !== 'all').map(option => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Field>
              <Field label="Target department">
                <select value={form.dept} onChange={event => onChange('dept', event.target.value)} className={fieldClass()}>
                  <option>All departments</option>
                  <option>Finance</option>
                  <option>HR</option>
                  <option>Legal</option>
                  <option>IT</option>
                  <option>Custom</option>
                </select>
              </Field>
            </div>
            <Field label="Difficulty">
              <input
                type="range"
                min="1"
                max="5"
                value={form.difficulty}
                onChange={event => onChange('difficulty', event.target.value)}
                className="w-full accent-violet-500"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(score => (
                    <span
                      key={score}
                      className={clsx('h-1.5 w-8 rounded-full', score <= difficultyScore ? 'bg-red-500' : 'bg-gray-200')}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-red-700">
                  {DIFFICULTY_TEXT[form.difficulty] ?? DIFFICULTY_TEXT[3]}
                </span>
              </div>
            </Field>
          </section>

          <div className="h-px bg-gray-100" />

          <section className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Technical components</div>
            <ComponentSelect
              icon="ti-mail"
              bg="#DBEAFE"
              color="#1D4ED8"
              label="Email template"
              value={form.email}
              options={COMPONENT_OPTIONS.email}
              onChange={value => onChange('email', value)}
              onPreview={() => onPreviewEmail(form.email)}
            />
            <ComponentSelect
              icon="ti-world"
              bg="#D1FAE5"
              color="#065F46"
              label="Landing page"
              value={form.page}
              options={COMPONENT_OPTIONS.page}
              onChange={value => onChange('page', value)}
              onPreview={() => onPreviewLanding(form.page)}
            />
            <ComponentSelect
              icon="ti-send"
              bg="#FEF3C7"
              color="#92400E"
              label="SMTP profile"
              value={form.smtp}
              options={COMPONENT_OPTIONS.smtp}
              onChange={value => onChange('smtp', value)}
            />
            <Field label="Dynamic domain">
              <input
                value={form.domain}
                onChange={event => onChange('domain', event.target.value)}
                className={fieldClass()}
              />
            </Field>
          </section>

          <div className="h-px bg-gray-100" />

          <section className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Scenario</div>
            <Field label="Narrative shown to the target" hint="This text appears in the playbook details after saving.">
              <textarea
                value={form.scenario}
                onChange={event => onChange('scenario', event.target.value)}
                rows={5}
                placeholder="The target receives an email..."
                className={clsx(fieldClass(), 'resize-none')}
              />
            </Field>
          </section>
        </div>

        <footer className="flex flex-shrink-0 items-center gap-3 border-t border-gray-200 bg-gray-50 px-6 py-5">
          {isEdit && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500 bg-red-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600"
            >
              <i className="ti ti-trash" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500 bg-violet-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-600"
          >
            <i className="ti ti-device-floppy" />
            {isEdit ? 'Save changes' : 'Create playbook'}
          </button>
        </footer>
      </aside>
    </div>
  )
}

function EmailPreview({ value }) {
  const lower = value.toLowerCase()
  const isHr = lower.includes('hr') || lower.includes('policy') || lower.includes('welfare')
  const isPrize = lower.includes('congratulations') || lower.includes('rewards') || lower.includes('won')
  const isReset = lower.includes('reset') || lower.includes('password') || lower.includes('active directory')
  const isInvoice = lower.includes('invoice') || lower.includes('billing')

  let sender = 'Microsoft Security'
  let subject = 'Action Required: Sync your corporate inbox'
  let accent = '#0067b8'
  let title = 'Security alert'
  let body = 'We detected unusual sign-in activity on your Microsoft 365 account. Verify your session to avoid service interruption.'
  let action = 'Verify account'

  if (isHr) {
    sender = 'HR Benefits'
    subject = 'HR Update: New welfare policy 2025'
    accent = '#059669'
    title = 'New employee welfare policy'
    body = 'A revised benefit policy is ready for review. Please open the attached document and confirm receipt before the end of the week.'
    action = 'Open policy'
  } else if (isPrize) {
    sender = 'Corporate Loyalty'
    subject = 'Congratulations! You won employee rewards'
    accent = '#7c3aed'
    title = 'Employee reward notification'
    body = 'Your monthly performance reward is available. Claim your voucher using the secure portal below.'
    action = 'Claim reward'
  } else if (isReset) {
    sender = 'IT Helpdesk'
    subject = 'CRITICAL: Reset your Active Directory password'
    accent = '#2563eb'
    title = 'Password reset required'
    body = 'An anomaly was detected on your account. Reset your corporate password within one hour to keep access active.'
    action = 'Reset password'
  } else if (isInvoice) {
    sender = 'Executive Office'
    subject = value
    accent = '#dc2626'
    title = 'Invoice approval needed'
    body = 'A vendor payment requires confirmation today. Review the invoice details and submit approval before EOD.'
    action = 'Review invoice'
  }

  return (
    <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{sender}</span>
            <span className="font-mono text-gray-400">&lt;notification@corp-sim.local&gt;</span>
          </div>
          <span className="text-gray-400">Today, 10:24 AM</span>
        </div>
        <div className="mt-3 text-xs">
          <span className="text-gray-400">Subject: </span>
          <span className="font-semibold text-gray-900">{subject}</span>
        </div>
      </div>
      <div className="p-7">
        <div className="mx-auto max-w-lg border border-gray-100 p-6 text-xs leading-relaxed text-gray-700">
          <div className="mb-4 flex items-center gap-2 font-bold text-gray-700">
            <span className="h-5 w-5 rounded" style={{ backgroundColor: accent }} />
            <span>{sender}</span>
          </div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="mt-3">{body}</p>
          <div className="mt-5 rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600">
            Request ID: SIM-2025-0428<br />
            Recipient: {'{{.Email}}'}
          </div>
          <button
            type="button"
            className="mt-5 rounded px-5 py-2 text-xs font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  )
}

function LandingPreview({ value }) {
  const lower = value.toLowerCase()
  const isInvoice = lower.includes('invoice') || lower.includes('vendor') || lower.includes('billing') || lower.includes('confirmation')
  const isFile = lower.includes('direct file') || lower.includes('download')
  const isHr = lower.includes('hr') || lower.includes('employee')
  const isReset = lower.includes('reset') || lower.includes('password') || lower.includes('it self-service') || lower.includes('helpdesk')
  const isPrize = lower.includes('prize') || lower.includes('claim')

  if (isInvoice) {
    return (
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-gray-900">Invoice Approval Portal</div>
            <div className="text-xs text-gray-500">Finance workflow confirmation</div>
          </div>
          <span className="rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">URGENT</span>
        </div>
        <div className="space-y-3">
          <input disabled value="INV-2025-0892" className="w-full rounded border border-gray-200 px-3 py-2 text-xs text-gray-700" />
          <input disabled placeholder="Corporate email" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
          <input disabled placeholder="Approval note" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
        </div>
        <button type="button" className="mt-5 w-full rounded bg-red-600 py-2 text-xs font-bold text-white">Submit approval</button>
      </div>
    )
  }

  if (isFile) {
    return (
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <i className="ti ti-file-download text-xl" />
        </div>
        <h3 className="mt-4 text-base font-bold text-gray-900">HR Policy Document</h3>
        <p className="mt-1 text-xs text-gray-500">Benefit_Update_2025.xlsm</p>
        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-left text-[11px] text-gray-500">
          File size: 428 KB<br />
          Source: HR benefits portal
        </div>
        <button type="button" className="mt-5 w-full rounded bg-amber-500 py-2 text-xs font-bold text-white">Download file</button>
      </div>
    )
  }

  if (isHr) {
    return (
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <i className="ti ti-id-badge-2 text-xl" />
          </div>
          <h3 className="mt-3 text-base font-bold text-gray-900">HR Employee Portal</h3>
          <p className="text-xs text-gray-500">Update employee data</p>
        </div>
        <div className="mt-5 space-y-3">
          <input disabled placeholder="Employee ID" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
          <input disabled placeholder="Corporate email" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
          <input disabled placeholder="Phone number" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
        </div>
        <button type="button" className="mt-5 w-full rounded bg-emerald-600 py-2 text-xs font-bold text-white">Update data</button>
      </div>
    )
  }

  if (isReset || isPrize) {
    return (
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <i className={clsx('ti text-xl', isPrize ? 'ti-gift' : 'ti-key')} />
          </div>
          <h3 className="mt-3 text-base font-bold text-gray-900">{isPrize ? 'Prize Claim Portal' : 'IT Self-Service Password Reset'}</h3>
          <p className="text-xs text-gray-500">{isPrize ? 'Corporate reward verification' : 'Active Directory verification'}</p>
        </div>
        <div className="mt-5 space-y-3">
          <input disabled placeholder="Username / Email" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
          <input disabled placeholder="Password" type="password" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
        </div>
        <button type="button" className="mt-5 w-full rounded bg-blue-600 py-2 text-xs font-bold text-white">{isPrize ? 'Claim reward' : 'Reset password'}</button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm rounded border border-gray-300 bg-white p-8 shadow-sm">
      <div className="mb-5 flex items-center gap-2 font-semibold text-gray-500">
        <div className="grid h-4 w-4 grid-cols-2 gap-0.5">
          <span className="bg-[#f25022]" />
          <span className="bg-[#7fba00]" />
          <span className="bg-[#00a4ef]" />
          <span className="bg-[#ffb900]" />
        </div>
        <span>Microsoft</span>
      </div>
      <h3 className="text-base font-semibold text-gray-900">Sign in</h3>
      <input disabled placeholder="Email, phone, or Skype" className="mt-5 w-full border-b border-gray-400 bg-transparent py-2 text-xs outline-none" />
      <div className="mt-6 flex justify-end">
        <button type="button" className="rounded bg-[#0067b8] px-6 py-1.5 text-xs font-semibold text-white">Next</button>
      </div>
    </div>
  )
}

function PlaybookPreviewModal({ preview, onClose, offsetForSlideover = false }) {
  if (!preview) return null

  const isEmail = preview.type === 'email'

  return (
    <section
      className={clsx(
        'fixed bottom-6 left-6 right-6 top-6 z-[60] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl',
        offsetForSlideover && 'lg:right-[500px]'
      )}
    >
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 px-5 py-4">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: isEmail ? '#DBEAFE' : '#D1FAE5', color: isEmail ? '#1D4ED8' : '#065F46' }}
        >
          <i className={clsx('ti', isEmail ? 'ti-mail' : 'ti-world')} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-gray-900">{isEmail ? 'Preview email' : 'Preview landing page'}</h2>
          <p className="truncate text-xs text-gray-500">{preview.value}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close preview"
        >
          <i className="ti ti-x text-lg" />
        </button>
      </header>
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-gray-100 p-6">
        {isEmail ? <EmailPreview value={preview.value} /> : <LandingPreview value={preview.value} />}
      </div>
    </section>
  )
}

function DifficultyBlock({ playbook }) {
  const score = Number(playbook.diffScore.charAt(0))

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex-shrink-0">
        <div className="mb-1.5 text-[10px] font-semibold text-gray-500">PhishScale NIST</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(bar => (
            <span
              key={bar}
              className={clsx(
                'h-1.5 w-5 rounded-full',
                bar <= score ? 'bg-red-500' : 'bg-gray-200'
              )}
            />
          ))}
        </div>
        <div className="mt-1 text-[11px] font-semibold text-red-700">{playbook.diffText}</div>
      </div>
      <p className="border-gray-200 text-xs leading-relaxed text-gray-600 sm:border-l sm:pl-4">
        {playbook.nistInfo}
      </p>
    </div>
  )
}

function DetailPanel({ playbook, onDuplicate, onEdit, onPreviewComponent }) {
  const difficulty = playbook.diffScore.charAt(0)

  return (
    <section className="min-h-[620px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6">
      <div className="space-y-4 border-b border-gray-100 pb-5">
        <div className="flex items-start gap-4">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: playbook.iconBg }}
          >
            <i className={clsx('ti text-xl', playbook.iconName)} style={{ color: playbook.iconColor }} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-900">{playbook.name}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{playbook.longDesc}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Tag className={CATEGORY_TAG[playbook.category] ?? 'bg-gray-100 text-gray-700'}>{playbook.category}</Tag>
          <Tag className={DIFFICULTY_TAG[difficulty] ?? 'bg-gray-100 text-gray-700'}>Difficulty {playbook.diffScore}</Tag>
          {playbook.deptTag.map(tag => (
            <Tag key={tag} className="bg-gray-100 text-gray-700">{tag}</Tag>
          ))}
          <Tag className="bg-violet-100 text-violet-800">GoPhish</Tag>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/campaigns" className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500 bg-violet-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-600">
            <i className="ti ti-player-play" />
            Use this playbook
          </Link>
          <button type="button" onClick={onDuplicate} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50">
            <i className="ti ti-copy" />
            Duplicate
          </button>
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50">
            <i className="ti ti-edit" />
            Edit
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatMini label="Used" value={playbook.usedCount} sub="since Jan 2025" color="#6C63FF" />
        <StatMini label="Avg click rate" value={playbook.clickAvg} sub={playbook.clickSub} color="#EF4444" />
        <StatMini label="Avg submit rate" value={playbook.submitAvg} sub={playbook.submitSub} color="#F59E0B" />
      </div>

      <div className="mt-6 border-b border-gray-100 pb-5">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Technical components</h3>
        {playbook.components.map(component => (
          <ComponentRow key={`${playbook.id}-${component.type}`} component={component} onPreview={onPreviewComponent} />
        ))}
      </div>

      <div className="mt-6 border-b border-gray-100 pb-5">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Difficulty level</h3>
        <DifficultyBlock playbook={playbook} />
      </div>

      <div className="mt-6 border-b border-gray-100 pb-5">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Attack scenario</h3>
        <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-4">
          <div className="mb-1 text-xs font-bold text-violet-800">Narrative shown to the target</div>
          <p className="text-xs leading-relaxed text-gray-600">{playbook.scenarioText}</p>
        </div>
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] font-semibold text-gray-500">Vulnerable targets</div>
          <div className="flex flex-wrap gap-1.5">
            {playbook.deptTag.map(target => (
              <Tag key={`${playbook.id}-${target}`} className="bg-gray-100 text-gray-700">{target}</Tag>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Insights from previous simulations</h3>
        <div className="space-y-3">
          {playbook.insights.map(insight => (
            <div key={insight.text} className="flex items-start gap-3">
              <i className={clsx('ti mt-0.5 text-lg', insight.icon)} style={{ color: insight.color }} />
              <div>
                <div className="text-xs font-semibold text-gray-800">{insight.text}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">{insight.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Playbooks() {
  const [playbooks, setPlaybooks] = useState(INITIAL_PLAYBOOKS)
  const [activeId, setActiveId] = useState('cred-prize')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [slideoverMode, setSlideoverMode] = useState(null)
  const [slideoverForm, setSlideoverForm] = useState(DEFAULT_FORM)
  const [slideoverDirty, setSlideoverDirty] = useState(false)
  const [previewPanel, setPreviewPanel] = useState(null)

  const filteredPlaybooks = useMemo(() => {
    const term = query.trim().toLowerCase()

    return playbooks.filter(playbook => {
      const matchesCategory = category === 'all' || playbook.category === category
      const matchesQuery = !term
        || playbook.name.toLowerCase().includes(term)
        || playbook.desc.toLowerCase().includes(term)
        || playbook.longDesc.toLowerCase().includes(term)

      return matchesCategory && matchesQuery
    })
  }, [category, playbooks, query])

  const activePlaybook = playbooks.find(playbook => playbook.id === activeId) ?? playbooks[0]

  function handleSync() {
    setSyncing(true)
    window.setTimeout(() => {
      setSyncing(false)
      toast.success('Playbook synced with GoPhish.')
    }, 800)
  }

  function duplicateSelectedPlaybook() {
    const source = activePlaybook
    const clone = {
      ...source,
      id: `custom-${Date.now()}`,
      name: `${source.name} (Copy)`,
      usedCount: '0x',
      clickAvg: '0%',
      submitAvg: '0%',
      clickSub: 'not tested yet',
      submitSub: 'not tested yet',
      components: source.components.map(component => ({ ...component })),
      deptTag: [...source.deptTag],
      insights: source.insights.map(insight => ({ ...insight })),
    }

    setPlaybooks(current => [...current, clone])
    setActiveId(clone.id)
    setCategory('all')
    setQuery('')
    toast.success(`Playbook "${source.name}" duplicated.`)
  }

  function openCreatePlaybook() {
    setSlideoverForm(DEFAULT_FORM)
    setSlideoverDirty(false)
    setSlideoverMode('create')
  }

  function openEditPlaybook() {
    setSlideoverForm(formFromPlaybook(activePlaybook))
    setSlideoverDirty(false)
    setSlideoverMode('edit')
  }

  function closePlaybookForm() {
    setSlideoverMode(null)
    setSlideoverDirty(false)
    setPreviewPanel(null)
  }

  function updatePlaybookForm(field, value) {
    setSlideoverForm(current => ({ ...current, [field]: value }))
    setSlideoverDirty(true)
  }

  function submitPlaybookForm() {
    if (!slideoverForm.name.trim()) {
      toast.error('Playbook name is required.')
      return
    }

    if (!slideoverForm.desc.trim()) {
      toast.error('Playbook description is required.')
      return
    }

    if (slideoverMode === 'create') {
      const created = buildPlaybookFromForm(slideoverForm)

      setPlaybooks(current => [...current, created])
      setActiveId(created.id)
      setCategory('all')
      setQuery('')
      closePlaybookForm()
      toast.success(`Playbook "${created.name}" created.`)
      return
    }

    const updated = buildPlaybookFromForm(slideoverForm, activePlaybook)

    setPlaybooks(current => current.map(playbook => (
      playbook.id === activePlaybook.id ? updated : playbook
    )))
    setActiveId(updated.id)
    closePlaybookForm()
    toast.success(`Playbook "${updated.name}" updated.`)
  }

  function deleteActivePlaybook() {
    if (slideoverMode !== 'edit') return

    if (playbooks.length <= 1) {
      toast.error('At least one playbook must remain available.')
      return
    }

    const confirmed = window.confirm(`Delete playbook "${activePlaybook.name}"?`)
    if (!confirmed) return

    const remaining = playbooks.filter(playbook => playbook.id !== activePlaybook.id)
    const nextActive = remaining[0]

    setPlaybooks(remaining)
    if (nextActive) {
      setActiveId(nextActive.id)
    }
    closePlaybookForm()
    toast.success(`Playbook "${activePlaybook.name}" deleted.`)
  }

  function openComponentPreview(type, value) {
    setPreviewPanel({ type, value })
  }

  function previewDetailComponent(component) {
    if (component.type === 'email') {
      openComponentPreview('email', cleanComponentName(component.name, 'Email template — '))
    } else if (component.type === 'page') {
      openComponentPreview('landing', cleanComponentName(component.name, 'Landing page — '))
    }
  }

  return (
    <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between lg:flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Playbooks</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage phishing simulation playbooks</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative w-64">
            <i className="ti ti-search pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search playbooks..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-950 outline-none placeholder:text-gray-400 focus:border-violet-500"
            />
          </label>
          <button
            type="button"
            onClick={handleSync}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
          >
            <i className={clsx('ti ti-refresh text-base', syncing && 'animate-spin')} />
            Sync GoPhish
          </button>
          <button
            type="button"
            onClick={openCreatePlaybook}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-violet-600"
          >
            <i className="ti ti-plus text-base" />
            Create playbook
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:min-h-0">
          <div className="space-y-3 border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Playbooks</h2>
              <button
                type="button"
                onClick={openCreatePlaybook}
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-500 hover:text-violet-600"
              >
                <i className="ti ti-plus" />
                New
              </button>
            </div>

            <label className="relative block">
              <i className="ti ti-search pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search playbooks..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-violet-500"
              />
            </label>

            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_FILTERS.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={pillClass(category === item)}
                >
                  {item === 'all' ? 'All' : item}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
            <div className="px-1 pb-1 pt-0.5 text-[10px] font-semibold text-gray-500">
              {filteredPlaybooks.length} {filteredPlaybooks.length === 1 ? 'playbook' : 'playbooks'} available
            </div>
            {filteredPlaybooks.map(playbook => (
              <PlaybookListItem
                key={playbook.id}
                playbook={playbook}
                selected={playbook.id === activePlaybook.id}
                onSelect={() => setActiveId(playbook.id)}
              />
            ))}
            {filteredPlaybooks.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                No matching playbooks found.
              </div>
            )}
          </div>
        </aside>

        <DetailPanel
          playbook={activePlaybook}
          onDuplicate={duplicateSelectedPlaybook}
          onEdit={openEditPlaybook}
          onPreviewComponent={previewDetailComponent}
        />
      </div>

      <PlaybookSlideover
        mode={slideoverMode}
        form={slideoverForm}
        dirty={slideoverDirty}
        onClose={closePlaybookForm}
        onChange={updatePlaybookForm}
        onSubmit={submitPlaybookForm}
        onDelete={deleteActivePlaybook}
        onPreviewEmail={value => openComponentPreview('email', value)}
        onPreviewLanding={value => openComponentPreview('landing', value)}
      />
      <PlaybookPreviewModal
        preview={previewPanel}
        onClose={() => setPreviewPanel(null)}
        offsetForSlideover={Boolean(slideoverMode)}
      />
    </div>
  )
}
