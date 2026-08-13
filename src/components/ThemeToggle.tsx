import { useEffect, useState } from 'react'
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  toggleTheme,
  type Theme,
} from '../lib/theme'

function YinYangIcon() {
  return (
    <svg
      className="icon theme-yin-yang"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
    >
      {/* Light fish uses the button face so the mark sits in the control */}
      <circle cx="12" cy="12" r="10" fill="var(--panel-2)" />
      <path
        fill="currentColor"
        d="M12 2a5 5 0 0 0 0 10 5 5 0 0 1 0 10 10 10 0 0 1 0-20z"
      />
      <circle cx="12" cy="7" r="1.55" fill="var(--panel-2)" />
      <circle cx="12" cy="17" r="1.55" fill="currentColor" />
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
      />
    </svg>
  )
}

/**
 * Light/dark toggle — yin/yang, same idea as euloth.com:
 * dark-on-light becomes light-on-dark.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Follow the OS only until the user picks a side.
  useEffect(() => {
    if (readStoredTheme()) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setTheme(resolveTheme(null))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const next = toggleTheme(theme)
  const label = next === 'light' ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={() => {
        const updated = toggleTheme(theme)
        persistTheme(updated)
        setTheme(updated)
      }}
      aria-label={label}
      title={label}
    >
      <YinYangIcon />
    </button>
  )
}
