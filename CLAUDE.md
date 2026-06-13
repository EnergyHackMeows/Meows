
# Renewable Generation Forecast — Energy/AI Hackathon Munich

Day-ahead forecasting system predicting hourly solar and wind generation for Germany's four grid zones (50Hertz, TenneT, Amprion, TransnetBW) using weather forecasts as input, with uncertainty bands and a live Streamlit web app.

**The one question this tool answers:**
> "Tomorrow, hour by hour — how much solar and wind will each part of Germany produce?"

---

## Project structure

```
renewable/
├── CLAUDE.md
├── data/                         # All data pipeline scripts and parquet files
│   ├── fetch_weather.py          # Pulls Open-Meteo weather data per zone
│   ├── process_somrad.py         # Parses SMARD CSVs (15-min) → hourly parquet
│   ├── merge.py                  # Joins weather + somrad → train.parquet + forecast.parquet
│   ├── split.py                  # Splits train.parquet → train_final.parquet + test.parquet
│   ├── add_features.py           # Adds wind_sin, wind_cos, day_of_year
│   ├── somrad/                   # Raw SMARD CSVs (15-min generation data)
│   │   ├── 50Hertz_01_01_2021-06_13_2026.csv
│   │   ├── Ampiron_01_01_2021-06_13_2026.csv   ← note: typo in filename, zone is Amprion
│   │   ├── TenneT_01_01_2021-06_13_2026.csv
│   │   └── TransnetBW_01_01_2021-06_13_2026.csv
│   ├── train_final.parquet       # Training data: Jan 1 2021 → Mar 12 2026 (182,112 rows, 28 cols)
│   ├── test.parquet              # Test data: Mar 13 → Jun 12 2026 (8,828 rows, 28 cols)
│   ├── forecast.parquet          # Forecast input: Jun 13–15 2026, weather only (288 rows, 24 cols)
│   └── train.parquet             # Full merged data before split (190,940 rows)
├── model/                        # Model training scripts and saved models (to be built)
└── src/                          # Frontend (existing Vite/TypeScript app from repo)
```

All scripts in `data/` use `Path(__file__).parent` for file paths — run them from any directory.

Intermediate files (ignored by git): `weather_*.parquet`, `weather.parquet`, `somrad.parquet`, `weather_forecast_holdout.parquet`, `somrad_forecast_holdout.parquet`

---

## Data

### Weather features (from Open-Meteo)
Hourly historical (2021–2026) + 3-day forecast. 6 grid points averaged per zone.

| Column | Description | Unit |
|---|---|---|
| `timestamp` | Hour start, Europe/Berlin timezone (tz-stripped for joins) | datetime |
| `zone` | Grid zone: 50Hertz / TenneT / Amprion / TransnetBW | string |
| `shortwave_radiation` | Global horizontal irradiance | W/m² |
| `direct_radiation` | Direct normal irradiance | W/m² |
| `diffuse_radiation` | Diffuse horizontal irradiance | W/m² |
| `cloud_cover` | Total cloud cover | % |
| `cloud_cover_low` | Low-level cloud cover | % |
| `cloud_cover_mid` | Mid-level cloud cover | % |
| `sunshine_duration` | Sunshine duration per hour | seconds (0–3600) |
| `snow_depth` | Snow depth (nulls filled with 0) | m |
| `temperature_2m` | Air temperature at 2m | °C |
| `wind_speed_10m` | Wind speed at 10m | km/h |
| `wind_speed_100m` | Wind speed at 100m (hub height) | km/h |
| `wind_direction_100m` | Wind direction at 100m | degrees |
| `wind_gusts_10m` | Wind gusts at 10m | km/h |
| `surface_pressure` | Surface pressure | hPa |
| `year` | Extracted from timestamp | int |
| `month` | Extracted from timestamp | int (1–12) |
| `day` | Extracted from timestamp | int (1–31) |
| `hour` | Extracted from timestamp | int (0–23) |
| `day_of_week` | Extracted from timestamp | int (0=Mon, 6=Sun) |

**TODO:** Add `wind_sin` = sin(wind_direction_100m in radians) and `wind_cos` = cos(wind_direction_100m in radians). Raw wind direction degrees breaks at the 0°/360° boundary (359° and 1° are adjacent but numerically far apart). Sin/cos encoding fixes this.

**TODO:** Add `day_of_year` feature (1–365).

### Generation targets (from SMARD)
15-min data resampled to hourly (sum of 4 slots). Source: smard.de, CC BY 4.0.

