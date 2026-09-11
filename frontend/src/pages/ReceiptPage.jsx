import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getSale } from '../api/api'
import Button from '../components/ui/Button'

export default function ReceiptPage() {
  const { saleId } = useParams()
  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => getSale(saleId),
  })

  if (isLoading) return <p className="p-6 text-sm text-ink-muted">Chargement...</p>

  return (
    <div className="min-h-screen bg-page p-4">
      {/* Scoped to this page only, so it doesn't affect A4 invoice printing elsewhere. */}
      <style>{'@page { size: 80mm auto; margin: 3mm; }'}</style>

      <div className="no-print mx-auto mb-4 flex max-w-xs justify-between gap-2">
        <Link to="/selled-products" className="flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
          <ArrowLeft size={15} /> Retour
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer size={14} /> Imprimer
        </Button>
      </div>

      <div className="mx-auto w-[80mm] max-w-full bg-white p-3 font-mono text-[11px] leading-tight text-black shadow-sm print:shadow-none">
        <div className="mb-2 text-center">
          <div className="text-sm font-bold">AS DES MATERIAUX</div>
          <div>Ticket de vente</div>
          <div>{new Date(sale.sell_date).toLocaleString('fr-FR')}</div>
        </div>
        <div className="my-2 border-t border-dashed border-black" />
        <div className="flex justify-between font-semibold">
          <span>Article</span>
          <span>Total</span>
        </div>
        <div className="my-1 flex justify-between">
          <span className="max-w-[45mm] break-words">{sale.product_name_display}</span>
          <span>{sale.total_price}</span>
        </div>
        <div className="text-[10px] text-gray-700">
          {sale.quantity} x {sale.unit_price} FCFA
        </div>
        {sale.customer_name && <div className="text-[10px] text-gray-700">Client : {sale.customer_name}</div>}
        <div className="my-2 border-t border-dashed border-black" />
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>{sale.total_price} FCFA</span>
        </div>
        <div className="mt-3 text-center text-[10px]">Merci de votre confiance !</div>
      </div>
    </div>
  )
}
