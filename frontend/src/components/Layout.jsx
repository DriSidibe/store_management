import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, BarChart3, Camera, FileText, History, LayoutGrid, LogOut, Menu,
  Moon, PackagePlus, PenSquare, Receipt, ShoppingCart, Sun, Truck, Users, Video, X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { listLowStockProducts } from '../api/api'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import GlobalSearch from './GlobalSearch'

const mainNav = [
  { to: '/', label: 'Produits', icon: LayoutGrid, end: true },
  { to: '/sell-product', label: 'Vendre', icon: ShoppingCart },
  { to: '/selled-products', label: 'Ventes', icon: Receipt },
  { to: '/approvioning', label: 'Approvisionnement', icon: Truck },
  { to: '/cameras', label: 'Caméra', icon: Video },
]

const staffNav = [
  { to: '/add-product', label: 'Ajouter Produit', icon: PackagePlus },
  { to: '/update-product', label: 'Modifier', icon: PenSquare },
  { to: '/customers', label: 'Clients', icon: Users },
]

const adminNav = [
  { to: '/billing', label: 'Facturation', icon: FileText },
  { to: '/metrics', label: 'Statistiques', icon: BarChart3 },
  { to: '/activity-log', label: "Journal d'activité", icon: History },
  { to: '/camera/viewer', label: 'Vidéos', icon: Video },
]

function NavItem({ to, label, icon: Icon, end, badge, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-brand/10 text-brand' : 'text-ink-secondary hover:bg-ink/5 hover:text-ink'
        }`
      }
    >
      <span className="flex items-center gap-2.5">
        <Icon size={17} strokeWidth={2} />
        {label}
      </span>
      {badge}
    </NavLink>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock-count'],
    queryFn: () => listLowStockProducts(),
    staleTime: 60_000,
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const closeMobile = () => setMobileOpen(false)

  const lowStockBadge = lowStock?.count > 0 && (
    <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
      {lowStock.count}
    </span>
  )

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2 px-2 py-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
          AM
        </div>
        <span className="text-sm font-semibold text-ink">Gestion Magasin</span>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} onNavigate={closeMobile} />
        ))}
        <NavItem
          to="/low-stock"
          label="Stock faible"
          icon={AlertTriangle}
          badge={lowStockBadge}
          onNavigate={closeMobile}
        />

        {user?.is_staff && (
          <>
            <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Gestion
            </div>
            {staffNav.map((item) => (
              <NavItem key={item.to} {...item} onNavigate={closeMobile} />
            ))}
          </>
        )}

        {user?.is_superuser && (
          <>
            <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Administration
            </div>
            {adminNav.map((item) => (
              <NavItem key={item.to} {...item} onNavigate={closeMobile} />
            ))}
            <NavItem to="/camera/control" label="Gérer les caméras" icon={Camera} onNavigate={closeMobile} />
          </>
        )}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-ink/5 hover:text-danger cursor-pointer"
      >
        <LogOut size={17} /> Déconnexion
      </button>
    </>
  )

  return (
    <div className="min-h-screen bg-page">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface p-4 lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface p-4">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
          <button
            type="button"
            className="rounded-lg p-2 text-ink-secondary hover:bg-ink/5 lg:hidden cursor-pointer"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 text-ink-secondary hover:bg-ink/5 cursor-pointer"
              title="Changer de thème"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="hidden text-sm text-ink-secondary sm:inline">{user?.username}</span>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>

        <footer className="px-6 py-4 text-center text-xs text-ink-muted">
          Copyright &copy; As des Materiaux 2020
        </footer>
      </div>
    </div>
  )
}
