import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listCategories } from '../api/api'
import { useAuth } from '../auth/AuthContext'
import { Field, Select } from './ui/Form'

// Picks one of the categories saved on the Catégories page. The value is the
// category name, which is what the product API expects.
export default function CategorySelect({ value, onChange, required = false }) {
  const { user } = useAuth()
  const { data: categories, isLoading } = useQuery({ queryKey: ['categories'], queryFn: listCategories })

  const hint = user?.is_staff ? (
    <>
      {categories?.length === 0 && 'Aucune catégorie enregistrée. '}
      <Link to="/categories" className="font-medium text-brand hover:underline">
        Gérer les catégories
      </Link>
    </>
  ) : categories?.length === 0 ? (
    'Aucune catégorie enregistrée : demande à un responsable d’en ajouter.'
  ) : null

  return (
    <Field label="Catégorie" hint={hint}>
      <Select value={value} onChange={onChange} required={required} disabled={isLoading}>
        <option value="">{isLoading ? 'Chargement...' : '-- Sélectionner --'}</option>
        {categories?.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </Select>
    </Field>
  )
}
