"""
Plots model results in a way you can actually understand.
Saves charts to model/plots/

What each chart shows:
  01_mae_comparison.html        — "Did we beat the baseline?"
  02_forecast_<zone>.html       — "What does a forecast look like?" (3 days)
  03_good_vs_bad_day.html       — "When does the model win and lose?"
  04_coverage.html              — "Are our uncertainty bands honest?"
"""
import joblib
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio
from plotly.subplots import make_subplots
from pathlib import Path

DATA  = Path(__file__).parent.parent / "data"
MODEL = Path(__file__).parent
PLOTS = MODEL / "plots"
PLOTS.mkdir(exist_ok=True)

SOLAR_FEATURES = [
    "shortwave_radiation", "diffuse_radiation", "cloud_cover",
    "sunshine_duration", "hour", "month", "day_of_year", "zone",
]
WIND_FEATURES = [
    "wind_speed_100m", "wind_speed_100m_sq", "wind_sin", "wind_cos",
    "wind_gusts_10m", "temperature_2m", "hour", "month", "zone",
]

# ── Load and predict ─────────────────────────────────────────────────────────
test         = pd.read_parquet(DATA / "test.parquet")
test_persist = pd.read_parquet(MODEL / "test_persistence.parquet")
test["wind_speed_100m_sq"] = test["wind_speed_100m"] ** 2

solar_q10 = joblib.load(MODEL / "solar_q10.pkl")
solar_q50 = joblib.load(MODEL / "solar_q50.pkl")
solar_q90 = joblib.load(MODEL / "solar_q90.pkl")
wind_q10  = joblib.load(MODEL / "wind_q10.pkl")
wind_q50  = joblib.load(MODEL / "wind_q50.pkl")
wind_q90  = joblib.load(MODEL / "wind_q90.pkl")

def prep_X(df, features):
    X = df[features].copy()
    X["zone"] = X["zone"].astype("category")
    return X

def predict(model, X):
    return np.clip(model.predict(X), 0, None)

def mae(y_true, y_pred):
    return np.mean(np.abs(y_true - y_pred))

X_solar = prep_X(test, SOLAR_FEATURES)
X_wind  = prep_X(test, WIND_FEATURES)
test["solar_q10"]  = predict(solar_q10, X_solar)
test["solar_q50"]  = predict(solar_q50, X_solar)
test["solar_q90"]  = predict(solar_q90, X_solar)
test["wind_q10"]   = predict(wind_q10, X_wind)
test["wind_q50"]   = predict(wind_q50, X_wind)
test["wind_q90"]   = predict(wind_q90, X_wind)
test["persistence_solar"]      = test_persist["persistence_solar"].values
test["persistence_wind_total"] = test_persist["persistence_wind_total"].values

ZONES = sorted(test["zone"].unique())


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║ CHART 1: MAE BAR CHART — model vs persistence per zone                    ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
fig = make_subplots(rows=1, cols=2,
                    subplot_titles=["☀️  SOLAR — Error per Hour (lower is better)",
                                    "💨 WIND — Error per Hour (lower is better)"])

for col_idx, (target, persist_col, q50_col) in enumerate([
    ("solar",      "persistence_solar",      "solar_q50"),
    ("wind_total", "persistence_wind_total",  "wind_q50"),
], start=1):
    zones_list   = ZONES + ["ALL"]
    model_maes   = [mae(test[test.zone==z][target], test[test.zone==z][q50_col]) for z in ZONES]
    persist_maes = [mae(test[test.zone==z][target], test[test.zone==z][persist_col]) for z in ZONES]
    model_maes.append(mae(test[target], test[q50_col]))
    persist_maes.append(mae(test[target], test[persist_col]))

    fig.add_trace(go.Bar(
        name="Persistence baseline (yesterday's value)",
        x=zones_list, y=persist_maes,
        marker_color="#BDBDBD", showlegend=(col_idx == 1),
        text=[f"{v:.0f}" for v in persist_maes], textposition="outside",
    ), row=1, col=col_idx)

    fig.add_trace(go.Bar(
        name="Our model (LightGBM q50)",
        x=zones_list, y=model_maes,
        marker_color="#1976D2", showlegend=(col_idx == 1),
        text=[f"{v:.0f}" for v in model_maes], textposition="outside",
    ), row=1, col=col_idx)

