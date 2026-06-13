"""
Builds persistence baseline predictions (same hour yesterday).

Outputs:
  model/test_persistence.parquet      — test rows + persistence_solar, persistence_wind_total
  model/forecast_persistence.parquet  — Jun 13-15 + persistence_solar, persistence_wind_total
                                        (Jun 12 actuals used for all 3 forecast days)
"""
import pandas as pd
from pathlib import Path

DATA  = Path(__file__).parent.parent / "data"
MODEL = Path(__file__).parent

train = pd.read_parquet(DATA / "train_final.parquet")
test  = pd.read_parquet(DATA / "test.parquet")

# --- Test persistence ---
# Shift lookup source back 24h: join test on (zone, timestamp-24h) against train+test actuals
source = pd.concat([train, test], ignore_index=True)[["zone", "timestamp", "solar", "wind_total"]]
source = source.drop_duplicates(["zone", "timestamp"])

test_lookup = test[["zone", "timestamp"]].copy()
test_lookup["lookup_ts"] = test_lookup["timestamp"] - pd.Timedelta(hours=24)

test_persistence = (
    test_lookup
    .merge(source.rename(columns={"timestamp": "lookup_ts",
                                  "solar": "persistence_solar",
                                  "wind_total": "persistence_wind_total"}),
           on=["zone", "lookup_ts"], how="left")
    .drop(columns="lookup_ts")
    .merge(test, on=["zone", "timestamp"])
)

# DST gap fix: Mar 30 02:00 doesn't exist the day before — use 03:00 instead
dst_mask = test_persistence["persistence_solar"].isna()
if dst_mask.any():
    dst_rows = test_persistence[dst_mask][["zone", "timestamp"]].copy()
    dst_rows["lookup_ts"] = dst_rows["timestamp"] - pd.Timedelta(hours=23)  # use 03:00 previous day
    dst_fix = dst_rows.merge(
        source.rename(columns={"timestamp": "lookup_ts",
                               "solar": "persistence_solar",
                               "wind_total": "persistence_wind_total"}),
        on=["zone", "lookup_ts"], how="left"
    ).drop(columns="lookup_ts")
    for _, row in dst_fix.iterrows():
        mask = (test_persistence["zone"] == row["zone"]) & (test_persistence["timestamp"] == row["timestamp"])
        test_persistence.loc[mask, "persistence_solar"]       = row["persistence_solar"]
        test_persistence.loc[mask, "persistence_wind_total"]  = row["persistence_wind_total"]

test_persistence.to_parquet(MODEL / "test_persistence.parquet", index=False)
missing = test_persistence["persistence_solar"].isna().sum()
print(f"test_persistence.parquet    : {len(test_persistence):,} rows  |  missing: {missing}")

# --- Forecast persistence (Jun 12 actuals for all 3 forecast days) ---
forecast = pd.read_parquet(DATA / "forecast.parquet")

jun12 = test[test["timestamp"].dt.date == pd.Timestamp("2026-06-12").date()][
    ["zone", "hour", "solar", "wind_total"]
].rename(columns={"solar": "persistence_solar", "wind_total": "persistence_wind_total"})

forecast_persistence = forecast.merge(jun12, on=["zone", "hour"], how="left")
forecast_persistence.to_parquet(MODEL / "forecast_persistence.parquet", index=False)
print(f"forecast_persistence.parquet: {len(forecast_persistence):,} rows")

# Sanity check
print("\nSample — 50Hertz first 5 test rows:")
cols = ["timestamp", "zone", "solar", "wind_total", "persistence_solar", "persistence_wind_total"]
print(test_persistence[test_persistence.zone == "50Hertz"][cols].head(5).to_string(index=False))
