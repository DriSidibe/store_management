import { useQuery } from '@tanstack/react-query'
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { fetchMetrics, fetchSalesTrend, fetchTopProducts } from '../api/api'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'

const salesTiles = [
  ['daily_sales', "Aujourd'hui"],
  ['weekly_sales', 'Cette semaine'],
  ['monthly_sales', 'Ce mois-ci'],
  ['yearly_sales', 'Cette année'],
  ['total_sales', 'Total des ventes'],
  ['total_transactions', 'Nombre de ventes'],
]

const profitTiles = [
  ['daily_profit', "Aujourd'hui"],
  ['weekly_profit', 'Cette semaine'],
  ['monthly_profit', 'Ce mois-ci'],
  ['yearly_profit', 'Cette année'],
  ['total_profit', 'Total'],
]

function formatNumber(value) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value))
}

function StatTile({ label, value }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{formatNumber(value)}</div>
    </Card>
  )
}

function ChartTooltip({ active, payload, label, suffix = ' FCFA' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-0.5 text-ink-muted">{label}</p>
      <p className="font-semibold text-ink">{formatNumber(payload[0].value)}{suffix}</p>
    </div>
  )
}

export default function MetricsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['metrics'], queryFn: fetchMetrics })
  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ['sales-trend'],
    queryFn: () => fetchSalesTrend(30),
  })
  const { data: topProducts, isLoading: topLoading } = useQuery({
    queryKey: ['top-products'],
    queryFn: () => fetchTopProducts(5),
  })

  if (isLoading) return <p className="text-sm text-ink-muted">Chargement...</p>

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Statistiques</h1>

      <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Ventes (FCFA)</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {salesTiles.map(([key, label]) => (
          <StatTile key={key} label={label} value={data[key]} />
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Bénéfices (FCFA)</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {profitTiles.map(([key, label]) => (
          <StatTile key={key} label={label} value={data[key]} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink">Tendance des ventes (30 jours)</h2>
          {trendLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend} margin={{ left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--color-gridline)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => d.slice(5)}
                  tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                  axisLine={{ stroke: 'var(--color-gridline)' }}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-gridline)' }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink">Top produits (par revenu)</h2>
          {topLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-gridline)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="product_name"
                  width={140}
                  tick={{ fontSize: 11, fill: 'var(--color-ink-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-gridline)', opacity: 0.4 }} />
                <Bar dataKey="revenue" fill="var(--color-brand)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  )
}
