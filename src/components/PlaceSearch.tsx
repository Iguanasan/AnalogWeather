import { useEffect, useId, useRef, useState } from 'react'
import { formatPlaceLabel, searchPlaces } from '../api/geocode'
import type { Place } from '../domain/types'

type Props = {
  selected: Place | null
  onSelect: (place: Place) => void
}

export function PlaceSearch({ selected, onSelect }: Props) {
  const listId = useId()
  const [text, setText] = useState(selected ? formatPlaceLabel(selected) : '')
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (selected) setText(formatPlaceLabel(selected))
  }, [selected])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  function onChange(value: string) {
    setText(value)
    setError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      try {
        const places = await searchPlaces(value, ac.signal)
        setResults(places)
        setOpen(true)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setError('Could not search places')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 280)
  }

  function pick(place: Place) {
    onSelect(place)
    setText(formatPlaceLabel(place))
    setOpen(false)
    setResults([])
  }

  return (
    <div className="place-search">
      <label className="field-label" htmlFor="place-input">
        Place
      </label>
      <div className="place-search-row">
        <input
          id="place-input"
          type="search"
          autoComplete="off"
          placeholder="Search city or place…"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {loading && <span className="muted spinner-hint">Searching…</span>}
      </div>
      {error && <p className="error-text">{error}</p>}
      {open && results.length > 0 && (
        <ul id={listId} className="place-results" role="listbox">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" role="option" onClick={() => pick(p)}>
                {formatPlaceLabel(p)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
