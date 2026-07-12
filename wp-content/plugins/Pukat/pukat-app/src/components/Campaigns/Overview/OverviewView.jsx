import MetricCard from '../MetricCard.jsx'
import CampaignTable from '../CampaignTable.jsx'
import CampaignStatusCard from './CampaignStatusCard.jsx'
import DepartmentBars from './DepartmentBars.jsx'
import CampaignListCard from './CampaignListCard.jsx'
import ActivityFeedCard from './ActivityFeedCard.jsx'
import RiskUsersCard from './RiskUsersCard.jsx'

export default function OverviewView({
  campaigns,
  items,
  totalTargets,
  activeCount,
  search,
  setSearch,
  statusFilter,
  setFilter,
  isLoading,
  onNew,
  onDelete,
}) {
  const activeCampaign = campaigns.find(campaign => campaign.status === 'active') || campaigns[0]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active campaigns" value={activeCount} helper="+1 from last month" helperClass="text-emerald-600" icon="ti-player-play-filled" />
        <MetricCard label="Total targets" value={totalTargets.toLocaleString('en-US')} helper={`Active in ${activeCount} campaign`} icon="ti-users" />
        <MetricCard label="Click rate" value="18%" helper="▲ 3% vs previous simulation" helperClass="text-red-600" icon="ti-pointer" />
        <MetricCard label="High-risk users" value="42" helper="Coaching incomplete" helperClass="text-amber-600" icon="ti-alert-triangle" />
      </div>

      <CampaignStatusCard activeCampaign={activeCampaign} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <DepartmentBars />
        <CampaignListCard campaigns={campaigns} onNew={onNew} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityFeedCard />
        <RiskUsersCard />
      </div>

      <CampaignTable
        items={items}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setFilter={setFilter}
        isLoading={isLoading}
        onNew={onNew}
        onDelete={onDelete}
      />
    </div>
  )
}
