"""
Generates the complete data payload for the GridSight frontend from real
model predictions and SMARD actuals.

Multi-timeframe data:
  - 15min: Raw SMARD 15-min data (last 4 hours actuals + model extrapolation)
  - 1h: Hourly model forecast (Jun 13-15 2026, 72 hours)
  - 1day: Daily aggregates from test set (last 30 days of actuals + 3 days forecast)
  - 1week: Weekly aggregates from the test set (Mar-Jun 2026)
  - 1month: Monthly aggregates from full training data (2021-2026)
  - 1year: Yearly aggregates from full training data

Also exports:
  - Model performance metrics (real, from test set evaluation)
  - Feature importance (real, from trained LightGBM models)
  - Per-zone breakdown
  - Forecast vs actuals comparisons
"""
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
MODEL = ROOT / "model"
OUT = ROOT / "src" / "lib"

SOLAR_FEATURES = [
    "shortwave_radiation", "diffuse_radiation", "cloud_cover",
    "sunshine_duration", "hour", "month", "day_of_year", "zone",
]
WIND_FEATURES = [
    "wind_speed_100m", "wind_speed_100m_sq", "wind_sin", "wind_cos",
    "wind_gusts_10m", "temperature_2m", "hour", "month", "zone",
]
ZONES = ["50Hertz", "TenneT", "Amprion", "TransnetBW"]


def prep_X(df, features):
    X = df[features].copy()
    X["zone"] = X["zone"].astype("category")
    return X


def predict(model, X):
    return np.clip(model.predict(X), 0, None)


def mae(y_true, y_pred):
    return float(np.mean(np.abs(y_true - y_pred)))


def rmse(y_true, y_pred):
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def coverage(y_true, lower, upper):
    return float(np.mean((y_true >= lower) & (y_true <= upper)) * 100)


print("Loading data...")
train = pd.read_parquet(DATA / "train_final.parquet")
test = pd.read_parquet(DATA / "test.parquet")
forecast = pd.read_parquet(DATA / "forecast.parquet")
test_persist = pd.read_parquet(MODEL / "test_persistence.parquet")
forecast_persist = pd.read_parquet(MODEL / "forecast_persistence.parquet")

for df in [train, test, forecast]:
    df["wind_speed_100m_sq"] = df["wind_speed_100m"] ** 2

print("Loading models...")
solar_q10 = joblib.load(MODEL / "solar_q10.pkl")
solar_q50 = joblib.load(MODEL / "solar_q50.pkl")
solar_q90 = joblib.load(MODEL / "solar_q90.pkl")
wind_q10 = joblib.load(MODEL / "wind_q10.pkl")
wind_q50 = joblib.load(MODEL / "wind_q50.pkl")
wind_q90 = joblib.load(MODEL / "wind_q90.pkl")

# ============================================================================
# 1. MODEL PERFORMANCE METRICS (from test set)
# ============================================================================
print("Computing metrics...")

X_solar_test = prep_X(test, SOLAR_FEATURES)
X_wind_test = prep_X(test, WIND_FEATURES)

test["solar_q50"] = predict(solar_q50, X_solar_test)
test["solar_q10"] = predict(solar_q10, X_solar_test)
test["solar_q90"] = predict(solar_q90, X_solar_test)
test["wind_q50"] = predict(wind_q50, X_wind_test)
test["wind_q10"] = predict(wind_q10, X_wind_test)
test["wind_q90"] = predict(wind_q90, X_wind_test)
test["persistence_solar"] = test_persist["persistence_solar"].values
test["persistence_wind_total"] = test_persist["persistence_wind_total"].values

