# GridSight — AI-Powered Grid Balancing for German TSOs

> Day-ahead renewable generation forecasting with congestion risk detection and economic impact quantification for Germany's four transmission system operators.

**Energy/AI Hackathon Munich 2026**

---

## The Problem

German TSOs spend **EUR 4.2 billion/year** on redispatch measures. Inaccurate renewable generation forecasts force expensive last-minute grid interventions — curtailing wind farms, ramping gas plants, and purchasing emergency balancing energy at 3-5x spot price.

## Our Solution

GridSight uses **LightGBM quantile regression** trained on 5 years of real generation data (SMARD) and weather forecasts (Open-Meteo) to deliver:

- **72-hour ahead** solar and wind generation forecasts per TSO zone
- **Congestion risk alerts** when predicted generation approaches transmission capacity
- **Ramp event detection** identifying critical hour-to-hour generation swings
- **Uncertainty bands** (P10/P50/P90) for risk-aware grid scheduling
- **EUR savings quantification** from reduced imbalance energy procurement

## Key Results

| Metric | Value |
|--------|-------|
| Wind forecast improvement vs persistence | **~60%** lower MAE |
| Solar forecast improvement vs persistence | **~25%** lower MAE |
| Uncertainty band coverage (Q10-Q90) | **80-90%** of actuals captured |
| Estimated annual savings (All Germany) | **EUR 300M+** in reduced redispatch |
| Forecast horizon | **72 hours** ahead |
| Temporal resolution | **Hourly** (15-min actuals available) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GridSight Stack                           │
├──────────────┬──────────────────┬───────────────────────────────┤
│  Data Layer  │   Model Layer    │       Presentation Layer      │
│              │                  │                               │
│  Open-Meteo  │  LightGBM x6    │  React + TanStack Start       │
│  (weather)   │  (solar/wind     │  Interactive TSO map          │
│              │   q10/q50/q90)   │  72h forecast chart           │
│  SMARD       │                  │  Alert feed + KPIs            │
│  (generation)│  Persistence     │  Congestion risk overlay      │
│              │  baseline        │                               │
│  5 years     │                  │  Deployed: Cloudflare Pages   │
│  4 zones     │  Feature eng:    │                               │
│  hourly      │  wind_sin/cos    │                               │
│              │  day_of_year     │                               │
└──────────────┴──────────────────┴───────────────────────────────┘
```

## Project Structure

```
GridSight/
├── data/                          # Data pipeline
│   ├── fetch_weather.py           # Open-Meteo historical + forecast
│   ├── process_somrad.py          # SMARD CSV → hourly parquet
│   ├── merge.py                   # Join weather + generation
│   ├── split.py                   # Time-series train/test split
│   ├── add_features.py            # wind_sin, wind_cos, day_of_year
│   ├── somrad/                    # Raw SMARD CSVs (4 zones)
│   ├── train_final.parquet        # 182,112 rows (Jan 2021 – Mar 2026)
│   ├── test.parquet               # 8,828 rows (Mar – Jun 2026)
│   └── forecast.parquet           # 288 rows (Jun 13–15 2026, weather only)
├── model/                         # ML models
│   ├── train.py                   # LightGBM training script
│   ├── evaluate.py                # Test set evaluation
│   ├── persistence_baseline.py    # Naive baseline (yesterday = today)
│   ├── generate_frontend_data.py  # Compute all frontend JSON from models
│   ├── solar_q10.pkl              # Solar quantile models
│   ├── solar_q50.pkl
│   ├── solar_q90.pkl
│   ├── wind_q10.pkl               # Wind quantile models
│   ├── wind_q50.pkl
│   └── wind_q90.pkl
├── src/                           # Frontend (React + TanStack Start)
│   ├── routes/index.tsx           # Main dashboard UI
│   ├── components/GermanyMap.tsx   # Interactive SVG TSO map
│   ├── lib/mock-data.ts           # Data access layer (typed)
│   ├── lib/grid-data.json         # Generated: all frontend data
│   └── styles.css                 # Tailwind + custom design system
├── vite.config.ts                 # Vite + Nitro (Cloudflare Pages)
├── wrangler.toml                  # Cloudflare deployment config
└── CLAUDE.md                      # AI context document
```

## Data Sources

| Source | Coverage | Resolution | License |
|--------|----------|------------|---------|
| [SMARD](https://smard.de) (Bundesnetzagentur) | Jan 2021 – Jun 2026 | 15-minute | CC BY 4.0 |
| [Open-Meteo](https://open-meteo.com) | Jan 2021 – Jun 2026 + 3-day forecast | Hourly | CC BY 4.0 |

**Grid zones:** 50Hertz, TenneT, Amprion, TransnetBW — 6 weather grid points averaged per zone.

## Models

Two separate model families, each with three quantile variants:

**Solar Model**
- Target: Photovoltaic generation (MWh)
- Key features: shortwave_radiation, diffuse_radiation, cloud_cover, sunshine_duration
- Trained on daylight hours only (shortwave_radiation > 0)

**Wind Model**
- Target: Total wind generation (onshore + offshore, MWh)
- Key features: wind_speed_100m, wind_sin, wind_cos, wind_gusts_10m
- Trained on all 24 hours

Both use `LGBMRegressor` with `objective="quantile"` for α ∈ {0.10, 0.50, 0.90}.

## Quickstart

### Prerequisites

- Python 3.11+
- Node.js 18+

### Backend (data + models)

```bash
python -m venv hackenv
source hackenv/bin/activate
pip install pandas numpy lightgbm scikit-learn joblib pyarrow openmeteo-requests

# Generate frontend data from trained models
python model/generate_frontend_data.py
```

### Frontend

```bash
npm install
npm run dev          # Development server at localhost:3000
npm run build        # Production build (Cloudflare Pages)
```

### Deployment

Deployed on **Cloudflare Pages** with Nitro SSR:

```bash
npm run build
npx wrangler pages deploy dist
```

## TSO Zone Transmission Capacities

| Zone | Installed Renewable (MW) | Offshore Wind |
|------|--------------------------|---------------|
| 50Hertz | 18,000 | Yes |
| TenneT | 35,000 | Yes |
| Amprion | 25,000 | No |
| TransnetBW | 14,000 | No |
| **All Germany** | **92,000** | — |

## Business Model

GridSight targets TSO control rooms and energy trading desks:

1. **SaaS subscription** — Per-zone annual license for forecast API + dashboard
2. **Savings share** — Performance-based pricing tied to measured redispatch reduction
3. **Market expansion** — Portable to any European TSO with public generation data

**TAM:** EUR 4.2B/yr German redispatch market. Even 1% efficiency gain = EUR 42M addressable.

## Team

Energy/AI Hackathon Munich 2026

## License

MIT
