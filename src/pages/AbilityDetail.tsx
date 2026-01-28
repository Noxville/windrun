import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import type { ColumnDef } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  AbilityIcon,
  AbilityInline,
  HeroInline,
  DataTable,
  GradientCell,
  NumericCell,
  DeltaCell,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { getAbilityById, getHeroById } from '../data'
import styles from './AbilityDetail.module.css'

interface PickStats {
  pick: number
  total: number
  wins: number
  winrate: number
  wilsonLower: number
  wilsonUpper: number
}

interface AbilityDetailApiResponse {
  data: {
    abilityId: number
    singleAbility: {
      picks: PickStats[]
    }
  }
}

interface AbilityPairsApiResponse {
  data: {
    patches: { overall: string[] }
    abilityPairs: Array<{
      abilityIdOne: number
      abilityIdTwo: number
      numPicks: number
      wins: number
      winrate: number
    }>
  }
}

interface AbilitiesApiResponse {
  data: {
    patches: { overall: string[] }
    abilityStats: Array<{
      abilityId: number
      numPicks: number
      wins: number
      winrate: number
    }>
  }
}

interface PairRow {
  key: string
  otherAbilityId: number
  otherAbilityName: string
  otherShortName: string
  otherIsUltimate: boolean
  otherIsHeroAbility: boolean
  otherHeroId?: number
  otherHeroPicture?: string
  otherWinRate: number | null
  picks: number
  wins: number
  pairWinRate: number
  synergy: number | null
}

function resolveAbilityInfo(abilityId: number) {
  const isHeroAbility = abilityId < 0
  const heroIdFromAbility = isHeroAbility ? Math.abs(abilityId) : undefined
  const hero = heroIdFromAbility ? getHeroById(heroIdFromAbility) : undefined
  const ability = !isHeroAbility ? getAbilityById(abilityId) : undefined

  return {
    abilityId,
    abilityName: isHeroAbility
      ? (hero?.englishName ?? `Hero #${heroIdFromAbility}`)
      : (ability?.englishName ?? `Ability #${abilityId}`),
    shortName: ability?.shortName ?? '',
    isUltimate: ability?.isUltimate ?? false,
    isHeroAbility,
    heroId: heroIdFromAbility,
    heroPicture: hero?.picture,
    ownerHeroId: isHeroAbility ? heroIdFromAbility : ability?.ownerHeroId,
  }
}

