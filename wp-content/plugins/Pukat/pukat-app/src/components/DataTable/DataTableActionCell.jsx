import TableActionButton from '../UI/TableActionButton.jsx'
import { resolveRowActions } from './actionRegistry.js'

export default function DataTableActionCell({ row, actions, onAction }) {
  const resolved = resolveRowActions(actions)
  if (resolved.length === 0) return null

  return (
    <div className="inline-flex items-center justify-end gap-1.5">
      {resolved.map(action => (
        <TableActionButton
          key={action.key}
          icon={action.icon}
          label={`${action.label} ${row?.name ?? row?.id ?? ''}`.trim()}
          title={action.disabled ? action.reason : action.label}
          tone={action.tone}
          disabled={action.disabled}
          onClick={() => onAction?.({ actionKey: action.key, row })}
        />
      ))}
    </div>
  )
}
