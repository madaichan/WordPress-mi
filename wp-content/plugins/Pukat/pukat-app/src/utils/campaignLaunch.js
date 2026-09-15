const pad2 = n => String(n).padStart(2, '0')

/** Local "today" as Y-m-d, for the Start date min bound and default. */
export function todayDateString(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** Local current time as HH:mm, for the Send time default. */
export function nowTimeString(now = new Date()) {
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

/** Adds `days` to a Y-m-d date string, returning a Y-m-d date string. */
export function addDaysToDateString(dateStr, days, now = new Date()) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dateStr || '') ? new Date(`${dateStr}T00:00:00`) : now
  base.setDate(base.getDate() + days)
  return todayDateString(base)
}

/**
 * Earliest selectable Send time for a given Start date — 5 minutes from now
 * if the Start date is today, otherwise unrestricted (null).
 */
export function minSendTimeForDate(dateStr, now = new Date()) {
  if (dateStr !== todayDateString(now)) return null
  return nowTimeString(new Date(now.getTime() + 5 * 60 * 1000))
}

/** Whether the wizard's Send time is earlier than "now + 5 minutes" on the Start date. */
export function isScheduleSendTimeInvalid(form, now = new Date()) {
  if (!(form.scheduleEnabled ?? true)) return false
  const min = minSendTimeForDate(form.dateStart, now)
  if (!min) return false
  return !form.sendTime || form.sendTime < min
}

export function timezoneForRegion(region) {
  if (region === 'WITA') return 'Asia/Makassar'
  if (region === 'WIT') return 'Asia/Jayapura'
  return 'Asia/Jakarta'
}

/** Inverse of timezoneForRegion() — used to prefill the wizard from a saved Campaign Run. */
export function regionForTimezone(timezone) {
  if (timezone === 'Asia/Makassar') return 'WITA'
  if (timezone === 'Asia/Jayapura') return 'WIT'
  return 'WIB'
}

// None of these three zones observe DST, so a fixed offset is safe — matches
// CampaignRunService::sanitize_datetime(), which stores schedule_at in UTC.
const TIMEZONE_UTC_OFFSET_HOURS = {
  'Asia/Jakarta': 7,
  'Asia/Makassar': 8,
  'Asia/Jayapura': 9,
}

/**
 * Splits a UTC "Y-m-d H:i:s" schedule_at (as returned by GET /campaign-runs/{id})
 * back into the wizard's separate local date/time fields, for prefilling Edit.
 */
export function localDateAndTimeFromScheduleAt(scheduleAtUtc, timezone) {
  if (!scheduleAtUtc || typeof scheduleAtUtc !== 'string') return { date: '', time: '09:00' }

  const utcDate = new Date(`${scheduleAtUtc.replace(' ', 'T')}Z`)
  if (Number.isNaN(utcDate.getTime())) return { date: '', time: '09:00' }

  const offsetHours = TIMEZONE_UTC_OFFSET_HOURS[timezone] ?? 7
  const local = new Date(utcDate.getTime() + offsetHours * 3600 * 1000)
  const pad = n => String(n).padStart(2, '0')

  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  }
}

export function scheduleAtForDate(date, time) {
  if (!date) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const sendTime = /^\d{2}:\d{2}$/.test(time) ? time : '09:00'
    return `${date} ${sendTime}:00`
  }
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
    schedule_at: (form.scheduleEnabled ?? true) ? scheduleAtForDate(form.dateStart, form.sendTime) : null,
    target_group_name: form.targetGroupName?.trim() || null,
    follow_up: {
      quiz_enabled: form.followUp?.quizEnabled ?? true,
      force_reset_password_reminder_enabled: form.followUp?.forceResetPasswordReminderEnabled ?? false,
    },
  }
}
