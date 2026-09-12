import { useQuery } from '@tanstack/react-query'
import { FileText, Receipt } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import { CardStack } from '../components/ui/CardList'
import EmptyState from '../components/ui/EmptyState'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { listBills } from '../api/api'

export default function ExistingBillsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['bills'], queryFn: listBills })

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Factures existantes</h1>
      {isLoading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : data?.results.length === 0 ? (
        <EmptyState icon={Receipt} title="Aucune facture" />
      ) : (
        <>
          <CardStack>
            {data?.results.map((b) => (
              <Card key={b.id} className="p-3">
                <p className="font-medium text-ink">{b.customer_name}</p>
                <p className="mb-2 text-xs text-ink-muted">{new Date(b.date_created).toLocaleString()}</p>
                <div className="flex gap-2 border-t border-border pt-2">
                  <Link
                    to={`/add-product-to-bill/${b.id}`}
                    className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-center text-xs font-medium text-ink-secondary hover:bg-ink/5"
                  >
                    Ajouter des produits
                  </Link>
                  <Link
                    to={`/final-bill/${b.id}`}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-ink/5"
                  >
                    <FileText size={13} /> Voir
                  </Link>
                </div>
              </Card>
            ))}
          </CardStack>

          <div className="hidden md:block">
            <Table>
              <Thead><Th>Client</Th><Th>Date</Th><Th></Th></Thead>
              <Tbody>
                {data?.results.map((b) => (
                  <Tr key={b.id}>
                    <Td>{b.customer_name}</Td>
                    <Td>{new Date(b.date_created).toLocaleString()}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/add-product-to-bill/${b.id}`}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-ink-secondary hover:bg-ink/5"
                        >
                          Ajouter des produits
                        </Link>
                        <Link
                          to={`/final-bill/${b.id}`}
                          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-ink-secondary hover:bg-ink/5"
                        >
                          <FileText size={13} /> Voir
                        </Link>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
