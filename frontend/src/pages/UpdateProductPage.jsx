import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getProduct, listShelves, listUnits, updateProduct } from '../api/api'
import CategorySelect from '../components/CategorySelect'
import ProductAutocomplete from '../components/ProductAutocomplete'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Field, Input, RequiredLegend, Select, Textarea } from '../components/ui/Form'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

function toForm(p) {
  const [, etg, cas] = p.product_id.split('-')
  return {
    product_id_etg: etg,
    product_id_cas: cas,
    product_name: p.product_name,
    product_description: p.product_description,
    product_unity: p.product_unity,
    category: p.category_name || '',
    product_quantity: p.product_quantity,
    product_company: p.product_company,
    product_cp: p.product_cp,
    product_sp: p.product_sp,
    low_stock_threshold: p.low_stock_threshold,
  }
}

export default function UpdateProductPage() {
  const toast = useToast()
  const location = useLocation()
  const { data: shelves } = useQuery({ queryKey: ['shelves'], queryFn: listShelves })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: listUnits })

  const [product, setProduct] = useState(null)
  const [form, setForm] = useState(null)
  const [image, setImage] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const selectProduct = (p) => {
    setNotFound(false)
    setProduct(p)
    setForm(toForm(p))
  }

  useEffect(() => {
    if (location.state?.productId) {
      getProduct(location.state.productId)
        .then(selectProduct)
        .catch(() => setNotFound(true))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const updated = await updateProduct(product.product_id, { ...form, product_image: image })
      toast.success('Produit mis à jour avec succès !')
      setProduct(updated)
      setImage(null)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Modifier un produit</h1>

      <div className="mb-6 max-w-lg">
        <ProductAutocomplete
          placeholder="Tape le nom ou le code du produit à modifier..."
          onSelect={selectProduct}
        />
      </div>

      {notFound && (
        <p className="mb-4 max-w-lg rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          Product Not Found!
        </p>
      )}

      {product && form && (
        <Card className="max-w-2xl">
          <RequiredLegend className="mb-4" />
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center gap-3">
              {product.product_image ? (
                <img src={product.product_image} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-ink/5" />
              )}
              <div>
                <p className="text-sm font-medium text-ink">{product.product_name}</p>
                <p className="font-mono text-xs text-ink-muted">{product.product_id}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Étagère">
                <Select value={form.product_id_etg} onChange={setField('product_id_etg')} required>
                  {shelves?.results?.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Casier">
                <Input value={form.product_id_cas} onChange={setField('product_id_cas')} />
              </Field>
            </div>

            <Field label="Nom du produit">
              <Input value={form.product_name} onChange={setField('product_name')} required />
            </Field>

            <Field label="Description">
              <Textarea rows={3} value={form.product_description} onChange={setField('product_description')} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Unité">
                <Select value={form.product_unity} onChange={setField('product_unity')} required>
                  {units?.results?.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Société">
                <Input value={form.product_company} onChange={setField('product_company')} required />
              </Field>
            </div>

            <CategorySelect value={form.category} onChange={setField('category')} required />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Quantité">
                <Input type="number" min="0" value={form.product_quantity} onChange={setField('product_quantity')} required />
              </Field>
              <Field label="Prix d'achat">
                <Input type="number" step="0.01" min="0" value={form.product_cp} onChange={setField('product_cp')} required />
              </Field>
              <Field label="Prix de vente">
                <Input type="number" step="0.01" min="0" value={form.product_sp} onChange={setField('product_sp')} required />
              </Field>
              <Field label="Seuil stock faible">
                <Input type="number" min="0" value={form.low_stock_threshold} onChange={setField('low_stock_threshold')} />
              </Field>
            </div>

            <Field label="Nouvelle image (optionnel)">
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand/20"
                onChange={(e) => setImage(e.target.files[0])}
              />
            </Field>

            <Button type="submit" disabled={submitting}>
              {submitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  )
}
