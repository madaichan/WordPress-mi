import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import PageHeader from '../../../components/UI/PageHeader.jsx'
import Button from '../../../components/UI/Button.jsx'
import {
  PlaybookComponentSelect as ComponentSelect,
  PlaybookField as Field,
  PlaybookPreviewModal,
  playbookFieldClass as fieldClass,
} from '../../../components/playbooks/PlaybookFormControls.jsx'
import {
  useMasterDynamicDomains,
  useMasterEmailTemplates,
  useMasterLandingPages,
  useMasterSendingProfiles,
} from '../../../hooks/queries/useMasterAssetQueries.js'
import { useGophishSmtpProfiles } from '../../../hooks/queries/useGophishQueries.js'
import { usePlaybooks } from '../../../hooks/queries/usePlaybookQueries.js'
import { useCreatePlaybookMutation, useDeletePlaybookMutation, useUpdatePlaybookMutation } from '../../../hooks/mutations/usePlaybookMutations.js'
import { masterAssetApi } from '../../../api/index.js'
import useAppStore from '../../../store/useAppStore.js'
import { GENERAL_ENTITY, assetEntityForUser, canUserCreateAsset, canUserEditAsset, filterAssetsForUser } from '../../../utils/entityAssignmentHelpers.js'
import {
  EMPTY_PLAYBOOK_COMPONENT_OPTIONS,
  firstOption,
  latestVersion,
  optionDescription,
  optionLabel,
  playbookComponentOptions,
} from '../../../utils/playbookComponentOptions.js'

const CATEGORY_FILTERS = ['all', 'BEC', 'Credential', 'Malware', 'Vishing']

const INITIAL_PLAYBOOKS = [
  {
    id: 'bec-ceo',
    name: 'BEC — CEO Invoice Request',
    desc: 'CEO impersonation requesting an urgent funds transfer by email',
    longDesc: 'A Business Email Compromise scenario where the attacker impersonates the CEO and requests an immediate funds transfer through an email that feels urgent and personal.',
    category: 'BEC',
    entity: GENERAL_ENTITY,
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
    entity: GENERAL_ENTITY,
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
    entity: GENERAL_ENTITY,
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
    entity: GENERAL_ENTITY,
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
    entity: GENERAL_ENTITY,
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
    entity: GENERAL_ENTITY,
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
  email: '',
  page: '',
  smtp: '',
  domain: '',
  scenario: '',
}

function defaultFormForOptions(options) {
  return {
    ...DEFAULT_FORM,
    email: firstOption(options, 'email'),
    page: firstOption(options, 'page'),
    smtp: firstOption(options, 'smtp'),
    domain: firstOption(options, 'domain'),
  }
}

function findAssetById(items, id) {
  const numericId = Number(id)
  return items.find(item => Number(item?.id) === numericId)
}

function findEmailTemplateByVersionId(items, versionId) {
  const numericId = Number(versionId)
  return items.find(item => (
    Number(latestVersion(item)?.id || 0) === numericId
    || (item.versions || []).some(version => Number(version?.id || 0) === numericId)
  ))
}

function findLandingPageByVersionId(items, versionId) {
  const numericId = Number(versionId)
  return items.find(item => (
    Number(latestVersion(item)?.id || 0) === numericId
    || (item.versions || []).some(version => Number(version?.id || 0) === numericId)
  ))
}

function categoryFromText(value) {
  const text = String(value || '').toLowerCase()

  if (/(bec|invoice|vendor|ceo|payment|billing)/.test(text)) return 'BEC'
  if (/(malware|attachment|file|policy|hr)/.test(text)) return 'Malware'
  if (/(vishing|voice|phone|call)/.test(text)) return 'Vishing'

  return 'Credential'
}

function difficultyNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 3
  return Math.min(Math.max(number, 1), 5)
}

