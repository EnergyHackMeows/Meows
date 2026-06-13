"""
Adds wind_sin, wind_cos, day_of_year to train_final, test, and forecast parquets.
"""
import pandas as pd
import numpy as np
from pathlib import Path

D = Path(__file__).parent

files = [D / "train_final.parquet", D / "test.parquet", D / "forecast.parquet"]

for path in files:
    df = pd.read_parquet(path)

    rad = np.deg2rad(df["wind_direction_100m"])
    df["wind_sin"] = np.sin(rad)
    df["wind_cos"] = np.cos(rad)
    df["day_of_year"] = df["timestamp"].dt.dayofyear

    df.to_parquet(path, index=False)
    print(f"{path}: {df.shape}  |  cols added: wind_sin, wind_cos, day_of_year")
    print(f"  wind_sin range: {df.wind_sin.min():.3f} → {df.wind_sin.max():.3f}")
    print(f"  wind_cos range: {df.wind_cos.min():.3f} → {df.wind_cos.max():.3f}")
    print(f"  day_of_year range: {df.day_of_year.min()} → {df.day_of_year.max()}")
    print()
