/**
 * useAuth Hook
 *
 * Custom hook for managing authentication state.
 * Listens to Supabase auth changes and provides current user.
 */

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { authService } from '@/services'

interface UseAuthReturn {
  user: User | null
  loading: boolean
  signIn: typeof authService.signIn
  signUp: typeof authService.signUp
  signOut: typeof authService.signOut
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    authService.getSession().then(({ session }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = authService.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return {
    user,
    loading,
    signIn: authService.signIn,
    signUp: authService.signUp,
    signOut: authService.signOut,
  }
}
