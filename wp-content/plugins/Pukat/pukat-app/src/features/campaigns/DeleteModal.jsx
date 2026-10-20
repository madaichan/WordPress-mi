import Modal from '../../components/UI/Modal.jsx'
import Button from '../../components/UI/Button.jsx'

export default function DeleteModal({ campaign, onConfirm, onCancel, isPending }) {
  return (
    <Modal
      onClose={onCancel}
      className="max-w-sm"
      icon={
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/15">
          <i className="ti ti-trash text-lg text-red-600 dark:text-red-400" />
        </div>
      }
      title="Delete campaign?"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </>
      }
    >
      <p className="text-xs text-ink-muted">
        <strong className="text-ink-soft">{campaign.name}</strong> will be permanently deleted.
      </p>
    </Modal>
  )
}
