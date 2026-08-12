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

/** Browser geolocation → place. Rejects with a clear Error on deny/timeout. */
export function detectCurrentPlace(options?: {
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<Place> {
  const timeoutMs = options?.timeoutMs ?? 12_000
  const signal = options?.signal

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location services are not available in this browser'))
      return
    }

    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      fn()
    }

    const onAbort = () => {
      finish(() => reject(new DOMException('Aborted', 'AbortError')))
    }
    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort)
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const place = await reverseGeocode(
            pos.coords.latitude,
            pos.coords.longitude,
            signal,
          )
          finish(() => resolve(place))
        } catch (e) {
          // Still usable for weather if reverse geocode fails
          if ((e as Error).name === 'AbortError') {
            finish(() => reject(e))
            return
          }
          finish(() =>
            resolve({
              id: `geo:${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`,
              name: 'Your location',
              country: 'Unknown',
              countryCode: 'XX',
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          )
        }
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'Location unavailable'
              : 'Location request timed out'
        finish(() => reject(new Error(msg)))
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 5 * 60 * 1000,
      },
    )
  })
}

export function formatPlaceLabel(place: Place): string {
  const parts = [place.name]
  if (place.admin1) parts.push(place.admin1)
  parts.push(place.country)
  return parts.join(', ')
}
