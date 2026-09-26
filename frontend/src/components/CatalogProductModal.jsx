import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { listShelves, listUnits } from '../api/api'
import { extractErrorMessage, useToast } from '../toast/ToastContext'
import CategorySelect from './CategorySelect'
import Button from './ui/Button'
import { Field, Input, RequiredLegend, Select, Textarea } from './ui/Form'
import Modal from './ui/Modal'

const initialForm = {
  product_id_etg: '',
  product_id_cas: '',
  product_name: '',
  product_description: '',
  product_unity: '',
  category: '',
  product_quantity: 1,
  product_company: '',
  product_cp: 1,
  product_sp: 1,
  low_stock_threshold: 5,
}

// Collects the details needed to turn something that isn't in the catalog yet
// (an ad-hoc sale, a supply request) into a real product. `onSubmit` receives
// the form data and should throw on failure; the modal reports the error.
export default function CatalogProductModal({
  open, onClose, onSubmit, initialName = '', initialQuantity, description, imageHint,
}) {
  const toast = useToast()
  const [form, setForm] = useState(initialForm)
  const [image, setImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: shelves } = useQuery({ queryKey: ['shelves'], queryFn: listShelves, enabled: open })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: listUnits, enabled: open })

  useEffect(() => {
    if (!open) return
    setForm({
      ...initialForm,
      product_name: initialName,
      product_quantity: initialQuantity ?? initialForm.product_quantity,
    })
    setImage(null)
  }, [open, initialName, initialQuantity])

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({ ...form, product_image: image })
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Les informations sont incomplètes.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajouter ce produit au catalogue" size="lg">
      {description && <p className="mb-2 text-xs text-ink-muted">{description}</p>}
      <RequiredLegend className="mb-3" />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Étagère">
            <Select value={form.product_id_etg} onChange={setField('product_id_etg')} required>
              <option value="">-- Sélectionner --</option>
              {shelves?.results?.map((sh) => (
                <option key={sh.id} value={sh.name}>{sh.name}</option>
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
          <Textarea rows={2} value={form.product_description} onChange={setField('product_description')} />
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
            <Input value={form.product_company} onChange={setField('product_company')} required />
          </Field>
        </div>

        <CategorySelect value={form.category} onChange={setField('category')} required />

        <div className="grid grid-cols-2 gap-4">
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

        <Field label="Image" hint={imageHint}>
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand/20"
            onChange={(e) => setImage(e.target.files[0])}
          />
        </Field>

        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? 'Création...' : 'Créer le produit'}
        </Button>
      </form>
    </Modal>
  )
}
