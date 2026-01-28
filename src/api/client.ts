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

import { API_BASE_URL } from '../config'

export class ApiError extends Error {
  status: number
  retryAfter: number | null

  constructor(status: number, retryAfter: number | null, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
  })

  if (!response.ok) {
    const retryAfter = response.headers.get('Retry-After')
    throw new ApiError(
      response.status,
      retryAfter ? parseInt(retryAfter, 10) : null,
      `API error: ${response.status} ${response.statusText}`,
    )
  }

  return response.json()
}