metrics = {}
for zone in ZONES + ["All Germany"]:
    if zone == "All Germany":
        mask = np.ones(len(test), dtype=bool)
    else:
        mask = test["zone"].values == zone

    s_true = test.loc[mask, "solar"].values
    s_pred = test.loc[mask, "solar_q50"].values
    s_lo = test.loc[mask, "solar_q10"].values
    s_hi = test.loc[mask, "solar_q90"].values
    s_base = test.loc[mask, "persistence_solar"].values

    w_true = test.loc[mask, "wind_total"].values
    w_pred = test.loc[mask, "wind_q50"].values
    w_lo = test.loc[mask, "wind_q10"].values
    w_hi = test.loc[mask, "wind_q90"].values
    w_base = test.loc[mask, "persistence_wind_total"].values

    s_mae_m = mae(s_true, s_pred)
    s_mae_b = mae(s_true, s_base)
    w_mae_m = mae(w_true, w_pred)
    w_mae_b = mae(w_true, w_base)

    metrics[zone] = {
        "solar": {
            "mae": round(s_mae_m, 1),
            "rmse": round(rmse(s_true, s_pred), 1),
            "baselineMae": round(s_mae_b, 1),
            "baselineRmse": round(rmse(s_true, s_base), 1),
            "improvement": round((s_mae_b - s_mae_m) / s_mae_b * 100, 1) if s_mae_b > 0 else 0,
            "coverage": round(coverage(s_true, s_lo, s_hi), 1),
        },
        "wind": {
            "mae": round(w_mae_m, 1),
            "rmse": round(rmse(w_true, w_pred), 1),
            "baselineMae": round(w_mae_b, 1),
            "baselineRmse": round(rmse(w_true, w_base), 1),
            "improvement": round((w_mae_b - w_mae_m) / w_mae_b * 100, 1) if w_mae_b > 0 else 0,
            "coverage": round(coverage(w_true, w_lo, w_hi), 1),
        },
    }

# ============================================================================
# 2. FEATURE IMPORTANCE (from trained models)
# ============================================================================
print("Extracting feature importance...")

imp_solar = solar_q50.feature_importances_
total_s = imp_solar.sum()
solar_importance = [
    {"name": f, "importance": round(float(i / total_s * 100), 1)}
    for f, i in sorted(zip(SOLAR_FEATURES, imp_solar), key=lambda x: -x[1])
]

imp_wind = wind_q50.feature_importances_
total_w = imp_wind.sum()
wind_importance = [
    {"name": f, "importance": round(float(i / total_w * 100), 1)}
    for f, i in sorted(zip(WIND_FEATURES, imp_wind), key=lambda x: -x[1])
]

# ============================================================================
# 3. HOURLY FORECAST (Jun 13-15, 72 hours) — "1h" and "24h" views
# ============================================================================
print("Generating hourly forecast...")

X_fc_solar = prep_X(forecast, SOLAR_FEATURES)
X_fc_wind = prep_X(forecast, WIND_FEATURES)

forecast["solar_q50"] = predict(solar_q50, X_fc_solar)
forecast["solar_q10"] = predict(solar_q10, X_fc_solar)
forecast["solar_q90"] = predict(solar_q90, X_fc_solar)
forecast["wind_q50"] = predict(wind_q50, X_fc_wind)
forecast["wind_q10"] = predict(wind_q10, X_fc_wind)
forecast["wind_q90"] = predict(wind_q90, X_fc_wind)

# Merge persistence baseline
forecast = forecast.merge(
    forecast_persist[["zone", "hour", "persistence_solar", "persistence_wind_total"]].drop_duplicates(),
    on=["zone", "hour"], how="left"
)

hourly_forecast = {}
for zone in ZONES + ["All Germany"]:
    if zone == "All Germany":
        agg = forecast.groupby("timestamp").agg({
            "solar_q50": "sum", "solar_q10": "sum", "solar_q90": "sum",
            "wind_q50": "sum", "wind_q10": "sum", "wind_q90": "sum",
            "persistence_solar": "sum", "persistence_wind_total": "sum",
            "hour": "first",
        }).reset_index()
    else:
        agg = forecast[forecast["zone"] == zone].copy()

    hourly_forecast[zone] = [
        {
            "ts": row["timestamp"].strftime("%Y-%m-%dT%H:%M"),
            "hour": int(row["hour"]),
            "solar_q50": round(float(row["solar_q50"]), 1),
            "solar_q10": round(float(row["solar_q10"]), 1),
            "solar_q90": round(float(row["solar_q90"]), 1),
            "wind_q50": round(float(row["wind_q50"]), 1),
            "wind_q10": round(float(row["wind_q10"]), 1),
            "wind_q90": round(float(row["wind_q90"]), 1),
            "persistence_solar": round(float(row.get("persistence_solar", 0) or 0), 1),
            "persistence_wind": round(float(row.get("persistence_wind_total", 0) or 0), 1),
        }
        for _, row in agg.sort_values("timestamp").iterrows()
    ]

