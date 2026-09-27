import { newAverageCost, restockSellingPrice } from '../utils/restockPricing'
import { Field, Input } from './ui/Form'

/** New average cost, profit per unit before/after, and the new selling price
 * field of a restock form - rendered once the quantity and purchase price
 * are filled in. `product` needs product_quantity, product_cp, product_sp. */
export default function RestockPricing({ product, quantity, unitCost, edited, onEdit }) {
  const newCost = newAverageCost(product, quantity, unitCost)
  if (newCost === null) return null

  const sellingPrice = restockSellingPrice(product, quantity, unitCost, edited)
  const round = (n) => Math.round(n * 100) / 100
  const newProfit = round((sellingPrice === '' ? product.product_sp : Number(sellingPrice)) - newCost)

  return (
    <>
      <div className="space-y-1 rounded-lg bg-ink/5 p-3 text-xs text-ink-muted">
        <p>
          Nouveau prix d'achat moyen : <span className="font-semibold text-ink">{newCost} FCFA</span>
        </p>
        <p>
          Bénéfice par unité : {round(product.product_sp - product.product_cp)} →{' '}
          <span className={`font-semibold ${newProfit < 0 ? 'text-danger' : 'text-ink'}`}>{newProfit} FCFA</span>
        </p>
      </div>
      <Field
        label="Nouveau prix de vente (FCFA)"
        hint={`Proposé pour garder la même marge en pourcentage. Vide ce champ pour garder le prix actuel (${product.product_sp} FCFA).`}
      >
        <Input type="number" step="0.01" min="0" value={sellingPrice} onChange={(e) => onEdit(e.target.value)} />
      </Field>
    </>
  )
}
