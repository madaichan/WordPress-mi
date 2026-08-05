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
