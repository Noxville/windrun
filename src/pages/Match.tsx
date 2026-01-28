import { useMemo, useLayoutEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { AbilityIcon } from '../components'
import { usePersistedQuery } from '../api'
import { getHeroById, getAbilityById, getItemById } from '../data'
import { heroMiniUrl, itemIconUrl } from '../config'
import styles from './Match.module.css'

interface PlayerData {
  steamId: number
  name: string
  hero: number
  abilities: number[]
  kills: number
  deaths: number
  assists: number
  gpm: number
  xpm: number
  lastHits: number
  heroDamage: number
  heroHealing: number
  items: number[]
  rating: number
  topX: number
  winLoss: {
    wins: number
    losses: number
    total: number
    winrate: number
  }
}

interface PickData {
  abilityId: number
  pickOrder: number
}

interface MatchApiResponse {
  data: {
    matchId: number
    gameStart: string
    duration: number
    region: string
    patch: string
    radiantWin: boolean
    radiant: PlayerData[]
    dire: PlayerData[]
    picks: PickData[]
    ignoredSpells: Array<{ abilityId: number }>
  }
}

interface AbilitiesApiResponse {
  data: {
    abilityStats: Array<{
      abilityId: number
      winrate: number
      numPicks: number
      avgPickPosition: number
    }>
  }
}

interface AbilityPairsApiResponse {
  data: {
    abilityPairs: Array<{
      abilityIdOne: number
      abilityIdTwo: number
      numPicks: number
      wins: number
      winrate: number
    }>
    abilityStats: Array<{
      abilityId: number
      winrate: number
    }>
  }
}

interface AbilityShiftsApiResponse {
  data: {
    abilityShifts: Array<{
      abilityId: number
      killsShift: number
      deathsShift: number
      killAssistShift: number
      gpmShift: number
      xpmShift: number
      dmgShift: number
      healingShift: number
    }>
  }
}

interface AghsStatBlock {
  wins: number
  losses: number
  total: number
  winrate: number
}

interface AbilityAghsApiResponse {
  data: {
    abilityAghs: Array<{
      abilityId: number
      totalGames: number
      aghsScepter: AghsStatBlock
      aghsShard: AghsStatBlock
    }>
  }
}

// Use wider viewport for this page
function useWiderViewport() {
  useLayoutEffect(() => {
    const appMain = document.querySelector('.app-main')
    if (appMain) {
      appMain.classList.add('app-main-wide')
    }
    return () => {
      if (appMain) {
        appMain.classList.remove('app-main-wide')
      }
    }
  }, [])
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRating(rating: number): string {
  return Math.round(rating).toLocaleString()
}

function getTopXLabel(topX: number): string | null {
  if (topX <= 100) return 'TOP 100'
  if (topX <= 500) return 'TOP 500'
  if (topX <= 1000) return 'TOP 1K'
  return null
}

// Get winrate color gradient (red to green) - more extreme visibility
function getWinrateColor(winrate: number): string {
  // Clamp between 35% and 65% for visible gradient
  const clamped = Math.max(0.35, Math.min(0.65, winrate))
  const normalized = (clamped - 0.35) / 0.3 // 0 = 35%, 1 = 65%

  if (normalized < 0.5) {
    // Red zone (35-50%): bright red to yellow
    const intensity = normalized * 2 // 0 to 1 within red zone
    const r = 240
    const g = Math.round(50 + intensity * 150) // 50 -> 200
    const b = 50
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Green zone (50-65%): yellow to bright green
    const intensity = (normalized - 0.5) * 2 // 0 to 1 within green zone
    const r = Math.round(200 - intensity * 160) // 200 -> 40
    const g = Math.round(200 + intensity * 40) // 200 -> 240
    const b = Math.round(50 + intensity * 30) // 50 -> 80
    return `rgb(${r}, ${g}, ${b})`
  }
}

// Fix hero swap bug
function fixHeroSwaps(radiant: PlayerData[], dire: PlayerData[]): { radiant: PlayerData[]; dire: PlayerData[] } {
  const allPlayers = [...radiant, ...dire]
  const fixedPlayers = allPlayers.map(p => ({ ...p, abilities: [...p.abilities] }))

  for (let i = 0; i < fixedPlayers.length; i++) {
    const player = fixedPlayers[i]
    const heroInnateIdx = player.abilities.findIndex(a => a < 0)
    if (heroInnateIdx === -1) continue

    const innateHeroId = Math.abs(player.abilities[heroInnateIdx])

    if (innateHeroId !== player.hero) {
      const swapPartner = fixedPlayers.find(p => p.hero === innateHeroId && p !== player)
      if (swapPartner) {
        const temp = player.abilities
        player.abilities = swapPartner.abilities
        swapPartner.abilities = temp
      }
    }
  }

  return {
    radiant: fixedPlayers.slice(0, 5),
    dire: fixedPlayers.slice(5),
  }
}

// Calculate log-weighted ability synergy
function calculateAbilitySynergy(
  abilities: number[],
  pairsMap: Map<string, { winrate: number; numPicks: number }>,
  abilityWinrates: Map<number, number>
): number | null {
  let totalWeight = 0
  let weightedSum = 0

  const filteredAbilities = abilities.filter(id => id > 0)

  for (let i = 0; i < filteredAbilities.length; i++) {
    for (let j = i + 1; j < filteredAbilities.length; j++) {
      const a = filteredAbilities[i]
      const b = filteredAbilities[j]
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      const pair = pairsMap.get(key)

      if (pair && pair.numPicks >= 10) {
        const wrA = abilityWinrates.get(a) ?? 0.5
        const wrB = abilityWinrates.get(b) ?? 0.5
        const expected = (wrA + wrB) / 2
        const synergy = pair.winrate - expected
        const weight = Math.log(pair.numPicks)

        weightedSum += synergy * weight
        totalWeight += weight
      }
    }
  }

  if (totalWeight === 0) return null
  return weightedSum / totalWeight
}

// Get golden glow style for a stat
function getStatGlowStyle(advantage: number, scale: number): React.CSSProperties {
  const intensity = Math.min(1, Math.max(0, advantage / scale))
  if (intensity <= 0) return {}
  return {
    boxShadow: `0 0 ${4 + intensity * 8}px rgba(212, 201, 160, ${0.3 + intensity * 0.5})`,
    borderColor: `rgba(212, 201, 160, ${0.4 + intensity * 0.5})`,
  }
}

interface PlayerCardProps {
  player: PlayerData
  isWinner: boolean
  side: 'radiant' | 'dire'
  pickOrderMap: Map<number, number>
  abilityWinrates: Map<number, number>
  abilityPairs: Map<string, { winrate: number; numPicks: number }>
}

function PlayerCard({ player, isWinner, side, pickOrderMap, abilityWinrates, abilityPairs }: PlayerCardProps) {
  const hero = getHeroById(player.hero)
  const topXLabel = getTopXLabel(player.topX)

  const resolvedAbilities = player.abilities.map(abilityId => {
    const pickOrder = pickOrderMap.get(abilityId)
    const winrate = abilityWinrates.get(abilityId)

    if (abilityId < 0) {
      const innateHero = getHeroById(Math.abs(abilityId))
      return {
        id: abilityId,
        name: innateHero?.englishName ?? `Hero ${Math.abs(abilityId)}`,
        shortName: innateHero?.picture ?? '',
        isHeroInnate: true,
        pickOrder,
        winrate: winrate ?? null,
      }
    }
    const ability = getAbilityById(abilityId)
    return {
      id: abilityId,
      name: ability?.englishName ?? `Ability ${abilityId}`,
      shortName: ability?.shortName ?? '',
      isUltimate: ability?.isUltimate ?? false,
      isHeroInnate: false,
      pickOrder,
      winrate: winrate ?? null,
    }
  })

  const topPairs = useMemo(() => {
    // Include all ability pairs including hero innates (negative IDs)
    const allAbilities = player.abilities
    const pairs: Array<{
      abilityA: number
      abilityB: number
      winrate: number
      synergy: number
    }> = []

    for (let i = 0; i < allAbilities.length; i++) {
      for (let j = i + 1; j < allAbilities.length; j++) {
        const a = allAbilities[i]
        const b = allAbilities[j]
        const key = a < b ? `${a}-${b}` : `${b}-${a}`
        const pair = abilityPairs.get(key)

        if (pair) {
          const wrA = abilityWinrates.get(a) ?? 0.5
          const wrB = abilityWinrates.get(b) ?? 0.5
          const expected = (wrA + wrB) / 2
          pairs.push({
            abilityA: a,
            abilityB: b,
            winrate: pair.winrate,
            synergy: pair.winrate - expected,
          })
        }
      }
    }

    return pairs.sort((a, b) => Math.abs(b.synergy) - Math.abs(a.synergy)).slice(0, 10)
  }, [player.abilities, abilityPairs, abilityWinrates])

  const itemsContent = (
    <div className={styles.itemGrid}>
      {[0, 1, 2, 3, 4, 5].map(idx => {
        const itemId = player.items[idx]
        const item = itemId ? getItemById(itemId) : null
        return (
          <div key={idx} className={styles.itemSlot}>
            {itemId ? (
              item ? (
                <img
                  src={itemIconUrl(item.shortName)}
                  alt={item.nameEnglishLoc}
                  title={item.nameEnglishLoc}
                  className={styles.itemIcon}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className={styles.itemPlaceholder} title={`Item #${itemId}`} />
              )
            ) : (
              <div className={styles.itemEmpty} />
            )}
          </div>
        )
      })}
    </div>
  )

  const statsContent = (
    <div className={styles.inGameStats}>
      <div className={styles.kda}>
        <span className={styles.kills}>{player.kills}</span>
        <span className={styles.separator}>/</span>
        <span className={styles.deaths}>{player.deaths}</span>
        <span className={styles.separator}>/</span>
        <span className={styles.assists}>{player.assists}</span>
      </div>
      <div className={styles.statMini}>
        <span className={styles.statLabel}>GPM</span>
        <span className={styles.statValue}>{player.gpm}</span>
      </div>
      <div className={styles.statMini}>
        <span className={styles.statLabel}>XPM</span>
        <span className={styles.statValue}>{player.xpm}</span>
      </div>
      <div className={styles.statMini}>
        <span className={styles.statLabel}>LH</span>
        <span className={styles.statValue}>{player.lastHits}</span>
      </div>
      <div className={styles.statMini}>
        <span className={styles.statLabel}>DMG</span>
        <span className={styles.statValue}>{(player.heroDamage / 1000).toFixed(1)}k</span>
      </div>
    </div>
  )

  const pairsContent = (
    <div className={styles.pairsList}>
      {topPairs.length > 0 ? topPairs.map((pair, idx) => {
        // Handle both regular abilities and hero innates (negative IDs)
        const isHeroA = pair.abilityA < 0
        const isHeroB = pair.abilityB < 0
        const abilityA = isHeroA ? null : getAbilityById(pair.abilityA)
        const abilityB = isHeroB ? null : getAbilityById(pair.abilityB)
        const heroA = isHeroA ? getHeroById(Math.abs(pair.abilityA)) : null
        const heroB = isHeroB ? getHeroById(Math.abs(pair.abilityB)) : null

        const nameA = isHeroA ? heroA?.englishName ?? '' : abilityA?.englishName ?? ''
        const nameB = isHeroB ? heroB?.englishName ?? '' : abilityB?.englishName ?? ''

        const synergyColor = pair.synergy > 0.02 ? 'var(--color-positive)'
          : pair.synergy < -0.02 ? 'var(--color-negative)'
          : 'var(--color-text-muted)'
        return (
          <div key={idx} className={styles.pairItem} title={`${nameA} + ${nameB}`}>
            <div className={styles.pairIcons}>
              {isHeroA ? (
                <a href={`/heroes/${Math.abs(pair.abilityA)}`} target="_blank" rel="noopener noreferrer" title={nameA} className={styles.pairHeroLink}>
                  <img
                    src={heroMiniUrl(heroA?.picture ?? '')}
                    alt={nameA}
                    className={styles.pairHeroIcon}
                  />
                </a>
              ) : (
                <AbilityIcon
                  id={pair.abilityA}
                  name={nameA}
                  shortName={abilityA?.shortName ?? ''}
                  isUltimate={abilityA?.isUltimate ?? false}
                  size="xs"
                  linkTo={`/abilities/${pair.abilityA}`}
                  newTab
                />
              )}
              <span className={styles.pairPlus}>+</span>
              {isHeroB ? (
                <a href={`/heroes/${Math.abs(pair.abilityB)}`} target="_blank" rel="noopener noreferrer" title={nameB} className={styles.pairHeroLink}>
                  <img
                    src={heroMiniUrl(heroB?.picture ?? '')}
                    alt={nameB}
                    className={styles.pairHeroIcon}
                  />
                </a>
              ) : (
                <AbilityIcon
                  id={pair.abilityB}
                  name={nameB}
                  shortName={abilityB?.shortName ?? ''}
                  isUltimate={abilityB?.isUltimate ?? false}
                  size="xs"
                  linkTo={`/abilities/${pair.abilityB}`}
                  newTab
                />
              )}
            </div>
            <span className={styles.pairWinrate}>
              {(pair.winrate * 100).toFixed(0)}%
            </span>
            <span className={styles.pairSynergy} style={{ color: synergyColor }}>
              {pair.synergy > 0 ? '+' : ''}{(pair.synergy * 100).toFixed(1)}%
            </span>
          </div>
        )
      }) : (
        <div className={styles.pairItem} style={{ opacity: 0.3 }}>
          <span className={styles.pairWinrate}>—</span>
        </div>
      )}
    </div>
  )

  const heroBlock = (
    <div className={styles.heroBlock}>
      {hero && (
        <a href={`/heroes/${player.hero}`} target="_blank" rel="noopener noreferrer" title={hero.englishName} className={styles.heroIconLink}>
          <img
            src={heroMiniUrl(hero.picture)}
            alt={hero.englishName}
            className={styles.heroIcon}
          />
        </a>
      )}
      {topXLabel && <span className={styles.topXBadge}>{topXLabel}</span>}
      <span className={styles.rating}>{formatRating(player.rating)}</span>
      <span className={styles.gamesPlayed}>
        {player.winLoss.total.toLocaleString()} games
      </span>
    </div>
  )

  const abilitiesBlock = (
    <div className={styles.abilities}>
      {resolvedAbilities.map((ability, idx) => (
        <div key={idx} className={styles.abilitySlot}>
          {ability.isHeroInnate ? (
            <a href={`/heroes/${Math.abs(ability.id)}`} target="_blank" rel="noopener noreferrer" className={styles.heroInnate} title={ability.name}>
              <img
                src={heroMiniUrl(ability.shortName)}
                alt={ability.name}
                className={styles.innateIcon}
              />
              {ability.pickOrder && (
                <span className={styles.pickOrder}>{ability.pickOrder}</span>
              )}
            </a>
          ) : (
            <div className={styles.abilityWrapper}>
              <AbilityIcon
                id={ability.id}
                name={ability.name}
                shortName={ability.shortName}
                isUltimate={ability.isUltimate}
                size="lg"
                linkTo={`/abilities/${ability.id}`}
                newTab
              />
              {ability.pickOrder && (
                <span className={styles.pickOrder}>{ability.pickOrder}</span>
              )}
            </div>
          )}
          {ability.winrate !== null && (
            <div
              className={styles.abilityWinrateBig}
              style={{
                background: `linear-gradient(135deg, ${getWinrateColor(ability.winrate)}33, ${getWinrateColor(ability.winrate)}11)`,
                borderColor: getWinrateColor(ability.winrate),
              }}
            >
              {(ability.winrate * 100).toFixed(1)}%
            </div>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className={`${styles.playerCard} ${isWinner ? styles.winner : ''} ${styles[side]}`}>
      <div className={styles.mainContent}>
        {/* Same order for both - CSS flex-direction handles the mirroring */}
        {heroBlock}
        {statsContent}
        {itemsContent}
        {abilitiesBlock}
        {pairsContent}
      </div>
    </div>
  )
}

export function MatchPage() {
  useWiderViewport()
  const { matchId } = useParams()
  const [copied, setCopied] = useState(false)
  const [hoveredStat, setHoveredStat] = useState<string | null>(null)

  const copyMatchId = useCallback(() => {
    if (matchId) {
      navigator.clipboard.writeText(matchId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [matchId])

  const { data: matchResponse, isLoading: matchLoading, error: matchError } = usePersistedQuery<MatchApiResponse>(
    matchId ? `/matches/${matchId}` : null
  )

  const matchData = matchResponse?.data
  const patch = matchData?.patch

  const { data: abilitiesResponse } = usePersistedQuery<AbilitiesApiResponse>(
    '/abilities',
    patch ? { patch } : undefined,
    { enabled: !!patch }
  )

  const { data: pairsResponse } = usePersistedQuery<AbilityPairsApiResponse>(
    '/ability-pairs',
    patch ? { patch } : undefined,
    { enabled: !!patch }
  )

  const { data: shiftsResponse } = usePersistedQuery<AbilityShiftsApiResponse>(
    '/ability-shifts',
    patch ? { patch } : undefined,
    { enabled: !!patch }
  )

  const { data: aghsResponse } = usePersistedQuery<AbilityAghsApiResponse>(
    '/ability-aghs',
    patch ? { patch } : undefined,
    { enabled: !!patch }
  )

  const pickOrderMap = useMemo(() => {
    const map = new Map<number, number>()
    matchData?.picks?.forEach(pick => {
      map.set(pick.abilityId, pick.pickOrder)
    })
    return map
  }, [matchData?.picks])

  const abilityWinrates = useMemo(() => {
    const map = new Map<number, number>()
    abilitiesResponse?.data?.abilityStats?.forEach(stat => {
      map.set(stat.abilityId, stat.winrate)
    })
    return map
  }, [abilitiesResponse])

  const abilityAvgPickPos = useMemo(() => {
    const map = new Map<number, number>()
    abilitiesResponse?.data?.abilityStats?.forEach(stat => {
      map.set(stat.abilityId, stat.avgPickPosition)
    })
    return map
  }, [abilitiesResponse])

  const abilityPairs = useMemo(() => {
    const map = new Map<string, { winrate: number; numPicks: number }>()
    pairsResponse?.data?.abilityPairs?.forEach(pair => {
      const key = pair.abilityIdOne < pair.abilityIdTwo
        ? `${pair.abilityIdOne}-${pair.abilityIdTwo}`
        : `${pair.abilityIdTwo}-${pair.abilityIdOne}`
      map.set(key, { winrate: pair.winrate, numPicks: pair.numPicks })
    })
    return map
  }, [pairsResponse])

  const abilityShifts = useMemo(() => {
    const map = new Map<number, {
      killsShift: number
      deathsShift: number
      killAssistShift: number
      gpmShift: number
      xpmShift: number
      dmgShift: number
      healingShift: number
    }>()
    shiftsResponse?.data?.abilityShifts?.forEach(shift => {
      map.set(shift.abilityId, {
        killsShift: shift.killsShift,
        deathsShift: shift.deathsShift,
        killAssistShift: shift.killAssistShift,
        gpmShift: shift.gpmShift,
        xpmShift: shift.xpmShift,
        dmgShift: shift.dmgShift,
        healingShift: shift.healingShift,
      })
    })
    return map
  }, [shiftsResponse])

  const abilityAghs = useMemo(() => {
    const map = new Map<number, { scepterPickRate: number; shardPickRate: number }>()
    aghsResponse?.data?.abilityAghs?.forEach(aghs => {
      if (aghs.totalGames > 0) {
        map.set(aghs.abilityId, {
          scepterPickRate: aghs.aghsScepter.total / aghs.totalGames,
          shardPickRate: aghs.aghsShard.total / aghs.totalGames,
        })
      }
    })
    return map
  }, [aghsResponse])

  const { fixedRadiant, fixedDire, teamStats } = useMemo(() => {
    if (!matchData) return { fixedRadiant: [], fixedDire: [], teamStats: null }

    const { radiant, dire } = fixHeroSwaps(matchData.radiant, matchData.dire)

    const calcTeamStats = (players: PlayerData[]) => {
      const avgRating = players.reduce((sum, p) => sum + p.rating, 0) / players.length

      let totalAbilityWinrate = 0
      let totalPickPos = 0
      let abilityCount = 0
      players.forEach(p => {
        p.abilities.forEach(id => {
          if (id > 0) {
            const wr = abilityWinrates.get(id)
            const pickPos = abilityAvgPickPos.get(id)
            if (wr !== undefined) {
              totalAbilityWinrate += wr
            }
            if (pickPos !== undefined) {
              totalPickPos += pickPos
            }
            abilityCount++
          }
        })
      })
      const avgAbilityWinrate = abilityCount > 0 ? totalAbilityWinrate / abilityCount : 0.5
      const avgPickPos = abilityCount > 0 ? totalPickPos / abilityCount : null

      let totalSynergy = 0
      let synergyCount = 0
      players.forEach(p => {
        const synergy = calculateAbilitySynergy(p.abilities, abilityPairs, abilityWinrates)
        if (synergy !== null) {
          totalSynergy += synergy
          synergyCount++
        }
      })
      const avgSynergy = synergyCount > 0 ? totalSynergy / synergyCount : null

      return {
        kills: players.reduce((sum, p) => sum + p.kills, 0),
        avgRating,
        avgAbilityWinrate,
        avgSynergy,
        avgPickPos,
      }
    }

    return {
      fixedRadiant: radiant,
      fixedDire: dire,
      teamStats: {
        radiant: calcTeamStats(radiant),
        dire: calcTeamStats(dire),
      },
    }
  }, [matchData, abilityWinrates, abilityPairs, abilityAvgPickPos])

  if (matchError) {
    return (
      <PageShell title="">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading match data. Please try again later.
        </p>
      </PageShell>
    )
  }

  if (matchLoading || !matchData) {
    return (
      <PageShell title="">
        <div className={styles.loading}>Loading match data...</div>
      </PageShell>
    )
  }

  const ratingAdv = teamStats ? teamStats.radiant.avgRating - teamStats.dire.avgRating : 0
  const abilityAdv = teamStats ? teamStats.radiant.avgAbilityWinrate - teamStats.dire.avgAbilityWinrate : 0
  const synergyAdv = teamStats && teamStats.radiant.avgSynergy !== null && teamStats.dire.avgSynergy !== null
    ? (teamStats.radiant.avgSynergy - teamStats.dire.avgSynergy)
    : null

  return (
    <PageShell title="">
      {/* Compact Header */}
      <div className={styles.header}>
        <span className={styles.headerDate}>{formatDate(matchData.gameStart)}</span>
        <span className={styles.headerSep}>•</span>
        <span className={styles.headerInfo}>{matchData.region}</span>
        <span className={styles.headerSep}>•</span>
        <span className={styles.headerInfo}>{formatDuration(matchData.duration)}</span>
        <span className={styles.headerSep}>•</span>
        <span className={styles.headerInfo}>Patch {patch}</span>
        <span className={styles.headerSep}>•</span>
        <button className={styles.matchIdButton} onClick={copyMatchId} title="Click to copy">
          #{matchId} {copied && <span className={styles.copiedBadge}>Copied!</span>}
        </button>
        <div className={styles.headerLinks}>
          <a
            href={`https://www.dotabuff.com/matches/${matchId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.externalLink}
            title="View on Dotabuff"
          >
            <img src="https://www.dotabuff.com/favicon.ico" alt="Dotabuff" className={styles.externalIcon} />
          </a>
          <a
            href={`https://www.opendota.com/matches/${matchId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.externalLink}
            title="View on OpenDota"
          >
            <img src="/opendota-icon.png" alt="OpenDota" className={styles.externalIcon} />
          </a>
        </div>
      </div>

      {/* Team Headers with Inline Stats */}
      <div className={styles.teamHeaderRow}>
        {/* Radiant Stats */}
        {teamStats && (
          <div className={styles.teamStatsInline}>
            <div
              className={`${styles.teamStatInline} ${hoveredStat === 'rating' ? styles.statHighlight : ''}`}
              style={getStatGlowStyle(ratingAdv, 200)}
              onMouseEnter={() => setHoveredStat('rating')}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span className={styles.teamStatVal}>{Math.round(teamStats.radiant.avgRating).toLocaleString()}</span>
              <span className={styles.teamStatLbl}>Avg Rating</span>
            </div>
            <div
              className={`${styles.teamStatInline} ${hoveredStat === 'abilityWr' ? styles.statHighlight : ''}`}
              style={getStatGlowStyle(abilityAdv, 0.05)}
              onMouseEnter={() => setHoveredStat('abilityWr')}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span className={styles.teamStatVal}>{(teamStats.radiant.avgAbilityWinrate * 100).toFixed(1)}%</span>
              <span className={styles.teamStatLbl}>Ability WR</span>
            </div>
            <div
              className={`${styles.teamStatInline} ${hoveredStat === 'synergy' ? styles.statHighlight : ''}`}
              style={getStatGlowStyle(synergyAdv ?? 0, 0.03)}
              onMouseEnter={() => setHoveredStat('synergy')}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span className={styles.teamStatVal}>
                {teamStats.radiant.avgSynergy !== null ? `${teamStats.radiant.avgSynergy > 0 ? '+' : ''}${(teamStats.radiant.avgSynergy * 100).toFixed(1)}%` : '—'}
              </span>
              <span className={styles.teamStatLbl}>Synergy</span>
            </div>
            <div
              className={`${styles.teamStatInline} ${hoveredStat === 'avgPick' ? styles.statHighlight : ''}`}
              style={getStatGlowStyle(teamStats.dire.avgPickPos && teamStats.radiant.avgPickPos ? teamStats.dire.avgPickPos - teamStats.radiant.avgPickPos : 0, 5)}
              onMouseEnter={() => setHoveredStat('avgPick')}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span className={styles.teamStatVal}>
                {teamStats.radiant.avgPickPos !== null ? teamStats.radiant.avgPickPos.toFixed(1) : '—'}
              </span>
              <span className={styles.teamStatLbl}>Avg Pick #</span>
            </div>
          </div>
        )}

        {/* Radiant Header */}
        <div className={`${styles.teamHeader} ${styles.radiant} ${matchData.radiantWin ? styles.winnerTeam : ''}`}>
          <span className={styles.teamName}>Radiant</span>
          {matchData.radiantWin && <span className={styles.winnerBadge}>WINNER</span>}
          <span className={styles.teamScore}>{teamStats?.radiant.kills ?? 0}</span>
        </div>

        <div className={styles.vsColumn}>
          <span className={styles.vs}>VS</span>
        </div>

        {/* Dire Header */}
        <div className={`${styles.teamHeader} ${styles.dire} ${!matchData.radiantWin ? styles.winnerTeam : ''}`}>
          <span className={styles.teamScore}>{teamStats?.dire.kills ?? 0}</span>
          {!matchData.radiantWin && <span className={styles.winnerBadge}>WINNER</span>}
          <span className={styles.teamName}>Dire</span>
        </div>

        {/* Dire Stats (mirrored order) */}
        {teamStats && (
          <div className={styles.teamStatsInline}>
            <div
              className={`${styles.teamStatInline} ${hoveredStat === 'avgPick' ? styles.statHighlight : ''}`}
              style={getStatGlowStyle(teamStats.radiant.avgPickPos && teamStats.dire.avgPickPos ? teamStats.radiant.avgPickPos - teamStats.dire.avgPickPos : 0, 5)}
              onMouseEnter={() => setHoveredStat('avgPick')}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span className={styles.teamStatVal}>
                {teamStats.dire.avgPickPos !== null ? teamStats.dire.avgPickPos.toFixed(1) : '—'}
              </span>
              <span className={styles.teamStatLbl}>Avg Pick #</span>
            </div>
            <div
              className={`${styles.teamStatInline} ${hoveredStat === 'synergy' ? styles.statHighlight : ''}`}
              style={getStatGlowStyle(-(synergyAdv ?? 0), 0.03)}
              onMouseEnter={() => setHoveredStat('synergy')}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span className={styles.teamStatVal}>
                {teamStats.dire.avgSynergy !== null ? `${teamStats.dire.avgSynergy > 0 ? '+' : ''}${(teamStats.dire.avgSynergy * 100).toFixed(1)}%` : '—'}
              </span>
              <span className={styles.teamStatLbl}>Synergy</span>
            </div>
            <div
              className={`${styles.teamStatInline} ${hoveredStat === 'abilityWr' ? styles.statHighlight : ''}`}
              style={getStatGlowStyle(-abilityAdv, 0.05)}
              onMouseEnter={() => setHoveredStat('abilityWr')}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span className={styles.teamStatVal}>{(teamStats.dire.avgAbilityWinrate * 100).toFixed(1)}%</span>
              <span className={styles.teamStatLbl}>Ability WR</span>
            </div>
            <div
              className={`${styles.teamStatInline} ${hoveredStat === 'rating' ? styles.statHighlight : ''}`}
              style={getStatGlowStyle(-ratingAdv, 200)}
              onMouseEnter={() => setHoveredStat('rating')}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span className={styles.teamStatVal}>{Math.round(teamStats.dire.avgRating).toLocaleString()}</span>
              <span className={styles.teamStatLbl}>Avg Rating</span>
            </div>
          </div>
        )}
      </div>

      {/* Teams */}
      <div className={styles.teamsContainer}>
        <div className={styles.team}>
          {fixedRadiant.map(player => (
            <PlayerCard
              key={player.steamId}
              player={player}
              isWinner={matchData.radiantWin}
              side="radiant"
              pickOrderMap={pickOrderMap}
              abilityWinrates={abilityWinrates}
              abilityPairs={abilityPairs}
            />
          ))}
        </div>
        <div className={styles.team}>
          {fixedDire.map(player => (
            <PlayerCard
              key={player.steamId}
              player={player}
              isWinner={!matchData.radiantWin}
              side="dire"
              pickOrderMap={pickOrderMap}
              abilityWinrates={abilityWinrates}
              abilityPairs={abilityPairs}
            />
          ))}
        </div>
      </div>

      {/* Draft Replay Section */}
      <DraftReplay
        picks={matchData.picks}
        ignoredSpells={matchData.ignoredSpells}
        radiantPlayers={fixedRadiant}
        direPlayers={fixedDire}
        abilityPairs={abilityPairs}
        abilityWinrates={abilityWinrates}
        abilityShifts={abilityShifts}
        abilityAghs={abilityAghs}
      />
    </PageShell>
  )
}

// Draft Replay Component
interface DraftReplayProps {
  picks: PickData[]
  ignoredSpells: Array<{ abilityId: number }>
  radiantPlayers: PlayerData[]
  direPlayers: PlayerData[]
  abilityPairs: Map<string, { winrate: number; numPicks: number }>
  abilityWinrates: Map<number, number>
  abilityShifts: Map<number, {
    killsShift: number
    deathsShift: number
    killAssistShift: number
    gpmShift: number
    xpmShift: number
    dmgShift: number
    healingShift: number
  }>
  abilityAghs: Map<number, { scepterPickRate: number; shardPickRate: number }>
}

function DraftReplay({ picks, ignoredSpells, radiantPlayers, direPlayers, abilityPairs, abilityWinrates, abilityShifts, abilityAghs }: DraftReplayProps) {
  const [currentPick, setCurrentPick] = useState(0)
  const [pairsMode, setPairsMode] = useState<'all' | 'diffHero'>('all')
  const [aggregateSortColumn, setAggregateSortColumn] = useState<string>('default')
  const [aggregateSortDirection, setAggregateSortDirection] = useState<'asc' | 'desc'>('asc')

  // Build player ability assignments and determine draft order
  const { playerAbilities, radiantDraftOrder, direDraftOrder } = useMemo(() => {
    // Create a map of abilityId -> { playerIndex, side }
    const abilityToPlayer = new Map<number, { playerIndex: number; side: 'radiant' | 'dire' }>()
    // Track first pick order for each player
    const radiantFirstPick: Array<{ playerIndex: number; firstPickOrder: number }> = []
    const direFirstPick: Array<{ playerIndex: number; firstPickOrder: number }> = []

    radiantPlayers.forEach((p, i) => {
      let firstPick = Infinity
      p.abilities.forEach(id => {
        abilityToPlayer.set(id, { playerIndex: i, side: 'radiant' })
        const pick = picks.find(pk => pk.abilityId === id)
        if (pick && pick.pickOrder < firstPick) {
          firstPick = pick.pickOrder
        }
      })
      radiantFirstPick.push({ playerIndex: i, firstPickOrder: firstPick })
    })
    direPlayers.forEach((p, i) => {
      let firstPick = Infinity
      p.abilities.forEach(id => {
        abilityToPlayer.set(id, { playerIndex: i, side: 'dire' })
        const pick = picks.find(pk => pk.abilityId === id)
        if (pick && pick.pickOrder < firstPick) {
          firstPick = pick.pickOrder
        }
      })
      direFirstPick.push({ playerIndex: i, firstPickOrder: firstPick })
    })

    // Sort by first pick order to get draft display order
    radiantFirstPick.sort((a, b) => a.firstPickOrder - b.firstPickOrder)
    direFirstPick.sort((a, b) => a.firstPickOrder - b.firstPickOrder)

    return {
      playerAbilities: abilityToPlayer,
      radiantDraftOrder: radiantFirstPick.map(p => p.playerIndex),
      direDraftOrder: direFirstPick.map(p => p.playerIndex),
    }
  }, [radiantPlayers, direPlayers, picks])

  // Number of abilities each player ends up with
  const playerSlotCounts = useMemo(() => {
    const counts = {
      radiant: radiantPlayers.map(p => p.abilities.length),
      dire: direPlayers.map(p => p.abilities.length),
    }
    return counts
  }, [radiantPlayers, direPlayers])

  // Get abilities picked up to current pick for each player
  const playerPickedAbilities = useMemo(() => {
    const radiant: Array<Array<{ id: number; order: number }>> = Array.from({ length: 5 }, () => [])
    const dire: Array<Array<{ id: number; order: number }>> = Array.from({ length: 5 }, () => [])

    picks.slice(0, currentPick).forEach(pick => {
      const assignment = playerAbilities.get(pick.abilityId)
      if (assignment) {
        const target = assignment.side === 'radiant' ? radiant : dire
        target[assignment.playerIndex].push({ id: pick.abilityId, order: pick.pickOrder })
      }
    })

    return { radiant, dire }
  }, [picks, currentPick, playerAbilities])

  // Categorize pool abilities and sort alphabetically
  const { ultimates, spells, heroes } = useMemo(() => {
    const allAbilityIds = new Set<number>()
    picks.forEach(p => allAbilityIds.add(p.abilityId))
    ignoredSpells.forEach(s => allAbilityIds.add(s.abilityId))

    const ultimates: Array<{ id: number; name: string; shortName: string }> = []
    const spells: Array<{ id: number; name: string; shortName: string }> = []
    const heroes: Array<{ id: number; name: string; picture: string }> = []

    allAbilityIds.forEach(id => {
      if (id < 0) {
        const hero = getHeroById(Math.abs(id))
        if (hero) {
          heroes.push({ id, name: hero.englishName, picture: hero.picture })
        }
      } else {
        const ability = getAbilityById(id)
        if (ability) {
          if (ability.isUltimate) {
            ultimates.push({ id, name: ability.englishName, shortName: ability.shortName })
          } else {
            spells.push({ id, name: ability.englishName, shortName: ability.shortName })
          }
        }
      }
    })

    // Sort all arrays alphabetically by name
    ultimates.sort((a, b) => a.name.localeCompare(b.name))
    spells.sort((a, b) => a.name.localeCompare(b.name))
    heroes.sort((a, b) => a.name.localeCompare(b.name))

    return { ultimates, spells, heroes }
  }, [picks, ignoredSpells])

  // Get picked ability IDs up to current pick
  const pickedIds = useMemo(() => {
    const ids = new Set<number>()
    picks.slice(0, currentPick).forEach(p => ids.add(p.abilityId))
    return ids
  }, [picks, currentPick])

  // All ability IDs in the draft pool
  const allPoolIds = useMemo(() => {
    const ids = new Set<number>()
    picks.forEach(p => ids.add(p.abilityId))
    ignoredSpells.forEach(s => ids.add(s.abilityId))
    return ids
  }, [picks, ignoredSpells])

  // Compute best unpicked ability pairs
  const bestAvailablePairs = useMemo(() => {
    const pairs: Array<{
      abilityA: number
      abilityB: number
      winrate: number
      synergy: number
      numPicks: number
    }> = []

    // Iterate through all ability pairs that are still in pool (both unpicked)
    abilityPairs.forEach((pair, key) => {
      const [aStr, bStr] = key.split('-')
      const a = parseInt(aStr, 10)
      const b = parseInt(bStr, 10)

      // Both abilities must be in the pool and unpicked
      if (!allPoolIds.has(a) || !allPoolIds.has(b)) return
      if (pickedIds.has(a) || pickedIds.has(b)) return
      if (pair.numPicks < 10) return // Require minimum picks for relevance

      const wrA = abilityWinrates.get(a) ?? 0.5
      const wrB = abilityWinrates.get(b) ?? 0.5
      const expected = (wrA + wrB) / 2
      const synergy = pair.winrate - expected

      pairs.push({
        abilityA: a,
        abilityB: b,
        winrate: pair.winrate,
        synergy,
        numPicks: pair.numPicks,
      })
    })

    // Sort by winrate (or synergy for interesting combos)
    return pairs.sort((a, b) => b.winrate - a.winrate).slice(0, 10)
  }, [abilityPairs, abilityWinrates, allPoolIds, pickedIds])

  // Compute best unpicked ability pairs from different heroes
  const bestAvailablePairsDiffHeroes = useMemo(() => {
    const pairs: Array<{
      abilityA: number
      abilityB: number
      winrate: number
      synergy: number
      numPicks: number
    }> = []

    // Helper to get hero ID from ability ID
    const getHeroIdForAbility = (id: number): number | null => {
      if (id < 0) return Math.abs(id) // Hero innate
      const ability = getAbilityById(id)
      return ability?.ownerHeroId ?? null
    }

    // Iterate through all ability pairs that are still in pool (both unpicked)
    abilityPairs.forEach((pair, key) => {
      const [aStr, bStr] = key.split('-')
      const a = parseInt(aStr, 10)
      const b = parseInt(bStr, 10)

      // Both abilities must be in the pool and unpicked
      if (!allPoolIds.has(a) || !allPoolIds.has(b)) return
      if (pickedIds.has(a) || pickedIds.has(b)) return
      if (pair.numPicks < 10) return // Require minimum picks for relevance

      // Check if abilities are from different heroes
      const heroA = getHeroIdForAbility(a)
      const heroB = getHeroIdForAbility(b)
      if (heroA === null || heroB === null) return
      if (heroA === heroB) return // Skip same hero pairs

      const wrA = abilityWinrates.get(a) ?? 0.5
      const wrB = abilityWinrates.get(b) ?? 0.5
      const expected = (wrA + wrB) / 2
      const synergy = pair.winrate - expected

      pairs.push({
        abilityA: a,
        abilityB: b,
        winrate: pair.winrate,
        synergy,
        numPicks: pair.numPicks,
      })
    })

    // Sort by winrate
    return pairs.sort((a, b) => b.winrate - a.winrate).slice(0, 10)
  }, [abilityPairs, abilityWinrates, allPoolIds, pickedIds])

  // Compute best unpicked abilities
  const bestAvailableAbilities = useMemo(() => {
    const abilities: Array<{
      id: number
      winrate: number
    }> = []

    abilityWinrates.forEach((winrate, id) => {
      // Must be in pool and unpicked
      if (!allPoolIds.has(id)) return
      if (pickedIds.has(id)) return

      abilities.push({ id, winrate })
    })

    return abilities.sort((a, b) => b.winrate - a.winrate).slice(0, 10)
  }, [abilityWinrates, allPoolIds, pickedIds])

  // Get ability type (spell, ultimate, hero)
  const getAbilityType = (id: number): 'spell' | 'ultimate' | 'hero' => {
    if (id < 0) return 'hero'
    const ability = getAbilityById(id)
    return ability?.isUltimate ? 'ultimate' : 'spell'
  }

  // Compute synergy suggestions for a player
  const getPlayerSynergies = (side: 'radiant' | 'dire', playerIndex: number) => {
    const pickedAbilities = side === 'radiant'
      ? playerPickedAbilities.radiant[playerIndex]
      : playerPickedAbilities.dire[playerIndex]

    // Calculate what types the player still needs
    const needed = getNeededTypes()
    const picked = getPickedTypeCounts(pickedAbilities)
    const remaining = {
      spells: Math.max(0, needed.spells - picked.spells),
      ultimates: Math.max(0, needed.ultimates - picked.ultimates),
      heroes: Math.max(0, needed.heroes - picked.heroes),
    }

    // Get all abilities this player has picked (just the IDs)
    const playerAbilityIds = new Set(pickedAbilities.map(a => a.id))
    if (playerAbilityIds.size === 0) return []

    const synergies: Array<{
      poolAbilityId: number
      winrate: number
      synergy: number
    }> = []

    // For each pair where one ability is owned by this player
    abilityPairs.forEach((pair, key) => {
      const [aStr, bStr] = key.split('-')
      const a = parseInt(aStr, 10)
      const b = parseInt(bStr, 10)

      let ownedId: number | null = null
      let poolId: number | null = null

      if (playerAbilityIds.has(a) && !pickedIds.has(b) && allPoolIds.has(b)) {
        ownedId = a
        poolId = b
      } else if (playerAbilityIds.has(b) && !pickedIds.has(a) && allPoolIds.has(a)) {
        ownedId = b
        poolId = a
      }

      if (!poolId) return
      if (pair.numPicks < 10) return

      // Check if the pool ability is a valid type for this player
      const poolType = getAbilityType(poolId)
      if (poolType === 'spell' && remaining.spells === 0) return
      if (poolType === 'ultimate' && remaining.ultimates === 0) return
      if (poolType === 'hero' && remaining.heroes === 0) return

      const wrOwned = abilityWinrates.get(ownedId!) ?? 0.5
      const wrPool = abilityWinrates.get(poolId) ?? 0.5
      const expected = (wrOwned + wrPool) / 2
      const synergy = pair.winrate - expected

      // Check if we already have this pool ability in our list (could match multiple owned abilities)
      const existing = synergies.find(s => s.poolAbilityId === poolId)
      if (existing) {
        // Keep the one with better synergy
        if (synergy > existing.synergy) {
          existing.winrate = pair.winrate
          existing.synergy = synergy
        }
      } else {
        synergies.push({
          poolAbilityId: poolId,
          winrate: pair.winrate,
          synergy,
        })
      }
    })

    // Filter to only positive synergy, sort by synergy (best first)
    return synergies
      .filter(s => s.synergy > 0)
      .sort((a, b) => b.synergy - a.synergy)
  }

  // Get best abilities for a player (valid types only)
  const getPlayerBestAbilities = (side: 'radiant' | 'dire', playerIndex: number) => {
    const pickedAbilities = side === 'radiant'
      ? playerPickedAbilities.radiant[playerIndex]
      : playerPickedAbilities.dire[playerIndex]

    // Calculate what types the player still needs
    const needed = getNeededTypes()
    const picked = getPickedTypeCounts(pickedAbilities)
    const remaining = {
      spells: Math.max(0, needed.spells - picked.spells),
      ultimates: Math.max(0, needed.ultimates - picked.ultimates),
      heroes: Math.max(0, needed.heroes - picked.heroes),
    }

    const validAbilities: Array<{ id: number; winrate: number }> = []

    abilityWinrates.forEach((winrate, id) => {
      // Must be in pool and unpicked
      if (!allPoolIds.has(id)) return
      if (pickedIds.has(id)) return

      // Check if the ability is a valid type for this player
      const abilityType = getAbilityType(id)
      if (abilityType === 'spell' && remaining.spells === 0) return
      if (abilityType === 'ultimate' && remaining.ultimates === 0) return
      if (abilityType === 'hero' && remaining.heroes === 0) return

      validAbilities.push({ id, winrate })
    })

    return validAbilities.sort((a, b) => b.winrate - a.winrate)
  }

  // Render ability icon helper
  const renderAbilityIcon = (id: number, value: string, valueClass: string, keyPrefix: string, idx: number) => {
    const isHero = id < 0
    const ability = isHero ? null : getAbilityById(id)
    const hero = isHero ? getHeroById(Math.abs(id)) : null
    const linkUrl = isHero ? `/heroes/${Math.abs(id)}` : `/abilities/${id}`
    const name = isHero ? hero?.englishName : ability?.englishName

    return (
      <a key={`${keyPrefix}-${idx}`} href={linkUrl} target="_blank" rel="noopener noreferrer" className={styles.synergyPick} title={name}>
        {isHero ? (
          <img
            src={heroMiniUrl(hero?.picture ?? '')}
            alt={hero?.englishName ?? ''}
            className={styles.synergyPickIcon}
          />
        ) : (
          <img
            src={`https://cdn.datdota.com/images/ability/${ability?.shortName ?? ''}.png`}
            alt={ability?.englishName ?? ''}
            className={`${styles.synergyPickIcon} ${ability?.isUltimate ? styles.ultimate : ''}`}
          />
        )}
        <span className={valueClass}>{value}</span>
      </a>
    )
  }

  // Render synergy and best suggestions for a player
  const renderPlayerSuggestions = (side: 'radiant' | 'dire', playerIndex: number) => {
    const synergies = getPlayerSynergies(side, playerIndex)
    const bestAbilities = getPlayerBestAbilities(side, playerIndex)

    // Logic: if 0 SYN, show 5 BEST. Else show min(X, 3) SYN and fill rest with BEST (total 5)
    const synCount = synergies.length
    const synToShow = synCount === 0 ? 0 : Math.min(synCount, 3)
    const bestToShow = 5 - synToShow

    // Filter out abilities that are already in synergies from best
    const synAbilityIds = new Set(synergies.slice(0, synToShow).map(s => s.poolAbilityId))
    const filteredBest = bestAbilities.filter(b => !synAbilityIds.has(b.id)).slice(0, bestToShow)

    const hasSyn = synToShow > 0
    const hasBest = filteredBest.length > 0

    return (
      <div className={styles.playerSynergyRow}>
        {hasSyn && (
          <>
            <span className={styles.synergyLabel}>SYN:</span>
            {synergies.slice(0, synToShow).map((syn, idx) =>
              renderAbilityIcon(syn.poolAbilityId, `+${(syn.synergy * 100).toFixed(0)}%`, styles.synergyPickSyn, 'syn', idx)
            )}
          </>
        )}
        {hasBest && (
          <>
            <span className={`${styles.synergyLabel} ${hasSyn ? styles.bestLabelSpaced : ''}`}>BEST:</span>
            {filteredBest.map((best, idx) => {
              const aboveFifty = (best.winrate - 0.5) * 100
              return renderAbilityIcon(best.id, `+${aboveFifty.toFixed(0)}%`, styles.synergyPickWr, 'best', idx)
            })}
          </>
        )}
        {!hasSyn && !hasBest && (
          <span className={styles.synergyEmpty}>—</span>
        )}
      </div>
    )
  }

  // Snake draft order: R1, D1, R2, D2, R3, D3, R4, D4, R5, D5, D5, R5, D4, R4, D3, R3, D2, R2, D1, R1, repeat
  const getPickingInfo = (pickNum: number): { team: 'radiant' | 'dire'; playerPos: number } => {
    if (pickNum === 0) return { team: 'radiant', playerPos: 0 }
    const pickIndex = pickNum - 1
    const phase = Math.floor(pickIndex / 10) // Each full phase is 10 picks
    const posInPhase = pickIndex % 10

    if (phase % 2 === 0) {
      // Forward phase: R1, D1, R2, D2, R3, D3, R4, D4, R5, D5
      const team = posInPhase % 2 === 0 ? 'radiant' : 'dire'
      const playerPos = Math.floor(posInPhase / 2)
      return { team, playerPos }
    } else {
      // Reverse phase: D5, R5, D4, R4, D3, R3, D2, R2, D1, R1
      const team = posInPhase % 2 === 0 ? 'dire' : 'radiant'
      const playerPos = 4 - Math.floor(posInPhase / 2)
      return { team, playerPos }
    }
  }

  const pickingInfo = currentPick < picks.length ? getPickingInfo(currentPick + 1) : null
  const currentTeam = pickingInfo?.team ?? 'radiant'

  // Get the types needed for a player (U = ultimate, S = spell, H = hero)
  // Standard AD rules: 3 spells, 1 ultimate, 1 hero innate
  const getNeededTypes = (): { spells: number; ultimates: number; heroes: number } => {
    return { spells: 3, ultimates: 1, heroes: 1 }
  }

  // Get picked type counts for a player at current state
  const getPickedTypeCounts = (pickedAbilities: Array<{ id: number; order: number }>): { spells: number; ultimates: number; heroes: number } => {
    let spells = 0, ultimates = 0, heroes = 0
    pickedAbilities.forEach(({ id }) => {
      if (id < 0) {
        heroes++
      } else {
        const ability = getAbilityById(id)
        if (ability?.isUltimate) {
          ultimates++
        } else {
          spells++
        }
      }
    })
    return { spells, ultimates, heroes }
  }

  // Render player slots
  const renderPlayerSlots = (side: 'radiant' | 'dire', playerIndex: number) => {
    const pickedAbilities = side === 'radiant'
      ? playerPickedAbilities.radiant[playerIndex]
      : playerPickedAbilities.dire[playerIndex]
    const totalSlots = side === 'radiant'
      ? playerSlotCounts.radiant[playerIndex]
      : playerSlotCounts.dire[playerIndex]

    // Calculate what types are still needed (standard AD: 3 spells, 1 ultimate, 1 hero)
    const needed = getNeededTypes()
    const picked = getPickedTypeCounts(pickedAbilities)
    const remaining = {
      spells: Math.max(0, needed.spells - picked.spells),
      ultimates: Math.max(0, needed.ultimates - picked.ultimates),
      heroes: Math.max(0, needed.heroes - picked.heroes),
    }

    const slots = []
    for (let i = 0; i < totalSlots; i++) {
      const pickedAbility = pickedAbilities[i]
      if (pickedAbility) {
        const isHeroInnate = pickedAbility.id < 0
        if (isHeroInnate) {
          const hero = getHeroById(Math.abs(pickedAbility.id))
          slots.push(
            <a key={i} href={`/heroes/${Math.abs(pickedAbility.id)}`} target="_blank" rel="noopener noreferrer" className={`${styles.draftAbilitySlot} ${styles.filledSlot}`} title={hero?.englishName ?? ''}>
              <img
                src={heroMiniUrl(hero?.picture ?? '')}
                alt={hero?.englishName ?? ''}
                className={styles.draftSlotIcon}
              />
            </a>
          )
        } else {
          const ability = getAbilityById(pickedAbility.id)
          slots.push(
            <a key={i} href={`/abilities/${pickedAbility.id}`} target="_blank" rel="noopener noreferrer" className={`${styles.draftAbilitySlot} ${styles.filledSlot}`} title={ability?.englishName ?? ''}>
              <img
                src={`https://cdn.datdota.com/images/ability/${ability?.shortName ?? ''}.png`}
                alt={ability?.englishName ?? ''}
                className={`${styles.draftSlotIcon} ${ability?.isUltimate ? styles.ultimateIcon : ''}`}
              />
            </a>
          )
        }
      } else {
        // Render colored letters for what's still needed
        slots.push(
          <div key={i} className={`${styles.draftAbilitySlot} ${styles.emptySlot}`}>
            <span className={styles.emptySlotLabel}>
              {remaining.spells > 0 && <span className={styles.labelS}>S</span>}
              {remaining.ultimates > 0 && <span className={styles.labelU}>U</span>}
              {remaining.heroes > 0 && <span className={styles.labelH}>H</span>}
              {remaining.spells === 0 && remaining.ultimates === 0 && remaining.heroes === 0 && '?'}
            </span>
          </div>
        )
      }
    }
    return slots
  }

  // Compute most contended abilities across all players
  const mostContended = useMemo(() => {
    const counts = new Map<number, number>()

    // For each player (5 radiant + 5 dire)
    for (let i = 0; i < 5; i++) {
      // Radiant player
      const radiantSyn = getPlayerSynergies('radiant', i).slice(0, 5)
      const radiantBest = getPlayerBestAbilities('radiant', i).slice(0, 5)

      radiantSyn.forEach(s => counts.set(s.poolAbilityId, (counts.get(s.poolAbilityId) ?? 0) + 1))
      radiantBest.forEach(b => counts.set(b.id, (counts.get(b.id) ?? 0) + 1))

      // Dire player
      const direSyn = getPlayerSynergies('dire', i).slice(0, 5)
      const direBest = getPlayerBestAbilities('dire', i).slice(0, 5)

      direSyn.forEach(s => counts.set(s.poolAbilityId, (counts.get(s.poolAbilityId) ?? 0) + 1))
      direBest.forEach(b => counts.set(b.id, (counts.get(b.id) ?? 0) + 1))
    }

    // Sort by count and take top 8
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({ id, count }))
  }, [pickedIds, allPoolIds, abilityPairs, abilityWinrates, playerPickedAbilities])

  // Compute role analysis data for each player
  const roleAnalysis = useMemo(() => {
    const computePlayerStats = (abilityIds: number[]) => {
      let killsShift = 0
      let deathsShift = 0
      let killAssistShift = 0
      let gpmShift = 0
      let xpmShift = 0
      let dmgShift = 0
      let healingShift = 0
      let expectedScepter = 0
      let expectedShard = 0

      abilityIds.forEach(id => {
        const shift = abilityShifts.get(id)
        if (shift) {
          killsShift += shift.killsShift
          deathsShift += shift.deathsShift
          killAssistShift += shift.killAssistShift
          gpmShift += shift.gpmShift
          xpmShift += shift.xpmShift
          dmgShift += shift.dmgShift
          healingShift += shift.healingShift
        }

        // Only add scepter/shard pickup rates if the ability has them
        const ability = id > 0 ? getAbilityById(id) : null
        const aghs = abilityAghs.get(id)
        if (aghs && ability) {
          if (ability.hasScepter) {
            expectedScepter += aghs.scepterPickRate
          }
          if (ability.hasShard) {
            expectedShard += aghs.shardPickRate
          }
        }
      })

      return {
        killsShift,
        deathsShift,
        killAssistShift,
        gpmShift,
        xpmShift,
        dmgShift,
        healingShift,
        expectedScepter,
        expectedShard,
      }
    }

    const radiant = radiantDraftOrder.map((playerIdx, displayIdx) => {
      const abilities = playerPickedAbilities.radiant[playerIdx]?.map(a => a.id) ?? []
      return {
        displayNum: displayIdx + 1,
        abilities,
        ...computePlayerStats(abilities),
      }
    })

    const dire = direDraftOrder.map((playerIdx, displayIdx) => {
      const abilities = playerPickedAbilities.dire[playerIdx]?.map(a => a.id) ?? []
      return {
        displayNum: displayIdx + 1,
        abilities,
        ...computePlayerStats(abilities),
      }
    })

    return { radiant, dire }
  }, [radiantDraftOrder, direDraftOrder, playerPickedAbilities, abilityShifts, abilityAghs])

  // Get the best available pairs based on mode
  const displayedPairs = pairsMode === 'all' ? bestAvailablePairs : bestAvailablePairsDiffHeroes

  // Compute min/max values for gradient coloring in aggregate analysis
  const aggregateRanges = useMemo(() => {
    const allPlayers = [...roleAnalysis.radiant, ...roleAnalysis.dire]
    if (allPlayers.length === 0) return null

    const getRange = (key: keyof typeof allPlayers[0]) => {
      const values = allPlayers.map(p => p[key] as number)
      return { min: Math.min(...values), max: Math.max(...values) }
    }

    return {
      killsShift: getRange('killsShift'),
      deathsShift: getRange('deathsShift'),
      killAssistShift: getRange('killAssistShift'),
      gpmShift: getRange('gpmShift'),
      xpmShift: getRange('xpmShift'),
      dmgShift: getRange('dmgShift'),
      healingShift: getRange('healingShift'),
      expectedScepter: getRange('expectedScepter'),
      expectedShard: getRange('expectedShard'),
    }
  }, [roleAnalysis])

  // Get gradient color for aggregate cell (green = best, red = worst, no color at midpoint)
  const getAggregateGradient = (value: number, min: number, max: number, inverted = false) => {
    if (min === max) return {}
    const normalized = (value - min) / (max - min)
    // For inverted (deaths), lower is better so flip the color
    const colorValue = inverted ? 1 - normalized : normalized

    // Distance from midpoint (0 at center, 0.5 at extremes)
    const distanceFromMid = Math.abs(colorValue - 0.5)

    // No coloring near the midpoint
    if (distanceFromMid < 0.1) return {}

    let r: number, g: number, b: number
    if (colorValue < 0.5) {
      // Red zone (worst)
      r = 220
      g = Math.round(80 + colorValue * 2 * 140)
      b = 80
    } else {
      // Green zone (best)
      r = Math.round(220 - (colorValue - 0.5) * 2 * 140)
      g = 220
      b = 80
    }

    // Alpha scales with distance from midpoint
    const alpha = distanceFromMid * 0.6
    return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` }
  }

  // Combined and sorted aggregate analysis data
  type AggregatePlayer = typeof roleAnalysis.radiant[0] & { side: 'radiant' | 'dire'; defaultOrder: number }

  const sortedAggregateData = useMemo(() => {
    const combined: AggregatePlayer[] = [
      ...roleAnalysis.radiant.map((p, idx) => ({ ...p, side: 'radiant' as const, defaultOrder: idx })),
      ...roleAnalysis.dire.map((p, idx) => ({ ...p, side: 'dire' as const, defaultOrder: idx + 5 })),
    ]

    if (aggregateSortColumn === 'default') {
      return aggregateSortDirection === 'asc'
        ? combined.sort((a, b) => a.defaultOrder - b.defaultOrder)
        : combined.sort((a, b) => b.defaultOrder - a.defaultOrder)
    }

    const sortKey = aggregateSortColumn as keyof typeof combined[0]
    return combined.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aggregateSortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      return 0
    })
  }, [roleAnalysis, aggregateSortColumn, aggregateSortDirection])

  const handleAggregateSort = (column: string) => {
    if (aggregateSortColumn === column) {
      setAggregateSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setAggregateSortColumn(column)
      setAggregateSortDirection('desc') // Default to descending for numeric columns
    }
  }

  return (
    <div className={styles.draftReplay}>
      <h3 className={styles.draftTitle}>Draft Replay</h3>

      {/* 3-Panel Layout */}
      <div className={styles.draftThreePanel}>
        {/* Left Panel - Radiant Players (ordered by first pick) */}
        <div className={styles.draftPlayersPanel}>
          <h4 className={`${styles.draftPanelTitle} ${styles.radiantTitle}`}>Radiant</h4>
          {radiantDraftOrder.map((playerIdx, displayIdx) => {
            const isPicking = pickingInfo?.team === 'radiant' && pickingInfo.playerPos === displayIdx
            return (
              <div key={playerIdx} className={`${styles.playerDraftRow} ${styles.radiant} ${isPicking ? styles.picking : ''}`}>
                <span className={`${styles.playerNumber} ${styles.radiantNum}`}>{displayIdx + 1}</span>
                <div className={styles.playerDraftContent}>
                  <div className={styles.playerDraftSlots}>
                    {renderPlayerSlots('radiant', playerIdx)}
                  </div>
                  {renderPlayerSuggestions('radiant', playerIdx)}
                </div>
              </div>
            )
          })}
        </div>

        {/* Center Panel - Ability Pool (Ultimates | Spells | Heroes) */}
        <div className={styles.draftCenterPanel}>
          {/* Left: Ultimates (2 wide) */}
          <div className={`${styles.poolSection} ${styles.poolUltimates}`}>
            <h4 className={`${styles.poolTitle} ${styles.poolTitleU}`}>Ultimates ({ultimates.length})</h4>
            <div className={`${styles.poolGrid} ${styles.poolGridNarrow}`}>
              {ultimates.map(ability => (
                <a
                  key={ability.id}
                  href={`/abilities/${ability.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.poolAbility} ${pickedIds.has(ability.id) ? styles.picked : ''}`}
                  title={ability.name}
                >
                  <img
                    src={`https://cdn.datdota.com/images/ability/${ability.shortName}.png`}
                    alt={ability.name}
                    className={styles.poolIcon}
                  />
                </a>
              ))}
            </div>
          </div>

          {/* Center: Spells (6 wide) */}
          <div className={`${styles.poolSection} ${styles.poolSpells}`}>
            <h4 className={`${styles.poolTitle} ${styles.poolTitleS}`}>Spells ({spells.length})</h4>
            <div className={`${styles.poolGrid} ${styles.poolGridWide}`}>
              {spells.map(ability => (
                <a
                  key={ability.id}
                  href={`/abilities/${ability.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.poolAbility} ${pickedIds.has(ability.id) ? styles.picked : ''}`}
                  title={ability.name}
                >
                  <img
                    src={`https://cdn.datdota.com/images/ability/${ability.shortName}.png`}
                    alt={ability.name}
                    className={styles.poolIcon}
                  />
                </a>
              ))}
            </div>
          </div>

          {/* Right: Heroes (2 wide) */}
          <div className={`${styles.poolSection} ${styles.poolHeroes}`}>
            <h4 className={`${styles.poolTitle} ${styles.poolTitleH}`}>Heroes ({heroes.length})</h4>
            <div className={`${styles.poolGrid} ${styles.poolGridNarrow}`}>
              {heroes.map(hero => (
                <a
                  key={hero.id}
                  href={`/heroes/${Math.abs(hero.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.poolAbility} ${pickedIds.has(hero.id) ? styles.picked : ''}`}
                  title={hero.name}
                >
                  <img
                    src={heroMiniUrl(hero.picture)}
                    alt={hero.name}
                    className={styles.poolIcon}
                  />
                </a>
              ))}
            </div>
          </div>

          {/* Highest Priority Section */}
          {mostContended.length > 0 && (
            <div className={styles.mostContendedSection}>
              <span className={styles.mostContendedLabel}>
                HIGHEST PRIORITY
                <span
                  className={styles.helpIcon}
                  title="Sorted by how many players have this ability in their top 5 synergy picks or top 5 overall picks"
                >
                  ?
                </span>
              </span>
              <div className={styles.mostContendedList}>
                {mostContended.map((item, idx) => {
                  const isHero = item.id < 0
                  const ability = isHero ? null : getAbilityById(item.id)
                  const hero = isHero ? getHeroById(Math.abs(item.id)) : null
                  const linkUrl = isHero ? `/heroes/${Math.abs(item.id)}` : `/abilities/${item.id}`
                  const name = isHero ? hero?.englishName : ability?.englishName

                  return (
                    <a key={idx} href={linkUrl} target="_blank" rel="noopener noreferrer" className={styles.contendedItem} title={name}>
                      {isHero ? (
                        <img
                          src={heroMiniUrl(hero?.picture ?? '')}
                          alt={hero?.englishName ?? ''}
                          className={styles.contendedIcon}
                        />
                      ) : (
                        <img
                          src={`https://cdn.datdota.com/images/ability/${ability?.shortName ?? ''}.png`}
                          alt={ability?.englishName ?? ''}
                          className={`${styles.contendedIcon} ${ability?.isUltimate ? styles.ultimate : ''}`}
                        />
                      )}
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Controls inside pool container */}
          <div className={styles.draftControlsInPool}>
            <button
              className={styles.draftButton}
              onClick={() => setCurrentPick(0)}
              disabled={currentPick === 0}
            >
              Start
            </button>
            <button
              className={styles.draftButton}
              onClick={() => setCurrentPick(Math.max(0, currentPick - 1))}
              disabled={currentPick === 0}
            >
              Prev
            </button>
            <span className={styles.draftProgress}>
              Pick {currentPick} / {picks.length}
              {currentPick < picks.length && (
                <span className={`${styles.pickingTeam} ${styles[currentTeam]}`}>
                  {currentTeam === 'radiant' ? 'Radiant' : 'Dire'}
                </span>
              )}
            </span>
            <button
              className={styles.draftButton}
              onClick={() => setCurrentPick(Math.min(picks.length, currentPick + 1))}
              disabled={currentPick >= picks.length}
            >
              Next
            </button>
            <button
              className={styles.draftButton}
              onClick={() => setCurrentPick(picks.length)}
              disabled={currentPick >= picks.length}
            >
              End
            </button>
          </div>
        </div>

        {/* Right Panel - Dire Players (ordered by first pick) */}
        <div className={styles.draftPlayersPanel}>
          <h4 className={`${styles.draftPanelTitle} ${styles.direTitle}`}>Dire</h4>
          {direDraftOrder.map((playerIdx, displayIdx) => {
            const isPicking = pickingInfo?.team === 'dire' && pickingInfo.playerPos === displayIdx
            return (
              <div key={playerIdx} className={`${styles.playerDraftRow} ${styles.dire} ${isPicking ? styles.picking : ''}`}>
                <div className={styles.playerDraftContent}>
                  <div className={styles.playerDraftSlots}>
                    {renderPlayerSlots('dire', playerIdx)}
                  </div>
                  {renderPlayerSuggestions('dire', playerIdx)}
                </div>
                <span className={`${styles.playerNumber} ${styles.direNum}`}>{displayIdx + 1}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dynamic Tables Section */}
      <div className={styles.draftDynamicSection}>
        {/* Best Available Pairs */}
        <div className={`${styles.draftTableContainer} ${styles.narrowTable}`}>
          <div className={styles.draftTableHeader}>
            <h4 className={styles.draftTableTitle}>Best Pairs</h4>
            <div className={styles.pairsModeSelector}>
              <button
                className={`${styles.pairsModeBtn} ${pairsMode === 'all' ? styles.pairsModeBtnActive : ''}`}
                onClick={() => setPairsMode('all')}
              >
                All
              </button>
              <button
                className={`${styles.pairsModeBtn} ${pairsMode === 'diffHero' ? styles.pairsModeBtnActive : ''}`}
                onClick={() => setPairsMode('diffHero')}
              >
                Diff Hero
              </button>
            </div>
          </div>
          <table className={styles.draftTable}>
            <thead>
              <tr>
                <th>Abilities</th>
                <th>WR</th>
                <th>Syn</th>
              </tr>
            </thead>
            <tbody>
              {displayedPairs.length > 0 ? displayedPairs.map((pair, idx) => {
                const isHeroA = pair.abilityA < 0
                const isHeroB = pair.abilityB < 0
                const abilityA = isHeroA ? null : getAbilityById(pair.abilityA)
                const abilityB = isHeroB ? null : getAbilityById(pair.abilityB)
                const heroA = isHeroA ? getHeroById(Math.abs(pair.abilityA)) : null
                const heroB = isHeroB ? getHeroById(Math.abs(pair.abilityB)) : null

                return (
                  <tr key={idx}>
                    <td>
                      <div className={styles.draftTableIcons}>
                        {isHeroA ? (
                          <a href={`/heroes/${Math.abs(pair.abilityA)}`} target="_blank" rel="noopener noreferrer" title={heroA?.englishName ?? ''}>
                            <img
                              src={heroMiniUrl(heroA?.picture ?? '')}
                              alt={heroA?.englishName ?? ''}
                              className={styles.draftTableIcon}
                            />
                          </a>
                        ) : (
                          <a href={`/abilities/${pair.abilityA}`} target="_blank" rel="noopener noreferrer" title={abilityA?.englishName ?? ''}>
                            <img
                              src={`https://cdn.datdota.com/images/ability/${abilityA?.shortName ?? ''}.png`}
                              alt={abilityA?.englishName ?? ''}
                              className={`${styles.draftTableIcon} ${abilityA?.isUltimate ? styles.ultimate : ''}`}
                            />
                          </a>
                        )}
                        <span className={styles.draftTablePlus}>+</span>
                        {isHeroB ? (
                          <a href={`/heroes/${Math.abs(pair.abilityB)}`} target="_blank" rel="noopener noreferrer" title={heroB?.englishName ?? ''}>
                            <img
                              src={heroMiniUrl(heroB?.picture ?? '')}
                              alt={heroB?.englishName ?? ''}
                              className={styles.draftTableIcon}
                            />
                          </a>
                        ) : (
                          <a href={`/abilities/${pair.abilityB}`} target="_blank" rel="noopener noreferrer" title={abilityB?.englishName ?? ''}>
                            <img
                              src={`https://cdn.datdota.com/images/ability/${abilityB?.shortName ?? ''}.png`}
                              alt={abilityB?.englishName ?? ''}
                              className={`${styles.draftTableIcon} ${abilityB?.isUltimate ? styles.ultimate : ''}`}
                            />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className={styles.draftTableWinrate}>
                      {(pair.winrate * 100).toFixed(1)}%
                    </td>
                    <td className={`${styles.draftTableSynergy} ${pair.synergy > 0.02 ? styles.positive : pair.synergy < -0.02 ? styles.negative : ''}`}>
                      {pair.synergy > 0 ? '+' : ''}{(pair.synergy * 100).toFixed(1)}%
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No pair data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Aggregate Ability Analysis */}
        <div className={`${styles.draftTableContainer} ${styles.roleAnalysisTable}`}>
          <h4 className={styles.draftTableTitle}>Aggregate Ability Analysis</h4>
          <table className={styles.draftTable}>
            <thead>
              <tr>
                <th className={`${styles.roleColNum} ${styles.sortableHeader}`} onClick={() => handleAggregateSort('default')}>
                  # {aggregateSortColumn === 'default' && <span className={styles.sortIndicator}>{aggregateSortDirection === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className={styles.roleColAbilities}>Abilities</th>
                <th className={`${styles.headerKill} ${styles.sortableHeader}`} onClick={() => handleAggregateSort('killsShift')}>
                  Kill Δ {aggregateSortColumn === 'killsShift' && <span className={styles.sortIndicator}>{aggregateSortDirection === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className={`${styles.headerDeath} ${styles.sortableHeader}`} onClick={() => handleAggregateSort('deathsShift')}>
                  Death Δ {aggregateSortColumn === 'deathsShift' && <span className={styles.sortIndicator}>{aggregateSortDirection === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className={`${styles.headerKA} ${styles.sortableHeader}`} onClick={() => handleAggregateSort('killAssistShift')}>
                  K+A Δ {aggregateSortColumn === 'killAssistShift' && <span className={styles.sortIndicator}>{aggregateSortDirection === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className={`${styles.headerGPM} ${styles.sortableHeader}`} onClick={() => handleAggregateSort('gpmShift')}>
                  GPM Δ {aggregateSortColumn === 'gpmShift' && <span className={styles.sortIndicator}>{aggregateSortDirection === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className={`${styles.headerXPM} ${styles.sortableHeader}`} onClick={() => handleAggregateSort('xpmShift')}>
                  XPM Δ {aggregateSortColumn === 'xpmShift' && <span className={styles.sortIndicator}>{aggregateSortDirection === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className={`${styles.headerDmg} ${styles.sortableHeader}`} onClick={() => handleAggregateSort('dmgShift')}>
                  Dmg Δ {aggregateSortColumn === 'dmgShift' && <span className={styles.sortIndicator}>{aggregateSortDirection === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className={`${styles.headerHeal} ${styles.sortableHeader}`} onClick={() => handleAggregateSort('healingShift')}>
                  Heal Δ {aggregateSortColumn === 'healingShift' && <span className={styles.sortIndicator}>{aggregateSortDirection === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className={`${styles.headerScepter} ${styles.sortableHeader}`} onClick={() => handleAggregateSort('expectedScepter')} title="Cumulative pickup rate for Aghanim's Scepter for abilities that have a scepter upgrade">
                  Σ Scep {aggregateSortColumn === 'expectedScepter' && <span className={styles.sortIndicator}>{aggregateSortDirection === 'asc' ? '▲' : '▼'}</span>}
                  <span className={styles.helpIcon}>?</span>
                </th>
                <th className={`${styles.headerShard} ${styles.sortableHeader}`} onClick={() => handleAggregateSort('expectedShard')} title="Cumulative pickup rate for Aghanim's Shard for abilities that have a shard upgrade">
                  Σ Shard {aggregateSortColumn === 'expectedShard' && <span className={styles.sortIndicator}>{aggregateSortDirection === 'asc' ? '▲' : '▼'}</span>}
                  <span className={styles.helpIcon}>?</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAggregateData.map((player) => (
                <tr key={`${player.side}-${player.displayNum}`} className={player.side === 'radiant' ? styles.radiantRow : styles.direRow}>
                  <td className={styles.roleColNum}>
                    <span className={player.side === 'radiant' ? styles.radiantNum : styles.direNum}>
                      {player.side === 'radiant' ? 'R' : 'D'}{player.displayNum}
                    </span>
                  </td>
                  <td className={styles.roleColAbilities}>
                    <div className={styles.roleAbilityIcons}>
                      {player.abilities.map((id, i) => {
                        const isHero = id < 0
                        const ability = isHero ? null : getAbilityById(id)
                        const hero = isHero ? getHeroById(Math.abs(id)) : null
                        return isHero ? (
                          <a key={i} href={`/heroes/${Math.abs(id)}`} target="_blank" rel="noopener noreferrer" title={hero?.englishName ?? ''}>
                            <img
                              src={heroMiniUrl(hero?.picture ?? '')}
                              alt={hero?.englishName ?? ''}
                              className={styles.roleAbilityIcon}
                            />
                          </a>
                        ) : (
                          <a key={i} href={`/abilities/${id}`} target="_blank" rel="noopener noreferrer" title={ability?.englishName ?? ''}>
                            <img
                              src={`https://cdn.datdota.com/images/ability/${ability?.shortName ?? ''}.png`}
                              alt={ability?.englishName ?? ''}
                              className={`${styles.roleAbilityIcon} ${ability?.isUltimate ? styles.ultimate : ''}`}
                            />
                          </a>
                        )
                      })}
                    </div>
                  </td>
                  <td className={styles.roleShiftCell} style={aggregateRanges ? getAggregateGradient(player.killsShift, aggregateRanges.killsShift.min, aggregateRanges.killsShift.max) : {}}>
                    {player.killsShift >= 0 ? '+' : ''}{player.killsShift.toFixed(2)}
                  </td>
                  <td className={styles.roleShiftCell} style={aggregateRanges ? getAggregateGradient(player.deathsShift, aggregateRanges.deathsShift.min, aggregateRanges.deathsShift.max, true) : {}}>
                    {player.deathsShift >= 0 ? '+' : ''}{player.deathsShift.toFixed(2)}
                  </td>
                  <td className={styles.roleShiftCell} style={aggregateRanges ? getAggregateGradient(player.killAssistShift, aggregateRanges.killAssistShift.min, aggregateRanges.killAssistShift.max) : {}}>
                    {player.killAssistShift >= 0 ? '+' : ''}{player.killAssistShift.toFixed(2)}
                  </td>
                  <td className={styles.roleShiftCell} style={aggregateRanges ? getAggregateGradient(player.gpmShift, aggregateRanges.gpmShift.min, aggregateRanges.gpmShift.max) : {}}>
                    {player.gpmShift >= 0 ? '+' : ''}{player.gpmShift.toFixed(2)}
                  </td>
                  <td className={styles.roleShiftCell} style={aggregateRanges ? getAggregateGradient(player.xpmShift, aggregateRanges.xpmShift.min, aggregateRanges.xpmShift.max) : {}}>
                    {player.xpmShift >= 0 ? '+' : ''}{player.xpmShift.toFixed(2)}
                  </td>
                  <td className={styles.roleShiftCell} style={aggregateRanges ? getAggregateGradient(player.dmgShift, aggregateRanges.dmgShift.min, aggregateRanges.dmgShift.max) : {}}>
                    {player.dmgShift >= 0 ? '+' : ''}{player.dmgShift.toFixed(2)}
                  </td>
                  <td className={styles.roleShiftCell} style={aggregateRanges ? getAggregateGradient(player.healingShift, aggregateRanges.healingShift.min, aggregateRanges.healingShift.max) : {}}>
                    {player.healingShift >= 0 ? '+' : ''}{player.healingShift.toFixed(2)}
                  </td>
                  <td className={styles.roleAghsCell} style={aggregateRanges ? getAggregateGradient(player.expectedScepter, aggregateRanges.expectedScepter.min, aggregateRanges.expectedScepter.max) : {}}>
                    {player.expectedScepter.toFixed(2)}
                  </td>
                  <td className={styles.roleAghsCell} style={aggregateRanges ? getAggregateGradient(player.expectedShard, aggregateRanges.expectedShard.min, aggregateRanges.expectedShard.max) : {}}>
                    {player.expectedShard.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Best Available Abilities */}
        <div className={`${styles.draftTableContainer} ${styles.narrowTable}`}>
          <h4 className={styles.draftTableTitle}>Best Abilities</h4>
          <table className={styles.draftTable}>
            <thead>
              <tr>
                <th>Ability</th>
                <th>WR</th>
              </tr>
            </thead>
            <tbody>
              {bestAvailableAbilities.length > 0 ? bestAvailableAbilities.map((item, idx) => {
                const isHero = item.id < 0
                const ability = isHero ? null : getAbilityById(item.id)
                const hero = isHero ? getHeroById(Math.abs(item.id)) : null
                const linkUrl = isHero ? `/heroes/${Math.abs(item.id)}` : `/abilities/${item.id}`
                const name = isHero ? hero?.englishName : ability?.englishName

                return (
                  <tr key={idx}>
                    <td>
                      <a href={linkUrl} target="_blank" rel="noopener noreferrer" className={styles.draftTableIcons} title={name}>
                        {isHero ? (
                          <img
                            src={heroMiniUrl(hero?.picture ?? '')}
                            alt={hero?.englishName ?? ''}
                            className={styles.draftTableIcon}
                          />
                        ) : (
                          <img
                            src={`https://cdn.datdota.com/images/ability/${ability?.shortName ?? ''}.png`}
                            alt={ability?.englishName ?? ''}
                            className={`${styles.draftTableIcon} ${ability?.isUltimate ? styles.ultimate : ''}`}
                          />
                        )}
                        <span className={styles.draftTableName}>
                          {name}
                        </span>
                      </a>
                    </td>
                    <td className={styles.draftTableWinrate}>
                      {(item.winrate * 100).toFixed(1)}%
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No ability data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
