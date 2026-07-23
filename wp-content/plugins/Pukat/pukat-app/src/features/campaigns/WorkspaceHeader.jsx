import toast from 'react-hot-toast'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Button from '../../components/UI/Button.jsx'

export default function WorkspaceHeader({ total, activeCount, completedCount, onNew }) {
  return (
    <PageHeader
      spacing={false}
      title="Campaigns"
      subtitle={`${total} total campaigns · ${activeCount} running · ${completedCount} completed`}
      actions={
        <>
          <Button variant="outline" onClick={() => toast.success('Campaign workspace export is being prepared.')}>
            Export
          </Button>
          <Button variant="primary" onClick={onNew}>
            <i className="ti ti-circle-plus text-base" />
            <span>New campaign</span>
          </Button>
        </>
      }
    />
  )
}
