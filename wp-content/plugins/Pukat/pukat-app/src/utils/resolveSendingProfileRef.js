import { masterAssetApi } from '../api/index.js'
import { GENERAL_ENTITY } from './entityAssignmentHelpers.js'

/**
 * A `PlaybookComponentSelect` "SMTP profile" value is either a
 * `sending_profile_refs` id (already usable as `default_sending_profile_ref_id`)
 * or a raw `gophish:<id>` value picked straight from GoPhish with no
 * `sending_profile_ref` row yet. This resolves either shape to a usable
 * `sending_profile_refs` id, creating the missing ref row (and reusing one
 * already mapped to that GoPhish profile) when needed.
 *
 * @returns {Promise<string>} the resolved `sending_profile_refs` id, or '' if
 *   `smtpValue` was empty/invalid.
 */
export async function resolveSendingProfileRefId({ smtpValue, sendingProfiles, gophishSmtpProfiles, entity }) {
  const value = String(smtpValue || '')
  if (!value.startsWith('gophish:')) return value

  const gophishId = Number(value.replace('gophish:', ''))
  if (!gophishId) return ''

  const existingRef = sendingProfiles.find(profile => (
    Number(profile.gophish_sending_profile_id || 0) === gophishId
  ))

  if (existingRef?.id) return String(existingRef.id)

  const gophishProfile = gophishSmtpProfiles.find(profile => Number(profile.id) === gophishId)
  const createdRef = await masterAssetApi.createSendingProfile({
    name: gophishProfile?.name || `GoPhish SMTP ${gophishId}`,
    gophish_sending_profile_id: gophishId,
    from_email: gophishProfile?.from_address || gophishProfile?.from || '',
    from_name: gophishProfile?.name || '',
    entity: entity || GENERAL_ENTITY,
    environment: 'production',
    status: 'active',
    allowed_domains: [],
  })

  return String(createdRef.id)
}
