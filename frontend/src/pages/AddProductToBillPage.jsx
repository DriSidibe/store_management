import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addBillItem, getProduct, listBillItems } from '../api/api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Field, Input } from '../components/ui/Form'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { extractErrorMessage } from '../toast/ToastContext'

export default function AddProductToBillPage() {
  const { billId } = useParams()
  const queryClient = useQueryClient()

  const { data: items } = useQuery({
    queryKey: ['bill-items', billId],
    queryFn: () => listBillItems(billId),
  })

  const [productId, setProductId] = useState('')
  const [product, setProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleLookup = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const p = await getProduct(productId.toUpperCase())
      setProduct(p)
    } catch {
      setProduct(null)
      setError('Produit introuvable.')
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await addBillItem(billId, product.product_id, quantity)
      setProduct(null)
      setProductId('')
      setQuantity(1)
      queryClient.invalidateQueries({ queryKey: ['bill-items', billId] })
    } catch (err) {
      setError(extractErrorMessage(err, 'No sufficient products in the stock!'))
    } finally {
      setSubmitting(false)
    }
  }

  const total = items?.reduce((sum, i) => sum + i.total, 0) ?? 0

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Ajouter des produits à la facture</h1>

      <Card className="mb-6 max-w-md">
        <form className="space-y-4" onSubmit={product ? handleAdd : handleLookup}>
          <Field label="Code produit">
            <Input
              className="uppercase"
              value={productId}
              onChange={(e) => { setProductId(e.target.value); setProduct(null) }}
              required
            />
          </Field>
          {product && (
            <>
              <p className="text-sm text-ink-secondary">
                {product.product_name} - {product.product_sp} FCFA (stock: {product.product_quantity})
              </p>
              <Field label="Quantité">
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              </Field>
            </>
          )}
          {error && (
            <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}
          <Button type="submit" disabled={submitting}>
            {product ? (submitting ? 'Ajout...' : 'Ajouter') : 'Rechercher'}
          </Button>
        </form>
      </Card>

      <Table>
        <Thead><Th>Produit</Th><Th>Quantité</Th><Th>Prix</Th><Th>Total</Th></Thead>
        <Tbody>
          {items?.map((i) => (
            <Tr key={i.id}>
              <Td>{i.product_name}</Td>
              <Td>{i.quantity}</Td>
              <Td>{i.product_sp}</Td>
              <Td>{i.total}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <p className="mt-3 text-sm font-semibold text-ink">Total : {total} FCFA</p>
      <Link
        to={`/final-bill/${billId}`}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-ink-secondary hover:bg-ink/5"
      >
        Voir la facture finale <ArrowRight size={15} />
      </Link>
    </div>
  )
}
