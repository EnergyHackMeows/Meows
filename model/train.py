"""
Trains LightGBM quantile models for solar and wind generation.

Outputs (model/):
  solar_q10.pkl, solar_q50.pkl, solar_q90.pkl
  wind_q10.pkl,  wind_q50.pkl,  wind_q90.pkl
"""
import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
DATA  = Path(__file__).parent.parent / "data"
MODEL = Path(__file__).parent

# ── Feature / target config ───────────────────────────────────────────────────
SOLAR_FEATURES = [
    "shortwave_radiation", "diffuse_radiation", "cloud_cover",
    "sunshine_duration", "hour", "month", "day_of_year", "zone",
]

WIND_FEATURES = [
    "wind_speed_100m", "wind_speed_100m_sq", "wind_sin", "wind_cos",
    "wind_gusts_10m", "temperature_2m", "hour", "month", "zone",
]

SOLAR_TARGET = "solar"
WIND_TARGET  = "wind_total"

QUANTILES = [0.10, 0.50, 0.90]

# ── LightGBM hyperparameters ──────────────────────────────────────────────────
BASE_PARAMS = {
    "boosting_type": "gbdt",
    "num_leaves":    127,
    "learning_rate": 0.05,
    "n_estimators":  1000,
    "min_child_samples": 20,
    "subsample":     0.8,
    "colsample_bytree": 0.8,
    "n_jobs":        -1,
    "verbose":       -1,
}

MODEL_PARAMS = {
    "solar": {**BASE_PARAMS},
    "wind":  {**BASE_PARAMS},
}

# ── Load data ─────────────────────────────────────────────────────────────────
train = pd.read_parquet(DATA / "train_final.parquet")
test  = pd.read_parquet(DATA / "test.parquet")

# Engineer wind_speed_100m_sq
for df in [train, test]:
    df["wind_speed_100m_sq"] = df["wind_speed_100m"] ** 2


def train_quantile_models(name, features, target, params):
    X_train = train[features].copy()
    y_train = train[target]

    # LightGBM needs zone as category dtype
    if "zone" in features:
        X_train["zone"] = X_train["zone"].astype("category")

    models = {}
    for q in QUANTILES:
        print(f"  Training {name} q={q:.2f} ...", end=" ", flush=True)
        model = lgb.LGBMRegressor(
            **params,
            objective="quantile",
            alpha=q,
        )
        model.fit(
            X_train, y_train,
            categorical_feature=["zone"] if "zone" in features else "auto",
        )
        key = f"{name}_q{int(q*100):02d}"
        joblib.dump(model, MODEL / f"{key}.pkl")
        models[q] = model
        print("done")

    return models


# ── Train ─────────────────────────────────────────────────────────────────────
print("=== Solar models ===")
solar_models = train_quantile_models("solar", SOLAR_FEATURES, SOLAR_TARGET, MODEL_PARAMS["solar"])

print("\n=== Wind models ===")
wind_models  = train_quantile_models("wind",  WIND_FEATURES,  WIND_TARGET,  MODEL_PARAMS["wind"])


# ── Quick eval on test set ────────────────────────────────────────────────────
def mae(y_true, y_pred):
    return np.mean(np.abs(y_true - y_pred))

def rmse(y_true, y_pred):
    return np.sqrt(np.mean((y_true - y_pred) ** 2))


print("\n=== Test set evaluation (q=0.50 median model) ===")

for name, features, target, models in [
    ("solar", SOLAR_FEATURES, SOLAR_TARGET, solar_models),
    ("wind",  WIND_FEATURES,  WIND_TARGET,  wind_models),
]:
    X_test = test[features].copy()
    if "zone" in features:
        X_test["zone"] = X_test["zone"].astype("category")
    y_test = test[target]

    y_pred = models[0.50].predict(X_test)
    y_pred = np.clip(y_pred, 0, None)  # generation can't be negative

    print(f"\n{name.upper()} — overall")
    print(f"  MAE : {mae(y_test, y_pred):>8.1f} MWh")
    print(f"  RMSE: {rmse(y_test, y_pred):>8.1f} MWh")

    print(f"  Per zone:")
    for zone in sorted(test["zone"].unique()):
        mask = test["zone"] == zone
        m = mae(y_test[mask], y_pred[mask])
        r = rmse(y_test[mask], y_pred[mask])
        print(f"    {zone:<12} MAE={m:>7.1f}  RMSE={r:>7.1f}")
