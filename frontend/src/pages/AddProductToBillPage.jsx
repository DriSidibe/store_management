import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addBillItem, listBillItems } from '../api/api'
import ProductAutocomplete from '../components/ProductAutocomplete'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { CardStack } from '../components/ui/CardList'
import { Field, Input } from '../components/ui/Form'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { extractErrorMessage } from '../toast/ToastContext'
import ZoomableImage from '../components/ui/ZoomableImage'

export default function AddProductToBillPage() {
  const { billId } = useParams()
  const queryClient = useQueryClient()

  const { data: items } = useQuery({
    queryKey: ['bill-items', billId],
    queryFn: () => listBillItems(billId),
  })

  const [product, setProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await addBillItem(billId, product.product_id, quantity)
      setProduct(null)
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
        {product ? (
          <form className="space-y-4" onSubmit={handleAdd}>
            <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
              {product.product_image ? (
                <ZoomableImage src={product.product_image} alt={product.product_name} className="h-10 w-10 rounded-md object-cover" />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-md bg-ink/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{product.product_name}</p>
                <p className="text-xs text-ink-muted">{product.product_sp} FCFA · stock {product.product_quantity}</p>
              </div>
              <button
                type="button"
                onClick={() => setProduct(null)}
                className="shrink-0 rounded-lg p-1.5 text-ink-secondary hover:bg-ink/5 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <Field label="Quantité">
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </Field>
            {error && (
              <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Ajout...' : 'Ajouter'}
            </Button>
          </form>
        ) : (
          <Field label="Produit">
            <ProductAutocomplete placeholder="Tape le nom ou le code du produit..." onSelect={setProduct} autoFocus />
          </Field>
        )}
      </Card>

      <CardStack>
        {items?.map((i) => (
          <Card key={i.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium text-ink">{i.product_name}</p>
              <p className="text-xs text-ink-muted">{i.quantity} × {i.product_sp} FCFA</p>
            </div>
            <p className="font-semibold text-ink">{i.total} FCFA</p>
          </Card>
        ))}
      </CardStack>

      <div className="hidden md:block">
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
      </div>

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
