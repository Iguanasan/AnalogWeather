import type { Place } from '../domain/types'

type GeoResult = {
  id: number
  name: string
  latitude: number
  longitude: number
  country: string
  country_code: string
  admin1?: string
  timezone?: string
}

type GeoResponse = {
  results?: GeoResult[]
}

/** BigDataCloud reverse-geocode client response (no API key). */
type ReverseGeoResponse = {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryName?: string
  countryCode?: string
  latitude?: number
  longitude?: number
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', q)
  url.searchParams.set('count', '8')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`)
  const data = (await res.json()) as GeoResponse
  if (!data.results?.length) return []

  return data.results.map((r) => ({
    id: String(r.id),
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    countryCode: r.country_code,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }))
}

/**
 * Resolve a place from lat/lon for "use my location".
 * Uses free reverse geocoding for a human label; weather uses the coords.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<Place> {
  const url = new URL(
    'https://api.bigdatacloud.net/data/reverse-geocode-client',
  )
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('localityLanguage', 'en')

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`)
  const data = (await res.json()) as ReverseGeoResponse

  const name =
    data.city?.trim() ||
    data.locality?.trim() ||
    'Your location'
  // BigDataCloud sometimes returns "United States of America (the)"
  const country = (data.countryName?.trim() || 'Unknown').replace(
    /\s*\(the\)$/i,
    '',
  )
  const countryCode = (data.countryCode?.trim() || 'XX').toUpperCase()
  const admin1 = data.principalSubdivision?.trim() || undefined

  return {
    id: `geo:${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    name,
    admin1,
    country,
    countryCode,
    latitude,
    longitude,
  }
}

function placeFromCoords(latitude: number, longitude: number): Place {
  return {
    id: `geo:${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    name: 'Your location',
    country: 'Unknown',
    countryCode: 'XX',
    latitude,
    longitude,
  }
}

function getPositionOnce(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location services are not available in this browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

/** Shared in-flight detect so React Strict Mode remounts don't race two GPS calls. */
let detectInflight: Promise<Place> | null = null

/**
 * Browser geolocation → place.
 *
 * Timeout must be generous: the PositionOptions timer often runs while the
 * permission dialog is open, so a short timeout fails right after the user
 * clicks Allow. We accept a recent cached fix, then retry once on timeout.
 */
export function detectCurrentPlace(options?: {
  signal?: AbortSignal
  /** Per-attempt geolocation timeout (default 45s). */
  timeoutMs?: number
}): Promise<Place> {
  const signal = options?.signal
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }

  // Reuse a single browser request when callers overlap (e.g. Strict Mode).
  if (!detectInflight) {
    detectInflight = runDetectCurrentPlace(options).finally(() => {
      detectInflight = null
    })
  }

  const shared = detectInflight
  if (!signal) return shared

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    shared.then(
      (place) => {
        signal.removeEventListener('abort', onAbort)
        if (signal.aborted) onAbort()
        else resolve(place)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        if (signal.aborted) onAbort()
        else reject(err)
      },
    )
  })
}

async function runDetectCurrentPlace(options?: {
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<Place> {
  const timeoutMs = options?.timeoutMs ?? 45_000
  const signal = options?.signal

  if (!navigator.geolocation) {
    throw new Error('Location services are not available in this browser')
  }

  const attempts: PositionOptions[] = [
    // Prefer a recent cached position — fast after permission is granted.
    {
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 30 * 60 * 1000,
    },
    // Retry: allow a fresh network/OS fix if the first attempt timed out.
    {
      enableHighAccuracy: false,
      timeout: Math.max(timeoutMs, 60_000),
      maximumAge: 0,
    },
  ]

  let lastError: GeolocationPositionError | Error | null = null

  for (let i = 0; i < attempts.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    try {
      const pos = await getPositionOnce(attempts[i]!)
      try {
        return await reverseGeocode(
          pos.coords.latitude,
          pos.coords.longitude,
          signal,
        )
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e
        // Coords alone are enough for weather if reverse geocode fails.
        return placeFromCoords(pos.coords.latitude, pos.coords.longitude)
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      lastError = e as GeolocationPositionError | Error
      const code = (e as GeolocationPositionError).code
      // Only retry timeouts; permission deny / unavailable won't improve.
      if (code !== 3 /* TIMEOUT */) break
    }
  }

  const geoErr = lastError as GeolocationPositionError | null
  if (geoErr && typeof geoErr.code === 'number') {
    if (geoErr.code === geoErr.PERMISSION_DENIED) {
      throw new Error('Location permission denied')
    }
    if (geoErr.code === geoErr.POSITION_UNAVAILABLE) {
      throw new Error(
        'Location unavailable — check that location services are on',
      )
    }
    throw new Error(
      'Location request timed out — try again or search for a place',
    )
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Could not detect location')
}

export function formatPlaceLabel(place: Place): string {
  const parts = [place.name]
  if (place.admin1) parts.push(place.admin1)
  parts.push(place.country)
  return parts.join(', ')
}
