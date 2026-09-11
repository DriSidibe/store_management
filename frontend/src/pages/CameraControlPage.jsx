import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { createCamera, deleteCamera, listCameras, updateCamera } from '../api/api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Checkbox, Field, Input, Select } from '../components/ui/Form'
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table'
import { useConfirm } from '../confirm/ConfirmContext'
import { extractErrorMessage, useToast } from '../toast/ToastContext'

const RESOLUTIONS = [
  '1600x1200', '1280x1024', '1280x720', '1024x768', '800x600', '640x480',
  '480x320', '400x296', '320x240', '240x240', '240x176', '176x144', '128x128',
  '160x120', '96x96',
]

const emptyForm = {
  name: '', description: '', ip_address: '', resolution: '640x480',
  is_active: true, quality: 10, brightness: 0, contrast: 0, vflip: false, hflip: true,
}

export default function CameraControlPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['cameras'], queryFn: listCameras })

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cameras'] })

  const startEdit = (camera) => {
    setEditingId(camera.id)
    setForm({ ...camera })
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const setField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [field]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingId) {
        await updateCamera(editingId, form)
        toast.success('Caméra mise à jour.')
      } else {
        await createCamera(form)
        toast.success('Caméra ajoutée.')
      }
      resetForm()
      invalidate()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!(await confirm('Supprimer cette caméra ?'))) return
    try {
      await deleteCamera(id)
      toast.success('Caméra supprimée.')
      if (editingId === id) resetForm()
      invalidate()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-ink">Gestion des caméras</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">
            {editingId ? 'Modifier la caméra' : 'Ajouter une caméra'}
          </h2>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Nom">
              <Input value={form.name} onChange={setField('name')} required />
            </Field>
            <Field label="Adresse IP">
              <Input value={form.ip_address} onChange={setField('ip_address')} required />
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={setField('description')} />
            </Field>
            <Field label="Résolution">
              <Select value={form.resolution} onChange={setField('resolution')}>
                {RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Qualité (4-63)">
                <Input type="number" min="4" max="63" value={form.quality} onChange={setField('quality')} />
              </Field>
              <Field label="Luminosité (-2/2)">
                <Input type="number" min="-2" max="2" value={form.brightness} onChange={setField('brightness')} />
              </Field>
              <Field label="Contraste (-2/2)">
                <Input type="number" min="-2" max="2" value={form.contrast} onChange={setField('contrast')} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-5">
              <Checkbox label="Active" checked={form.is_active} onChange={setField('is_active')} />
              <Checkbox label="Vflip" checked={form.vflip} onChange={setField('vflip')} />
              <Checkbox label="Hflip" checked={form.hflip} onChange={setField('hflip')} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>{editingId ? 'Enregistrer' : 'Ajouter'}</Button>
              {editingId && <Button type="button" variant="outline" onClick={resetForm}>Annuler</Button>}
            </div>
          </form>
        </Card>

        <div>
          <Table>
            <Thead><Th>Nom</Th><Th>IP</Th><Th>Résolution</Th><Th></Th></Thead>
            <Tbody>
              {data?.results.map((c) => (
                <Tr key={c.id}>
                  <Td>{c.name}</Td>
                  <Td>{c.ip_address}</Td>
                  <Td>{c.resolution}</Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="rounded-lg p-1.5 text-ink-secondary hover:bg-brand/10 hover:text-brand cursor-pointer"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      </div>
    </div>
  )
}
