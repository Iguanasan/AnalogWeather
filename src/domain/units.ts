import type { Place, Units } from './types'

/** US customary for a small set of countries; otherwise metric. */
const US_CUSTOMARY = new Set(['US', 'LR', 'MM'])

export function unitsForPlace(place: Place | null): Units {
  if (place && US_CUSTOMARY.has(place.countryCode.toUpperCase())) {
    return { temperature: 'F', precip: 'in' }
  }
  return { temperature: 'C', precip: 'mm' }
}

export function cToF(c: number): number {
  return (c * 9) / 5 + 32
}

export function mmToIn(mm: number): number {
  return mm / 25.4
}

export function formatTemp(celsius: number, units: Units, digits = 0): string {
  const v = units.temperature === 'F' ? cToF(celsius) : celsius
  const u = units.temperature === 'F' ? '°F' : '°C'
  return `${v.toFixed(digits)}${u}`
}

export function formatPrecip(mm: number, units: Units, digits = 1): string {
  const v = units.precip === 'in' ? mmToIn(mm) : mm
  const u = units.precip === 'in' ? 'in' : 'mm'
  return `${v.toFixed(digits)} ${u}`
}

export function tempUnitLabel(units: Units): string {
  return units.temperature === 'F' ? '°F' : '°C'
}

export function precipUnitLabel(units: Units): string {
  return units.precip === 'in' ? 'in' : 'mm'
}

export function displayTemp(celsius: number, units: Units): number {
  return units.temperature === 'F' ? cToF(celsius) : celsius
}

export function displayPrecip(mm: number, units: Units): number {
  return units.precip === 'in' ? mmToIn(mm) : mm
}
