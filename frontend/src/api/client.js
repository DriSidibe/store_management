import axios from 'axios'
import { compressFormDataImages } from '../utils/image'

const ACCESS_KEY = 'sm_access_token'
const REFRESH_KEY = 'sm_refresh_token'

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access, refresh) => {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

const client = axios.create({ baseURL: '/api' })

client.interceptors.request.use(async (config) => {
  if (config.data instanceof FormData) config.data = await compressFormDataImages(config.data)
  const token = tokenStore.getAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise = null

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error
    if (response?.status !== 401 || config._retried || !tokenStore.getRefresh()) {
      if (response?.status === 401) {
        tokenStore.clear()
        if (!location.pathname.startsWith('/login')) location.href = '/login'
      }
      return Promise.reject(error)
    }
    config._retried = true
    try {
      refreshPromise ??= axios
        .post('/api/auth/token/refresh/', { refresh: tokenStore.getRefresh() })
        .finally(() => { refreshPromise = null })
      const { data } = await refreshPromise
      tokenStore.set(data.access, data.refresh)
      config.headers.Authorization = `Bearer ${data.access}`
      return client(config)
    } catch (refreshError) {
      tokenStore.clear()
      location.href = '/login'
      return Promise.reject(refreshError)
    }
  }
)

export default client
