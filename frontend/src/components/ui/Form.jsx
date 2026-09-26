import { Children, isValidElement } from 'react'

const controlClass =
  'w-full rounded-lg border border-border bg-page px-3 py-2 text-base text-ink sm:text-sm placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand disabled:opacity-60'

// The asterisk follows the wrapped control's `required` prop, so the label can
// never disagree with what the browser actually enforces. Pass `required`
// explicitly when the control is nested deeper than a direct child.
export function Field({ label, hint, children, className = '', required }) {
  const isRequired =
    required ?? Children.toArray(children).some((child) => isValidElement(child) && child.props.required)
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-ink-secondary">
          {label}
          {isRequired && (
            <>
              <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
              <span className="sr-only"> (obligatoire)</span>
            </>
          )}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

export function Input({ className = '', ...props }) {
  return <input className={`${controlClass} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${controlClass} ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${controlClass} ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({ label, className = '', ...props }) {
  return (
    <label className={`flex items-center gap-2 text-sm text-ink-secondary ${className}`}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border text-brand focus:ring-brand/40"
        {...props}
      />
      {label}
    </label>
  )
}

export function RequiredLegend({ className = '' }) {
  return (
    <p className={`text-xs text-ink-muted ${className}`}>
      Les champs marqués d’un <span className="text-danger">*</span> sont obligatoires.
    </p>
  )
}
