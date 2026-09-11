import { CheckCircle2, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)
let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, variant = 'success') => {
    const id = nextId++
    setToasts((t) => [...t, { id, message, variant }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])

  const value = {
    success: (msg) => push(msg, 'success'),
    error: (msg) => push(msg, 'danger'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-[2000] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-in flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.variant === 'success'
                ? 'border-success/20 bg-surface text-ink'
                : 'border-danger/20 bg-surface text-ink'
            }`}
          >
            {t.variant === 'success' ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
            ) : (
              <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

export function extractErrorMessage(error, fallback = "Une erreur s'est produite.") {
  const data = error?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  const firstKey = Object.keys(data)[0]
  if (firstKey) {
    const val = data[firstKey]
    return Array.isArray(val) ? val[0] : String(val)
  }
  return fallback
}
