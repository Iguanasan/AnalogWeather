import type { AtmosphereId } from '../domain/atmosphere'

interface Props {
  atmosphere: AtmosphereId
}

/**
 * Full-screen SVG weather background scene.
 * Renders rich vector scenery (snowy fields, rainy hills, storm clouds, sunbeams)
 * with animated weather overlays (falling snow, rain streaks, drifting clouds).
 */
export function WeatherBackground({ atmosphere }: Props) {
  return (
    <div className="weather-bg-container" data-atmosphere={atmosphere} aria-hidden="true">
      {atmosphere === 'snow' && <SnowScene />}
      {atmosphere === 'rain' && <RainScene />}
      {atmosphere === 'storm' && <StormScene />}
      {atmosphere === 'heat' && <HeatScene />}
      {atmosphere === 'cold' && <ColdScene />}
      {atmosphere === 'fair' && <FairScene />}
    </div>
  )
}

function SnowScene() {
  return (
    <svg
      className="weather-bg-svg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="snow-sky-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dce8f2" />
          <stop offset="60%" stopColor="#eae4d8" />
          <stop offset="100%" stopColor="#f3efe6" />
        </linearGradient>
        <linearGradient id="snow-sky-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#121e2b" />
          <stop offset="60%" stopColor="#1c1b20" />
          <stop offset="100%" stopColor="#20242d" />
        </linearGradient>
        <linearGradient id="snow-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--snow-hill-top, #f4f8fb)" />
          <stop offset="100%" stopColor="var(--snow-hill-bot, #d5e2ed)" />
        </linearGradient>
      </defs>

      {/* Layered snow hills horizon */}
      <path
        d="M-100 900 L-100 680 Q 250 600, 600 690 T 1300 640 Q 1500 620, 1600 670 L 1600 900 Z"
        fill="url(#snow-hill)"
        opacity="0.65"
      />
      <path
        d="M-100 900 L-100 730 Q 350 670, 800 750 T 1600 720 L 1600 900 Z"
        fill="url(#snow-hill)"
        opacity="0.9"
      />

      {/* Pine tree silhouettes on winter hills */}
      <g className="winter-trees" opacity="0.45">
        <polygon points="120,730 135,680 150,730" fill="var(--tree-color)" />
        <polygon points="123,700 135,660 147,700" fill="var(--tree-color)" />
        <polygon points="280,750 295,695 310,750" fill="var(--tree-color)" />
        <polygon points="283,720 295,675 307,720" fill="var(--tree-color)" />
        <polygon points="1180,720 1195,660 1210,720" fill="var(--tree-color)" />
        <polygon points="1183,690 1195,640 1207,690" fill="var(--tree-color)" />
        <polygon points="1320,740 1335,685 1350,740" fill="var(--tree-color)" />
      </g>

      {/* Animated falling snowflakes */}
      <g className="snowflakes">
        {SNOWFLAKES.map((sf, i) => (
          <circle
            key={i}
            cx={sf.cx}
            cy={sf.cy}
            r={sf.r}
            className={`snowflake sf-delay-${i % 8}`}
            fill="var(--flake-color)"
            opacity={sf.opacity}
          />
        ))}
      </g>
    </svg>
  )
}

function RainScene() {
  return (
    <svg
      className="weather-bg-svg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Overcast rain clouds & hills */}
      <path
        d="M-50 -50 L 1490 -50 L 1490 200 Q 1200 320 800 240 T 0 280 Z"
        fill="var(--rain-cloud-fill)"
        opacity="0.35"
      />
      <path
        d="M-100 900 L-100 700 Q 400 640, 900 730 T 1600 690 L 1600 900 Z"
        fill="var(--rain-hill-fill)"
        opacity="0.5"
      />

      {/* Animated rain drop lines */}
      <g className="rain-drops">
        {RAINDROPS.map((rd, i) => (
          <line
            key={i}
            x1={rd.x}
            y1={rd.y}
            x2={rd.x - 12}
            y2={rd.y + 40}
            stroke="var(--rain-line-color)"
            strokeWidth={rd.w}
            strokeLinecap="round"
            className={`raindrop rd-delay-${i % 7}`}
            opacity={rd.opacity}
          />
        ))}
      </g>
    </svg>
  )
}

function StormScene() {
  return (
    <svg
      className="weather-bg-svg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Dramatic storm clouds */}
      <path
        d="M-50 -50 L 1490 -50 L 1490 320 Q 1100 420 700 310 T -50 360 Z"
        fill="var(--storm-cloud-fill)"
        opacity="0.55"
      />
      <path
        d="M-100 900 L-100 720 Q 500 650, 950 740 T 1600 710 L 1600 900 Z"
        fill="var(--storm-hill-fill)"
        opacity="0.65"
      />

      {/* Heavy rain streaks */}
      <g className="rain-drops storm-rain">
        {RAINDROPS.concat(RAINDROPS).map((rd, i) => (
          <line
            key={i}
            x1={rd.x + (i % 2 === 0 ? 15 : -10)}
            y1={rd.y}
            x2={rd.x - 22}
            y2={rd.y + 55}
            stroke="var(--storm-line-color)"
            strokeWidth={rd.w + 0.4}
            strokeLinecap="round"
            className={`raindrop rd-delay-${i % 5}`}
            opacity={rd.opacity + 0.15}
          />
        ))}
      </g>
    </svg>
  )
}

