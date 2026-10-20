export default function AssignmentBadge({
  item,
  usersById,
  allLabel = 'All users',
  emptyLabel = 'No users',
}) {
  if (item.assignedTo === 'all') {
    return <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold text-violet-700 dark:text-violet-300">{allLabel}</span>
  }

  const selected = (item.users ?? [])
    .map(id => usersById.get(id)?.name)
    .filter(Boolean)

  return (
    <span className="rounded-full bg-panel-muted px-2 py-0.5 text-[9px] font-semibold text-ink-muted">
      {selected.length ? `${selected.length} users` : emptyLabel}
    </span>
  )
}
