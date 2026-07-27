import { describe, expect, it } from 'vitest'
import {
  GENERAL_ENTITY,
  applyAssignmentFromEntity,
  assignmentFromEntity,
  assetEntityForUser,
  canUserAccessAsset,
  canUserCreateAsset,
  canUserEditAsset,
  entityFromAssignment,
  filterAssetsForUser,
} from './entityAssignmentHelpers.js'

const users = [
  { id: 1, name: 'Admin', entity: 'General' },
  { id: 2, name: 'Operator A', entity: 'EntityA' },
  { id: 3, name: 'Viewer A', entity: 'EntityA' },
  { id: 4, name: 'Operator B', entity: 'EntityB' },
]

describe('entityAssignmentHelpers', () => {
  it('maps blank and General entities to all users', () => {
    expect(assignmentFromEntity('', users)).toEqual({ assignedTo: 'all', users: [] })
    expect(assignmentFromEntity(GENERAL_ENTITY, users)).toEqual({ assignedTo: 'all', users: [] })
  })

  it('maps specific entity values to matching users', () => {
    expect(assignmentFromEntity('EntityA', users)).toEqual({
      assignedTo: 'specific',
      users: [2, 3],
    })
  })

  it('converts all users assignment into General entity', () => {
    expect(entityFromAssignment({ assignedTo: 'all', users: [2] }, users)).toEqual({
      entity: GENERAL_ENTITY,
    })
  })

  it('converts specific users into their shared entity', () => {
    expect(entityFromAssignment({ assignedTo: 'specific', users: [2, 3] }, users)).toEqual({
      entity: 'EntityA',
    })
  })

  it('rejects specific users across different entities', () => {
    expect(entityFromAssignment({ assignedTo: 'specific', users: [2, 4] }, users)).toEqual({
      error: 'Selected users must belong to the same entity.',
    })
  })

  it('attaches assignment fields to GoPhish assets from entity', () => {
    expect(applyAssignmentFromEntity({ id: 9, entity: 'EntityB' }, users)).toMatchObject({
      id: 9,
      entity: 'EntityB',
      assignedTo: 'specific',
      users: [4],
    })
  })

  it('allows users to see General and their own entity assets only', () => {
    const assets = [
      { id: 1, entity: 'General' },
      { id: 2, entity: 'EntityA' },
      { id: 3, entity: 'EntityB' },
      { id: 4, entity: '' },
    ]

    expect(filterAssetsForUser(assets, { entity: 'EntityA' }).map(asset => asset.id)).toEqual([1, 2])
    expect(canUserAccessAsset({ entity: 'general' }, { entity: 'EntityA' })).toBe(true)
    expect(canUserAccessAsset({ entity: 'EntityB' }, { entity: 'EntityA' })).toBe(false)
  })

  it('defaults new user-scoped assets to the user entity or General', () => {
    expect(assetEntityForUser({ entity: 'EntityA' })).toBe('EntityA')
    expect(assetEntityForUser({ entity: '' })).toBe(GENERAL_ENTITY)
  })

  it('lets non-admin operators edit only assets assigned to their entity', () => {
    const operator = { role: 'pukat_operator', entity: 'EntityA' }

    expect(canUserEditAsset({ entity: 'EntityA' }, operator)).toBe(true)
    expect(canUserEditAsset({ entity: 'General' }, operator)).toBe(false)
    expect(canUserEditAsset({ entity: 'EntityB' }, operator)).toBe(false)
    expect(canUserEditAsset({ entity: 'EntityA' }, { role: 'pukat_viewer', entity: 'EntityA' })).toBe(false)
  })

  it('lets admins edit General assets and requires non-admin create assets to have an entity', () => {
    expect(canUserEditAsset({ entity: 'General' }, { role: 'pukat_admin', entity: '' })).toBe(true)
    expect(canUserCreateAsset({ role: 'pukat_admin', entity: '' })).toBe(true)
    expect(canUserCreateAsset({ role: 'pukat_operator', entity: 'EntityA' })).toBe(true)
    expect(canUserCreateAsset({ role: 'pukat_operator', entity: '' })).toBe(false)
  })
})