# ============================================================================
# 4. 15-MINUTE RAW DATA (last available day from SMARD)
# ============================================================================
print("Processing 15-min SMARD data...")

COL_MAP = {
    "Start date": "start",
    "Photovoltaics [MWh] Original resolutions": "solar",
    "Wind onshore [MWh] Original resolutions": "wind_onshore",
    "Wind offshore [MWh] Original resolutions": "wind_offshore",
}

ZONE_FILES = {
    "50Hertz": DATA / "somrad/50Hertz_01_01_2021-06_13_2026.csv",
    "Amprion": DATA / "somrad/Ampiron_01_01_2021-06_13_2026.csv",
    "TenneT": DATA / "somrad/TenneT_01_01_2021-06_13_2026.csv",
    "TransnetBW": DATA / "somrad/TransnetBW_01_01_2021-06_13_2026.csv",
}

fifteen_min_data = {}
for zone, path in ZONE_FILES.items():
    df = pd.read_csv(path, sep=";", low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    df = df.rename(columns=COL_MAP)
    df["start"] = pd.to_datetime(df["start"], format="%b %d, %Y %I:%M %p", errors="coerce")
    df = df.dropna(subset=["start"])

    for col in ["solar", "wind_onshore", "wind_offshore"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col].astype(str).str.replace(",", ""), errors="coerce")
        else:
            df[col] = 0.0

    df["wind_total"] = df["wind_onshore"].fillna(0) + df["wind_offshore"].fillna(0)
    df = df.dropna(subset=["solar"])

    # Take last 24 hours of actual data (Jun 12)
    last_valid = df.iloc[-1]["start"]
    start_window = last_valid - pd.Timedelta(hours=24)
    window = df[df["start"] >= start_window].sort_values("start")

    fifteen_min_data[zone] = [
        {
            "ts": row["start"].strftime("%Y-%m-%dT%H:%M"),
            "solar": round(float(row["solar"]), 2),
            "wind_total": round(float(row["wind_total"]), 2),
        }
        for _, row in window.iterrows()
    ]

# All Germany = sum per timestamp
all_ts = {}
for zone_data in fifteen_min_data.values():
    for pt in zone_data:
        ts = pt["ts"]
        if ts not in all_ts:
            all_ts[ts] = {"ts": ts, "solar": 0, "wind_total": 0}
        all_ts[ts]["solar"] += pt["solar"]
        all_ts[ts]["wind_total"] += pt["wind_total"]
fifteen_min_data["All Germany"] = sorted(all_ts.values(), key=lambda x: x["ts"])

# ============================================================================
# 5. DAILY AGGREGATES from test set (actuals + model predictions)
# ============================================================================
print("Computing daily aggregates...")

test["date"] = test["timestamp"].dt.date.astype(str)
daily = test.groupby(["date", "zone"]).agg({
    "solar": "sum",
    "wind_total": "sum",
    "solar_q50": "sum",
    "wind_q50": "sum",
    "solar_q10": "sum",
    "solar_q90": "sum",
    "wind_q10": "sum",
    "wind_q90": "sum",
    "persistence_solar": "sum",
    "persistence_wind_total": "sum",
}).reset_index()

daily_data = {}
for zone in ZONES + ["All Germany"]:
    if zone == "All Germany":
        d = daily.groupby("date").agg({
            "solar": "sum", "wind_total": "sum",
            "solar_q50": "sum", "wind_q50": "sum",
            "solar_q10": "sum", "solar_q90": "sum",
            "wind_q10": "sum", "wind_q90": "sum",
            "persistence_solar": "sum", "persistence_wind_total": "sum",
        }).reset_index()
    else:
        d = daily[daily["zone"] == zone]

    daily_data[zone] = [
        {
            "date": row["date"],
            "solar_actual": round(float(row["solar"]), 0),
            "wind_actual": round(float(row["wind_total"]), 0),
            "solar_pred": round(float(row["solar_q50"]), 0),
            "wind_pred": round(float(row["wind_q50"]), 0),
            "solar_lo": round(float(row["solar_q10"]), 0),
            "solar_hi": round(float(row["solar_q90"]), 0),
            "wind_lo": round(float(row["wind_q10"]), 0),
            "wind_hi": round(float(row["wind_q90"]), 0),
            "baseline_solar": round(float(row["persistence_solar"]), 0),
            "baseline_wind": round(float(row["persistence_wind_total"]), 0),
        }
        for _, row in d.sort_values("date").iterrows()
    ]

