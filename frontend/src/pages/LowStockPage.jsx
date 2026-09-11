import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listLowStockProducts } from '../api/api'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'

export default function LowStockPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['low-stock', page],
    queryFn: () => listLowStockProducts({ page }),
  })

  const pageSize = 20
  const totalPages = data ? Math.ceil(data.count / pageSize) : 1

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <AlertTriangle className="text-danger" size={20} />
        <h1 className="text-xl font-semibold text-ink">Produits en stock faible</h1>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : data?.results.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Aucun produit en stock faible" description="Tous les produits sont au-dessus de leur seuil d'alerte." />
      ) : (
        <>
          <Table>
            <Thead>
              <Th>Code</Th>
              <Th>Nom</Th>
              <Th>Quantité</Th>
              <Th>Seuil</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {data?.results.map((p) => (
                <Tr key={p.product_id}>
                  <Td className="font-mono text-xs text-ink-secondary">{p.product_id}</Td>
                  <Td>{p.product_name}</Td>
                  <Td>
                    <Badge variant="danger">{p.product_quantity}</Badge>
                  </Td>
                  <Td>{p.low_stock_threshold}</Td>
                  <Td>
                    <Link
                      to="/approvioning"
                      className="flex items-center justify-end gap-1.5 text-xs font-medium text-brand hover:underline"
                    >
                      <Truck size={13} /> Réapprovisionner
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-4 flex flex-wrap justify-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`h-8 w-8 rounded-lg text-sm font-medium cursor-pointer ${
                    n === page ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-ink/5'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
