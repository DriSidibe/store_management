import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Link2, Printer, PlusCircle, Receipt, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dailySales, deleteSale, downloadReport, promoteSaleToProduct, updateSale } from '../api/api'
import ProductAutocomplete from '../components/ProductAutocomplete'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { CardStack, DataRow } from '../components/ui/CardList'
import EmptyState from '../components/ui/EmptyState'
import { Input } from '../components/ui/Form'
import Modal from '../components/ui/Modal'
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
  const [linkTarget, setLinkTarget] = useState(null)

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

  const handleLinkProduct = async (product) => {
    try {
      await updateSale(linkTarget.id, { product: product.id })
      toast.success(`Vente associée à ${product.product_name}.`)
      setLinkTarget(null)
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
            <>
              <CardStack>
                {data?.sales.map((s) => (
                  <Card key={s.id} className="p-3">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-ink">{s.product_name_display}</p>
                      <p className="shrink-0 font-semibold text-ink">{s.total_price} FCFA</p>
                    </div>
                    <DataRow label="Client" value={s.customer_name || '-'} />
                    <DataRow label="Quantité" value={`${s.quantity} × ${s.unit_price}`} />
                    <DataRow label="Bénéfice" value={data.benefits[s.id] ? data.benefits[s.id][0].toFixed(0) : '-'} />
                    <div className="mt-2 flex justify-end gap-1.5 border-t border-border pt-2">
                      <Link
                        to={`/receipt/${s.id}`}
                        className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand"
                      >
                        <Printer size={15} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setLinkTarget(s)}
                        title="Associer à un produit du catalogue"
                        className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand cursor-pointer"
                      >
                        <Link2 size={15} />
                      </button>
                      {!s.product && (
                        <button
                          type="button"
                          onClick={() => handlePromote(s.id)}
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
                  </Card>
                ))}
              </CardStack>

              <div className="hidden md:block">
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
                            <Link
                              to={`/receipt/${s.id}`}
                              title="Imprimer le ticket"
                              className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand"
                            >
                              <Printer size={15} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setLinkTarget(s)}
                              title="Associer à un produit du catalogue"
                              className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand cursor-pointer"
                            >
                              <Link2 size={15} />
                            </button>
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
              </div>
            </>
          )}
        </>
      )}

      <Modal
        open={!!linkTarget}
        onClose={() => setLinkTarget(null)}
        title={`Associer "${linkTarget?.product_name_display}" à un produit du catalogue`}
      >
        <p className="mb-3 text-xs text-ink-muted">
          Recherche le produit déjà enregistré correspondant à cette vente. Cela mettra aussi à jour
          le calcul de bénéfice de cette vente.
        </p>
        <ProductAutocomplete
          placeholder="Tape le nom ou le code du produit..."
          onSelect={handleLinkProduct}
          autoFocus
        />
      </Modal>
    </div>
  )
}
