export function timezoneForRegion(region) {
  if (region === 'WITA') return 'Asia/Makassar'
  if (region === 'WIT') return 'Asia/Jayapura'
  return 'Asia/Jakarta'
}

export function buildCampaignLaunchPayload(form, playbooks) {
  return {
    name: form.name,
    difficulty: playbooks.find(playbook => playbook.id === form.playbook)?.diff ?? 3,
    timezone: timezoneForRegion(form.timezone),
  }
}
