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

export function formatPlaceLabel(place: Place): string {
  const parts = [place.name]
  if (place.admin1) parts.push(place.admin1)
  parts.push(place.country)
  return parts.join(', ')
}
