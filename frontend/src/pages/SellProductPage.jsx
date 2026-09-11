import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createSale, getProduct, listCustomers } from '../api/api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Field, Input } from '../components/ui/Form'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

const today = () => new Date().toISOString().slice(0, 10)

export default function SellProductPage() {
  const toast = useToast()
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() })
  const [productId, setProductId] = useState('')
  const [product, setProduct] = useState(null)
  const [lookupError, setLookupError] = useState(null)
  const [form, setForm] = useState({
    product_name: '',
    quantity: 1,
    price: '',
    customer: '',
    date: today(),
  })
  const [image, setImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [lastSaleId, setLastSaleId] = useState(null)

  const handleLookup = async () => {
    setLookupError(null)
    if (!productId) return
    try {
      const p = await getProduct(productId.toUpperCase())
      setProduct(p)
      setForm((f) => ({ ...f, product_name: p.product_name }))
    } catch {
      setProduct(null)
      setLookupError('Produit introuvable - il sera enregistré comme vente hors catalogue.')
    }
  }

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value })

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
        product_image: image,
      })
      toast.success('Produit vendu avec succès !')
      setLastSaleId(sale.id)
      setProductId('')
      setProduct(null)
      setForm({ product_name: '', quantity: 1, price: '', customer: '', date: today() })
      setImage(null)
      e.target.reset()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Vendre un produit</h1>

      {lastSaleId && (
        <div className="mb-4 flex max-w-xl items-center justify-between rounded-lg border border-success/20 bg-success/10 px-4 py-2.5 text-sm text-success-text">
          Vente enregistrée.
          <Link to={`/receipt/${lastSaleId}`} className="flex items-center gap-1.5 font-medium hover:underline">
            <Printer size={14} /> Imprimer le ticket
          </Link>
        </div>
      )}

      <Card className="max-w-xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Code produit (optionnel)">
            <div className="flex gap-2">
              <Input
                className="uppercase"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="ex: AM-A-1-00001"
              />
              <Button type="button" variant="outline" onClick={handleLookup}>Rechercher</Button>
            </div>
            {product && (
              <p className="mt-1.5 text-xs text-success-text">
                {product.product_name} - Stock: {product.product_quantity} - Prix: {product.product_sp}
              </p>
            )}
            {lookupError && <p className="mt-1.5 text-xs text-warning">{lookupError}</p>}
          </Field>

          <Field label="Nom du produit">
            <Input value={form.product_name} onChange={setField('product_name')} required readOnly={!!product} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Quantité">
              <Input type="number" min="1" value={form.quantity} onChange={setField('quantity')} required />
            </Field>
            <Field label="Prix total (FCFA)">
              <Input type="number" min="0" value={form.price} onChange={setField('price')} required />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client (optionnel)">
              <Input value={form.customer} onChange={setField('customer')} list="customer-names" />
              <datalist id="customer-names">
                {customers?.results?.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={setField('date')} />
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

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Enregistrement...' : 'Valider la vente'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
