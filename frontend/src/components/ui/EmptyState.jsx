export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {Icon && <Icon className="text-ink-muted" size={32} strokeWidth={1.5} />}
      <p className="text-sm font-medium text-ink-secondary">{title}</p>
      {description && <p className="max-w-sm text-xs text-ink-muted">{description}</p>}
    </div>
  )
}
