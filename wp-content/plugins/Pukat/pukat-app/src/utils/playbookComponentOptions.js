export const EMPTY_PLAYBOOK_COMPONENT_OPTIONS = {
  email: [],
  page: [],
  smtp: [],
  domain: [],
}

export function latestVersion(master) {
  if (master?.latest_version) return master.latest_version
  if (Array.isArray(master?.versions) && master.versions.length) return master.versions[0]
  return null
}

function compactOptions(options) {
  const seen = new Set()

  return options.filter(option => {
    if (!option.value || seen.has(option.value)) return false
    seen.add(option.value)
    return true
  })
}

export function playbookComponentOptions({ emailTemplates, landingPages, sendingProfiles, dynamicDomains, gophishSmtpProfiles = [] }) {
  const referencedGophishSmtpIds = new Set(
    sendingProfiles
      .map(profile => Number(profile.gophish_sending_profile_id || 0))
      .filter(Boolean)
  )
  const sendingProfileOptions = compactOptions(sendingProfiles.map(profile => ({
    value: profile.id ? String(profile.id) : '',
    label: profile.name || `Sending profile ${profile.id}`,
    description: profile.gophish_sending_profile_id
      ? `GoPhish ID #${profile.gophish_sending_profile_id} - ${profile.from_email || '-'}`
      : `Unmapped - ${profile.from_email || '-'}`,
    source: 'master',
    gophishId: Number(profile.gophish_sending_profile_id || 0) || null,
  })))
  const gophishSendingProfileOptions = compactOptions(gophishSmtpProfiles
    .filter(profile => profile?.id && !referencedGophishSmtpIds.has(Number(profile.id)))
    .map(profile => ({
      value: `gophish:${profile.id}`,
      label: profile.name || `GoPhish SMTP ${profile.id}`,
      description: `GoPhish ID #${profile.id} - ${profile.from_address || profile.from || profile.host || '-'}`,
      source: 'gophish',
      gophishId: Number(profile.id),
      profile,
    })))

  return {
    email: compactOptions(emailTemplates.map(template => {
      const version = latestVersion(template)
      const label = template.name || `Email template ${template.id}`
      return {
        value: version?.id ? String(version.id) : '',
        label,
        description: version?.subject ? `v${version.version || 1} - ${version.subject}` : 'No approved version yet',
        preview: {
          type: 'email',
          value: label,
          label,
          sender: template.sender || template.from_email || '',
          subject: version?.subject || label,
          html: version?.html_body || version?.html || '',
          text: version?.text_body || version?.text || '',
        },
      }
    })),
    page: compactOptions(landingPages.map(page => {
      const version = latestVersion(page)
      const redirect = version?.redirect_settings?.redirect_url
      const label = page.name || `Landing page ${page.id}`
      return {
        value: version?.id ? String(version.id) : '',
        label,
        description: redirect ? `v${version.version || 1} - redirects to ${redirect}` : `v${version?.version || 1}`,
        preview: {
          type: 'landing',
          value: label,
          label,
          html: version?.html_body || version?.html || '',
          redirectUrl: redirect || '',
        },
      }
    })),
    smtp: [
      ...sendingProfileOptions,
      ...gophishSendingProfileOptions,
    ],
    domain: compactOptions(dynamicDomains.map(domain => ({
      value: domain.id ? String(domain.id) : '',
      label: domain.domain || `Dynamic domain ${domain.id}`,
      description: [domain.authorization_status, domain.dns_status, domain.tls_status]
        .filter(Boolean)
        .join(' - '),
    }))),
  }
}

export function firstOption(options, key) {
  return options?.[key]?.[0]?.value || ''
}

export function optionLabel(options, value, fallback = 'Not selected') {
  return options.find(option => option.value === String(value || ''))?.label || fallback
}

export function optionDescription(options, value, fallback = '') {
  return options.find(option => option.value === String(value || ''))?.description || fallback
}
