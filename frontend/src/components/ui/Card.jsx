export default function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-5 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
