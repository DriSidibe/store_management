export default function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-ink/10 ${className}`} />
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }, (_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
