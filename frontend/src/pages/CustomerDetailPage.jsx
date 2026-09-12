import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Phone, Receipt, ShoppingBag } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { customerHistory } from '../api/api'
import Card from '../components/ui/Card'
import { CardStack } from '../components/ui/CardList'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'

export default function CustomerDetailPage() {
  const { id } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['customer-history', id],
    queryFn: () => customerHistory(id),
  })

  if (isLoading) return <p className="text-sm text-ink-muted">Chargement...</p>

  const { customer, sales, bills, total_spent } = data

  return (
    <div>
      <Link to="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
        <ArrowLeft size={15} /> Retour aux clients
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">{customer.name}</h1>
          {customer.phone && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
              <Phone size={14} /> {customer.phone}
            </p>
          )}
        </div>
        <Card className="px-5 py-3 text-right">
          <div className="text-xs uppercase tracking-wide text-ink-muted">Total dépensé</div>
          <div className="text-xl font-semibold text-ink">{total_spent.toLocaleString('fr-FR')} FCFA</div>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ShoppingBag size={15} /> Ventes ({sales.length})
          </h2>

          <CardStack>
            {sales.map((s) => (
              <Card key={s.id} className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{s.product_name_display}</p>
                  <p className="text-xs text-ink-muted">Quantité : {s.quantity}</p>
                </div>
                <p className="shrink-0 font-semibold text-ink">{s.total_price} FCFA</p>
              </Card>
            ))}
            {sales.length === 0 && <p className="text-center text-sm text-ink-muted">Aucune vente.</p>}
          </CardStack>

          <div className="hidden md:block">
            <Table>
              <Thead><Th>Produit</Th><Th>Quantité</Th><Th>Total</Th></Thead>
              <Tbody>
                {sales.map((s) => (
                  <Tr key={s.id}>
                    <Td>{s.product_name_display}</Td>
                    <Td>{s.quantity}</Td>
                    <Td>{s.total_price} FCFA</Td>
                  </Tr>
                ))}
                {sales.length === 0 && (
                  <Tr><Td colSpan={3} className="text-center text-ink-muted">Aucune vente.</Td></Tr>
                )}
              </Tbody>
            </Table>
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Receipt size={15} /> Factures ({bills.length})
          </h2>

          <CardStack>
            {bills.map((b) => (
              <Card key={b.id} className="flex items-center justify-between p-3">
                <p className="text-sm text-ink">{new Date(b.date_created).toLocaleString()}</p>
                <Link to={`/final-bill/${b.id}`} className="text-xs font-medium text-brand hover:underline">
                  Voir
                </Link>
              </Card>
            ))}
            {bills.length === 0 && <p className="text-center text-sm text-ink-muted">Aucune facture.</p>}
          </CardStack>

          <div className="hidden md:block">
            <Table>
              <Thead><Th>Date</Th><Th></Th></Thead>
              <Tbody>
                {bills.map((b) => (
                  <Tr key={b.id}>
                    <Td>{new Date(b.date_created).toLocaleString()}</Td>
                    <Td>
                      <Link to={`/final-bill/${b.id}`} className="text-xs font-medium text-brand hover:underline">
                        Voir
                      </Link>
                    </Td>
                  </Tr>
                ))}
                {bills.length === 0 && (
                  <Tr><Td colSpan={2} className="text-center text-ink-muted">Aucune facture.</Td></Tr>
                )}
              </Tbody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
