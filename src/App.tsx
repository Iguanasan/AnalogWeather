import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchDailyHistory } from './api/archive'
import { formatPlaceLabel } from './api/geocode'
import { AnalogList } from './components/AnalogList'
import { OverlayCharts } from './components/OverlayCharts'
import { PlaceSearch } from './components/PlaceSearch'
import {
  findAnalogEpisodes,
  seriesStats,
} from './domain/analogSearch'
import type {
  AnalogEpisode,
  AppQuery,
  DailyObservation,
  Place,
  WindowLength,
} from './domain/types'
import { formatPrecip, formatTemp, unitsForPlace } from './domain/units'
import {
  buildFocalFromHistory,
  formatEpisodeRange,
  formatNiceDate,
  windowLabel,
} from './lib/dates'
import { readQueryFromUrl, shareableUrl, writeQueryToUrl } from './lib/urlState'

const LENGTHS: WindowLength[] = [1, 7, 30]

export default function App() {
  const initial = useMemo(() => readQueryFromUrl(), [])
  const [place, setPlace] = useState<Place | null>(initial.placeHint ?? null)
  const [length, setLength] = useState<WindowLength>(initial.length ?? 7)
  const [anchorDate, setAnchorDate] = useState<string | null>(initial.anchorDate ?? null)
  const [liveMode, setLiveMode] = useState(!initial.anchorDate)

  const [days, setDays] = useState<DailyObservation[] | null>(null)
  const [archiveEnd, setArchiveEnd] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [analogs, setAnalogs] = useState<AnalogEpisode[]>([])
  const [selected, setSelected] = useState<AnalogEpisode | null>(null)
  const [computing, setComputing] = useState(false)
  const [copied, setCopied] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const effectiveAnchor = liveMode ? archiveEnd : anchorDate
  const units = unitsForPlace(place)

  const query: AppQuery = useMemo(
    () => ({
      place,
      length,
      anchorDate: liveMode ? null : anchorDate,
    }),
    [place, length, liveMode, anchorDate],
  )

  useEffect(() => {
    writeQueryToUrl(query, true)
  }, [query])

  // Load history when place changes
  useEffect(() => {
    if (!place) {
      setDays(null)
      setArchiveEnd(null)
      setAnalogs([])
      setSelected(null)
      return
    }

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoadingHistory(true)
    setHistoryError(null)
    setDays(null)
    setAnalogs([])
    setSelected(null)

    fetchDailyHistory(place, ac.signal)
      .then(({ days: d, endDate }) => {
        setDays(d)
        setArchiveEnd(endDate)
        if (liveMode || !anchorDate) {
          setAnchorDate(endDate)
        }
      })
      .catch((e) => {
        if ((e as Error).name === 'AbortError') return
        setHistoryError((e as Error).message || 'Failed to load history')
      })
      .finally(() => setLoadingHistory(false))

    return () => ac.abort()
  }, [place]) // eslint-disable-line react-hooks/exhaustive-deps -- reload only on place change

  const focal = useMemo(() => {
    if (!days || !effectiveAnchor) return null
    return buildFocalFromHistory(days, effectiveAnchor, length)
  }, [days, effectiveAnchor, length])

  // Run analog search when focal/history ready
  useEffect(() => {
    if (!days || !focal) {
      setAnalogs([])
      setSelected(null)
      return
    }
    setComputing(true)
    // Yield so UI can paint loading state
    const handle = window.setTimeout(() => {
      try {
        const results = findAnalogEpisodes(days, focal.series, {
          length,
          focalStart: focal.start,
          focalEnd: focal.end,
          topN: 12,
        })
        setAnalogs(results)
        setSelected(results[0] ?? null)
      } finally {
        setComputing(false)
      }
    }, 10)
    return () => window.clearTimeout(handle)
  }, [days, focal, length])

  const onSelectPlace = useCallback((p: Place) => {
    setPlace(p)
  }, [])

  const focalStats = focal ? seriesStats(focal.series) : null

  async function copyShareLink() {
    const url = shareableUrl(query)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="brand">
          <h1>Analog Weather</h1>
          <p className="tagline">
            Find past spells with temperature and rain like this day, week, or month.
          </p>
        </div>
      </header>

      <section className="controls panel">
        <PlaceSearch selected={place} onSelect={onSelectPlace} />

        <div className="control-grid">
          <div>
            <span className="field-label">Window</span>
            <div className="segmented" role="group" aria-label="Comparison window">
              {LENGTHS.map((L) => (
                <button
                  key={L}
                  type="button"
                  className={length === L ? 'active' : ''}
                  onClick={() => setLength(L)}
                >
                  {windowLabel(L)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="field-label">Mode</span>
            <div className="segmented" role="group" aria-label="Anchor mode">
              <button
                type="button"
                className={liveMode ? 'active' : ''}
                onClick={() => {
                  setLiveMode(true)
                  if (archiveEnd) setAnchorDate(archiveEnd)
                }}
              >
                Live
              </button>
              <button
                type="button"
                className={!liveMode ? 'active' : ''}
                onClick={() => setLiveMode(false)}
              >
                Explorer
              </button>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="anchor-date">
              Anchor date
            </label>
            <input
              id="anchor-date"
              type="date"
              value={effectiveAnchor ?? ''}
              max={archiveEnd ?? undefined}
              min="1940-01-01"
              disabled={liveMode || !place}
              onChange={(e) => {
                setLiveMode(false)
                setAnchorDate(e.target.value || null)
              }}
            />
          </div>

          <div className="share-wrap">
            <span className="field-label">Share</span>
            <button
              type="button"
              className="secondary-btn"
              disabled={!place}
              onClick={copyShareLink}
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      </section>

      {!place && (
        <section className="panel empty-state">
          <p>Search for a place to see which past spells look most like recent weather there.</p>
        </section>
      )}

      {place && (
        <>
          <section className="panel status-bar">
            <div>
              <strong>{formatPlaceLabel(place)}</strong>
              {archiveEnd && (
                <span className="muted">
                  {' '}
                  · archive through {formatNiceDate(archiveEnd)}
                </span>
              )}
            </div>
            {(loadingHistory || computing) && (
              <span className="muted">
                {loadingHistory ? 'Loading history…' : 'Finding closest spells…'}
              </span>
            )}
            {historyError && <p className="error-text">{historyError}</p>}
          </section>

          {focal && focalStats && !loadingHistory && (
            <section className="panel focal-panel">
              <div className="focal-header">
                <h2>{windowLabel(length)}</h2>
                <span className="muted">
                  {formatEpisodeRange(focal.start, focal.end)}
                </span>
              </div>
              <div className="stat-row">
                <div className="stat">
                  <span className="stat-label">Avg temp</span>
                  <span className="stat-value">
                    {formatTemp(focalStats.avgTemp, units, 1)}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Total precip</span>
                  <span className="stat-value">
                    {formatPrecip(focalStats.totalPrecip, units, 1)}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Closest matches</span>
                  <span className="stat-value">{analogs.length}</span>
                </div>
              </div>
            </section>
          )}

          {focal && !loadingHistory && (
            <section className="results-layout">
              <div className="panel">
                <h2 className="section-title">Closest spells</h2>
                <p className="muted section-help">
                  Best match per year anywhere in that year. Select a row to overlay charts.
                </p>
                {computing ? (
                  <p className="muted">Searching the record…</p>
                ) : (
                  <AnalogList
                    analogs={analogs}
                    selectedYear={selected?.year ?? null}
                    onSelect={setSelected}
                    units={units}
                  />
                )}
              </div>
              <div className="panel">
                <h2 className="section-title">
                  {selected
                    ? `This spell vs ${selected.year}`
                    : 'Overlay'}
                </h2>
                {selected && (
                  <p className="muted section-help">
                    {formatEpisodeRange(selected.startDate, selected.endDate)} · match{' '}
                    {selected.matchStrength.toFixed(1)}
                  </p>
                )}
                <OverlayCharts
                  focal={focal.series}
                  analog={selected}
                  units={units}
                />
              </div>
            </section>
          )}

          {place && !loadingHistory && !focal && !historyError && (
            <section className="panel">
              <p className="error-text">
                Not enough complete daily data for this window ending on the selected date.
                Try a later anchor or a shorter window.
              </p>
            </section>
          )}
        </>
      )}

      <footer className="footer muted">
        <p>
          Daily history via{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          . Temperature and precipitation only. No accounts.
        </p>
      </footer>
    </div>
  )
}
