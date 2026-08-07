import { useCallback, useEffect, useState } from 'react'
import {
  clearClientToken,
  clientLogin,
  clientMe,
  getClientToken,
  setClientToken,
} from '../utils/clientAuth'

export function useClientAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = getClientToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return null
    }

    try {
      const data = await clientMe()
      setUser(data.user)
      return data.user
    } catch {
      clearClientToken()
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (identifier, password) => {
    const data = await clientLogin(identifier, password)
    setClientToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    clearClientToken()
    setUser(null)
  }

  const acceptSession = (token, nextUser) => {
    setClientToken(token)
    setUser(nextUser)
  }

  return {
    user,
    loading,
    login,
    logout,
    refresh,
    acceptSession,
    isAuthenticated: !!user,
  }
}
