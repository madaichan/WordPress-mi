export default function AssignmentBadge({
  item,
  usersById,
  allLabel = 'All users',
  emptyLabel = 'No users',
}) {
  if (item.assignedTo === 'all') {
    return <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-semibold text-violet-700">{allLabel}</span>
  }

  const selected = (item.users ?? [])
    .map(id => usersById.get(id)?.name)
    .filter(Boolean)

  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-semibold text-gray-600">
      {selected.length ? `${selected.length} users` : emptyLabel}
    </span>
  )
}