export function AbilityDetailPage() {
  const { abilityId } = useParams()
  const chartRef = useRef<HTMLDivElement>(null)
  const { currentPatch } = usePatchSelection()
  const [winrateType, setWinrateType] = useState<'normal' | 'cumulative'>('normal')

  const { data: apiResponse, isLoading, error } = usePersistedQuery<AbilityDetailApiResponse>(
    `/abilities/${abilityId}`
  )

  // Fetch ability pairs
  const { data: pairsResponse, isLoading: pairsLoading } = usePersistedQuery<AbilityPairsApiResponse>(
    '/ability-pairs',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  // Fetch individual ability stats for winrates
  const { data: abilitiesResponse, isLoading: abilitiesLoading } = usePersistedQuery<AbilitiesApiResponse>(
    '/abilities',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  const ability = useMemo(() => {
    const id = Number(abilityId)
    if (id < 0) {
      // Hero body
      const hero = getHeroById(Math.abs(id))
      return {
        id,
        name: hero?.englishName ?? `Hero #${Math.abs(id)}`,
        shortName: '',
        isUltimate: false,
        isHero: true,
        hero,
      }
    }
    const abil = getAbilityById(id)
    const ownerHero = abil?.ownerHeroId ? getHeroById(abil.ownerHeroId) : undefined
    return {
      id,
      name: abil?.englishName ?? `Ability #${id}`,
      shortName: abil?.shortName ?? '',
      isUltimate: abil?.isUltimate ?? false,
      isHero: false,
      hero: ownerHero,
    }
  }, [abilityId])

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!apiResponse?.data?.singleAbility?.picks) return null

    const picks = apiResponse.data.singleAbility.picks
    const total = picks.reduce((sum, p) => sum + p.total, 0)

    // Build data for picks 1-40
    const data: Array<{
      pick: number
      pickRate: number
      cumulativePickRate: number
      winrate: number
      cumulativeWinrate: number
      wilsonLower: number
      wilsonUpper: number
      count: number
    }> = []

    let cumulativeWins = 0
    let cumulativeTotal = 0
    let cumulativePicks = 0

    for (let i = 1; i <= 40; i++) {
      const row = picks.find(p => p.pick === i)

      // Accumulate wins and total for cumulative stats
      if (row) {
        cumulativeWins += row.wins
        cumulativeTotal += row.total
        cumulativePicks += row.total
      }

      const cumulativeWinrate = cumulativeTotal > 0
        ? (cumulativeWins / cumulativeTotal) * 100
        : 50

      const cumulativePickRate = total > 0
        ? (cumulativePicks / total) * 100
        : 0

      data.push({
        pick: i,
        pickRate: row ? (100 * row.total) / total : 0,
        cumulativePickRate,
        winrate: row ? row.winrate * 100 : 50,
        cumulativeWinrate,
        wilsonLower: row ? row.wilsonLower * 100 : 0,
        wilsonUpper: row ? row.wilsonUpper * 100 : 100,
        count: row?.total ?? 0,
      })
    }

    return data
  }, [apiResponse])

  // Build ability winrate map
  const abilityWinRateMap = useMemo(() => {
    if (!abilitiesResponse?.data?.abilityStats) return {}
    const map: Record<number, number> = {}
    abilitiesResponse.data.abilityStats.forEach(stat => {
      map[stat.abilityId] = stat.winrate * 100
    })
    return map
  }, [abilitiesResponse])

  // Filter pairs involving this ability
  const pairsData = useMemo<PairRow[]>(() => {
    if (!pairsResponse?.data?.abilityPairs) return []

    const currentAbilityId = Number(abilityId)
    const currentWinRate = abilityWinRateMap[currentAbilityId] ?? null

    return pairsResponse.data.abilityPairs
      .filter(pair => pair.abilityIdOne === currentAbilityId || pair.abilityIdTwo === currentAbilityId)
      .map(pair => {
        // Determine which is the "other" ability
        const isFirst = pair.abilityIdOne === currentAbilityId
        const otherId = isFirst ? pair.abilityIdTwo : pair.abilityIdOne
        const other = resolveAbilityInfo(otherId)
        const otherWinRate = abilityWinRateMap[otherId] ?? null
        const pairWinRate = pair.winrate * 100

        // Calculate synergy
        let synergy: number | null = null
        if (currentWinRate !== null && otherWinRate !== null && currentWinRate > 0 && otherWinRate > 0) {
          const geometricMean = Math.sqrt(currentWinRate * otherWinRate)
          synergy = pairWinRate - geometricMean
        }

        return {
          key: `${pair.abilityIdOne}-${pair.abilityIdTwo}`,
          otherAbilityId: other.abilityId,
          otherAbilityName: other.abilityName,
          otherShortName: other.shortName,
          otherIsUltimate: other.isUltimate,
          otherIsHeroAbility: other.isHeroAbility,
          otherHeroId: other.heroId,
          otherHeroPicture: other.heroPicture,
          otherWinRate,
          picks: pair.numPicks,
          wins: pair.wins,
          pairWinRate,
          synergy,
        }
      })
      .filter(row => row.picks >= 30)
  }, [pairsResponse, abilityWinRateMap, abilityId])

  const pairsColumns = useMemo<ColumnDef<PairRow>[]>(
    () => [
      {
        accessorKey: 'otherAbilityName',
        header: 'Paired Ability',
        size: 200,
        cell: info => {
          const row = info.row.original
          if (row.otherIsHeroAbility && row.otherHeroId) {
            return (
              <HeroInline
                id={row.otherHeroId}
                name={row.otherAbilityName}
                picture={row.otherHeroPicture || ''}
                linkTo={`/heroes/${row.otherHeroId}`}
              />
            )
          }
          return (
            <AbilityInline
              id={row.otherAbilityId}
              name={row.otherAbilityName}
              shortName={row.otherShortName}
              isUltimate={row.otherIsUltimate}
              linkTo={`/abilities/${row.otherAbilityId}`}
            />
          )
        },
      },
      {
        accessorKey: 'otherWinRate',
        header: 'Ability WR',
        size: 80,
        cell: info => {
          const value = info.getValue() as number | null
          if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
          return (
            <GradientCell
              value={value}
              min={43}
              max={57}
              decimals={1}
              suffix="%"
            />
          )
        },
      },
      {
        accessorKey: 'pairWinRate',
        header: 'Pair WR',
        size: 80,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={43}
            max={57}
            decimals={1}
            suffix="%"
          />
        ),
      },
      {
        accessorKey: 'synergy',
        header: 'Synergy',
        size: 80,
        cell: info => {
          const value = info.getValue() as number | null
          if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
          return <DeltaCell value={value} decimals={1} suffix="%" />
        },
      },
      {
        accessorKey: 'picks',
        header: 'Picks',
        size: 70,
        cell: info => <NumericCell value={info.getValue() as number} decimals={0} />,
      },
    ],
    []
  )

  // D3 chart
  useEffect(() => {
    if (!chartRef.current || !chartData) return

    const margin = { top: 30, right: 60, bottom: 50, left: 60 }
    const containerWidth = chartRef.current.clientWidth
    const width = containerWidth - margin.left - margin.right
    const height = 400 - margin.top - margin.bottom

    // Clear existing
    d3.select(chartRef.current).selectAll('*').remove()

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Scales
    const x = d3.scaleBand()
      .domain(chartData.map(d => String(d.pick)))
      .range([0, width])
      .padding(0.1)

    // Y-left scale: 0-100% for cumulative mode, auto-scale for normal mode
    const maxPickRate = winrateType === 'cumulative'
      ? 100
      : (d3.max(chartData, d => d.pickRate) ?? 10) * 1.1
    const yLeft = d3.scaleLinear()
      .domain([0, maxPickRate])
      .range([height, 0])

    const yRight = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0])

    // X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .attr('class', styles.axis)
      .call(d3.axisBottom(x).tickValues(chartData.filter((_, i) => i % 5 === 0).map(d => String(d.pick))))
      .append('text')
      .attr('x', width / 2)
      .attr('y', 40)
      .attr('fill', '#aaa')
      .attr('text-anchor', 'middle')
      .text('Pick Order')

    // Y axis left (pick rate)
    const pickRateLabel = winrateType === 'cumulative' ? 'Cumulative Pick %' : 'Pick %'
    svg.append('g')
      .attr('class', styles.axis)
      .call(d3.axisLeft(yLeft).ticks(5).tickFormat(d => `${d}%`))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -height / 2)
      .attr('fill', '#ffcc33')
      .attr('text-anchor', 'middle')
      .text(pickRateLabel)

    // Y axis right (win rate)
    const winrateLabel = winrateType === 'cumulative' ? 'Cumulative Win %' : 'Win %'
    svg.append('g')
      .attr('transform', `translate(${width},0)`)
      .attr('class', styles.axis)
      .call(d3.axisRight(yRight).ticks(5).tickFormat(d => `${d}%`))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 50)
      .attr('x', -height / 2)
      .attr('fill', '#2dd4bf')
      .attr('text-anchor', 'middle')
      .text(winrateLabel)

    // Confidence interval area (only for normal mode)
    if (winrateType === 'normal') {
      const area = d3.area<typeof chartData[0]>()
        .x(d => (x(String(d.pick)) ?? 0) + x.bandwidth() / 2)
        .y0(d => yRight(d.wilsonLower))
        .y1(d => yRight(d.wilsonUpper))
        .curve(d3.curveMonotoneX)

      svg.append('path')
        .datum(chartData)
        .attr('fill', 'rgba(184, 184, 184, 0.3)')
        .attr('d', area)
    }

    // Pick rate bars (use cumulative or normal based on selection)
    const getPickRate = (d: typeof chartData[0]) =>
      winrateType === 'cumulative' ? d.cumulativePickRate : d.pickRate

    svg.selectAll('.bar')
      .data(chartData)
      .join('rect')
      .attr('class', styles.bar)
      .attr('x', d => x(String(d.pick)) ?? 0)
      .attr('y', d => yLeft(getPickRate(d)))
      .attr('width', x.bandwidth())
      .attr('height', d => height - yLeft(getPickRate(d)))
      .attr('fill', '#ffcc33')
      .attr('opacity', 0.7)

    // Winrate line (use cumulative or normal based on selection)
    const line = d3.line<typeof chartData[0]>()
      .x(d => (x(String(d.pick)) ?? 0) + x.bandwidth() / 2)
      .y(d => yRight(winrateType === 'cumulative' ? d.cumulativeWinrate : d.winrate))
      .curve(d3.curveMonotoneX)

    svg.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', '#2dd4bf')
      .attr('stroke-width', 2.5)
      .attr('d', line)

    // 50% reference line
    svg.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yRight(50))
      .attr('y2', yRight(50))
      .attr('stroke', '#666')
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.5)

    // Tooltip
    const tooltip = d3.select(chartRef.current)
      .append('div')
      .attr('class', styles.chartTooltip)
      .style('opacity', 0)

    // Hover areas
    svg.selectAll('.hover-area')
      .data(chartData)
      .join('rect')
      .attr('x', d => x(String(d.pick)) ?? 0)
      .attr('y', 0)
      .attr('width', x.bandwidth())
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('mouseenter', (_, d) => {
        const displayWinrate = winrateType === 'cumulative' ? d.cumulativeWinrate : d.winrate
        const displayPickRate = winrateType === 'cumulative' ? d.cumulativePickRate : d.pickRate
        const pickRateText = winrateType === 'cumulative' ? 'Cumulative Pick' : 'Pick Rate'
        const winrateText = winrateType === 'cumulative' ? 'Cumulative WR' : 'Winrate'
        const ciText = winrateType === 'normal'
          ? `<br/>CI: ${d.wilsonLower.toFixed(1)}% - ${d.wilsonUpper.toFixed(1)}%`
          : ''
        tooltip
          .style('opacity', 1)
          .html(`
            <strong>Pick #${d.pick}</strong><br/>
            ${pickRateText}: ${displayPickRate.toFixed(2)}%<br/>
            ${winrateText}: ${displayWinrate.toFixed(2)}%${ciText}<br/>
            Count: ${d.count.toLocaleString()}
          `)
      })
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event, chartRef.current)
        tooltip
          .style('left', `${mx + 15}px`)
          .style('top', `${my - 10}px`)
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', 0)
      })

  }, [chartData, winrateType])

  if (error) {
    return (
      <PageShell title="Ability Details">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading ability data. Please try again later.
        </p>
      </PageShell>
    )
  }

  if (isLoading || !chartData) {
    return (
      <PageShell title="Ability Details">
        <p style={{ color: 'var(--color-text-muted)' }}>Loading ability data...</p>
      </PageShell>
    )
  }

  const abilityProfile = (
    <div className={styles.abilityProfile}>
      {!ability.isHero && ability.shortName && (
        <AbilityIcon
          id={ability.id}
          name={ability.name}
          shortName={ability.shortName}
          isUltimate={ability.isUltimate}
          size="lg"
        />
      )}
      {ability.isUltimate && (
        <span className={styles.ultimateTag}>Ultimate</span>
      )}
    </div>
  )

  return (
    <PageShell
      title={ability.name}
      subtitle={ability.hero ? (
        <>
          {ability.isHero ? 'Hero Body' : 'Ability from'}{' '}
          <Link to={`/heroes/${ability.hero.id}`} className={styles.heroLink}>
            {ability.hero.englishName}
          </Link>
        </>
      ) : undefined}
      actions={abilityProfile}
    >

      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>Winrate and Pickrate by Pick Order</h3>
          <div className={styles.typeSelector}>
            <button
              className={`${styles.typeButton} ${winrateType === 'normal' ? styles.active : ''}`}
              onClick={() => setWinrateType('normal')}
            >
              Per Pick
            </button>
            <button
              className={`${styles.typeButton} ${winrateType === 'cumulative' ? styles.active : ''}`}
              onClick={() => setWinrateType('cumulative')}
            >
              Cumulative
            </button>
          </div>
        </div>
        <div ref={chartRef} className={styles.chart} />
        <div className={styles.chartLegend}>
          <span className={styles.legendItem}>
            <span className={styles.legendBar} style={{ background: '#ffcc33' }} />
            {winrateType === 'cumulative' ? 'Cumulative Pick Rate' : 'Pick Rate'}
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendLine} style={{ background: '#2dd4bf' }} />
            {winrateType === 'cumulative' ? 'Cumulative Win Rate' : 'Win Rate'}
          </span>
          {winrateType === 'normal' && (
            <span className={styles.legendItem}>
              <span className={styles.legendArea} />
              Confidence Interval
            </span>
          )}
        </div>
      </div>

      {pairsData.length > 0 && (
        <div className={styles.pairsSection}>
          <h3 className={styles.pairsTitle}>Best Ability Pairs</h3>
          <DataTable
            data={pairsData}
            columns={pairsColumns}
            searchPlaceholder="Search abilities..."
            searchableColumns={['otherAbilityName']}
            initialSorting={[{ id: 'synergy', desc: true }]}
            emptyMessage="No pair data available"
            loading={pairsLoading || abilitiesLoading}
            maxHeight="calc(100vh - 720px)"
          />
        </div>
      )}
    </PageShell>
  )
}