function playbookMasterToUiPlaybook(row, assets, componentOptions) {
  const emailVersionId = Number(row.default_email_template_version_id || 0)
  const landingVersionId = Number(row.default_landing_page_version_id || 0)
  const sendingProfileId = Number(row.default_sending_profile_ref_id || 0)
  const dynamicDomainId = Number(row.default_dynamic_domain_id || 0)
  const template = findEmailTemplateByVersionId(assets.emailTemplates, emailVersionId)
  const emailVersion = latestVersion(template) || row.components?.email_template_version
  const page = findLandingPageByVersionId(assets.landingPages, landingVersionId)
  const landingVersion = latestVersion(page) || row.components?.landing_page_version
  const smtp = findAssetById(assets.sendingProfiles, sendingProfileId) || row.components?.sending_profile_ref
  const domain = findAssetById(assets.dynamicDomains, dynamicDomainId) || row.components?.dynamic_domain
  const difficulty = difficultyNumber(row.difficulty)
  const name = row.name || `Playbook ${row.id}`
  const description = row.description || 'Reusable Pukat playbook linked to GoPhish assets.'
  const category = categoryFromText(`${name} ${description} ${row.scenario || ''} ${emailVersion?.subject || ''}`)
  const meta = CATEGORY_META[category] ?? CATEGORY_META.Credential
  const entity = row.entity || GENERAL_ENTITY
  const domainLabel = optionLabel(componentOptions.domain, dynamicDomainId, domain?.domain || 'Not selected')
  const domainDescription = optionDescription(
    componentOptions.domain,
    dynamicDomainId,
    domain?.authorization_status ? `${domain.authorization_status} · ${domain.dns_status || 'dns unknown'} · ${domain.tls_status || 'tls unknown'}` : 'No dynamic domain selected'
  )
  const emailOption = componentOptions.email.find(option => option.value === String(emailVersionId || ''))
  const landingOption = componentOptions.page.find(option => option.value === String(landingVersionId || ''))

  return {
    id: String(row.id),
    source: 'api',
    name,
    desc: description,
    longDesc: description,
    category,
    entity,
    diffScore: `${difficulty}/5`,
    diffText: DIFFICULTY_TEXT[difficulty] ?? DIFFICULTY_TEXT[3],
    dept: 'All departments',
    deptTag: ['All departments'],
    usedCount: '0x',
    clickAvg: '0%',
    submitAvg: '0%',
    clickSub: 'not tested yet',
    submitSub: 'not tested yet',
    iconColor: meta.iconColor,
    iconBg: meta.iconBg,
    iconName: meta.iconName,
    nistInfo: `This playbook uses GoPhish assets with ${DIFFICULTY_TEXT[difficulty] ?? DIFFICULTY_TEXT[3]} difficulty.`,
    scenarioText: row.objective || row.scenario || description,
    emailValue: String(emailVersionId || ''),
    pageValue: String(landingVersionId || ''),
    smtpValue: String(sendingProfileId || ''),
    domainValue: String(dynamicDomainId || ''),
    components: [
      {
        type: 'email',
        name: `Email template — "${template?.name || 'Not selected'}"`,
        sub: emailVersion?.subject ? `Subject: ${emailVersion.subject}` : 'No email template version selected',
        badge: 'Master template',
        bg: '#DBEAFE',
        icon: 'ti-mail',
        color: '#1D4ED8',
        preview: emailOption?.preview,
      },
      {
        type: 'page',
        name: `Landing page — ${page?.name || 'Not selected'}`,
        sub: landingVersion?.redirect_settings?.redirect_url ? `Redirects to ${landingVersion.redirect_settings.redirect_url}` : 'No landing page version selected',
        badge: 'Master page',
        bg: '#D1FAE5',
        icon: 'ti-world',
        color: '#065F46',
        preview: landingOption?.preview,
      },
      {
        type: 'smtp',
        name: `SMTP — ${smtp?.name || 'Not selected'}`,
        sub: smtp?.gophish_sending_profile_id ? `GoPhish ID #${smtp.gophish_sending_profile_id} · From: ${smtp.from_email || '-'}` : 'No sending profile reference selected',
        badge: 'Sending profile',
        bg: '#FEF3C7',
        icon: 'ti-send',
        color: '#92400E',
      },
      {
        type: 'domain',
        name: `Domain — ${domainLabel}`,
        sub: domainDescription || 'No dynamic domain selected',
        badge: 'Dynamic domain',
        bg: '#F3E8FF',
        icon: 'ti-network',
        color: '#7C3AED',
      },
    ],
    insights: [
      { text: 'Historical results will appear after this playbook is used', sub: 'No campaign telemetry is linked yet', icon: 'ti-trending-up', color: '#EF4444' },
      { text: `Visible to entity: ${entity}`, sub: 'Assignment is controlled by the playbook entity field', icon: 'ti-building', color: '#F59E0B' },
    ],
  }
}

