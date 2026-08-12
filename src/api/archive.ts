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

/** Recent years first for a fast first paint; remainder loads in one follow-up. */
const FIRST_CHUNK_YEARS = 5

/** In-memory cache of *complete* histories only. */
const HISTORY_CACHE_MAX = 6
const historyCache = new Map<
  string,
  { days: DailyObservation[]; endDate: string; timezone: string }
>()

/** Dedupe concurrent streams (React Strict Mode remounts, rapid re-select). */
const inflightStreams = new Map<string, Promise<void>>()
const streamListeners = new Map<
  string,
  Set<(update: HistoryStreamUpdate) => void>
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
    const t = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      globalThis.clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Two phases only (not one request per decade) to stay under Open-Meteo limits:
 * 1) last ~5 years for a quick Live paint
 * 2) remainder back to 1940 in a single follow-up request
 */
export function buildHistoryChunkRanges(
  archiveEnd: string,
  archiveStartYear = ARCHIVE_START_YEAR,
): { start: string; end: string; label: string }[] {
  const endYear = yearOf(archiveEnd)
  const recentLow = Math.max(archiveStartYear, endYear - FIRST_CHUNK_YEARS + 1)
  const ranges: { start: string; end: string; label: string }[] = [
    {
      start: `${recentLow}-01-01`,
      end: archiveEnd,
      label:
        recentLow === endYear ? String(endYear) : `${recentLow}–${endYear}`,
    },
  ]

  if (recentLow > archiveStartYear) {
    const olderEndYear = recentLow - 1
    ranges.push({
      start: ARCHIVE_START,
      end: `${olderEndYear}-12-31`,
      label: `${archiveStartYear}–${olderEndYear}`,
    })
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
  const maxAttempts = 8

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const res = await fetch(url, { signal })

    if (res.status === 429) {
      attempt++
      if (attempt >= maxAttempts) {
        throw new Error(
          'Weather archive rate-limited (429). Wait a minute and try again, or pick another place.',
        )
      }
      const retryAfter = Number(res.headers.get('Retry-After'))
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.max(retryAfter * 1000, 3000)
          : Math.min(2000 * 2 ** attempt, 45_000)
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

async function runHistoryStream(
  place: Place,
  key: string,
  archiveEnd: string,
  emit: (update: HistoryStreamUpdate) => void,
  signal?: AbortSignal,
): Promise<void> {
  const ranges = buildHistoryChunkRanges(archiveEnd)
  const total = ranges.length
  let cumulative: DailyObservation[] = []
  let timezone = place.timezone ?? 'UTC'

  for (let i = 0; i < ranges.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const range = ranges[i]!
    const { days: chunkDays, timezone: tz } = await fetchRange(
      place,
      range.start,
      range.end,
      signal,
    )
    timezone = tz

    if (i === 0) {
      cumulative = chunkDays
    } else if (chunkDays.length) {
      const firstExisting = cumulative[0]?.date
      const filtered = firstExisting
        ? chunkDays.filter((d) => d.date < firstExisting)
        : chunkDays
      cumulative = filtered.length ? [...filtered, ...cumulative] : cumulative
    }

    const done = i === total - 1
    emit({
      days: cumulative,
      newDays: chunkDays,
      archiveEnd,
      timezone,
      chunkStart: range.start,
      chunkEnd: range.end,
      progress: (i + 1) / total,
      done,
      label: range.label,
    })

    // Pause before the large historical pull so free-tier limits can recover
    if (!done) {
      await sleep(800, signal)
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

/**
 * Stream history recent-first (2 phases max). Shared per place so React Strict
 * Mode and rapid remounts do not fire duplicate Open-Meteo storms.
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

  const queue: HistoryStreamUpdate[] = []
  let resolveWait: (() => void) | null = null
  let streamError: unknown = null
  let finished = false

  const wake = () => {
    resolveWait?.()
    resolveWait = null
  }

  const listener = (update: HistoryStreamUpdate) => {
    queue.push(update)
    wake()
  }

  let listeners = streamListeners.get(key)
  if (!listeners) {
    listeners = new Set()
    streamListeners.set(key, listeners)
  }
  listeners.add(listener)

  if (!inflightStreams.has(key)) {
    const run = runHistoryStream(
      place,
      key,
      archiveEnd,
      (update) => {
        const set = streamListeners.get(key)
        if (!set) return
        for (const fn of set) fn(update)
      },
      // Do not bind to the first subscriber's signal — shared work should finish
      // for other listeners. Individual consumers stop reading when they abort.
      undefined,
    )
      .catch((e) => {
        streamError = e
        wake()
      })
      .finally(() => {
        finished = true
        inflightStreams.delete(key)
        streamListeners.delete(key)
        wake()
      })
    inflightStreams.set(key, run)
  }

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      while (queue.length) {
        yield queue.shift()!
      }
      if (streamError) throw streamError
      if (finished && queue.length === 0) break
      await new Promise<void>((resolve) => {
        resolveWait = resolve
        if (signal) {
          const onAbort = () => {
            resolveWait = null
            resolve()
          }
          signal.addEventListener('abort', onAbort, { once: true })
        }
      })
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
    }
  } finally {
    listeners.delete(listener)
    if (listeners.size === 0) {
      streamListeners.delete(key)
    }
  }
}
