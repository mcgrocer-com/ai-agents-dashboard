/**
 * User Service
 *
 * Handles user profile and preferences operations.
 */

import { supabase } from '@/lib/supabase/client'
import type { User } from '@/types/database'

export type SyncDataSource = 'All' | 'Scrapper'

export interface UserPreferences {
  sync_vendors?: string[]
  prioritize_copyright?: boolean
  sync_data_source?: SyncDataSource
  sync_to_erpnext?: boolean // Master toggle for ERPNext sync
  [key: string]: any
}

export interface ServiceResponse<T> {
  data: T | null
  error: Error | null
}

class UserService {
  /**
   * Get user preferences by user ID
   */
  async getUserPreferences(userId: string): Promise<ServiceResponse<UserPreferences>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', userId)
        .single()

      if (error) throw error

      return {
        data: (data?.preferences || {}) as UserPreferences,
        error: null,
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error)
      return {
        data: null,
        error: error as Error,
      }
    }
  }

  /**
   * Update vendor sync preferences for a user
   */
  async updateVendorSyncPreferences(
    userId: string,
    vendors: string[],
    prioritizeCopyright?: boolean,
    dataSource?: SyncDataSource
  ): Promise<ServiceResponse<UserPreferences>> {
    try {
      // First get current preferences
      const { data: currentData } = await this.getUserPreferences(userId)
      const preferences = currentData || {}

      // Update sync_vendors field
      preferences.sync_vendors = vendors
      if (prioritizeCopyright !== undefined) {
        preferences.prioritize_copyright = prioritizeCopyright
      }
      if (dataSource !== undefined) {
        preferences.sync_data_source = dataSource
      }

      // Save back to database
      const { data, error } = await supabase
        .from('users')
        .update({ preferences, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('preferences')
        .single()

      if (error) throw error

      return {
        data: (data?.preferences || preferences) as UserPreferences,
        error: null,
      }
    } catch (error) {
      console.error('Error updating vendor sync preferences:', error)
      return {
        data: null,
        error: error as Error,
      }
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<ServiceResponse<User>> {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!authData.user) throw new Error('No authenticated user')

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (error) throw error

      return {
        data: data as User,
        error: null,
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
      return {
        data: null,
        error: error as Error,
      }
    }
  }

  /**
   * Toggle the sync_to_erpnext preference
   */
  async toggleSyncToErpnext(userId: string, enabled: boolean): Promise<ServiceResponse<UserPreferences>> {
    try {
      const { data: currentData } = await this.getUserPreferences(userId)
      const preferences = currentData || {}

      preferences.sync_to_erpnext = enabled

      const { data, error } = await supabase
        .from('users')
        .update({ preferences, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('preferences')
        .single()

      if (error) throw error

      return {
        data: (data?.preferences || preferences) as UserPreferences,
        error: null,
      }
    } catch (error) {
      console.error('Error toggling sync_to_erpnext:', error)
      return {
        data: null,
        error: error as Error,
      }
    }
  }
}

export const userService = new UserService()
