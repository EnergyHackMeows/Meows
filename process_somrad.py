"""
Parses somrad CSVs (15-min generation data) → hourly parquet.

Output columns: timestamp, zone, solar, wind_onshore, wind_offshore, wind_total
Timestamps are floored to the hour to match weather.parquet.
"""
import pandas as pd

ZONE_FILES = {
    "50Hertz":    "somrad/50Hertz_01_01_2021-06_13_2026.csv",
    "Amprion":    "somrad/Ampiron_01_01_2021-06_13_2026.csv",
    "TenneT":     "somrad/TenneT_01_01_2021-06_13_2026.csv",
    "TransnetBW": "somrad/TransnetBW_01_01_2021-06_13_2026.csv",
}

COL_MAP = {
    "Start date":                                       "start",
    "Photovoltaics [MWh] Original resolutions":         "solar",
    "Wind onshore [MWh] Original resolutions":          "wind_onshore",
    "Wind offshore [MWh] Original resolutions":         "wind_offshore",
}


def parse_zone(zone, path):
    df = pd.read_csv(path, sep=";", low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    df = df.rename(columns=COL_MAP)

    df["start"] = pd.to_datetime(df["start"], format="%b %d, %Y %I:%M %p", errors="coerce")
    df = df.dropna(subset=["start"])

    for col in ["solar", "wind_onshore", "wind_offshore"]:
        if col in df.columns:
            df[col] = pd.to_numeric(
                df[col].astype(str).str.replace(",", ""), errors="coerce"
            )
        else:
            df[col] = 0.0

    df["timestamp"] = df["start"].dt.floor("h")

    hourly = (
        df.groupby("timestamp")[["solar", "wind_onshore", "wind_offshore"]]
        .sum()
        .reset_index()
    )
    hourly["wind_total"] = hourly["wind_onshore"] + hourly["wind_offshore"]
    hourly["zone"] = zone
    return hourly


dfs = []
for zone, path in ZONE_FILES.items():
    hourly = parse_zone(zone, path)
    print(f"{zone}: {len(hourly)} hourly rows  |  "
          f"solar={hourly.solar.sum():,.0f} MWh  "
          f"wind_total={hourly.wind_total.sum():,.0f} MWh")
    dfs.append(hourly)

result = pd.concat(dfs, ignore_index=True)
result = result[["timestamp", "zone", "solar", "wind_onshore", "wind_offshore", "wind_total"]]
result = result.sort_values(["zone", "timestamp"]).reset_index(drop=True)

# Split holdout (Jun 13–15 2026) from training (Jan 1 2021 – Jun 12 2026)
TRAIN_START = pd.Timestamp("2021-01-01")
TRAIN_END   = pd.Timestamp("2026-06-12 23:00:00")
HOLDOUT_START = pd.Timestamp("2026-06-13")
HOLDOUT_END   = pd.Timestamp("2026-06-15 23:00:00")

train   = result[(result["timestamp"] >= TRAIN_START) & (result["timestamp"] <= TRAIN_END)].reset_index(drop=True)
holdout = result[(result["timestamp"] >= HOLDOUT_START) & (result["timestamp"] <= HOLDOUT_END)].reset_index(drop=True)

train.to_parquet("somrad.parquet", index=False)
holdout.to_parquet("somrad_forecast_holdout.parquet", index=False)

print(f"\nSaved somrad.parquet               — {len(train):,} rows  ({train.timestamp.min()} → {train.timestamp.max()})")
print(f"Saved somrad_forecast_holdout.parquet — {len(holdout):,} rows  ({holdout.timestamp.min()} → {holdout.timestamp.max()})")
print(train.head(5).to_string())