# ============================================================================
# 6. WEEKLY AGGREGATES
# ============================================================================
print("Computing weekly aggregates...")

test["week"] = test["timestamp"].dt.isocalendar().week.astype(int)
test["year_week"] = test["timestamp"].dt.strftime("%Y-W%V")

weekly = test.groupby(["year_week", "zone"]).agg({
    "solar": "sum", "wind_total": "sum",
    "solar_q50": "sum", "wind_q50": "sum",
    "persistence_solar": "sum", "persistence_wind_total": "sum",
}).reset_index()

weekly_data = {}
for zone in ZONES + ["All Germany"]:
    if zone == "All Germany":
        w = weekly.groupby("year_week").agg({
            "solar": "sum", "wind_total": "sum",
            "solar_q50": "sum", "wind_q50": "sum",
            "persistence_solar": "sum", "persistence_wind_total": "sum",
        }).reset_index()
    else:
        w = weekly[weekly["zone"] == zone]

    weekly_data[zone] = [
        {
            "week": row["year_week"],
            "solar_actual": round(float(row["solar"]), 0),
            "wind_actual": round(float(row["wind_total"]), 0),
            "solar_pred": round(float(row["solar_q50"]), 0),
            "wind_pred": round(float(row["wind_q50"]), 0),
            "baseline_solar": round(float(row["persistence_solar"]), 0),
            "baseline_wind": round(float(row["persistence_wind_total"]), 0),
        }
        for _, row in w.sort_values("year_week").iterrows()
    ]

# ============================================================================
# 7. MONTHLY AGGREGATES (full dataset 2021-2026)
# ============================================================================
print("Computing monthly aggregates...")

full = pd.concat([train, test], ignore_index=True)
full["month_key"] = full["timestamp"].dt.strftime("%Y-%m")

monthly = full.groupby(["month_key", "zone"]).agg({
    "solar": "sum", "wind_total": "sum",
}).reset_index()

monthly_data = {}
for zone in ZONES + ["All Germany"]:
    if zone == "All Germany":
        m = monthly.groupby("month_key").agg({"solar": "sum", "wind_total": "sum"}).reset_index()
    else:
        m = monthly[monthly["zone"] == zone]

    monthly_data[zone] = [
        {
            "month": row["month_key"],
            "solar": round(float(row["solar"]), 0),
            "wind": round(float(row["wind_total"]), 0),
        }
        for _, row in m.sort_values("month_key").iterrows()
    ]

# ============================================================================
# 8. YEARLY AGGREGATES
# ============================================================================
print("Computing yearly aggregates...")

full["year_key"] = full["timestamp"].dt.year.astype(str)

yearly = full.groupby(["year_key", "zone"]).agg({
    "solar": "sum", "wind_total": "sum",
}).reset_index()

yearly_data = {}
for zone in ZONES + ["All Germany"]:
    if zone == "All Germany":
        y = yearly.groupby("year_key").agg({"solar": "sum", "wind_total": "sum"}).reset_index()
    else:
        y = yearly[yearly["zone"] == zone]

    yearly_data[zone] = [
        {
            "year": row["year_key"],
            "solar": round(float(row["solar"]), 0),
            "wind": round(float(row["wind_total"]), 0),
        }
        for _, row in y.sort_values("year_key").iterrows()
    ]

# ============================================================================
# 9. ENERGY MARKET SIGNALS (business value)
# ============================================================================
print("Computing energy market signals...")

