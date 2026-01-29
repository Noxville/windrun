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

import { useQuery, useQueryClient } from '@tanstack/react-query'

// Full URL needed for browser redirects (login/logout)
const AUTH_BASE_URL = 'https://api.windrun.io'

export interface User {
  id: number
  name: string
  avatar: string
}

export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ['user'],
    queryFn: async () => {
      const url = `${AUTH_BASE_URL}/api/v2/user/me`
      try {
        const response = await fetch(url, { credentials: 'include' })
        if (!response.ok) {
          return null
        }
        return await response.json()
      } catch {
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useAuth() {
  const queryClient = useQueryClient()
  const { data: user, isLoading } = useCurrentUser()

  const login = () => {
    const returnUrl = encodeURIComponent(window.location.href)
    window.location.href = `${AUTH_BASE_URL}/user/login?returnUrl=${returnUrl}`
  }

  const logout = () => {
    const returnUrl = encodeURIComponent(window.location.origin)
    queryClient.setQueryData(['user'], null)
    window.location.href = `${AUTH_BASE_URL}/user/logout?returnUrl=${returnUrl}`
  }

  return { user, isLoading, login, logout }
}
