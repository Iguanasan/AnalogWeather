import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ARCHIVE_START,
  streamDailyHistory,
  toUserHistoryError,
} from './api/archive'
import { detectCurrentPlace, formatPlaceLabel } from './api/geocode'
import { AnalogList } from './components/AnalogList'
import { LoadingWeather } from './components/LoadingWeather'
import { OverlayCharts } from './components/OverlayCharts'
import { PlaceSearch } from './components/PlaceSearch'
import {
  findAnalogEpisodes,
  findAnalogEpisodesInSlice,
  mergeAnalogEpisodes,
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
  compareIsoDates,
  formatEpisodeRange,
  formatNiceDate,
  minAnchorForLength,
  stepPeriodAnchor,
  windowLabel,
} from './lib/dates'
import { readQueryFromUrl, shareableUrl, writeQueryToUrl } from './lib/urlState'

const LENGTHS: WindowLength[] = [1, 7, 30]
const TOP_N = 24

type AnalogSort = 'date' | 'match'

type StreamStatus = {
  progress: number
  label: string
  done: boolean
}

export default function App() {
  const initial = useMemo(() => readQueryFromUrl(), [])
  const hadPlaceInUrl = Boolean(initial.placeHint)
  const [place, setPlace] = useState<Place | null>(initial.placeHint ?? null)
  const [length, setLength] = useState<WindowLength>(initial.length ?? 7)
  const [anchorDate, setAnchorDate] = useState<string | null>(initial.anchorDate ?? null)
  const [liveMode, setLiveMode] = useState(!initial.anchorDate)

  const [days, setDays] = useState<DailyObservation[] | null>(null)
  const [archiveEnd, setArchiveEnd] = useState<string | null>(null)
  /** True until the first history chunk arrives (or fails). */
  const [awaitingFirstChunk, setAwaitingFirstChunk] = useState(false)
  /** Background archive stream after first paint. */
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null)
  const [historyError, setHistoryError] = useState<{
    title: string
    detail: string
    kind: string
  } | null>(null)
  /** Bump to retry archive load for the same place after an error. */
  const [historyReloadKey, setHistoryReloadKey] = useState(0)
  const [locating, setLocating] = useState(!hadPlaceInUrl)
  const [locationHint, setLocationHint] = useState<string | null>(null)

  const [analogs, setAnalogs] = useState<AnalogEpisode[]>([])
  const [analogSort, setAnalogSort] = useState<AnalogSort>('date')
  const [selected, setSelected] = useState<AnalogEpisode | null>(null)
  const [copied, setCopied] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const liveModeRef = useRef(liveMode)
  const anchorDateRef = useRef(anchorDate)
  const lengthRef = useRef(length)
  const daysRef = useRef(days)
  liveModeRef.current = liveMode
  anchorDateRef.current = anchorDate
  lengthRef.current = length
  daysRef.current = days

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

  const locateUser = useCallback(async (onlyIfEmpty = false) => {
    setLocating(true)
    setLocationHint(null)
    try {
      const p = await detectCurrentPlace()
      setPlace((current) => {
        if (onlyIfEmpty && current) return current
        return p
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setLocationHint(
        (e as Error).message ||
          'Could not detect location — search for a place instead.',
      )
    } finally {
      setLocating(false)
    }
  }, [])

  // Default to the user's current location when the URL has no place.
  useEffect(() => {
    if (hadPlaceInUrl) return
    let active = true
    setLocating(true)
    setLocationHint(null)
    detectCurrentPlace()
      .then((p) => {
        if (!active) return
        setPlace((current) => current ?? p)
      })
      .catch((e) => {
        if (!active || (e as Error).name === 'AbortError') return
        setLocationHint(
          (e as Error).message ||
            'Could not detect location — search for a place instead.',
        )
      })
      .finally(() => {
        if (active) setLocating(false)
      })
    return () => {
      active = false
    }
  }, [hadPlaceInUrl])

  // Progressive history: recent years first, older decades in the background.
  // Score only each new chunk (merge) so we never re-scan all decades on the
  // main thread after every network response — that froze the UI.
  useEffect(() => {
    if (!place) {
      setDays(null)
      setArchiveEnd(null)
      setAnalogs([])
      setSelected(null)
      setStreamStatus(null)
      setAwaitingFirstChunk(false)
      return
    }

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setAwaitingFirstChunk(true)
    setHistoryError(null)
    setDays(null)
    setAnalogs([])
    setSelected(null)
    setStreamStatus({ progress: 0, label: 'historical record', done: false })

    let first = true

    ;(async () => {
      try {
        for await (const update of streamDailyHistory(place, ac.signal)) {
          if (ac.signal.aborted) return

          setDays(update.days)
          setArchiveEnd(update.archiveEnd)
          setStreamStatus({
            progress: update.progress,
            label: update.label,
            done: update.done,
          })

          if (first) {
            first = false
            setAwaitingFirstChunk(false)
            if (liveModeRef.current || !anchorDateRef.current) {
              setAnchorDate(update.archiveEnd)
            }
          }

          // Resolve anchor for this paint (live → archive end)
          const anchor = liveModeRef.current
            ? update.archiveEnd
            : (anchorDateRef.current ?? update.archiveEnd)
          const L = lengthRef.current
          const focalNow = buildFocalFromHistory(update.days, anchor, L)

          if (focalNow && update.newDays.length > 0) {
            const found = findAnalogEpisodesInSlice(
              update.newDays,
              focalNow.series,
              {
                length: L,
                focalStart: focalNow.start,
                focalEnd: focalNow.end,
                topN: TOP_N,
              },
            )
            if (found.length) {
              setAnalogs((prev) => mergeAnalogEpisodes(prev, found, TOP_N))
            }
          }

          if (update.done) {
            setStreamStatus(null)
          }

          // Let the browser paint between updates
          await new Promise<void>((r) => {
            window.setTimeout(r, 0)
          })
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setHistoryError(toUserHistoryError(e))
        setAwaitingFirstChunk(false)
        setStreamStatus(null)
      }
    })()

    return () => ac.abort()
  }, [place, historyReloadKey])

  const focal = useMemo(() => {
    if (!days || !effectiveAnchor) return null
    return buildFocalFromHistory(days, effectiveAnchor, length)
  }, [days, effectiveAnchor, length])

  // Full re-scan only when the user changes window or anchor — not when
  // progressive chunks arrive (those merge in the stream loop above).
  useEffect(() => {
    const d = daysRef.current
    if (!d || !effectiveAnchor) {
      // Place/stream owns clearing while loading; don't wipe mid-stream merges
      // when anchor is briefly unset.
      if (!d) {
        setAnalogs([])
        setSelected(null)
      }
      return
    }
    const f = buildFocalFromHistory(d, effectiveAnchor, length)
    if (!f) {
      setAnalogs([])
      setSelected(null)
      return
    }
    const results = findAnalogEpisodes(d, f.series, {
      length,
      focalStart: f.start,
      focalEnd: f.end,
      topN: TOP_N,
    })
    setAnalogs(results)
  }, [length, effectiveAnchor])

  const sortedAnalogs = useMemo(() => {
    if (analogSort === 'date') return analogs
    return [...analogs].sort((a, b) => {
      if (b.matchStrength !== a.matchStrength) {
        return b.matchStrength - a.matchStrength
      }
      return a.endDate < b.endDate ? 1 : a.endDate > b.endDate ? -1 : 0
    })
  }, [analogs, analogSort])

  useEffect(() => {
    if (sortedAnalogs.length === 0) {
      setSelected(null)
      return
    }
    setSelected((cur) => {
      if (
        cur &&
        sortedAnalogs.some(
          (ep) => ep.year === cur.year && ep.startDate === cur.startDate,
        )
      ) {
        return cur
      }
      return sortedAnalogs[0] ?? null
    })
  }, [sortedAnalogs])

  const onSelectPlace = useCallback((p: Place) => {
    setPlace(p)
  }, [])

  const minAnchor = minAnchorForLength(length)
  const canStepPrev =
    Boolean(place && effectiveAnchor) &&
    compareIsoDates(stepPeriodAnchor(effectiveAnchor!, length, -1), minAnchor) >= 0
  const canStepNext =
    Boolean(place && effectiveAnchor && archiveEnd) &&
    compareIsoDates(effectiveAnchor!, archiveEnd!) < 0

  function stepPeriod(direction: -1 | 1) {
    if (!effectiveAnchor) return
    let next = stepPeriodAnchor(effectiveAnchor, length, direction)
    if (compareIsoDates(next, minAnchor) < 0) next = minAnchor
    if (archiveEnd && compareIsoDates(next, archiveEnd) > 0) next = archiveEnd
    setLiveMode(false)
    setAnchorDate(next)
  }

  const focalStats = focal ? seriesStats(focal.series) : null
  const streaming = Boolean(streamStatus && !streamStatus.done)

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
          <h1>When did it feel like?</h1>
          <p className="tagline">
            Find past spells with temperature and rain like this day, week, or month.
          </p>
        </div>
        <button
          type="button"
          className={`icon-btn share-btn${copied ? ' copied' : ''}`}
          disabled={!place}
          onClick={copyShareLink}
          aria-label={copied ? 'Link copied' : 'Share link'}
          title={copied ? 'Link copied' : 'Copy share link'}
        >
          {copied ? (
            <svg
              className="icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden="true"
            >
              {/* Share-nodes: three dots connected as a graph */}
              <circle cx="18" cy="5" r="2.5" fill="currentColor" />
              <circle cx="6" cy="12" r="2.5" fill="currentColor" />
              <circle cx="18" cy="19" r="2.5" fill="currentColor" />
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                d="M8.4 10.8l7.2-4.6M8.4 13.2l7.2 4.6"
              />
            </svg>
          )}
        </button>
      </header>

      <section className="controls panel">
        <PlaceSearch
          selected={place}
          onSelect={onSelectPlace}
          locating={locating}
          onUseMyLocation={() => locateUser(false)}
        />
        {locationHint && place && (
          <p className="error-text location-hint">{locationHint}</p>
        )}

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

          <div className="anchor-field">
            <label className="field-label" htmlFor="anchor-date">
              {length === 1 ? 'Selected Day' : 'Period Ending'}
            </label>
            <div className="period-nav">
              <button
                type="button"
                className="icon-btn period-step"
                disabled={!canStepPrev}
                onClick={() => stepPeriod(-1)}
                aria-label={
                  length === 1 ? 'Previous day' : 'Previous period'
                }
                title={length === 1 ? 'Previous day' : 'Previous period'}
              >
                <svg
                  className="icon"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 6l-6 6 6 6"
                  />
                </svg>
              </button>
              <input
                id="anchor-date"
                type="date"
                value={effectiveAnchor ?? ''}
                max={archiveEnd ?? undefined}
                min={minAnchor}
                disabled={!place}
                onChange={(e) => {
                  setLiveMode(false)
                  setAnchorDate(e.target.value || null)
                }}
              />
              <button
                type="button"
                className="icon-btn period-step"
                disabled={!canStepNext}
                onClick={() => stepPeriod(1)}
                aria-label={length === 1 ? 'Next day' : 'Next period'}
                title={length === 1 ? 'Next day' : 'Next period'}
              >
                <svg
                  className="icon"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 6l6 6-6 6"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {!place && (
        <section className="panel empty-state">
          {locating ? (
            <LoadingWeather stage="locating" variant="banner" />
          ) : (
            <p>
              Search for a place to see which past spells look most like recent
              weather there.
              {locationHint ? (
                <>
                  {' '}
                  <span className="error-text">{locationHint}</span>
                </>
              ) : null}
            </p>
          )}
        </section>
      )}

      {place && (
        <>
          {(awaitingFirstChunk || streaming) && !historyError && (
            <LoadingWeather
              stage="history"
              variant="banner"
              progress={streamStatus?.progress ?? 0.15}
              detail="Collecting historical weather from the open archive… this can take a moment."
              placeLabel={formatPlaceLabel(place)}
            />
          )}

          {historyError && (
            <section
              className={`panel history-error-panel${
                historyError.kind === 'rate_limit' ? ' history-error-panel--rate' : ''
              }`}
              role="alert"
            >
              <h2 className="history-error-title">{historyError.title}</h2>
              <p className="history-error-detail">{historyError.detail}</p>
              {historyError.kind === 'rate_limit' && (
                <p className="muted history-error-hint">
                  Tip: waiting a couple of minutes usually works. We only ask the
                  free archive once per place and remember the result afterward.
                </p>
              )}
              <button
                type="button"
                className="secondary-btn history-error-retry"
                onClick={() => {
                  setHistoryError(null)
                  setHistoryReloadKey((k) => k + 1)
                }}
              >
                Try again
              </button>
            </section>
          )}

          <section className="panel status-bar">
            <div className="status-place">
              <strong>{formatPlaceLabel(place)}</strong>
              {archiveEnd && (
                <span className="muted status-archive">
                  {' '}
                  - (
                  {formatNiceDate(days?.[0]?.date ?? ARCHIVE_START)}
                  {' to '}
                  {formatNiceDate(archiveEnd)}
                  ) - All available data from{' '}
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open-Meteo
                  </a>
                  .
                </span>
              )}
              {streaming && (
                <span className="muted">
                  {' '}
                  Loading the historical record…
                </span>
              )}
            </div>
          </section>

          {focal && focalStats && (
            <section className="panel focal-panel">
              <div className="focal-header">
                <h2>{windowLabel(length)}</h2>
                <span className="muted">
                  {formatEpisodeRange(focal.start, focal.end)}
                </span>
              </div>
              <p className="muted section-help focal-help">
                Matched on daily highs, overnight lows, and rain — so hot days
                and nights that don&apos;t cool off compare like for like.
              </p>
              <div className="stat-row">
                <div className="stat">
                  <span className="stat-label">Avg high</span>
                  <span className="stat-value">
                    {formatTemp(focalStats.avgHigh, units, 1)}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Avg low</span>
                  <span className="stat-value">
                    {formatTemp(focalStats.avgLow, units, 1)}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Total precip</span>
                  <span className="stat-value">
                    {formatPrecip(focalStats.totalPrecip, units, 1)}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Similar spells</span>
                  <span className="stat-value">{analogs.length}</span>
                </div>
              </div>
            </section>
          )}

          {focal && (
            <section className="results-layout">
              <div className="panel">
                <div className="panel-heading">
                  <h2 className="section-title">When it felt like this</h2>
                  <div className="sort-toggle">
                    <span className="field-label sort-toggle-label" id="sort-label">
                      Sort
                    </span>
                    <div
                      className="segmented sort-segmented"
                      role="group"
                      aria-labelledby="sort-label"
                    >
                      <button
                        type="button"
                        className={analogSort === 'date' ? 'active' : ''}
                        onClick={() => setAnalogSort('date')}
                        aria-pressed={analogSort === 'date'}
                      >
                        Date
                      </button>
                      <button
                        type="button"
                        className={analogSort === 'match' ? 'active' : ''}
                        onClick={() => setAnalogSort('match')}
                        aria-pressed={analogSort === 'match'}
                      >
                        Match
                      </button>
                    </div>
                  </div>
                </div>
                <p className="muted section-help">
                  {analogSort === 'date'
                    ? 'Most recent first'
                    : 'Strongest match first'}{' '}
                  · one spell per year · only if close enough (score ≥ 50). +/−
                  is warmer/cooler or wetter/drier than this spell.
                  {streaming
                    ? ' Older years keep arriving in the background.'
                    : ''}
                </p>
                <AnalogList
                  analogs={sortedAnalogs}
                  focal={focal.series}
                  selectedYear={selected?.year ?? null}
                  onSelect={setSelected}
                  units={units}
                />
              </div>
              <div className="panel">
                <h2 className="section-title">
                  {selected
                    ? `This spell vs ${selected.year}`
                    : 'Overlay'}
                </h2>
                {selected && (
                  <p className="muted section-help">
                    {formatEpisodeRange(selected.startDate, selected.endDate)} ·
                    close {selected.matchStrength.toFixed(0)}
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

          {place &&
            !awaitingFirstChunk &&
            !focal &&
            !historyError &&
            days && (
            <section className="panel">
              <p className="error-text">
                {streaming
                  ? 'Still loading older years for this date…'
                  : 'Not enough complete daily data for this window ending on the selected date. Try a later anchor or a shorter window.'}
              </p>
            </section>
          )}
        </>
      )}

      <section className="panel credit-panel" aria-label="Credits">
        <img
          className="credit-logo"
          src="/iaidi-logo-sm.png"
          alt="Iguanasan's AI Dojo Inc."
          width={160}
          height={160}
        />
        <p className="credit-text">
          Developed by Iguanasan&apos;s AI Dojo Inc.
        </p>
      </section>
    </div>
  )
}
