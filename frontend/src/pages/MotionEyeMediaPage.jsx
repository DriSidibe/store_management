import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Film, Image as ImageIcon, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchMotionEyeVideo, listMotionEyeMedia } from '../api/api'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ZoomableImage from '../components/ui/ZoomableImage'

// "21-13-49.mp4" -> "21:13:49"
const clipTime = (name) => name.replace(/\.mp4$/i, '').replace(/-/g, ':')

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
            <ClipPlayer key={current.name} cameraId={cameraId} date={date} name={current.name} />
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

function ClipPlayer({ cameraId, date, name }) {
  const [src, setSrc] = useState(null)
  const [error, setError] = useState(null)

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

  return (
    <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black">
      {error ? (
        <p className="px-4 text-center text-sm text-white/80">{error}</p>
      ) : src ? (
        <video src={src} controls autoPlay muted playsInline className="h-full w-full" />
      ) : (
        <p className="text-sm text-white/70">Préparation de la vidéo…</p>
      )}
    </div>
  )
}
