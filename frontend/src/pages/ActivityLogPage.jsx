import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useState } from 'react'
import { listActivityLog } from '../api/api'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import { CardStack } from '../components/ui/CardList'
import EmptyState from '../components/ui/EmptyState'
import { Select } from '../components/ui/Form'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'

const MODELS = ['Product', 'Category', 'Sell', 'Ravitaillement', 'Bill', 'BillItems', 'Customer', 'User']

const ACTION_VARIANTS = {
  created: 'success',
  updated: 'brand',
  deleted: 'danger',
  cancelled: 'danger',
  sold: 'success',
  promoted: 'brand',
  received: 'success',
  billed: 'success',
}

export default function ActivityLogPage() {
  const [modelName, setModelName] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['activity-log', modelName, page],
    queryFn: () => listActivityLog({ model_name: modelName || undefined, page }),
  })

  const pageSize = 20
  const totalPages = data ? Math.ceil(data.count / pageSize) : 1

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Journal d'activité</h1>
        <Select
          className="w-52"
          value={modelName}
          onChange={(e) => { setModelName(e.target.value); setPage(1) }}
        >
          <option value="">Tous les types</option>
          {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} cols={5} />
      ) : data?.results.length === 0 ? (
        <EmptyState icon={History} title="Aucune activité enregistrée" />
      ) : (
        <>
          <CardStack>
            {data?.results.map((entry) => (
              <Card key={entry.id} className="p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Badge variant={ACTION_VARIANTS[entry.action] || 'neutral'}>
                    {entry.action} {entry.model_name}
                  </Badge>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="truncate text-sm text-ink">{entry.object_repr}</p>
                <p className="text-xs text-ink-muted">
                  {entry.username || 'système'} {entry.details && `· ${entry.details}`}
                </p>
              </Card>
            ))}
          </CardStack>

          <div className="hidden md:block">
            <Table>
              <Thead><Th>Date</Th><Th>Utilisateur</Th><Th>Action</Th><Th>Objet</Th><Th>Détails</Th></Thead>
              <Tbody>
                {data?.results.map((entry) => (
                  <Tr key={entry.id}>
                    <Td className="text-ink-muted">{new Date(entry.timestamp).toLocaleString()}</Td>
                    <Td>{entry.username || 'système'}</Td>
                    <Td>
                      <Badge variant={ACTION_VARIANTS[entry.action] || 'neutral'}>
                        {entry.action} {entry.model_name}
                      </Badge>
                    </Td>
                    <Td>{entry.object_repr}</Td>
                    <Td className="text-ink-muted">{entry.details || '-'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>

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
        </>
      )}
    </div>
  )
}
