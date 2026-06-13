"""
Evaluates model (q50) vs persistence baseline on the test set.

Prints MAE, RMSE, % improvement over baseline, and uncertainty band coverage.
"""
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

DATA  = Path(__file__).parent.parent / "data"
MODEL = Path(__file__).parent

# ── Features (must match train.py) ────────────────────────────────────────────
SOLAR_FEATURES = [
    "shortwave_radiation", "diffuse_radiation", "cloud_cover",
    "sunshine_duration", "hour", "month", "day_of_year", "zone",
]
WIND_FEATURES = [
    "wind_speed_100m", "wind_speed_100m_sq", "wind_sin", "wind_cos",
    "wind_gusts_10m", "temperature_2m", "hour", "month", "zone",
]

# ── Load data ─────────────────────────────────────────────────────────────────
test        = pd.read_parquet(DATA / "test.parquet")
test_persist = pd.read_parquet(MODEL / "test_persistence.parquet")

test["wind_speed_100m_sq"] = test["wind_speed_100m"] ** 2

# ── Load models ───────────────────────────────────────────────────────────────
solar_q10 = joblib.load(MODEL / "solar_q10.pkl")
solar_q50 = joblib.load(MODEL / "solar_q50.pkl")
solar_q90 = joblib.load(MODEL / "solar_q90.pkl")
wind_q10  = joblib.load(MODEL / "wind_q10.pkl")
wind_q50  = joblib.load(MODEL / "wind_q50.pkl")
wind_q90  = joblib.load(MODEL / "wind_q90.pkl")

# ── Helpers ───────────────────────────────────────────────────────────────────
def mae(y_true, y_pred):
    return np.mean(np.abs(y_true - y_pred))

def rmse(y_true, y_pred):
    return np.sqrt(np.mean((y_true - y_pred) ** 2))

def pct_improvement(baseline, model):
    return (baseline - model) / baseline * 100

def coverage(y_true, lower, upper):
    return np.mean((y_true >= lower) & (y_true <= upper)) * 100

def predict(model, X):
    return np.clip(model.predict(X), 0, None)

def prep_X(df, features):
    X = df[features].copy()
    X["zone"] = X["zone"].astype("category")
    return X


def evaluate(name, features, target, persist_col, q10_model, q50_model, q90_model):
    X = prep_X(test, features)
    y = test[target].values

    pred_low  = predict(q10_model, X)
    pred_mid  = predict(q50_model, X)
    pred_high = predict(q90_model, X)
    pred_persist = test_persist[persist_col].values

    print(f"\n{'='*60}")
    print(f"  {name.upper()}")
    print(f"{'='*60}")
    print(f"  {'':12}  {'Model MAE':>10}  {'Persist MAE':>12}  {'Improv':>8}  {'Model RMSE':>11}  {'Persist RMSE':>13}  {'Improv':>8}")
    print(f"  {'-'*95}")

    # Overall
    m_mae  = mae(y, pred_mid)
    p_mae  = mae(y, pred_persist)
    m_rmse = rmse(y, pred_mid)
    p_rmse = rmse(y, pred_persist)
    flag   = "✅" if pct_improvement(p_mae, m_mae) >= 15 else "❌"
    print(f"  {'Overall':<12}  {m_mae:>10.1f}  {p_mae:>12.1f}  {pct_improvement(p_mae, m_mae):>+7.1f}%{flag}  {m_rmse:>11.1f}  {p_rmse:>13.1f}  {pct_improvement(p_rmse, m_rmse):>+7.1f}%")

    # Per zone
    for zone in sorted(test["zone"].unique()):
        mask = test["zone"].values == zone
        m_mae  = mae(y[mask], pred_mid[mask])
        p_mae  = mae(y[mask], pred_persist[mask])
        m_rmse = rmse(y[mask], pred_mid[mask])
        p_rmse = rmse(y[mask], pred_persist[mask])
        print(f"  {zone:<12}  {m_mae:>10.1f}  {p_mae:>12.1f}  {pct_improvement(p_mae, m_mae):>+7.1f}%   {m_rmse:>11.1f}  {p_rmse:>13.1f}  {pct_improvement(p_rmse, m_rmse):>+7.1f}%")

    # Uncertainty band coverage
    cov = coverage(y, pred_low, pred_high)
    print(f"\n  Uncertainty band coverage (q10–q90): {cov:.1f}%  (target ~80%)")


evaluate(
    "Solar",
    SOLAR_FEATURES, "solar", "persistence_solar",
    solar_q10, solar_q50, solar_q90,
)

evaluate(
    "Wind",
    WIND_FEATURES, "wind_total", "persistence_wind_total",
    wind_q10, wind_q50, wind_q90,
)
