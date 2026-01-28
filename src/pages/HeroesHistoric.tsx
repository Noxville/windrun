import { useEffect, useRef, useMemo, useState, useLayoutEffect } from 'react'
import * as d3 from 'd3'
import { PageShell } from '../components/PageShell'
import { usePersistedQuery } from '../api'
import { heroMiniUrl } from '../config'
import { getHeroById } from '../data'
import styles from './HeroesHistoric.module.css'

// Hook to make page full-width by modifying app-main
function useFullWidthPage() {
  useLayoutEffect(() => {
    const appMain = document.querySelector('.app-main')
    if (appMain) {
      appMain.classList.add('app-main-full')
    }
    return () => {
      if (appMain) {
        appMain.classList.remove('app-main-full')
      }
    }
  }, [])
}

interface HeroHistoricData {
  patches: string[]
  data: Record<string, {
    ranks: (number | null)[]
    winrates: (number | null)[]
  }>
}

interface HeroHistoricApiResponse {
  data: {
    heroHistoricData?: HeroHistoricData
    // Alternative structure - data might be at root level
    patches?: string[]
  } & Partial<HeroHistoricData>
}

export function HeroesHistoricPage() {
  useFullWidthPage()

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [highlightedHero, setHighlightedHero] = useState<string | null>(null)

  const { data: apiResponse, isLoading, error } = usePersistedQuery<HeroHistoricApiResponse>(
    '/heroes/historic'
  )

  // Handle different possible API response structures
  const historicData = apiResponse?.data?.heroHistoricData ?? apiResponse?.data
  const patches = historicData?.patches ?? []
  const heroData = historicData?.data ?? {}

  // Prepare hero lines data
  const heroLines = useMemo(() => {
    if (!heroData || Object.keys(heroData).length === 0) return []

    return Object.entries(heroData).map(([heroId, hdata]) => {
      const hero = getHeroById(Number(heroId))
      const points = patches.map((patch, i) => ({
        patch,
        rank: hdata.ranks[i],
        winrate: hdata.winrates[i],
      }))
      const validRanks = hdata.ranks.filter(r => r !== null) as number[]
      const validWinrates = hdata.winrates.filter(w => w !== null) as number[]

      return {
        heroId,
        heroName: hero?.englishName ?? `Hero #${heroId}`,
        heroPicture: hero?.picture ?? '',
        points,
        firstRank: hdata.ranks[0],
        lastRank: hdata.ranks[hdata.ranks.length - 1],
        avgRank: validRanks.length > 0 ? d3.mean(validRanks) : null,
        bestRank: validRanks.length > 0 ? Math.min(...validRanks) : null,
        worstRank: validRanks.length > 0 ? Math.max(...validRanks) : null,
        bestWinrate: validWinrates.length > 0 ? Math.max(...validWinrates) : null,
        worstWinrate: validWinrates.length > 0 ? Math.min(...validWinrates) : null,
      }
    })
  }, [heroData, patches])

  // Dota player colors
  const dotaColors = [
    '#3375FF', '#66FFBF', '#BF00BF', '#F3F00B', '#FF6B00',
    '#FE86C2', '#A1B447', '#65D9F7', '#008321', '#A46900'
  ]

  const getHeroColor = (heroId: string) => {
    const hero = heroLines.find(h => h.heroId === heroId)
    if (!hero || hero.lastRank === null) return dotaColors[0]
    return dotaColors[(hero.lastRank - 1) % 10]
  }

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || patches.length === 0 || heroLines.length === 0) return

    const numHeroes = heroLines.length
    const margin = { top: 30, right: 70, bottom: 80, left: 40 }
    // Use full container width (page is now full-width)
    const containerWidth = containerRef.current.clientWidth
    const width = containerWidth - margin.left - margin.right
    const height = numHeroes * 24 // 24px per rank

    // Clear existing content
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Scales
    const x = d3.scalePoint<string>()
      .domain(patches)
      .range([0, width])

    const y = d3.scaleLinear()
      .domain([numHeroes, 1])
      .range([height, 0])

    // Band colors
    const bandColors = [
      'rgba(0, 140, 0, 0.18)', 'rgba(40, 160, 40, 0.16)', 'rgba(80, 170, 60, 0.16)',
      'rgba(130, 180, 50, 0.15)', 'rgba(180, 180, 0, 0.14)', 'rgba(200, 160, 0, 0.15)',
      'rgba(210, 130, 0, 0.16)', 'rgba(200, 90, 30, 0.16)', 'rgba(180, 60, 40, 0.17)',
      'rgba(160, 40, 40, 0.18)'
    ]

    // Background bands
    const bandSize = 13
    const numBands = Math.ceil(numHeroes / bandSize)
    for (let i = 0; i < numBands; i++) {
      const startRank = i * bandSize + 1
      const endRank = Math.min((i + 1) * bandSize, numHeroes)
      g.append('rect')
        .attr('x', 0)
        .attr('y', y(startRank) - 12)
        .attr('width', width)
        .attr('height', (endRank - startRank + 1) * 24)
        .attr('fill', bandColors[i % 10])
        .attr('class', styles.rankBand)
    }

    // Grid lines
    g.append('g')
      .attr('class', styles.grid)
      .call(d3.axisLeft(y)
        .tickSize(-width)
        .tickFormat(() => '')
        .ticks(20)
      )

    // X axis
    g.append('g')
      .attr('class', styles.xAxis)
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')

    // Line generator
    const line = d3.line<{ patch: string; rank: number | null }>()
      .defined(d => d.rank !== null)
      .x(d => x(d.patch) ?? 0)
      .y(d => y(d.rank!))
      .curve(d3.curveMonotoneX)

    // Draw lines
    heroLines.forEach(heroLine => {
      g.append('path')
        .datum(heroLine.points)
        .attr('class', `${styles.heroLine}`)
        .attr('data-hero-id', heroLine.heroId)
        .attr('d', line)
        .attr('stroke', getHeroColor(heroLine.heroId))
        .on('mouseenter', (event) => {
          setHighlightedHero(heroLine.heroId)
          showTooltip(event, heroLine, null)
        })
        .on('mousemove', (event) => {
          const mouseX = d3.pointer(event)[0]
          let closestPatch = patches[0]
          let minDist = Infinity
          patches.forEach(patch => {
            const dist = Math.abs((x(patch) ?? 0) - mouseX)
            if (dist < minDist) {
              minDist = dist
              closestPatch = patch
            }
          })
          const idx = patches.indexOf(closestPatch)
          const point = heroLine.points[idx]
          showTooltip(event, heroLine, point)
        })
        .on('mouseleave', () => {
          setHighlightedHero(null)
          hideTooltip()
        })

      // Draw points
      heroLine.points.forEach(point => {
        if (point.rank !== null) {
          g.append('circle')
            .attr('class', styles.heroPoint)
            .attr('data-hero-id', heroLine.heroId)
            .attr('cx', x(point.patch) ?? 0)
            .attr('cy', y(point.rank))
            .attr('r', 6)
            .attr('fill', getHeroColor(heroLine.heroId))
            .attr('stroke', '#333')
            .attr('stroke-width', 1.5)
            .on('mouseenter', (event) => {
              setHighlightedHero(heroLine.heroId)
              showTooltip(event, heroLine, point)
            })
            .on('mouseleave', () => {
              setHighlightedHero(null)
              hideTooltip()
            })
        }
      })
    })

    // Left side hero images (first rank)
    heroLines
      .filter(h => h.firstRank !== null)
      .sort((a, b) => (a.firstRank ?? 0) - (b.firstRank ?? 0))
      .forEach(heroLine => {
        if (heroLine.heroPicture) {
          g.append('image')
            .attr('class', styles.heroImage)
            .attr('data-hero-id', heroLine.heroId)
            .attr('href', heroMiniUrl(heroLine.heroPicture))
            .attr('x', -30)
            .attr('y', y(heroLine.firstRank!) - 12)
            .attr('width', 24)
            .attr('height', 24)
            .on('mouseenter', (event) => {
              setHighlightedHero(heroLine.heroId)
              showTooltip(event, heroLine, heroLine.points[0])
            })
            .on('mouseleave', () => {
              setHighlightedHero(null)
              hideTooltip()
            })
        }
      })

    // Right side hero images (last rank)
    heroLines
      .filter(h => h.lastRank !== null)
      .sort((a, b) => (a.lastRank ?? 0) - (b.lastRank ?? 0))
      .forEach(heroLine => {
        if (heroLine.heroPicture) {
          const rightGroup = g.append('g')
            .attr('class', styles.rightAxisGroup)
            .attr('data-hero-id', heroLine.heroId)
            .style('cursor', 'pointer')

          rightGroup.append('image')
            .attr('class', styles.heroImage)
            .attr('data-hero-id', heroLine.heroId)
            .attr('href', heroMiniUrl(heroLine.heroPicture))
            .attr('x', width + 10)
            .attr('y', y(heroLine.lastRank!) - 12)
            .attr('width', 24)
            .attr('height', 24)

          rightGroup.append('text')
            .attr('class', styles.rankLabel)
            .attr('x', width + 38)
            .attr('y', y(heroLine.lastRank!) + 4)
            .attr('text-anchor', 'start')
            .attr('fill', '#aaa')
            .attr('font-size', '11px')
            .text(heroLine.lastRank!)

          rightGroup
            .on('mouseenter', (event) => {
              setHighlightedHero(heroLine.heroId)
              const lastPoint = heroLine.points[heroLine.points.length - 1]
              showTooltip(event, heroLine, lastPoint)
            })
            .on('mouseleave', () => {
              setHighlightedHero(null)
              hideTooltip()
            })
        }
      })

    function showTooltip(event: MouseEvent, heroLine: typeof heroLines[0], point: { patch: string; rank: number | null; winrate: number | null } | null) {
      const tooltip = tooltipRef.current
      if (!tooltip) return

      let html = `<div class="${styles.tooltipHeader}">
        <img src="${heroMiniUrl(heroLine.heroPicture)}" height="24" />
        <span>${heroLine.heroName}</span>
      </div>`

      if (point && point.rank !== null) {
        html += `<div class="${styles.tooltipPatch}">Patch ${point.patch.replace('_', '')}</div>`
        html += `<div class="${styles.tooltipStat}">Rank: <strong>${point.rank}</strong> / ${numHeroes}</div>`
        if (point.winrate !== null) {
          html += `<div class="${styles.tooltipStat}">Winrate: <strong>${(point.winrate * 100).toFixed(2)}%</strong></div>`
        }
      }

      tooltip.innerHTML = html
      tooltip.style.display = 'block'

      const rect = tooltip.getBoundingClientRect()
      let left = event.clientX + 15
      let top = event.clientY + 10

      if (left + rect.width > window.innerWidth - 10) {
        left = event.clientX - rect.width - 15
      }
      if (top + rect.height > window.innerHeight - 10) {
        top = event.clientY - rect.height - 10
      }

      tooltip.style.left = `${left}px`
      tooltip.style.top = `${top}px`
    }

    function hideTooltip() {
      const tooltip = tooltipRef.current
      if (tooltip) {
        tooltip.style.display = 'none'
      }
    }

  }, [heroLines, patches, highlightedHero])

  // Update highlighting
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    svg.selectAll(`.${styles.heroLine}`)
      .classed(styles.dimmed, highlightedHero !== null)
      .classed(styles.highlighted, false)

    svg.selectAll(`.${styles.heroPoint}`)
      .classed(styles.dimmed, highlightedHero !== null)
      .classed(styles.highlighted, false)

    svg.selectAll(`.${styles.heroImage}`)
      .classed(styles.dimmedImage, highlightedHero !== null)

    if (highlightedHero) {
      svg.selectAll(`[data-hero-id="${highlightedHero}"]`)
        .classed(styles.dimmed, false)
        .classed(styles.dimmedImage, false)
        .classed(styles.highlighted, true)
        .raise()
    }
  }, [highlightedHero])

  if (error) {
    return (
      <PageShell title="Hero Rank History">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading historic data. Please try again later.
        </p>
      </PageShell>
    )
  }

  if (isLoading || patches.length === 0) {
    return (
      <PageShell title="Hero Rank History" subtitle="Track how heroes have risen and fallen in winrate rankings across patches">
        <p style={{ color: 'var(--color-text-muted)' }}>Loading historic data...</p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Hero Rank History"
      subtitle="Track how heroes have risen and fallen in winrate rankings across patches"
    >
      <div ref={containerRef} className={styles.chartContainer}>
        <svg ref={svgRef} className={styles.chart} />
      </div>
      <div ref={tooltipRef} className={styles.tooltip} />
    </PageShell>
  )
}
