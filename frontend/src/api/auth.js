import client, { tokenStore } from './client'

export async function login(username, password) {
  const { data } = await client.post('/auth/token/', { username, password })
  tokenStore.set(data.access, data.refresh)
  return data
}

export async function logout() {
  const refresh = tokenStore.getRefresh()
  try {
    if (refresh) await client.post('/auth/logout/', { refresh })
  } finally {
    tokenStore.clear()
  }
}

export async function fetchMe() {
  const { data } = await client.get('/auth/me/')
  return data
}
