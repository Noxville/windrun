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

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { HeroMap, Ability } from '../types'

export function useHeroes() {
  return useQuery({
    queryKey: ['static', 'heroes'],
    queryFn: () => apiFetch<HeroMap>('/api/v2/static/heroes'),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useAbilities() {
  return useQuery({
    queryKey: ['static', 'abilities'],
    queryFn: () => apiFetch<Ability[]>('/api/v2/static/abilities'),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
