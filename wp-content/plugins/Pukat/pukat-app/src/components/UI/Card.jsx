import clsx from 'clsx'

export default function Card({ hover, className, children, ...props }) {
  return (
    <div className={clsx('card', hover && 'card-hover', className)} {...props}>
      {children}
    </div>
  )
}
