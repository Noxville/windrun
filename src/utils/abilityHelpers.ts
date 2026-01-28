import { getAbilityById, getHeroById } from '../data'

export interface ResolvedAbility {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  isHeroAbility: boolean
  heroId?: number
  heroPicture?: string
  ownerHeroId?: number
  ownerHeroName?: string
}

/**
 * Resolves ability info, handling both regular abilities and hero abilities (negative IDs).
 * For hero abilities (-X), the hero X is used as the ability name and owner.
 */
export function resolveAbility(abilityId: number, ownerHero?: number): ResolvedAbility {
  const isHeroAbility = abilityId < 0
  const heroIdFromAbility = isHeroAbility ? Math.abs(abilityId) : undefined
  const hero = heroIdFromAbility ? getHeroById(heroIdFromAbility) : undefined
  const ability = !isHeroAbility ? getAbilityById(abilityId) : undefined

  // For hero abilities (-X), use hero X as owner
  const ownerHeroId = isHeroAbility ? heroIdFromAbility : ownerHero
  const ownerHeroData = ownerHeroId ? getHeroById(ownerHeroId) : undefined

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
    ownerHeroId,
    ownerHeroName: ownerHeroData?.englishName,
  }
}
