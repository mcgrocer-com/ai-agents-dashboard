/**
 * useUserPreferences Hook
 *
 * Manages user preferences including vendor sync settings.
 */

import { useState, useEffect } from 'react'
import { userService, type UserPreferences, type SyncDataSource } from '@/services/user.service'
import { useAuth } from './useAuth'

interface UseUserPreferencesReturn {
  preferences: UserPreferences | null
  loading: boolean
  error: Error | null
  updateVendorSyncPreferences: (
    vendors: string[],
    prioritizeCopyright?: boolean,
    dataSource?: SyncDataSource
  ) => Promise<boolean>
  toggleSyncToErpnext: (enabled: boolean) => Promise<boolean>
  refreshPreferences: () => Promise<void>
}

export function useUserPreferences(): UseUserPreferencesReturn {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadPreferences = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: err } = await userService.getUserPreferences(user.id)

    if (err) {
      setError(err)
    } else {
      setPreferences(data)
      setError(null)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadPreferences()
  }, [user?.id])

  const updateVendorSyncPreferences = async (
    vendors: string[],
    prioritizeCopyright?: boolean,
    dataSource?: SyncDataSource
  ): Promise<boolean> => {
    if (!user?.id) return false

    const { data, error: err } = await userService.updateVendorSyncPreferences(
      user.id,
      vendors,
      prioritizeCopyright,
      dataSource
    )

    if (err) {
      setError(err)
      return false
    }

    setPreferences(data)
    return true
  }

  const toggleSyncToErpnext = async (enabled: boolean): Promise<boolean> => {
    if (!user?.id) return false

    const { data, error: err } = await userService.toggleSyncToErpnext(user.id, enabled)

    if (err) {
      setError(err)
      return false
    }

    setPreferences(data)
    return true
  }

  return {
    preferences,
    loading,
    error,
    updateVendorSyncPreferences,
    toggleSyncToErpnext,
    refreshPreferences: loadPreferences,
  }
}
