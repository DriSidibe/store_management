import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, X } from 'lucide-react'
import { useState } from 'react'
import {
  createRavitaillement, createSupplierEntrance, deleteRavitaillement, downloadReport,
  listRavitaillement, listSupplierEntrances, productsLookup, promoteRavitaillementToProduct,
  restockProduct,
} from '../api/api'
import CatalogProductModal from '../components/CatalogProductModal'
import ProductAutocomplete from '../components/ProductAutocomplete'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { CardStack } from '../components/ui/CardList'
import { Field, Input, RequiredLegend, Select } from '../components/ui/Form'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

const today = () => new Date().toISOString().slice(0, 10)
// The ordered quantity is free text ("5", "1 paquet"...): use its leading number, if any.
const orderedUnits = (rav) => {
  const n = parseInt(rav?.commanded_quantity, 10)
  return Number.isNaN(n) ? undefined : n
}
// Same rule as the backend (stock.restock): weighted average of the stock on
// hand and the new units; an empty or negative stock takes the new price.
const averageCost = (product, quantity, unitCost) => {
  const onHand = Math.max(product.product_quantity, 0)
  return Math.round(((onHand * product.product_cp + quantity * unitCost) / (onHand + quantity)) * 100) / 100
}
// Selling price that keeps the product's current margin rate on its new
// average cost (e.g. bought 1000 / sold 1500 -> sold 1.5 x the new cost),
// rounded to the franc. Without a cost to compare to, the current price.
const suggestedSellingPrice = (product, newCost) =>
  product.product_cp > 0 ? Math.round((newCost * product.product_sp) / product.product_cp) : product.product_sp
const fileInputClass =
  'block w-full text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand/20'

