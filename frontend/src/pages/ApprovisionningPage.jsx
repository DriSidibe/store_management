import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, X } from 'lucide-react'
import { useState } from 'react'
import {
  createRavitaillement, createSupplierEntrance, deleteRavitaillement, downloadReport,
  listRavitaillement, listSupplierEntrances, productsLookup, promoteRavitaillementToProduct,
} from '../api/api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Form'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

const today = () => new Date().toISOString().slice(0, 10)
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

  const handlePromote = async (id) => {
    try {
      await promoteRavitaillementToProduct(id)
      toast.success('Opération éffectuée avec succès !')
      queryClient.invalidateQueries({ queryKey: ['ravitaillement'] })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
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
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Demander un approvisionnement</h2>
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
                          onClick={() => handlePromote(r.id)}
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
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Ajouter une entrée fournisseur</h2>
            <form className="space-y-4" onSubmit={handleAddEntrance}>
              <Field label="Nom du fournisseur">
                <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
              </Field>
              <Field label="Téléphone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Date">
                <Input type="date" value={entranceDate} onChange={(e) => setEntranceDate(e.target.value)} />
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
          </Card>
        </div>
      </div>
    </div>
  )
}