# For the forecast period, compute:
# - Surplus/deficit vs typical demand patterns
# - Ramp events (large hour-over-hour changes)
# - Curtailment risk (when renewables exceed typical load)

fc_day1 = forecast[forecast["timestamp"].dt.date == forecast["timestamp"].iloc[0].date()]
fc_all = fc_day1.groupby("hour").agg({
    "solar_q50": "sum", "wind_q50": "sum",
    "solar_q10": "sum", "solar_q90": "sum",
    "wind_q10": "sum", "wind_q90": "sum",
}).reset_index()

fc_all["total_q50"] = fc_all["solar_q50"] + fc_all["wind_q50"]
fc_all["total_lo"] = fc_all["solar_q10"] + fc_all["wind_q10"]
fc_all["total_hi"] = fc_all["solar_q90"] + fc_all["wind_q90"]

# Ramp events: hour-over-hour change > 5000 MWh
ramps = []
for i in range(1, len(fc_all)):
    delta = fc_all.iloc[i]["total_q50"] - fc_all.iloc[i - 1]["total_q50"]
    if abs(delta) > 3000:
        ramps.append({
            "hour": int(fc_all.iloc[i]["hour"]),
            "delta": round(float(delta), 0),
            "direction": "up" if delta > 0 else "down",
            "magnitude": "large" if abs(delta) > 6000 else "medium",
        })

# Peak renewable hour
peak_hour = int(fc_all.loc[fc_all["total_q50"].idxmax(), "hour"])
peak_gen = round(float(fc_all["total_q50"].max()), 0)
min_hour = int(fc_all.loc[fc_all["total_q50"].idxmin(), "hour"])
min_gen = round(float(fc_all["total_q50"].min()), 0)

market_signals = {
    "peak_renewable_hour": peak_hour,
    "peak_generation_mwh": peak_gen,
    "min_renewable_hour": min_hour,
    "min_generation_mwh": min_gen,
    "total_24h_generation": round(float(fc_all["total_q50"].sum()), 0),
    "ramp_events": ramps,
    "recommendation": (
        f"Peak renewables at {peak_hour}:00 ({peak_gen:,.0f} MWh) — schedule "
        f"flexible loads here for lowest cost. Minimum at {min_hour}:00 "
        f"({min_gen:,.0f} MWh) — highest price window."
    ),
}

# ============================================================================
# ASSEMBLE FINAL PAYLOAD
# ============================================================================
print("Assembling final payload...")

payload = {
    "generated_at": pd.Timestamp.now().isoformat(),
    "data_source": {
        "generation": "SMARD (smard.de) — 15-min resolution, CC BY 4.0",
        "weather": "Open-Meteo — hourly, 6 grid points per zone",
        "model": "LightGBM GBDT quantile regression (q10/q50/q90)",
        "training_period": "2021-01-01 to 2026-03-12",
        "test_period": "2026-03-13 to 2026-06-12",
        "forecast_period": "2026-06-13 to 2026-06-15",
    },
    "model_config": {
        "algorithm": "LightGBM",
        "boosting": "GBDT",
        "num_leaves": 127,
        "n_estimators": 1000,
        "learning_rate": 0.05,
        "quantiles": [0.10, 0.50, 0.90],
        "solar_features": SOLAR_FEATURES,
        "wind_features": WIND_FEATURES,
    },
    "metrics": metrics,
    "feature_importance": {
        "solar": solar_importance,
        "wind": wind_importance,
    },
    "market_signals": market_signals,
    "timeframes": {
        "15min": fifteen_min_data,
        "1h": hourly_forecast,
        "daily": daily_data,
        "weekly": weekly_data,
        "monthly": monthly_data,
        "yearly": yearly_data,
    },
}

out_path = OUT / "grid-data.json"
with open(out_path, "w") as f:
    json.dump(payload, f, separators=(",", ":"))

print(f"\nSaved: {out_path}")
print(f"Size: {out_path.stat().st_size / 1024 / 1024:.1f} MB")
print(f"Zones: {ZONES + ['All Germany']}")
print(f"Timeframes: 15min, 1h, daily, weekly, monthly, yearly")
print(f"Metrics computed for: {list(metrics.keys())}")
print("Done!")