export default function ApprovisionningPage() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: ravitaillement } = useQuery({ queryKey: ['ravitaillement'], queryFn: listRavitaillement })
  const { data: entrances } = useQuery({ queryKey: ['supplier-entrances'], queryFn: listSupplierEntrances })
  const { data: products } = useQuery({ queryKey: ['products-lookup'], queryFn: productsLookup })

  const [pk, setPk] = useState('-')
  const [productName, setProductName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [ravImage, setRavImage] = useState(null)
  const [submittingRav, setSubmittingRav] = useState(false)
  const [promoteTarget, setPromoteTarget] = useState(null)
  const [receiveTarget, setReceiveTarget] = useState(null)
  const [receivedQuantity, setReceivedQuantity] = useState('')
  const [receivedUnitCost, setReceivedUnitCost] = useState('')
  const [receiving, setReceiving] = useState(false)

  const [restockTarget, setRestockTarget] = useState(null)
  const [restockQuantity, setRestockQuantity] = useState('')
  const [restockUnitCost, setRestockUnitCost] = useState('')
  // null until the user types in the field: it then shows the suggestion.
  const [restockSellingPrice, setRestockSellingPrice] = useState(null)
  const [restocking, setRestocking] = useState(false)
  const restockPreview =
    restockTarget && Number(restockQuantity) > 0 && restockUnitCost !== ''
      ? averageCost(restockTarget, Number(restockQuantity), Number(restockUnitCost))
      : null
  const sellingPriceField =
    restockSellingPrice ?? (restockPreview !== null ? String(suggestedSellingPrice(restockTarget, restockPreview)) : '')
  // Profit per unit with the selling price that will apply: the one in the
  // field, or the current one if the field is emptied.
  const newUnitProfit =
    restockPreview !== null
      ? Math.round(((sellingPriceField === '' ? restockTarget.product_sp : Number(sellingPriceField)) - restockPreview) * 100) / 100
      : null

  const selectRestockTarget = (product) => {
    setRestockTarget(product)
    setRestockSellingPrice(null)
  }

  const [supplierName, setSupplierName] = useState('')
  const [phone, setPhone] = useState('')
  const [entranceDate, setEntranceDate] = useState(today())
  const [entranceImage, setEntranceImage] = useState(null)
  const [submittingEntrance, setSubmittingEntrance] = useState(false)

  const handleAddRav = async (e) => {
    e.preventDefault()
    setSubmittingRav(true)
    try {
      await createRavitaillement({
        product: pk !== '-' ? pk : undefined,
        product_name: pk === '-' ? productName : undefined,
        commanded_quantity: quantity,
        image: pk === '-' ? ravImage : undefined,
      })
      toast.success('Approvisionnement enregistré avec succès !')
      setPk('-')
      setProductName('')
      setQuantity('')
      setRavImage(null)
      e.target.reset()
      queryClient.invalidateQueries({ queryKey: ['ravitaillement'] })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmittingRav(false)
    }
  }

  const refreshStock = () => {
    queryClient.invalidateQueries({ queryKey: ['ravitaillement'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['products-lookup'] })
    queryClient.invalidateQueries({ queryKey: ['low-stock'] })
    queryClient.invalidateQueries({ queryKey: ['low-stock-count'] })
  }

  // Receiving a product already in the catalog asks how many units arrived and
  // adds them to its stock; a new product first needs its catalog details.
  const handleReceive = (rav) => {
    if (!rav.product) {
      setPromoteTarget(rav)
      return
    }
    setReceivedQuantity(orderedUnits(rav) ?? '')
    setReceivedUnitCost('')
    setReceiveTarget(rav)
  }

  const handleReceiveSubmit = async (e) => {
    e.preventDefault()
    setReceiving(true)
    try {
      await promoteRavitaillementToProduct(receiveTarget.id, {
        received_quantity: receivedQuantity,
        unit_cost: Number(receivedQuantity) > 0 ? receivedUnitCost : undefined,
      })
      toast.success(`Approvisionnement réceptionné : +${receivedQuantity} en stock.`)
      setReceiveTarget(null)
      refreshStock()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setReceiving(false)
    }
  }

  const handleRestockSubmit = async (e) => {
    e.preventDefault()
    setRestocking(true)
    try {
      const product = await restockProduct(restockTarget.product_id, {
        quantity: restockQuantity,
        unit_cost: restockUnitCost,
        selling_price: sellingPriceField,
      })
      toast.success(
        `${product.product_name} : +${restockQuantity} en stock, prix d'achat ${product.product_cp} FCFA, ` +
          `prix de vente ${product.product_sp} FCFA.`
      )
      setRestockTarget(null)
      setRestockQuantity('')
      setRestockUnitCost('')
      setRestockSellingPrice(null)
      refreshStock()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setRestocking(false)
    }
  }

  const handlePromoteSubmit = async (data) => {
    await promoteRavitaillementToProduct(promoteTarget.id, data)
    toast.success('Produit ajouté au catalogue.')
    setPromoteTarget(null)
    refreshStock()
  }

  const handleDelete = async (id) => {
    try {
      await deleteRavitaillement(id)
      toast.success('Opération éffectuée avec succès !')
      queryClient.invalidateQueries({ queryKey: ['ravitaillement'] })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handleAddEntrance = async (e) => {
    e.preventDefault()
    setSubmittingEntrance(true)
    try {
      await createSupplierEntrance({
        supplier_name: supplierName,
        Suppler_tel: phone,
        date: entranceDate,
        image: entranceImage,
      })
      toast.success('Entré enregistré avec succès !')
      setSupplierName('')
      setPhone('')
      setEntranceDate(today())
      setEntranceImage(null)
      e.target.reset()
      queryClient.invalidateQueries({ queryKey: ['supplier-entrances'] })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmittingEntrance(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Approvisionnement</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadReport('commande', 'pdf')}>
            <Download size={15} /> PDF
          </Button>
          <Button variant="outline" onClick={() => downloadReport('commande', 'csv')}>
            <Download size={15} /> CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Ravitailler un produit</h2>
            {!restockTarget ? (
              <Field label="Produit">
                <ProductAutocomplete placeholder="Tape le nom ou le code du produit..." onSelect={selectRestockTarget} />
              </Field>
            ) : (
              <form className="space-y-4" onSubmit={handleRestockSubmit}>
                <div className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{restockTarget.product_name}</p>
                    <p className="text-xs text-ink-muted">
                      Stock : {restockTarget.product_quantity} · Prix d'achat : {restockTarget.product_cp} FCFA · Prix de vente : {restockTarget.product_sp} FCFA
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectRestockTarget(null)}
                    title="Changer de produit"
                    className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
                <RequiredLegend className="-mt-1" />
                <Field label="Quantité reçue">
                  <Input type="number" min="1" value={restockQuantity} onChange={(e) => setRestockQuantity(e.target.value)} autoFocus required />
                </Field>
                <Field label="Prix d'achat unitaire (FCFA)">
                  <Input type="number" step="0.01" min="0" value={restockUnitCost} onChange={(e) => setRestockUnitCost(e.target.value)} required />
                </Field>
                {restockPreview !== null && (
                  <>
                    <div className="space-y-1 rounded-lg bg-ink/5 p-3 text-xs text-ink-muted">
                      <p>
                        Nouveau prix d'achat moyen : <span className="font-semibold text-ink">{restockPreview} FCFA</span>
                      </p>
                      <p>
                        Bénéfice par unité : {Math.round((restockTarget.product_sp - restockTarget.product_cp) * 100) / 100} →{' '}
                        <span className={`font-semibold ${newUnitProfit < 0 ? 'text-danger' : 'text-ink'}`}>{newUnitProfit} FCFA</span>
                      </p>
                    </div>
                    <Field
                      label="Nouveau prix de vente (FCFA)"
                      hint={`Proposé pour garder la même marge en pourcentage. Vide ce champ pour garder le prix actuel (${restockTarget.product_sp} FCFA).`}
                    >
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sellingPriceField}
                        onChange={(e) => setRestockSellingPrice(e.target.value)}
                      />
                    </Field>
                  </>
                )}
                <Button type="submit" disabled={restocking}>
                  {restocking ? 'Enregistrement...' : 'Ajouter au stock'}
                </Button>
              </form>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Demander un approvisionnement</h2>
            <RequiredLegend className="-mt-1 mb-3" />
            <form className="space-y-4" onSubmit={handleAddRav}>
              <Field label="Produit existant">
                <Select value={pk} onChange={(e) => setPk(e.target.value)}>
                  <option value="-">-- Nouveau produit --</option>
                  {products && Object.entries(products).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </Select>
              </Field>
              {pk === '-' && (
                <Field label="Nom du nouveau produit">
                  <Input value={productName} onChange={(e) => setProductName(e.target.value)} required />
                </Field>
              )}
              <Field label="Quantité commandée">
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              </Field>
              {pk === '-' && (
                <Field label="Image (optionnel)">
                  <input type="file" accept="image/*" className={fileInputClass} onChange={(e) => setRavImage(e.target.files[0])} />
                </Field>
              )}
              <Button type="submit" disabled={submittingRav}>
                {submittingRav ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">En attente d'approvisionnement</h2>

            <CardStack>
              {ravitaillement?.results?.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.product_name_display}</p>
                    <p className="text-xs text-ink-muted">Quantité : {r.commanded_quantity}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleReceive(r)}
                      className="rounded-lg p-1.5 text-ink-secondary hover:bg-success/10 hover:text-success-text cursor-pointer"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {ravitaillement?.results?.length === 0 && (
                <p className="text-center text-sm text-ink-muted">Rien en attente.</p>
              )}
            </CardStack>

            <div className="hidden md:block">
              <Table>
                <Thead><Th>Produit</Th><Th>Quantité</Th><Th></Th></Thead>
                <Tbody>
                  {ravitaillement?.results?.map((r) => (
                    <Tr key={r.id}>
                      <Td>{r.product_name_display}</Td>
                      <Td>{r.commanded_quantity}</Td>
                      <Td>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleReceive(r)}
                            title="Réceptionner"
                            className="rounded-lg p-1.5 text-ink-secondary hover:bg-success/10 hover:text-success-text cursor-pointer"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            title="Annuler"
                            className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                  {ravitaillement?.results?.length === 0 && (
                    <Tr><Td colSpan={3} className="text-center text-ink-muted">Rien en attente.</Td></Tr>
                  )}
                </Tbody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Ajouter une entrée fournisseur</h2>
            <RequiredLegend className="-mt-1 mb-3" />
            <form className="space-y-4" onSubmit={handleAddEntrance}>
              <Field label="Nom du fournisseur">
                <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
              </Field>
              <Field label="Téléphone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Date">
                <Input type="date" value={entranceDate} onChange={(e) => setEntranceDate(e.target.value)} required />
              </Field>
              <Field label="Image (optionnel)">
                <input type="file" accept="image/*" className={fileInputClass} onChange={(e) => setEntranceImage(e.target.files[0])} />
              </Field>
              <Button type="submit" disabled={submittingEntrance}>
                {submittingEntrance ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Entrées fournisseurs</h2>

            <CardStack>
              {entrances?.results?.map((en) => (
                <div key={en.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-ink">{en.supplier_name}</p>
                  <p className="text-xs text-ink-muted">{en.Suppler_tel || '-'}</p>
                  <p className="text-xs text-ink-muted">{new Date(en.date).toLocaleDateString()}</p>
                </div>
              ))}
              {entrances?.results?.length === 0 && (
                <p className="text-center text-sm text-ink-muted">Aucune entrée.</p>
              )}
            </CardStack>

            <div className="hidden md:block">
              <Table>
                <Thead><Th>Fournisseur</Th><Th>Téléphone</Th><Th>Date</Th></Thead>
                <Tbody>
                  {entrances?.results?.map((en) => (
                    <Tr key={en.id}>
                      <Td>{en.supplier_name}</Td>
                      <Td>{en.Suppler_tel}</Td>
                      <Td>{new Date(en.date).toLocaleDateString()}</Td>
                    </Tr>
                  ))}
                  {entrances?.results?.length === 0 && (
                    <Tr><Td colSpan={3} className="text-center text-ink-muted">Aucune entrée.</Td></Tr>
                  )}
                </Tbody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={!!receiveTarget}
        onClose={() => setReceiveTarget(null)}
        title={`Réceptionner « ${receiveTarget?.product_name_display || ''} »`}
      >
        <form className="space-y-4" onSubmit={handleReceiveSubmit}>
          <p className="text-xs text-ink-muted">
            Quantité commandée : {receiveTarget?.commanded_quantity || '-'}. Indique le nombre
            d'unités effectivement reçues et leur prix d'achat : elles seront ajoutées au stock et
            le prix d'achat du produit deviendra la moyenne pondérée avec le stock existant.
          </p>
          <Field label="Quantité reçue">
            <Input
              type="number"
              min="0"
              value={receivedQuantity}
              onChange={(e) => setReceivedQuantity(e.target.value)}
              autoFocus
              required
            />
          </Field>
          {Number(receivedQuantity) > 0 && (
            <Field label="Prix d'achat unitaire (FCFA)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={receivedUnitCost}
                onChange={(e) => setReceivedUnitCost(e.target.value)}
                required
              />
            </Field>
          )}
          <Button type="submit" disabled={receiving} className="w-full sm:w-auto">
            {receiving ? 'Enregistrement...' : 'Ajouter au stock'}
          </Button>
        </form>
      </Modal>

      <CatalogProductModal
        open={!!promoteTarget}
        onClose={() => setPromoteTarget(null)}
        onSubmit={handlePromoteSubmit}
        initialName={promoteTarget?.product_name_display || ''}
        initialQuantity={orderedUnits(promoteTarget)}
        description="Ce produit n'est pas encore au catalogue. Renseigne ses détails pour le créer ; la demande d'approvisionnement sera ensuite clôturée."
        imageHint="Laisse vide pour garder l'image de la demande, si elle en a une."
      />
    </div>
  )
}
