export interface Ability {
  englishName: string
  shortName: string
  isUltimate: boolean | null
  tooltip: string | null
  valveId: number
  ownerHeroId: number | null
}
