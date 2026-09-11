import { useQuery } from '@tanstack/react-query'
import { Play, Settings2, Square, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listCameras, startAllCameras, stopAllCameras } from '../api/api'
import { useAuth } from '../auth/AuthContext'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

export default function CamerasListPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, isLoading, refetch } = useQuery({ queryKey: ['cameras'], queryFn: listCameras })

  const handleStartAll = async () => {
    try {
      await startAllCameras()
      toast.success('Flux caméra démarrés.')
      refetch()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handleStopAll = async () => {
    try {
      await stopAllCameras()
      toast.success('Flux caméra arrêtés.')
      refetch()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Caméras</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleStartAll}>
            <Play size={14} /> Démarrer tout
          </Button>
          <Button variant="outline" size="sm" onClick={handleStopAll}>
            <Square size={14} /> Arrêter tout
          </Button>
          {user?.is_superuser && (
            <Link
              to="/camera/control"
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-ink/5"
            >
              <Settings2 size={14} /> Gérer les caméras
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Chargement...</p>
      ) : data?.results.length === 0 ? (
        <EmptyState icon={Video} title="Aucune caméra configurée" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.results.map((c) => (
            <Link key={c.id} to={`/cameras/${c.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <h2 className="text-sm font-semibold text-ink">{c.name}</h2>
                <p className="mt-0.5 text-xs text-ink-muted">{c.ip_address}</p>
                <Badge variant={c.is_active ? 'success' : 'neutral'} className="mt-3">
                  {c.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
