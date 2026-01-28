import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import { DataTable, GradientCell, NumericCell, AbilityInline } from '../components'
import { usePersistedQuery } from '../api'
import { getHeroById, getAbilityById } from '../data'
import { heroImageUrl } from '../config'
import styles from './HeroDetail.module.css'

interface AbilityStat {
  abilityId: number
  pickRate: number
  winrate: number
  avgPickPosition: number
}

interface HeroDetailApiResponse {
  data: {
    heroId: number
    abilityStats: AbilityStat[]
    abilityValuations?: Record<string, number>
  }
}

interface AllHeroApiResponse {
  data: {
    abilityStats: AbilityStat[]
  }
}

interface FacetStat {
  heroId: number
  facetName: string
  facetSlot: number
  picks: number
  wins: number
  winrate: number
  pickRate: number
}

interface FacetsApiResponse {
  data: {
    facetStats: FacetStat[]
  }
}

interface FacetRow {
  facetName: string
  facetSlot: number
  picks: number
  winRate: number
  pickRate: number
}

interface AbilityRow {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  pickRate: number
  winRate: number
  avgPickPos: number
  allHeroPickPos: number | null
  pickPosDiff: number | null
  value: number | null
}

export function HeroDetailPage() {
  const { heroId } = useParams()
  const navigate = useNavigate()

  const hero = useMemo(() => {
    const id = Number(heroId)
    return getHeroById(id)
  }, [heroId])

  const { data: heroResponse, isLoading: heroLoading, error: heroError } = usePersistedQuery<HeroDetailApiResponse>(
    `/heroes/${heroId}`
  )

  // Fetch all-hero stats for comparison
  const { data: allHeroResponse, isLoading: allHeroLoading } = usePersistedQuery<AllHeroApiResponse>(
    '/abilities'
  )

  // Fetch facets for this hero
  const { data: facetsResponse, isLoading: facetsLoading } = usePersistedQuery<FacetsApiResponse>(
    '/facets'
  )

  const isLoading = heroLoading || allHeroLoading || facetsLoading

  // Build all-hero ability map
  const allHeroMap = useMemo(() => {
    if (!allHeroResponse?.data?.abilityStats) return {}
    const map: Record<number, AbilityStat> = {}
    allHeroResponse.data.abilityStats.forEach(stat => {
      map[stat.abilityId] = stat
    })
    return map
  }, [allHeroResponse])

  // Filter facets for this hero
  const facetsData = useMemo<FacetRow[]>(() => {
    if (!facetsResponse?.data?.facetStats || !heroId) return []
    const id = Number(heroId)
    return facetsResponse.data.facetStats
      .filter(f => f.heroId === id)
      .map(f => ({
        facetName: f.facetName,
        facetSlot: f.facetSlot,
        picks: f.picks,
        winRate: f.winrate * 100,
        pickRate: f.pickRate * 100,
      }))
  }, [facetsResponse, heroId])

  const statsData = useMemo<AbilityRow[]>(() => {
    if (!heroResponse?.data?.abilityStats) return []

    return heroResponse.data.abilityStats
      .filter(stat => stat.abilityId > 0) // Skip negative ability IDs (hero picks)
      .map(stat => {
        const ability = getAbilityById(stat.abilityId)
        const allHeroStat = allHeroMap[stat.abilityId]
        const pickPosDiff = allHeroStat
          ? stat.avgPickPosition - allHeroStat.avgPickPosition
          : null

        const rawValue = heroResponse.data.abilityValuations?.[String(stat.abilityId)]
        const value = rawValue !== undefined ? rawValue * 10 : null

        return {
          abilityId: stat.abilityId,
          abilityName: ability?.englishName ?? `Ability #${stat.abilityId}`,
          shortName: ability?.shortName ?? '',
          isUltimate: ability?.isUltimate ?? false,
          pickRate: stat.pickRate * 100,
          winRate: stat.winrate * 100,
          avgPickPos: stat.avgPickPosition,
          allHeroPickPos: allHeroStat?.avgPickPosition ?? null,
          pickPosDiff,
          value,
        }
      })
      .filter(row => row.abilityName && !row.abilityName.startsWith('special_bonus'))
  }, [heroResponse, allHeroMap])

  const columns = useMemo<ColumnDef<AbilityRow>[]>(
    () => [
      {
        accessorKey: 'abilityName',
        header: 'Ability',
        size: 240,
        cell: info => {
          const row = info.row.original
          return (
            <AbilityInline
              id={row.abilityId}
              name={row.abilityName}
              shortName={row.shortName}
              isUltimate={row.isUltimate}
            />
          )
        },
      },
      {
        accessorKey: 'pickRate',
        header: 'Pick %',
        size: 90,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={0}
            max={100}
            decimals={2}
            suffix="%"
          />
        ),
      },
      {
        accessorKey: 'winRate',
        header: 'Win %',
        size: 90,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={43}
            max={57}
            decimals={2}
            suffix="%"
          />
        ),
      },
      {
        accessorKey: 'avgPickPos',
        header: 'Avg Pick #',
        size: 90,
        cell: info => <NumericCell value={info.getValue() as number} decimals={2} />,
      },
      {
        accessorKey: 'allHeroPickPos',
        header: 'All Hero Pick #',
        size: 110,
        cell: info => {
          const value = info.getValue() as number | null
          if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>-</span>
          return <NumericCell value={value} decimals={2} />
        },
      },
      {
        accessorKey: 'pickPosDiff',
        header: '\u0394 Pick #',
        size: 90,
        cell: info => {
          const value = info.getValue() as number | null
          if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>-</span>
          const isPositive = value > 0
          const isNegative = value < 0
          return (
            <span style={{
              color: isNegative ? 'var(--color-positive)' : isPositive ? 'var(--color-negative)' : 'var(--color-text-muted)',
            }}>
              {value > 0 ? '+' : ''}{value.toFixed(2)}
            </span>
          )
        },
      },
      {
        accessorKey: 'value',
        header: 'Value',
        size: 80,
        cell: info => {
          const value = info.getValue() as number | null
          if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>-</span>
          return (
            <GradientCell
              value={value * 100}
              min={-50}
              max={50}
              decimals={2}
              suffix="%"
            />
          )
        },
      },
    ],
    []
  )

  const facetColumns = useMemo<ColumnDef<FacetRow>[]>(
    () => [
      {
        accessorKey: 'facetName',
        header: 'Facet',
        size: 200,
        cell: info => (
          <span style={{ fontWeight: 'var(--weight-regular)' }}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'winRate',
        header: 'Win Rate',
        size: 100,
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
        accessorKey: 'pickRate',
        header: 'Pick Rate',
        size: 100,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={0}
            max={100}
            decimals={1}
            suffix="%"
          />
        ),
      },
      {
        accessorKey: 'picks',
        header: 'Picks',
        size: 80,
        cell: info => <NumericCell value={info.getValue() as number} decimals={0} />,
      },
    ],
    []
  )

  const handleRowClick = (row: AbilityRow) => {
    navigate(`/abilities/${row.abilityId}`)
  }

  if (heroError) {
    return (
      <PageShell title="Hero Details">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading hero data. Please try again later.
        </p>
      </PageShell>
    )
  }

  if (!hero) {
    return (
      <PageShell title="Hero Details">
        <p style={{ color: 'var(--color-text-muted)' }}>Hero not found.</p>
      </PageShell>
    )
  }

  const heroProfile = (
    <div className={styles.heroProfile}>
      <img
        src={heroImageUrl(hero.picture)}
        alt={hero.englishName}
        className={styles.heroImage}
      />
      <span className={styles.heroAttr}>{hero.primaryAttribute?.toUpperCase()}</span>
    </div>
  )

  return (
    <PageShell title={hero.englishName} actions={heroProfile}>

      {facetsData.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Facets</h3>
          <DataTable
            data={facetsData}
            columns={facetColumns}
            initialSorting={[{ id: 'winRate', desc: true }]}
            emptyMessage="No facet data found"
            loading={facetsLoading}
          />
        </div>
      )}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Abilities Picked</h3>
        <DataTable
          data={statsData}
          columns={columns}
          searchPlaceholder="Search abilities..."
          searchableColumns={['abilityName', 'shortName']}
          initialSorting={[{ id: 'avgPickPos', desc: false }]}
          onRowClick={handleRowClick}
          emptyMessage="No ability data found"
          loading={isLoading}
        />
      </div>
    </PageShell>
  )
}
