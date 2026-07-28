import { useEffect, useRef, useState } from 'react'
import Input from '../UI/Input.jsx'
import Select from '../UI/Select.jsx'

const SEARCH_DEBOUNCE_MS = 350

export default function DataTableToolbar({
  search,
  filters,
  filterDefs = [],
  searchPlaceholder = 'Search...',
  onSearchChange,
  onFilterChange,
}) {
  const [term, setTerm] = useState(search || '')
  const debounceRef = useRef(null)

  useEffect(() => {
    setTerm(search || '')
  }, [search])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  function handleSearchInput(event) {
    const value = event.target.value
    setTerm(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearchChange?.(value), SEARCH_DEBOUNCE_MS)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <i className="ti ti-search text-base" />
        </span>
        <Input value={term} onChange={handleSearchInput} placeholder={searchPlaceholder} className="pl-9" />
      </div>
      {filterDefs.map(filter => (
        <Select
          key={filter.key}
          value={filters?.[filter.key] ?? ''}
          onChange={event => onFilterChange?.(filter.key, event.target.value || undefined)}
          className="w-auto"
        >
          <option value="">{filter.label}</option>
          {(filter.options || []).map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      ))}
    </div>
  )
}
