export type LoadStage = 'locating' | 'history' | 'searching'

type Props = {
  stage: LoadStage
  /** Optional place label for context */
  placeLabel?: string | null
  /**
   * overlay — full-screen (only for cold-start location if needed)
   * banner — compact inline strip while history streams in
   */
  variant?: 'overlay' | 'banner'
  /** 0–1 fill when streaming history */
  progress?: number
  /** e.g. "Loading 1980–1989…" */
  detail?: string | null
}

const COPY: Record<LoadStage, { title: string; line: string }> = {
  locating: {
    title: 'Finding your sky…',
    line: 'Asking the clouds where you are',
  },
  history: {
    title: 'Filling the lake…',
    line: 'Pouring past weather in the background',
  },
  searching: {
    title: 'Reading the ripples…',
    line: 'Matching this spell against past years',
  },
}

function Scene({
  fillClass,
  compact,
}: {
  fillClass: string
  compact?: boolean
}) {
  const w = compact ? 120 : 200
  const h = compact ? 96 : 160
  return (
    <svg
      className="loading-svg"
      viewBox="0 0 200 160"
      width={w}
      height={h}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lakeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.45" />
        </linearGradient>
        <clipPath id="basinClip">
          <path d="M28 118 C40 148, 160 148, 172 118 L172 150 L28 150 Z" />
        </clipPath>
      </defs>

      <path
        className="loading-hills"
        d="M0 120 Q40 95 80 112 T160 108 T200 118 L200 160 L0 160 Z"
      />
      <path
        className="loading-basin"
        d="M28 118 C40 148, 160 148, 172 118"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      <g clipPath="url(#basinClip)">
        <rect
          className={`lake-fill ${fillClass}`}
          x="24"
          y="118"
          width="152"
          height="40"
          fill="url(#lakeGrad)"
        />
        <path
          className="lake-surface"
          d="M24 122 Q60 116 100 122 T176 122"
          fill="none"
          strokeWidth="2"
        />
      </g>

      <g className="loading-cloud">
        <ellipse cx="88" cy="42" rx="28" ry="18" />
        <ellipse cx="112" cy="38" rx="32" ry="22" />
        <ellipse cx="136" cy="44" rx="24" ry="16" />
        <ellipse cx="100" cy="52" rx="40" ry="16" />
      </g>

      <g className="rain-drops">
        <line className="drop d1" x1="90" y1="62" x2="88" y2="78" />
        <line className="drop d2" x1="108" y1="64" x2="106" y2="86" />
        <line className="drop d3" x1="124" y1="62" x2="122" y2="80" />
        <line className="drop d4" x1="98" y1="66" x2="96" y2="90" />
        <line className="drop d5" x1="116" y1="68" x2="114" y2="92" />
        <line className="drop d6" x1="132" y1="66" x2="130" y2="84" />
        <line className="drop d7" x1="84" y1="70" x2="82" y2="88" />
        <line className="drop d8" x1="140" y1="70" x2="138" y2="86" />
      </g>
    </svg>
  )
}

function fillClassFor(stage: LoadStage, progress?: number): string {
  if (typeof progress === 'number' && Number.isFinite(progress)) {
    if (progress < 0.34) return 'lake-fill--low'
    if (progress < 0.72) return 'lake-fill--mid'
    return 'lake-fill--high'
  }
  if (stage === 'locating') return 'lake-fill--low'
  if (stage === 'history') return 'lake-fill--mid'
  return 'lake-fill--high'
}

/**
 * Raining cloud filling a lake — overlay (blocking) or banner (non-blocking).
 */
export function LoadingWeather({
  stage,
  placeLabel,
  variant = 'overlay',
  progress,
  detail,
}: Props) {
  const copy = COPY[stage]
  const fillClass = fillClassFor(stage, progress)
  const pct =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.round(Math.min(1, Math.max(0, progress)) * 100)
      : null

  if (variant === 'banner') {
    return (
      <div
        className="loading-weather-banner"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={detail || copy.title}
      >
        <Scene fillClass={fillClass} compact />
        <div className="loading-banner-copy">
          <strong className="loading-banner-title">{copy.title}</strong>
          <span className="muted loading-banner-detail">
            {detail || copy.line}
            {pct != null ? ` · ${pct}%` : ''}
          </span>
          {placeLabel ? (
            <span className="muted loading-banner-place">{placeLabel}</span>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className="loading-weather"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={copy.title}
    >
      <div className="loading-weather-card">
        <div className="loading-scene">
          <Scene fillClass={fillClass} />
        </div>
        <h2 className="loading-title">{copy.title}</h2>
        <p className="loading-line muted">{detail || copy.line}</p>
        {placeLabel ? (
          <p className="loading-place muted">{placeLabel}</p>
        ) : null}
      </div>
    </div>
  )
}
