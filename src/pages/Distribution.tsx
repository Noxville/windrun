import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import { PageShell } from '../components/PageShell'
import { usePersistedQuery, apiFetch } from '../api'
import styles from './Distribution.module.css'

interface RatingBand {
  rank: number
  count: number
}

interface PlayersApiResponse {
  data: {
    rankedPlayers: number
    ratingBands: RatingBand[]
  }
}

interface PlayerSearchResponse {
  data: {
    steamId: number
    nickname: string
    avatar: string
    rating: number
    region: string
    overallRank: number
    regionalRank: number
    percentile: number
    wins: number
    losses: number
  } | null
}

interface PlayerSearchResult {
  steamId: number
  nickname: string
  avatar: string
  rating: number
  region: string
  overallRank: number
  regionalRank: number
  percentile: number
  wins: number
  losses: number
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// The rank values in the API are the actual ratings (not offsets)
const RATING_BASELINE = 0

// Colors for multiple players
const PLAYER_COLORS = [
  'var(--color-accent2)',
  'var(--color-accent)',
  '#e879f9',
  '#34d399',
  '#f97316',
]

export function DistributionPage() {
  const [distributionType, setDistributionType] = useState<'normal' | 'cumulative'>('normal')
  const [searchSteamIds, setSearchSteamIds] = useState('')
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hoveredBar, setHoveredBar] = useState<{ rating: number; count: number; percentile: number; x: number; y: number } | null>(null)
  const chartRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedSteamIds = useDebounce(searchSteamIds, 500)

  // Fetch distribution data
  const { data: playersResponse, isLoading } = usePersistedQuery<PlayersApiResponse>('/players')

  const ratingBands = playersResponse?.data?.ratingBands ?? []

  // Transform rating bands to actual ratings
  const distributionData = useMemo(() => {
    return ratingBands
      .map(band => ({
        rating: band.rank + RATING_BASELINE,
        count: band.count,
      }))
      .sort((a, b) => a.rating - b.rating)
  }, [ratingBands])

  // Calculate actual total from the data (sum of all bucket counts)
  // This is more reliable than the API's rankedPlayers for calculations
  const totalPlayers = useMemo(() => {
    return distributionData.reduce((sum, d) => sum + d.count, 0)
  }, [distributionData])

  // Calculate cumulative distribution
  const cumulativeData = useMemo(() => {
    let cumulative = 0
    return distributionData.map(d => {
      cumulative += d.count
      return {
        rating: d.rating,
        count: d.count,
        cumulative,
        percentile: totalPlayers > 0 ? (cumulative / totalPlayers) * 100 : 0,
      }
    })
  }, [distributionData, totalPlayers])

  // Search for multiple players
  const searchPlayers = useCallback(async (steamIds: string) => {
    setSearchError(null)
    setSearchResults([])

    if (!steamIds.trim()) return

    // Parse comma-separated Steam IDs
    const ids = steamIds.split(',').map(s => s.trim()).filter(s => s)
    const validIds: number[] = []

    for (const idStr of ids) {
      const id = parseInt(idStr, 10)
      if (isNaN(id)) {
        setSearchError(`Invalid Steam ID format: ${idStr}`)
        return
      }
      validIds.push(id)
    }

    if (validIds.length === 0) return
    if (validIds.length > 5) {
      setSearchError('Maximum 5 Steam IDs allowed')
      return
    }

    try {
      const results: PlayerSearchResult[] = []
      const errors: string[] = []

      await Promise.all(validIds.map(async (id) => {
        try {
          const data = await apiFetch<PlayerSearchResponse>(`/api/v2/players/${id}`)
          if (data.data) {
            const player = data.data
            results.push({
              steamId: player.steamId,
              nickname: player.nickname,
              avatar: player.avatar,
              rating: player.rating,
              region: player.region,
              overallRank: player.overallRank,
              regionalRank: player.regionalRank,
              percentile: player.percentile,
              wins: player.wins,
              losses: player.losses,
            })
          } else {
            errors.push(`Player ${id} not found`)
          }
        } catch {
          errors.push(`Error fetching player ${id}`)
        }
      }))

      if (results.length > 0) {
        // Sort by rating descending
        results.sort((a, b) => b.rating - a.rating)
        setSearchResults(results)
      }
      if (errors.length > 0 && results.length === 0) {
        setSearchError(errors.join(', '))
      }
    } catch {
      setSearchError('Error searching for players')
    }
  }, [])

  // Auto-search when debounced steam IDs change
  useEffect(() => {
    if (debouncedSteamIds) {
      searchPlayers(debouncedSteamIds)
    } else {
      setSearchResults([])
      setSearchError(null)
    }
  }, [debouncedSteamIds, searchPlayers])

