import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// An image that opens full screen when clicked or tapped. Clicks don't reach
// the parent (e.g. a product card that opens its details on click).
export default function ZoomableImage({ src, alt = '', className = '' }) {
  const [open, setOpen] = useState(false)

  const show = (e) => {
    e.stopPropagation()
    setOpen(true)
  }

  return (
    <>
      <img
        src={src}
        alt={alt}
        role="button"
        tabIndex={0}
        title="Agrandir l'image"
        onClick={show}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && show(e)}
        className={`cursor-zoom-in ${className}`}
      />
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  )
}

function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    // Capture phase + stop: Escape closes only the image, not a modal behind it.
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image agrandie'}
      // React events bubble through portals: keep this click from reaching the
      // card or row the image belongs to.
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      className="fixed inset-0 z-[60] flex cursor-zoom-out flex-col items-center justify-center bg-black/90 p-4 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Fermer"
        className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer"
      >
        <X size={22} />
      </button>
      <img src={src} alt={alt} className="max-h-[85dvh] max-w-full rounded-lg object-contain shadow-2xl" />
      {alt && <p className="mt-3 max-w-full truncate text-sm text-white/80">{alt}</p>}
    </div>,
    document.body,
  )
}
