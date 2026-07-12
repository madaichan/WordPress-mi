export const EMPTY_SMTP_FORM = {
  name: '',
  host: '',
  port: '587',
  encryption: 'TLS',
  username: '',
  password: '',
  from: '',
  ignoreCert: false,
  testTarget: 'admin@corp.internal',
  headers: [],
}

export function profileToSmtpForm(profile, mode) {
  return {
    name: mode === 'dup' ? `${profile.name} (copy)` : profile.name,
    host: profile.host,
    port: String(profile.port),
    encryption: profile.encryption,
    username: profile.username ?? '',
    password: mode === 'dup' ? '' : profile.password ?? '',
    from: profile.from,
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

  return {
    dot: 'bg-emerald-500',
    tag: 'bg-emerald-100 text-emerald-800',
  }
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
