import Modal from './Modal.jsx'
import Button from './Button.jsx'

const toneConfig = {
  danger: {
    iconWrap: 'bg-red-100 text-red-600',
    confirmVariant: 'danger',
  },
  warning: {
    iconWrap: 'bg-amber-100 text-amber-700',
    confirmVariant: 'primary',
  },
}

export default function AlertConfirmation({
  open = true,
  title,
  message,
  icon = 'ti-alert-triangle',
  tone = 'danger',
  confirmLabel = 'Confirm',
  pendingLabel = 'Working...',
  cancelLabel = 'Cancel',
  isPending = false,
  onConfirm,
  onCancel,
  children,
}) {
  if (!open) return null

  const config = toneConfig[tone] || toneConfig.danger

  return (
    <Modal
      open={open}
      onClose={isPending ? undefined : onCancel}
      className="max-w-sm"
      icon={
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${config.iconWrap}`}>
          <i className={`ti ${icon} text-lg`} />
        </div>
      }
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button variant={config.confirmVariant} onClick={onConfirm} disabled={isPending}>
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p className="text-xs leading-5 text-gray-500">{message}</p>}
      {children}
    </Modal>
  )
}
