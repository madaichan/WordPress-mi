/**
 * Maps a Playbook Master API row into the view model the playbook detail UI
 * reads (`components`, tags, difficulty text, scenario, insights).
 *
 * Extracted from `features/setup/playbooks/Playbooks.jsx` so the Campaign
 * Wizard playbook picker can render the same detail sections without
 * duplicating the mapping. Behaviour is unchanged.
 */

import { GENERAL_ENTITY } from './entityAssignmentHelpers.js'
import { latestVersion, optionDescription, optionLabel } from './playbookComponentOptions.js'
import { parseServerDate } from './serverDate.js'

/** Shape `playbookMasterToUiPlaybook` expects for its master-asset lookups. */
export const EMPTY_MASTER_ASSETS = {
  emailTemplates: [],
  landingPages: [],
  sendingProfiles: [],
  dynamicDomains: [],
  gophishSmtpProfiles: [],
}

export const CATEGORY_TAG = {
  BEC: 'bg-red-500/15 text-red-800 dark:text-red-300',
  Credential: 'bg-blue-500/15 text-blue-800 dark:text-blue-300',
  Malware: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  Vishing: 'bg-purple-500/15 text-purple-800 dark:text-purple-300',
}

export const DIFFICULTY_TAG = {
  1: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  2: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  3: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  4: 'bg-rose-500/15 text-rose-800 dark:text-rose-300',
  5: 'bg-pink-500/15 text-pink-800 dark:text-pink-300',
}

export const STATUS_TAG = {
  Draft: 'bg-panel-muted text-ink-soft',
  Review: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  Published: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  Deprecated: 'bg-panel-muted text-ink-muted',
  Archived: 'bg-panel-muted text-ink-faint',
}

export const CATEGORY_META = {
  BEC: { iconBg: '#FEE2E2', iconColor: '#B91C1C', iconName: 'ti-alert-triangle' },
  Credential: { iconBg: '#DBEAFE', iconColor: '#1D4ED8', iconName: 'ti-lock' },
  Malware: { iconBg: '#FEF3C7', iconColor: '#92400E', iconName: 'ti-file-alert' },
  Vishing: { iconBg: '#F3E8FF', iconColor: '#7C3AED', iconName: 'ti-device-mobile' },
}

export const DIFFICULTY_TEXT = {
  1: 'Very Low (1/5)',
  2: 'Low (2/5)',
  3: 'Medium (3/5)',
  4: 'High (4/5)',
  5: 'Very High (5/5)',
}

export function findAssetById(items, id) {
  const numericId = Number(id)
  return items.find(item => Number(item?.id) === numericId)
}

export function findEmailTemplateByVersionId(items, versionId) {
  const numericId = Number(versionId)
  return items.find(item => (
    Number(latestVersion(item)?.id || 0) === numericId
    || (item.versions || []).some(version => Number(version?.id || 0) === numericId)
  ))
}

export function findLandingPageByVersionId(items, versionId) {
  const numericId = Number(versionId)
  return items.find(item => (
    Number(latestVersion(item)?.id || 0) === numericId
    || (item.versions || []).some(version => Number(version?.id || 0) === numericId)
  ))
}

export function categoryFromText(value) {
  const text = String(value || '').toLowerCase()

  if (/(bec|invoice|vendor|ceo|payment|billing)/.test(text)) return 'BEC'
  if (/(malware|attachment|file|policy|hr)/.test(text)) return 'Malware'
  if (/(vishing|voice|phone|call)/.test(text)) return 'Vishing'

  return 'Credential'
}

export function difficultyNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 3
  return Math.min(Math.max(number, 1), 5)
}

/**
 * "Sep 2026"-style label from a server timestamp, using the same UTC-aware
 * parser the rest of the app shares so the month/year never drifts by the
 * viewer's offset. Returns an empty string when the value is missing/invalid.
 */
export function formatMonthYear(value) {
  const date = parseServerDate(value)
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function playbookMasterToUiPlaybook(row, assets, componentOptions) {
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
  const activeCampaignRunCount = Number(row.usage?.active_campaign_run_count || 0)
  const activeUsageCount = Number(row.usage?.active_usage_count || activeCampaignRunCount || 0)
  const stats = row.stats || {}
  const usedCount = `${Number(stats.used_count || 0)}x`
  const usedSub = stats.first_launched_at ? `since ${formatMonthYear(stats.first_launched_at)}` : 'no runs yet'
  const testedRunCount = Number(stats.tested_run_count || 0)
  const testedSub = testedRunCount > 0
    ? `across ${testedRunCount} tested ${testedRunCount === 1 ? 'run' : 'runs'}`
    : 'not tested yet'
  const clickAvg = testedRunCount > 0 ? `${stats.click_rate}%` : '—'
  const submitAvg = testedRunCount > 0 ? `${stats.submit_rate}%` : '—'

  return {
    id: String(row.id),
    source: 'api',
    name,
    desc: description,
    longDesc: description,
    category,
    entity,
    status: row.status || 'draft',
    editLocked: Boolean(row.edit_locked) || activeUsageCount > 0 || row.status === 'active',
    activeCampaignRunCount,
    activeUsageCount,
    editLockReason: row.edit_lock_reason || 'This playbook is active or used by a Campaign.',
    diffScore: `${difficulty}/5`,
    diffText: DIFFICULTY_TEXT[difficulty] ?? DIFFICULTY_TEXT[3],
    dept: 'All departments',
    deptTag: ['All departments'],
    usedCount,
    usedSub,
    clickAvg,
    submitAvg,
    clickSub: testedSub,
    submitSub: testedSub,
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
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    raw: row,
  }
}

export function cleanComponentName(value = '', prefix = '') {
  return value
    .replace(prefix, '')
    .replace(/^["']|["']$/g, '')
    .trim()
}

/**
 * Payload for `PlaybookPreviewModal` from one technical component of the detail
 * view. Falls back to the component label when no rendered HTML is attached, so
 * the modal can still show its generic mock preview.
 */
export function componentPreviewPanel(component) {
  const isEmail = component?.type === 'email'
  const type = isEmail ? 'email' : 'landing'
  const preview = component?.preview

  if (preview && typeof preview === 'object') {
    return { ...preview, type: preview.type || type, value: preview.value || preview.label || '' }
  }

  return { type, value: cleanComponentName(component?.name || '', isEmail ? 'Email template — ' : 'Landing page — ') }
}
