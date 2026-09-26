import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Maximize2, RefreshCw, RotateCcw, RotateCw, Video, VideoOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listLiveCameras, setLiveStreamEnabled } from '../api/api'
import { useAuth } from '../auth/AuthContext'
import RotatedFrame from '../components/RotatedFrame'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import useCameraRotation from '../hooks/useCameraRotation'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

// Streams run only while the page is visible: a background tab would keep
// pulling video through the shop's connection for nothing.
function usePageVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden')
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

export default function LiveCamerasPage() {
  const visible = usePageVisible()
  const [enlargedId, setEnlargedId] = useState(null)
  // Remount grid tiles after the enlarged view closes, so they pick up a
  // rotation changed there.
  const [closedCount, setClosedCount] = useState(0)
  const { data: cameras, isLoading } = useQuery({
    queryKey: ['live-cameras'],
    queryFn: listLiveCameras,
    // Frequent enough that viewers stop within ~30 s when an admin turns a
    // camera's live view off; tiles keep their current link meanwhile.
    refetchInterval: 30 * 1000,
  })
  const enlarged = cameras?.find((c) => c.id === enlargedId) ?? null

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Caméras en direct</h1>
      {isLoading ? (
        <p className="text-sm text-ink-muted">Chargement...</p>
      ) : !cameras?.length ? (
        <EmptyState icon={Video} title="Aucune caméra" description="Aucune caméra n'est configurée dans MotionEye." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cameras.map((camera) => (
            <LiveTile key={`${camera.id}-${closedCount}`} camera={camera} active={visible && enlargedId !== camera.id} onEnlarge={() => setEnlargedId(camera.id)} />
          ))}
        </div>
      )}

      <Modal
        open={!!enlarged}
        onClose={() => {
          setEnlargedId(null)
          setClosedCount((n) => n + 1)
        }}
        title={enlarged?.name}
        size="lg"
      >
        {enlarged && <LiveTile camera={enlarged} active={visible} large />}
      </Modal>
    </div>
  )
}

function LiveTile({ camera, active, onEnlarge, large = false }) {
  const [rotation, rotate] = useCameraRotation(camera.folder)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // Each refresh of the camera list signs a new link; keep the one the stream
  // was opened with so the refresh doesn't restart it. A new link is taken
  // when the live view comes back on, or on retry.
  const [streamUrl, setStreamUrl] = useState(camera.stream_url)
  useEffect(() => {
    if (!camera.stream_url) setStreamUrl(null)
    else setStreamUrl((current) => current ?? camera.stream_url)
  }, [camera.stream_url])

  const retry = () => {
    setFailed(false)
    setStreamUrl(camera.stream_url)
    setAttempt((n) => n + 1)
  }

  const liveOff = camera.enabled && !camera.live_enabled
  const showStream = camera.enabled && camera.live_enabled && streamUrl && active && !failed
  const offline = !camera.enabled || failed

  return (
    <div className={large ? '' : 'overflow-hidden rounded-xl border border-border bg-surface'}>
      {!large && (
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
            <span className={`h-2 w-2 shrink-0 rounded-full ${offline || liveOff ? 'bg-ink-muted' : 'bg-danger animate-pulse'}`} />
            <span className="truncate">{camera.name}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <LiveSwitch camera={camera} />
            <TileButtons rotate={rotate} onEnlarge={camera.live_enabled ? onEnlarge : undefined} />
          </div>
        </div>
      )}

      <RotatedFrame
        rotation={rotation}
        className={large ? 'rounded-lg' : ''}
        overlay={
          liveOff ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-white/80">
              <VideoOff size={26} />
              Direct désactivé
              <span className="text-xs text-white/60">L’enregistrement continue normalement.</span>
            </div>
          ) : offline ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-sm text-white/80">
              <VideoOff size={26} />
              {camera.enabled ? 'Caméra injoignable' : 'Caméra désactivée dans MotionEye'}
              {camera.enabled && (
                <button
                  type="button"
                  onClick={retry}
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 cursor-pointer"
                >
                  <RefreshCw size={13} /> Réessayer
                </button>
              )}
            </div>
          ) : !active ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">En pause</div>
          ) : null
        }
      >
        {showStream ? (
          <img
            key={attempt}
            src={`${streamUrl}&attempt=${attempt}`}
            alt={`Direct ${camera.name}`}
            onError={() => setFailed(true)}
          />
        ) : null}
      </RotatedFrame>

      {large && (
        <div className="mt-2 flex justify-end">
          <TileButtons rotate={rotate} />
        </div>
      )}
    </div>
  )
}

function TileButtons({ rotate, onEnlarge }) {
  const button = 'rounded-lg p-1.5 text-ink-secondary hover:bg-ink/5 hover:text-ink cursor-pointer'
  return (
    <div className="flex shrink-0 gap-0.5">
      <button type="button" onClick={() => rotate(-90)} title="Pivoter à gauche" className={button}>
        <RotateCcw size={16} />
      </button>
      <button type="button" onClick={() => rotate(90)} title="Pivoter à droite" className={button}>
        <RotateCw size={16} />
      </button>
      {onEnlarge && (
        <button type="button" onClick={onEnlarge} title="Agrandir" className={button}>
          <Maximize2 size={16} />
        </button>
      )}
    </div>
  )
}

// Admin-only switch: turning a camera's live view off frees the shop's
// outgoing bandwidth for everyone; recording is not affected.
function LiveSwitch({ camera }) {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  if (!user?.is_superuser || !camera.enabled) return null

  const toggle = async () => {
    setSaving(true)
    try {
      await setLiveStreamEnabled(camera.id, !camera.live_enabled)
      await queryClient.invalidateQueries({ queryKey: ['live-cameras'] })
      toast.success(camera.live_enabled ? `Direct de ${camera.name} désactivé.` : `Direct de ${camera.name} réactivé.`)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={camera.live_enabled}
      onClick={toggle}
      disabled={saving}
      title={camera.live_enabled ? 'Désactiver le direct pour libérer la bande passante' : 'Réactiver le direct'}
      className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium text-ink-secondary hover:bg-ink/5 disabled:opacity-50 cursor-pointer"
    >
      <span className={`relative h-4 w-7 rounded-full transition-colors ${camera.live_enabled ? 'bg-success' : 'bg-ink/20'}`}>
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${camera.live_enabled ? 'left-3.5' : 'left-0.5'}`}
        />
      </span>
      Direct
    </button>
  )
}
