export const EMPTY_SMTP_FORM = {
  name: '',
  gophishId: '',
  fromName: '',
  host: '',
  port: '587',
  encryption: 'TLS',
  environment: 'production',
  status: 'active',
  username: '',
  password: '',
  from: '',
  replyTo: '',
  allowedDomains: '',
  entity: '',
  ignoreCert: false,
  testTarget: 'admin@corp.internal',
  headers: [],
}

export function profileToSmtpForm(profile, mode) {
  return {
    name: mode === 'dup' ? `${profile.name} (copy)` : profile.name,
    gophishId: String(profile.gophishId ?? profile.gophish_sending_profile_id ?? ''),
    fromName: profile.fromName ?? profile.from_name ?? '',
    host: profile.host ?? '',
    port: String(profile.port ?? '587'),
    encryption: profile.encryption ?? 'TLS',
    environment: profile.environment ?? 'production',
    status: profile.statusValue ?? profile.status ?? 'active',
    username: profile.username ?? '',
    password: mode === 'dup' ? '' : profile.password ?? '',
    from: profile.from ?? profile.from_email ?? '',
    replyTo: profile.replyTo ?? profile.reply_to ?? '',
    allowedDomains: Array.isArray(profile.allowedDomains ?? profile.allowed_domains)
      ? (profile.allowedDomains ?? profile.allowed_domains).join(', ')
      : profile.allowedDomains ?? '',
    entity: profile.entity ?? '',
    ignoreCert: Boolean(profile.ignoreCert),
    testTarget: 'admin@corp.internal',
    headers: (profile.headers ?? []).map(header => ({ ...header })),
  }
}

export function getSmtpPortForEncryption(encryption) {
  if (encryption === 'SSL') return '465'
  if (encryption === 'None') return '25'
  return '587'
}

export function getSmtpEncryptionForPort(port) {
  if (Number(port) === 465) return 'SSL'
  if (Number(port) === 25) return 'None'
  return 'TLS'
}

export function splitSmtpHost(hostWithPort = '') {
  const value = String(hostWithPort)
  const match = value.match(/^(.+):(\d+)$/)

  if (!match) {
    return {
      host: value,
      port: 587,
    }
  }

  return {
    host: match[1],
    port: Number(match[2]),
  }
}

export function extractEmailAddress(value = '') {
  const text = String(value).trim()
  const mailboxMatch = text.match(/<([^<>@\s]+@[^<>\s]+)>/)

  if (mailboxMatch) {
    return mailboxMatch[1].trim()
  }

  return text
}

export function getSmtpStatusClasses(status) {
  if (status === 'Error') {
    return {
      dot: 'bg-red-500',
      tag: 'bg-red-100 text-red-800',
    }
  }

  if (status === 'Not tested') {
    return {
      dot: 'bg-amber-500 animate-pulse',
      tag: 'bg-amber-100 text-amber-800',
    }
  }

  if (['Draft', 'Inactive', 'Deprecated', 'Archived'].includes(status)) {
    return {
      dot: 'bg-gray-400',
      tag: 'bg-gray-100 text-gray-700',
    }
  }

  return {
    dot: 'bg-emerald-500',
    tag: 'bg-emerald-100 text-emerald-800',
  }
}

function displayMasterSendingStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'active') return 'Active'
  if (normalized === 'inactive') return 'Inactive'
  if (normalized === 'draft') return 'Draft'
  if (normalized === 'deprecated') return 'Deprecated'
  if (normalized === 'archived') return 'Archived'
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : 'Draft'
}

export function getSmtpEncryptionClass(encryption) {
  return encryption === 'None'
    ? 'bg-gray-100 text-gray-700'
    : 'bg-blue-100 text-blue-800'
}

export function hasDuplicateSmtpProfileName(profiles, name, currentId) {
  return profiles.some(profile => (
    profile.name.toLowerCase() === name.toLowerCase()
    && profile.id !== currentId
  ))
}

export function buildSmtpProfilePayload({ form, mode, sourceProfile, includeAssignment = false }) {
  const payload = {
    id: mode === 'update' && sourceProfile ? sourceProfile.id : `smtp-${Date.now()}`,
    name: form.name.trim(),
    host: form.host.trim(),
    port: Number(form.port),
    from: form.from.trim(),
    entity: form.entity.trim(),
    encryption: form.encryption,
    status: 'Valid',
    used: mode === 'update' && sourceProfile ? sourceProfile.used : '0 playbooks',
    lastTest: 'Just now',
    username: form.username.trim(),
    password: form.password,
    ignoreCert: form.ignoreCert,
    headers: form.headers
      .map(header => ({ key: header.key.trim(), val: header.val.trim() }))
      .filter(header => header.key),
  }

  if (includeAssignment) {
    payload.assignedTo = mode === 'update' && sourceProfile ? sourceProfile.assignedTo : 'all'
    payload.users = mode === 'update' && sourceProfile ? sourceProfile.users : []
  }

  return payload
}

