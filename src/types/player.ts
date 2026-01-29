export interface PlayerProfile {
  steamId: number
  nickname: string
  avatar: string
  rating: number
  region: string
  overallRank: number | null
  regionalRank: number | null
  lastMatch: number
  percentile: number | null
  wins: number
  losses: number
}

export interface PlayerMatchPlayer {
  steamId: number
  name: string
  topX?: number
  rating?: number
  hero: number
  winLoss?: { wins: number; losses: number }
  abilities: number[]
  items: number[]
  kills: number
  deaths: number
  assists: number
  gpm: number
  xpm: number
  lastHits: number
  heroDamage: number
  heroHealing: number
}

export interface PlayerMatch {
  matchId: number
  radiant: PlayerMatchPlayer[]
  dire: PlayerMatchPlayer[]
  radiantWin: boolean
  region: string
  patch: string
  gameStart: string  // ISO date string
  duration: number
  delta?: number
}

export interface WinLossStats {
  wins: number
  losses: number
  total: number
  winrate: number
}

export interface AllyRivalStats {
  player: {
    nickname: string
    steamId: number
  }
  winLoss: WinLossStats
}

export interface SpellStat {
  wins: number
  losses: number
  winrate: number
  avgPickPosition: number
}

export interface PlayerStats {
  allies: Record<string, AllyRivalStats>
  rivals: Record<string, AllyRivalStats>
  heroStats: Record<string, WinLossStats>
  spellStats: Record<string, SpellStat>
  seatStats: Record<string, WinLossStats>
  factionStats: {
    RADIANT: WinLossStats
    DIRE: WinLossStats
  }
  rangedMeleeStats?: Record<string, WinLossStats>
  endGameItemStats?: Record<string, unknown>
}
