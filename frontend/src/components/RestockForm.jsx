import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { restockProduct } from '../api/api'
import { extractErrorMessage, useToast } from '../toast/ToastContext'
import { restockSellingPrice } from '../utils/restockPricing'
import RestockPricing from './RestockPricing'
import Button from './ui/Button'
import { Field, Input, RequiredLegend } from './ui/Form'

/** Restocking a catalog product: quantity received, purchase price, and the
 * new average cost / selling price help. Calls `onRestocked` with the updated
 * product. */
export default function RestockForm({ product, onRestocked }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  // Selling price typed in the field - null while untouched, so the field
  // shows the suggestion (see RestockPricing).
  const [editedPrice, setEditedPrice] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const updated = await restockProduct(product.product_id, {
        quantity,
        unit_cost: unitCost,
        selling_price: restockSellingPrice(product, quantity, unitCost, editedPrice),
      })
      toast.success(
        `${updated.product_name} : +${quantity} en stock, prix d'achat ${updated.product_cp} FCFA, ` +
          `prix de vente ${updated.product_sp} FCFA.`
      )
      for (const key of ['products', 'products-lookup', 'low-stock', 'low-stock-count', 'price-history']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      onRestocked(updated)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <RequiredLegend className="-mt-1" />
      <Field label="Quantité reçue">
        <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus required />
      </Field>
      <Field label="Prix d'achat unitaire (FCFA)">
        <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required />
      </Field>
      <RestockPricing product={product} quantity={quantity} unitCost={unitCost} edited={editedPrice} onEdit={setEditedPrice} />
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Enregistrement...' : 'Ajouter au stock'}
      </Button>
    </form>
  )
}
