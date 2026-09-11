import { useQuery } from '@tanstack/react-query'
import { FileText, Receipt } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listBills } from '../api/api'
import EmptyState from '../components/ui/EmptyState'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'

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
      )}
    </div>
  )
}
