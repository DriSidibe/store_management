const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-hover disabled:opacity-50',
  outline: 'border border-border text-ink hover:bg-ink/5 disabled:opacity-50',
  danger: 'bg-danger text-white hover:opacity-90 disabled:opacity-50',
  ghost: 'text-ink-secondary hover:bg-ink/5 disabled:opacity-50',
}

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
