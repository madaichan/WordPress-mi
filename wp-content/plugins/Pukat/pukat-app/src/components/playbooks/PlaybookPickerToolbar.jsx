import Select from '../UI/Select.jsx'
import SearchInput from '../UI/SearchInput.jsx'
import { PLAYBOOK_SEARCH_MAX_LENGTH, PLAYBOOK_SORT_OPTIONS } from '../../utils/playbookPickerState.js'

/**
 * Search + sort controls for a playbook list. Presentational: the caller owns
 * the picker state so grid view and table view can share one.
 */
export default function PlaybookPickerToolbar({
  search,
  onSearchChange,
  sortValue,
  onSortChange,
  resultCount,
  totalCount,
  searchPlaceholder = 'Search playbooks, type, entity...',
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        maxLength={PLAYBOOK_SEARCH_MAX_LENGTH}
        wrapperClassName="relative w-full max-w-xs"
      />
      <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
        <span>Sort</span>
        <Select value={sortValue} onChange={event => onSortChange?.(event.target.value)} className="w-auto">
          {!sortValue && <option value="">Custom</option>}
          {PLAYBOOK_SORT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </label>
      <span className="ml-auto text-[11px] font-semibold text-gray-500">
        {resultCount === totalCount
          ? `${totalCount} ${totalCount === 1 ? 'playbook' : 'playbooks'}`
          : `${resultCount} of ${totalCount} playbooks`}
      </span>
    </div>
  )
}
