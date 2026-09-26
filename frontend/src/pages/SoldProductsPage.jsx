import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, Download, Link2, Pencil, Printer, PlusCircle, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteSale,
  downloadReport,
  printReport,
  promoteSaleToProduct,
  salesForPeriod,
  updateSale,
} from '../api/api'
import { useAuth } from '../auth/AuthContext'
import CatalogProductModal from '../components/CatalogProductModal'
import EditSaleModal from '../components/EditSaleModal'
import ProductAutocomplete from '../components/ProductAutocomplete'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { CardStack, DataRow } from '../components/ui/CardList'
import EmptyState from '../components/ui/EmptyState'
import { Field, Input } from '../components/ui/Form'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { useConfirm } from '../confirm/ConfirmContext'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

// Local calendar day as YYYY-MM-DD (toISOString would give the UTC day).
const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDay(d)
}
const today = () => daysAgo(0)
const firstOfMonth = () => {
  const d = new Date()
  return isoDay(new Date(d.getFullYear(), d.getMonth(), 1))
}
const PRESETS = [
  { label: "Aujourd'hui", range: () => [today(), today()] },
  { label: 'Hier', range: () => [daysAgo(1), daysAgo(1)] },
  { label: '7 derniers jours', range: () => [daysAgo(6), today()] },
  { label: 'Ce mois', range: () => [firstOfMonth(), today()] },
]
// A date input reports partial keyboard entries as '' or years like 0002:
// only query once the day is complete and plausible.
const isCompleteDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '2000-01-01'
const formatDay = (value) => new Date(`${value}T00:00`).toLocaleDateString('fr-FR')

