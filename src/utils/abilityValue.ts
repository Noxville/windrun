import { useMemo } from 'react'
import { usePersistedQuery } from '../api'

const POINTS_PER_LOGIT = 25

export interface AbilityValueModel {
  patch: string
  matches: number
  holdoutAccuracy: number
}

export interface AbilityValue {
  strength: number
  strengthStdErr: number
  strengthRank: number | null
  draftRank: number | null
  mispricing: number | null
  fairPickSlot: number | null
  avgPickPosition: number
  numPicks: number
  isHero: boolean
}

// The rename to strength / draftRank / mispricing is rolling out per patch, so
// read either shape. Drop the fallbacks once every fitted patch is backfilled.
interface RawAbilityValue {
  abilityId: number
  isHero: boolean
  avgPickPosition: number
  numPicks: number
  strengthRank: number
  strength?: number
  winPctEffect?: number
  strengthStdErr?: number
  betaStdErr?: number
  draftRank?: number
  priceRank?: number
  mispricing?: number
  rankGap?: number
  fairPickSlot?: number | null
}

interface AbilityValuesApiResponse {
  data: {
    model: AbilityValueModel & { ratingScale: number }
    pickSlotValue: number[]
    abilityValues?: RawAbilityValue[]
    itemValues?: RawAbilityValue[]
  }
}

function normalise(raw: RawAbilityValue, pointsPerBeta: number): AbilityValue {
  return {
    strength: raw.strength ?? raw.winPctEffect ?? 0,
    strengthStdErr: raw.strengthStdErr ?? (raw.betaStdErr ?? 0) * pointsPerBeta,
    strengthRank: raw.strengthRank ?? null,
    draftRank: raw.draftRank ?? raw.priceRank ?? null,
    mispricing: raw.mispricing ?? raw.rankGap ?? null,
    fairPickSlot: raw.fairPickSlot ?? null,
    avgPickPosition: raw.avgPickPosition,
    numPicks: raw.numPicks,
    isHero: raw.isHero,
  }
}

// The server decides what can be ranked: it leaves strengthRank null for anything
// drafted fewer than minPicksForRank times, where the error bar is wider than the
// whole strength range. Do not second-guess it here.
//
// In particular, do not gate on |strength| > 2 * strengthStdErr. That asks whether an
// ability differs from zero, which is the wrong question for a ranking. Rearm is
// -0.19 +/- 0.25 off 46,700 drafts: a precise measurement of an average ability, and
// its rank is exactly the interesting part, because the field takes it 9th.
export function hasRank(v: AbilityValue): boolean {
  return v.strengthRank !== null && v.draftRank !== null
}

export function useAbilityValues(patch: string | null | undefined) {
  const { data, isLoading, error } = usePersistedQuery<AbilityValuesApiResponse>(
    '/ability-values',
    patch ? { patch } : undefined,
    { enabled: !!patch }
  )

  return useMemo(() => {
    const payload = data?.data
    if (!payload) {
      return {
        values: null,
        pickSlotValue: null,
        model: null,
        total: 0,
        isLoading,
        unavailable: !!error,
      }
    }
    const raw = payload.abilityValues ?? payload.itemValues ?? []
    // Slope of the logistic at even odds: one log-odd is 25 win rate points. Only the
    // pre-rename payloads need it, since strength now arrives already converted.
    const pointsPerBeta = POINTS_PER_LOGIT

    // pickSlotValue is win rate points once backfilled, log-odds before that.
    // The two scales differ by 25x, so the magnitude tells them apart.
    const slots = payload.pickSlotValue
    const inPoints = slots.some(v => Math.abs(v) > 1)
    const pickSlotValue = inPoints ? slots : slots.map(v => v * pointsPerBeta)

    const values = new Map<number, AbilityValue>()
    for (const item of raw) {
      values.set(item.abilityId, normalise(item, pointsPerBeta))
    }
    return {
      values,
      pickSlotValue,
      model: payload.model,
      total: raw.length,
      isLoading,
      unavailable: false,
    }
  }, [data, isLoading, error])
}

// What you gain by taking this ability at this pick, rather than whatever that
// pick would ordinarily have returned. Both sides are win rate points.
export function gainAtPick(
  strength: number,
  pickSlotValue: number[] | null,
  pick: number
): number | null {
  if (!pickSlotValue) return null
  const slot = pickSlotValue[pick - 1]
  if (slot == null) return null
  return strength - slot
}