  // D3 chart rendering
  useEffect(() => {
    if (!chartRef.current || distributionData.length === 0) return

    const svg = d3.select(chartRef.current)
    svg.selectAll('*').remove()

    const containerWidth = chartRef.current.parentElement?.clientWidth ?? 800
    const width = Math.min(containerWidth, 1100)
    const height = 480
    const margin = { top: 45, right: 40, bottom: 50, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    svg.attr('width', width).attr('height', height)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Get min/max ratings
    const minRating = d3.min(distributionData, d => d.rating) ?? 1500
    const maxRating = d3.max(distributionData, d => d.rating) ?? 4500

    // X scale
    const xScale = d3
      .scaleLinear()
      .domain([minRating - 50, maxRating + 50])
      .range([0, innerWidth])

    // Y scale
    const yData = distributionType === 'cumulative'
      ? cumulativeData.map(d => d.percentile)
      : distributionData.map(d => d.count)
    const yMax = d3.max(yData) ?? 100
    const yScale = d3.scaleLinear().domain([0, yMax * 1.1]).range([innerHeight, 0])

    // Color scale for bars (gradient from cool to warm)
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([minRating, maxRating])

    // Draw bars or area
    if (distributionType === 'normal') {
      const barWidth = Math.max(2, (innerWidth / distributionData.length) * 0.85)

      g.selectAll('.bar')
        .data(distributionData)
        .enter()
        .append('rect')
        .attr('class', styles.bar)
        .attr('x', d => xScale(d.rating) - barWidth / 2)
        .attr('y', d => yScale(d.count))
        .attr('width', barWidth)
        .attr('height', d => innerHeight - yScale(d.count))
        .attr('fill', d => colorScale(d.rating))
        .attr('opacity', 0.85)
        .style('cursor', 'pointer')
        .on('mouseenter', function(event, d) {
          d3.select(this).attr('opacity', 1).attr('stroke', 'var(--color-text)').attr('stroke-width', 1)
          const cumData = cumulativeData.find(c => c.rating === d.rating)
          const rect = (event.target as SVGRectElement).getBoundingClientRect()
          const containerRect = containerRef.current?.getBoundingClientRect()
          if (containerRect) {
            setHoveredBar({
              rating: d.rating,
              count: d.count,
              percentile: cumData?.percentile ?? 0,
              x: rect.left - containerRect.left + rect.width / 2,
              y: rect.top - containerRect.top - 10,
            })
          }
        })
        .on('mouseleave', function() {
          d3.select(this).attr('opacity', 0.85).attr('stroke', 'none')
          setHoveredBar(null)
        })
    } else {
      // Cumulative area
      const area = d3
        .area<{ rating: number; percentile: number }>()
        .x(d => xScale(d.rating))
        .y0(innerHeight)
        .y1(d => yScale(d.percentile))
        .curve(d3.curveMonotoneX)

      // Gradient for cumulative
      const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'cumulative-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%')

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d3.interpolateViridis(0))
        .attr('stop-opacity', 0.4)

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', d3.interpolateViridis(1))
        .attr('stop-opacity', 0.4)

      g.append('path')
        .datum(cumulativeData)
        .attr('fill', 'url(#cumulative-gradient)')
        .attr('d', area as any)

      // Cumulative line
      const line = d3
        .line<{ rating: number; percentile: number }>()
        .x(d => xScale(d.rating))
        .y(d => yScale(d.percentile))
        .curve(d3.curveMonotoneX)

      g.append('path')
        .datum(cumulativeData)
        .attr('fill', 'none')
        .attr('stroke', d3.interpolateViridis(0.7))
        .attr('stroke-width', 2.5)
        .attr('d', line as any)

      // Create hover line (hidden initially)
      const hoverLine = g.append('line')
        .attr('class', 'hover-line')
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', 'var(--color-text)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0)
        .style('pointer-events', 'none')

      // Hover dot on the line
      const hoverDot = g.append('circle')
        .attr('class', 'hover-dot')
        .attr('r', 5)
        .attr('fill', 'var(--color-accent)')
        .attr('stroke', 'var(--color-bg)')
        .attr('stroke-width', 2)
        .attr('opacity', 0)
        .style('pointer-events', 'none')

      // Invisible wider path for hover detection
      g.selectAll('.hover-point')
        .data(cumulativeData)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.rating))
        .attr('cy', d => yScale(d.percentile))
        .attr('r', 8)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', function(event, d) {
          const rect = (event.target as SVGCircleElement).getBoundingClientRect()
          const containerRect = containerRef.current?.getBoundingClientRect()

          // Show hover line and dot
          const hoverX = xScale(d.rating)
          const hoverY = yScale(d.percentile)
          hoverLine.attr('x1', hoverX).attr('x2', hoverX).attr('opacity', 0.6)
          hoverDot.attr('cx', hoverX).attr('cy', hoverY).attr('opacity', 1)

          if (containerRect) {
            setHoveredBar({
              rating: d.rating,
              count: d.count,
              percentile: d.percentile,
              x: rect.left - containerRect.left + rect.width / 2,
              y: rect.top - containerRect.top - 10,
            })
          }
        })
        .on('mouseleave', () => {
          hoverLine.attr('opacity', 0)
          hoverDot.attr('opacity', 0)
          setHoveredBar(null)
        })
    }

    // Calculate and draw quartile and mean lines
    if (cumulativeData.length > 0 && totalPlayers > 0) {
      const classWidth = 25 // Fixed bucket width

      // Function to compute quartile using linear interpolation
      const computeQuartile = (position: number): number => {
        for (let i = 0; i < cumulativeData.length; i++) {
          if (cumulativeData[i].cumulative >= position) {
            const L = cumulativeData[i].rating // lower boundary
            const f = cumulativeData[i].count // class frequency
            const CF_prev = i === 0 ? 0 : cumulativeData[i - 1].cumulative

            // Linear interpolation within the bucket
            if (f > 0) {
              return L + ((position - CF_prev) / f) * classWidth
            }
            return L
          }
        }
        return cumulativeData[cumulativeData.length - 1]?.rating ?? minRating
      }

      // Calculate mean
      const totalWeighted = distributionData.reduce((sum, d) => {
        const midpoint = d.rating + classWidth / 2
        return sum + midpoint * d.count
      }, 0)
      const chartMeanRating = totalWeighted / totalPlayers

      // Draw Q1, Mean, Q3
      const q1 = computeQuartile(totalPlayers / 4)
      const q3 = computeQuartile((3 * totalPlayers) / 4)

      const lines = [
        { rating: q1, color: 'var(--color-text-muted)', width: 1, label: `Q1: ${Math.round(q1)}` },
        { rating: chartMeanRating, color: 'var(--color-accent)', width: 2, label: `Mean: ${Math.round(chartMeanRating)}` },
        { rating: q3, color: 'var(--color-text-muted)', width: 1, label: `Q3: ${Math.round(q3)}` },
      ]

      lines.forEach(({ rating, color, width, label }) => {
        const qX = xScale(rating)

        g.append('line')
          .attr('x1', qX)
          .attr('x2', qX)
          .attr('y1', 0)
          .attr('y2', innerHeight)
          .attr('stroke', color)
          .attr('stroke-width', width)
          .attr('stroke-dasharray', '4,4')
          .attr('opacity', 0.6)

        g.append('text')
          .attr('x', qX)
          .attr('y', -8)
          .attr('text-anchor', 'middle')
          .attr('fill', color)
          .attr('font-size', '10px')
          .attr('opacity', 0.8)
          .text(label)
      })
    }

    // Draw player markers for all search results
    searchResults.forEach((player, index) => {
      const playerColor = PLAYER_COLORS[index % PLAYER_COLORS.length]
      const playerX = xScale(player.rating)

      g.append('line')
        .attr('x1', playerX)
        .attr('x2', playerX)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', playerColor)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6,4')

      if (distributionType === 'cumulative') {
        const playerY = yScale(player.percentile * 100)
        g.append('circle')
          .attr('cx', playerX)
          .attr('cy', playerY)
          .attr('r', 6)
          .attr('fill', playerColor)
          .attr('stroke', 'var(--color-bg)')
          .attr('stroke-width', 2)
      }

      // Label (offset vertically for multiple players)
      g.append('text')
        .attr('x', playerX)
        .attr('y', -5 - (index * 14))
        .attr('text-anchor', 'middle')
        .attr('fill', playerColor)
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .text(player.nickname)
    })

    // X axis
    const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat(d => `${d}`)

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', 'var(--color-text-muted)')
      .selectAll('text')
      .attr('fill', 'var(--color-text-muted)')

    // Y axis
    const yAxis = distributionType === 'cumulative'
      ? d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}%`)
      : d3.axisLeft(yScale).ticks(5).tickFormat(d => d3.format(',')(d as number))

    g.append('g')
      .call(yAxis)
      .attr('color', 'var(--color-text-muted)')
      .selectAll('text')
      .attr('fill', 'var(--color-text-muted)')

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-text-muted)')
      .attr('font-size', '12px')
      .text('Rating')

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-text-muted)')
      .attr('font-size', '12px')
      .text(distributionType === 'cumulative' ? 'Percentile' : 'Number of Players')
  }, [distributionData, cumulativeData, distributionType, searchResults, totalPlayers])

  // Calculate mean rating (weighted average using bucket midpoints)
  const meanRating = useMemo(() => {
    if (distributionData.length === 0 || totalPlayers === 0) return 0

    const classWidth = 25
    const totalWeighted = distributionData.reduce((sum, d) => {
      const midpoint = d.rating + classWidth / 2
      return sum + midpoint * d.count
    }, 0)

    return Math.round(totalWeighted / totalPlayers)
  }, [distributionData, totalPlayers])

  const maxRating = useMemo(() => {
    return d3.max(distributionData, d => d.rating) ?? 0
  }, [distributionData])

  // Format region name
  const formatRegion = (region: string) => {
    return region.charAt(0).toUpperCase() + region.slice(1)
  }

  return (
    <PageShell
      title="Rating Distribution"
      subtitle="Active Ability Draft player ratings"
    >
      <div className={styles.container} ref={containerRef}>
        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.typeSelector}>
            <button
              className={`${styles.typeButton} ${distributionType === 'normal' ? styles.active : ''}`}
              onClick={() => setDistributionType('normal')}
            >
              Distribution
            </button>
            <button
              className={`${styles.typeButton} ${distributionType === 'cumulative' ? styles.active : ''}`}
              onClick={() => setDistributionType('cumulative')}
            >
              Cumulative
            </button>
          </div>

          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Enter Steam ID(s)..."
              value={searchSteamIds}
              onChange={e => setSearchSteamIds(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className={styles.searchResultsContainer}>
            {searchResults.map((player, index) => (
              <div
                key={player.steamId}
                className={styles.searchResult}
                style={{ borderColor: PLAYER_COLORS[index % PLAYER_COLORS.length] }}
              >
                <div className={styles.resultIdentity}>
                  <img
                    src={player.avatar}
                    alt={player.nickname}
                    className={styles.resultAvatar}
                  />
                  <div>
                    <span className={styles.resultName}>{player.nickname}</span>
                    <span className={styles.resultRegion}>{formatRegion(player.region)}</span>
                  </div>
                </div>
                <div className={styles.resultRanks}>
                  <span className={styles.resultRank}>Global #{player.overallRank?.toLocaleString() ?? '—'}</span>
                  <span className={styles.resultRegionalRank}>{formatRegion(player.region)} #{player.regionalRank?.toLocaleString() ?? '—'}</span>
                </div>
                <div className={styles.resultStats}>
                  <div className={styles.resultStat}>
                    <span className={styles.resultLabel}>Rating</span>
                    <span className={styles.resultValue}>{player.rating != null ? Math.round(player.rating).toLocaleString() : '—'}</span>
                  </div>
                  <div className={styles.resultStat}>
                    <span className={styles.resultLabel}>Percentile</span>
                    <span className={styles.resultValue}>{player.percentile != null ? `${(player.percentile * 100).toFixed(1)}%` : 'Unranked'}</span>
                  </div>
                  <div className={styles.resultStat}>
                    <span className={styles.resultLabel}>Record</span>
                    <span className={styles.resultValue}>
                      {player.wins ?? 0}W-{player.losses ?? 0}L
                    </span>
                  </div>
                  <div className={styles.resultStat}>
                    <span className={styles.resultLabel}>WR</span>
                    <span className={styles.resultValue}>
                      {player.wins != null && player.losses != null && (player.wins + player.losses) > 0
                        ? `${((player.wins / (player.wins + player.losses)) * 100).toFixed(1)}%`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {searchError && (
          <div className={styles.searchError}>{searchError}</div>
        )}

        {/* Chart */}
        <div className={styles.chartContainer}>
          {isLoading ? (
            <div className={styles.loading}>Loading distribution data...</div>
          ) : (
            <>
              <svg ref={chartRef} className={styles.chart} />
              {hoveredBar && (
                <div
                  className={styles.tooltip}
                  style={{
                    left: hoveredBar.x,
                    top: hoveredBar.y,
                  }}
                >
                  <div className={styles.tooltipRating}>
                    {hoveredBar.rating.toLocaleString()} - {(hoveredBar.rating + 25).toLocaleString()}
                  </div>
                  <div className={styles.tooltipCount}>
                    {hoveredBar.count.toLocaleString()} players
                  </div>
                  {distributionType === 'cumulative' && (
                    <div className={styles.tooltipPercentile}>
                      {hoveredBar.percentile.toFixed(1)}% percentile
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{totalPlayers.toLocaleString()}</span>
            <span className={styles.statLabelWithHelp}>
              Active Calibrated Players
              <span
                className={styles.helpIcon}
                title="Active means they've played at least 150 games total and at least one game in the last month."
              >
                ?
              </span>
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {meanRating > 0 ? meanRating.toLocaleString() : '—'}
            </span>
            <span className={styles.statLabel}>Mean Rating</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {maxRating > 0 ? maxRating.toLocaleString() : '—'}
            </span>
            <span className={styles.statLabel}>Highest Rating</span>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
