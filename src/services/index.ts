/**
 * Services Index
 *
 * Central export for all services.
 * Import services like: import { authService, productsService } from '@/services'
 */

export { authService } from './auth.service'
export { productsService } from './products.service'
export { realtimeService } from './realtime.service'
export { agentsService } from './agents.service'
export { statsService } from './stats.service'
export { activityStatsService } from './activityStats.service'
export { erpnextService } from './erpnext.service'
export { apiHealthService } from './apiHealth.service'

export type { SignInCredentials, SignUpCredentials, AuthResponse } from './auth.service'
export type { TriggerAgentParams, RetryAgentParams, AgentType } from './agents.service'
export type { ChangeEventType, ChangePayload } from './realtime.service'
export type { AgentFilter, ActivityStats } from './activityStats.service'
export type { ErpnextPushResponse, ErpnextPushResult } from './erpnext.service'
export type { KeyType, HealthStatus, AgentToolStatus } from './apiHealth.service'
