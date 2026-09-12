import { useQuery } from '@tanstack/react-query'
import { Package, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { listProducts } from '../api/api'
import useDebouncedValue from '../hooks/useDebouncedValue'

/** Amazon/Jumia-style "type to search" product picker: shows a live
 * suggestions dropdown instead of requiring an exact code + a search click. */
export default function ProductAutocomplete({
  placeholder = 'Rechercher un produit (nom ou code)...',
  onSelect,
  autoFocus,
  className = '',
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebouncedValue(query, 250)
  const rootRef = useRef(null)

  const { data, isFetching } = useQuery({
    queryKey: ['product-autocomplete', debounced],
    queryFn: () => listProducts({ search: debounced, page_size: 8 }),
    enabled: debounced.trim().length > 1,
  })

  useEffect(() => {
    const onClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const results = data?.results ?? []

  const handleSelect = (product) => {
    setQuery('')
    setOpen(false)
    onSelect(product)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
        <input
          className="w-full rounded-lg border border-border bg-page py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
          placeholder={placeholder}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && debounced.trim().length > 1 && (
        <div className="absolute left-0 right-0 z-40 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg animate-fade-in">
          {isFetching && results.length === 0 && (
            <p className="p-3 text-sm text-ink-muted">Recherche...</p>
          )}
          {!isFetching && results.length === 0 && (
            <p className="p-3 text-sm text-ink-muted">Aucun produit trouvé.</p>
          )}
          {results.map((p) => (
            <button
              key={p.product_id}
              type="button"
              onClick={() => handleSelect(p)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-ink/5 cursor-pointer"
            >
              {p.product_image ? (
                <img src={p.product_image} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink/5 text-ink-muted">
                  <Package size={14} />
                </div>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink">{p.product_name}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {p.product_id} · {p.product_sp} FCFA · stock {p.product_quantity}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
