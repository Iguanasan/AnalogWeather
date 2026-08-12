import { useEffect } from 'react'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * Standard app About dialog — developer credit and data attribution.
 */
export function AboutDialog({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="about-overlay" role="presentation" onClick={onClose}>
      <div
        className="about-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="about-header">
          <h2 id="about-title" className="about-title">
            About
          </h2>
          <button
            type="button"
            className="icon-btn about-close"
            onClick={onClose}
            aria-label="Close about"
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
                d="M6 6l12 12M18 6L6 18"
              />
            </svg>
          </button>
        </div>

        <div className="about-body">
          <p className="about-app-name">When did it feel like?</p>
          <p className="muted about-version">Version 1.0</p>

          <p>
            A free web app that answers the question:
            <br />
            When did the weather last feel like it feels like it does right now?
          </p>
          <hr className="about-rule" />
          <h3 className="about-section-title">Developer</h3>
          <div className="about-developer">
            <img
              className="about-logo"
              src="/iaidi-logo-sm.png"
              alt=""
              width={96}
              height={96}
            />
            <div>
              <p className="about-dev-name">Glenn Euloth</p>
              <p className="muted">
                Developed by Iguanasan&apos;s AI Dojo Inc.
              </p>
              <p>
                <a
                  href="https://TheAIDojo.ca/"
                  target="_blank"
                  rel="noreferrer"
                >
                  TheAIDojo.ca
                </a>
              </p>
            </div>
          </div>
          <hr className="about-rule" />

          <h3 className="about-section-title">Weather data</h3>
          <p>
            Historical daily weather is provided by{' '}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open-Meteo
            </a>{' '}
            under the{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              Creative Commons Attribution 4.0
            </a>{' '}
            licence.
          </p>
          <hr className="about-rule" />
          <h3 className="about-section-title">Disclaimer</h3>
          <p className="muted about-disclaimer">
            Weather data is provided as-is without warranty. Analog matches are
            statistical similarities in daily highs, lows, and precipitation —
            not forecasts, insurance advice, or climate science essays. Open-Meteo
            and this app&apos;s authors are not liable for decisions made from
            these results.
          </p>
        </div>
      </div>
    </div>
  )
}
