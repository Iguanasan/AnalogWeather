import type { AnalogEpisode, Units } from '../domain/types'
import { formatPrecip, formatTemp } from '../domain/units'
import { formatEpisodeRange } from '../lib/dates'
import { seriesStats } from '../domain/analogSearch'

type Props = {
  analogs: AnalogEpisode[]
  selectedYear: number | null
  onSelect: (episode: AnalogEpisode) => void
  units: Units
}

export function AnalogList({ analogs, selectedYear, onSelect, units }: Props) {
  if (analogs.length === 0) {
    return <p className="muted">No analog episodes found for this history.</p>
  }

  return (
    <ol className="analog-list">
      {analogs.map((ep, rank) => {
        const stats = seriesStats(ep.series)
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
                  <span className="muted">{formatEpisodeRange(ep.startDate, ep.endDate)}</span>
                </div>
                <div className="analog-meta">
                  <span>Avg {formatTemp(stats.avgTemp, units, 1)}</span>
                  <span>Precip {formatPrecip(stats.totalPrecip, units, 1)}</span>
                </div>
              </div>
              <div className="analog-score" title={`Distance ${ep.distance.toFixed(3)}`}>
                <span className="score-value">{ep.matchStrength.toFixed(1)}</span>
                <span className="score-label">match</span>
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
