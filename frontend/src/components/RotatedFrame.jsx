import { cloneElement, useEffect, useRef, useState } from 'react'

// A 16:9 black frame showing its single child (an <img> or <video>) rotated by
// `rotation` degrees and always fully visible: on a quarter turn the child is
// sized with width and height swapped before being turned.
export default function RotatedFrame({ rotation = 0, className = '', children, overlay }) {
  const boxRef = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    const observer = new ResizeObserver(([entry]) =>
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const sideways = rotation % 180 !== 0
  return (
    <div ref={boxRef} className={`relative aspect-video overflow-hidden bg-black ${className}`}>
      {children &&
        cloneElement(children, {
          className: `absolute left-1/2 top-1/2 object-contain ${children.props.className || ''}`,
          style: {
            width: sideways ? box.height : '100%',
            height: sideways ? box.width : '100%',
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          },
        })}
      {overlay}
    </div>
  )
}
