import { useQuery } from '@tanstack/react-query'
import { Maximize2, RefreshCw, RotateCcw, RotateCw, Video, VideoOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listLiveCameras } from '../api/api'
import RotatedFrame from '../components/RotatedFrame'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import useCameraRotation from '../hooks/useCameraRotation'

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
  const [enlarged, setEnlarged] = useState(null)
  // Remount grid tiles after the enlarged view closes, so they pick up a
  // rotation changed there.
  const [closedCount, setClosedCount] = useState(0)
  const { data: cameras, isLoading } = useQuery({
    queryKey: ['live-cameras'],
    queryFn: listLiveCameras,
    refetchInterval: 6 * 3600 * 1000, // stream links expire after 12 h
  })

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
            <LiveTile key={`${camera.id}-${closedCount}`} camera={camera} active={visible && enlarged?.id !== camera.id} onEnlarge={() => setEnlarged(camera)} />
          ))}
        </div>
      )}

      <Modal
        open={!!enlarged}
        onClose={() => {
          setEnlarged(null)
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

  const retry = () => {
    setFailed(false)
    setAttempt((n) => n + 1)
  }

  const showStream = camera.enabled && camera.stream_url && active && !failed
  const offline = !camera.enabled || failed

  return (
    <div className={large ? '' : 'overflow-hidden rounded-xl border border-border bg-surface'}>
      {!large && (
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
            <span className={`h-2 w-2 shrink-0 rounded-full ${offline ? 'bg-ink-muted' : 'bg-danger animate-pulse'}`} />
            <span className="truncate">{camera.name}</span>
          </span>
          <TileButtons rotate={rotate} onEnlarge={onEnlarge} />
        </div>
      )}

      <RotatedFrame
        rotation={rotation}
        className={large ? 'rounded-lg' : ''}
        overlay={
          offline ? (
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
            src={`${camera.stream_url}&attempt=${attempt}`}
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
