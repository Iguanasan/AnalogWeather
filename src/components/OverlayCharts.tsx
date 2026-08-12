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
  const n = focal.tMax.length
  const year = analog ? String(analog.year) : ''
  const tempData = Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    label: narrow ? String(i + 1) : `Day ${i + 1}`,
    thisHigh: displayTemp(focal.tMax[i]!, units),
    thisLow: displayTemp(focal.tMin[i]!, units),
    analogHigh: analog
      ? displayTemp(analog.series.tMax[i]!, units)
      : undefined,
    analogLow: analog
      ? displayTemp(analog.series.tMin[i]!, units)
      : undefined,
  }))
  const precipData = Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    label: narrow ? String(i + 1) : `Day ${i + 1}`,
    focal: displayPrecip(focal.precip[i]!, units),
    analog: analog ? displayPrecip(analog.series.precip[i]!, units) : undefined,
  }))

  const chartHeight = narrow ? 210 : 240
  const tickFont = narrow ? 10 : 12
  const yAxisWidth = narrow ? 32 : 40
  const margin = narrow
    ? { top: 4, right: 4, left: -8, bottom: 0 }
    : { top: 8, right: 12, left: 0, bottom: 0 }
  // Avoid cramming every day label on week/month windows
  const xInterval = n <= 7 ? 0 : n <= 14 ? 1 : Math.ceil(n / (narrow ? 5 : 7)) - 1
  const showDots = n <= 7

  return (
    <div className="charts">
      <div className="chart-card">
        <h3>Highs &amp; lows ({tempUnitLabel(units)})</h3>
        <p className="muted chart-subhelp">
          Upper lines = daytime high · lower lines = overnight low
        </p>
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
                wrapperStyle={{ fontSize: narrow ? 11 : 13 }}
                iconSize={narrow ? 10 : 14}
              />
              <Line
                type="monotone"
                dataKey="thisHigh"
                name="This high"
                stroke="var(--accent)"
                strokeWidth={2.5}
                dot={showDots ? { r: 3 } : false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="thisLow"
                name="This low"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={showDots ? { r: 2 } : false}
                activeDot={{ r: 4 }}
              />
              {analog && (
                <>
                  <Line
                    type="monotone"
                    dataKey="analogHigh"
                    name={`${year} high`}
                    stroke="var(--accent-2)"
                    strokeWidth={2}
                    dot={showDots ? { r: 3 } : false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="analogLow"
                    name={`${year} low`}
                    stroke="var(--accent-2)"
                    strokeWidth={1.75}
                    strokeDasharray="4 3"
                    dot={showDots ? { r: 2 } : false}
                    activeDot={{ r: 4 }}
                  />
                </>
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
