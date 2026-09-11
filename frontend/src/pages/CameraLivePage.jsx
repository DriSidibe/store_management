import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Video } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { flipCamera, getCamera, listLocalRecordings, saveCameraStream } from '../api/api'
import Button from '../components/ui/Button'
import { Checkbox } from '../components/ui/Form'
import EmptyState from '../components/ui/EmptyState'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

export default function CameraLivePage() {
  const { id } = useParams()
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: camera } = useQuery({ queryKey: ['camera', id], queryFn: () => getCamera(id) })
  const { data: recordings } = useQuery({ queryKey: ['recordings'], queryFn: listLocalRecordings })

  const handleFlip = async (type, enabled) => {
    try {
      await flipCamera(id, type, enabled)
      queryClient.invalidateQueries({ queryKey: ['camera', id] })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handleSave = async () => {
    try {
      await saveCameraStream(id)
      toast.success('Enregistrement sauvegardé.')
      queryClient.invalidateQueries({ queryKey: ['recordings'] })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  if (!camera) return <p className="text-sm text-ink-muted">Chargement...</p>

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">{camera.name}</h1>

      <div className="mb-4 overflow-hidden rounded-xl border border-border bg-surface">
        <img src={camera.feed_url} alt={camera.name} className="w-full" />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-5">
        <Checkbox
          label="Miroir vertical"
          checked={camera.vflip}
          onChange={(e) => handleFlip('vflip', e.target.checked)}
        />
        <Checkbox
          label="Miroir horizontal"
          checked={camera.hflip}
          onChange={(e) => handleFlip('hflip', e.target.checked)}
        />
        <Button variant="outline" size="sm" onClick={handleSave}>
          <Save size={14} /> Sauvegarder l'enregistrement
        </Button>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-ink">Enregistrements</h2>
      {recordings?.length === 0 ? (
        <EmptyState icon={Video} title="Aucun enregistrement" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {recordings?.map((r) => (
            <a
              key={r.name}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-border bg-surface p-2 transition-shadow hover:shadow-md"
            >
              <img src={r.thumbnail} alt={r.name} className="mb-1.5 aspect-video w-full rounded-lg object-cover" />
              <span className="block truncate text-xs text-ink-muted">{r.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
