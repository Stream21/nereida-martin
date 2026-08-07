import { useCallback, useEffect, useState } from 'react'
import { clearOwnerToken, getOwnerToken, ownerLogin, ownerMe, setOwnerToken } from '../utils/ownerApi'

export function useOwnerAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = getOwnerToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return null
    }

    try {
      const data = await ownerMe()
      setUser(data.user)
      return data.user
    } catch {
      clearOwnerToken()
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (email, password) => {
    const data = await ownerLogin(email, password)
    setOwnerToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    clearOwnerToken()
    setUser(null)
  }

  return { user, loading, login, logout, refresh, isAuthenticated: !!user }
}
