export type TagEffect = 'penalised' | 'tag-only' | 'banned'

export interface RatingTagInfo {
  label: string
  short: string
  effect: TagEffect
  description: string
}

export const EFFECT_LABEL: Record<TagEffect, string> = {
  penalised: 'penalised',
  'tag-only': 'tag only',
  banned: 'banned from rank',
}

export const RATING_TAGS: Record<string, RatingTagInfo> = {
  SMURF_ALERT: {
    label: 'Smurf Alert',
    short: 'SMURF',
    effect: 'penalised',
    description:
      'Grinds rating off opponents who are far less calibrated than the peers of anyone at this rating, typically paired with a very low hidden (non-AD) MMR.',
  },
  PARTY_ABUSER: {
    label: 'Party Abuser',
    short: 'PARTY',
    effect: 'penalised',
    description:
      'Queues as a stack whose teammates are consistently more calibrated than its opponents, at a winrate well above even. Stack-vs-stack brawling at ~50% is not penalised.',
  },
  QUEUE_ABUSE: {
    label: 'Queue Abuse',
    short: 'QUEUE',
    effect: 'tag-only',
    description: 'Queue patterns that look manipulated. Flagged for visibility only, with no rating penalty.',
  },
  REGION_ISOLATION: {
    label: 'Region Isolation',
    short: 'REGION',
    effect: 'tag-only',
    description:
      'Plays in a small, disconnected server pool, so the rating is hard to compare globally. Flagged for visibility only, with no rating penalty.',
  },
  IS_BOT: {
    label: 'Bot',
    short: 'BOT',
    effect: 'banned',
    description: 'Confirmed bot account. Excluded from rank and from every rating update.',
  },
  SUSPECTED_BOT: {
    label: 'Suspected Bot',
    short: 'SUS BOT',
    effect: 'tag-only',
    description: 'Bot-like behaviour pending investigation. Flagged for visibility only, with no rating penalty.',
  },
}

export function getRatingTag(tag: string): RatingTagInfo {
  return (
    RATING_TAGS[tag] ?? {
      label: tag.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      short: tag.split('_')[0],
      effect: 'tag-only',
      description: 'Account tag.',
    }
  )
}
