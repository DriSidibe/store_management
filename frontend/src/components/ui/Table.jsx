export function Table({ children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-max text-left text-sm">{children}</table>
    </div>
  )
}

export function Thead({ children }) {
  return (
    <thead className="border-b border-border text-xs font-medium uppercase tracking-wide text-ink-muted">
      <tr>{children}</tr>
    </thead>
  )
}

export function Th({ children, className = '' }) {
  return <th className={`whitespace-nowrap px-4 py-3 font-medium ${className}`}>{children}</th>
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-border">{children}</tbody>
}

export function Td({ children, className = '' }) {
  return <td className={`whitespace-nowrap px-4 py-3 align-middle text-ink ${className}`}>{children}</td>
}

export function Tr({ children, className = '', ...props }) {
  return (
    <tr className={`transition-colors hover:bg-ink/[0.03] ${className}`} {...props}>
      {children}
    </tr>
  )
}
