import Tabs from '../../components/UI/Tabs.jsx'

const WORKSPACE_VIEWS = [
  { key: 'overview', label: 'Overview', icon: 'ti-layout-dashboard' },
  { key: 'calendar', label: 'Calendar', icon: 'ti-calendar' },
  { key: 'monitoring', label: 'Monitoring', icon: 'ti-activity' },
  { key: 'report', label: 'Report', icon: 'ti-file-analytics' },
  { key: 'assets', label: 'Assets', icon: 'ti-template' },
]

export default function WorkspaceTabs({ active, onChange }) {
  return <Tabs items={WORKSPACE_VIEWS} active={active} onChange={onChange} ariaLabel="Campaign workspace" />
}
