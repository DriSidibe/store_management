import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Download, Package, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadReport, listLowStockProducts } from '../api/api'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { CardStack } from '../components/ui/CardList'
import EmptyState from '../components/ui/EmptyState'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import ZoomableImage from '../components/ui/ZoomableImage'

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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-danger" size={20} />
          <h1 className="text-xl font-semibold text-ink">Produits en stock faible</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadReport('produits', 'pdf', { low_stock: 1 })}>
            <Download size={15} /> PDF
          </Button>
          <Button variant="outline" onClick={() => downloadReport('produits', 'csv', { low_stock: 1 })}>
            <Download size={15} /> CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : data?.results.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Aucun produit en stock faible" description="Tous les produits sont au-dessus de leur seuil d'alerte." />
      ) : (
        <>
          <CardStack>
            {data?.results.map((p) => (
              <Card key={p.product_id} className="flex items-center gap-3 p-3">
                {p.product_image ? (
                  <ZoomableImage src={p.product_image} alt={p.product_name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-ink-muted">
                    <Package size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{p.product_name}</p>
                  <p className="font-mono text-xs text-ink-muted">{p.product_id}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="danger">Stock: {p.product_quantity}</Badge>
                    <span className="text-xs text-ink-muted">seuil {p.low_stock_threshold}</span>
                  </div>
                </div>
                <Link
                  to="/approvioning"
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-border p-2 text-brand"
                >
                  <Truck size={16} />
                </Link>
              </Card>
            ))}
          </CardStack>

          <div className="hidden md:block">
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
          </div>

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
