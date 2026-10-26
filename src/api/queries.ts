/**
 * Copyright (C) 2026 Ben Steenhuisen
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { apiFetch, ApiError } from './client'
import type { PlayerProfile, PlayerMatch, PlayerStats, StatsWindow } from '../types'

function retryOn503(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status === 503) {
    return failureCount < 10
  }
  // Retrying a client error never changes the answer
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < 3
}

function retryDelay(failureCount: number, error: Error): number {
  if (error instanceof ApiError && error.retryAfter) {
    return error.retryAfter * 1000
  }
  return Math.min(1000 * 2 ** failureCount, 30000)
}

export function usePersistedQuery<T>(
  path: string | null,
  params?: Record<string, string>,
  options?: { enabled?: boolean }
) {
  const searchParams = params ? '?' + new URLSearchParams(params).toString() : ''
  const enabled = options?.enabled !== false && path !== null
  const paramsKey = params ? new URLSearchParams(params).toString() : ''
  return useQuery<T>({
    queryKey: ['query', path, paramsKey],
    queryFn: () => apiFetch<T>(`/api/v2${path}${searchParams}`),
    staleTime: 5 * 60 * 1000,
    retry: retryOn503,
    retryDelay,
    enabled,
  })
}

export function useMatchData(matchId: string) {
  return useQuery({
    queryKey: ['match', matchId],
    queryFn: () => apiFetch(`/api/v2/matches/${matchId}`),
    staleTime: Infinity,
  })
}

export function useMatchMeta(matchId: string) {
  return useQuery({
    queryKey: ['match-meta', matchId],
    queryFn: () => apiFetch(`/api/v2/matches/${matchId}/meta`),
    staleTime: 60 * 1000,
  })
}

export function usePlayerData(playerId: string) {
  return useQuery<{ data: PlayerProfile }>({
    queryKey: ['player', playerId],
    queryFn: () => apiFetch(`/api/v2/players/${playerId}`),
    staleTime: 60 * 1000,
  })
}

export function usePlayerMatches(playerId: string, page: number = 0) {
  return useQuery<PlayerMatch[]>({
    queryKey: ['player-matches', playerId, page],
    queryFn: () => apiFetch(`/api/v2/players/${playerId}/matches?page=${page}`),
    staleTime: 60 * 1000,
  })
}

export function usePlayerStats(playerId: string, window: StatsWindow = 'lifetime') {
  return useQuery<{ window: StatsWindow; stats: PlayerStats }>({
    queryKey: ['player-stats', playerId, window],
    queryFn: () =>
      apiFetch(`/api/v2/players/${playerId}/stats?window=${window}`),
    staleTime: 60 * 1000,
    // Keep the old window's panels on screen while the new one loads
    placeholderData: keepPreviousData,
  })
}
