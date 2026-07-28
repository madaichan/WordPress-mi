import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DataTable from './DataTable.jsx'
import dataTableSource from './DataTable.jsx?raw'

const MOCK_SCHEMA = {
  table_key: 'sending_profiles',
  title: 'Sending profiles',
  search: { placeholder: 'Search sending profiles...' },
  columns: [
    { key: 'name', label: 'Profile name', renderer: 'text_with_subtext', subtextKey: 'host', sortable: true },
    { key: 'status', label: 'Status', renderer: 'status_badge', toneMap: { Active: 'success', Inactive: 'gray' } },
    { key: 'mystery', label: 'Mystery', renderer: 'not_a_real_renderer' },
    { key: 'id', label: 'Actions', renderer: 'actions', align: 'right' },
  ],
  filters: [],
  bulk_actions: [{ key: 'delete' }],
}

const MOCK_ROWS = [
  {
    id: 1,
    name: 'finance-relay-01',
    host: 'smtp.example.com',
    status: 'Active',
    mystery: 'raw-value',
    row_actions: [{ key: 'edit' }, { key: 'delete', disabled: true, reason: 'In use.' }, { key: 'launch_missiles' }],
  },
]

function markup(props) {
  return renderToStaticMarkup(<DataTable tableKey="sending_profiles" schema={MOCK_SCHEMA} state={{}} {...props} />)
}

describe('DataTable', () => {
  it('renders headers from the schema and cell content from rows', () => {
    const html = markup({ rows: MOCK_ROWS, meta: { total: 1 } })

    expect(html).toContain('Profile name')
    expect(html).toContain('Status')
    expect(html).toContain('finance-relay-01')
    expect(html).toContain('smtp.example.com')
    expect(html).toContain('Active')
  })

  it('falls back unknown renderers to plain text instead of crashing', () => {
    const html = markup({ rows: MOCK_ROWS, meta: { total: 1 } })
    expect(html).toContain('raw-value')
  })

  it('renders only allowlisted row actions, dropping unknown keys end-to-end', () => {
    const html = markup({ rows: MOCK_ROWS, meta: { total: 1 } })
    expect(html).toContain('aria-label="Edit finance-relay-01"')
    expect(html).toContain('aria-label="Delete finance-relay-01"')
    expect(html).not.toContain('launch_missiles')
  })

  it('never uses dangerouslySetInnerHTML anywhere in the source', () => {
    expect(dataTableSource).not.toContain('dangerouslySetInnerHTML')
  })

  it('renders a loading skeleton without crashing', () => {
    const html = markup({ rows: [], loading: true })
    expect(html).toBeTruthy()
  })

  it('renders an empty state when there are no rows', () => {
    const html = markup({ rows: [] })
    expect(html).toContain('No data yet')
  })

  it('renders a no-results state when a search/filter is active but rows are empty', () => {
    const html = markup({ rows: [], state: { search: 'nothing matches' } })
    expect(html).toContain('No results found')
  })

  it('renders a forbidden state for 403 errors and a generic error state otherwise', () => {
    const forbidden = markup({ rows: [], error: { status: 403, message: 'Nope' } })
    expect(forbidden).toContain('You do not have access to this data')

    const generic = markup({ rows: [], error: { message: 'Boom' } })
    expect(generic).toContain('Something went wrong')
  })

  it('renders bulk action controls only once a row is selected', () => {
    const withoutSelection = markup({ rows: MOCK_ROWS, selectedRowIds: new Set(), onSelectionChange: () => {} })
    expect(withoutSelection).not.toContain('Delete selected')

    const withSelection = markup({ rows: MOCK_ROWS, selectedRowIds: new Set([1]), onSelectionChange: () => {} })
    expect(withSelection).toContain('1 selected')
    expect(withSelection).toContain('Delete selected')
  })
})
