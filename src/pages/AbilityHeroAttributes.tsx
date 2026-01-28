import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import {
  GradientCell,
  AbilityInline,
  PatchSelector,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { getAbilityById } from '../data'
import styles from './AbilityHeroAttributes.module.css'

// Stats for a single ability in a category
interface AbilityCategoryStats {
  abilityId: number
  numPicks: number
  avgPickPosition: number
  wins: number
  winrate: number
  pickRate?: number
}

interface AbilityHeroAttributeApiResponse {
  data: {
    patches?: { overall: string[] }
    abilityHeroAttributeStats: {
      str: Record<string, AbilityCategoryStats>
      agi: Record<string, AbilityCategoryStats>
      int: Record<string, AbilityCategoryStats>
      uni: Record<string, AbilityCategoryStats>
      melee: Record<string, AbilityCategoryStats>
      ranged: Record<string, AbilityCategoryStats>
    }
  }
}

interface CategoryData {
  winRate: number
  avgPick: number
  picks: number
  pickPct: number
}

interface AttributeRow {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  totalPicks: number
  str: CategoryData | null
  agi: CategoryData | null
  int: CategoryData | null
  uni: CategoryData | null
}

interface AttackTypeRow {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  totalPicks: number
  melee: CategoryData | null
  ranged: CategoryData | null
}

type ViewMode = 'attribute' | 'attackType'
type SortField = 'abilityName' | 'totalPicks' |
  'str_wr' | 'str_pick' | 'str_pct' |
  'agi_wr' | 'agi_pick' | 'agi_pct' |
  'int_wr' | 'int_pick' | 'int_pct' |
  'uni_wr' | 'uni_pick' | 'uni_pct' |
  'melee_wr' | 'melee_pick' | 'melee_pct' |
  'ranged_wr' | 'ranged_pick' | 'ranged_pct'
type SortDir = 'asc' | 'desc'

export function AbilityHeroAttributesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentPatch } = usePatchSelection()
  const viewMode = (searchParams.get('view') as ViewMode) || 'attribute'
  const [sortField, setSortField] = useState<SortField>('totalPicks')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: apiResponse, isLoading, error } = usePersistedQuery<AbilityHeroAttributeApiResponse>(
    '/ability-hero-attributes',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  const handleViewChange = (mode: ViewMode) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('view', mode)
    setSearchParams(newParams)
    // Reset sort when changing view
    setSortField('totalPicks')
    setSortDir('desc')
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'abilityName' ? 'asc' : 'desc')
    }
  }

  // Build ability stats by attribute
  const attributeData = useMemo<AttributeRow[]>(() => {
    if (!apiResponse?.data?.abilityHeroAttributeStats || viewMode !== 'attribute') return []

    const stats = apiResponse.data.abilityHeroAttributeStats

    // Collect all unique ability IDs
    const allAbilityIds = new Set<number>()
    const categories = ['str', 'agi', 'int', 'uni'] as const
    categories.forEach(cat => {
      if (stats[cat]) {
        Object.keys(stats[cat]).forEach(id => allAbilityIds.add(Number(id)))
      }
    })

    const rows: AttributeRow[] = []

    allAbilityIds.forEach(abilityId => {
      if (abilityId <= 0) return
      const ability = getAbilityById(abilityId)
      if (!ability) return

      const makeStats = (cat: 'str' | 'agi' | 'int' | 'uni'): CategoryData | null => {
        const catStats = stats[cat]?.[String(abilityId)]
        if (!catStats || catStats.numPicks < 10) return null
        return {
          winRate: catStats.winrate * 100,
          avgPick: catStats.avgPickPosition,
          picks: catStats.numPicks,
          pickPct: 0, // Will be calculated after totalPicks
        }
      }

      const strStats = makeStats('str')
      const agiStats = makeStats('agi')
      const intStats = makeStats('int')
      const uniStats = makeStats('uni')

      const totalPicks = (strStats?.picks ?? 0) + (agiStats?.picks ?? 0) +
        (intStats?.picks ?? 0) + (uniStats?.picks ?? 0)

      if (totalPicks < 50) return

      // Calculate pick percentages
      if (strStats) strStats.pickPct = (strStats.picks / totalPicks) * 100
      if (agiStats) agiStats.pickPct = (agiStats.picks / totalPicks) * 100
      if (intStats) intStats.pickPct = (intStats.picks / totalPicks) * 100
      if (uniStats) uniStats.pickPct = (uniStats.picks / totalPicks) * 100

      rows.push({
        abilityId,
        abilityName: ability.englishName,
        shortName: ability.shortName,
        isUltimate: ability.isUltimate ?? false,
        totalPicks,
        str: strStats,
        agi: agiStats,
        int: intStats,
        uni: uniStats,
      })
    })

    return rows
  }, [apiResponse, viewMode])

  // Build ability stats by attack type
  const attackTypeData = useMemo<AttackTypeRow[]>(() => {
    if (!apiResponse?.data?.abilityHeroAttributeStats || viewMode !== 'attackType') return []

    const stats = apiResponse.data.abilityHeroAttributeStats

    const allAbilityIds = new Set<number>()
    const categories = ['melee', 'ranged'] as const
    categories.forEach(cat => {
      if (stats[cat]) {
        Object.keys(stats[cat]).forEach(id => allAbilityIds.add(Number(id)))
      }
    })

    const rows: AttackTypeRow[] = []

    allAbilityIds.forEach(abilityId => {
      if (abilityId <= 0) return
      const ability = getAbilityById(abilityId)
      if (!ability) return

      const makeStats = (cat: 'melee' | 'ranged'): CategoryData | null => {
        const catStats = stats[cat]?.[String(abilityId)]
        if (!catStats || catStats.numPicks < 10) return null
        return {
          winRate: catStats.winrate * 100,
          avgPick: catStats.avgPickPosition,
          picks: catStats.numPicks,
          pickPct: 0,
        }
      }

      const meleeStats = makeStats('melee')
      const rangedStats = makeStats('ranged')

      const totalPicks = (meleeStats?.picks ?? 0) + (rangedStats?.picks ?? 0)

      if (totalPicks < 50) return

      if (meleeStats) meleeStats.pickPct = (meleeStats.picks / totalPicks) * 100
      if (rangedStats) rangedStats.pickPct = (rangedStats.picks / totalPicks) * 100

      rows.push({
        abilityId,
        abilityName: ability.englishName,
        shortName: ability.shortName,
        isUltimate: ability.isUltimate ?? false,
        totalPicks,
        melee: meleeStats,
        ranged: rangedStats,
      })
    })

    return rows
  }, [apiResponse, viewMode])

  // Filter and sort the data
  const filteredAttributeData = useMemo(() => {
    if (!searchQuery.trim()) return attributeData
    const query = searchQuery.toLowerCase()
    return attributeData.filter(row =>
      row.abilityName.toLowerCase().includes(query) ||
      row.shortName.toLowerCase().includes(query)
    )
  }, [attributeData, searchQuery])

  const filteredAttackTypeData = useMemo(() => {
    if (!searchQuery.trim()) return attackTypeData
    const query = searchQuery.toLowerCase()
    return attackTypeData.filter(row =>
      row.abilityName.toLowerCase().includes(query) ||
      row.shortName.toLowerCase().includes(query)
    )
  }, [attackTypeData, searchQuery])

  // Sort the data
  const sortedAttributeData = useMemo(() => {
    const data = [...filteredAttributeData]
    data.sort((a, b) => {
      let aVal: number | string | null = null
      let bVal: number | string | null = null

      if (sortField === 'abilityName') {
        aVal = a.abilityName
        bVal = b.abilityName
      } else if (sortField === 'totalPicks') {
        aVal = a.totalPicks
        bVal = b.totalPicks
      } else {
        const [cat, metric] = sortField.split('_') as ['str' | 'agi' | 'int' | 'uni', 'wr' | 'pick' | 'pct']
        const aCat = a[cat]
        const bCat = b[cat]
        if (metric === 'wr') {
          aVal = aCat?.winRate ?? null
          bVal = bCat?.winRate ?? null
        } else if (metric === 'pick') {
          aVal = aCat?.avgPick ?? null
          bVal = bCat?.avgPick ?? null
        } else {
          aVal = aCat?.pickPct ?? null
          bVal = bCat?.pickPct ?? null
        }
      }

      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      let result: number
      if (typeof aVal === 'string') {
        result = aVal.localeCompare(bVal as string)
      } else {
        result = aVal - (bVal as number)
      }

      return sortDir === 'desc' ? -result : result
    })
    return data
  }, [attributeData, sortField, sortDir])

  const sortedAttackTypeData = useMemo(() => {
    const data = [...filteredAttackTypeData]
    data.sort((a, b) => {
      let aVal: number | string | null = null
      let bVal: number | string | null = null

      if (sortField === 'abilityName') {
        aVal = a.abilityName
        bVal = b.abilityName
      } else if (sortField === 'totalPicks') {
        aVal = a.totalPicks
        bVal = b.totalPicks
      } else {
        const [cat, metric] = sortField.split('_') as ['melee' | 'ranged', 'wr' | 'pick' | 'pct']
        const aCat = a[cat]
        const bCat = b[cat]
        if (metric === 'wr') {
          aVal = aCat?.winRate ?? null
          bVal = bCat?.winRate ?? null
        } else if (metric === 'pick') {
          aVal = aCat?.avgPick ?? null
          bVal = bCat?.avgPick ?? null
        } else {
          aVal = aCat?.pickPct ?? null
          bVal = bCat?.pickPct ?? null
        }
      }

      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      let result: number
      if (typeof aVal === 'string') {
        result = aVal.localeCompare(bVal as string)
      } else {
        result = aVal - (bVal as number)
      }

      return sortDir === 'desc' ? -result : result
    })
    return data
  }, [filteredAttackTypeData, sortField, sortDir])

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return <span className={styles.sortIndicator}>{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  const StatCell = ({ data }: { data: CategoryData | null }) => {
    if (!data) return <td className={styles.noData} colSpan={3}>—</td>
    return (
      <>
        <td className={styles.statCell}>
          <GradientCell value={data.winRate} min={43} max={57} decimals={1} suffix="%" />
        </td>
        <td className={styles.statCell}>
          <span className={styles.avgPick}>{data.avgPick.toFixed(1)}</span>
        </td>
        <td className={styles.statCell}>
          <span className={styles.pickPct}>{data.pickPct.toFixed(0)}%</span>
        </td>
      </>
    )
  }

  if (error) {
    return (
      <PageShell title="Abilities by Hero Type">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading ability data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Abilities by Hero Type"
      subtitle={currentPatch ? `Patch ${currentPatch}` : 'Loading...'}
      actions={
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className={styles.viewSelector}>
            <button
              className={`${styles.viewButton} ${viewMode === 'attribute' ? styles.viewButtonActive : ''}`}
              onClick={() => handleViewChange('attribute')}
            >
              By Attribute
            </button>
            <button
              className={`${styles.viewButton} ${viewMode === 'attackType' ? styles.viewButtonActive : ''}`}
              onClick={() => handleViewChange('attackType')}
            >
              By Ranged/Melee
            </button>
          </div>
          <PatchSelector />
        </div>
      }
    >
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search abilities..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>
      {isLoading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      ) : viewMode === 'attribute' ? (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.headerRow1}>
                <th rowSpan={2} className={`${styles.stickyCol} ${styles.sortable}`} onClick={() => handleSort('abilityName')}>
                  Ability <SortIndicator field="abilityName" />
                </th>
                <th colSpan={3} className={styles.attrSTR}>STR</th>
                <th colSpan={3} className={styles.attrAGI}>AGI</th>
                <th colSpan={3} className={styles.attrINT}>INT</th>
                <th colSpan={3} className={styles.attrUNI}>UNI</th>
                <th rowSpan={2} className={styles.sortable} onClick={() => handleSort('totalPicks')}>
                  Picks <SortIndicator field="totalPicks" />
                </th>
              </tr>
              <tr className={styles.headerRow2}>
                <th className={styles.sortable} onClick={() => handleSort('str_wr')}>WR <SortIndicator field="str_wr" /></th>
                <th className={styles.sortable} onClick={() => handleSort('str_pick')}>Pick <SortIndicator field="str_pick" /></th>
                <th className={styles.sortable} onClick={() => handleSort('str_pct')}>% <SortIndicator field="str_pct" /></th>
                <th className={styles.sortable} onClick={() => handleSort('agi_wr')}>WR <SortIndicator field="agi_wr" /></th>
                <th className={styles.sortable} onClick={() => handleSort('agi_pick')}>Pick <SortIndicator field="agi_pick" /></th>
                <th className={styles.sortable} onClick={() => handleSort('agi_pct')}>% <SortIndicator field="agi_pct" /></th>
                <th className={styles.sortable} onClick={() => handleSort('int_wr')}>WR <SortIndicator field="int_wr" /></th>
                <th className={styles.sortable} onClick={() => handleSort('int_pick')}>Pick <SortIndicator field="int_pick" /></th>
                <th className={styles.sortable} onClick={() => handleSort('int_pct')}>% <SortIndicator field="int_pct" /></th>
                <th className={styles.sortable} onClick={() => handleSort('uni_wr')}>WR <SortIndicator field="uni_wr" /></th>
                <th className={styles.sortable} onClick={() => handleSort('uni_pick')}>Pick <SortIndicator field="uni_pick" /></th>
                <th className={styles.sortable} onClick={() => handleSort('uni_pct')}>% <SortIndicator field="uni_pct" /></th>
              </tr>
            </thead>
            <tbody>
              {sortedAttributeData.map(row => (
                <tr key={row.abilityId} className={styles.dataRow}>
                  <td className={styles.stickyCol}>
                    <Link to={`/abilities/${row.abilityId}`} className={styles.abilityLink}>
                      <AbilityInline
                        id={row.abilityId}
                        name={row.abilityName}
                        shortName={row.shortName}
                        isUltimate={row.isUltimate}
                      />
                    </Link>
                  </td>
                  <StatCell data={row.str} />
                  <StatCell data={row.agi} />
                  <StatCell data={row.int} />
                  <StatCell data={row.uni} />
                  <td className={styles.totalPicks}>{row.totalPicks.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.headerRow1}>
                <th rowSpan={2} className={`${styles.stickyCol} ${styles.sortable}`} onClick={() => handleSort('abilityName')}>
                  Ability <SortIndicator field="abilityName" />
                </th>
                <th colSpan={3} className={styles.melee}>MELEE</th>
                <th colSpan={3} className={styles.ranged}>RANGED</th>
                <th rowSpan={2} className={styles.sortable} onClick={() => handleSort('totalPicks')}>
                  Picks <SortIndicator field="totalPicks" />
                </th>
              </tr>
              <tr className={styles.headerRow2}>
                <th className={styles.sortable} onClick={() => handleSort('melee_wr')}>WR <SortIndicator field="melee_wr" /></th>
                <th className={styles.sortable} onClick={() => handleSort('melee_pick')}>Pick <SortIndicator field="melee_pick" /></th>
                <th className={styles.sortable} onClick={() => handleSort('melee_pct')}>% <SortIndicator field="melee_pct" /></th>
                <th className={styles.sortable} onClick={() => handleSort('ranged_wr')}>WR <SortIndicator field="ranged_wr" /></th>
                <th className={styles.sortable} onClick={() => handleSort('ranged_pick')}>Pick <SortIndicator field="ranged_pick" /></th>
                <th className={styles.sortable} onClick={() => handleSort('ranged_pct')}>% <SortIndicator field="ranged_pct" /></th>
              </tr>
            </thead>
            <tbody>
              {sortedAttackTypeData.map(row => (
                <tr key={row.abilityId} className={styles.dataRow}>
                  <td className={styles.stickyCol}>
                    <Link to={`/abilities/${row.abilityId}`} className={styles.abilityLink}>
                      <AbilityInline
                        id={row.abilityId}
                        name={row.abilityName}
                        shortName={row.shortName}
                        isUltimate={row.isUltimate}
                      />
                    </Link>
                  </td>
                  <StatCell data={row.melee} />
                  <StatCell data={row.ranged} />
                  <td className={styles.totalPicks}>{row.totalPicks.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  )
}
