import Select from '../UI/Select.jsx'
import SearchInput from '../UI/SearchInput.jsx'

export default function DataTableToolbar({
  search,
  filters,
  filterDefs = [],
  searchPlaceholder = 'Search...',
  onSearchChange,
  onFilterChange,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />
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
