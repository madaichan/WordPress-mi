import EmptyState from '../UI/EmptyState.jsx'

const VARIANTS = {
  empty: { icon: 'ti-inbox', title: 'No data yet' },
  'no-results': { icon: 'ti-search-off', title: 'No results found' },
  error: { icon: 'ti-alert-triangle', title: 'Something went wrong' },
  forbidden: { icon: 'ti-lock', title: 'You do not have access to this data' },
}

export default function DataTableEmptyState({ variant = 'empty', description, action }) {
  const config = VARIANTS[variant] || VARIANTS.empty

  return <EmptyState icon={config.icon} title={config.title} description={description} action={action} className="py-14" />
}
