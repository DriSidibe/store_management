import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

const SIZES = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
}

// On phones the modal opens as a bottom sheet; on larger screens it is centered.
// Either way it never grows past the viewport: the header stays put and the body scrolls.
export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-xl animate-fade-in sm:max-h-[90dvh] sm:rounded-xl ${SIZES[size]}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
          <h2 className="min-w-0 break-words text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-ink-muted hover:bg-ink/5 hover:text-ink cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-ink-secondary sm:px-5 sm:pb-5">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