function playbookPayloadFromForm(form, entity) {
  return {
    name: form.name.trim(),
    description: form.desc.trim() || form.scenario.trim(),
    objective: form.scenario.trim(),
    scenario: form.category,
    default_email_template_version_id: Number(form.email) || null,
    default_landing_page_version_id: Number(form.page) || null,
    default_sending_profile_ref_id: Number(form.smtp) || null,
    default_dynamic_domain_id: Number(form.domain) || null,
    difficulty: difficultyNumber(form.difficulty),
    entity,
    status: 'draft',
  }
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
    email: playbook.emailValue ?? getComponentValue(playbook, 'email', DEFAULT_FORM.email),
    page: playbook.pageValue ?? getComponentValue(playbook, 'page', DEFAULT_FORM.page),
    smtp: playbook.smtpValue ?? getComponentValue(playbook, 'smtp', DEFAULT_FORM.smtp),
    domain: playbook.domainValue ?? getComponentValue(playbook, 'domain', DEFAULT_FORM.domain),
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
    entity: existing?.entity ?? GENERAL_ENTITY,
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

function PlaybookSlideover({
  mode,
  form,
  dirty,
  componentOptions = EMPTY_PLAYBOOK_COMPONENT_OPTIONS,
  saving = false,
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
              options={componentOptions.email}
              onChange={value => onChange('email', value)}
              onPreview={option => onPreviewEmail(option?.preview || option?.label || form.email)}
            />
            <ComponentSelect
              icon="ti-world"
              bg="#D1FAE5"
              color="#065F46"
              label="Landing page"
              value={form.page}
              options={componentOptions.page}
              onChange={value => onChange('page', value)}
              onPreview={option => onPreviewLanding(option?.preview || option?.label || form.page)}
            />
            <ComponentSelect
              icon="ti-send"
              bg="#FEF3C7"
              color="#92400E"
              label="SMTP profile"
              value={form.smtp}
              options={componentOptions.smtp}
              onChange={value => onChange('smtp', value)}
            />
            <ComponentSelect
              icon="ti-network"
              bg="#F3E8FF"
              color="#7C3AED"
              label="Dynamic domain"
              value={form.domain}
              options={componentOptions.domain}
              emptyLabel="No dynamic domain (optional)"
              onChange={value => onChange('domain', value)}
            />
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
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500 bg-violet-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-600"
          >
            <i className="ti ti-device-floppy" />
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create playbook'}
          </button>
        </footer>
      </aside>
    </div>
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

function DetailPanel({ playbook, canManage, onDuplicate, onEdit, onPreviewComponent }) {
  if (!playbook) {
    return (
      <section className="flex min-h-[620px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
        <div>
          <i className="ti ti-books mb-2 block text-3xl text-gray-300" />
          <h2 className="text-sm font-bold text-gray-900">No playbooks available</h2>
          <p className="mt-1 text-xs text-gray-500">Only General playbooks and playbooks assigned to your entity are shown here.</p>
        </div>
      </section>
    )
  }

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
          {canManage && (
            <>
              <button type="button" onClick={onDuplicate} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50">
                <i className="ti ti-copy" />
                Duplicate
              </button>
              <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50">
                <i className="ti ti-edit" />
                Edit
              </button>
            </>
          )}
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
  const currentUser = useAppStore(state => state.user)
  const canCreatePlaybooks = canUserCreateAsset(currentUser)
  const [playbooks, setPlaybooks] = useState(() => INITIAL_PLAYBOOKS.slice(0, 0))
  const [activeId, setActiveId] = useState('')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [slideoverMode, setSlideoverMode] = useState(null)
  const [slideoverForm, setSlideoverForm] = useState(DEFAULT_FORM)
  const [slideoverDirty, setSlideoverDirty] = useState(false)
  const [resolvingComponents, setResolvingComponents] = useState(false)
  const [previewPanel, setPreviewPanel] = useState(null)
  const { data: storedPlaybooks = [], isLoading: playbooksLoading, refetch: refetchPlaybooks } = usePlaybooks({
    placeholderData: previous => previous,
  })
  const { data: emailTemplates = [], refetch: refetchEmailTemplates } = useMasterEmailTemplates()
  const { data: landingPages = [], refetch: refetchLandingPages } = useMasterLandingPages()
  const { data: sendingProfiles = [], refetch: refetchSendingProfiles } = useMasterSendingProfiles()
  const { data: dynamicDomains = [], refetch: refetchDynamicDomains } = useMasterDynamicDomains()
  const { data: gophishSmtpProfiles = [], refetch: refetchGophishSmtpProfiles } = useGophishSmtpProfiles()
  const defaultEntity = useMemo(() => assetEntityForUser(currentUser), [currentUser])
  const masterAssets = useMemo(() => ({
    emailTemplates,
    landingPages,
    sendingProfiles,
    dynamicDomains,
    gophishSmtpProfiles,
  }), [dynamicDomains, emailTemplates, gophishSmtpProfiles, landingPages, sendingProfiles])
  const storedPlaybookRows = useMemo(() => (
    Array.isArray(storedPlaybooks)
      ? storedPlaybooks.filter(row => row?.status !== 'archived')
      : []
  ), [storedPlaybooks])
  const componentOptions = useMemo(() => (
    playbookComponentOptions(masterAssets)
  ), [masterAssets])
  const storedPlaybookCards = useMemo(() => (
    storedPlaybookRows.map(row => playbookMasterToUiPlaybook(row, masterAssets, componentOptions))
  ), [componentOptions, masterAssets, storedPlaybookRows])
  const availablePlaybooks = useMemo(() => (
    filterAssetsForUser(playbooks, currentUser)
  ), [currentUser, playbooks])

  const createPlaybookMutation = useCreatePlaybookMutation({
    onSuccess: data => {
      if (data?.id) setActiveId(String(data.id))
      setCategory('all')
      setQuery('')
      closePlaybookForm()
    },
  })
  const updatePlaybookMutation = useUpdatePlaybookMutation({
    onSuccess: data => {
      if (data?.id) setActiveId(String(data.id))
      closePlaybookForm()
    },
  })
  const deletePlaybookMutation = useDeletePlaybookMutation({
    onSuccess: () => {
      setActiveId('')
      closePlaybookForm()
    },
  })
  const playbookSaving = resolvingComponents || createPlaybookMutation.isPending || updatePlaybookMutation.isPending

  useEffect(() => {
    setPlaybooks(storedPlaybookCards)
  }, [storedPlaybookCards])

  const filteredPlaybooks = useMemo(() => {
    const term = query.trim().toLowerCase()

    return availablePlaybooks.filter(playbook => {
      const matchesCategory = category === 'all' || playbook.category === category
      const matchesQuery = !term
        || playbook.name.toLowerCase().includes(term)
        || playbook.desc.toLowerCase().includes(term)
        || playbook.longDesc.toLowerCase().includes(term)
        || (playbook.entity || '').toLowerCase().includes(term)

      return matchesCategory && matchesQuery
    })
  }, [availablePlaybooks, category, query])

  const activePlaybook = availablePlaybooks.find(playbook => playbook.id === activeId) ?? availablePlaybooks[0]
  const canEditActivePlaybook = canUserEditAsset(activePlaybook, currentUser)

  async function handleSync() {
    setSyncing(true)
    try {
      await Promise.all([
        refetchPlaybooks(),
        refetchEmailTemplates(),
        refetchLandingPages(),
        refetchSendingProfiles(),
        refetchDynamicDomains(),
        refetchGophishSmtpProfiles(),
      ])
      toast.success('Playbook master list refreshed from database.')
    } catch (error) {
      toast.error(error.message || 'Failed to sync playbooks.')
    } finally {
      setSyncing(false)
    }
  }

  function duplicateSelectedPlaybook() {
    const source = activePlaybook
    if (!source) return
    if (!canUserEditAsset(source, currentUser)) {
      toast.error('Playbook General hanya bisa diduplikasi admin. Non-admin hanya bisa memakai editor sesuai entity user.')
      return
    }

    const cloneForm = {
      ...formFromPlaybook(source),
      name: `${source.name} (Copy)`,
    }

    createPlaybookMutation.mutate(
      playbookPayloadFromForm(cloneForm, source.entity || defaultEntity)
    )
  }

  function openCreatePlaybook() {
    if (!canCreatePlaybooks) {
      toast.error('User non-admin harus memiliki entity untuk membuat playbook.')
      return
    }

    setSlideoverForm(defaultFormForOptions(componentOptions))
    setSlideoverDirty(false)
    setSlideoverMode('create')
  }

  function openEditPlaybook() {
    if (!activePlaybook) return
    if (!canUserEditAsset(activePlaybook, currentUser)) {
      toast.error('Playbook General hanya bisa diedit admin. Non-admin hanya bisa edit playbook sesuai entity user.')
      return
    }

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

  async function resolvePlaybookFormForSave(form, entity) {
    const smtpValue = String(form.smtp || '')
    if (!smtpValue.startsWith('gophish:')) return form

    const gophishId = Number(smtpValue.replace('gophish:', ''))
    if (!gophishId) return { ...form, smtp: '' }

    const existingRef = sendingProfiles.find(profile => (
      Number(profile.gophish_sending_profile_id || 0) === gophishId
    ))

    if (existingRef?.id) {
      return { ...form, smtp: String(existingRef.id) }
    }

    const gophishProfile = gophishSmtpProfiles.find(profile => Number(profile.id) === gophishId)
    const createdRef = await masterAssetApi.createSendingProfile({
      name: gophishProfile?.name || `GoPhish SMTP ${gophishId}`,
      gophish_sending_profile_id: gophishId,
      from_email: gophishProfile?.from_address || gophishProfile?.from || '',
      from_name: gophishProfile?.name || '',
      entity: entity || GENERAL_ENTITY,
      environment: 'production',
      status: 'active',
      allowed_domains: [],
    })

    await refetchSendingProfiles()

    return { ...form, smtp: String(createdRef.id) }
  }

  async function submitPlaybookForm() {
    if (slideoverMode === 'create' && !canCreatePlaybooks) {
      toast.error('User non-admin harus memiliki entity untuk membuat playbook.')
      return
    }
    if (slideoverMode === 'edit' && !canUserEditAsset(activePlaybook, currentUser)) {
      toast.error('Playbook ini hanya bisa diedit oleh admin atau user dengan entity yang sama.')
      return
    }

    if (!slideoverForm.name.trim()) {
      toast.error('Playbook name is required.')
      return
    }

    if (!slideoverForm.desc.trim()) {
      toast.error('Playbook description is required.')
      return
    }

    const entity = slideoverMode === 'create'
      ? defaultEntity
      : activePlaybook?.entity || defaultEntity

    setResolvingComponents(true)
    let resolvedForm
    try {
      resolvedForm = await resolvePlaybookFormForSave(slideoverForm, entity)
    } catch (error) {
      toast.error(error.message || 'Failed to prepare sending profile reference.')
      setResolvingComponents(false)
      return
    }
    setResolvingComponents(false)

    if (slideoverMode === 'create') {
      createPlaybookMutation.mutate(
        playbookPayloadFromForm(resolvedForm, entity)
      )
      return
    }

    const updated = buildPlaybookFromForm(resolvedForm, activePlaybook)

    if (activePlaybook?.source === 'api') {
      updatePlaybookMutation.mutate({
        id: activePlaybook.id,
        data: playbookPayloadFromForm(resolvedForm, entity),
      })
      return
    }

    setPlaybooks(current => current.map(playbook => (
      playbook.id === activePlaybook.id ? updated : playbook
    )))
    setActiveId(updated.id)
    closePlaybookForm()
    toast.success(`Playbook "${updated.name}" updated.`)
  }

  function deleteActivePlaybook() {
    if (slideoverMode !== 'edit') return
    if (!activePlaybook) return
    if (!canUserEditAsset(activePlaybook, currentUser)) {
      toast.error('Playbook ini hanya bisa dihapus oleh admin atau user dengan entity yang sama.')
      return
    }

    if (playbooks.length <= 1) {
      toast.error('At least one playbook must remain available.')
      return
    }

    const confirmed = window.confirm(`Delete playbook "${activePlaybook.name}"?`)
    if (!confirmed) return

    if (activePlaybook.source === 'api') {
      deletePlaybookMutation.mutate(activePlaybook.id)
      return
    }

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
    if (value && typeof value === 'object') {
      setPreviewPanel({ ...value, type: value.type || type, value: value.value || value.label || '' })
      return
    }

    setPreviewPanel({ type, value })
  }

  function previewDetailComponent(component) {
    if (component.type === 'email') {
      openComponentPreview('email', component.preview || cleanComponentName(component.name, 'Email template — '))
    } else if (component.type === 'page') {
      openComponentPreview('landing', component.preview || cleanComponentName(component.name, 'Landing page — '))
    }
  }

  return (
    <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in">
      <PageHeader
        title="Playbooks"
        subtitle="Manage phishing simulation playbooks"
        className="lg:flex-shrink-0"
        actions={
          <>
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
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              <i className={clsx('ti ti-refresh text-base', syncing && 'animate-spin')} />
              Refresh
            </Button>
            {canCreatePlaybooks && (
              <Button variant="primary" onClick={openCreatePlaybook}>
                <i className="ti ti-plus text-base" />
                Create playbook
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:min-h-0">
          <div className="space-y-3 border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Playbooks</h2>
              {canCreatePlaybooks && (
                <button
                  type="button"
                  onClick={openCreatePlaybook}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-500 hover:text-violet-600"
                >
                  <i className="ti ti-plus" />
                  New
                </button>
              )}
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
              {playbooksLoading ? 'Loading playbooks...' : `${filteredPlaybooks.length} ${filteredPlaybooks.length === 1 ? 'playbook' : 'playbooks'} available`}
            </div>
            {filteredPlaybooks.map(playbook => (
              <PlaybookListItem
                key={playbook.id}
                playbook={playbook}
                selected={playbook.id === activePlaybook?.id}
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
          canManage={canEditActivePlaybook}
          onDuplicate={duplicateSelectedPlaybook}
          onEdit={openEditPlaybook}
          onPreviewComponent={previewDetailComponent}
        />
      </div>

      <PlaybookSlideover
        mode={slideoverMode}
        form={slideoverForm}
        dirty={slideoverDirty}
        componentOptions={componentOptions}
        saving={playbookSaving}
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
