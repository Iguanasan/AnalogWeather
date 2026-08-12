import type { DailyObservation, Place } from '../domain/types'

type ArchiveResponse = {
  daily?: {
    time: string[]
    temperature_2m_max?: (number | null)[]
    temperature_2m_min?: (number | null)[]
    precipitation_sum?: (number | null)[]
  }
  timezone?: string
}

const ARCHIVE_START = '1940-01-01'

/** In-memory cache: full history is large; keep a few places for revisit speed. */
const HISTORY_CACHE_MAX = 6
const historyCache = new Map<
  string,
  { days: DailyObservation[]; endDate: string; timezone: string }
>()

function yesterdayUtc(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function cacheKey(place: Place, endDate: string): string {
  // Round coords so tiny GPS jitter still hits the same cell
  const lat = place.latitude.toFixed(2)
  const lon = place.longitude.toFixed(2)
  return `${lat},${lon}|${endDate}`
}

function cacheGet(key: string) {
  const hit = historyCache.get(key)
  if (!hit) return null
  // LRU: re-insert at end
  historyCache.delete(key)
  historyCache.set(key, hit)
  return hit
}

function cacheSet(
  key: string,
  value: { days: DailyObservation[]; endDate: string; timezone: string },
) {
  if (historyCache.has(key)) historyCache.delete(key)
  historyCache.set(key, value)
  while (historyCache.size > HISTORY_CACHE_MAX) {
    const oldest = historyCache.keys().next().value
    if (oldest === undefined) break
    historyCache.delete(oldest)
  }
}

function parseDaily(
  daily: NonNullable<ArchiveResponse['daily']>,
): DailyObservation[] {
  const { time, temperature_2m_max: tMax, temperature_2m_min: tMin, precipitation_sum: precip } =
    daily
  const n = time.length
  const days: DailyObservation[] = new Array(n)
  for (let i = 0; i < n; i++) {
    days[i] = {
      date: time[i]!,
      tMax: tMax?.[i] ?? null,
      tMin: tMin?.[i] ?? null,
      precip: precip?.[i] ?? null,
      // Mean is not requested; keep field for compatibility when present
      tMean: null,
    }
  }
  return days
}

/**
 * Fetch daily high/low/precip history for a place from Open-Meteo archive.
 * Values are in °C and mm (convert for display only).
 *
 * Matching only needs high, low, and precip — mean is omitted from the
 * request to shrink ~25% of the multi-decade payload.
 */
export async function fetchDailyHistory(
  place: Place,
  signal?: AbortSignal,
): Promise<{ days: DailyObservation[]; endDate: string; timezone: string }> {
  const endDate = yesterdayUtc()
  const key = cacheKey(place, endDate)
  const cached = cacheGet(key)
  if (cached) return cached

  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', String(place.latitude))
  url.searchParams.set('longitude', String(place.longitude))
  url.searchParams.set('start_date', ARCHIVE_START)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum',
  )
  url.searchParams.set('timezone', 'auto')

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Weather archive failed (${res.status})`)
  const data = (await res.json()) as ArchiveResponse
  const daily = data.daily
  if (!daily?.time?.length) {
    throw new Error('No historical daily data for this place')
  }

  const result = {
    days: parseDaily(daily),
    endDate,
    timezone: data.timezone ?? place.timezone ?? 'UTC',
  }
  cacheSet(key, result)
  return result
}
