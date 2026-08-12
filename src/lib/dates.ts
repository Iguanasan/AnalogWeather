import type { DailyObservation, WindowLength } from '../domain/types'
import { extractSeries } from '../domain/analogSearch'

export function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

/** Compare ISO dates YYYY-MM-DD (lexicographic works for this format). */
export function compareIsoDates(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Earliest anchor that still has a full L-day trailing window after
 * ARCHIVE_START (1940-01-01).
 */
export function minAnchorForLength(length: WindowLength): string {
  return addDaysIso('1940-01-01', length - 1)
}

/** Step the period ending date by ± one full window length. */
export function stepPeriodAnchor(
  anchor: string,
  length: WindowLength,
  direction: -1 | 1,
): string {
  return addDaysIso(anchor, direction * length)
}

/** Inclusive end = anchor; start = anchor - (L - 1). */
export function focalRange(
  anchorDate: string,
  length: WindowLength,
): { start: string; end: string } {
  return {
    start: addDaysIso(anchorDate, -(length - 1)),
    end: anchorDate,
  }
}

export function findIndexByDate(
  days: DailyObservation[],
  date: string,
): number {
  return days.findIndex((d) => d.date === date)
}

export function buildFocalFromHistory(
  days: DailyObservation[],
  anchorDate: string,
  length: WindowLength,
) {
  const endIdx = findIndexByDate(days, anchorDate)
  if (endIdx < 0) return null
  const startIdx = endIdx - (length - 1)
  if (startIdx < 0) return null
  const series = extractSeries(days, startIdx, length)
  if (!series) return null
  const { start, end } = focalRange(anchorDate, length)
  return { series, start, end }
}

export function formatEpisodeRange(start: string, end: string): string {
  if (start === end) return formatNiceDate(start)
  return `${formatNiceDate(start)} – ${formatNiceDate(end)}`
}

export function formatNiceDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  return dt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function windowLabel(length: WindowLength): string {
  if (length === 1) return 'This day'
  if (length === 7) return 'This week'
  return 'This month'
}
