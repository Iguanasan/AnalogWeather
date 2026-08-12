/** Comparison window length L in days: day / week / month. */
export type WindowLength = 1 | 7 | 30

export type Place = {
  id: string
  name: string
  admin1?: string
  country: string
  countryCode: string
  latitude: number
  longitude: number
  timezone?: string
}

export type DailyObservation = {
  /** ISO date YYYY-MM-DD in the place's local calendar. */
  date: string
  /** Mean temperature °C (archive native). */
  tMean: number | null
  tMax: number | null
  tMin: number | null
  /** Precipitation total mm. */
  precip: number | null
}

export type WeatherSeries = {
  dates: string[]
  /** Daily high °C (what people remember as “the day”). */
  tMax: number[]
  /** Daily low °C (whether nights cool off). */
  tMin: number[]
  /** 24h mean °C (kept for secondary stats). */
  tMean: number[]
  precip: number[]
}

/** The trailing L-day spell the user is asking about. */
export type FocalEpisode = {
  place: Place
  anchorDate: string
  length: WindowLength
  series: WeatherSeries
}

/** A past L-day window that closely matches the focal episode. */
export type AnalogEpisode = {
  year: number
  startDate: string
  endDate: string
  series: WeatherSeries
  /** Lower is closer (blended channel distance). */
  distance: number
  /** 0–100 display score; higher is closer. */
  matchStrength: number
  /** Daytime heat similarity (daily max RMSE °C). */
  tempHighRmse: number
  /** Night-time cool-down similarity (daily min RMSE °C). */
  tempLowRmse: number
  precipRmse: number
}

export type Units = {
  temperature: 'C' | 'F'
  precip: 'mm' | 'in'
}

export type AppQuery = {
  place: Place | null
  length: WindowLength
  /** null = live mode (latest available day). */
  anchorDate: string | null
}
