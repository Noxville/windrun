import { createContext, useContext } from 'react'

/** Display index (0-based) of the current row in the sorted/filtered list. Use for rank columns. */
export const DataTableDisplayIndexContext = createContext<number | null>(null)

export function useDataTableDisplayIndex(): number | null {
  return useContext(DataTableDisplayIndexContext)
}
