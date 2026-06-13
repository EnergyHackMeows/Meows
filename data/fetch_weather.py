"""
Usage:
  python fetch_weather.py 50Hertz
  python fetch_weather.py TenneT
  python fetch_weather.py Amprion
  python fetch_weather.py TransnetBW
  python fetch_weather.py merge        # combine saved zones into weather.parquet
"""
import sys
import os
import openmeteo_requests
import requests_cache
import pandas as pd
import numpy as np
import time
from retry_requests import retry

ZONES = {
    "50Hertz":    [(54.0, 10.8), (54.0, 14.0), (52.5, 10.8), (52.5, 14.0), (50.8, 10.8), (50.8, 14.0)],
    "TenneT":     [(54.0,  8.5), (54.0, 12.5), (51.5,  8.5), (51.5, 12.5), (48.5,  8.5), (48.5, 12.5)],
    "Amprion":    [(52.0,  6.5), (52.0,  9.0), (50.5,  6.5), (50.5,  9.0), (48.5,  6.5), (48.5,  9.0)],
    "TransnetBW": [(49.3,  7.8), (49.3,  9.8), (48.5,  7.8), (48.5,  9.8), (47.8,  7.8), (47.8,  9.8)],
}

VARIABLES = [
    "shortwave_radiation",
    "direct_radiation",
    "diffuse_radiation",
    "cloud_cover",
    "cloud_cover_low",
    "cloud_cover_mid",
    "sunshine_duration",
    "snow_depth",
    "temperature_2m",
    "wind_speed_10m",
    "wind_speed_100m",
    "wind_direction_100m",
    "wind_gusts_10m",
    "surface_pressure",
]

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

cache_session = requests_cache.CachedSession(os.path.join(DATA_DIR, ".cache_openmeteo"), expire_after=-1)
retry_session = retry(cache_session, retries=3, backoff_factor=0.5)
om = openmeteo_requests.Client(session=retry_session)


def parse_hourly(r):
    hourly = r.Hourly()
    dates = pd.date_range(
        start=pd.to_datetime(hourly.Time(), unit="s", utc=True).tz_convert("Europe/Berlin"),
        end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True).tz_convert("Europe/Berlin"),
        freq=pd.Timedelta(seconds=hourly.Interval()),
        inclusive="left",
    )
    df = {"timestamp": dates}
    for i, var in enumerate(VARIABLES):
        df[var] = hourly.Variables(i).ValuesAsNumpy()
    return pd.DataFrame(df)


def fetch_historical(lat, lon):
    params = {
        "latitude": lat, "longitude": lon,
        "start_date": "2021-01-01", "end_date": "2026-06-12",
        "hourly": VARIABLES, "timezone": "Europe/Berlin",
    }
    return parse_hourly(om.weather_api("https://archive-api.open-meteo.com/v1/archive", params=params)[0])


def fetch_forecast(lat, lon):
    params = {
        "latitude": lat, "longitude": lon,
        "hourly": VARIABLES, "forecast_days": 3, "timezone": "Europe/Berlin",
    }
    return parse_hourly(om.weather_api("https://api.open-meteo.com/v1/forecast", params=params)[0])


def avg_points(dfs):
    base = dfs[0][["timestamp"]].copy()
    for col in VARIABLES:
        base[col] = np.mean([df[col].values for df in dfs], axis=0)
    return base


def fetch_zone(zone):
    points = ZONES[zone]
    out_path = os.path.join(DATA_DIR, f"weather_{zone}.parquet")
    n = len(points)

    print(f"Fetching {zone} ({n * 2} API calls)...")
    point_dfs_hist, point_dfs_fore = [], []

    for i, (lat, lon) in enumerate(points):
        print(f"  [{i*2+1}/{n*2}] historical ({lat}, {lon})")
        point_dfs_hist.append(fetch_historical(lat, lon))
        time.sleep(5)

        print(f"  [{i*2+2}/{n*2}] forecast   ({lat}, {lon})")
        point_dfs_fore.append(fetch_forecast(lat, lon))
        time.sleep(5)

    hist = avg_points(point_dfs_hist)
    fore = avg_points(point_dfs_fore)
    fore = fore[fore["timestamp"] > hist["timestamp"].max()]

    combined = pd.concat([hist, fore], ignore_index=True)
    combined["zone"] = zone
    combined.to_parquet(out_path, index=False)
    print(f"Saved {out_path} — {len(combined)} rows")


def merge_zones():
    dfs = []
    for zone in ZONES:
        path = os.path.join(DATA_DIR, f"weather_{zone}.parquet")
        if not os.path.exists(path):
            print(f"Missing: {path} — run: python fetch_weather.py {zone}")
            continue
        dfs.append(pd.read_parquet(path))

    if not dfs:
        print("No zone files found.")
        return

    weather = pd.concat(dfs, ignore_index=True)
    weather = weather.sort_values(["zone", "timestamp"]).reset_index(drop=True)
    out = os.path.join(DATA_DIR, "weather.parquet")
    weather.to_parquet(out, index=False)
    print(f"Saved {out} — {weather.shape[0]:,} rows across {weather['zone'].nunique()} zones")
    print(weather.groupby("zone").size())


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    arg = sys.argv[1]
    if arg == "merge":
        merge_zones()
    elif arg in ZONES:
        fetch_zone(arg)
    else:
        print(f"Unknown zone: {arg}. Choose from: {list(ZONES.keys())} or 'merge'")
        sys.exit(1)