export default function SoldProductsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [start, setStart] = useState(today())
  const [end, setEnd] = useState(today())
  const [linkTarget, setLinkTarget] = useState(null)
  const [promoteTarget, setPromoteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const periodComplete = isCompleteDay(start) && isCompleteDay(end)
  const periodError = periodComplete && start > end ? 'La date de début doit être avant la date de fin.' : null
  const periodReady = periodComplete && !periodError
  const singleDay = start === end

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sales-daily', start, end],
    queryFn: () => salesForPeriod(start, end),
    enabled: periodReady,
    placeholderData: keepPreviousData,
  })

  // Sales move stock, so product lists must refresh too.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sales-daily'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['low-stock'] })
    queryClient.invalidateQueries({ queryKey: ['low-stock-count'] })
  }

  const canCancel = (sale) => user?.is_superuser || (!!user && sale.sold_by_username === user.username)

  const handleCancel = async (id) => {
    if (!(await confirm('Annuler cette vente ? Si elle est liée à un produit, la quantité sera remise en stock.'))) return
    try {
      await deleteSale(id)
      toast.success('Vente annulée.')
      invalidate()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handlePromoteSubmit = async (data) => {
    await promoteSaleToProduct(promoteTarget.id, data)
    toast.success('Produit créé à partir de la vente.')
    setPromoteTarget(null)
    invalidate()
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

  const runReport = async (action) => {
    try {
      await action({ start, end })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const applyPreset = (preset) => {
    const [from, to] = preset.range()
    setStart(from)
    setEnd(to)
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Ventes</h1>

      <Card className="mb-5 space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const [from, to] = preset.range()
            const active = start === from && end === to
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`rounded-full border px-3 py-1 text-xs font-medium cursor-pointer ${
                  active
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border text-ink-secondary hover:bg-ink/5'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          <Field label="Du">
            <Input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Au">
            <Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <div className="col-span-2 flex flex-wrap gap-2 sm:ml-auto">
            <Button onClick={() => runReport((range) => printReport('vente', range))} disabled={!periodReady}>
              <Printer size={15} /> Imprimer
            </Button>
            <Button
              variant="outline"
              onClick={() => runReport((range) => downloadReport('vente', 'pdf', range))}
              disabled={!periodReady}
            >
              <Download size={15} /> PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => runReport((range) => downloadReport('vente', 'csv', range))}
              disabled={!periodReady}
            >
              <Download size={15} /> CSV
            </Button>
          </div>
        </div>
        {periodError && <p className="text-xs text-danger">{periodError}</p>}
      </Card>

      {isLoading || !data ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <div className={`transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <p className="mb-3 text-sm font-medium text-ink-secondary">
            {singleDay ? `Le ${formatDay(start)}` : `Du ${formatDay(start)} au ${formatDay(end)}`}
            {' · '}
            {data.sales.length} vente{data.sales.length > 1 ? 's' : ''} · Total :{' '}
            <span className="text-lg font-semibold text-ink">{data.total} FCFA</span>
          </p>

          {data.sales.length === 0 ? (
            <EmptyState icon={Receipt} title={singleDay ? 'Aucune vente ce jour' : 'Aucune vente sur cette période'} />
          ) : (
            <>
              <CardStack>
                {data?.sales.map((s) => (
                  <Card key={s.id} className="p-3">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-ink">{s.product_name_display}</p>
                      <p className="shrink-0 font-semibold text-ink">{s.total_price} FCFA</p>
                    </div>
                    {!s.product && (
                      <Badge variant="warning" className="mb-1.5">
                        <AlertTriangle size={11} /> Produit non lié
                      </Badge>
                    )}
                    {!singleDay && <DataRow label="Date" value={formatDay(s.sell_date.slice(0, 10))} />}
                    <DataRow label="Client" value={s.customer_name || '-'} />
                    <DataRow label="Quantité" value={`${s.quantity} × ${s.unit_price}`} />
                    <DataRow label="Bénéfice" value={data.benefits[s.id] ? data.benefits[s.id][0].toFixed(0) : '-'} />
                    <DataRow label="Vendu par" value={s.sold_by_username || '-'} />
                    <div className="mt-2 flex justify-end gap-1.5 border-t border-border pt-2">
                      <Link
                        to={`/receipt/${s.id}`}
                        className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand"
                      >
                        <Printer size={15} />
                      </Link>
                      {user?.is_superuser && (
                        <button
                          type="button"
                          onClick={() => setEditTarget(s)}
                          title="Modifier la vente"
                          className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand cursor-pointer"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
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
                          onClick={() => setPromoteTarget(s)}
                          className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand cursor-pointer"
                        >
                          <PlusCircle size={15} />
                        </button>
                      )}
                      {canCancel(s) && (
                        <button
                          type="button"
                          onClick={() => handleCancel(s.id)}
                          title="Annuler la vente"
                          className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                        >
                          <Ban size={15} />
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </CardStack>

              <div className="hidden md:block">
                <Table>
                  <Thead>
                    {!singleDay && <Th>Date</Th>}
                    <Th>Produit</Th>
                    <Th>Client</Th>
                    <Th>Quantité</Th>
                    <Th>Prix Unitaire</Th>
                    <Th>Prix Total</Th>
                    <Th>Bénéfice</Th>
                    <Th>Vendu par</Th>
                    <Th></Th>
                  </Thead>
                  <Tbody>
                    {data?.sales.map((s) => (
                      <Tr key={s.id}>
                        {!singleDay && <Td>{formatDay(s.sell_date.slice(0, 10))}</Td>}
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="truncate">{s.product_name_display}</span>
                            {!s.product && (
                              <Badge variant="warning" className="shrink-0">
                                <AlertTriangle size={11} /> Non lié
                              </Badge>
                            )}
                          </div>
                        </Td>
                        <Td>{s.customer_name || '-'}</Td>
                        <Td>{s.quantity}</Td>
                        <Td>{s.unit_price}</Td>
                        <Td>{s.total_price}</Td>
                        <Td>{data.benefits[s.id] ? data.benefits[s.id][0].toFixed(0) : '-'}</Td>
                        <Td>{s.sold_by_username || '-'}</Td>
                        <Td>
                          <div className="flex justify-end gap-1.5">
                            <Link
                              to={`/receipt/${s.id}`}
                              title="Imprimer le ticket"
                              className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand"
                            >
                              <Printer size={15} />
                            </Link>
                            {user?.is_superuser && (
                              <button
                                type="button"
                                onClick={() => setEditTarget(s)}
                                title="Modifier la vente"
                                className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand cursor-pointer"
                              >
                                <Pencil size={15} />
                              </button>
                            )}
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
                                onClick={() => setPromoteTarget(s)}
                                title="Ajouter au catalogue"
                                className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand cursor-pointer"
                              >
                                <PlusCircle size={15} />
                              </button>
                            )}
                            {canCancel(s) && (
                              <button
                                type="button"
                                onClick={() => handleCancel(s.id)}
                                title="Annuler la vente"
                                className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                              >
                                <Ban size={15} />
                              </button>
                            )}
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
      )}

      <Modal
        open={!!linkTarget}
        onClose={() => setLinkTarget(null)}
        title={`Associer "${linkTarget?.product_name_display}" à un produit du catalogue`}
      >
        <p className="mb-3 text-xs text-ink-muted">
          Recherche le produit déjà enregistré correspondant à cette vente. Cela mettra aussi à jour
          le calcul de bénéfice de cette vente, et la quantité vendue sera retirée de son stock.
        </p>
        <ProductAutocomplete
          placeholder="Tape le nom ou le code du produit..."
          onSelect={handleLinkProduct}
          autoFocus
        />
      </Modal>

      <EditSaleModal
        sale={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null)
          invalidate()
        }}
      />

      <CatalogProductModal
        open={!!promoteTarget}
        onClose={() => setPromoteTarget(null)}
        onSubmit={handlePromoteSubmit}
        initialName={promoteTarget?.product_name_display || ''}
        description="Cette vente ne correspond à aucun produit enregistré. Renseigne les détails pour créer le produit ; toutes les ventes portant ce même nom y seront rattachées."
        imageHint="Laisse vide pour garder l'image de la vente, si elle en a une."
      />
    </div>
  )
}
