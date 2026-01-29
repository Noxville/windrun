import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { usePlayerData, usePlayerMatches, usePlayerStats, useAuth } from '../api'
import { getAbilityById, getHeroById } from '../data'
import { heroMiniUrl, heroImageUrl } from '../config'
import type { PlayerMatch, PlayerMatchPlayer, SpellStat, WinLossStats } from '../types/player'
import styles from './Player.module.css'

function formatRatingWhole(rating: number): string {
  return Math.round(rating).toString()
}

function formatPercentile(percentile: number | null): string {
  if (percentile === null || percentile < 0) return '?'
  return `Top ${((1 - percentile) * 100).toFixed(1)}%`
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string | number | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDelta(delta: number | undefined, won: boolean): string {
  if (delta === undefined || delta === null) return ''
  // If won, delta should be at least +0.0
  const displayDelta = won && delta < 0 ? 0 : delta
  const sign = displayDelta >= 0 ? '+' : ''
  return `${sign}${displayDelta.toFixed(1)}`
}

function getDeltaClass(delta: number | undefined, won: boolean, styles: Record<string, string>): string {
  if (delta === undefined || delta === null) return ''
  const displayDelta = won && delta < 0 ? 0 : delta
  if (displayDelta > 0) return styles.deltaPositive
  if (displayDelta === 0) return styles.deltaZero
  return styles.deltaNegative
}

interface PlayerMatchData {
  match: PlayerMatch
  player: PlayerMatchPlayer
  isRadiant: boolean
  won: boolean
}

type SortField = 'games' | 'winrate'

export function PlayerPage() {
  const { playerId: rawPlayerId } = useParams()
  const navigate = useNavigate()
  const { user, isLoading: authLoading, login } = useAuth()
  const [page, setPage] = useState(0)
  const [heroSort, setHeroSort] = useState<SortField>('games')
  const [abilitySort, setAbilitySort] = useState<SortField>('games')
  const [allySort, setAllySort] = useState<SortField>('games')
  const [rivalSort, setRivalSort] = useState<SortField>('games')

  // Handle /players/me - redirect to actual user profile or login
  const isMe = rawPlayerId === 'me'
  const playerId = isMe ? (user?.id?.toString() ?? null) : rawPlayerId!
  const playerIdNum = playerId ? parseInt(playerId, 10) : null

  useEffect(() => {
    if (isMe && !authLoading) {
      if (user) {
        // Redirect to actual player profile
        navigate(`/players/${user.id}`, { replace: true })
      } else {
        // Not logged in, redirect to login
        login()
      }
    }
  }, [isMe, authLoading, user, navigate, login])

  const { data: playerResponse, isLoading: playerLoading, error: playerError } = usePlayerData(playerId ?? '')
  const { data: matchesResponse, isLoading: matchesLoading } = usePlayerMatches(playerId ?? '', page)
  const { data: statsResponse, isLoading: statsLoading } = usePlayerStats(playerId ?? '')

  const player = playerResponse?.data
  const stats = statsResponse?.stats

  // Process matches to extract player-specific data
  const processedMatches = useMemo((): PlayerMatchData[] => {
    if (!matchesResponse || !playerIdNum) return []

    return matchesResponse
      .map((match: PlayerMatch) => {
        // Find the player in radiant or dire
        let playerData = match.radiant?.find(p => p.steamId === playerIdNum)
        let isRadiant = true

        if (!playerData) {
          playerData = match.dire?.find(p => p.steamId === playerIdNum)
          isRadiant = false
        }

        if (!playerData) return null

        const won = isRadiant ? match.radiantWin : !match.radiantWin

        return {
          match,
          player: playerData,
          isRadiant,
          won
        }
      })
      .filter((m): m is PlayerMatchData => m !== null)
      .sort((a, b) => {
        const dateA = new Date(a.match.gameStart).getTime() || 0
        const dateB = new Date(b.match.gameStart).getTime() || 0
        return dateB - dateA // Most recent first
      })
  }, [matchesResponse, playerIdNum])

  // Show loading while handling /players/me redirect
  if (isMe || authLoading || playerLoading || !playerId) {
    return <div className={styles.loading}>Loading player...</div>
  }

  if (playerError || !player) {
    return (
      <div className={styles.error}>
        <h2>Player not found</h2>
        <p>This player either doesn't exist or hasn't played Ability Draft.</p>
        <Link to="/leaderboard" className={styles.errorLink}>View Leaderboard</Link>
      </div>
    )
  }

  const winrate = player.wins + player.losses > 0
    ? (player.wins / (player.wins + player.losses) * 100).toFixed(1)
    : '0.0'

  const steam64Id = BigInt(player.steamId) + BigInt('76561197960265728')

  return (
    <div className={styles.page}>
      {/* Profile Header */}
      <div className={styles.header}>
        <img src={player.avatar} alt="" className={styles.avatar} />
        <div className={styles.headerInfo}>
          <h1 className={styles.nickname}>{player.nickname}</h1>
          <div className={styles.headerMeta}>
            <span className={styles.regionBadge}>{player.region}</span>
            <div className={styles.externalLinks}>
              <a
                href={`https://www.dotabuff.com/players/${player.steamId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalLink}
                title="View on Dotabuff"
              >
                <img src="https://www.dotabuff.com/favicon.ico" alt="Dotabuff" className={styles.externalIcon} />
              </a>
              <a
                href={`https://www.opendota.com/players/${player.steamId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalLink}
                title="View on OpenDota"
              >
                <img src="/opendota-icon.png" alt="OpenDota" className={styles.externalIcon} />
              </a>
              <a
                href={`https://steamcommunity.com/profiles/${steam64Id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalLink}
                title="View Steam Profile"
              >
                <img src="https://store.steampowered.com/favicon.ico" alt="Steam" className={styles.externalIcon} />
              </a>
            </div>
          </div>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{formatRatingWhole(player.rating)}</span>
            <span className={styles.statLabel}>Rating</span>
          </div>
          {player.overallRank && (
            <div className={styles.statBox}>
              <span className={styles.statValue}>#{player.overallRank.toLocaleString()}</span>
              <span className={styles.statLabel}>Global Rank</span>
            </div>
          )}
          {player.regionalRank && (
            <div className={styles.statBox}>
              <span className={styles.statValue}>#{player.regionalRank.toLocaleString()}</span>
              <span className={styles.statLabel}>{player.region} Rank</span>
            </div>
          )}
          <div className={styles.statBox}>
            <span className={styles.statValue}>{formatPercentile(player.percentile)}</span>
            <span className={styles.statLabel}>Percentile</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{player.wins + player.losses}</span>
            <span className={styles.statLabel}>Games</span>
          </div>
          <div className={styles.statBox}>
            <span className={`${styles.statValue} ${styles.statValueWins}`}>{player.wins}</span>
            <span className={styles.statLabel}>Wins</span>
          </div>
          <div className={styles.statBox}>
            <span className={`${styles.statValue} ${styles.statValueLosses}`}>{player.losses}</span>
            <span className={styles.statLabel}>Losses</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{winrate}%</span>
            <span className={styles.statLabel}>Win Rate</span>
          </div>
        </div>
      </div>

      {statsLoading && <div className={styles.loading}>Loading stats...</div>}

      {/* Main Content - 3 columns */}
      <div className={styles.mainContent}>
        {/* Left Column: Heroes, Allies */}
        <div className={styles.leftColumn}>
          {/* Heroes */}
          {stats && <div className={styles.statsPanel}>
            <h3 className={styles.panelTitle}>Heroes</h3>
            <div className={styles.statsList}>
              <div className={styles.statsListHeader}>
                <span className={styles.statsListHeaderName}>Hero</span>
                <span
                  className={`${styles.statsListHeaderGames} ${styles.statsListHeaderCol} ${heroSort === 'games' ? styles.active : ''}`}
                  onClick={() => setHeroSort('games')}
                  title="Sort by games"
                >
                  #
                </span>
                <span className={styles.statsListHeaderRecord}>W-L</span>
                <span
                  className={`${styles.statsListHeaderWinrate} ${styles.statsListHeaderCol} ${heroSort === 'winrate' ? styles.active : ''}`}
                  onClick={() => setHeroSort('winrate')}
                  title="Sort by winrate"
                >
                  WR
                </span>
              </div>
              {Object.entries(stats.heroStats)
                .map(([heroId, data]) => ({ heroId: parseInt(heroId), ...data as WinLossStats }))
                .sort((a, b) => heroSort === 'games' ? b.total - a.total : b.winrate - a.winrate)
                .map(({ heroId, wins, losses, winrate, total }) => {
                  const hero = getHeroById(heroId)
                  return hero ? (
                    <div key={heroId} className={styles.statsListRow}>
                      <img
                        src={heroMiniUrl(hero.picture)}
                        alt={hero.englishName}
                        className={styles.statsListIcon}
                        title={hero.englishName}
                      />
                      <span className={styles.statsListName}>{hero.englishName}</span>
                      <span className={styles.statsListGames} title={`${total} games`}>{total}</span>
                      <span className={styles.statsListRecord}>{wins}-{losses}</span>
                      <span className={styles.statsListWinrate}>{(winrate * 100).toFixed(1)}%</span>
                    </div>
                  ) : null
                })}
            </div>
          </div>}

          {/* Allies */}
          {stats && <div className={styles.statsPanel}>
            <h3 className={styles.panelTitle}>Allies</h3>
            <div className={styles.statsList}>
              <div className={styles.statsListHeader}>
                <span className={styles.statsListHeaderName}>Player</span>
                <span
                  className={`${styles.statsListHeaderGames} ${styles.statsListHeaderCol} ${allySort === 'games' ? styles.active : ''}`}
                  onClick={() => setAllySort('games')}
                  title="Sort by games"
                >
                  #
                </span>
                <span className={styles.statsListHeaderRecord}>W-L</span>
                <span
                  className={`${styles.statsListHeaderWinrate} ${styles.statsListHeaderCol} ${allySort === 'winrate' ? styles.active : ''}`}
                  onClick={() => setAllySort('winrate')}
                  title="Sort by winrate"
                >
                  WR
                </span>
              </div>
              {Object.values(stats.allies)
                .sort((a, b) => allySort === 'games' ? b.winLoss.total - a.winLoss.total : b.winLoss.winrate - a.winLoss.winrate)
                .map((ally) => (
                  <Link
                    key={ally.player.steamId}
                    to={`/players/${ally.player.steamId}`}
                    className={styles.statsListRowLink}
                  >
                    <span className={styles.statsListName}>{ally.player.nickname}</span>
                    <span className={styles.statsListGames} title={`${ally.winLoss.total} games`}>{ally.winLoss.total}</span>
                    <span className={styles.statsListRecord}>{ally.winLoss.wins}-{ally.winLoss.losses}</span>
                    <span className={styles.statsListWinrate}>{(ally.winLoss.winrate * 100).toFixed(1)}%</span>
                  </Link>
                ))}
            </div>
          </div>}

          {/* Seat Stats */}
          {stats && <div className={styles.statsPanel}>
            <h3 className={styles.panelTitle}>Seat Stats</h3>
            <div className={styles.seatGrid}>
              <div className={styles.seatColumn}>
                <div className={styles.seatHeader}>Radiant</div>
                {[1, 3, 5, 7, 9].map((seat, idx) => {
                  const seatData = stats.seatStats[seat.toString()]
                  return seatData ? (
                    <div key={seat} className={styles.seatRow}>
                      <span className={styles.seatLabel}>R{idx + 1}</span>
                      <span className={styles.seatRecord}>{seatData.wins}-{seatData.losses}</span>
                      <span className={styles.seatWinrate}>{(seatData.winrate * 100).toFixed(1)}%</span>
                    </div>
                  ) : null
                })}
              </div>
              <div className={styles.seatColumn}>
                <div className={styles.seatHeader}>Dire</div>
                {[2, 4, 6, 8, 10].map((seat, idx) => {
                  const seatData = stats.seatStats[seat.toString()]
                  return seatData ? (
                    <div key={seat} className={styles.seatRow}>
                      <span className={styles.seatLabel}>D{idx + 1}</span>
                      <span className={styles.seatRecord}>{seatData.wins}-{seatData.losses}</span>
                      <span className={styles.seatWinrate}>{(seatData.winrate * 100).toFixed(1)}%</span>
                    </div>
                  ) : null
                })}
              </div>
            </div>
            {stats.factionStats && (
              <div className={styles.factionTotals}>
                <div className={`${styles.factionTotal} ${styles.radiantFaction}`}>
                  <span>Radiant</span>
                  <span>{stats.factionStats.RADIANT.wins}-{stats.factionStats.RADIANT.losses}</span>
                  <span>{(stats.factionStats.RADIANT.winrate * 100).toFixed(1)}%</span>
                </div>
                <div className={`${styles.factionTotal} ${styles.direFaction}`}>
                  <span>Dire</span>
                  <span>{stats.factionStats.DIRE.wins}-{stats.factionStats.DIRE.losses}</span>
                  <span>{(stats.factionStats.DIRE.winrate * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>}
        </div>

        {/* Middle Column: Abilities, Rivals */}
        <div className={styles.middleColumn}>
          {/* Abilities */}
          {stats && <div className={styles.statsPanel}>
            <h3 className={styles.panelTitle}>Abilities</h3>
            <div className={styles.statsList}>
              <div className={styles.statsListHeader}>
                <span className={styles.statsListHeaderName}>Ability</span>
                <span
                  className={`${styles.statsListHeaderGames} ${styles.statsListHeaderCol} ${abilitySort === 'games' ? styles.active : ''}`}
                  onClick={() => setAbilitySort('games')}
                  title="Sort by games"
                >
                  #
                </span>
                <span className={styles.statsListHeaderRecord}>W-L</span>
                <span
                  className={`${styles.statsListHeaderWinrate} ${styles.statsListHeaderCol} ${abilitySort === 'winrate' ? styles.active : ''}`}
                  onClick={() => setAbilitySort('winrate')}
                  title="Sort by winrate"
                >
                  WR
                </span>
              </div>
              {Object.entries(stats.spellStats)
                .map(([abilityId, data]) => ({
                  abilityId: parseInt(abilityId),
                  ...(data as SpellStat),
                  total: (data as SpellStat).wins + (data as SpellStat).losses
                }))
                .sort((a, b) => abilitySort === 'games' ? b.total - a.total : b.winrate - a.winrate)
                .map(({ abilityId, wins, losses, winrate, total, avgPickPosition }) => {
                  const ability = getAbilityById(abilityId)
                  return ability ? (
                    <div key={abilityId} className={styles.statsListRow}>
                      <img
                        src={`https://cdn.datdota.com/images/ability/${ability.shortName}.png`}
                        alt={ability.englishName}
                        className={`${styles.statsListIcon} ${ability.isUltimate ? styles.ultimateIcon : ''}`}
                        title={`${ability.englishName} (avg pick: ${avgPickPosition.toFixed(1)})`}
                      />
                      <span className={styles.statsListName}>{ability.englishName}</span>
                      <span className={styles.statsListGames} title={`${total} games`}>{total}</span>
                      <span className={styles.statsListRecord}>{wins}-{losses}</span>
                      <span className={styles.statsListWinrate}>{(winrate * 100).toFixed(1)}%</span>
                    </div>
                  ) : null
                })}
            </div>
          </div>}

          {/* Rivals */}
          {stats && <div className={styles.statsPanel}>
            <h3 className={styles.panelTitle}>Rivals</h3>
            <div className={styles.statsList}>
              <div className={styles.statsListHeader}>
                <span className={styles.statsListHeaderName}>Player</span>
                <span
                  className={`${styles.statsListHeaderGames} ${styles.statsListHeaderCol} ${rivalSort === 'games' ? styles.active : ''}`}
                  onClick={() => setRivalSort('games')}
                  title="Sort by games"
                >
                  #
                </span>
                <span className={styles.statsListHeaderRecord}>W-L</span>
                <span
                  className={`${styles.statsListHeaderWinrate} ${styles.statsListHeaderCol} ${rivalSort === 'winrate' ? styles.active : ''}`}
                  onClick={() => setRivalSort('winrate')}
                  title="Sort by winrate"
                >
                  WR
                </span>
              </div>
              {Object.values(stats.rivals)
                .sort((a, b) => rivalSort === 'games' ? b.winLoss.total - a.winLoss.total : b.winLoss.winrate - a.winLoss.winrate)
                .map((rival) => (
                  <Link
                    key={rival.player.steamId}
                    to={`/players/${rival.player.steamId}`}
                    className={styles.statsListRowLink}
                  >
                    <span className={styles.statsListName}>{rival.player.nickname}</span>
                    <span className={styles.statsListGames} title={`${rival.winLoss.total} games`}>{rival.winLoss.total}</span>
                    <span className={styles.statsListRecord}>{rival.winLoss.wins}-{rival.winLoss.losses}</span>
                    <span className={styles.statsListWinrate}>{(rival.winLoss.winrate * 100).toFixed(1)}%</span>
                  </Link>
                ))}
            </div>
          </div>}
        </div>

        {/* Right Column: Recent Matches */}
        <div className={styles.rightColumn}>
          <div className={styles.statsPanel}>
            <h3 className={styles.panelTitle}>Recent Matches</h3>

        {matchesLoading ? (
          <div className={styles.loading}>Loading matches...</div>
        ) : processedMatches.length === 0 ? (
          <div className={styles.empty}>No matches found</div>
        ) : (
          <>
            <div className={styles.matchListContainer}>
              <div className={styles.matchList}>
                {processedMatches.slice(0, 10).map(({ match, player: matchPlayer, won }) => {
                  const hero = getHeroById(matchPlayer.hero)
                  // Filter out hero innates (negative IDs) - only show drafted abilities
                  const draftedAbilities = (matchPlayer.abilities ?? []).filter(id => id > 0)

                  return (
                    <Link
                      key={match.matchId}
                      to={`/matches/${match.matchId}`}
                      className={`${styles.matchCard} ${won ? styles.matchWon : styles.matchLost}`}
                    >
                      {/* Top row: date, duration, region */}
                      <div className={styles.matchCardTop}>
                        <span className={styles.matchDate}>{formatDate(match.gameStart)}</span>
                        <div className={styles.matchMeta}>
                          <span className={styles.matchDuration}>{formatDuration(match.duration)}</span>
                          {match.region && <span className={styles.matchRegion}>{match.region}</span>}
                        </div>
                      </div>
                      {/* Main row: hero, delta+kda, abilities */}
                      <div className={styles.matchCardMain}>
                        <div className={styles.matchHero}>
                          {hero && (
                            <img
                              src={heroImageUrl(hero.picture)}
                              alt={hero.englishName}
                              className={styles.matchHeroIcon}
                              title={hero.englishName}
                            />
                          )}
                        </div>
                        <div className={styles.matchResultSection}>
                          {match.delta !== undefined && match.delta !== null ? (
                            <span className={`${styles.matchDelta} ${getDeltaClass(match.delta, won, styles)}`}>
                              {formatDelta(match.delta, won)}
                            </span>
                          ) : (
                            <span className={styles.matchDelta}>—</span>
                          )}
                          <div className={styles.matchKda}>
                            <span className={styles.kills}>{matchPlayer.kills}</span>
                            <span className={styles.separator}>/</span>
                            <span className={styles.deaths}>{matchPlayer.deaths}</span>
                            <span className={styles.separator}>/</span>
                            <span className={styles.assists}>{matchPlayer.assists}</span>
                          </div>
                        </div>
                        <div className={styles.matchAbilities}>
                          {draftedAbilities.map((abilityId, idx) => {
                            const ability = getAbilityById(abilityId)
                            return ability ? (
                              <img
                                key={idx}
                                src={`https://cdn.datdota.com/images/ability/${ability.shortName}.png`}
                                alt={ability.englishName}
                                className={`${styles.matchAbilityIcon} ${ability.isUltimate ? styles.ultimate : ''}`}
                                title={ability.englishName}
                              />
                            ) : (
                              <div key={idx} className={styles.matchAbilityIcon} title={`Ability ${abilityId}`} />
                            )
                          })}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Pagination hidden for now */}
            {false && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageButton}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>Page {page + 1}</span>
                <button
                  className={styles.pageButton}
                  onClick={() => setPage(p => p + 1)}
                  disabled={processedMatches.length < 12}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}
