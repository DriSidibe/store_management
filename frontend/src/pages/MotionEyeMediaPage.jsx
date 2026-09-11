import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import EmptyState from '../components/ui/EmptyState'
import { Image as ImageIcon, Film } from 'lucide-react'
import { listMotionEyeMedia } from '../api/api'

export default function MotionEyeMediaPage() {
  const { cameraId, date } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['motioneye-media', cameraId, date],
    queryFn: () => listMotionEyeMedia(cameraId, date),
  })

  if (isLoading) return <p className="text-sm text-ink-muted">Chargement...</p>

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Caméra {cameraId} — {date}</h1>

      <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Images</h2>
      {data.images.length === 0 ? (
        <EmptyState icon={ImageIcon} title="Aucune image" />
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.images.map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer">
              <img src={src} alt="" className="aspect-video w-full rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Vidéos</h2>
      {data.videos.length === 0 ? (
        <EmptyState icon={Film} title="Aucune vidéo" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.videos.map((src) => (
            <video key={src} src={src} controls className="w-full rounded-lg" />
          ))}
        </div>
      )}
    </div>
  )
}
