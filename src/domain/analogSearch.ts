import type {
  AnalogEpisode,
  DailyObservation,
  WeatherSeries,
  WindowLength,
} from './types'

/** Scale factors so temp (°C) and precip (mm) distances are comparable. */
const TEMP_SCALE_C = 5
const PRECIP_SCALE_MM = 8
const TEMP_WEIGHT = 0.6
const PRECIP_WEIGHT = 0.4

export type AnalogSearchOptions = {
  length: WindowLength
  /** Inclusive start of focal episode (YYYY-MM-DD). */
  focalStart: string
  /** Inclusive end of focal episode (YYYY-MM-DD). */
  focalEnd: string
  topN?: number
}

function rmse(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!
    sum += d * d
  }
  return Math.sqrt(sum / a.length)
}

function blendedDistance(tempRmse: number, precipRmse: number): number {
  return (
    TEMP_WEIGHT * (tempRmse / TEMP_SCALE_C) +
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
  const tMean: number[] = []
  const precip: number[] = []

  for (const d of slice) {
    if (d.tMean == null || d.precip == null) return null
    dates.push(d.date)
    tMean.push(d.tMean)
    precip.push(d.precip)
  }

  return { dates, tMean, precip }
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
 * L-length window on temp + precip vs the focal series; keep the best
 * episode per year; return top N by blended distance.
 */
export function findAnalogEpisodes(
  history: DailyObservation[],
  focal: WeatherSeries,
  options: AnalogSearchOptions,
): AnalogEpisode[] {
  const { length, focalStart, focalEnd, topN = 12 } = options
  if (focal.tMean.length !== length || history.length < length) return []

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

      const tempRmse = rmse(focal.tMean, series.tMean)
      const precipRmse = rmse(focal.precip, series.precip)
      const distance = blendedDistance(tempRmse, precipRmse)

      if (!best || distance < best.distance) {
        best = {
          year,
          startDate,
          endDate,
          series,
          distance,
          matchStrength: matchStrengthFromDistance(distance),
          tempRmse,
          precipRmse,
        }
      }
    }

    if (best) bestByYear.push(best)
  }

  bestByYear.sort((a, b) => a.distance - b.distance)
  return bestByYear.slice(0, topN)
}

export function seriesStats(series: WeatherSeries): {
  avgTemp: number
  totalPrecip: number
} {
  const avgTemp =
    series.tMean.reduce((s, v) => s + v, 0) / Math.max(series.tMean.length, 1)
  const totalPrecip = series.precip.reduce((s, v) => s + v, 0)
  return { avgTemp, totalPrecip }
}
