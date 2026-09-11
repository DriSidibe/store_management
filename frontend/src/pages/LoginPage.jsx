import { Store } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Field, Input } from '../components/ui/Form'
import { extractErrorMessage } from '../toast/ToastContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.status === 401 ? 'Identifiants invalides.' : extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <Store size={20} />
          </div>
          <h1 className="text-lg font-semibold text-ink">Connexion</h1>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Field label="Nom d'utilisateur">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </Field>
          <Field label="Mot de passe">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-muted">
          Pas de compte ? <Link to="/signup" className="text-brand hover:underline">S'inscrire</Link>
        </p>
      </Card>
    </div>
  )
}
