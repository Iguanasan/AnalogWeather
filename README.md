# Analog Weather

Find past weather **spells** whose temperature and precipitation look like **this day / week / month** at any place.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build   # production build (Workers-ready assets)
npm run preview # preview build in the Workers runtime
npm run deploy  # build + deploy to Cloudflare Workers
```

## Deploy (Cloudflare Workers)

This app is a static SPA packaged for [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/) via the [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/).

1. Install deps: `npm install`
2. Log in once: `npx wrangler login`
3. Deploy: `npm run deploy`

Config lives in `wrangler.jsonc` (`not_found_handling: single-page-application` so client routes and shared URLs work).

## What it does

1. Search a place (Open-Meteo geocoding)  
2. Choose window: this day (1), week (7), or month (30 trailing days)  
3. Live mode uses the latest archive day; Explorer picks any past anchor  
4. Ranks **analog episodes**: full-year sliding search, best match per year  
5. Overlay charts + shareable URL  

Product definition: [PRODUCT.md](./PRODUCT.md)

## Stack

- Vite + React + TypeScript  
- Recharts  
- Open-Meteo Archive + Geocoding APIs  
- Cloudflare Workers (static assets + Wrangler)  
