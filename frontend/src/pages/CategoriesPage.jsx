import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../api/api'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { Input } from '../components/ui/Form'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useConfirm } from '../confirm/ConfirmContext'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

const iconButton =
  'rounded-lg p-2 text-ink-secondary hover:bg-brand/10 hover:text-brand cursor-pointer disabled:opacity-50'

export default function CategoriesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: categories, isLoading } = useQuery({ queryKey: ['categories'], queryFn: listCategories })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const category = await createCategory({ name: newName })
      toast.success(`Catégorie « ${category.name} » ajoutée.`)
      setNewName('')
      refresh()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (category) => {
    setEditingId(category.id)
    setEditName(category.name)
  }

  const handleRename = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateCategory(editingId, { name: editName })
      toast.success('Catégorie renommée.')
      setEditingId(null)
      refresh()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (category) => {
    const message = category.products_count
      ? `Supprimer « ${category.name} » ? ${category.products_count} produit(s) n'auront plus de catégorie.`
      : `Supprimer « ${category.name} » ?`
    if (!(await confirm(message))) return
    try {
      await deleteCategory(category.id)
      toast.success('Catégorie supprimée.')
      refresh()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-ink">Catégories</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Les catégories enregistrées ici sont proposées dans les formulaires de produits.
      </p>

      <Card className="mb-5 p-3 sm:p-4">
        <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nouvelle catégorie, ex : Électricité"
            aria-label="Nom de la nouvelle catégorie"
            required
          />
          <Button type="submit" disabled={saving || !newName.trim()} className="shrink-0">
            <Plus size={15} /> Ajouter
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} cols={2} />
      ) : categories?.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Aucune catégorie"
          description="Ajoute tes premières catégories : électricité, plomberie, maçonnerie..."
        />
      ) : (
        <Card className="divide-y divide-border p-0">
          {categories?.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2 sm:px-4">
              {editingId === c.id ? (
                <form onSubmit={handleRename} className="flex flex-1 items-center gap-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Nouveau nom"
                    autoFocus
                    required
                  />
                  <button type="submit" disabled={saving} title="Enregistrer" className={iconButton}>
                    <Check size={16} />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} title="Annuler" className={iconButton}>
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{c.name}</span>
                  <Badge className="shrink-0">
                    {c.products_count} produit{c.products_count > 1 ? 's' : ''}
                  </Badge>
                  <button type="button" onClick={() => startEdit(c)} title="Renommer" className={iconButton}>
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    title="Supprimer"
                    className="rounded-lg p-2 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
