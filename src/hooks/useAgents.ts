/**
 * useAgents Hook
 *
 * Hook for managing AI agents operations.
 */

import useSWR from 'swr'
import { useState } from 'react'
import { agentsService } from '@/services'
import type { AgentType, TriggerAgentParams, RetryAgentParams } from '@/services'

export function useAgentMetrics() {
  const { data, error, isLoading, mutate } = useSWR(
    'agent-metrics',
    () => agentsService.getAgentMetrics(),
    {
      revalidateOnFocus: false, // Realtime handles updates
      revalidateOnReconnect: true,
      dedupingInterval: 2000, // Prevent duplicate requests within 2s
    }
  )

  return {
    metrics: data?.metrics || [],
    isLoading,
    error: data?.error || error,
    refresh: mutate,
  }
}

export function useTriggerAgent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const trigger = async (params: TriggerAgentParams) => {
    setLoading(true)
    setError(null)

    const { data, error: triggerError } = await agentsService.triggerAgent(params)

    setLoading(false)
    if (triggerError) {
      setError(triggerError)
      return { success: false, error: triggerError }
    }

    return { success: true, data }
  }

  return {
    trigger,
    loading,
    error,
  }
}

export function useRetryAgent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const retry = async (params: RetryAgentParams) => {
    setLoading(true)
    setError(null)

    const { data, error: retryError } = await agentsService.retryAgent(params)

    setLoading(false)
    if (retryError) {
      setError(retryError)
      return { success: false, error: retryError }
    }

    return { success: true, data }
  }

  return {
    retry,
    loading,
    error,
  }
}

export function usePendingForAgent(
  agentType: AgentType,
  options: {
    limit?: number
    offset?: number
    search?: string
    vendor?: string
    status?: string
    erpnextSynced?: 'all' | 'synced' | 'not_synced'
  } = {}
) {
  const { data, error, isLoading, mutate } = useSWR(
    ['pending-for-agent', agentType, JSON.stringify(options)],
    () => agentsService.getPendingForAgent(agentType, options),
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  )

  return {
    products: data?.products || [],
    count: data?.count || 0,
    isLoading,
    error: data?.error || error,
    refresh: mutate,
  }
}

export function useFailedForAgent(
  agentType: AgentType,
  options: {
    limit?: number
    offset?: number
    search?: string
    vendor?: string
  } = {}
) {
  const { data, error, isLoading, mutate } = useSWR(
    ['failed-for-agent', agentType, JSON.stringify(options)],
    () => agentsService.getFailedForAgent(agentType, options),
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
    }
  )

  return {
    products: data?.products || [],
    count: data?.count || 0,
    isLoading,
    error: data?.error || error,
    refresh: mutate,
  }
}
