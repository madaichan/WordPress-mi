import { useMemo, useState } from 'react'

/**
 * useSearchFilter.js
 *
 * Generic client-side search + single-status filter, extracted from the
 * repeated `search`/`statusFilter` state + filter() pattern found in
 * Campaigns.jsx (CampaignTable/OverviewView) and similar list pages.
 *
 * Not wired to any page yet — this is a standalone addition. Existing pages
 * keep their own local implementation until migrated one at a time.
 *
 * @param {Array} items - Source list to filter.
 * @param {Object} [options]
 * @param {string[]} [options.searchKeys] - Item fields checked against the search term (case-insensitive substring match). Default: ['name'].
 * @param {string} [options.statusKey] - Item field compared against statusFilter. Default: 'status'.
 * @param {string} [options.initialSearch] - Initial search term. Default: ''.
 * @param {string} [options.initialStatus] - Initial status filter value. Default: 'all'.
 * @param {string} [options.allValue] - Sentinel status value meaning "no filter". Default: 'all'.
 * @returns {{ search: string, setSearch: Function, statusFilter: string, setFilter: Function, filteredItems: Array }}
 */
export function useSearchFilter(items, options = {}) {
  const {
    searchKeys = ['name'],
    statusKey = 'status',
    initialSearch = '',
    initialStatus = 'all',
    allValue = 'all',
  } = options

  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setFilter] = useState(initialStatus)

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase()
    return items.filter((item) => {
      const matchesSearch = !term || searchKeys.some(
        (key) => String(item[key] ?? '').toLowerCase().includes(term)
      )
      const matchesStatus = statusFilter === allValue || item[statusKey] === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [items, search, statusFilter, searchKeys, statusKey, allValue])

  return { search, setSearch, statusFilter, setFilter, filteredItems }
}
