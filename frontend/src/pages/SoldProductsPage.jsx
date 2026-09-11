import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, PlusCircle, Receipt, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { dailySales, deleteSale, downloadReport, promoteSaleToProduct } from '../api/api'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { Input } from '../components/ui/Form'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { useConfirm } from '../confirm/ConfirmContext'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

const today = () => new Date().toISOString().slice(0, 10)

export default function SoldProductsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [date, setDate] = useState(today())

  const { data, isLoading } = useQuery({
    queryKey: ['sales-daily', date],
    queryFn: () => dailySales(date),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sales-daily'] })

  const handleDelete = async (id) => {
    if (!(await confirm('Supprimer cette vente ?'))) return
    try {
      await deleteSale(id)
      toast.success('Vente supprimée.')
      invalidate()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handlePromote = async (id) => {
    try {
      await promoteSaleToProduct(id)
      toast.success('Produit créé à partir de la vente.')
      invalidate()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Ventes</h1>
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button variant="outline" onClick={() => downloadReport('vente', 'pdf')}>
            <Download size={15} /> PDF
          </Button>
          <Button variant="outline" onClick={() => downloadReport('vente', 'csv')}>
            <Download size={15} /> CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <>
          <p className="mb-3 text-sm font-medium text-ink-secondary">
            Total du jour : <span className="text-lg font-semibold text-ink">{data?.total} FCFA</span>
          </p>

          {data?.sales.length === 0 ? (
            <EmptyState icon={Receipt} title="Aucune vente ce jour" />
          ) : (
            <Table>
              <Thead>
                <Th>Produit</Th>
                <Th>Client</Th>
                <Th>Quantité</Th>
                <Th>Prix Unitaire</Th>
                <Th>Prix Total</Th>
                <Th>Bénéfice</Th>
                <Th></Th>
              </Thead>
              <Tbody>
                {data?.sales.map((s) => (
                  <Tr key={s.id}>
                    <Td>{s.product_name_display}</Td>
                    <Td>{s.customer_name || '-'}</Td>
                    <Td>{s.quantity}</Td>
                    <Td>{s.unit_price}</Td>
                    <Td>{s.total_price}</Td>
                    <Td>{data.benefits[s.id] ? data.benefits[s.id][0].toFixed(0) : '-'}</Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        {!s.product && (
                          <button
                            type="button"
                            onClick={() => handlePromote(s.id)}
                            title="Ajouter au catalogue"
                            className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand cursor-pointer"
                          >
                            <PlusCircle size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id)}
                          className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </>
      )}
    </div>
  )
}
