export interface Hero {
  id: number
  cdota: string
  englishName: string
  npc: string
  picture: string
  shortName: string
  primaryAttribute: string
  attackType: string
}

export type HeroMap = Record<string, Hero>
