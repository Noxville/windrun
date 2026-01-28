import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  GradientCell,
  NumericCell,
  HeroInline,
  PatchSelector,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { getHeroById } from '../data'
import styles from './Facets.module.css'

// CDN URL for facet icons
const FACET_ICON_CDN = 'https://cdn.datdota.com/images/facets'

interface FacetApiData {
  hero: number
  facetName: string
  facetIcon: string
  numPicks: number
  wins: number
  totalHeroPicks: number
  winrate: number
  pickrate: number
}

interface FacetsApiResponse {
  data: FacetApiData[]
}

interface FacetRow {
  heroId: number
  heroName: string
  heroPicture: string
  facetName: string
  facetDisplayName: string
  facetIcon: string
  picks: number
  pickRate: number
  winRate: number
}

// Convert internal facet name to display name
function formatFacetName(facetName: string): string {
  // Remove hero prefix (e.g., "jakiro_liquid_fire" -> "liquid_fire")
  const parts = facetName.split('_')
  // Skip first part if it looks like a hero name (usually 1-2 parts)
  const startIndex = parts.length > 2 ? 1 : 0
  return parts
    .slice(startIndex)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function FacetsPage() {
  const navigate = useNavigate()
  const { currentPatch } = usePatchSelection()

  // Only fetch when we have a patch (prevents double request)
  const { data: apiResponse, isLoading, error } = usePersistedQuery<FacetsApiResponse>(
    '/facets',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  const statsData = useMemo<FacetRow[]>(() => {
    if (!apiResponse?.data || !Array.isArray(apiResponse.data)) return []

    return apiResponse.data
      .map(stat => {
        const hero = getHeroById(stat.hero)
        return {
          heroId: stat.hero,
          heroName: hero?.englishName ?? `Hero #${stat.hero}`,
          heroPicture: hero?.picture ?? '',
          facetName: stat.facetName,
          facetDisplayName: formatFacetName(stat.facetName),
          facetIcon: stat.facetIcon,
          picks: stat.numPicks,
          pickRate: stat.pickrate * 100,
          winRate: stat.winrate * 100,
        }
      })
      .filter(row => row.picks >= 20)
  }, [apiResponse])

  const columns = useMemo<ColumnDef<FacetRow>[]>(
    () => [
      {
        accessorKey: 'heroName',
        header: 'Hero',
        size: 200,
        cell: info => {
          const row = info.row.original
          return (
            <HeroInline
              id={row.heroId}
              name={row.heroName}
              picture={row.heroPicture}
            />
          )
        },
      },
      {
        accessorKey: 'facetDisplayName',
        header: 'Facet',
        size: 200,
        cell: info => {
          const row = info.row.original
          return (
            <div className={styles.facetCell}>
              <img
                src={`${FACET_ICON_CDN}/${row.facetIcon}.png`}
                alt=""
                className={styles.facetIcon}
                loading="lazy"
              />
              <span className={styles.facetName}>{row.facetDisplayName}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'picks',
        header: 'Pick #',
        size: 80,
        cell: info => <NumericCell value={info.getValue() as number} decimals={0} />,
      },
      {
        accessorKey: 'pickRate',
        header: 'Pick %',
        size: 90,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={20}
            max={80}
            decimals={1}
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
            decimals={1}
            suffix="%"
          />
        ),
      },
    ],
    []
  )

  const handleRowClick = (row: FacetRow) => {
    navigate(`/heroes/${row.heroId}`)
  }

  if (error) {
    return (
      <PageShell title="Hero Facets">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading facet data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Hero Facets"
      subtitle={currentPatch ? `Patch ${currentPatch}` : 'Loading...'}
      actions={<PatchSelector />}
    >
      <DataTable
        data={statsData}
        columns={columns}
        searchPlaceholder="Search heroes or facets..."
        searchableColumns={['heroName', 'facetDisplayName', 'facetName']}
        initialSorting={[{ id: 'winRate', desc: true }]}
        onRowClick={handleRowClick}
        emptyMessage="No facet data found"
        loading={isLoading}
      />
    </PageShell>
  )
}
