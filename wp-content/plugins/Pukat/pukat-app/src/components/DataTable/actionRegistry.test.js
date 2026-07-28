import { describe, expect, it } from 'vitest'
import { resolveBulkActions, resolveRowActions } from './actionRegistry.js'

describe('actionRegistry', () => {
  it('drops action keys the frontend registry does not recognize', () => {
    const resolved = resolveRowActions([{ key: 'edit' }, { key: 'launch_missiles' }])
    expect(resolved.map(action => action.key)).toEqual(['edit'])
  })

  it('returns an empty array for missing/invalid input', () => {
    expect(resolveRowActions(undefined)).toEqual([])
    expect(resolveRowActions(null)).toEqual([])
    expect(resolveRowActions('not-an-array')).toEqual([])
  })

  it('merges registry metadata (icon/tone) with per-action disabled/reason from the API', () => {
    const [action] = resolveRowActions([{ key: 'delete', disabled: true, reason: 'Used by an active campaign.' }])
    expect(action).toEqual({
      key: 'delete',
      label: 'Delete',
      icon: 'ti-trash',
      tone: 'red',
      disabled: true,
      reason: 'Used by an active campaign.',
    })
  })

  it('lets the API override the display label while keeping registry icon/tone', () => {
    const [action] = resolveRowActions([{ key: 'edit', label: 'Edit profile' }])
    expect(action.label).toBe('Edit profile')
    expect(action.icon).toBe('ti-edit')
  })

  it('defaults disabled to false and reason to empty string when omitted', () => {
    const [action] = resolveRowActions([{ key: 'view' }])
    expect(action.disabled).toBe(false)
    expect(action.reason).toBe('')
  })

  it('resolves bulk actions against a separate registry', () => {
    const resolved = resolveBulkActions([{ key: 'delete' }, { key: 'edit' }])
    expect(resolved.map(action => action.key)).toEqual(['delete'])
  })
})
