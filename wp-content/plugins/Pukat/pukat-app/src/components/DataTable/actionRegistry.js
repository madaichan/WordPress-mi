export const ROW_ACTION_REGISTRY = {
  view: { label: 'View', icon: 'ti-eye', tone: 'blue' },
  preview: { label: 'Preview', icon: 'ti-eye', tone: 'blue' },
  edit: { label: 'Edit', icon: 'ti-edit', tone: 'violet' },
  duplicate: { label: 'Duplicate', icon: 'ti-copy', tone: 'green' },
  assign: { label: 'Assign', icon: 'ti-user-check', tone: 'green' },
  test: { label: 'Test', icon: 'ti-send', tone: 'blue' },
  validate: { label: 'Validate DNS', icon: 'ti-shield-check', tone: 'blue' },
  authorize: { label: 'Authorize', icon: 'ti-circle-check', tone: 'violet' },
  view_report: { label: 'View report', icon: 'ti-report-analytics', tone: 'violet' },
  delete: { label: 'Delete', icon: 'ti-trash', tone: 'red' },
}

export const BULK_ACTION_REGISTRY = {
  delete: { label: 'Delete selected', icon: 'ti-trash', tone: 'red' },
  export: { label: 'Export selected', icon: 'ti-download', tone: 'gray' },
}

function resolveActions(registry, actions) {
  if (!Array.isArray(actions)) return []

  return actions
    .filter(action => action && registry[action.key])
    .map(action => ({
      ...registry[action.key],
      key: action.key,
      label: action.label || registry[action.key].label,
      disabled: Boolean(action.disabled),
      reason: action.reason || '',
    }))
}

/** Row actions are an allowlist: only keys present in the API response AND known to this registry render. */
export function resolveRowActions(actions) {
  return resolveActions(ROW_ACTION_REGISTRY, actions)
}

export function resolveBulkActions(actions) {
  return resolveActions(BULK_ACTION_REGISTRY, actions)
}
