import { findAnalogEpisodes, matchStrengthFromDistance } from './analogSearch'
import type { DailyObservation } from './types'

function day(date: string, t: number, p: number): DailyObservation {
  return { date, tMean: t, tMax: t + 2, tMin: t - 2, precip: p }
}

function yearDays(year: number, baseTemp: number, basePrecip: number): DailyObservation[] {
  const out: DailyObservation[] = []
  // 10 days in January-ish
  for (let d = 1; d <= 10; d++) {
    const dd = String(d).padStart(2, '0')
    out.push(day(`${year}-01-${dd}`, baseTemp + d * 0.1, basePrecip))
  }
  // 10 days in July-ish
  for (let d = 1; d <= 10; d++) {
    const dd = String(d).padStart(2, '0')
    out.push(day(`${year}-07-${dd}`, baseTemp + 15 + d * 0.1, basePrecip + 2))
  }
  return out
}

const history: DailyObservation[] = [
  ...yearDays(2010, 5, 0),
  ...yearDays(2011, 20, 5), // closer to warm July pattern
  ...yearDays(2012, 6, 0.5),
]

// Focal: warm week like July pattern
const focalDays = yearDays(2020, 20, 5).filter((d) => d.date.startsWith('2020-07')).slice(0, 7)
const focal = {
  dates: focalDays.map((d) => d.date),
  tMean: focalDays.map((d) => d.tMean!),
  precip: focalDays.map((d) => d.precip!),
}

const historyWithFocal = [
  ...history,
  ...yearDays(2020, 20, 5),
]

const results = findAnalogEpisodes(historyWithFocal, focal, {
  length: 7,
  focalStart: '2020-07-01',
  focalEnd: '2020-07-07',
  topN: 5,
})

console.assert(results.length >= 1, 'should find analogs')
console.assert(results[0]!.year === 2011, `expected 2011 first, got ${results[0]?.year}`)
console.assert(
  !results.some((r) => r.startDate >= '2020-07-01' && r.endDate <= '2020-07-07'),
  'should not include overlapping focal window as top self',
)
console.assert(matchStrengthFromDistance(0) > matchStrengthFromDistance(2), 'closer = higher match')

console.log('analogSearch tests passed', {
  top: results.slice(0, 3).map((r) => ({ year: r.year, dates: `${r.startDate}..${r.endDate}`, m: r.matchStrength })),
})
