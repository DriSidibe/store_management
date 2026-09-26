import { useState } from 'react'

// A camera mounted sideways or upside down stays that way: remember the
// rotation per camera (by its recordings folder, so the live view and the
// recordings of the same camera share it), in this browser.
export default function useCameraRotation(cameraKey) {
  const key = `video-rotation:${cameraKey}`
  const [rotation, setRotation] = useState(() => {
    try {
      return Number(localStorage.getItem(key)) || 0
    } catch {
      return 0
    }
  })
  const rotate = (delta) =>
    setRotation((current) => {
      const next = (current + delta + 360) % 360
      try {
        localStorage.setItem(key, String(next))
      } catch {
        /* private mode: rotation just isn't remembered */
      }
      return next
    })
  return [rotation, rotate]
}
