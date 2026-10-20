import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import Input from './Input.jsx'

export const SEARCH_DEBOUNCE_MS = 350

/**
 * Debounced search box with a leading magnifier icon. Keeps its own draft value
 * so typing stays responsive, and only reports upward after `debounceMs`.
 *
 * `maxLength` mirrors the server-side search cap (AGENTS.md §5.3) so a table
 * never sends a term the backend would reject.
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = SEARCH_DEBOUNCE_MS,
  maxLength = 100,
  className,
  wrapperClassName = 'relative w-full max-w-xs',
}) {
  const [term, setTerm] = useState(value || '')
  const debounceRef = useRef(null)

  useEffect(() => {
    setTerm(value || '')
  }, [value])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  function handleInput(event) {
    const next = event.target.value
    setTerm(next)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange?.(next), debounceMs)
  }

  return (
    <div className={wrapperClassName}>
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-faint">
        <i className="ti ti-search text-base" />
      </span>
      <Input
        value={term}
        onChange={handleInput}
        placeholder={placeholder}
        maxLength={maxLength}
        className={clsx('pl-9', className)}
      />
    </div>
  )
}
