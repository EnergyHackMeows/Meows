"""
Merges weather + somrad on [timestamp, zone] → train.parquet and forecast.parquet
"""
import pandas as pd

def merge_train(weather_path, somrad_path, out_path):
    w = pd.read_parquet(weather_path)
    s = pd.read_parquet(somrad_path)
    w["timestamp"] = w["timestamp"].dt.tz_localize(None)
    merged = pd.merge(w, s, on=["timestamp", "zone"], how="inner")
    merged = merged.sort_values(["zone", "timestamp"]).reset_index(drop=True)
    merged.to_parquet(out_path, index=False)
    print(f"Saved {out_path} — {merged.shape[0]:,} rows x {merged.shape[1]} cols")
    print(f"  Range : {merged.timestamp.min()} → {merged.timestamp.max()}")
    print(f"  Zones : {merged.zone.unique().tolist()}\n")


def prep_forecast(weather_path, out_path):
    w = pd.read_parquet(weather_path)
    w["timestamp"] = w["timestamp"].dt.tz_localize(None)
    w = w.sort_values(["zone", "timestamp"]).reset_index(drop=True)
    w.to_parquet(out_path, index=False)
    print(f"Saved {out_path} — {w.shape[0]:,} rows x {w.shape[1]} cols")
    print(f"  Range : {w.timestamp.min()} → {w.timestamp.max()}")
    print(f"  Zones : {w.zone.unique().tolist()}\n")


merge_train("weather.parquet", "somrad.parquet", "train.parquet")
prep_forecast("weather_forecast_holdout.parquet", "forecast.parquet")
