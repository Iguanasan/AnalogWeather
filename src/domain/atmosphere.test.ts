import { classifyAtmosphere, getAtmosphereMeta } from './atmosphere.ts'
import type { WeatherSeries } from './types.ts'

function series(
  days: { high: number; low: number; precip: number }[],
): WeatherSeries {
  return {
    dates: days.map((_, i) => `2020-06-${String(i + 1).padStart(2, '0')}`),
    tMax: days.map((d) => d.high),
    tMin: days.map((d) => d.low),
    tMean: days.map((d) => (d.high + d.low) / 2),
    precip: days.map((d) => d.precip),
  }
}

function repeat(
  n: number,
  day: { high: number; low: number; precip: number },
) {
  return Array.from({ length: n }, () => day)
}

console.assert(
  classifyAtmosphere(
    series([
      { high: 14, low: 8, precip: 6 },
      { high: 13, low: 7, precip: 4 },
      { high: 15, low: 9, precip: 5 },
      { high: 14, low: 8, precip: 3 },
      { high: 12, low: 7, precip: 5 },
      { high: 13, low: 8, precip: 2 },
      { high: 14, low: 8, precip: 0 },
    ]),
  ) === 'rain',
  'Seattle-like wet week is rain, not storm',
)

console.assert(
  classifyAtmosphere(series(repeat(7, { high: 40, low: 26, precip: 0 }))) ===
    'heat',
  'Phoenix-like hot dry week is heat',
)

console.assert(
  classifyAtmosphere(
    series([
      { high: -1, low: -8, precip: 4 },
      { high: 0, low: -7, precip: 6 },
      { high: 1, low: -6, precip: 3 },
      { high: -2, low: -9, precip: 2 },
      { high: 0, low: -5, precip: 0 },
      { high: 2, low: -4, precip: 0 },
      { high: 1, low: -6, precip: 0 },
    ]),
  ) === 'snow',
  'wintry wet week is snow',
)

console.assert(
  classifyAtmosphere(
    series([
      { high: 12, low: 6, precip: 40 },
      { high: 13, low: 7, precip: 8 },
      ...repeat(5, { high: 14, low: 8, precip: 0 }),
    ]),
  ) === 'storm',
  'a big dump in an otherwise quiet week is storm',
)

console.assert(
  classifyAtmosphere(series([{ high: 18, low: 10, precip: 8 }])) === 'rain',
  'a single 8 mm day is rain, not storm',
)

console.assert(
  classifyAtmosphere(series([{ high: 16, low: 11, precip: 28 }])) === 'storm',
  'a single 28 mm day is storm',
)

console.assert(
  classifyAtmosphere(series(repeat(7, { high: 22, low: 12, precip: 0 }))) ===
    'fair',
  'mild dry week is fair',
)

console.assert(
  classifyAtmosphere(
    series([
      { high: 22, low: 12, precip: 2 },
      ...repeat(6, { high: 21, low: 11, precip: 0 }),
    ]),
  ) === 'fair',
  'a trace shower in a mild week stays fair',
)

console.assert(
  classifyAtmosphere(series(repeat(7, { high: 2, low: -8, precip: 0 }))) ===
    'cold',
  'dry winter week is cold, not snow',
)

console.assert(
  classifyAtmosphere(
    series([
      { high: 32, low: 21, precip: 3 },
      ...repeat(6, { high: 33, low: 22, precip: 0 }),
    ]),
  ) === 'heat',
  'hot week with a light shower stays heat',
)

console.assert(classifyAtmosphere(series([])) === 'fair', 'empty series is fair')
console.assert(getAtmosphereMeta('rain').label === 'Rainy spell', 'meta label matches')
console.assert(getAtmosphereMeta('rain').icon === '🌧️', 'meta icon matches')

console.log('atmosphere tests passed')
