export interface LeagueMatch {
  match_id: number
  league_id: number
  league_name: string
  league_tier: string
  game_start: number
  radiant_heroes: number[]
  dire_heroes: number[]
  radiant_avg_rating?: number
  dire_avg_rating?: number
}

export interface LeagueInfo {
  league_id: number
  name: string
  tier: string
}
