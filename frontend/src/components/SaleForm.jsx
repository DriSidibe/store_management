import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { createSale, listCustomers } from '../api/api'
import { extractErrorMessage, useToast } from '../toast/ToastContext'
import ProductAutocomplete from './ProductAutocomplete'
import Button from './ui/Button'
import { Field, Input, RequiredLegend } from './ui/Form'

const today = () => new Date().toISOString().slice(0, 10)

const catalogTotal = (product, quantity) => {
  const total = Number(product.product_sp) * (Number(quantity) || 0)
  return String(Math.round(total * 100) / 100)
}

const initialForm = (product) => ({
  product_name: product?.product_name ?? '',
  quantity: 1,
  price: product ? catalogTotal(product, 1) : '',
  customer: '',
  date: today(),
})

// The sale form shared by the Vendre page and the quick sale from a product's
// details. With `lockedProduct` the product is fixed; otherwise the seller
// searches the catalog or types an off-catalog product name.
export default function SaleForm({ lockedProduct = null, onSold, submitLabel = 'Valider la vente' }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const customerListId = useId()
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() })

  const [product, setProduct] = useState(lockedProduct)
  const [form, setForm] = useState(() => initialForm(lockedProduct))
  const [image, setImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // Once the seller types a price (discount, bargaining...) it's no longer
  // recomputed from the catalog price when the quantity changes.
  const [priceEdited, setPriceEdited] = useState(false)

  const handleSelectProduct = (p) => {
    setProduct(p)
    setPriceEdited(false)
    setForm((f) => {
      const quantity = Math.min(Number(f.quantity) || 1, Math.max(p.product_quantity, 1))
      return { ...f, product_name: p.product_name, quantity, price: catalogTotal(p, quantity) }
    })
  }

  const clearProduct = () => {
    setProduct(null)
    setPriceEdited(false)
    setForm((f) => ({ ...f, product_name: '', price: '' }))
  }

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleQuantityChange = (e) => {
    const quantity = e.target.value
    setForm((f) => ({
      ...f,
      quantity,
      price: product && !priceEdited ? catalogTotal(product, quantity) : f.price,
    }))
  }

  const handlePriceChange = (e) => {
    setPriceEdited(true)
    setForm((f) => ({ ...f, price: e.target.value }))
  }

  const resetToCatalogPrice = () => {
    setPriceEdited(false)
    setForm((f) => ({ ...f, price: catalogTotal(product, f.quantity) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const sale = await createSale({
        product: product ? product.id : undefined,
        product_name: form.product_name,
        quantity: form.quantity,
        total_price: form.price,
        customer_name: form.customer,
        sell_date: form.date,
        product_image: product ? undefined : image,
      })
      toast.success('Produit vendu avec succès !')
      if (product) {
        queryClient.invalidateQueries({ queryKey: ['products'] })
        queryClient.invalidateQueries({ queryKey: ['low-stock'] })
        queryClient.invalidateQueries({ queryKey: ['low-stock-count'] })
      }
      queryClient.invalidateQueries({ queryKey: ['sales-daily'] })
      if (!lockedProduct) {
        clearProduct()
        setForm(initialForm(null))
        setImage(null)
        e.target.reset()
      }
      onSold?.(sale)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <RequiredLegend className="mb-4" />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label={lockedProduct ? 'Produit' : 'Produit (nom ou code, optionnel)'}>
          {product ? (
            <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/10 p-2.5">
              {product.product_image ? (
                <img src={product.product_image} alt="" className="h-10 w-10 rounded-md object-cover" />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-md bg-ink/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-success-text">{product.product_name}</p>
                <p className="text-xs text-success-text/80">
                  {product.product_id} · Stock: {product.product_quantity} · Prix: {product.product_sp}
                </p>
              </div>
              {!lockedProduct && (
                <button
                  type="button"
                  onClick={clearProduct}
                  className="shrink-0 rounded-lg p-1.5 text-success-text hover:bg-success/20 cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ) : (
            <ProductAutocomplete
              placeholder="Tape le nom ou le code du produit..."
              onSelect={handleSelectProduct}
            />
          )}
          {!product && (
            <p className="mt-1.5 text-xs text-ink-muted">
              Rien trouvé ? Continue avec le nom ci-dessous, ce sera enregistré comme vente hors catalogue.
            </p>
          )}
        </Field>

        {!lockedProduct && (
          <Field label="Nom du produit">
            <Input value={form.product_name} onChange={setField('product_name')} required readOnly={!!product} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantité" hint={product ? `En stock : ${product.product_quantity}` : undefined}>
            <Input
              type="number"
              min="1"
              max={product ? product.product_quantity : undefined}
              value={form.quantity}
              onChange={handleQuantityChange}
              required
            />
          </Field>
          <Field
            label="Prix total (FCFA)"
            hint={
              product && (
                <>
                  Prix catalogue : {Number(product.product_sp)} FCFA l’unité
                  {priceEdited && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        onClick={resetToCatalogPrice}
                        className="font-medium text-brand hover:underline cursor-pointer"
                      >
                        Revenir au prix catalogue
                      </button>
                    </>
                  )}
                </>
              )
            }
          >
            <Input type="number" min="0" step="any" value={form.price} onChange={handlePriceChange} required />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client (optionnel)">
            <Input value={form.customer} onChange={setField('customer')} list={customerListId} />
            <datalist id={customerListId}>
              {customers?.results?.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </Field>
          <Field label="Date">
            <Input type="date" value={form.date} onChange={setField('date')} required />
          </Field>
        </div>

        {!product && (
          <Field label="Image (optionnel, vente hors catalogue)">
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand/20"
              onChange={(e) => setImage(e.target.files[0])}
            />
          </Field>
        )}

        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? 'Enregistrement...' : submitLabel}
        </Button>
      </form>
    </>
  )
}