fig.update_layout(
    title=dict(
        text="<b>Chart 1 — Did we beat the baseline?</b><br>"
             "<sub>MAE = average error in MWh per hour. Lower bar = better forecast.<br>"
             "If our blue bar is shorter than the gray bar, our model beats just-copy-yesterday.</sub>",
        x=0.02),
    barmode="group", height=600,
    legend=dict(orientation="h", yanchor="bottom", y=1.05, xanchor="right", x=1),
    template="plotly_white", margin=dict(t=140),
)
fig.update_yaxes(title_text="MAE (MWh per hour)")
path = PLOTS / "01_mae_comparison.html"
pio.write_html(fig, path)
print(f"Saved: {path}")


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║ CHART 2: 3-DAY FORECAST WALKTHROUGH per zone                              ║
# ║ Shows actual + q50 + q10/q90 band + persistence for solar AND wind        ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
def make_forecast_chart(zone_df, target, q10_col, q50_col, q90_col, persist_col, fuel, color_hex):
    ts = zone_df["timestamp"]
    r, g, b = bytes.fromhex(color_hex[1:])

    fig = go.Figure()

    # Uncertainty band (shaded area)
    fig.add_trace(go.Scatter(
        x=pd.concat([ts, ts[::-1]]),
        y=pd.concat([zone_df[q90_col], zone_df[q10_col][::-1]]),
        fill="toself", fillcolor=f"rgba({r},{g},{b},0.18)",
        line=dict(width=0),
        name="Uncertainty band (q10 → q90)<br>= 'We're 80% sure actual is in this range'",
        hoverinfo="skip",
    ))

    # Persistence baseline
    fig.add_trace(go.Scatter(
        x=ts, y=zone_df[persist_col],
        line=dict(color="#888", width=1.5, dash="dash"),
        name="Persistence baseline<br>= same hour 24h ago (the 'dumb' guess)",
    ))

    # Our model — q50
    fig.add_trace(go.Scatter(
        x=ts, y=zone_df[q50_col],
        line=dict(color=color_hex, width=2.5),
        name="Our model — q50 (median forecast)<br>= the main prediction line",
    ))

    # Ground truth
    fig.add_trace(go.Scatter(
        x=ts, y=zone_df[target],
        line=dict(color="#000", width=2),
        name="Ground truth (actual MWh)<br>= what really happened",
    ))

    fig.update_layout(
        title=dict(
            text=f"<b>{fuel} — {zone_df['zone'].iloc[0]} — 3-day walkthrough</b><br>"
                 f"<sub>Black line is the ground truth. Closer the colored line stays to it, better the forecast.<br>"
                 f"Shaded region shows uncertainty: wide = unsure, narrow = confident.</sub>",
            x=0.02),
        height=520, template="plotly_white",
        legend=dict(orientation="v", yanchor="top", y=0.98, xanchor="left", x=1.02),
        margin=dict(t=120, r=350),
        xaxis_title="Time",
        yaxis_title="Generation (MWh)",
    )
    return fig


