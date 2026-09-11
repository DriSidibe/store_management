const VARIANTS = {
  neutral: 'bg-ink/5 text-ink-secondary',
  brand: 'bg-brand/10 text-brand',
  success: 'bg-success/10 text-success-text',
  warning: 'bg-warning/15 text-[#8a5a00] dark:text-warning',
  danger: 'bg-danger/10 text-danger',
}

export default function Badge({ variant = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
