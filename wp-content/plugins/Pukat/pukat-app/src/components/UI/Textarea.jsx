import clsx from 'clsx'

export default function Textarea({ error, errorMessage, rows = 4, className, ...props }) {
  return (
    <>
      <textarea rows={rows} className={clsx('input', error && 'input-error', className)} {...props} />
      {errorMessage && <p className="mt-1 text-xs text-danger">{errorMessage}</p>}
    </>
  )
}