for zone in ZONES:
    df_zone = test[test["zone"] == zone].sort_values("timestamp").reset_index(drop=True)
    # 3-day window in middle
    mid = df_zone["timestamp"].iloc[len(df_zone)//2]
    window = df_zone[(df_zone["timestamp"] >= mid) &
                     (df_zone["timestamp"] <  mid + pd.Timedelta(days=3))]

    # Solar
    fig_s = make_forecast_chart(window, "solar",
                                "solar_q10", "solar_q50", "solar_q90",
                                "persistence_solar",
                                "☀️ Solar", "#FB8C00")
    # Wind
    fig_w = make_forecast_chart(window, "wind_total",
                                "wind_q10", "wind_q50", "wind_q90",
                                "persistence_wind_total",
                                "💨 Wind", "#1976D2")

    # Combine into one HTML with both
    combined = make_subplots(rows=2, cols=1,
                             subplot_titles=[f"☀️ SOLAR — {zone}",
                                             f"💨 WIND — {zone}"],
                             shared_xaxes=True, vertical_spacing=0.13)

    for tr in fig_s.data:
        tr.legendgroup = "solar"
        combined.add_trace(tr, row=1, col=1)
    for tr in fig_w.data:
        tr.legendgroup = "wind"
        tr.showlegend = False  # avoid duplicate legend entries
        combined.add_trace(tr, row=2, col=1)

    combined.update_layout(
        title=dict(
            text=f"<b>Chart 2 — Forecast walkthrough: {zone} (3 days)</b><br>"
                 f"<sub>● <b>Black</b> = actual generation. ● <b>Color</b> = our model. "
                 f"● <b>Gray dashed</b> = persistence baseline. ● <b>Shaded</b> = uncertainty band.<br>"
                 f"If color hugs black closer than gray dashed → model wins.</sub>",
            x=0.02),
        height=850, template="plotly_white",
        legend=dict(orientation="v", yanchor="top", y=0.98, xanchor="left", x=1.02),
        margin=dict(t=140, r=380),
    )
    combined.update_yaxes(title_text="MWh", row=1, col=1)
    combined.update_yaxes(title_text="MWh", row=2, col=1)
    path = PLOTS / f"02_forecast_{zone}.html"
    pio.write_html(combined, path)
    print(f"Saved: {path}")


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║ CHART 3: GOOD DAY vs BAD DAY                                              ║
# ║ Find best & worst forecast day overall for solar and wind                 ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
test["date"] = test["timestamp"].dt.date

daily_err = test.groupby(["zone", "date"]).apply(
    lambda d: pd.Series({
        "solar_err":  mae(d["solar"], d["solar_q50"]),
        "wind_err":   mae(d["wind_total"], d["wind_q50"]),
    }), include_groups=False).reset_index()

# Pick 50Hertz as example zone (largest renewables footprint)
example_zone = "50Hertz"
solar_days = daily_err[daily_err.zone == example_zone].sort_values("solar_err")
wind_days  = daily_err[daily_err.zone == example_zone].sort_values("wind_err")

best_solar_day  = solar_days.iloc[0]["date"]
worst_solar_day = solar_days.iloc[-1]["date"]
best_wind_day   = wind_days.iloc[0]["date"]
worst_wind_day  = wind_days.iloc[-1]["date"]


def day_slice(zone, date):
    return test[(test.zone == zone) & (test.date == date)].sort_values("timestamp")


fig = make_subplots(
    rows=2, cols=2,
    subplot_titles=[
        f"☀️ SOLAR — Best day ({best_solar_day})",
        f"☀️ SOLAR — Worst day ({worst_solar_day})",
        f"💨 WIND — Best day ({best_wind_day})",
        f"💨 WIND — Worst day ({worst_wind_day})",
    ],
    vertical_spacing=0.18, horizontal_spacing=0.10,
)

def add_day(fig, r, c, d, target, q10, q50, q90, persist, color):
    rr, gg, bb = bytes.fromhex(color[1:])
    fig.add_trace(go.Scatter(
        x=pd.concat([d.timestamp, d.timestamp[::-1]]),
        y=pd.concat([d[q90], d[q10][::-1]]),
        fill="toself", fillcolor=f"rgba({rr},{gg},{bb},0.18)",
        line=dict(width=0), name="Uncertainty band", showlegend=(r==1 and c==1),
    ), row=r, col=c)
    fig.add_trace(go.Scatter(
        x=d.timestamp, y=d[persist],
        line=dict(color="#888", dash="dash"),
        name="Persistence", showlegend=(r==1 and c==1),
    ), row=r, col=c)
    fig.add_trace(go.Scatter(
        x=d.timestamp, y=d[q50],
        line=dict(color=color, width=2.5),
        name="Model (q50)", showlegend=(r==1 and c==1),
    ), row=r, col=c)
    fig.add_trace(go.Scatter(
        x=d.timestamp, y=d[target],
        line=dict(color="#000", width=2),
        name="Actual", showlegend=(r==1 and c==1),
    ), row=r, col=c)

add_day(fig, 1, 1, day_slice(example_zone, best_solar_day),  "solar",      "solar_q10","solar_q50","solar_q90","persistence_solar","#FB8C00")
add_day(fig, 1, 2, day_slice(example_zone, worst_solar_day), "solar",      "solar_q10","solar_q50","solar_q90","persistence_solar","#FB8C00")
add_day(fig, 2, 1, day_slice(example_zone, best_wind_day),   "wind_total", "wind_q10", "wind_q50", "wind_q90", "persistence_wind_total","#1976D2")
add_day(fig, 2, 2, day_slice(example_zone, worst_wind_day),  "wind_total", "wind_q10", "wind_q50", "wind_q90", "persistence_wind_total","#1976D2")

fig.update_layout(
    title=dict(
        text=f"<b>Chart 3 — When does the model win and when does it struggle? ({example_zone})</b><br>"
             f"<sub>Best day: forecast (color) nearly matches actual (black). "
             f"Worst day: see how far off we got — and what persistence did.</sub>",
        x=0.02),
    height=750, template="plotly_white",
    legend=dict(orientation="h", yanchor="bottom", y=1.04, xanchor="right", x=1),
    margin=dict(t=140),
)
for r in [1,2]:
    for c in [1,2]:
        fig.update_yaxes(title_text="MWh", row=r, col=c)

path = PLOTS / "03_good_vs_bad_day.html"
pio.write_html(fig, path)
print(f"Saved: {path}")


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║ CHART 4: COVERAGE — are uncertainty bands honest?                         ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
fig = make_subplots(rows=1, cols=2,
                    subplot_titles=["☀️ SOLAR — % actuals inside q10–q90 band",
                                    "💨 WIND — % actuals inside q10–q90 band"])

for col_idx, (target, q10_col, q90_col) in enumerate([
    ("solar",      "solar_q10",  "solar_q90"),
    ("wind_total", "wind_q10",   "wind_q90"),
], start=1):
    coverages = []
    labels    = ZONES + ["ALL"]

    for zone in ZONES:
        mask = test["zone"] == zone
        inside = ((test.loc[mask, target] >= test.loc[mask, q10_col]) &
                  (test.loc[mask, target] <= test.loc[mask, q90_col]))
        coverages.append(inside.mean() * 100)

    inside = ((test[target] >= test[q10_col]) & (test[target] <= test[q90_col]))
    coverages.append(inside.mean() * 100)

    bar_colors = ["#E53935" if c < 70 else "#43A047" for c in coverages]
    fig.add_trace(go.Bar(
        x=labels, y=coverages, marker_color=bar_colors,
        text=[f"{v:.0f}%" for v in coverages], textposition="outside",
        showlegend=False,
    ), row=1, col=col_idx)

    fig.add_hline(y=80, line_dash="dash", line_color="black",
                  annotation_text="80% = honest band", row=1, col=col_idx)

fig.update_layout(
    title=dict(
        text="<b>Chart 4 — Are our uncertainty bands honest?</b><br>"
             "<sub>The q10–q90 band claims to contain the actual value 80% of the time.<br>"
             "🟢 Green ≥ 70% (honest)  🔴 Red < 70% (band too narrow — model is overconfident).</sub>",
        x=0.02),
    height=500, template="plotly_white",
    margin=dict(t=130),
)
fig.update_yaxes(title_text="Coverage (%)", range=[0, 105])
path = PLOTS / "04_coverage.html"
pio.write_html(fig, path)
print(f"Saved: {path}")


print("\n✅ Charts ready. Open them in this order for the story:")
print("  1. 01_mae_comparison.html  — overall scoreboard")
print("  2. 02_forecast_50Hertz.html — see what a forecast actually looks like")
print("  3. 03_good_vs_bad_day.html  — best day vs worst day")
print("  4. 04_coverage.html         — uncertainty band honesty check")
