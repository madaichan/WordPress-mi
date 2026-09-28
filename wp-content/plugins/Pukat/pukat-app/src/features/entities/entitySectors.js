// Labels for the backend sector whitelist (EntityProfileService::SECTORS,
// docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §15.3). Keys must match it.
export const ENTITY_SECTORS = [
  { value: 'banking_finance', label: 'Banking & Finance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'government', label: 'Government' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'energy_utilities', label: 'Energy & Utilities' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'technology', label: 'Technology' },
  { value: 'transportation_logistics', label: 'Transportation & Logistics' },
  { value: 'other', label: 'Other' },
]

export function sectorLabel(value) {
  return ENTITY_SECTORS.find(s => s.value === value)?.label || value || ''
}
