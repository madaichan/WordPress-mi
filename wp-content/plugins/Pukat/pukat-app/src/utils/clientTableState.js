/**
 * Search/sort/paginate an already-loaded, in-memory row list the same way DataTable's
 * `state` shape expects — for pages/steps that render `DataTable` over data that arrived
 * fully loaded as a prop or query result, rather than through a server-driven
 * `/tables/{table_key}/rows` endpoint.
 */
export function paginateRows(rows, state = {}, { searchFields = [] } = {}) {
  const query = (state.search || '').trim().toLowerCase()
  let list = rows

  if (query && searchFields.length > 0) {
    list = list.filter(row => searchFields.some(field => String(row[field] ?? '').toLowerCase().includes(query)))
  }

  if (state.sort) {
    const order = state.order === 'desc' ? -1 : 1
    list = [...list].sort((a, b) => {
      const av = a[state.sort] ?? ''
      const bv = b[state.sort] ?? ''
      if (av < bv) return -1 * order
      if (av > bv) return 1 * order
      return 0
    })
  }

  const perPage = state.perPage || 10
  const page = state.page || 1
  const total = list.length
  const pageRows = list.slice((page - 1) * perPage, page * perPage)

  return { rows: pageRows, total }
}
