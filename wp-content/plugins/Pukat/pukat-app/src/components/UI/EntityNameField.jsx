import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useEntities } from '../../hooks/queries/useEntityQueries.js'
import Select from './Select.jsx'
import Input from './Input.jsx'

const CUSTOM_VALUE = '__custom__'

/**
 * Entity name input — a dropdown of known Entity Profiles
 * (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md) plus a "Custom / other" option
 * that falls back to a plain text field. Never validates or blocks the
 * value: an entity string that has no Entity Profile yet is still accepted
 * as-is (§6 of the PRD — Entity Profile is a convenience lookup, not a
 * foreign key), so this only replaces the old bare `<input>` with a nicer
 * picker for the common case.
 */
export default function EntityNameField({ value, onChange, disabled, placeholder = 'e.g. Finance', inputClassName }) {
  const { data: entities = [] } = useEntities()
  const activeEntities = useMemo(() => entities.filter(e => e.status === 'active'), [entities])

  const matchesKnownEntity = value && activeEntities.some(e => e.entity_name.toLowerCase() === value.toLowerCase())
  const [customMode, setCustomMode] = useState(() => Boolean(value) && !matchesKnownEntity)

  function handleSelectChange(event) {
    const next = event.target.value
    if (next === CUSTOM_VALUE) {
      setCustomMode(true)
      return
    }
    setCustomMode(false)
    onChange(next)
  }

  if (customMode) {
    return (
      <div className="flex gap-2">
        <Input
          className={inputClassName}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {!disabled && (
          <button
            type="button"
            className="whitespace-nowrap text-xs font-semibold text-violet-600 hover:underline"
            onClick={() => setCustomMode(false)}
          >
            Choose from list
          </button>
        )}
      </div>
    )
  }

  return (
    <Select
      className={clsx(inputClassName)}
      value={matchesKnownEntity ? value : ''}
      onChange={handleSelectChange}
      disabled={disabled}
    >
      <option value="" disabled>Select an entity...</option>
      {activeEntities.map(entity => (
        <option key={entity.id} value={entity.entity_name}>{entity.entity_name}</option>
      ))}
      <option value={CUSTOM_VALUE}>Custom / other...</option>
    </Select>
  )
}
