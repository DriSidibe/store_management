import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronRight, HardDrive } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getRecordingSettings, listMotionEyeCameras, updateRecordingSettings } from '../api/api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { Field, Select } from '../components/ui/Form'
import { useConfirm } from '../confirm/ConfirmContext'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

const gigabytes = (bytes) => `${(bytes / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`
const formatDay = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('fr-FR')

export default function MotionEyeViewerPage() {
  const { data, isLoading } = useQuery({ queryKey: ['motioneye-cameras'], queryFn: listMotionEyeCameras })

  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 text-xl font-semibold text-ink">Vidéos enregistrées</h1>
      {isLoading ? (
        <p className="text-sm text-ink-muted">Chargement...</p>
      ) : data?.length === 0 ? (
        <EmptyState icon={Camera} title="Aucune caméra enregistrée" />
      ) : (
        <div className="mb-6 divide-y divide-border rounded-xl border border-border bg-surface">
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

      <RetentionSettings />
    </div>
  )
}

function RetentionSettings() {
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['recording-settings'], queryFn: getRecordingSettings })
  const [choice, setChoice] = useState(null)
  const [saving, setSaving] = useState(false)

  if (!data) return null
  const selected = choice ?? data.retention_days
  const changed = selected !== data.retention_days
  const selectedLabel = data.choices.find((c) => c.days === selected)?.label

  const handleSave = async () => {
    if (selected < data.retention_days) {
      const ok = await confirm(
        `Garder les vidéos ${selectedLabel} seulement ? Les vidéos plus anciennes seront supprimées définitivement cette nuit.`,
      )
      if (!ok) return
    }
    setSaving(true)
    try {
      const updated = await updateRecordingSettings(selected)
      queryClient.setQueryData(['recording-settings'], updated)
      setChoice(null)
      toast.success(`Les vidéos seront conservées ${selectedLabel}.`)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const usedShare = data.disk_total_bytes ? (data.disk_total_bytes - data.disk_free_bytes) / data.disk_total_bytes : 0

  return (
    <Card className="p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
        <HardDrive size={16} /> Conservation des vidéos
      </h2>
      <p className="mb-4 text-xs text-ink-muted">
        Chaque nuit, les vidéos plus anciennes que la durée choisie sont supprimées. Si le disque devient presque
        plein, les plus anciennes sont supprimées en premier pour que l’enregistrement ne s’arrête jamais.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat label="Espace utilisé" value={gigabytes(data.used_bytes)} />
        <Stat label="Par jour (moyenne)" value={gigabytes(data.bytes_per_day)} />
        <Stat
          label="Plus ancienne vidéo"
          value={data.oldest_day ? formatDay(data.oldest_day) : '-'}
          hint={data.days_stored ? `${data.days_stored} jour(s) enregistré(s)` : undefined}
        />
      </div>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-ink-muted">
          <span>Disque</span>
          <span>{gigabytes(data.disk_free_bytes)} libres sur {gigabytes(data.disk_total_bytes)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(usedShare * 100)}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Garder les vidéos pendant" className="flex-1">
          <Select value={selected} onChange={(e) => setChoice(Number(e.target.value))}>
            {data.choices.map((c) => (
              <option key={c.days} value={c.days} disabled={!c.fits}>
                {c.label} — environ {gigabytes(c.estimated_bytes)}
                {c.fits ? '' : ' (pas assez de place)'}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={handleSave} disabled={!changed || saving} className="w-full sm:w-auto">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </Card>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg bg-ink/[0.03] px-3 py-2">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
      {hint && <p className="text-[11px] text-ink-muted">{hint}</p>}
    </div>
  )
}
