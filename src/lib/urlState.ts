import type { AppQuery, Place, WindowLength } from '../domain/types'

function parseLength(v: string | null): WindowLength {
  if (v === '1') return 1
  if (v === '30') return 30
  return 7
}

export function readQueryFromUrl(): Partial<AppQuery> & {
  placeHint?: Place
} {
  const params = new URLSearchParams(window.location.search)
  const lat = params.get('lat')
  const lon = params.get('lon')
  const name = params.get('name')
  const country = params.get('country')
  const countryCode = params.get('cc')
  const admin1 = params.get('admin1') || undefined

  let placeHint: Place | undefined
  if (lat && lon && name && country && countryCode) {
    placeHint = {
      id: params.get('id') || `${lat},${lon}`,
      name,
      admin1,
      country,
      countryCode,
      latitude: Number(lat),
      longitude: Number(lon),
    }
  }

  const anchor = params.get('anchor')
  return {
    placeHint,
    length: parseLength(params.get('L')),
    anchorDate: anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor : null,
  }
}

export function writeQueryToUrl(query: AppQuery, replace = true): void {
  const params = new URLSearchParams()
  if (query.place) {
    params.set('id', query.place.id)
    params.set('name', query.place.name)
    params.set('country', query.place.country)
    params.set('cc', query.place.countryCode)
    if (query.place.admin1) params.set('admin1', query.place.admin1)
    params.set('lat', String(query.place.latitude))
    params.set('lon', String(query.place.longitude))
  }
  params.set('L', String(query.length))
  if (query.anchorDate) params.set('anchor', query.anchorDate)

  const qs = params.toString()
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  if (replace) {
    window.history.replaceState(null, '', url)
  } else {
    window.history.pushState(null, '', url)
  }
}

export function shareableUrl(query: AppQuery): string {
  const params = new URLSearchParams()
  if (query.place) {
    params.set('id', query.place.id)
    params.set('name', query.place.name)
    params.set('country', query.place.country)
    params.set('cc', query.place.countryCode)
    if (query.place.admin1) params.set('admin1', query.place.admin1)
    params.set('lat', String(query.place.latitude))
    params.set('lon', String(query.place.longitude))
  }
  params.set('L', String(query.length))
  if (query.anchorDate) params.set('anchor', query.anchorDate)
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`
}
