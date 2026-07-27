import { canManagePukat, canOperatePukat, normalizePukatRole } from './roles.js'

export const GENERAL_ENTITY = 'General'
const GENERAL_ENTITY_KEY = GENERAL_ENTITY.toLowerCase()

export function getUserEntity(user) {
  return String(user?.entity ?? user?.pukat_entity ?? '').trim()
}

export function userForAssignmentPanel(user) {
  return {
    id: Number(user.id),
    name: user.display_name || user.name || user.email || `User ${user.id}`,
    email: user.email || '',
    role: normalizePukatRole(user.pukat_role ?? user.role),
    entity: getUserEntity(user),
  }
}

export function normalizeAssetEntity(entity) {
  return String(entity ?? '').trim()
}

export function entityKey(entity) {
  return normalizeAssetEntity(entity).toLowerCase()
}

export function isGeneralEntity(entity) {
  return entityKey(entity) === GENERAL_ENTITY_KEY
}

export function assetEntityForUser(user) {
  return getUserEntity(user) || GENERAL_ENTITY
}

export function canUserAccessAsset(asset, user) {
  const assetEntity = normalizeAssetEntity(asset?.entity)
  const userEntity = getUserEntity(user)

  if (isGeneralEntity(assetEntity)) return true
  if (!userEntity) return false

  return entityKey(assetEntity) === entityKey(userEntity)
}

export function filterAssetsForUser(assets = [], user) {
  return assets.filter(asset => canUserAccessAsset(asset, user))
}

export function canUserCreateAsset(user) {
  const role = normalizePukatRole(user?.role ?? user?.pukat_role)
  if (canManagePukat(role)) return true

  return canOperatePukat(role) && Boolean(getUserEntity(user))
}

export function canUserEditAsset(asset, user) {
  const role = normalizePukatRole(user?.role ?? user?.pukat_role)
  if (canManagePukat(role)) return true
  if (!canOperatePukat(role)) return false

  const assetEntity = normalizeAssetEntity(asset?.entity)
  const userEntity = getUserEntity(user)

  if (!assetEntity || isGeneralEntity(assetEntity) || !userEntity) return false

  return entityKey(assetEntity) === entityKey(userEntity)
}

export function assignmentFromEntity(entity, users = []) {
  const assetEntity = normalizeAssetEntity(entity)

  if (!assetEntity || isGeneralEntity(assetEntity)) {
    return {
      assignedTo: 'all',
      users: [],
    }
  }

  return {
    assignedTo: 'specific',
    users: users
      .filter(user => getUserEntity(user) === assetEntity)
      .map(user => user.id),
  }
}

export function applyAssignmentFromEntity(item, users = []) {
  return {
    ...item,
    ...assignmentFromEntity(item.entity, users),
  }
}

export function entityFromAssignment(assignment, users = []) {
  if (assignment.assignedTo === 'all') {
    return {
      entity: GENERAL_ENTITY,
    }
  }

  const selectedIds = new Set(assignment.users ?? [])
  const selectedUsers = users.filter(user => selectedIds.has(user.id))

  if (selectedUsers.length === 0) {
    return {
      error: 'Choose at least one user or assign to all users.',
    }
  }

  if (selectedUsers.length !== selectedIds.size) {
    return {
      error: 'One or more selected users could not be found.',
    }
  }

  const missingEntity = selectedUsers.some(user => !getUserEntity(user))
  if (missingEntity) {
    return {
      error: 'Selected users must have an entity before this asset can be assigned.',
    }
  }

  const entities = [...new Set(selectedUsers.map(getUserEntity))]
  if (entities.length > 1) {
    return {
      error: 'Selected users must belong to the same entity.',
    }
  }

  return {
    entity: entities[0],
  }
}
