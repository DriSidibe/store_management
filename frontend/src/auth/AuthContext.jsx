import { createContext, useContext, useEffect, useState } from 'react'
import * as auth from '../api/auth'
import { tokenStore } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      setLoading(false)
      return
    }
    auth
      .fetchMe()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    await auth.login(username, password)
    setUser(await auth.fetchMe())
  }

  const register = async (username, password) => {
    const registeredUser = await auth.register(username, password)
    setUser(registeredUser)
  }

  const logout = async () => {
    await auth.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
