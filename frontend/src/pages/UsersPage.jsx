import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { createUser, deleteUser, listUsers, updateUser } from '../api/api'
import { useAuth } from '../auth/AuthContext'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Checkbox, Field, Input } from '../components/ui/Form'
import Modal from '../components/ui/Modal'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { useConfirm } from '../confirm/ConfirmContext'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

const emptyForm = { username: '', password: '', is_staff: false, is_superuser: false }

export default function UsersPage() {
  const { user: me } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => listUsers() })

  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createUser(form)
      toast.success('Utilisateur créé.')
      setForm(emptyForm)
      e.target.reset()
      invalidate()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleField = async (u, field) => {
    try {
      await updateUser(u.id, { [field]: !u[field] })
      invalidate()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handleDelete = async (u) => {
    if (!(await confirm(`Supprimer le compte ${u.username} ? Cette action est irréversible.`))) return
    try {
      await deleteUser(u.id)
      toast.success('Utilisateur supprimé.')
      invalidate()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    try {
      await updateUser(resetTarget.id, { password: newPassword })
      toast.success(`Mot de passe de ${resetTarget.username} réinitialisé.`)
      setResetTarget(null)
      setNewPassword('')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Utilisateurs & habilitations</h1>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit min-w-0">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <UserPlus size={15} /> Nouvel utilisateur
          </h2>
          <form className="space-y-4" onSubmit={handleCreate}>
            <Field label="Nom d'utilisateur">
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </Field>
            <Field label="Mot de passe" hint="Laisser vide pour désactiver la connexion par mot de passe">
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <div className="flex flex-wrap gap-4">
              <Checkbox
                label="Staff"
                checked={form.is_staff}
                onChange={(e) => setForm({ ...form, is_staff: e.target.checked })}
              />
              <Checkbox
                label="Superuser"
                checked={form.is_superuser}
                onChange={(e) => setForm({ ...form, is_superuser: e.target.checked })}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Création...' : 'Créer'}
            </Button>
          </form>
        </Card>

        <div className="min-w-0">
          <Table>
            <Thead>
              <Th>Utilisateur</Th>
              <Th>Staff</Th>
              <Th>Superuser</Th>
              <Th>Statut</Th>
              <Th>Dernière connexion</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {isLoading && (
                <Tr><Td colSpan={6} className="text-center text-ink-muted">Chargement...</Td></Tr>
              )}
              {data?.results.map((u) => {
                const isSelf = u.id === me?.id
                return (
                  <Tr key={u.id}>
                    <Td className="font-medium">
                      {u.username} {isSelf && <span className="text-xs text-ink-muted">(vous)</span>}
                    </Td>
                    <Td>
                      <Checkbox checked={u.is_staff} onChange={() => toggleField(u, 'is_staff')} />
                    </Td>
                    <Td>
                      <Checkbox
                        checked={u.is_superuser}
                        onChange={() => toggleField(u, 'is_superuser')}
                        disabled={isSelf && u.is_superuser}
                      />
                    </Td>
                    <Td>
                      <button type="button" onClick={() => toggleField(u, 'is_active')} disabled={isSelf}>
                        <Badge variant={u.is_active ? 'success' : 'danger'}>
                          {u.is_active ? 'Actif' : 'Désactivé'}
                        </Badge>
                      </button>
                    </Td>
                    <Td className="text-ink-muted">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : 'jamais'}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          title="Réinitialiser le mot de passe"
                          onClick={() => setResetTarget(u)}
                          className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand cursor-pointer"
                        >
                          <KeyRound size={15} />
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </div>
      </div>

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Réinitialiser le mot de passe de ${resetTarget?.username || ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Annuler</Button>
            <Button onClick={handleResetPassword}>Réinitialiser</Button>
          </>
        }
      >
        <form onSubmit={handleResetPassword}>
          <Field label="Nouveau mot de passe">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
              required
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