| Column | Description | Unit |
|---|---|---|
| `solar` | Photovoltaic generation | MWh |
| `wind_onshore` | Onshore wind generation | MWh |
| `wind_offshore` | Offshore wind generation (0 for Amprion + TransnetBW — landlocked) | MWh |
| `wind_total` | wind_onshore + wind_offshore | MWh |

### Grid zone coverage

| Zone | Offshore wind | Nuclear | Lignite |
|---|---|---|---|
| 50Hertz | Yes | No | Yes |
| TenneT | Yes | Yes | Yes |
| Amprion | No | Yes | Yes |
| TransnetBW | No | Yes | No |

### Grid points used for weather averaging (lat, lon)

| Zone | Points |
|---|---|
| 50Hertz | (54.0,10.8) (54.0,14.0) (52.5,10.8) (52.5,14.0) (50.8,10.8) (50.8,14.0) |
| TenneT | (54.0,8.5) (54.0,12.5) (51.5,8.5) (51.5,12.5) (48.5,8.5) (48.5,12.5) |
| Amprion | (52.0,6.5) (52.0,9.0) (50.5,6.5) (50.5,9.0) (48.5,6.5) (48.5,9.0) |
| TransnetBW | (49.3,7.8) (49.3,9.8) (48.5,7.8) (48.5,9.8) (47.8,7.8) (47.8,9.8) |

---

## Train/test split

**Never random-split time series — always split by time.**

| File | Range | Rows |
|---|---|---|
| `train_final.parquet` | Jan 1 2021 → Mar 12 2026 | 182,112 |
| `test.parquet` | Mar 13 2026 → Jun 12 2026 | 8,828 |
| `forecast.parquet` | Jun 13–15 2026 (weather only, no targets) | 288 |

---

## Models

Two separate XGBoost regressors:

**Solar model**
- Target: `solar`
- Key features: `shortwave_radiation`, `diffuse_radiation`, `cloud_cover`, `sunshine_duration`, `hour`, `month`, `day_of_year`, `zone`
- Filter training to daylight hours only (`shortwave_radiation > 0`) — solar is always 0 at night

**Wind model**
- Target: `wind_total`
- Key features: `wind_speed_100m`, `wind_sin`, `wind_cos`, `wind_gusts_10m`, `temperature_2m`, `hour`, `month`, `zone`
- Train on all 24 hours

**Uncertainty bands** — train 3 versions of each model with quantile regression:
- `objective="reg:quantileerror"`, `quantile_alpha=0.10` → lower bound
- `objective="reg:quantileerror"`, `quantile_alpha=0.50` → median prediction
- `objective="reg:quantileerror"`, `quantile_alpha=0.90` → upper bound

---

## Persistence baseline

For each hour: prediction = actual value from same hour the previous day.
Implement this first. Everything is measured against it.
Target: at least 15% lower MAE than persistence.

---

## Evaluation metrics

- **Primary:** MAE (Mean Absolute Error) in MWh
- **Secondary:** RMSE
- Report both for model AND persistence baseline per zone and overall
- Show a good day and a hard day honestly in charts

---

## Web app (Streamlit)

Four screens:
1. **Metric cards** — peak solar, peak wind, total renewables next 24h, accuracy vs baseline
2. **Main forecast chart** — hourly solar (orange) + wind (blue) with uncertainty bands, persistence baseline (dashed gray) overlaid
3. **Model vs baseline panel** — MAE, RMSE, % improvement, % actuals within uncertainty bands
4. **Feature importance** — which weather variables drive the forecast

User controls: zone dropdown (50Hertz / TenneT / Amprion / TransnetBW / All Germany), view (solar / wind / both)

---

## Tech stack

| Component | Tool |
|---|---|
| Language | Python 3.11+ |
| Data | pandas, numpy |
| Weather API | openmeteo-requests |
| Models | xgboost, scikit-learn |
| Web app | Streamlit |
| Charts | Plotly |
| Data format | Parquet (pyarrow) |

```
pip install openmeteo-requests xgboost scikit-learn streamlit plotly pandas numpy pyarrow
```

---

## Build order

1. ✅ Weather data pipeline (`fetch_weather.py`)
2. ✅ SMARD processing (`process_somrad.py`)
3. ✅ Merge + split (`merge.py`, `split.py`)
4. ✅ Add `wind_sin`, `wind_cos`, `day_of_year` features (`data/add_features.py`)
5. ⬜ Persistence baseline — MAE + RMSE
6. ⬜ Solar XGBoost model
7. ⬜ Wind XGBoost model
8. ⬜ Quantile regression for uncertainty bands
9. ⬜ Evaluation: model vs baseline per zone
10. ⬜ Streamlit app with Plotly charts
11. ⬜ Connect live Open-Meteo forecast for tomorrow's prediction
