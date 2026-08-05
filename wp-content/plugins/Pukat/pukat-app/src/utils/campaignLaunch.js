export function timezoneForRegion(region) {
  if (region === 'WITA') return 'Asia/Makassar'
  if (region === 'WIT') return 'Asia/Jayapura'
  return 'Asia/Jakarta'
}

export function scheduleAtForDate(date) {
  if (!date) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date} 09:00:00`
  return String(date).replace('T', ' ').slice(0, 19)
}

export function playbookMasterIdForForm(form, playbooks) {
  const selected = playbooks.find(playbook => String(playbook.id) === String(form.playbook))
  const id = Number(selected?.id ?? form.playbook)

  return Number.isFinite(id) && id > 0 ? id : null
}

export function buildTargetImportPayload(csvData) {
  return csvData.map(row => ({
    email: row.email,
    first_name: row.first_name || row.firstname || '',
    last_name: row.last_name || row.lastname || '',
    department: row.department || '',
    position: row.position || '',
  }))
}

export function buildCampaignLaunchPayload(form, playbooks) {
  const selected = playbooks.find(playbook => String(playbook.id) === String(form.playbook))

  return {
    playbook_master_id: playbookMasterIdForForm(form, playbooks),
    name: form.name.trim(),
    difficulty: selected?.diff ?? 3,
    timezone: timezoneForRegion(form.timezone),
    schedule_at: scheduleAtForDate(form.dateStart),
    target_group_name: form.targetGroupName?.trim() || null,
    follow_up: {
      quiz_enabled: form.followUp?.quizEnabled ?? true,
      force_reset_password_reminder_enabled: form.followUp?.forceResetPasswordReminderEnabled ?? false,
    },
  }
}
