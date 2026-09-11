import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { listMotionEyeDates } from '../api/api'
import EmptyState from '../components/ui/EmptyState'

export default function MotionEyeDatesPage() {
  const { cameraId } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['motioneye-dates', cameraId],
    queryFn: () => listMotionEyeDates(cameraId),
  })

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Caméra {cameraId} — Dates</h1>
      {isLoading ? (
        <p className="text-sm text-ink-muted">Chargement...</p>
      ) : data?.dates.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Aucun enregistrement" />
      ) : (
        <div className="max-w-md divide-y divide-border rounded-xl border border-border bg-surface">
          {data?.dates.map((date) => (
            <Link
              key={date}
              to={`/camera/viewer/${cameraId}/${date}`}
              className="flex items-center justify-between px-4 py-3 text-sm text-ink hover:bg-ink/5"
            >
              {date} <ChevronRight size={15} className="text-ink-muted" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
