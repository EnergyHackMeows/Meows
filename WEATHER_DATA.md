# Germany Weather Data

This folder contains hourly weather data from [Open-Meteo](https://open-meteo.com/) for 24 representative grid points across Germany, aggregated into the four German transmission system operator (TSO) zones.

## Source files

| File | Description |
|------|-------------|
| `germany_24points_2021.csv` … `germany_24points_2026.csv` | Raw Open-Meteo exports (one file per calendar year) |
| `germany_hourly_zone_averages.csv` | Processed output: zone-level hourly averages (generated) |
| `average_zones.py` | Script that builds the processed file |

## Raw CSV structure

Each raw file contains **two sections**:

### 1. Location metadata (lines 1–25)

Header: `location_id,latitude,longitude,elevation,utc_offset_seconds,timezone,timezone_abbreviation`

Maps each `location_id` (0–23) to coordinates. There is a blank line before the hourly table.

### 2. Hourly weather data (from line 27)

Header:

`location_id,time,direct_radiation (W/m²),diffuse_radiation (W/m²),direct_normal_irradiance (W/m²),shortwave_radiation (W/m²),wind_speed_10m (km/h),wind_speed_100m (km/h),wind_direction_100m (°),wind_gusts_10m (km/h),temperature_2m (°C),cloud_cover (%)`

- Timestamps are local (`Europe/Berlin`), ISO format (`YYYY-MM-DDTHH:MM`)
- One row per `location_id` per hour (24 rows per timestamp before aggregation)

## Zone mapping

Points were requested in a fixed order; `location_id` maps to TSO zones as follows:

| `location_id` | Zone | Points (NW → SE) |
|---------------|------|------------------|
| 0–5 | **50Hertz** | 6 sub-regions |
| 6–11 | **TenneT** | 6 sub-regions |
| 12–17 | **Amprion** | 6 sub-regions |
| 18–23 | **TransnetBW** | 6 sub-regions |

Within each zone, the six IDs correspond to northwest, northeast, mid-west, mid-east, southwest, and southeast sample points.

## Processed output

`average_zones.py`:

1. Finds the hourly header in each raw file (skips metadata automatically)
2. Assigns each row to a **Zone** from `location_id`
3. Groups by `time` + `Zone` and computes the **arithmetic mean** of all weather columns across the 6 points
4. Concatenates all years, sorts chronologically, and writes `germany_hourly_zone_averages.csv`

Output columns: `time`, `Zone`, then all weather parameters.

Each `(time, Zone)` pair appears once. Full years yield ~35,040 rows per zone (~140k rows total for 4 zones); partial years (e.g. 2026) contribute fewer rows.

### Note on wind direction

`wind_direction_100m (°)` uses a simple arithmetic mean like the other fields. Wind direction is circular (0° ≈ 360°), so this is an approximation. Use a circular mean if direction accuracy matters for your model.

## Regenerating the processed file

```bash
source hackenv/bin/activate
python average_zones.py
```

Requires **pandas** (already in `hackenv/`).

## Adding new years

1. Export a new file as `germany_24points_YYYY.csv` with the same 24-point layout and column names
2. Re-run `average_zones.py` (it picks up all `germany_24points_*.csv` files automatically)
