import type { WeatherSeries } from './types'

/** Visual mood of a spell. Distinctive weather beats a bland average. */
export const ATMOSPHERES = [
  'snow',
  'storm',
  'rain',
  'heat',
  'cold',
  'fair',
] as const

export type AtmosphereId = (typeof ATMOSPHERES)[number]

export interface AtmosphereMeta {
  id: AtmosphereId
  label: string
  icon: string
}

export const ATMOSPHERE_META: Record<AtmosphereId, AtmosphereMeta> = {
  snow: { id: 'snow', label: 'Snowy spell', icon: '❄️' },
  storm: { id: 'storm', label: 'Stormy spell', icon: '🌩️' },
  rain: { id: 'rain', label: 'Rainy spell', icon: '🌧️' },
  heat: { id: 'heat', label: 'Warm spell', icon: '☀️' },
  cold: { id: 'cold', label: 'Cold spell', icon: '🧊' },
  fair: { id: 'fair', label: 'Fair spell', icon: '🌤️' },
}

export function getAtmosphereMeta(id: AtmosphereId): AtmosphereMeta {
  return ATMOSPHERE_META[id] ?? ATMOSPHERE_META.fair
}

const WET_DAY_MM = 1
const TRACE_MM = 0.4
const SNOW_AVG_LOW_C = 1
const HEAT_AVG_HIGH_C = 28
const COLD_AVG_HIGH_C = 5
const COLD_AVG_LOW_C = -3
const STORM_DAY_MM = 25
const STORM_MEAN_MM = 12
const RAIN_DAY_MM = 4
const RAIN_MEAN_MM = 1.5
const RAIN_WET_FRAC = 0.35

export function classifyAtmosphere(series: WeatherSeries): AtmosphereId {
  const n = series.tMax.length
  if (n === 0) return 'fair'

  const avgHigh = mean(series.tMax)
  const avgLow = mean(series.tMin)
  const totalPrecip = series.precip.reduce((s, v) => s + v, 0)
  const maxPrecip = Math.max(...series.precip)
  const wetDays = series.precip.filter((p) => p >= WET_DAY_MM).length
  const wetFrac = wetDays / n
  const dailyMean = totalPrecip / n
  const wintry = avgLow <= SNOW_AVG_LOW_C
  const freezeWetDays = series.tMin.filter(
    (lo, i) => lo <= SNOW_AVG_LOW_C && series.precip[i]! >= TRACE_MM,
  ).length

  const snowy =
    wintry &&
    totalPrecip >= Math.max(0.5, 0.35 * n) &&
    (wetDays >= 1 || freezeWetDays >= 1)

  if (snowy) return 'snow'

  const stormy =
    maxPrecip >= STORM_DAY_MM ||
    dailyMean >= STORM_MEAN_MM ||
    (n >= 3 && wetFrac >= 0.55 && dailyMean >= 6 && totalPrecip >= 25)

  if (stormy) return wintry ? 'snow' : 'storm'

  const rainy =
    maxPrecip >= RAIN_DAY_MM ||
    dailyMean >= RAIN_MEAN_MM ||
    wetFrac >= RAIN_WET_FRAC

  if (rainy) return wintry ? 'snow' : 'rain'

  if (avgHigh >= HEAT_AVG_HIGH_C) return 'heat'
  if (avgHigh <= COLD_AVG_HIGH_C || avgLow <= COLD_AVG_LOW_C) return 'cold'
  return 'fair'
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1)
}
