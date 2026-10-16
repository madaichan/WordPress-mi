/**
 * Search/sort state for the Campaign Wizard playbook picker.
 *
 * Grid view and table view share one state object so both show the same rows
 * in the same order, and so a search term survives toggling between them. Rows
 * come from one already-loaded `GET /playbook-masters` response, so this all
 * runs client-side — same approach as `clientTableState.js`.
 */

export const PLAYBOOK_SEARCH_MAX_LENGTH = 100

export const PLAYBOOK_PICKER_SEARCH_FIELDS = ['name', 'desc', 'type', 'entity', 'scenario', 'statusLabel']

export const PLAYBOOK_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first', sort: 'createdAt', order: 'desc' },
  { value: 'oldest', label: 'Oldest first', sort: 'createdAt', order: 'asc' },
  { value: 'updated', label: 'Recently updated', sort: 'updatedAt', order: 'desc' },
  { value: 'name_asc', label: 'Name A–Z', sort: 'name', order: 'asc' },
  { value: 'name_desc', label: 'Name Z–A', sort: 'name', order: 'desc' },
  { value: 'diff_asc', label: 'Easiest first', sort: 'diff', order: 'asc' },
  { value: 'diff_desc', label: 'Hardest first', sort: 'diff', order: 'desc' },
  { value: 'ready', label: 'Ready to launch first', sort: 'ready', order: 'desc' },
]

export const DEFAULT_PLAYBOOK_PICKER_STATE = {
  search: '',
  sort: 'createdAt',
  order: 'desc',
  page: 1,
  perPage: 10,
  filters: {},
}

/** Dropdown value for the current state, or '' when a sortable column header produced a combination the dropdown has no label for. */
export function sortOptionValue(state = {}) {
  const match = PLAYBOOK_SORT_OPTIONS.find(option => option.sort === state.sort && option.order === state.order)

  return match ? match.value : ''
}

export function stateWithSortOption(state = {}, value) {
  const option = PLAYBOOK_SORT_OPTIONS.find(item => item.value === value)
  if (!option) return state

  return { ...state, sort: option.sort, order: option.order, page: 1 }
}

export function filterPlaybooks(playbooks = [], search = '') {
  const query = String(search || '').trim().toLowerCase()
  if (!query) return playbooks

  return playbooks.filter(playbook => PLAYBOOK_PICKER_SEARCH_FIELDS.some(
    field => String(playbook?.[field] ?? '').toLowerCase().includes(query)
  ))
}

function sortValue(playbook, key) {
  const raw = playbook?.[key]

  if (key === 'ready') return raw ? 1 : 0
  if (key === 'diff') return Number(raw) || 0
  if (key === 'name') return String(raw ?? '').toLowerCase()

  return String(raw ?? '')
}

function compare(a, b, key) {
  const left = sortValue(a, key)
  const right = sortValue(b, key)

  if (left < right) return -1
  if (left > right) return 1

  return 0
}

export function sortPlaybooks(playbooks = [], state = {}) {
  const key = state.sort || DEFAULT_PLAYBOOK_PICKER_STATE.sort
  const direction = state.order === 'asc' ? 1 : -1

  return [...playbooks].sort((a, b) => {
    const primary = compare(a, b, key) * direction
    if (primary !== 0) return primary

    // Equal on the chosen key — fall back to newest first so the order is stable
    // and predictable instead of depending on the response order.
    return compare(b, a, 'createdAt')
  })
}

/** Search + sort in one step: what both the grid and the table render. */
export function visiblePlaybooks(playbooks = [], state = {}) {
  return sortPlaybooks(filterPlaybooks(playbooks, state.search), state)
}
