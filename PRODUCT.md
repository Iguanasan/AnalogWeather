# Analog Weather — Product Brief (frozen)

Working name: **Analog Weather**

## Problem

People experience a short weather spell (warm week, wet stretch) and often treat it as unique. The historical record is full of **similar episodes** at other times of year and in other years — but that recurrence is hard to see.

## Solution

A public web app: search a **place**, choose **this day / week / month** (trailing 1 / 7 / 30 days), and see past **analog episodes** that **felt similar** — date ranges whose **daily high, overnight low, and precipitation** patterns match closely enough — found by **sliding-window search over each full year**, keeping the **best episode per year**, listed **most recent first** (when it last felt like this).

- **Live mode** defaults to the latest archive day  
- **Explorer mode** allows any past anchor date  
- Share via URL; no login  
- Charts overlay “this spell” vs “that spell”  
- No climate essays in v1 — results speak for themselves  

## Success

You open it when weather feels notable **and** can send a link someone else understands in seconds.

## Non-goals (v1)

- Forecasts / future weather  
- Accounts / social / comments  
- Multi-place compare  
- Severe-weather alerts  
- Native mobile apps  
- Climate-framing copy  
- Multiple episode rows from the same year  

## Domain dictionary (short)

| Term | Definition |
|------|------------|
| Focal episode | Trailing L days ending on the anchor date |
| Analog episode | Past L-day window that matches; primary result |
| Full-year search | Candidates may start any day of the year |
| Best-per-year | One closest episode listed per year |
| Blended score | Combined high + low + precip closeness (0–100); filter ≥ 50 |
| Recency order | Similar spells listed newest first |
| Signed delta | Analog − this spell (° / rain): warmer/cooler, wetter/drier |

See session plan for full discovery log and decisions D1–D14.

## Data

- Geocoding and daily archive: [Open-Meteo](https://open-meteo.com/) (no API key for standard use)  
- Units: auto by place (US customary for US/LR/MM; metric otherwise)  
