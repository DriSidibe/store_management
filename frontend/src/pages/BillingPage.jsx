import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createBill, listCustomers } from '../api/api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Field, Input } from '../components/ui/Form'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

export default function BillingPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() })
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const bill = await createBill(customerName)
      navigate(`/add-product-to-bill/${bill.id}`)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Calculer une facture</h1>
      <Card className="mb-4 max-w-md">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Nom du client">
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} list="customer-names" required />
            <datalist id="customer-names">
              {customers?.results?.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </Field>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Création...' : 'Nouvelle facture'}
          </Button>
        </form>
      </Card>
      <Link to="/existing-bills" className="text-sm text-brand hover:underline">
        Voir les factures existantes
      </Link>
    </div>
  )
}
