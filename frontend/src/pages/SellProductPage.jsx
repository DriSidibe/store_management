import { Printer } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import SaleForm from '../components/SaleForm'
import Card from '../components/ui/Card'

export default function SellProductPage() {
  const [lastSaleId, setLastSaleId] = useState(null)

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Vendre un produit</h1>

      {lastSaleId && (
        <div className="mb-4 flex max-w-xl items-center justify-between rounded-lg border border-success/20 bg-success/10 px-4 py-2.5 text-sm text-success-text">
          Vente enregistrée.
          <Link to={`/receipt/${lastSaleId}`} className="flex items-center gap-1.5 font-medium hover:underline">
            <Printer size={14} /> Imprimer le ticket
          </Link>
        </div>
      )}

      <Card className="max-w-xl">
        <SaleForm onSold={(sale) => setLastSaleId(sale.id)} />
      </Card>
    </div>
  )
}
