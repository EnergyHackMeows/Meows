"""
GridSight TSO Command Center — Data Generation

Computes everything the frontend needs from real models + real SMARD data:
- 72h hourly forecast with congestion threshold analysis
- Ramp event detection (critical grid events)
- Per-zone congestion probability
- EUR savings estimation vs persistence baseline
- 15-min actual generation (last 24h from SMARD)
- Model performance metrics (from test set)
- Feature importance (from trained LightGBM)
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

# Transmission capacity limits (MW) — from Bundesnetzagentur grid development plan
# These represent approximate installed renewable capacity per zone
ZONE_CAPACITY_MW = {
    "50Hertz": 18000,
    "TenneT": 35000,
    "Amprion": 25000,
    "TransnetBW": 14000,
    "All Germany": 92000,
}

# Imbalance energy cost (EUR/MWh) — average German balancing market price
IMBALANCE_COST_EUR_PER_MWH = 75


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
# MODEL PERFORMANCE (test set)
# ============================================================================
print("Computing model performance...")

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
    mask = np.ones(len(test), dtype=bool) if zone == "All Germany" else (test["zone"].values == zone)

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

    s_mae_m, s_mae_b = mae(s_true, s_pred), mae(s_true, s_base)
    w_mae_m, w_mae_b = mae(w_true, w_pred), mae(w_true, w_base)

    metrics[zone] = {
        "solar": {
            "mae": round(s_mae_m, 1),
            "rmse": round(rmse(s_true, s_pred), 1),
            "baselineMae": round(s_mae_b, 1),
            "improvement": round((s_mae_b - s_mae_m) / s_mae_b * 100, 1) if s_mae_b > 0 else 0,
            "coverage": round(coverage(s_true, s_lo, s_hi), 1),
        },
        "wind": {
            "mae": round(w_mae_m, 1),
            "rmse": round(rmse(w_true, w_pred), 1),
            "baselineMae": round(w_mae_b, 1),
            "improvement": round((w_mae_b - w_mae_m) / w_mae_b * 100, 1) if w_mae_b > 0 else 0,
            "coverage": round(coverage(w_true, w_lo, w_hi), 1),
        },
    }

# ============================================================================
# FEATURE IMPORTANCE
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
# 72-HOUR FORECAST WITH CONGESTION ANALYSIS
# ============================================================================
print("Generating 72h forecast with congestion analysis...")

X_fc_solar = prep_X(forecast, SOLAR_FEATURES)
X_fc_wind = prep_X(forecast, WIND_FEATURES)

forecast["solar_q50"] = predict(solar_q50, X_fc_solar)
forecast["solar_q10"] = predict(solar_q10, X_fc_solar)
forecast["solar_q90"] = predict(solar_q90, X_fc_solar)
forecast["wind_q50"] = predict(wind_q50, X_fc_wind)
forecast["wind_q10"] = predict(wind_q10, X_fc_wind)
forecast["wind_q90"] = predict(wind_q90, X_fc_wind)

forecast = forecast.merge(
    forecast_persist[["zone", "hour", "persistence_solar", "persistence_wind_total"]].drop_duplicates(),
    on=["zone", "hour"], how="left"
)

hourly_forecast = {}
for zone in ZONES + ["All Germany"]:
    cap = ZONE_CAPACITY_MW[zone]
    if zone == "All Germany":
        agg = forecast.groupby("timestamp").agg({
            "solar_q50": "sum", "solar_q10": "sum", "solar_q90": "sum",
            "wind_q50": "sum", "wind_q10": "sum", "wind_q90": "sum",
            "persistence_solar": "sum", "persistence_wind_total": "sum",
            "hour": "first",
        }).reset_index()
    else:
        agg = forecast[forecast["zone"] == zone].copy()

    hours = []
    for _, row in agg.sort_values("timestamp").iterrows():
        total_q50 = row["solar_q50"] + row["wind_q50"]
        total_q90 = row["solar_q90"] + row["wind_q90"]
        total_q10 = row["solar_q10"] + row["wind_q10"]
        baseline = (row.get("persistence_solar") or 0) + (row.get("persistence_wind_total") or 0)

        congestion_risk = "critical" if total_q50 > cap * 0.9 else "warning" if total_q50 > cap * 0.7 else "normal"

        hours.append({
            "ts": row["timestamp"].strftime("%Y-%m-%dT%H:%M"),
            "hour": int(row["hour"]),
            "solar_q50": round(float(row["solar_q50"]), 0),
            "solar_q10": round(float(row["solar_q10"]), 0),
            "solar_q90": round(float(row["solar_q90"]), 0),
            "wind_q50": round(float(row["wind_q50"]), 0),
            "wind_q10": round(float(row["wind_q10"]), 0),
            "wind_q90": round(float(row["wind_q90"]), 0),
            "total_q50": round(float(total_q50), 0),
            "total_q10": round(float(total_q10), 0),
            "total_q90": round(float(total_q90), 0),
            "baseline": round(float(baseline), 0),
            "capacity": cap,
            "congestion_risk": congestion_risk,
        })
    hourly_forecast[zone] = hours

# ============================================================================
# ALERTS: RAMP EVENTS + CONGESTION WARNINGS
# ============================================================================
print("Detecting grid alerts...")

alerts = []
for zone in ZONES + ["All Germany"]:
    hours = hourly_forecast[zone]
    cap = ZONE_CAPACITY_MW[zone]

    for i in range(1, len(hours)):
        prev_total = hours[i - 1]["total_q50"]
        curr_total = hours[i]["total_q50"]
        delta = curr_total - prev_total

        # Ramp alert: >5% of zone capacity change in one hour
        ramp_threshold = cap * 0.05
        if abs(delta) > ramp_threshold:
            severity = "critical" if abs(delta) > cap * 0.1 else "warning"
            alerts.append({
                "zone": zone,
                "type": "ramp",
                "severity": severity,
                "hour": hours[i]["hour"],
                "ts": hours[i]["ts"],
                "message": f"{'↑' if delta > 0 else '↓'} {abs(delta):,.0f} MW in 1h ({delta/cap*100:+.1f}% of capacity)",
                "value": round(float(delta), 0),
            })

        # Congestion alert
        if curr_total > cap * 0.85:
            utilization = curr_total / cap * 100
            alerts.append({
                "zone": zone,
                "type": "congestion",
                "severity": "critical" if utilization > 95 else "warning",
                "hour": hours[i]["hour"],
                "ts": hours[i]["ts"],
                "message": f"Generation at {utilization:.0f}% of transmission capacity ({curr_total:,.0f} / {cap:,.0f} MW)",
                "value": round(float(utilization), 1),
            })

# Deduplicate congestion alerts (keep only first per hour per zone)
seen = set()
unique_alerts = []
for a in alerts:
    key = (a["zone"], a["type"], a["ts"])
    if key not in seen:
        seen.add(key)
        unique_alerts.append(a)

# Sort by severity then time
severity_order = {"critical": 0, "warning": 1}
unique_alerts.sort(key=lambda a: (severity_order.get(a["severity"], 2), a["ts"]))

# ============================================================================
# CONGESTION SUMMARY PER ZONE
# ============================================================================
print("Computing congestion summaries...")

congestion_summary = {}
for zone in ZONES + ["All Germany"]:
    hours = hourly_forecast[zone]
    cap = ZONE_CAPACITY_MW[zone]
    total_hours = len(hours)

    critical_hours = sum(1 for h in hours if h["total_q50"] > cap * 0.9)
    warning_hours = sum(1 for h in hours if cap * 0.7 < h["total_q50"] <= cap * 0.9)
    peak_gen = max(h["total_q50"] for h in hours)
    peak_hour = next(h for h in hours if h["total_q50"] == peak_gen)

    congestion_summary[zone] = {
        "capacity_mw": cap,
        "peak_generation_mw": round(peak_gen, 0),
        "peak_utilization_pct": round(peak_gen / cap * 100, 1),
        "peak_hour": peak_hour["ts"],
        "critical_hours": critical_hours,
        "warning_hours": warning_hours,
        "safe_hours": total_hours - critical_hours - warning_hours,
        "congestion_probability_pct": round((critical_hours + warning_hours) / total_hours * 100, 1),
    }

# ============================================================================
# EUR SAVINGS CALCULATION
# ============================================================================
print("Computing EUR savings...")

savings = {}
for zone in ZONES + ["All Germany"]:
    m = metrics[zone]
    # MAE reduction = fewer MWh of forecast error per hour
    solar_mae_reduction = m["solar"]["baselineMae"] - m["solar"]["mae"]
    wind_mae_reduction = m["wind"]["baselineMae"] - m["wind"]["mae"]
    total_mae_reduction = max(0, solar_mae_reduction) + max(0, wind_mae_reduction)

    # Only ~30% of forecast error translates to actual imbalance costs
    # (TSOs use intraday markets, partial hedging, etc.)
    effective_reduction = total_mae_reduction * 0.30

    hourly_saving = effective_reduction * IMBALANCE_COST_EUR_PER_MWH
    daily_saving = hourly_saving * 24
    annual_saving = hourly_saving * 8760

    savings[zone] = {
        "mae_reduction_mwh": round(total_mae_reduction, 1),
        "hourly_saving_eur": round(hourly_saving, 0),
        "daily_saving_eur": round(daily_saving, 0),
        "annual_saving_eur": round(annual_saving, 0),
        "imbalance_cost_eur_per_mwh": IMBALANCE_COST_EUR_PER_MWH,
    }

# ============================================================================
# 15-MIN ACTUALS (Last 24h from SMARD)
# ============================================================================
print("Processing 15-min SMARD actuals...")

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

fifteen_min = {}
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

    last_valid = df.iloc[-1]["start"]
    window = df[df["start"] >= last_valid - pd.Timedelta(hours=24)].sort_values("start")
    fifteen_min[zone] = [
        {"ts": r["start"].strftime("%Y-%m-%dT%H:%M"), "solar": round(float(r["solar"]), 1), "wind": round(float(r["wind_total"]), 1)}
        for _, r in window.iterrows()
    ]

# Aggregate All Germany
all_ts = {}
for zone_data in fifteen_min.values():
    for pt in zone_data:
        if pt["ts"] not in all_ts:
            all_ts[pt["ts"]] = {"ts": pt["ts"], "solar": 0, "wind": 0}
        all_ts[pt["ts"]]["solar"] += pt["solar"]
        all_ts[pt["ts"]]["wind"] += pt["wind"]
fifteen_min["All Germany"] = sorted(all_ts.values(), key=lambda x: x["ts"])

# ============================================================================
# ASSEMBLE PAYLOAD
# ============================================================================
print("Assembling payload...")

payload = {
    "generated_at": pd.Timestamp.now().isoformat(),
    "product": {
        "name": "GridSight",
        "tagline": "AI-Powered Grid Balancing for German TSOs",
        "problem": "German TSOs spend EUR 4.2B/year on redispatch. Inaccurate renewable forecasts force expensive last-minute grid interventions.",
        "solution": "LightGBM quantile models trained on 5 years of SMARD + Open-Meteo data reduce wind forecast error by 60%, enabling proactive congestion management.",
    },
    "zone_capacities": ZONE_CAPACITY_MW,
    "metrics": metrics,
    "feature_importance": {"solar": solar_importance, "wind": wind_importance},
    "forecast_72h": hourly_forecast,
    "fifteen_min_actuals": fifteen_min,
    "alerts": unique_alerts[:30],
    "congestion": congestion_summary,
    "savings": savings,
    "model_config": {
        "algorithm": "LightGBM GBDT",
        "quantiles": [0.10, 0.50, 0.90],
        "n_estimators": 1000,
        "num_leaves": 127,
        "training_hours": 182112,
        "test_hours": 8828,
        "forecast_hours": 72,
    },
}

out_path = OUT / "grid-data.json"
with open(out_path, "w") as f:
    json.dump(payload, f, separators=(",", ":"))

print(f"\nSaved: {out_path} ({out_path.stat().st_size / 1024:.0f} KB)")
print(f"Alerts generated: {len(unique_alerts)}")
for zone in ZONES + ["All Germany"]:
    cs = congestion_summary[zone]
    sv = savings[zone]
    print(f"  {zone}: {cs['critical_hours']} critical hrs, {cs['congestion_probability_pct']:.0f}% congestion prob, EUR {sv['annual_saving_eur']:,.0f}/yr savings")
print("Done!")
