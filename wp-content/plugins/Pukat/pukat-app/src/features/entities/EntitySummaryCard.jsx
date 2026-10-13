import { useEntityReportContact } from '../../hooks/queries/useEntityQueries.js'
import Card from '../../components/UI/Card.jsx'
import { sectorLabel } from './entitySectors.js'

function Row({ icon, children }) {
  return (
    <li className="flex items-start gap-2 text-xs text-gray-600">
      <i className={`ti ${icon} mt-0.5 text-sm text-gray-400`} />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  )
}

/**
 * At-a-glance view of the user's own entity for the My Profile sidebar —
 * read-only; each part links to the tab where it's edited.
 */
export default function EntitySummaryCard({ entityName, profile, onOpenTab }) {
  const { data: contact } = useEntityReportContact(entityName)
  const contactParts = [contact?.contact_name, contact?.contact_phone, contact?.contact_email].filter(Boolean)
  const facts = profile
    ? [
      profile.sector && { icon: 'ti-briefcase', text: sectorLabel(profile.sector) },
      profile.employee_count != null && { icon: 'ti-users', text: `${profile.employee_count.toLocaleString()} employees` },
      profile.location && { icon: 'ti-map-pin', text: profile.location },
    ].filter(Boolean)
    : []

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
          {profile?.logo_url
            ? <img src={profile.logo_url} alt="" className="h-full w-full object-contain" />
            : <i className="ti ti-building text-xl text-gray-300" />}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Entity</div>
          <div className="truncate text-sm font-semibold text-gray-900">{profile?.display_name || entityName}</div>
          {profile?.display_name && profile.display_name !== entityName && (
            <div className="truncate text-[11px] text-gray-400">{entityName}</div>
          )}
        </div>
      </div>

      {!profile ? (
        <p className="text-xs text-gray-400">No entity profile yet — an admin creates it.</p>
      ) : facts.length > 0 ? (
        <ul className="space-y-1.5">
          {facts.map(fact => <Row key={fact.icon} icon={fact.icon}>{fact.text}</Row>)}
        </ul>
      ) : (
        <button type="button" onClick={() => onOpenTab?.('entity')} className="text-xs font-semibold text-violet-600 hover:underline">
          Add sector, size and location
        </button>
      )}

      <div className="border-t border-gray-100 pt-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Report contact</div>
        {contactParts.length > 0 ? (
          <ul className="space-y-1.5">
            {contact.contact_name && <Row icon="ti-user">{contact.contact_name}</Row>}
            {contact.contact_phone && <Row icon="ti-phone">{contact.contact_phone}</Row>}
            {contact.contact_email && <Row icon="ti-mail">{contact.contact_email}</Row>}
          </ul>
        ) : (
          <button type="button" onClick={() => onOpenTab?.('report')} className="text-xs font-semibold text-violet-600 hover:underline">
            Set a report contact
          </button>
        )}
      </div>
    </Card>
  )
}
