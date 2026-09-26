import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Film, Image as ImageIcon, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchMotionEyeVideo, listMotionEyeMedia } from '../api/api'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ZoomableImage from '../components/ui/ZoomableImage'
import useCameraRotation from '../hooks/useCameraRotation'

// "21-13-49.mp4" -> "21:13:49"
const clipTime = (name) => name.replace(/\.mp4$/i, '').replace(/-/g, ':')

const formatSeconds = (s) => {
  const total = Math.floor(s || 0)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Errors of blob requests arrive as a Blob too: read the JSON message out of it.
async function blobErrorMessage(err) {
  const data = err?.response?.data
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).detail
    } catch {
      /* not JSON */
    }
  }
  return 'Impossible de lire cette vidéo.'
}

export default function MotionEyeMediaPage() {
  const { cameraId, date } = useParams()
  const [playing, setPlaying] = useState(null) // index in data.videos
  const [rotation, rotate] = useCameraRotation(cameraId)
  const { data, isLoading } = useQuery({
    queryKey: ['motioneye-media', cameraId, date],
    queryFn: () => listMotionEyeMedia(cameraId, date),
  })

  if (isLoading) return <p className="text-sm text-ink-muted">Chargement...</p>

  const videos = data.videos
  const current = playing === null ? null : videos[playing]

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Caméra {cameraId} — {date}</h1>

      <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Vidéos ({videos.length})</h2>
      {videos.length === 0 ? (
        <EmptyState icon={Film} title="Aucune vidéo" />
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {videos.map((v, i) => (
            <button
              key={v.name}
              type="button"
              onClick={() => setPlaying(i)}
              className="group overflow-hidden rounded-lg border border-border bg-surface text-left cursor-pointer"
            >
              <div className="relative flex aspect-video items-center justify-center bg-black/80">
                {v.thumbnail ? (
                  <img src={v.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <Film size={22} className="text-white/60" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/30">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow">
                    <Play size={16} className="ml-0.5" fill="currentColor" />
                  </span>
                </span>
              </div>
              <span className="block px-2 py-1.5 font-mono text-xs text-ink-secondary">{clipTime(v.name)}</span>
            </button>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Images</h2>
      {data.images.length === 0 ? (
        <EmptyState icon={ImageIcon} title="Aucune image" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.images.map((src) => (
            <ZoomableImage key={src} src={src} className="aspect-video w-full rounded-lg object-cover" />
          ))}
        </div>
      )}

      <Modal
        open={current !== null}
        onClose={() => setPlaying(null)}
        title={current ? `Caméra ${cameraId} — ${date} à ${clipTime(current.name)}` : ''}
        size="lg"
      >
        {current && (
          <>
            <ClipPlayer
              key={current.name}
              cameraId={cameraId}
              date={date}
              name={current.name}
              rotation={rotation}
              onRotate={rotate}
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button variant="outline" disabled={playing === 0} onClick={() => setPlaying(playing - 1)}>
                <ChevronLeft size={15} /> Précédente
              </Button>
              <span className="text-xs text-ink-muted">
                {playing + 1} / {videos.length}
              </span>
              <Button
                variant="outline"
                disabled={playing === videos.length - 1}
                onClick={() => setPlaying(playing + 1)}
              >
                Suivante <ChevronRight size={15} />
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function ClipPlayer({ cameraId, date, name, rotation, onRotate }) {
  const [src, setSrc] = useState(null)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)
  const boxRef = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [paused, setPaused] = useState(true)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    fetchMotionEyeVideo(cameraId, date, name)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(async (err) => {
        if (!cancelled) setError(await blobErrorMessage(err))
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [cameraId, date, name])

  // Rotated a quarter turn, the video must fit the box with width and height swapped.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    const observer = new ResizeObserver(([entry]) =>
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed
  }, [speed, src])

  const sideways = rotation % 180 !== 0
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play()
    else video.pause()
  }

  return (
    <div>
      <div ref={boxRef} className="relative aspect-video overflow-hidden rounded-lg bg-black">
        {error ? (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white/80">{error}</p>
        ) : src ? (
          <video
            ref={videoRef}
            src={src}
            autoPlay
            muted
            playsInline
            onClick={togglePlay}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            className="absolute left-1/2 top-1/2 cursor-pointer object-contain"
            style={{
              width: sideways ? box.height : '100%',
              height: sideways ? box.width : '100%',
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }}
          />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Préparation de la vidéo…</p>
        )}
      </div>

      {/* Our own controls: native ones would turn with the rotated video. */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!src}
          title={paused ? 'Lecture' : 'Pause'}
          className="rounded-lg p-2 text-ink hover:bg-ink/5 disabled:opacity-40 cursor-pointer"
        >
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={time}
          disabled={!src}
          onChange={(e) => {
            if (videoRef.current) videoRef.current.currentTime = Number(e.target.value)
          }}
          aria-label="Position dans la vidéo"
          className="min-w-0 flex-1 accent-[var(--brand)]"
        />
        <span className="shrink-0 font-mono text-xs text-ink-muted">
          {formatSeconds(time)} / {formatSeconds(duration)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {[1, 2, 4].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => setSpeed(rate)}
              className={`rounded-md px-2 py-1 text-xs font-medium cursor-pointer ${
                speed === rate ? 'bg-brand/10 text-brand' : 'text-ink-secondary hover:bg-ink/5'
              }`}
            >
              ×{rate}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onRotate(-90)}
            title="Pivoter à gauche"
            className="rounded-lg p-2 text-ink-secondary hover:bg-ink/5 hover:text-ink cursor-pointer"
          >
            <RotateCcw size={17} />
          </button>
          <button
            type="button"
            onClick={() => onRotate(90)}
            title="Pivoter à droite"
            className="rounded-lg p-2 text-ink-secondary hover:bg-ink/5 hover:text-ink cursor-pointer"
          >
            <RotateCw size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}
