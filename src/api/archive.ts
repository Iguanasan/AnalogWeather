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

export const ARCHIVE_START_YEAR = 1940
export const ARCHIVE_START = `${ARCHIVE_START_YEAR}-01-01`

/** Recent years first for a fast first paint; older decades stream in later. */
const FIRST_CHUNK_YEARS = 5
const BACK_CHUNK_YEARS = 10

/** In-memory cache of *complete* histories only. */
const HISTORY_CACHE_MAX = 6
const historyCache = new Map<
  string,
  { days: DailyObservation[]; endDate: string; timezone: string }
>()

export type HistoryStreamUpdate = {
  /** Cumulative days loaded so far, chronological (oldest → newest). */
  days: DailyObservation[]
  /** Days added in this update only. */
  newDays: DailyObservation[]
  archiveEnd: string
  timezone: string
  /** Inclusive ISO range of this chunk. */
  chunkStart: string
  chunkEnd: string
  /** 0–1 estimate of archive coverage. */
  progress: number
  done: boolean
  /** Human label, e.g. "2020–2025". */
  label: string
}

function yesterdayUtc(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function yearOf(iso: string): number {
  return Number(iso.slice(0, 4))
}

function cacheKey(place: Place, endDate: string): string {
  const lat = place.latitude.toFixed(2)
  const lon = place.longitude.toFixed(2)
  return `${lat},${lon}|${endDate}`
}

function cacheGet(key: string) {
  const hit = historyCache.get(key)
  if (!hit) return null
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
  const {
    time,
    temperature_2m_max: tMax,
    temperature_2m_min: tMin,
    precipitation_sum: precip,
  } = daily
  const n = time.length
  const days: DailyObservation[] = new Array(n)
  for (let i = 0; i < n; i++) {
    days[i] = {
      date: time[i]!,
      tMax: tMax?.[i] ?? null,
      tMin: tMin?.[i] ?? null,
      precip: precip?.[i] ?? null,
      tMean: null,
    }
  }
  return days
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Year-aligned ranges from recent → past.
 * First chunk is a short recent window so Live mode can render quickly.
 */
export function buildHistoryChunkRanges(
  archiveEnd: string,
  archiveStartYear = ARCHIVE_START_YEAR,
): { start: string; end: string; label: string }[] {
  const endYear = yearOf(archiveEnd)
  const ranges: { start: string; end: string; label: string }[] = []

  let high = endYear
  // First chunk: last few years through archiveEnd
  let low = Math.max(archiveStartYear, high - FIRST_CHUNK_YEARS + 1)
  ranges.push({
    start: `${low}-01-01`,
    end: archiveEnd,
    label: low === high ? String(high) : `${low}–${high}`,
  })

  high = low - 1
  while (high >= archiveStartYear) {
    low = Math.max(archiveStartYear, high - BACK_CHUNK_YEARS + 1)
    ranges.push({
      start: low === archiveStartYear ? ARCHIVE_START : `${low}-01-01`,
      end: `${high}-12-31`,
      label: low === high ? String(high) : `${low}–${high}`,
    })
    high = low - 1
  }

  return ranges
}

async function fetchRange(
  place: Place,
  startDate: string,
  endDate: string,
  signal?: AbortSignal,
): Promise<{ days: DailyObservation[]; timezone: string }> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', String(place.latitude))
  url.searchParams.set('longitude', String(place.longitude))
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum',
  )
  url.searchParams.set('timezone', 'auto')

  let attempt = 0
  const maxAttempts = 6

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const res = await fetch(url, { signal })

    if (res.status === 429) {
      attempt++
      if (attempt >= maxAttempts) {
        throw new Error(
          'Weather archive rate-limited (429). Wait a moment and try again.',
        )
      }
      // Honor Retry-After when present; otherwise exponential backoff
      const retryAfter = Number(res.headers.get('Retry-After'))
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(1000 * 2 ** attempt, 20_000)
      await sleep(waitMs, signal)
      continue
    }

    if (!res.ok) {
      throw new Error(`Weather archive failed (${res.status})`)
    }

    const data = (await res.json()) as ArchiveResponse
    const daily = data.daily
    if (!daily?.time?.length) {
      return {
        days: [],
        timezone: data.timezone ?? place.timezone ?? 'UTC',
      }
    }

    return {
      days: parseDaily(daily),
      timezone: data.timezone ?? place.timezone ?? 'UTC',
    }
  }
}

/**
 * Stream history recent-first. Yields after each chunk so the UI can show
 * analogs as years arrive. Sequential requests + 429 backoff avoid hammering
 * Open-Meteo with one giant archive call.
 */
export async function* streamDailyHistory(
  place: Place,
  signal?: AbortSignal,
): AsyncGenerator<HistoryStreamUpdate> {
  const archiveEnd = yesterdayUtc()
  const key = cacheKey(place, archiveEnd)
  const cached = cacheGet(key)
  if (cached) {
    yield {
      days: cached.days,
      newDays: cached.days,
      archiveEnd: cached.endDate,
      timezone: cached.timezone,
      chunkStart: cached.days[0]?.date ?? ARCHIVE_START,
      chunkEnd: cached.endDate,
      progress: 1,
      done: true,
      label: 'cached',
    }
    return
  }

  const ranges = buildHistoryChunkRanges(archiveEnd)
  const total = ranges.length
  let cumulative: DailyObservation[] = []
  let timezone = place.timezone ?? 'UTC'

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]!
    const { days: chunkDays, timezone: tz } = await fetchRange(
      place,
      range.start,
      range.end,
      signal,
    )
    timezone = tz

    // Older chunks prepend; first chunk is newest
    if (i === 0) {
      cumulative = chunkDays
    } else if (chunkDays.length) {
      // Drop any accidental overlap at year boundaries
      const firstExisting = cumulative[0]?.date
      const filtered = firstExisting
        ? chunkDays.filter((d) => d.date < firstExisting)
        : chunkDays
      cumulative = filtered.length ? [...filtered, ...cumulative] : cumulative
    }

    const done = i === total - 1
    yield {
      days: cumulative,
      newDays: chunkDays,
      archiveEnd,
      timezone,
      chunkStart: range.start,
      chunkEnd: range.end,
      progress: (i + 1) / total,
      done,
      label: range.label,
    }

    // Brief pause between chunks — reduces 429s under free-tier limits
    if (!done) {
      await sleep(120, signal)
    }
  }

  if (cumulative.length) {
    cacheSet(key, {
      days: cumulative,
      endDate: archiveEnd,
      timezone,
    })
  }
}
