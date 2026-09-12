export function CardGrid({ children, className = '' }) {
  return <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:hidden ${className}`}>{children}</div>
}

export function CardStack({ children, className = '' }) {
  return <div className={`space-y-3 md:hidden ${className}`}>{children}</div>
}

export function DataRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 text-sm">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-ink">{value}</span>
    </div>
  )
}
