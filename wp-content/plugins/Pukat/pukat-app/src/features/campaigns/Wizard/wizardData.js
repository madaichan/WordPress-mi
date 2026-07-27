/**
 * wizardData.js
 *
 * Static demo/reference data for the "New campaign" wizard (Step1–Step3).
 * Playbook options are loaded from Playbook Master API by the Campaigns
 * container and passed into the wizard steps.
 */

export const DEMO_TARGET_TOTAL = 1240

export const DEMO_TARGETS = [
  { first_name: 'Budi', last_name: 'Santoso', email: 'budi.santoso@company.id', department: 'Finance', position: 'Finance manager' },
  { first_name: 'Sari', last_name: 'Dewi', email: 'sari.dewi@company.id', department: 'HR', position: 'HR generalist' },
]

export const TEMPLATES = [
  { id: 't1', name: 'CEO request — invoice', type: 'BEC', icon: 'ti-mail', diff: 4, dot: 'bg-red-500', diffText: 'Difficulty 4/5 (NIST)' },
  { id: 't2', name: 'Microsoft 365 login', type: 'Credential harvest', icon: 'ti-lock', diff: 3, dot: 'bg-amber-500', diffText: 'Difficulty 3/5' },
  { id: 't3', name: 'HR policy update', type: 'Malware lure', icon: 'ti-file', diff: 2, dot: 'bg-emerald-500', diffText: 'Difficulty 2/5' },
]

export const TEMPLATE_FILTERS = ['All', 'BEC', 'Credential', 'Malware lure']
