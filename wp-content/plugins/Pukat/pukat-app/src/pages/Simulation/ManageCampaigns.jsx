import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import ManageView from '../../features/campaigns/Manage/ManageView.jsx'

export default function ManageCampaigns() {
  return (
    <PageShell>
      <PageHeader title="Manage campaigns" subtitle="Group, complete, and monitor campaigns" />
      <ManageView />
    </PageShell>
  )
}