function HeatScene() {
  return (
    <svg
      className="weather-bg-svg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="sun-glow" cx="80%" cy="15%" r="60%">
          <stop offset="0%" stopColor="var(--sun-glow-core)" stopOpacity="0.45" />
          <stop offset="40%" stopColor="var(--sun-glow-outer)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sun radiant disk & atmosphere glow */}
      <rect width="1440" height="900" fill="url(#sun-glow)" />
      <circle cx="1150" cy="130" r="140" fill="var(--sun-disk-color)" opacity="0.25" />

      {/* Sunbaked rolling dunes silhouette */}
      <path
        d="M-100 900 L-100 720 Q 300 660, 750 740 T 1600 680 L 1600 900 Z"
        fill="var(--heat-dune-fill)"
        opacity="0.45"
      />
    </svg>
  )
}

function ColdScene() {
  return (
    <svg
      className="weather-bg-svg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Frosted mountain ridges silhouette */}
      <path
        d="M-50 900 L150 620 L320 710 L580 580 L790 680 L1080 540 L1280 660 L1500 590 L1500 900 Z"
        fill="var(--cold-mountain-fill)"
        opacity="0.3"
      />
      <path
        d="M-50 900 L250 710 L520 660 L820 730 L1150 670 L1500 740 L1500 900 Z"
        fill="var(--cold-mountain-fill-front)"
        opacity="0.45"
      />
    </svg>
  )
}

function FairScene() {
  return (
    <svg
      className="weather-bg-svg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Gentle rolling countryside hills */}
      <path
        d="M-100 900 L-100 710 Q 350 630, 800 720 T 1600 670 L 1600 900 Z"
        fill="var(--fair-hill-fill)"
        opacity="0.35"
      />

      {/* Floating soft clouds */}
      <g className="fair-clouds" opacity="0.3">
        <path
          className="cloud cloud-1"
          d="M 120 180 Q 140 140 190 150 Q 230 130 270 160 Q 300 160 310 190 Q 320 220 280 230 L 120 230 Z"
          fill="var(--fair-cloud-color)"
        />
        <path
          className="cloud cloud-2"
          d="M 850 120 Q 870 90 910 100 Q 940 80 980 105 Q 1010 105 1020 130 Q 1030 155 990 165 L 850 165 Z"
          fill="var(--fair-cloud-color)"
        />
      </g>
    </svg>
  )
}

// Preset particle coordinates for smooth performance
const SNOWFLAKES = [
  { cx: 120, cy: 80, r: 4, opacity: 0.8 },
  { cx: 280, cy: 220, r: 6, opacity: 0.9 },
  { cx: 450, cy: 110, r: 3.5, opacity: 0.7 },
  { cx: 620, cy: 310, r: 5, opacity: 0.85 },
  { cx: 780, cy: 140, r: 4, opacity: 0.75 },
  { cx: 940, cy: 260, r: 6.5, opacity: 0.9 },
  { cx: 1100, cy: 90, r: 3, opacity: 0.65 },
  { cx: 1260, cy: 210, r: 5, opacity: 0.8 },
  { cx: 1380, cy: 340, r: 4.5, opacity: 0.75 },
  { cx: 190, cy: 450, r: 5.5, opacity: 0.85 },
  { cx: 360, cy: 520, r: 3.5, opacity: 0.7 },
  { cx: 530, cy: 410, r: 6, opacity: 0.9 },
  { cx: 710, cy: 560, r: 4, opacity: 0.8 },
  { cx: 880, cy: 430, r: 5, opacity: 0.85 },
  { cx: 1040, cy: 590, r: 3.5, opacity: 0.7 },
  { cx: 1210, cy: 480, r: 6, opacity: 0.9 },
]

const RAINDROPS = [
  { x: 100, y: 50, w: 1.5, opacity: 0.6 },
  { x: 240, y: 180, w: 2, opacity: 0.75 },
  { x: 380, y: 90, w: 1.5, opacity: 0.5 },
  { x: 520, y: 260, w: 2.2, opacity: 0.8 },
  { x: 670, y: 120, w: 1.8, opacity: 0.65 },
  { x: 810, y: 310, w: 2, opacity: 0.75 },
  { x: 960, y: 80, w: 1.5, opacity: 0.55 },
  { x: 1110, y: 220, w: 2.2, opacity: 0.8 },
  { x: 1250, y: 140, w: 1.8, opacity: 0.7 },
  { x: 1390, y: 290, w: 1.5, opacity: 0.6 },
  { x: 180, y: 440, w: 2, opacity: 0.75 },
  { x: 430, y: 510, w: 1.6, opacity: 0.65 },
  { x: 740, y: 470, w: 2.2, opacity: 0.8 },
  { x: 1020, y: 530, w: 1.8, opacity: 0.7 },
  { x: 1300, y: 490, w: 2, opacity: 0.75 },
]
