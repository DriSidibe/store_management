import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { finalizeBill } from '../api/api'

export default function FinalBillPage() {
  const { billId } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['bill-finalize', billId],
    queryFn: () => finalizeBill(billId),
  })

  if (isLoading) return <p className="text-sm text-ink-muted">Chargement...</p>

  return (
    <div>
      <div className="no-print mb-4">
        <Button onClick={() => window.print()}>
          <Printer size={15} /> Imprimer
        </Button>
      </div>
      <Card className="max-w-2xl">
        <h1 className="text-lg font-semibold text-ink">Facture</h1>
        <p className="mb-4 text-sm text-ink-muted">
          Client : {data.bill.customer_name} — {new Date(data.bill.date_created).toLocaleString()}
        </p>
        <Table>
          <Thead><Th>Produit</Th><Th>Quantité</Th><Th>Prix Unitaire</Th><Th>Total</Th></Thead>
          <Tbody>
            {data.items.map((i) => (
              <Tr key={i.id}>
                <Td>{i.product_name}</Td>
                <Td>{i.quantity}</Td>
                <Td>{i.product_sp}</Td>
                <Td>{i.total}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <p className="mt-4 text-right text-lg font-semibold text-ink">
          Total Général : {data.grand_total} FCFA
        </p>
      </Card>
    </div>
  )
}
