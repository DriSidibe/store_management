import { useQuery } from '@tanstack/react-query'
import { getProductPriceHistory } from '../api/api'

// "1000 → 1300 FCFA", or null when the price did not change (a creation has
// no old price and always shows its starting price).
const priceChange = (label, oldPrice, newPrice) => {
  if (oldPrice !== null && oldPrice === newPrice) return null
  return (
    <p className="text-xs text-ink-secondary">
      {label} : {oldPrice !== null ? `${oldPrice} → ` : ''}<span className="font-medium text-ink">{newPrice} FCFA</span>
    </p>
  )
}

/** Every change of a product's cost and selling prices, newest first. */
export default function PriceHistory({ productId }) {
  const { data: changes, isLoading } = useQuery({
    queryKey: ['price-history', productId],
    queryFn: () => getProductPriceHistory(productId),
  })

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-semibold text-ink">Historique des prix</h3>
      {isLoading && <p className="text-xs text-ink-muted">Chargement...</p>}
      {changes?.length === 0 && <p className="text-xs text-ink-muted">Aucun changement enregistré.</p>}
      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {changes?.map((c) => (
          <li key={c.id} className="rounded-lg border border-border p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink">{c.reason_display}</span>
              <span className="text-xs text-ink-muted">
                {new Date(c.changed_at).toLocaleString()}{c.changed_by_username ? ` · ${c.changed_by_username}` : ''}
              </span>
            </div>
            {priceChange("Prix d'achat", c.old_cost_price, c.new_cost_price)}
            {priceChange('Prix de vente', c.old_selling_price, c.new_selling_price)}
            {c.note && <p className="text-xs text-ink-muted">{c.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
