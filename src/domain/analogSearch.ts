import type {
  AnalogEpisode,
  DailyObservation,
  WeatherSeries,
  WindowLength,
} from './types'

/**
 * Scale factors so channel distances are comparable.
 * High/low capture heat-wave feel better than 24h mean alone.
 */
const TEMP_SCALE_C = 5
const PRECIP_SCALE_MM = 8
/** Hot days (blistering afternoons). */
const HIGH_WEIGHT = 0.3
/** Warm nights (didn’t cool off). */
const LOW_WEIGHT = 0.3
const PRECIP_WEIGHT = 0.4

/**
 * Minimum match strength (0–100) to count as “felt similar.”
 *
 * At strength 50, distance ≈ 1.0 — roughly the scale of ~5 °C high RMSE,
 * ~5 °C low RMSE, and ~8 mm precip-day RMSE (our channel scales). Below
 * that, spells are “in the same ballpark” but not what people mean by
 * “it felt like this.”
 */
export const MIN_MATCH_STRENGTH = 50

export type AnalogSearchOptions = {
  length: WindowLength
  /** Inclusive start of focal episode (YYYY-MM-DD). */
  focalStart: string
  /** Inclusive end of focal episode (YYYY-MM-DD). */
  focalEnd: string
  /** Max episodes to return after filtering (default 24). */
  topN?: number
  /** Override default MIN_MATCH_STRENGTH (0–100). */
  minMatchStrength?: number
}

function rmse(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!
    sum += d * d
  }
  return Math.sqrt(sum / a.length)
}

function blendedDistance(
  highRmse: number,
  lowRmse: number,
  precipRmse: number,
): number {
  return (
    HIGH_WEIGHT * (highRmse / TEMP_SCALE_C) +
    LOW_WEIGHT * (lowRmse / TEMP_SCALE_C) +
    PRECIP_WEIGHT * (precipRmse / PRECIP_SCALE_MM)
  )
}

/** Map distance → 0–100 match strength (higher = closer). */
export function matchStrengthFromDistance(distance: number): number {
  return Math.round(1000 / (1 + distance)) / 10
}

export function extractSeries(
  days: DailyObservation[],
  startIdx: number,
  length: number,
): WeatherSeries | null {
  const slice = days.slice(startIdx, startIdx + length)
  if (slice.length !== length) return null

  const dates: string[] = []
  const tMax: number[] = []
  const tMin: number[] = []
  const tMean: number[] = []
  const precip: number[] = []

  for (const d of slice) {
    if (
      d.tMax == null ||
      d.tMin == null ||
      d.tMean == null ||
      d.precip == null
    ) {
      return null
    }
    dates.push(d.date)
    tMax.push(d.tMax)
    tMin.push(d.tMin)
    tMean.push(d.tMean)
    precip.push(d.precip)
  }

  return { dates, tMax, tMin, tMean, precip }
}

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4))
}

function datesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

/**
 * Full-year sliding-window search: for each calendar year, score every
 * L-length window on daily high + low + precip vs the focal series; keep
 * the best episode per year that is similar enough; return newest first.
 *
 * Order answers “when did it last feel like this?” — not “which year is
 * mathematically closest.” Highs and lows are matched separately so a heat
 * wave is not confused with a mild week that only shares the same mean.
 */
export function findAnalogEpisodes(
  history: DailyObservation[],
  focal: WeatherSeries,
  options: AnalogSearchOptions,
): AnalogEpisode[] {
  const {
    length,
    focalStart,
    focalEnd,
    topN = 24,
    minMatchStrength = MIN_MATCH_STRENGTH,
  } = options
  if (focal.tMax.length !== length || history.length < length) return []

  const byYear = new Map<number, DailyObservation[]>()
  for (const day of history) {
    const y = yearOf(day.date)
    let list = byYear.get(y)
    if (!list) {
      list = []
      byYear.set(y, list)
    }
    list.push(day)
  }

  const bestByYear: AnalogEpisode[] = []

  for (const [year, days] of byYear) {
    // Ensure chronological order
    days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    let best: AnalogEpisode | null = null

    for (let i = 0; i <= days.length - length; i++) {
      const series = extractSeries(days, i, length)
      if (!series) continue

      const startDate = series.dates[0]!
      const endDate = series.dates[length - 1]!

      // Exclude windows that overlap the focal episode (self-match).
      if (datesOverlap(startDate, endDate, focalStart, focalEnd)) continue

      const tempHighRmse = rmse(focal.tMax, series.tMax)
      const tempLowRmse = rmse(focal.tMin, series.tMin)
      const precipRmse = rmse(focal.precip, series.precip)
      const distance = blendedDistance(tempHighRmse, tempLowRmse, precipRmse)

      if (!best || distance < best.distance) {
        best = {
          year,
          startDate,
          endDate,
          series,
          distance,
          matchStrength: matchStrengthFromDistance(distance),
          tempHighRmse,
          tempLowRmse,
          precipRmse,
        }
      }
    }

    if (best && best.matchStrength >= minMatchStrength) {
      bestByYear.push(best)
    }
  }

  // Most recent first — “when did it last feel like this?”
  bestByYear.sort((a, b) =>
    a.endDate < b.endDate ? 1 : a.endDate > b.endDate ? -1 : 0,
  )
  return bestByYear.slice(0, topN)
}

export function seriesStats(series: WeatherSeries): {
  avgHigh: number
  avgLow: number
  avgMean: number
  totalPrecip: number
} {
  const n = Math.max(series.tMax.length, 1)
  const avgHigh = series.tMax.reduce((s, v) => s + v, 0) / n
  const avgLow = series.tMin.reduce((s, v) => s + v, 0) / n
  const avgMean = series.tMean.reduce((s, v) => s + v, 0) / n
  const totalPrecip = series.precip.reduce((s, v) => s + v, 0)
  return { avgHigh, avgLow, avgMean, totalPrecip }
}

/**
 * Signed deltas: analog − focal.
 * Positive high/low = that spell was warmer; positive precip = wetter.
 */
export function seriesDeltas(
  analog: WeatherSeries,
  focal: WeatherSeries,
): {
  highDelta: number
  lowDelta: number
  precipDelta: number
} {
  const a = seriesStats(analog)
  const f = seriesStats(focal)
  return {
    highDelta: a.avgHigh - f.avgHigh,
    lowDelta: a.avgLow - f.avgLow,
    precipDelta: a.totalPrecip - f.totalPrecip,
  }
}