export function gophishSmtpProfileToUiProfile(profile) {
  const { host, port } = splitSmtpHost(profile.host)
  const activeCampaignRunCount = Number(profile.usage?.active_campaign_run_count || 0)
  const activePlaybookCount = Number(profile.usage?.active_playbook_count || 0)
  const activeLegacyCampaignCount = Number(profile.usage?.active_legacy_campaign_count || 0)
  // activePlaybookCount is informational only — it never contributes to the lock (PRD §5.8).
  const activeUsageCount = Number(profile.usage?.active_usage_count || activeCampaignRunCount + activeLegacyCampaignCount || 0)

  return {
    id: profile.id,
    gophishId: profile.id,
    name: profile.name,
    host,
    port,
    from: profile.from_address || profile.from || '',
    entity: profile.entity || '',
    encryption: getSmtpEncryptionForPort(port),
    status: 'Valid',
    used: 'GoPhish',
    lastTest: profile.modified_date ? 'Synced' : '-',
    username: profile.username ?? '',
    password: '',
    ignoreCert: Boolean(profile.ignore_cert_errors),
    headers: (profile.headers ?? []).map(header => ({
      key: header.key ?? '',
      val: header.value ?? header.val ?? '',
    })),
    editLocked: Boolean(profile.edit_locked) || activeUsageCount > 0,
    activeCampaignRunCount,
    activePlaybookCount,
    activeLegacyCampaignCount,
    activeUsageCount,
    editLockReason: profile.edit_lock_reason || 'This sending profile is used by a Campaign.',
    raw: profile,
  }
}

export function masterSendingProfileToUiProfile(profile) {
  const gophishId = profile.gophish_sending_profile_id ? String(profile.gophish_sending_profile_id) : ''
  const statusValue = profile.status || 'draft'
  const activeCampaignRunCount = Number(profile.usage?.active_campaign_run_count || profile.active_campaign_run_count || 0)
  const activePlaybookCount = Number(profile.usage?.active_playbook_count || profile.active_playbook_count || 0)
  // activePlaybookCount is informational only — it never contributes to the lock (PRD §5.8).
  const activeUsageCount = Number(profile.usage?.active_usage_count || activeCampaignRunCount || 0)

  return {
    id: profile.id,
    name: profile.name,
    gophishId,
    fromName: profile.from_name || '',
    host: gophishId ? 'GoPhish sending profile' : 'Unmapped',
    port: gophishId || '-',
    from: profile.from_email || profile.from || '',
    replyTo: profile.reply_to || '',
    allowedDomains: profile.allowed_domains || [],
    environment: profile.environment || 'production',
    encryption: profile.environment || 'production',
    status: displayMasterSendingStatus(statusValue),
    statusValue,
    used: 'Playbook master',
    lastTest: gophishId ? 'Mapping ready' : 'Needs mapping',
    username: '',
    password: '',
    entity: profile.entity || '',
    ignoreCert: false,
    headers: [],
    editLocked: Boolean(profile.edit_locked) || activeUsageCount > 0,
    activeCampaignRunCount,
    activePlaybookCount,
    activeUsageCount,
    editLockReason: profile.edit_lock_reason || 'This sending profile is used by a Campaign.',
    raw: profile,
  }
}

export function buildGophishSmtpPayload({ form }) {
  const host = form.host.includes(':')
    ? form.host.trim()
    : `${form.host.trim()}:${Number(form.port) || 587}`

  const payload = {
    name: form.name.trim(),
    interface_type: 'SMTP',
    host,
    port: Number(form.port) || 587,
    from_address: extractEmailAddress(form.from),
    username: form.username.trim(),
    password: form.password,
    ignore_cert_errors: Boolean(form.ignoreCert),
    headers: form.headers
      .map(header => ({
        key: header.key.trim(),
        value: header.val.trim(),
      }))
      .filter(header => header.key),
  }

  if (form.entity.trim()) {
    payload.entity = form.entity.trim()
  }

  return payload
}

export function buildMasterSendingProfilePayload({ form }) {
  const allowedDomains = String(form.allowedDomains || '')
    .split(',')
    .map(domain => domain.trim())
    .filter(Boolean)

  return {
    name: form.name.trim(),
    from_name: form.fromName.trim(),
    from_email: extractEmailAddress(form.from),
    reply_to: extractEmailAddress(form.replyTo),
    gophish_sending_profile_id: Number(form.gophishId) || null,
    environment: form.environment || 'production',
    allowed_domains: allowedDomains,
    rate_limit: null,
    entity: form.entity.trim() || 'General',
    status: form.status || 'active',
  }
}
