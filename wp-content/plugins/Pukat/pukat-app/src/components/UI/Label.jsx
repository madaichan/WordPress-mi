import clsx from 'clsx'

export default function Label({ required, className, children, ...props }) {
  return (
    <label className={clsx('label', className)} {...props}>
      {children}
      {required && <span className="text-danger"> *</span>}
    </label>
  )
}
