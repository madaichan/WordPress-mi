import clsx from 'clsx'

export default function Input({ error, errorMessage, className, ...props }) {
  return (
    <>
      <input className={clsx('input', error && 'input-error', className)} {...props} />
      {errorMessage && <p className="mt-1 text-xs text-danger">{errorMessage}</p>}
    </>
  )
}
