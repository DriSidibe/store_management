import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { createProduct, listShelves, listUnits } from '../api/api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Field, Input, Select, Textarea } from '../components/ui/Form'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

const initialForm = {
  product_id_etg: '',
  product_id_cas: '',
  product_name: '',
  product_description: '',
  product_unity: '',
  product_quantity: 1,
  product_company: '',
  product_cp: 1,
  product_sp: 1,
  low_stock_threshold: 5,
}

export default function AddProductPage() {
  const toast = useToast()
  const { data: shelves } = useQuery({ queryKey: ['shelves'], queryFn: listShelves })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: listUnits })
  const [form, setForm] = useState(initialForm)
  const [image, setImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const product = await createProduct({ ...form, product_image: image })
      toast.success(`Produit ${product.product_id} ajouté avec succès !`)
      setForm(initialForm)
      setImage(null)
      e.target.reset()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Les informations sont incomplètes.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Ajouter un produit</h1>
      <Card className="max-w-2xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Étagère">
              <Select value={form.product_id_etg} onChange={setField('product_id_etg')} required>
                <option value="">-- Sélectionner --</option>
                {shelves?.results?.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Casier">
              <Input value={form.product_id_cas} onChange={setField('product_id_cas')} required />
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
                <option value="">-- Sélectionner --</option>
                {units?.results?.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Société">
              <Input value={form.product_company} onChange={setField('product_company')} />
            </Field>
          </div>

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
            <Field label="Seuil stock faible" hint="Alerte sous ce seuil">
              <Input type="number" min="0" value={form.low_stock_threshold} onChange={setField('low_stock_threshold')} />
            </Field>
          </div>

          <Field label="Image">
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand/20"
              onChange={(e) => setImage(e.target.files[0])}
            />
          </Field>

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Enregistrement...' : 'Ajouter le produit'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
