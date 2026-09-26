import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Link2, Printer, PlusCircle, Receipt, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  dailySales,
  deleteSale,
  downloadReport,
  listShelves,
  listUnits,
  printReport,
  promoteSaleToProduct,
  updateSale,
} from '../api/api'
import CategorySelect from '../components/CategorySelect'
import ProductAutocomplete from '../components/ProductAutocomplete'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { CardStack, DataRow } from '../components/ui/CardList'
import EmptyState from '../components/ui/EmptyState'
import { Field, Input, Select, Textarea } from '../components/ui/Form'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { useConfirm } from '../confirm/ConfirmContext'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

const today = () => new Date().toISOString().slice(0, 10)

const initialPromoteForm = {
  product_id_etg: '',
  product_id_cas: '',
  product_name: '',
  product_description: '',
  product_unity: '',
  category: '',
  product_quantity: 1,
  product_company: '',
  product_cp: 1,
  product_sp: 1,
  low_stock_threshold: 5,
}

export default function SoldProductsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [date, setDate] = useState(today())
  const [periodStart, setPeriodStart] = useState(today())
  const [periodEnd, setPeriodEnd] = useState(today())
  const [linkTarget, setLinkTarget] = useState(null)
  const [promoteTarget, setPromoteTarget] = useState(null)
  const [promoteForm, setPromoteForm] = useState(initialPromoteForm)
  const [promoteImage, setPromoteImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-daily', date],
    queryFn: () => dailySales(date),
  })
  const { data: shelves } = useQuery({ queryKey: ['shelves'], queryFn: listShelves })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: listUnits })

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

  const openPromoteModal = (sale) => {
    setPromoteTarget(sale)
    setPromoteForm({ ...initialPromoteForm, product_name: sale.product_name_display || '' })
    setPromoteImage(null)
  }

  const setPromoteField = (field) => (e) => setPromoteForm({ ...promoteForm, [field]: e.target.value })

  const handlePromoteSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await promoteSaleToProduct(promoteTarget.id, { ...promoteForm, product_image: promoteImage })
      toast.success('Produit créé à partir de la vente.')
      setPromoteTarget(null)
      invalidate()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Les informations sont incomplètes.'))
    } finally {
      setSubmitting(false)
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

  const handlePrintPeriod = async () => {
    try {
      await printReport('vente', { start: periodStart, end: periodEnd })
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
          <Button variant="outline" onClick={() => downloadReport('vente', 'pdf', { start: date, end: date })}>
            <Download size={15} /> PDF
          </Button>
          <Button variant="outline" onClick={() => downloadReport('vente', 'csv', { start: date, end: date })}>
            <Download size={15} /> CSV
          </Button>
        </div>
      </div>

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-3">
        <Field label="Du">
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </Field>
        <Field label="Au">
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </Field>
        <Button onClick={handlePrintPeriod}>
          <Printer size={15} /> Imprimer la période
        </Button>
        <Button variant="outline" onClick={() => downloadReport('vente', 'csv', { start: periodStart, end: periodEnd })}>
          <Download size={15} /> CSV
        </Button>
      </Card>

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
                    {!s.product && (
                      <Badge variant="warning" className="mb-1.5">
                        <AlertTriangle size={11} /> Produit non lié
                      </Badge>
                    )}
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
                          onClick={() => openPromoteModal(s)}
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
                    <Th>Vendu par</Th>
                    <Th></Th>
                  </Thead>
                  <Tbody>
                    {data?.sales.map((s) => (
                      <Tr key={s.id}>
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
                                onClick={() => openPromoteModal(s)}
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

      <Modal
        open={!!promoteTarget}
        onClose={() => setPromoteTarget(null)}
        title="Ajouter ce produit au catalogue"
        size="lg"
      >
        <p className="mb-3 text-xs text-ink-muted">
          Cette vente ne correspond à aucun produit enregistré. Renseigne les détails pour créer le
          produit ; toutes les ventes portant ce même nom y seront rattachées.
        </p>
        <form className="space-y-4" onSubmit={handlePromoteSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Étagère">
              <Select value={promoteForm.product_id_etg} onChange={setPromoteField('product_id_etg')} required>
                <option value="">-- Sélectionner --</option>
                {shelves?.results?.map((sh) => (
                  <option key={sh.id} value={sh.name}>{sh.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Casier">
              <Input value={promoteForm.product_id_cas} onChange={setPromoteField('product_id_cas')} required />
            </Field>
          </div>

          <Field label="Nom du produit">
            <Input value={promoteForm.product_name} onChange={setPromoteField('product_name')} required />
          </Field>

          <Field label="Description">
            <Textarea rows={2} value={promoteForm.product_description} onChange={setPromoteField('product_description')} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Unité">
              <Select value={promoteForm.product_unity} onChange={setPromoteField('product_unity')} required>
                <option value="">-- Sélectionner --</option>
                {units?.results?.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Société">
              <Input value={promoteForm.product_company} onChange={setPromoteField('product_company')} />
            </Field>
          </div>

          <CategorySelect value={promoteForm.category} onChange={setPromoteField('category')} required />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantité">
              <Input type="number" min="0" value={promoteForm.product_quantity} onChange={setPromoteField('product_quantity')} required />
            </Field>
            <Field label="Prix d'achat">
              <Input type="number" step="0.01" min="0" value={promoteForm.product_cp} onChange={setPromoteField('product_cp')} required />
            </Field>
            <Field label="Prix de vente">
              <Input type="number" step="0.01" min="0" value={promoteForm.product_sp} onChange={setPromoteField('product_sp')} required />
            </Field>
            <Field label="Seuil stock faible">
              <Input type="number" min="0" value={promoteForm.low_stock_threshold} onChange={setPromoteField('low_stock_threshold')} />
            </Field>
          </div>

          <Field label="Image" hint="Laisse vide pour garder l'image de la vente, si elle en a une.">
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand/20"
              onChange={(e) => setPromoteImage(e.target.files[0])}
            />
          </Field>

          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Création...' : 'Créer le produit'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
