import clsx from 'clsx'
import { useEntityReadiness } from '../../hooks/queries/useEntityQueries.js'
import Card from '../../components/UI/Card.jsx'
import Badge from '../../components/UI/Badge.jsx'

// Item keys come from EntityProfileService::readiness_items(); `tab` is the
// My Profile tab where the item is filled in.
const ITEMS = {
  email_domains: { label: 'Company email domain', hint: 'At least one active domain', tab: 'guardrails' },
  landing_domains: { label: 'Landing page domain', hint: 'At least one authorized by an admin', tab: 'guardrails' },
  report_contact: { label: 'Call center report contact', hint: 'Who employees contact to report', tab: 'report' },
  flag_examples: { label: 'Flag examples', hint: 'At least one example image', tab: 'flags' },
  identity: { label: 'Entity identity', hint: 'Profile with a sector', tab: 'entity' },
}

const LEVEL_LABEL = { required: 'Required', recommended: 'Recommended', optional: 'Optional' }

/**
 * Readiness checklist for one entity (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md
 * §16). `required` items block Campaign Run launch on the backend; this card
 * only reports that state.
 */
export default function EntityReadinessCard({ entityName, onOpenTab, compact = false }) {
  const { data, isLoading } = useEntityReadiness(entityName)

  if (isLoading || !data) return null

  const items = data.items || []
  const doneCount = items.filter(item => item.done).length

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Entity readiness</h2>
          <p className="text-xs text-gray-500">{doneCount}/{items.length} complete</p>
        </div>
        <Badge tone={data.can_launch ? 'success' : 'danger'}>
          {data.can_launch ? 'Ready to launch campaigns' : 'Campaigns cannot be launched'}
        </Badge>
      </div>

      <ul className={clsx('grid grid-cols-1 gap-2', !compact && 'sm:grid-cols-2')}>
        {items.map(item => {
          const meta = ITEMS[item.key] || { label: item.key, hint: '' }
          const blocking = item.level === 'required' && !item.done
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => meta.tab && onOpenTab?.(meta.tab)}
                className={clsx(
                  'flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition hover:bg-gray-50',
                  blocking ? 'border-red-200 bg-red-50' : 'border-gray-100'
                )}
              >
                <i className={clsx(
                  'ti mt-0.5 text-base',
                  item.done ? 'ti-circle-check text-emerald-500' : blocking ? 'ti-alert-circle text-danger' : 'ti-circle-dashed text-gray-300'
                )} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-700">{meta.label}</span>
                    <span className={clsx('text-[10px] font-semibold uppercase', item.level === 'required' ? 'text-danger' : 'text-gray-400')}>
                      {LEVEL_LABEL[item.level] || item.level}
                    </span>
                  </span>
                  <span className="block text-xs text-gray-500">{meta.hint}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
