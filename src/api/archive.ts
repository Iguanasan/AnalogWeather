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

/**
 * Open-Meteo free / open-access guidance (terms + pricing):
 * - Non-commercial use
 * - Fair-use limits (IP-based): 600/min, 5_000/hour, 10_000/day
 * - Attribution under CC BY 4.0
 * - Prefer fewer, larger requests; cache; avoid hammering after 429
 *
 * We make at most one archive call per place (full history), share in-flight
 * work across remounts, cache complete results, and back off on 429.
 */

/** In-memory cache of complete histories. */
const HISTORY_CACHE_MAX = 8
const historyCache = new Map<
  string,
  { days: DailyObservation[]; endDate: string; timezone: string }
>()

/** Dedupe concurrent loads (React Strict Mode, rapid re-select). */
const inflightByKey = new Map<string, Promise<HistoryStreamUpdate>>()

export type HistoryStreamUpdate = {
  /** Cumulative days loaded so far, chronological (oldest → newest). */
  days: DailyObservation[]
  /** Days added in this update only. */
  newDays: DailyObservation[]
  archiveEnd: string
  timezone: string
  chunkStart: string
  chunkEnd: string
  progress: number
  done: boolean
  label: string
}

/** Friendly, non-technical errors for the UI. */
export class WeatherArchiveError extends Error {
  readonly kind: 'rate_limit' | 'http' | 'empty' | 'unknown'
  /** Short title for the error panel. */
  readonly title: string
  /** Plain-language body for the user. */
  readonly detail: string

  constructor(
    kind: WeatherArchiveError['kind'],
    title: string,
    detail: string,
    technicalMessage?: string,
  ) {
    super(technicalMessage ?? title)
    this.name = 'WeatherArchiveError'
    this.kind = kind
    this.title = title
    this.detail = detail
  }
}

export const OPEN_METEO_TERMS_URL = 'https://open-meteo.com/en/terms'

export const RATE_LIMIT_TITLE = 'The weather archive needs a short break'

/** Plain-language explanation aligned with Open-Meteo free-tier terms. */
export const RATE_LIMIT_DETAIL =
  'This app uses Open-Meteo’s free open-access weather archive — a shared service ' +
  'meant for private and non-profit sites and apps without subscriptions or advertising. ' +
  'To keep that free service fair for everyone, Open-Meteo limits how often data can be requested ' +
  '(about 600 times per minute, 5,000 per hour, and 10,000 per day on a network). ' +
  'We’ve hit that limit for now. Please wait a minute or two, then try again.'

export const RATE_LIMIT_HINT =
  'We only ask the archive once per place and remember the answer afterward. ' +
  'Full terms: open-meteo.com/en/terms'

function yesterdayUtc(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
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
 * One full-history request (1940 → yesterday). Most polite pattern for
 * Open-Meteo free tier: minimize call count, cache, don't burst.
 */
async function fetchFullHistory(
  place: Place,
  archiveEnd: string,
  signal?: AbortSignal,
): Promise<{ days: DailyObservation[]; timezone: string }> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', String(place.latitude))
  url.searchParams.set('longitude', String(place.longitude))
  url.searchParams.set('start_date', ARCHIVE_START)
  url.searchParams.set('end_date', archiveEnd)
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum',
  )
  url.searchParams.set('timezone', 'auto')

  // At most one gentle retry after a long pause — never a rapid retry storm
  const maxAttempts = 2

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const res = await fetch(url, { signal })

    if (res.status === 429) {
      if (attempt >= maxAttempts) {
        throw new WeatherArchiveError(
          'rate_limit',
          RATE_LIMIT_TITLE,
          RATE_LIMIT_DETAIL,
          'Open-Meteo rate limit (429)',
        )
      }
      // Wait well beyond a short burst window before one polite retry
      const retryAfter = Number(res.headers.get('Retry-After'))
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.max(retryAfter * 1000, 15_000)
          : 20_000
      await sleep(waitMs, signal)
      continue
    }

    if (!res.ok) {
      throw new WeatherArchiveError(
        'http',
        'Could not load weather history',
        'Something went wrong while fetching the historical weather record. Please try again in a moment.',
        `Weather archive failed (${res.status})`,
      )
    }

    const data = (await res.json()) as ArchiveResponse
    const daily = data.daily
    if (!daily?.time?.length) {
      throw new WeatherArchiveError(
        'empty',
        'No weather history for this place',
        'The open weather archive did not return daily data for this location. Try a nearby city or another place.',
      )
    }

    return {
      days: parseDaily(daily),
      timezone: data.timezone ?? place.timezone ?? 'UTC',
    }
  }

  throw new WeatherArchiveError(
    'rate_limit',
    RATE_LIMIT_TITLE,
    RATE_LIMIT_DETAIL,
    'Open-Meteo rate limit (429)',
  )
}

/**
 * Load full history for a place. Yields one completed update (or cache hit).
 * Shared per place so remounts do not double-call Open-Meteo.
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

  let pending = inflightByKey.get(key)
  if (!pending) {
    pending = fetchFullHistory(place, archiveEnd)
      .then(({ days, timezone }) => {
        cacheSet(key, { days, endDate: archiveEnd, timezone })
        const update: HistoryStreamUpdate = {
          days,
          newDays: days,
          archiveEnd,
          timezone,
          chunkStart: days[0]?.date ?? ARCHIVE_START,
          chunkEnd: archiveEnd,
          progress: 1,
          done: true,
          label: `${ARCHIVE_START_YEAR}–${archiveEnd.slice(0, 4)}`,
        }
        return update
      })
      .finally(() => {
        inflightByKey.delete(key)
      })
    inflightByKey.set(key, pending)
  }

  // If this subscriber aborts, others may still need the result
  const update = await new Promise<HistoryStreamUpdate>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    pending!.then(
      (u) => {
        signal?.removeEventListener('abort', onAbort)
        resolve(u)
      },
      (e) => {
        signal?.removeEventListener('abort', onAbort)
        reject(e)
      },
    )
  })

  yield update
}

export function isRateLimitError(e: unknown): e is WeatherArchiveError {
  return e instanceof WeatherArchiveError && e.kind === 'rate_limit'
}

export function toUserHistoryError(e: unknown): {
  title: string
  detail: string
  kind: WeatherArchiveError['kind'] | 'unknown'
} {
  if (e instanceof WeatherArchiveError) {
    return { title: e.title, detail: e.detail, kind: e.kind }
  }
  const msg = (e as Error)?.message ?? ''
  if (/429|rate.?limit/i.test(msg)) {
    return {
      title: RATE_LIMIT_TITLE,
      detail: RATE_LIMIT_DETAIL,
      kind: 'rate_limit',
    }
  }
  return {
    title: 'Could not load weather history',
    detail:
      'Something went wrong while loading historical weather. Please try again in a moment.',
    kind: 'unknown',
  }
}
