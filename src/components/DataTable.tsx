import {
  useState,
  useRef,
  useCallback,
} from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  Row,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import styles from './DataTable.module.css'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  searchPlaceholder?: string
  searchableColumns?: string[]
  initialSorting?: SortingState
  rowHeight?: number
  maxHeight?: string
  onRowClick?: (row: T) => void
  emptyMessage?: string
  loading?: boolean
  loadingRows?: number
  extraStats?: { value: number; label: string }
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  searchableColumns,
  initialSorting = [],
  rowHeight = 40,
  maxHeight = 'calc(100vh - 340px)',
  onRowClick,
  emptyMessage = 'No data found',
  loading = false,
  loadingRows = 10,
  extraStats,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const tableContainerRef = useRef<HTMLDivElement>(null)

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: searchableColumns
      ? (row, _columnId, filterValue) => {
          const search = filterValue.toLowerCase()
          return searchableColumns.some(col => {
            const value = row.getValue(col)
            return String(value ?? '').toLowerCase().includes(search)
          })
        }
      : 'includesString',
  })

  const { rows } = table.getRowModel()

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0

  const handleRowClick = useCallback(
    (row: Row<T>) => {
      if (onRowClick) {
        onRowClick(row.original)
      }
    },
    [onRowClick]
  )

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.searchBar}>
          <div className={styles.searchInputSkeleton} />
        </div>
        <div className={styles.tableContainer} style={{ maxHeight }}>
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                {columns.map((_, i) => (
                  <th key={i} className={styles.th}>
                    <div className={styles.skeletonText} style={{ width: '60%' }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: loadingRows }).map((_, rowIdx) => (
                <tr key={rowIdx} className={styles.tr}>
                  {columns.map((_, colIdx) => (
                    <td key={colIdx} className={styles.td}>
                      <div
                        className={styles.skeletonText}
                        style={{
                          width: `${50 + Math.random() * 40}%`,
                          animationDelay: `${rowIdx * 0.05}s`,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
          />
          {globalFilter && (
            <button
              className={styles.searchClear}
              onClick={() => setGlobalFilter('')}
              aria-label="Clear search"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
        <div className={styles.stats}>
          <span className={styles.statCount}>
            {rows.length.toLocaleString()}
            {globalFilter && ` / ${data.length.toLocaleString()}`}
          </span>
          <span className={styles.statLabel}>rows</span>
          {extraStats && (
            <>
              <span className={styles.statSep}>·</span>
              <span className={styles.statCount}>{extraStats.value.toLocaleString()}</span>
              <span className={styles.statLabel}>{extraStats.label}</span>
            </>
          )}
        </div>
      </div>

      <div
        ref={tableContainerRef}
        className={styles.tableContainer}
        style={{ maxHeight }}
        data-scroll-target
      >
        <table className={styles.table}>
          <thead className={styles.thead}>
            {table.getHeaderGroups().map((headerGroup, groupIndex) => {
              const isGroupRow = table.getHeaderGroups().length > 1 && groupIndex === 0
              return (
                <tr key={headerGroup.id} className={isGroupRow ? styles.headerGroupRow : ''}>
                  {headerGroup.headers.map(header => {
                    const canSort = header.column.getCanSort()
                    const sorted = header.column.getIsSorted()
                    const isGroupHeader = header.colSpan > 1
                    const meta = header.column.columnDef.meta as { hasBorderLeft?: boolean } | undefined
                    const hasBorderLeft = meta?.hasBorderLeft || (isGroupHeader && header.id === 'currentPatch')
                    return (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className={`${styles.th} ${canSort ? styles.thSortable : ''} ${sorted ? styles.thSorted : ''} ${isGroupHeader ? styles.thGroup : ''} ${hasBorderLeft ? styles.thBorderLeft : ''}`}
                        style={{ width: header.colSpan === 1 && header.getSize() !== 150 ? header.getSize() : undefined }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className={styles.thContent}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className={styles.sortIcon}>
                              {sorted === 'asc' ? (
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                  <path
                                    fillRule="evenodd"
                                    d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              ) : sorted === 'desc' ? (
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                  <path
                                    fillRule="evenodd"
                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 20 20" fill="currentColor" className={styles.sortIconIdle}>
                                  <path d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" />
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              )
            })}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
              </tr>
            )}
            {virtualRows.map(virtualRow => {
              const row = rows[virtualRow.index]
              return (
                <tr
                  key={row.id}
                  className={`${styles.tr} ${onRowClick ? styles.trClickable : ''}`}
                  onClick={() => handleRowClick(row)}
                  style={{ height: `${rowHeight}px` }}
                >
                  {row.getVisibleCells().map(cell => {
                    const meta = cell.column.columnDef.meta as { hasBorderLeft?: boolean } | undefined
                    return (
                      <td
                        key={cell.id}
                        className={`${styles.td} ${meta?.hasBorderLeft ? styles.tdBorderLeft : ''}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
              </tr>
            )}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className={styles.empty}>
            <p>{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Utility components for common cell types
export function NumericCell({ value, decimals = 1, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  return <span className={styles.numericCell}>{value.toFixed(decimals)}{suffix}</span>
}

export function PercentCell({
  value,
  decimals = 1,
  showSign = false,
}: {
  value: number
  decimals?: number
  showSign?: boolean
}) {
  const isPositive = value > 0
  const isNegative = value < 0
  const sign = showSign && isPositive ? '+' : ''
  return (
    <span
      className={`${styles.percentCell} ${isPositive ? styles.positive : ''} ${isNegative ? styles.negative : ''}`}
    >
      {sign}
      {value.toFixed(decimals)}%
    </span>
  )
}

export function DeltaCell({
  value,
  decimals = 1,
  suffix = '',
  invertColors = false,
}: {
  value: number
  decimals?: number
  suffix?: string
  invertColors?: boolean
}) {
  const isPositive = value > 0
  const isNegative = value < 0
  const sign = isPositive ? '+' : ''
  // When inverted, negative is good (e.g., picking earlier = lower number = good)
  const positiveClass = invertColors ? styles.negative : styles.positive
  const negativeClass = invertColors ? styles.positive : styles.negative
  return (
    <span
      className={`${styles.deltaCell} ${isPositive ? positiveClass : ''} ${isNegative ? negativeClass : ''}`}
    >
      {sign}
      {value.toFixed(decimals)}{suffix}
    </span>
  )
}

export function TextCell({ value, muted = false }: { value: string; muted?: boolean }) {
  return <span className={muted ? styles.textMuted : ''}>{value}</span>
}

// Gradient cell - interpolates background color from red (min) to green (max)
export function GradientCell({
  value,
  min,
  max,
  decimals = 1,
  suffix = '%',
  invert = false,
}: {
  value: number
  min: number
  max: number
  decimals?: number
  suffix?: string
  invert?: boolean // if true, lower is better (green)
}) {
  // Normalize value to 0-1 range
  const range = max - min
  const normalized = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0.5

  // Apply invert if needed (e.g., for death counts where lower is better)
  const t = invert ? 1 - normalized : normalized

  // Interpolate between vibrant red and green
  // Red: #ef4444 (239, 68, 68) -> Green: #22c55e (34, 197, 94)
  const r = Math.round(239 + (34 - 239) * t)
  const g = Math.round(68 + (197 - 68) * t)
  const b = Math.round(68 + (94 - 68) * t)
  const bgColor = `rgba(${r}, ${g}, ${b}, 0.3)`

  return (
    <span className={styles.gradientCell} style={{ backgroundColor: bgColor }}>
      {value.toFixed(decimals)}{suffix}
    </span>
  )
}

// Gradient cell with background bar
export function GradientBarCell({
  value,
  min,
  max,
  decimals = 1,
  suffix = '%',
  invert = false,
}: {
  value: number
  min: number
  max: number
  decimals?: number
  suffix?: string
  invert?: boolean
}) {
  const range = max - min
  const normalized = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0.5
  const t = invert ? 1 - normalized : normalized
  const barWidth = normalized * 100

  // Color interpolation
  const r = Math.round(248 + (52 - 248) * t)
  const g = Math.round(113 + (211 - 113) * t)
  const b = Math.round(113 + (153 - 113) * t)
  const color = `rgb(${r}, ${g}, ${b})`

  return (
    <div className={styles.gradientBarCell}>
      <div
        className={styles.gradientBar}
        style={{
          width: `${barWidth}%`,
          backgroundColor: color,
          opacity: 0.2,
        }}
      />
      <span className={styles.gradientBarValue} style={{ color }}>
        {value.toFixed(decimals)}{suffix}
      </span>
    </div>
  )
}
