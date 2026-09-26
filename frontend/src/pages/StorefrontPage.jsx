import { useQuery } from '@tanstack/react-query'
import {
  BrickWall, Droplet, Hammer, HardHat, LogIn, Moon, PaintBucket, Package, Ruler, Search, Sun, Tag,
  Wrench, Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listPublicProductCategories, listPublicProductCompanies, listPublicProducts } from '../api/api'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { Input, Select } from '../components/ui/Form'
import Skeleton from '../components/ui/Skeleton'
import useDebouncedValue from '../hooks/useDebouncedValue'
import { useTheme } from '../theme/ThemeContext'
import ZoomableImage from '../components/ui/ZoomableImage'

const CATEGORY_ICONS = {
  'électricité': Zap,
  'maçonnerie': BrickWall,
  'plomberie': Droplet,
  'sanitaire': Droplet,
  'peinture': PaintBucket,
  'outillage': Wrench,
  'quincaillerie': Hammer,
  'menuiserie': Ruler,
}

function categoryIcon(name) {
  return CATEGORY_ICONS[name?.toLowerCase()] || Tag
}

/** Public, unauthenticated storefront: a browsable catalog of products for
 * visitors, with no admin actions (no edit/delete/prices management). */
export default function StorefrontPage() {
  const { theme, toggleTheme } = useTheme()
  const [search, setSearch] = useState('')
  const [company, setCompany] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['public-products', debouncedSearch, company, category, page],
    queryFn: () => listPublicProducts({
      search: debouncedSearch || undefined,
      company: company || undefined,
      category: category || undefined,
      page,
    }),
  })
  const { data: companies } = useQuery({
    queryKey: ['public-product-companies'],
    queryFn: listPublicProductCompanies,
  })
  const { data: categories } = useQuery({
    queryKey: ['public-product-categories'],
    queryFn: listPublicProductCategories,
  })

  const toggleCategory = (name) => {
    setCategory((current) => (current === name ? '' : name))
    setPage(1)
  }

  const pageSize = 20
  const totalPages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
              <HardHat size={19} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight text-ink">As des Matériaux</h1>
              <p className="text-xs text-ink-muted">Notre catalogue de produits</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 text-ink-secondary hover:bg-ink/5 hover:text-ink cursor-pointer"
              title="Changer de thème"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to="/login">
              <Button variant="outline">
                <LogIn size={15} /> Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="hazard-stripes h-1.5 w-full" />

      {/* Hero: CSS-only brick-wall texture, no external images needed */}
      <section className="brick-pattern relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/60 to-page" />
        <HardHat
          size={280}
          strokeWidth={1}
          className="pointer-events-none absolute -right-10 -top-10 rotate-12 text-white/10"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/70">
            Quincaillerie &amp; matériaux de construction
          </p>
          <h2 className="max-w-2xl text-3xl font-extrabold text-white sm:text-4xl">
            Tout pour vos chantiers, en un coup d'œil
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/80">
            Parcourez notre catalogue et contactez-nous en magasin pour passer commande.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
              <Input
                className="border-0 pl-9 shadow-lg"
                placeholder="Rechercher un produit..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <Select
              className="w-auto border-0 shadow-lg"
              value={company}
              onChange={(e) => { setCompany(e.target.value); setPage(1) }}
            >
              <option value="">Toutes les marques</option>
              {companies?.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      {/* Category shortcuts, driven by the real product categories */}
      {categories?.length > 0 && (
        <div className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
            {categories.map((name) => {
              const Icon = categoryIcon(name)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleCategory(name)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    category === name
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border text-ink-secondary hover:bg-ink/5'
                  }`}
                >
                  <Icon size={14} /> {name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full" />
            ))}
          </div>
        ) : data?.results.length === 0 ? (
          <EmptyState icon={Package} title="Aucun produit trouvé" description="Essaie une autre recherche." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {data?.results.map((p) => (
                <div
                  key={p.product_id}
                  className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-ink/5">
                    {p.product_image ? (
                      <ZoomableImage
                        src={p.product_image}
                        alt={p.product_name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <Package size={32} className="text-ink-muted" />
                    )}
                    {!p.in_stock && (
                      <Badge variant="danger" className="absolute left-2 top-2 shadow-sm">
                        Rupture de stock
                      </Badge>
                    )}
                  </div>
                  <div className="p-3">
                    {(p.category_name || p.product_company) && (
                      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                        {[p.category_name, p.product_company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="line-clamp-2 min-h-[2.4em] text-sm font-medium leading-tight text-ink">
                      {p.product_name}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="rounded-lg bg-brand/10 px-2 py-1 text-sm font-bold text-brand">
                        {p.product_sp.toLocaleString()} FCFA
                      </span>
                      {p.product_unity_name && (
                        <span className="shrink-0 text-[11px] text-ink-muted">/ {p.product_unity_name}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex flex-wrap justify-center gap-1">
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
          </>
        )}
      </main>

      <div className="hazard-stripes h-1.5 w-full" />
      <footer className="border-t border-border py-6 text-center text-xs text-ink-muted">
        Copyright &copy; As des Materiaux 2020 - {new Date().getFullYear()}
      </footer>
    </div>
  )
}
