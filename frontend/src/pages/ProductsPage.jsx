import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Download, Package, Pencil, Printer, Search, ShoppingCart, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteProduct, downloadReport, importProductsCsv, listProducts } from '../api/api'
import { useAuth } from '../auth/AuthContext'
import SaleForm from '../components/SaleForm'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { CardGrid, DataRow } from '../components/ui/CardList'
import EmptyState from '../components/ui/EmptyState'
import { Input } from '../components/ui/Form'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { useConfirm } from '../confirm/ConfirmContext'
import useDebouncedValue from '../hooks/useDebouncedValue'
import { extractErrorMessage, useToast } from '../toast/ToastContext'
import ZoomableImage from '../components/ui/ZoomableImage'

export default function ProductsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [page, setPage] = useState(1)
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef(null)
  const [detailProduct, setDetailProduct] = useState(null)
  // The details modal doubles as a quick sale: 'details' -> 'sell' -> 'sold'.
  const [detailMode, setDetailMode] = useState('details')
  const [lastSale, setLastSale] = useState(null)

  const openDetail = (product, mode = 'details') => {
    setDetailProduct(product)
    setDetailMode(mode)
  }

  const closeDetail = () => setDetailProduct(null)

  const handleQuickSold = (sale) => {
    setLastSale(sale)
    setDetailMode('sold')
    setDetailProduct((p) => ({ ...p, product_quantity: p.product_quantity - (sale.quantity || 0) }))
  }

  const { data, isLoading } = useQuery({
    queryKey: ['products', debouncedSearch, page],
    queryFn: () => listProducts({ search: debouncedSearch || undefined, page }),
  })

  const handleDelete = async (productId) => {
    if (!(await confirm(`Supprimer le produit ${productId} ?`))) return
    try {
      await deleteProduct(productId)
      toast.success('Produit supprimé.')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const result = await importProductsCsv(file)
      if (result.errors.length > 0) {
        toast.error(
          `${result.created} créés, ${result.updated} mis à jour, ${result.errors.length} erreurs (ligne ${result.errors[0].row}: ${result.errors[0].message})`,
        )
      } else {
        toast.success(`Import réussi : ${result.created} créés, ${result.updated} mis à jour.`)
      }
      queryClient.invalidateQueries({ queryKey: ['products'] })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setImporting(false)
    }
  }

  const pageSize = 20
  const totalPages = data ? Math.ceil(data.count / pageSize) : 1

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Produits</h1>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
            <Input
              className="w-56 pl-9"
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Button variant="outline" onClick={() => downloadReport('produits', 'pdf')}>
            <Download size={15} /> PDF
          </Button>
          <Button variant="outline" onClick={() => downloadReport('produits', 'csv')}>
            <Download size={15} /> CSV
          </Button>
          {user?.is_staff && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button
                variant="outline"
                disabled={importing}
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={15} /> {importing ? 'Import...' : 'Importer CSV'}
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : data?.results.length === 0 ? (
        <EmptyState icon={Package} title="Aucun produit" description="Essaie une autre recherche ou ajoute un produit." />
      ) : (
        <>
          {/* Amazon/Jumia-style product grid, mobile & tablet only */}
          <CardGrid>
            {data?.results.map((p) => {
              const isLow = p.product_quantity <= p.low_stock_threshold
              return (
                <div
                  key={p.product_id}
                  onClick={() => openDetail(p)}
                  className="cursor-pointer overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <div className="relative flex aspect-square items-center justify-center bg-ink/5">
                    {p.product_image ? (
                      <ZoomableImage src={p.product_image} alt={p.product_name} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={28} className="text-ink-muted" />
                    )}
                    {isLow && (
                      <Badge variant="danger" className="absolute left-1.5 top-1.5 text-[10px]">
                        Stock faible
                      </Badge>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-2 min-h-[2.2em] text-xs font-medium leading-tight text-ink">
                      {p.product_name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-brand">{p.product_sp} FCFA</p>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <span className="truncate font-mono text-[10px] text-ink-muted">{p.product_id}</span>
                      <span className="shrink-0 text-[10px] text-ink-muted">Stock: {p.product_quantity}</span>
                    </div>
                    {user?.is_staff && (
                      <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
                        <Link
                          to="/update-product"
                          state={{ productId: p.product_id }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-1 items-center justify-center rounded-lg p-1.5 text-ink-secondary hover:bg-ink/5 hover:text-brand"
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.product_id) }}
                          className="flex flex-1 items-center justify-center rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </CardGrid>

          {/* Full table, desktop only */}
          <div className="hidden md:block">
            <Table>
              <Thead>
                <Th></Th>
                <Th>Code</Th>
                <Th>Nom</Th>
                <Th>Société</Th>
                <Th>Quantité</Th>
                <Th>Prix Achat</Th>
                <Th>Prix Vente</Th>
                {user?.is_staff && <Th></Th>}
              </Thead>
              <Tbody>
                {data?.results.map((p) => {
                  const isLow = p.product_quantity <= p.low_stock_threshold
                  return (
                    <Tr key={p.product_id} onClick={() => openDetail(p)} className="cursor-pointer">
                      <Td>
                        {p.product_image ? (
                          <ZoomableImage src={p.product_image} alt={p.product_name} className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink/5 text-ink-muted">
                            <Package size={16} />
                          </div>
                        )}
                      </Td>
                      <Td className="font-mono text-xs text-ink-secondary">{p.product_id}</Td>
                      <Td>{p.product_name}</Td>
                      <Td>{p.product_company}</Td>
                      <Td>
                        <span className="flex items-center gap-1.5">
                          {p.product_quantity}
                          {isLow && <Badge variant="danger">Stock faible</Badge>}
                        </span>
                      </Td>
                      <Td>{p.product_cp}</Td>
                      <Td>{p.product_sp}</Td>
                      {user?.is_staff && (
                        <Td>
                          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Link
                              to="/update-product"
                              state={{ productId: p.product_id }}
                              className="rounded-lg p-1.5 text-ink-secondary hover:bg-ink/5 hover:text-brand"
                            >
                              <Pencil size={15} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.product_id)}
                              className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </Td>
                      )}
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`h-8 w-8 rounded-lg text-sm font-medium cursor-pointer ${
                n === page ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-ink/5'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      <Modal
        open={!!detailProduct}
        onClose={closeDetail}
        title={detailMode === 'details' ? detailProduct?.product_name : `Vendre « ${detailProduct?.product_name} »`}
      >
        {detailProduct && detailMode === 'details' && (
          <div>
            <div className="mb-4 flex items-center gap-3">
              {detailProduct.product_image ? (
                <ZoomableImage src={detailProduct.product_image} alt={detailProduct.product_name} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-ink-muted">
                  <Package size={24} />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{detailProduct.product_name}</p>
                <p className="font-mono text-xs text-ink-muted">{detailProduct.product_id}</p>
                {detailProduct.product_quantity <= detailProduct.low_stock_threshold && (
                  <Badge variant="danger" className="mt-1">Stock faible</Badge>
                )}
              </div>
            </div>

            {detailProduct.product_description && (
              <p className="mb-3 text-sm text-ink-secondary">{detailProduct.product_description}</p>
            )}

            <DataRow label="Société" value={detailProduct.product_company || '-'} />
            <DataRow label="Unité" value={detailProduct.product_unity_name || '-'} />
            <DataRow label="Quantité en stock" value={detailProduct.product_quantity} />
            <DataRow label="Seuil stock faible" value={detailProduct.low_stock_threshold} />
            <DataRow label="Prix d'achat" value={`${detailProduct.product_cp} FCFA`} />
            <DataRow label="Prix de vente" value={`${detailProduct.product_sp} FCFA`} />

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {user?.is_staff && (
                <Link to="/update-product" state={{ productId: detailProduct.product_id }}>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Pencil size={15} /> Modifier
                  </Button>
                </Link>
              )}
              <Button
                onClick={() => setDetailMode('sell')}
                disabled={detailProduct.product_quantity <= 0}
                className="w-full sm:w-auto"
              >
                <ShoppingCart size={15} /> {detailProduct.product_quantity > 0 ? 'Vendre' : 'Rupture de stock'}
              </Button>
            </div>
          </div>
        )}

        {detailProduct && detailMode === 'sell' && (
          <div>
            <button
              type="button"
              onClick={() => setDetailMode('details')}
              className="mb-3 flex items-center gap-1 text-xs font-medium text-ink-secondary hover:text-brand cursor-pointer"
            >
              <ArrowLeft size={13} /> Retour aux détails
            </button>
            <SaleForm lockedProduct={detailProduct} onSold={handleQuickSold} />
          </div>
        )}

        {detailProduct && detailMode === 'sold' && lastSale && (
          <div className="text-center">
            <CheckCircle2 size={40} className="mx-auto mb-2 text-success" />
            <p className="font-medium text-ink">Vente enregistrée</p>
            <p className="mb-4 text-sm text-ink-secondary">
              {lastSale.quantity} × {detailProduct.product_name} · {lastSale.total_price} FCFA
              <br />
              Stock restant : {detailProduct.product_quantity}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link to={`/receipt/${lastSale.id}`}>
                <Button className="w-full sm:w-auto">
                  <Printer size={15} /> Imprimer le ticket
                </Button>
              </Link>
              {detailProduct.product_quantity > 0 && (
                <Button variant="outline" onClick={() => setDetailMode('sell')} className="w-full sm:w-auto">
                  <ShoppingCart size={15} /> Nouvelle vente
                </Button>
              )}
              <Button variant="ghost" onClick={closeDetail} className="w-full sm:w-auto">
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
