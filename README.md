# Analog Weather

Find past weather **spells** whose temperature and precipitation look like **this day / week / month** at any place.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build   # production build
npm run preview # preview production build
```

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
