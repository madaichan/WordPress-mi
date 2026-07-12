import { describe, expect, it } from 'vitest'
import {
  canManagePukat,
  canOperatePukat,
  getPukatRoleBadge,
  getPukatRoleLabel,
  normalizePukatRole,
} from './roles.js'

describe('roles', () => {
  it('normalizes short WordPress-injected roles to Pukat roles', () => {
    expect(normalizePukatRole('admin')).toBe('pukat_admin')
    expect(normalizePukatRole('operator')).toBe('pukat_operator')
    expect(normalizePukatRole('viewer')).toBe('pukat_viewer')
  })

  it('keeps valid Pukat roles and falls back to no access', () => {
    expect(normalizePukatRole('pukat_admin')).toBe('pukat_admin')
    expect(normalizePukatRole('unknown')).toBe('none')
    expect(normalizePukatRole()).toBe('none')
  })

  it('resolves labels, badges, and permission helpers from normalized roles', () => {
    expect(getPukatRoleLabel('admin')).toBe('Admin')
    expect(getPukatRoleBadge('operator')).toBe('badge-warning')
    expect(canManagePukat('admin')).toBe(true)
    expect(canOperatePukat('operator')).toBe(true)
    expect(canOperatePukat('viewer')).toBe(false)
  })
})
