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
import { API_BASE_URL } from '../config'

interface User {
  id: number
  name: string
  avatar: string
}

export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ['user'],
    queryFn: async () => {
      // TODO: Enable when /user/verify endpoint is implemented
      // try {
      //   return await apiFetch<User>('/user/verify')
      // } catch {
      //   return null
      // }
      return null
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useAuth() {
  const queryClient = useQueryClient()
  const { data: user, isLoading } = useCurrentUser()

  const login = () => {
    const returnUrl = encodeURIComponent(window.location.href)
    window.location.href = `${API_BASE_URL}/user/login?returnUrl=${returnUrl}`
  }

  const logout = () => {
    const returnUrl = encodeURIComponent(window.location.origin)
    queryClient.setQueryData(['user'], null)
    window.location.href = `${API_BASE_URL}/user/logout?returnUrl=${returnUrl}`
  }

  return { user, isLoading, login, logout }
}
