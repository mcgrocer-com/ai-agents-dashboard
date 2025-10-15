/**
 * Authentication Service
 *
 * Handles all authentication operations using Supabase Auth.
 */

import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpCredentials extends SignInCredentials {
  fullName?: string
}

export interface AuthResponse {
  user: User | null
  error: Error | null
}

class AuthService {
  /**
   * Sign in with email and password
   */
  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })

      if (error) throw error

      return {
        user: data.user,
        error: null,
      }
    } catch (error) {
      return {
        user: null,
        error: error as Error,
      }
    }
  }

  /**
   * Sign up new user
   */
  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            full_name: credentials.fullName,
          },
        },
      })

      if (error) throw error

      return {
        user: data.user,
        error: null,
      }
    } catch (error) {
      return {
        user: null,
        error: error as Error,
      }
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    return { session: data.session, error }
  }

  /**
   * Get current user
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser()
    return { user: data.user, error }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(
    callback: (event: string, session: any) => void
  ) {
    return supabase.auth.onAuthStateChange(callback)
  }

  /**
   * Reset password request
   */
  async resetPassword(email: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  /**
   * Update password
   */
  async updatePassword(
    newPassword: string
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }
}

export const authService = new AuthService()
