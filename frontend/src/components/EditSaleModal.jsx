import { useEffect, useState } from 'react'
import { editSale } from '../api/api'
import { extractErrorMessage, useToast } from '../toast/ToastContext'
import Button from './ui/Button'
import { Field, Input, RequiredLegend } from './ui/Form'
import Modal from './ui/Modal'

const toDateInput = (iso) => (iso ? iso.slice(0, 10) : '')

// Admin-only editing of a recorded sale. Only changed fields are sent, so an
// untouched date keeps its original time. Stock is re-balanced by the API.
export default function EditSaleModal({ sale, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!sale) return
    setForm({
      product_name: sale.product_name || '',
      quantity: sale.quantity ?? '',
      total_price: sale.total_price ?? '',
      customer_name: sale.customer_name || '',
      sell_date: toDateInput(sale.sell_date),
    })
  }, [sale])

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const initial = {
      product_name: sale.product_name || '',
      quantity: String(sale.quantity ?? ''),
      total_price: String(sale.total_price ?? ''),
      customer_name: sale.customer_name || '',
      sell_date: toDateInput(sale.sell_date),
    }
    const changes = Object.fromEntries(
      Object.entries(form).filter(([key, value]) => String(value) !== initial[key]),
    )
    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }
    setSubmitting(true)
    try {
      if (changes.customer_name === '') changes.customer_name = null
      await editSale(sale.id, changes)
      toast.success('Vente modifiée.')
      onSaved()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={!!sale} onClose={onClose} title="Modifier la vente">
      {form && (
        <>
          <RequiredLegend className="mb-3" />
          <form className="space-y-4" onSubmit={handleSubmit}>
            {sale.product ? (
              <Field label="Produit" hint="Pour changer de produit, utilise « Associer à un produit du catalogue ».">
                <Input value={sale.product_name_display} readOnly disabled />
              </Field>
            ) : (
              <Field label="Nom du produit">
                <Input value={form.product_name} onChange={setField('product_name')} required />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantité" hint={sale.product ? 'Le stock sera ajusté.' : undefined}>
                <Input type="number" min="1" value={form.quantity} onChange={setField('quantity')} required />
              </Field>
              <Field label="Prix total (FCFA)">
                <Input type="number" min="0" step="0.01" value={form.total_price} onChange={setField('total_price')} required />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Client">
                <Input value={form.customer_name} onChange={setField('customer_name')} />
              </Field>
              <Field label="Date">
                <Input type="date" value={form.sell_date} onChange={setField('sell_date')} required />
              </Field>
            </div>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </form>
        </>
      )}
    </Modal>
  )
}
