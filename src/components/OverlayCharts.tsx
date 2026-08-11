import { useEffect, useState } from 'react'
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

function useNarrowViewport(maxWidth = 640): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${maxWidth}px)`).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [maxWidth])

  return narrow
}

export function OverlayCharts({ focal, analog, units }: Props) {
  const narrow = useNarrowViewport()
  const n = focal.tMean.length
  const tempData = Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    label: narrow ? String(i + 1) : `Day ${i + 1}`,
    focal: displayTemp(focal.tMean[i]!, units),
    analog: analog ? displayTemp(analog.series.tMean[i]!, units) : undefined,
  }))
  const precipData = Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    label: narrow ? String(i + 1) : `Day ${i + 1}`,
    focal: displayPrecip(focal.precip[i]!, units),
    analog: analog ? displayPrecip(analog.series.precip[i]!, units) : undefined,
  }))

  const chartHeight = narrow ? 190 : 220
  const tickFont = narrow ? 10 : 12
  const yAxisWidth = narrow ? 32 : 40
  const margin = narrow
    ? { top: 4, right: 4, left: -8, bottom: 0 }
    : { top: 8, right: 12, left: 0, bottom: 0 }
  // Avoid cramming every day label on week/month windows
  const xInterval = n <= 7 ? 0 : n <= 14 ? 1 : Math.ceil(n / (narrow ? 5 : 7)) - 1

  return (
    <div className="charts">
      <div className="chart-card">
        <h3>Temperature ({tempUnitLabel(units)})</h3>
        <div className="chart-frame" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tempData} margin={margin}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis
                dataKey="label"
                interval={xInterval}
                tick={{ fill: 'var(--muted)', fontSize: tickFont }}
                tickMargin={4}
              />
              <YAxis
                tick={{ fill: 'var(--muted)', fontSize: tickFont }}
                width={yAxisWidth}
                tickCount={narrow ? 5 : undefined}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: narrow ? 12 : 14,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: narrow ? 12 : 14 }}
                iconSize={narrow ? 10 : 14}
              />
              <Line
                type="monotone"
                dataKey="focal"
                name="This spell"
                stroke="var(--accent)"
                strokeWidth={2.5}
                dot={n <= 7 ? { r: 3 } : false}
                activeDot={{ r: 4 }}
              />
              {analog && (
                <Line
                  type="monotone"
                  dataKey="analog"
                  name={String(analog.year)}
                  stroke="var(--accent-2)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={n <= 7 ? { r: 3 } : false}
                  activeDot={{ r: 4 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="chart-card">
        <h3>Precipitation ({precipUnitLabel(units)})</h3>
        <div className="chart-frame" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={precipData} margin={margin}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis
                dataKey="label"
                interval={xInterval}
                tick={{ fill: 'var(--muted)', fontSize: tickFont }}
                tickMargin={4}
              />
              <YAxis
                tick={{ fill: 'var(--muted)', fontSize: tickFont }}
                width={yAxisWidth}
                tickCount={narrow ? 5 : undefined}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: narrow ? 12 : 14,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: narrow ? 12 : 14 }}
                iconSize={narrow ? 10 : 14}
              />
              <Bar dataKey="focal" name="This spell" fill="var(--accent)" opacity={0.85} />
              {analog && (
                <Bar dataKey="analog" name={String(analog.year)} fill="var(--accent-2)" opacity={0.7} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
