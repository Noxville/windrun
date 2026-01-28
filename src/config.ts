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

// Use production API by default, can be overridden via environment variable
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://api.windrun.io'

export const CDN_BASE = 'https://cdn.datdota.com/images'

export function heroImageUrl(picture: string): string {
  return `${CDN_BASE}/heroes/${picture}_full.png`
}

export function heroMiniUrl(picture: string): string {
  return `${CDN_BASE}/miniheroes/${picture}.png`
}

export function abilityIconUrl(shortName: string): string {
  return `${CDN_BASE}/ability/${shortName}.png`
}

export function itemIconUrl(shortName: string): string {
  return `${CDN_BASE}/items/${shortName}.png`
}
