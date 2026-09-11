import { useQuery } from '@tanstack/react-query'
import { Camera, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listMotionEyeCameras } from '../api/api'
import EmptyState from '../components/ui/EmptyState'

export default function MotionEyeViewerPage() {
  const { data, isLoading } = useQuery({ queryKey: ['motioneye-cameras'], queryFn: listMotionEyeCameras })

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Vidéos enregistrées</h1>
      {isLoading ? (
        <p className="text-sm text-ink-muted">Chargement...</p>
      ) : data?.length === 0 ? (
        <EmptyState icon={Camera} title="Aucune caméra enregistrée" />
      ) : (
        <div className="max-w-md divide-y divide-border rounded-xl border border-border bg-surface">
          {data?.map((cameraId) => (
            <Link
              key={cameraId}
              to={`/camera/viewer/${cameraId}`}
              className="flex items-center justify-between px-4 py-3 text-sm text-ink hover:bg-ink/5"
            >
              {cameraId} <ChevronRight size={15} className="text-ink-muted" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
