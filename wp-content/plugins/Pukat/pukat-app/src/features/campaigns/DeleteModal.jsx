import Modal from '../../components/UI/Modal.jsx'
import Button from '../../components/UI/Button.jsx'

export default function DeleteModal({ campaign, onConfirm, onCancel, isPending }) {
  return (
    <Modal
      onClose={onCancel}
      className="max-w-sm"
      icon={
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-100">
          <i className="ti ti-trash text-lg text-red-600" />
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
      <p className="text-xs text-gray-500">
        <strong className="text-gray-700">{campaign.name}</strong> will be permanently deleted.
      </p>
    </Modal>
  )
}
