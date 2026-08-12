import type { AnalogEpisode, Units, WeatherSeries } from '../domain/types'
import {
  formatPrecip,
  formatSignedPrecipDelta,
  formatSignedTempDelta,
  formatTemp,
} from '../domain/units'
import { formatEpisodeRange } from '../lib/dates'
import { MIN_MATCH_STRENGTH, seriesDeltas, seriesStats } from '../domain/analogSearch'

type Props = {
  analogs: AnalogEpisode[]
  /** Focal spell — used for signed warmer/cooler/wetter deltas. */
  focal: WeatherSeries
  selectedYear: number | null
  onSelect: (episode: AnalogEpisode) => void
  units: Units
}

export function AnalogList({
  analogs,
  focal,
  selectedYear,
  onSelect,
  units,
}: Props) {
  if (analogs.length === 0) {
    return (
      <p className="muted">
        No past spells reached the similarity bar (match ≥ {MIN_MATCH_STRENGTH}
        ). Try a different place or window.
      </p>
    )
  }

  return (
    <ol className="analog-list">
      {analogs.map((ep, rank) => {
        const stats = seriesStats(ep.series)
        const delta = seriesDeltas(ep.series, focal)
        const active = ep.year === selectedYear
        return (
          <li key={`${ep.year}-${ep.startDate}`}>
            <button
              type="button"
              className={`analog-card${active ? ' active' : ''}`}
              onClick={() => onSelect(ep)}
              aria-pressed={active}
            >
              <div className="analog-rank">#{rank + 1}</div>
              <div className="analog-main">
                <div className="analog-title">
                  <strong>{ep.year}</strong>
                  <span className="muted">
                    {formatEpisodeRange(ep.startDate, ep.endDate)}
                  </span>
                </div>
                <div className="analog-meta">
                  <span>
                    High {formatTemp(stats.avgHigh, units, 1)}{' '}
                    <span
                      className={deltaClass(delta.highDelta)}
                      title="vs this spell (positive = warmer)"
                    >
                      ({formatSignedTempDelta(delta.highDelta, units, 1)})
                    </span>
                    {' · '}
                    Low {formatTemp(stats.avgLow, units, 1)}{' '}
                    <span
                      className={deltaClass(delta.lowDelta)}
                      title="vs this spell (positive = warmer nights)"
                    >
                      ({formatSignedTempDelta(delta.lowDelta, units, 1)})
                    </span>
                  </span>
                  <span>
                    Precip {formatPrecip(stats.totalPrecip, units, 1)}{' '}
                    <span
                      className={deltaClass(delta.precipDelta)}
                      title="vs this spell (positive = wetter)"
                    >
                      ({formatSignedPrecipDelta(delta.precipDelta, units, 1)})
                    </span>
                  </span>
                </div>
              </div>
              <div
                className="analog-score"
                title={`How close overall (0–100). Distance ${ep.distance.toFixed(3)}`}
              >
                <span className="score-value">{ep.matchStrength.toFixed(0)}</span>
                <span className="score-label">close</span>
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function deltaClass(delta: number): string {
  if (delta > 0.05) return 'delta-pos'
  if (delta < -0.05) return 'delta-neg'
  return 'delta-zero'
}
