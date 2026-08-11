import type { DailyObservation, Place } from '../domain/types'

type ArchiveResponse = {
  daily?: {
    time: string[]
    temperature_2m_mean?: (number | null)[]
    temperature_2m_max?: (number | null)[]
    temperature_2m_min?: (number | null)[]
    precipitation_sum?: (number | null)[]
  }
  timezone?: string
}

const ARCHIVE_START = '1940-01-01'

function yesterdayUtc(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Fetch daily temp + precip history for a place from Open-Meteo archive.
 * Values are in °C and mm (convert for display only).
 */
export async function fetchDailyHistory(
  place: Place,
  signal?: AbortSignal,
): Promise<{ days: DailyObservation[]; endDate: string; timezone: string }> {
  const endDate = yesterdayUtc()
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', String(place.latitude))
  url.searchParams.set('longitude', String(place.longitude))
  url.searchParams.set('start_date', ARCHIVE_START)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set(
    'daily',
    'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum',
  )
  url.searchParams.set('timezone', 'auto')

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Weather archive failed (${res.status})`)
  const data = (await res.json()) as ArchiveResponse
  const daily = data.daily
  if (!daily?.time?.length) {
    throw new Error('No historical daily data for this place')
  }

  const days: DailyObservation[] = daily.time.map((date, i) => ({
    date,
    tMean: daily.temperature_2m_mean?.[i] ?? null,
    tMax: daily.temperature_2m_max?.[i] ?? null,
    tMin: daily.temperature_2m_min?.[i] ?? null,
    precip: daily.precipitation_sum?.[i] ?? null,
  }))

  return {
    days,
    endDate,
    timezone: data.timezone ?? place.timezone ?? 'UTC',
  }
}
