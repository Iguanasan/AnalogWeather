import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  ComposedChart,
} from 'recharts'
import type { AnalogEpisode, Units, WeatherSeries } from '../domain/types'
import { displayPrecip, displayTemp, precipUnitLabel, tempUnitLabel } from '../domain/units'

type Props = {
  focal: WeatherSeries
  analog: AnalogEpisode | null
  units: Units
}

export function OverlayCharts({ focal, analog, units }: Props) {
  const n = focal.tMean.length
  const tempData = Array.from({ length: n }, (_, i) => ({
    day: `Day ${i + 1}`,
    focal: displayTemp(focal.tMean[i]!, units),
    analog: analog ? displayTemp(analog.series.tMean[i]!, units) : undefined,
  }))
  const precipData = Array.from({ length: n }, (_, i) => ({
    day: `Day ${i + 1}`,
    focal: displayPrecip(focal.precip[i]!, units),
    analog: analog ? displayPrecip(analog.series.precip[i]!, units) : undefined,
  }))

  return (
    <div className="charts">
      <div className="chart-card">
        <h3>Temperature ({tempUnitLabel(units)})</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={tempData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
            <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} width={40} />
            <Tooltip
              contentStyle={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="focal"
              name="This spell"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
            {analog && (
              <Line
                type="monotone"
                dataKey="analog"
                name={String(analog.year)}
                stroke="var(--accent-2)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 3 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-card">
        <h3>Precipitation ({precipUnitLabel(units)})</h3>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={precipData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
            <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} width={40} />
            <Tooltip
              contentStyle={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            />
            <Legend />
            <Bar dataKey="focal" name="This spell" fill="var(--accent)" opacity={0.85} />
            {analog && (
              <Bar dataKey="analog" name={String(analog.year)} fill="var(--accent-2)" opacity={0.7} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
