import { useQuery } from '@tanstack/react-query'
import { Package, Receipt, Search, ShoppingCart } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { globalSearch } from '../api/api'

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const rootRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const { data } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => globalSearch(debounced),
    enabled: debounced.length > 1,
  })

  useEffect(() => {
    const onClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const hasResults = data && (data.products.length || data.sales.length || data.bills.length)

  const goTo = (path) => {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
        <input
          className="w-full rounded-lg border border-border bg-page py-2 pl-9 pr-3 text-base text-ink sm:text-sm placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
          placeholder="Rechercher produits, ventes, factures..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && debounced.length > 1 && (
        <div className="absolute left-0 right-0 z-40 mt-1.5 max-h-96 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg animate-fade-in">
          {!hasResults && <p className="p-3 text-sm text-ink-muted">Aucun résultat.</p>}

          {data?.products.length > 0 && (
            <SearchGroup icon={Package} label="Produits">
              {data.products.map((p) => (
                <SearchItem key={p.product_id} onClick={() => goTo('/')}>
                  {p.product_name} <span className="text-ink-muted">· {p.product_id}</span>
                </SearchItem>
              ))}
            </SearchGroup>
          )}

          {data?.sales.length > 0 && (
            <SearchGroup icon={ShoppingCart} label="Ventes">
              {data.sales.map((s) => (
                <SearchItem key={s.id} onClick={() => goTo('/selled-products')}>
                  {s.product_name_display} <span className="text-ink-muted">· {s.total_price} FCFA</span>
                </SearchItem>
              ))}
            </SearchGroup>
          )}

          {data?.bills.length > 0 && (
            <SearchGroup icon={Receipt} label="Factures">
              {data.bills.map((b) => (
                <SearchItem key={b.id} onClick={() => goTo(`/final-bill/${b.id}`)}>
                  {b.customer_name}
                </SearchItem>
              ))}
            </SearchGroup>
          )}
        </div>
      )}
    </div>
  )
}

function SearchGroup({ icon: Icon, label, children }) {
  return (
    <div className="border-b border-border py-1.5 last:border-b-0">
      <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
        <Icon size={12} /> {label}
      </div>
      {children}
    </div>
  )
}

function SearchItem({ children, onClick }) {
  return (
    <button
      type="button"
      // See ProductAutocomplete: keeps the iPhone keyboard from closing mid-tap.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-ink/5 cursor-pointer"
    >
      {children}
    </button>
  )
}
