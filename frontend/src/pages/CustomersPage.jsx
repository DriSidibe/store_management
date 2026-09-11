import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createCustomer, deleteCustomer, listCustomers } from '../api/api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { Field, Input } from '../components/ui/Form'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { useConfirm } from '../confirm/ConfirmContext'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

export default function CustomersPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() })

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createCustomer({ name, phone })
      toast.success('Client ajouté.')
      setName('')
      setPhone('')
      e.target.reset()
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, customerName) => {
    if (!(await confirm(`Supprimer le client ${customerName} ?`))) return
    try {
      await deleteCustomer(id)
      toast.success('Client supprimé.')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Clients</h1>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <h2 className="mb-3 text-sm font-semibold text-ink">Ajouter un client</h2>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Nom">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Téléphone (optionnel)">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Enregistrement...' : 'Ajouter'}
            </Button>
          </form>
        </Card>

        {isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : data?.results.length === 0 ? (
          <EmptyState icon={Users} title="Aucun client" description="Ajoute un premier client pour suivre son historique d'achats." />
        ) : (
          <Table>
            <Thead><Th>Nom</Th><Th>Téléphone</Th><Th>Depuis</Th><Th></Th></Thead>
            <Tbody>
              {data?.results.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <Link to={`/customers/${c.id}`} className="font-medium text-brand hover:underline">
                      {c.name}
                    </Link>
                  </Td>
                  <Td>{c.phone || '-'}</Td>
                  <Td>{new Date(c.created_at).toLocaleDateString()}</Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id, c.name)}
                      className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  )
}
