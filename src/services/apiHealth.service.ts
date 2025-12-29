/**
 * API Health Service
 *
 * Handles API health check calls to the check-api-key-health Edge Function
 */

import { supabase } from '@/lib/supabase/client'

export type KeyType =
  | 'serper-key'
  | 'serper-key-price-comparison'
  | 'openai-vision'
  | 'category-key'
  | 'weight-and-dimension-key'
  | 'seo-agent-key'
  | 'supabase-key'
  | 'decodo-key'

export interface HealthStatus {
  success: boolean
  keyType: string
  status: 'healthy' | 'degraded' | 'down'
  message: string
  responseTime: number
  details: {
    apiProvider: string
    tested: boolean
    error?: string
  }
}

export interface AgentToolStatus {
  id: string
  key_type: string
  key_name: string
  status: 'healthy' | 'degraded' | 'down' | 'checking'
  message: string | null
  response_time: number | null
  last_checked: string | null
  error_message: string | null
  api_provider: string | null
  created_at: string
  updated_at: string
}

class ApiHealthService {
  /**
   * Get all agent tools status from database
   */
  async getAllToolsStatus(): Promise<AgentToolStatus[]> {
    try {
      console.log('Fetching tools from database...')
      const { data, error } = await supabase
        .from('agent_tools')
        .select('*')
        .order('key_type', { ascending: true })

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      console.log('Database returned:', data)
      return (data || []) as AgentToolStatus[]
    } catch (error) {
      console.error('Error fetching agent tools status:', error)
      throw error
    }
  }

  /**
   * Get a specific tool status from database
   */
  async getToolStatus(keyType: KeyType): Promise<AgentToolStatus | null> {
    try {
      const { data, error } = await supabase
        .from('agent_tools')
        .select('*')
        .eq('key_type', keyType)
        .single()

      if (error) throw error

      return data as AgentToolStatus
    } catch (error) {
      console.error(`Error fetching ${keyType} status:`, error)
      return null
    }
  }

  /**
   * Check the health of a specific API key (calls Edge Function which updates database)
   */
  async checkKeyHealth(keyType: KeyType): Promise<HealthStatus> {
    try {
      const { data, error } = await supabase.functions.invoke('check-api-key-health', {
        body: { keyType },
      })

      if (error) throw error

      return data as HealthStatus
    } catch (error) {
      console.error(`Error checking ${keyType} health:`, error)
      return {
        success: false,
        keyType,
        status: 'down',
        message: `Failed to check ${keyType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: 0,
        details: {
          apiProvider: 'Unknown',
          tested: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  /**
   * Check the health of all API keys
   */
  async checkAllKeys(): Promise<Record<string, HealthStatus>> {
    const keyTypes: KeyType[] = [
      'serper-key',
      'serper-key-price-comparison',
      'openai-vision',
      'category-key',
      'weight-and-dimension-key',
      'seo-agent-key',
      'supabase-key',
      'decodo-key',
    ]

    const results: Record<string, HealthStatus> = {}

    // Check all keys in parallel
    const promises = keyTypes.map((keyType) =>
      this.checkKeyHealth(keyType).then((result) => {
        results[keyType] = result
      })
    )

    await Promise.all(promises)

    return results
  }
}

export const apiHealthService = new ApiHealthService()
