import { useRef, useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { Link } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { usePersistedQuery } from '../api'
import { getHeroById } from '../data'
import { heroMiniUrl } from '../config'
import styles from './Home.module.css'

interface PlayerStats {
  steamId: number
  name: string
  gamesWon: number
  gamesPlayed: number
  overallRank: number
  region?: string
}

interface RecommendedMatch {
  matchId: number
  region: string
  tags: string[]
  avgRank: number
  radiant: number[]
  dire: number[]
}

interface HomeApiResponse {
  data: {
    weeklyGames: Array<{ startDate: string; gamesPlayed: number }>
    weeklyUniquePlayers: Array<{ startDate: string; uniquePlayers: number }>
    lifetimeStats?: {
      totalMatches?: number
      totalPlayers?: number
    }
    mostGamesLast30Days?: {
      players: PlayerStats[]
    }
    mostGamesAllTime?: {
      players: PlayerStats[]
    }
    recommendedReplays?: {
      matches: RecommendedMatch[]
    }
  }
}

export function HomePage() {
  const { data: apiResponse, isLoading } = usePersistedQuery<HomeApiResponse>('/home')
  const chartRef = useRef<SVGSVGElement>(null)
  const [replayPage, setReplayPage] = useState(0)

  // Merge weekly games and players data by date
  const chartData = useMemo(() => {
    if (!apiResponse?.data) return []

    const gamesMap = new Map<string, number>()
    const playersMap = new Map<string, number>()

    apiResponse.data.weeklyGames?.forEach(item => {
      gamesMap.set(item.startDate, item.gamesPlayed)
    })

    apiResponse.data.weeklyUniquePlayers?.forEach(item => {
      playersMap.set(item.startDate, item.uniquePlayers)
    })

    // Get all unique dates and sort them
    const allDates = new Set([...gamesMap.keys(), ...playersMap.keys()])
    const sortedDates = Array.from(allDates).sort()

    return sortedDates.map(date => ({
      date: new Date(date),
      games: gamesMap.get(date) ?? null,
      players: playersMap.get(date) ?? null,
    }))
  }, [apiResponse])

  // Summary stats
  const stats = useMemo(() => {
    if (!chartData.length) return null

    const totalGames = chartData.reduce((sum, d) => sum + (d.games ?? 0), 0)
    // Get the last non-zero players value (current week may be incomplete)
    const latestPlayers = chartData.filter(d => d.players !== null && d.players > 0).slice(-1)[0]?.players ?? 0
    const recentGames = chartData.slice(-4).reduce((sum, d) => sum + (d.games ?? 0), 0)

    return {
      totalGames,
      latestPlayers,
      recentGames,
    }
  }, [chartData])

  // Format tag with spaces (e.g., "BLOODBATH" -> "BLOOD BATH")
  const formatTag = (tag: string): string => {
    return tag
      .replace(/-/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/highskill/gi, 'HIGH SKILL')
      .toUpperCase()
  }

  // Get tag color based on type
  const getTagColor = (tag: string): string => {
    const tagLower = tag.toLowerCase()
    if (tagLower.includes('blood')) return '#ef5350'
    if (tagLower.includes('stomp')) return '#ab47bc'
    if (tagLower.includes('comeback')) return '#66bb6a'
    if (tagLower.includes('close')) return '#ffa726'
    if (tagLower.includes('long')) return '#42a5f5'
    if (tagLower.includes('short')) return '#26c6da'
    if (tagLower.includes('high')) return '#ffca28'
    return 'var(--color-accent2)'
  }

  // D3 chart rendering
  useEffect(() => {
    if (!chartRef.current || !chartData.length) return

    const svg = d3.select(chartRef.current)
    svg.selectAll('*').remove()

    const containerWidth = chartRef.current.parentElement?.clientWidth ?? 1300
    const width = Math.min(containerWidth - 32, 1250) // Account for padding
    const height = 400
    const margin = { top: 20, right: 60, bottom: 50, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    svg.attr('width', width).attr('height', height)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Filter out entries with null values for proper scaling
    const gamesData = chartData.filter(d => d.games !== null)
    const playersData = chartData.filter(d => d.players !== null)

    // X scale (time)
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(chartData, d => d.date) as [Date, Date])
      .range([0, innerWidth])

    // Y scales
    const gamesMax = d3.max(gamesData, d => d.games!) ?? 100000
    const yGamesScale = d3.scaleLinear().domain([0, gamesMax * 1.1]).range([innerHeight, 0])

    const playersMax = d3.max(playersData, d => d.players!) ?? 200000
    const yPlayersScale = d3.scaleLinear().domain([0, playersMax * 1.1]).range([innerHeight, 0])

    // Bar width calculation
    const barWidth = Math.max(1, (innerWidth / chartData.length) * 0.7)

    // Create tooltip
    const tooltip = d3.select(chartRef.current.parentElement)
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'var(--color-bg-elevated)')
      .style('border', '1px solid var(--color-border)')
      .style('border-radius', '4px')
      .style('padding', '8px 12px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '10')

    // Vertical hover line
    const hoverLine = g.append('line')
      .attr('class', 'hover-line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', 'var(--color-text-muted)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .style('visibility', 'hidden')

    // Draw bars for games
    g.selectAll('.bar')
      .data(gamesData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.date) - barWidth / 2)
      .attr('y', d => yGamesScale(d.games!))
      .attr('width', barWidth)
      .attr('height', d => innerHeight - yGamesScale(d.games!))
      .attr('fill', 'var(--color-accent)')
      .attr('opacity', 0.6)

    // Overlay for mouse tracking
    g.append('rect')
      .attr('class', 'overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mousemove', function(event) {
        const [mx] = d3.pointer(event)
        const date = xScale.invert(mx)
        const bisect = d3.bisector((d: typeof chartData[0]) => d.date).left
        const idx = bisect(chartData, date, 1)
        const d0 = chartData[idx - 1]
        const d1 = chartData[idx]
        const d = d1 && (date.getTime() - d0.date.getTime() > d1.date.getTime() - date.getTime()) ? d1 : d0

        if (d) {
          const x = xScale(d.date)
          hoverLine.attr('x1', x).attr('x2', x).style('visibility', 'visible')

          const formatDate = d3.timeFormat('%b %d, %Y')
          tooltip
            .style('visibility', 'visible')
            .html(`
              <div style="color: var(--color-text); margin-bottom: 4px; font-weight: bold;">${formatDate(d.date)}</div>
              <div style="color: var(--color-accent);">Games: ${d.games?.toLocaleString() ?? '—'}</div>
              <div style="color: var(--color-accent2);">Players: ${d.players?.toLocaleString() ?? '—'}</div>
            `)

          // Position tooltip on left side if near right edge
          const tooltipWidth = 150
          const isNearRightEdge = event.offsetX > width - tooltipWidth - 50
          tooltip
            .style('left', isNearRightEdge ? `${event.offsetX - tooltipWidth - 15}px` : `${event.offsetX + 15}px`)
            .style('top', `${event.offsetY - 10}px`)
        }
      })
      .on('mouseleave', function() {
        hoverLine.style('visibility', 'hidden')
        tooltip.style('visibility', 'hidden')
      })

    // Draw line for players
    const line = d3
      .line<{ date: Date; players: number | null }>()
      .defined(d => d.players !== null)
      .x(d => xScale(d.date))
      .y(d => yPlayersScale(d.players!))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', 'var(--color-accent2)')
      .attr('stroke-width', 2)
      .attr('d', line as any)

    // X axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(d3.timeYear.every(1))
      .tickFormat(d => d3.timeFormat('%Y')(d as Date))

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', 'var(--color-text-muted)')
      .selectAll('text')
      .attr('fill', 'var(--color-text-muted)')

    // Left Y axis (games)
    const yGamesAxis = d3.axisLeft(yGamesScale).ticks(5).tickFormat(d => d3.format('.2s')(d as number))

    g.append('g')
      .call(yGamesAxis)
      .attr('color', 'var(--color-text-muted)')
      .selectAll('text')
      .attr('fill', 'var(--color-accent)')

    // Right Y axis (players)
    const yPlayersAxis = d3.axisRight(yPlayersScale).ticks(5).tickFormat(d => d3.format('.2s')(d as number))

    g.append('g')
      .attr('transform', `translate(${innerWidth},0)`)
      .call(yPlayersAxis)
      .attr('color', 'var(--color-text-muted)')
      .selectAll('text')
      .attr('fill', 'var(--color-accent2)')

    // Axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-accent)')
      .attr('font-size', '12px')
      .text('Weekly Games')

    g.append('text')
      .attr('transform', 'rotate(90)')
      .attr('y', -innerWidth - 45)
      .attr('x', innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-accent2)')
      .attr('font-size', '12px')
      .text('Unique Players')

    // Legend
    const legend = g.append('g').attr('transform', `translate(${innerWidth - 180}, 0)`)

    legend
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 16)
      .attr('height', 12)
      .attr('fill', 'var(--color-accent)')
      .attr('opacity', 0.6)

    legend
      .append('text')
      .attr('x', 22)
      .attr('y', 10)
      .attr('fill', 'var(--color-text-muted)')
      .attr('font-size', '11px')
      .text('Games/week')

    legend
      .append('line')
      .attr('x1', 0)
      .attr('y1', 26)
      .attr('x2', 16)
      .attr('y2', 26)
      .attr('stroke', 'var(--color-accent2)')
      .attr('stroke-width', 2)

    legend
      .append('text')
      .attr('x', 22)
      .attr('y', 30)
      .attr('fill', 'var(--color-text-muted)')
      .attr('font-size', '11px')
      .text('Players/week')

    // Cleanup tooltip on unmount
    return () => {
      tooltip.remove()
    }
  }, [chartData])

  return (
    <PageShell>
      <div className={styles.hero}>
        <h1 className={styles.title}>WINDRUN</h1>
        <p className={styles.tagline}>Ability Draft Statistics</p>
        <p className={styles.subtitle}>
          Comprehensive data from hundreds of thousands of Dota 2 Ability Draft matches.
          <br />
          Hero win rates, ability synergies, player leaderboards, and match analysis.
        </p>
      </div>

      <div className={styles.chartContainer}>
        <h2 className={styles.chartTitle}>Ability Draft Activity</h2>
        {isLoading ? (
          <div className={styles.chartLoading}>Loading chart data...</div>
        ) : chartData.length > 0 ? (
          <svg ref={chartRef} className={styles.chart} />
        ) : (
          <div className={styles.chartLoading}>No activity data available</div>
        )}
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalGames.toLocaleString()}</span>
            <span className={styles.statLabel}>Total Games Tracked</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.latestPlayers.toLocaleString()}</span>
            <span className={styles.statLabel}>Unique Players This Week</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.recentGames.toLocaleString()}</span>
            <span className={styles.statLabel}>Games In Last 30 Days</span>
          </div>
        </div>
      )}

      {/* Most Games Tables */}
      <div className={styles.tablesContainer}>
        {apiResponse?.data?.mostGamesLast30Days?.players && (
          <div className={styles.tableSection}>
            <h3 className={styles.tableTitle}>Most Games Last 30 Days</h3>
            <table className={styles.leaderTable}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Region</th>
                  <th>Games</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {apiResponse.data.mostGamesLast30Days.players.slice(0, 25).map((player, index) => (
                  <tr key={player.steamId}>
                    <td className={styles.playerCell}>
                      <span className={styles.rank}>{index + 1}</span>
                      <span className={styles.playerName}>{player.name}</span>
                    </td>
                    <td className={styles.regionCell}>{player.region ?? '—'}</td>
                    <td className={styles.numericCell}>{player.gamesPlayed.toLocaleString()}</td>
                    <td className={styles.winrateCell}>
                      {((player.gamesWon / player.gamesPlayed) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {apiResponse?.data?.mostGamesAllTime?.players && (
          <div className={styles.tableSection}>
            <h3 className={styles.tableTitle}>Most Games All Time</h3>
            <table className={styles.leaderTable}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Region</th>
                  <th>Games</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {apiResponse.data.mostGamesAllTime.players.slice(0, 25).map((player, index) => (
                  <tr key={player.steamId}>
                    <td className={styles.playerCell}>
                      <span className={styles.rank}>{index + 1}</span>
                      <span className={styles.playerName}>{player.name}</span>
                    </td>
                    <td className={styles.regionCell}>{player.region ?? '—'}</td>
                    <td className={styles.numericCell}>{player.gamesPlayed.toLocaleString()}</td>
                    <td className={styles.winrateCell}>
                      {((player.gamesWon / player.gamesPlayed) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recommended Replays */}
        {apiResponse?.data?.recommendedReplays?.matches && apiResponse.data.recommendedReplays.matches.length > 0 && (
          <div className={styles.tableSection}>
            <h3 className={styles.tableTitle}>Recommended Replays</h3>
            <div className={styles.replaysGrid}>
              {apiResponse.data.recommendedReplays.matches
                .slice(replayPage * 11, replayPage * 11 + 11)
                .map(match => (
                  <Link
                    key={match.matchId}
                    to={`/matches/${match.matchId}`}
                    className={styles.replayCard}
                  >
                    <div className={styles.replayInfo}>
                      <span className={styles.replayRegion}>{match.region.toUpperCase()}</span>
                      {match.tags?.[0] && (
                        <span
                          className={styles.replayTag}
                          style={{ color: getTagColor(match.tags[0]) }}
                        >
                          {formatTag(match.tags[0])}
                        </span>
                      )}
                    </div>
                    <div className={styles.replayRankCol}>
                      <span className={styles.replayRankLabel}>Avg Rank</span>
                      <span className={styles.replayRank}>{match.avgRank.toLocaleString()}</span>
                    </div>
                    <div className={styles.replayTeams}>
                      <div className={styles.replayTeamRadiant}>
                        {match.radiant.map((heroId, idx) => {
                          const hero = getHeroById(heroId)
                          return hero ? (
                            <img
                              key={idx}
                              src={heroMiniUrl(hero.picture)}
                              alt={hero.englishName}
                              className={styles.replayHero}
                              title={hero.englishName}
                            />
                          ) : null
                        })}
                      </div>
                      <div className={styles.replayTeamDire}>
                        {match.dire.map((heroId, idx) => {
                          const hero = getHeroById(heroId)
                          return hero ? (
                            <img
                              key={idx}
                              src={heroMiniUrl(hero.picture)}
                              alt={hero.englishName}
                              className={styles.replayHero}
                              title={hero.englishName}
                            />
                          ) : null
                        })}
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
            {apiResponse.data.recommendedReplays.matches.length > 11 && (
              <div className={styles.replaysPagination}>
                {Array.from({ length: Math.ceil(apiResponse.data.recommendedReplays.matches.length / 11) }).map((_, idx) => (
                  <button
                    key={idx}
                    className={`${styles.pageButton} ${replayPage === idx ? styles.pageButtonActive : ''}`}
                    onClick={() => setReplayPage(idx)}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.bottomSpacer} />
    </PageShell>
  )
}
