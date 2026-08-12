import {
  findAnalogEpisodes,
  matchStrengthFromDistance,
  seriesDeltas,
} from './analogSearch'
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

// Focal: warm week like July pattern (base 20 → July ~35)
const focalDays = yearDays(2020, 20, 5).filter((d) => d.date.startsWith('2020-07')).slice(0, 7)
const focal = {
  dates: focalDays.map((d) => d.date),
  tMax: focalDays.map((d) => d.tMax!),
  tMin: focalDays.map((d) => d.tMin!),
  tMean: focalDays.map((d) => d.tMean!),
  precip: focalDays.map((d) => d.precip!),
}

const historyWithFocal = [
  ...yearDays(2010, 5, 0), // cold — should fail cutoff
  ...yearDays(2011, 20, 5), // warm match
  ...yearDays(2012, 6, 0.5), // cold — fail
  ...yearDays(2015, 20, 5), // warm match (newer than 2011)
  ...yearDays(2018, 20.5, 5.5), // warm match, slightly warmer/wetter
  ...yearDays(2020, 20, 5), // focal year
]

const results = findAnalogEpisodes(historyWithFocal, focal, {
  length: 7,
  focalStart: '2020-07-01',
  focalEnd: '2020-07-07',
  topN: 10,
})

console.assert(results.length >= 2, `should find several analogs, got ${results.length}`)
console.assert(
  results[0]!.year === 2018,
  `expected most recent (2018) first, got ${results[0]?.year}`,
)
console.assert(
  results.every((r, i) => i === 0 || results[i - 1]!.endDate >= r.endDate),
  'should be sorted newest-first by endDate',
)
console.assert(
  !results.some((r) => r.year === 2010 || r.year === 2012),
  'cold years should fail similarity cutoff',
)
console.assert(
  results.every((r) => r.matchStrength >= 50),
  'all results should meet default min match strength',
)
console.assert(
  !results.some((r) => r.startDate >= '2020-07-01' && r.endDate <= '2020-07-07'),
  'should not include overlapping focal window as self',
)
console.assert(matchStrengthFromDistance(0) > matchStrengthFromDistance(2), 'closer = higher match')

// Signed deltas: 2018 is slightly warmer base → positive high/low delta vs focal
const y2018 = results.find((r) => r.year === 2018)!
const deltas = seriesDeltas(y2018.series, focal)
console.assert(deltas.highDelta > 0, '2018 should be slightly warmer (positive high delta)')

const strict = findAnalogEpisodes(historyWithFocal, focal, {
  length: 7,
  focalStart: '2020-07-01',
  focalEnd: '2020-07-07',
  minMatchStrength: 99.5,
})
console.assert(strict.length <= results.length, 'stricter cutoff returns fewer or equal')

console.log('analogSearch tests passed', {
  top: results.slice(0, 5).map((r) => ({
    year: r.year,
    dates: `${r.startDate}..${r.endDate}`,
    m: r.matchStrength,
  })),
  delta2018: deltas,
})