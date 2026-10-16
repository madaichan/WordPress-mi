import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAYBOOK_PICKER_STATE,
  filterPlaybooks,
  sortOptionValue,
  sortPlaybooks,
  stateWithSortOption,
  visiblePlaybooks,
} from './playbookPickerState.js'

const PLAYBOOKS = [
  { id: '1', name: 'Beta invoice', desc: 'Vendor billing change', type: 'BEC', entity: 'Finance', scenario: 'Vendor asks to change billing', statusLabel: 'Active', diff: 4, ready: true, createdAt: '2026-02-01 10:00:00', updatedAt: '2026-02-05 10:00:00' },
  { id: '2', name: 'alpha reset', desc: 'Password reset page', type: 'Credential', entity: 'General', scenario: 'IT helpdesk reset', statusLabel: 'Draft', diff: 2, ready: false, createdAt: '2026-03-01 10:00:00', updatedAt: '2026-03-02 10:00:00' },
  { id: '3', name: 'Gamma policy', desc: 'HR policy attachment', type: 'Malware', entity: 'General', scenario: 'HR welfare policy file', statusLabel: 'Approved', diff: 3, ready: true, createdAt: '2026-01-01 10:00:00', updatedAt: '2026-04-01 10:00:00' },
]

const ids = list => list.map(playbook => playbook.id)

describe('filterPlaybooks', () => {
  it('returns every playbook for an empty search', () => {
    expect(filterPlaybooks(PLAYBOOKS, '  ')).toHaveLength(3)
  })

  it('matches case-insensitively on name', () => {
    expect(ids(filterPlaybooks(PLAYBOOKS, 'ALPHA'))).toEqual(['2'])
  })

  it('matches fields beyond name and description', () => {
    expect(ids(filterPlaybooks(PLAYBOOKS, 'malware'))).toEqual(['3'])
    expect(ids(filterPlaybooks(PLAYBOOKS, 'finance'))).toEqual(['1'])
    expect(ids(filterPlaybooks(PLAYBOOKS, 'helpdesk'))).toEqual(['2'])
    expect(ids(filterPlaybooks(PLAYBOOKS, 'draft'))).toEqual(['2'])
  })

  it('returns nothing when no field matches', () => {
    expect(filterPlaybooks(PLAYBOOKS, 'vishing')).toHaveLength(0)
  })
})

describe('sortPlaybooks', () => {
  it('defaults to newest first', () => {
    expect(ids(sortPlaybooks(PLAYBOOKS, DEFAULT_PLAYBOOK_PICKER_STATE))).toEqual(['2', '1', '3'])
  })

  it('sorts oldest first', () => {
    expect(ids(sortPlaybooks(PLAYBOOKS, { sort: 'createdAt', order: 'asc' }))).toEqual(['3', '1', '2'])
  })

  it('sorts by last update', () => {
    expect(ids(sortPlaybooks(PLAYBOOKS, { sort: 'updatedAt', order: 'desc' }))).toEqual(['3', '2', '1'])
  })

  it('sorts by name case-insensitively', () => {
    expect(ids(sortPlaybooks(PLAYBOOKS, { sort: 'name', order: 'asc' }))).toEqual(['2', '1', '3'])
    expect(ids(sortPlaybooks(PLAYBOOKS, { sort: 'name', order: 'desc' }))).toEqual(['3', '1', '2'])
  })

  it('sorts by difficulty numerically', () => {
    expect(ids(sortPlaybooks(PLAYBOOKS, { sort: 'diff', order: 'asc' }))).toEqual(['2', '3', '1'])
    expect(ids(sortPlaybooks(PLAYBOOKS, { sort: 'diff', order: 'desc' }))).toEqual(['1', '3', '2'])
  })

  it('puts launch-ready playbooks first, newest within the group', () => {
    expect(ids(sortPlaybooks(PLAYBOOKS, { sort: 'ready', order: 'desc' }))).toEqual(['1', '3', '2'])
  })

  it('does not mutate the input list', () => {
    const input = [...PLAYBOOKS]
    sortPlaybooks(input, { sort: 'name', order: 'asc' })
    expect(ids(input)).toEqual(['1', '2', '3'])
  })

  it('handles an empty list', () => {
    expect(sortPlaybooks([], DEFAULT_PLAYBOOK_PICKER_STATE)).toEqual([])
  })
})

describe('sort option mapping', () => {
  it('maps state back to the dropdown value', () => {
    expect(sortOptionValue(DEFAULT_PLAYBOOK_PICKER_STATE)).toBe('newest')
    expect(sortOptionValue({ sort: 'ready', order: 'desc' })).toBe('ready')
  })

  it('returns an empty value for a combination the dropdown has no label for', () => {
    expect(sortOptionValue({ sort: 'statusLabel', order: 'asc' })).toBe('')
  })

  it('applies a dropdown choice and resets pagination', () => {
    const next = stateWithSortOption({ ...DEFAULT_PLAYBOOK_PICKER_STATE, page: 3 }, 'diff_desc')
    expect(next).toMatchObject({ sort: 'diff', order: 'desc', page: 1 })
  })

  it('ignores an unknown dropdown choice', () => {
    const state = { ...DEFAULT_PLAYBOOK_PICKER_STATE, page: 3 }
    expect(stateWithSortOption(state, 'nope')).toBe(state)
  })
})

describe('visiblePlaybooks', () => {
  it('searches then sorts', () => {
    const state = { ...DEFAULT_PLAYBOOK_PICKER_STATE, search: 'general' }
    expect(ids(visiblePlaybooks(PLAYBOOKS, state))).toEqual(['2', '3'])
  })
})
