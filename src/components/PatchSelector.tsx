import { useSearchParams } from 'react-router-dom'
import { usePersistedQuery } from '../api'
import styles from './PatchSelector.module.css'

interface PatchListResponse {
  data: {
    patches: string[]
  }
}

interface PatchSelectorProps {
  /** Endpoint to fetch patch list from */
  endpoint?: string
}

export function usePatchSelection(endpoint = '/heroes/historic') {
  const [searchParams, setSearchParams] = useSearchParams()

  // Fetch patch list (deduplicate in case of API duplicates)
  const { data: historicData } = usePersistedQuery<PatchListResponse>(endpoint)
  const patches = [...new Set(historicData?.data?.patches ?? [])]

  // Get patch from URL or default to latest
  const urlPatch = searchParams.get('patch')
  const currentPatch = urlPatch && patches.includes(urlPatch)
    ? urlPatch
    : patches[patches.length - 1] ?? null

  // Calculate previous patch
  const prevPatchIndex = currentPatch ? patches.indexOf(currentPatch) - 1 : -1
  const prevPatch = prevPatchIndex >= 0 ? patches[prevPatchIndex] : null

  const setPatch = (patch: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      if (patch) {
        newParams.set('patch', patch)
      } else {
        newParams.delete('patch')
      }
      return newParams
    })
  }

  return { patches, currentPatch, prevPatch, setPatch }
}

export function PatchSelector({ endpoint = '/heroes/historic' }: PatchSelectorProps) {
  const { patches, currentPatch, setPatch } = usePatchSelection(endpoint)

  return (
    <div className={styles.patchSelector}>
      <span className={styles.patchLabel}>Patch</span>
      <select
        value={currentPatch ?? ''}
        onChange={e => setPatch(e.target.value)}
        className={styles.patchSelect}
        disabled={patches.length === 0}
      >
        {patches.length === 0 && <option value="">Loading...</option>}
        {patches.slice().reverse().map(patch => (
          <option key={patch} value={patch}>{patch}</option>
        ))}
      </select>
    </div>
  )
}
