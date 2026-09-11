import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ConfirmProvider } from './confirm/ConfirmContext.jsx'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { ToastProvider } from './toast/ToastContext.jsx'

import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <ConfirmProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ConfirmProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
