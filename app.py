"""
GridSight — Renewable Generation Forecasting Dashboard
======================================================
Streamlit inference dashboard for short-horizon Solar / Wind generation
forecasting with naive-baseline comparison and a derived trading signal.

Run:
    streamlit run app.py

Replace `generate_mock_data()` with your real data loader (SQLite / CSV /
Parquet from the background pipeline). Keep the returned DataFrame schema
identical and everything downstream will just work.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

# =============================================================================
# 1. PAGE CONFIG  +  DARK THEME CSS
# =============================================================================
st.set_page_config(
    page_title="GridSight · Renewable Forecast",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS — pushes Streamlit into a "control-room" dark aesthetic that
# matches the mockup (deep slate background, neon accents, mono numerals).
st.markdown(
    """
    <style>
      :root {
        --bg:        #0b1220;
        --panel:     #111a2e;
        --panel-2:   #16223d;
        --border:    #1f2c4a;
        --text:      #e6ecff;
        --muted:     #8a98b8;
        --accent:    #38f0c8;
        --solar:     #f5b942;
        --wind:      #5ad1ff;
        --baseline:  #7a8aa8;
        --buy:       #ff5c7a;
        --sell:      #2ee6a8;
      }
      .stApp { background-color: var(--bg); color: var(--text); }
      section[data-testid="stSidebar"] { background-color: #0a1020; border-right: 1px solid var(--border); }
      h1, h2, h3, h4 { color: var(--text) !important; letter-spacing: -0.01em; }
      .kpi-card {
        background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 18px 20px;
      }
      .kpi-label { color: var(--muted); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
      .kpi-value { font-family: ui-monospace, "JetBrains Mono", Menlo, monospace;
                   font-size: 34px; font-weight: 700; margin-top: 6px; }
      .kpi-sub   { color: var(--muted); font-size: 12px; margin-top: 4px; }
      .accent    { color: var(--accent); }
      .signal-card {
        border-radius: 16px; padding: 22px 24px;
        border: 1px solid var(--border);
        background: var(--panel);
      }
      .signal-buy  { box-shadow: inset 0 0 0 1px rgba(255,92,122,.5); }
      .signal-sell { box-shadow: inset 0 0 0 1px rgba(46,230,168,.5); }
      .signal-action { font-size: 42px; font-weight: 800; letter-spacing: .04em; }
      .badge { display:inline-block; padding:4px 10px; border-radius:999px;
               background: rgba(46,230,168,.12); color: var(--sell);
               font-size: 11px; letter-spacing:.12em; text-transform:uppercase;}
    </style>
    """,
    unsafe_allow_html=True,
)


# =============================================================================
# 2. DATA LAYER  (mock now — swap for SQLite/CSV later)
# =============================================================================
@st.cache_data(ttl=900, show_spinner=False)
def generate_mock_data(asset: str = "Solar", hours: int = 24) -> pd.DataFrame:
    """
    Simulate 24h of quarter-hourly generation data.

    >>> REPLACE THIS BODY WITH YOUR REAL LOADER <<<
    Example real implementations:

        # --- SQLite ---
        import sqlite3
        con = sqlite3.connect("inference.db")
        df = pd.read_sql(
            "SELECT timestamp, actual, predicted, baseline, weather "
            "FROM forecasts WHERE asset = ? ORDER BY timestamp",
            con, params=[asset], parse_dates=["timestamp"],
        )

        # --- CSV / Parquet from pipeline ---
        df = pd.read_parquet(f"data/forecast_{asset.lower()}.parquet")

    The returned DataFrame MUST contain these columns:
        Timestamp, Actual_Generation, Predicted_Generation,
        Baseline, Weather_Condition
    """
    rng = np.random.default_rng(42 if asset == "Solar" else 7)
    n = hours * 4  # 15-min resolution
    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(hours=hours)
    ts = pd.date_range(start, periods=n, freq="15min", tz="UTC")

    hour_of_day = ts.hour + ts.minute / 60.0

    if asset == "Solar":
        # Bell curve centered at noon
        base = np.clip(
            120 * np.exp(-0.5 * ((hour_of_day - 13) / 3.2) ** 2), 0, None
        )
        weather_pool = ["Sunny", "Partly Cloudy", "Cloudy", "Overcast"]
        weather_w = [0.5, 0.25, 0.15, 0.10]
    else:  # Wind
        # Smooth diurnal-ish wind with stochastic gusts
        base = 70 + 25 * np.sin(2 * np.pi * (hour_of_day - 4) / 24) \
                  + 10 * np.sin(2 * np.pi * hour_of_day / 6)
        weather_pool = ["Calm", "Breezy", "High Wind", "Storm"]
        weather_w = [0.2, 0.45, 0.3, 0.05]

    noise_actual = rng.normal(0, 6, n)
    noise_pred = rng.normal(0, 3, n)
    actual = np.clip(base + noise_actual, 0, None)

    # Model prediction: tracks actual closely with small bias
    predicted = np.clip(base + 0.4 * noise_actual + noise_pred, 0, None)

    # Naive persistence baseline = value from 24h ago (here approximated by
    # a 4h lag on synthetic data so it's visibly worse than the model)
    baseline = pd.Series(actual).shift(16).bfill().values
    baseline = baseline + rng.normal(0, 4, n)

    weather = rng.choice(weather_pool, size=n, p=weather_w)

    return pd.DataFrame({
        "Timestamp": ts,
        "Actual_Generation": actual.round(2),
        "Predicted_Generation": predicted.round(2),
        "Baseline": np.clip(baseline, 0, None).round(2),
        "Weather_Condition": weather,
    })


# =============================================================================
# 3. METRICS
# =============================================================================
def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


# =============================================================================
# 4. SIDEBAR  (controls)
# =============================================================================
with st.sidebar:
    st.markdown("### ⚡ GridSight")
    st.caption("Inference console · v0.1")

    st.markdown("#### Asset")
    asset = st.radio(
        "Asset view",
        options=["Solar", "Wind"],
        horizontal=True,
        label_visibility="collapsed",
    )

    st.markdown("#### Horizon")
    hours = st.slider("Hours of data", 6, 48, 24, step=2)

    df_full = generate_mock_data(asset=asset, hours=hours)

    st.markdown("#### Date range")
    tmin = df_full["Timestamp"].min().to_pydatetime()
    tmax = df_full["Timestamp"].max().to_pydatetime()
    window = st.slider(
        "Window",
        min_value=tmin,
        max_value=tmax,
        value=(tmin, tmax),
        format="HH:mm",
        label_visibility="collapsed",
    )

    st.markdown("---")
    st.markdown("#### Model")
    st.caption(
        "XGBoost · Quantile regression\n\n"
        "Trained on 2018–2024\n\n"
        "SMARD + Open-Meteo\n\n"
        "24 grid points · 6 per zone"
    )

# Slice to selected window
df = df_full[
    (df_full["Timestamp"] >= window[0]) & (df_full["Timestamp"] <= window[1])
].reset_index(drop=True)


# =============================================================================
# 5. HEADER
# =============================================================================
left, right = st.columns([0.6, 0.4])
with left:
    st.markdown(
        f"## {asset} generation forecast "
        f"<span class='badge'>● Live</span>",
        unsafe_allow_html=True,
    )
    st.caption(
        f"Forecast window: {window[0]:%a %d %b %H:%M} → {window[1]:%H:%M} UTC"
    )
with right:
    st.caption(
        f"Last refresh: {datetime.utcnow():%Y-%m-%d %H:%M:%S} UTC · "
        f"auto-refresh every 15 min"
    )


# =============================================================================
# 6. KPI ROW
# =============================================================================
y_true = df["Actual_Generation"].to_numpy()
y_pred = df["Predicted_Generation"].to_numpy()
y_base = df["Baseline"].to_numpy()

model_rmse = rmse(y_true, y_pred)
model_mae = mae(y_true, y_pred)
base_rmse = rmse(y_true, y_base)
base_mae = mae(y_true, y_base)
mae_improvement = base_mae - model_mae
mae_improvement_pct = (mae_improvement / base_mae * 100) if base_mae else 0.0

peak_pred = float(np.max(y_pred))
peak_time = df.loc[np.argmax(y_pred), "Timestamp"]
total_energy_mwh = float(np.sum(y_pred) * 0.25)  # MW * 0.25h = MWh per slot


def kpi(label: str, value: str, sub: str = "", accent: bool = False) -> str:
    cls = "kpi-value accent" if accent else "kpi-value"
    return (
        f"<div class='kpi-card'>"
        f"<div class='kpi-label'>{label}</div>"
        f"<div class='{cls}'>{value}</div>"
        f"<div class='kpi-sub'>{sub}</div>"
        f"</div>"
    )


k1, k2, k3, k4 = st.columns(4)
k1.markdown(
    kpi(f"Peak {asset.lower()}", f"{peak_pred:,.1f}", f"MW at {peak_time:%H:%M}"),
    unsafe_allow_html=True,
)
k2.markdown(
    kpi("Total forecast", f"{total_energy_mwh:,.0f}", f"MWh · next {hours}h"),
    unsafe_allow_html=True,
)
k3.markdown(
    kpi("Model MAE", f"{model_mae:,.1f}", f"RMSE {model_rmse:,.1f} MW"),
    unsafe_allow_html=True,
)
k4.markdown(
    kpi(
        "vs Naive baseline",
        f"{mae_improvement_pct:,.0f}%",
        f"−{mae_improvement:,.1f} MW MAE saved",
        accent=True,
    ),
    unsafe_allow_html=True,
)

st.markdown("<div style='height:14px'></div>", unsafe_allow_html=True)


# =============================================================================
# 7. MAIN CHART  +  TRADING SIGNAL
# =============================================================================
chart_col, signal_col = st.columns([0.72, 0.28])

with chart_col:
    asset_color = "#f5b942" if asset == "Solar" else "#5ad1ff"

    fig = go.Figure()

    # Actual
    fig.add_trace(go.Scatter(
        x=df["Timestamp"], y=df["Actual_Generation"],
        name="Actual", mode="lines",
        line=dict(color="#e6ecff", width=2),
        hovertemplate="<b>Actual</b> %{y:.1f} MW<br>%{x|%H:%M}<extra></extra>",
    ))
    # Predicted
    fig.add_trace(go.Scatter(
        x=df["Timestamp"], y=df["Predicted_Generation"],
        name="Predicted", mode="lines",
        line=dict(color=asset_color, width=3),
        hovertemplate="<b>Predicted</b> %{y:.1f} MW<br>%{x|%H:%M}<extra></extra>",
    ))
    # Baseline
    fig.add_trace(go.Scatter(
        x=df["Timestamp"], y=df["Baseline"],
        name="Naive baseline", mode="lines",
        line=dict(color="#7a8aa8", width=1.6, dash="dash"),
        hovertemplate="<b>Baseline</b> %{y:.1f} MW<br>%{x|%H:%M}<extra></extra>",
    ))

    fig.update_layout(
        template="plotly_dark",
        height=460,
        margin=dict(l=10, r=10, t=30, b=10),
        paper_bgcolor="#111a2e",
        plot_bgcolor="#111a2e",
        font=dict(family="Inter, system-ui", color="#e6ecff", size=12),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1,
            bgcolor="rgba(0,0,0,0)",
        ),
        xaxis=dict(
            gridcolor="#1f2c4a", showgrid=True, zeroline=False,
            title=None, tickformat="%H:%M",
        ),
        yaxis=dict(
            gridcolor="#1f2c4a", showgrid=True, zeroline=False,
            title="MW",
        ),
        hovermode="x unified",
    )
    st.plotly_chart(fig, use_container_width=True)

with signal_col:
    # ----- Trading signal logic -----
    # Compare next-hour avg prediction vs baseline → surplus / deficit.
    horizon_slots = min(4, len(df))  # next 1h on 15-min data
    pred_window = df["Predicted_Generation"].tail(horizon_slots).mean()
    base_window = df["Baseline"].tail(horizon_slots).mean()
    delta = pred_window - base_window
    magnitude = abs(delta)
    # Confidence: how large is delta relative to baseline-error noise
    confidence = float(np.clip(magnitude / (base_mae + 1e-9), 0, 1))

    if delta >= 0:
        action = "SELL"
        sub = "Energy surplus vs baseline"
        css_cls = "signal-sell"
        color = "var(--sell)"
    else:
        action = "BUY"
        sub = "Energy deficit vs baseline"
        css_cls = "signal-buy"
        color = "var(--buy)"

    st.markdown(
        f"""
        <div class='signal-card {css_cls}'>
          <div class='kpi-label'>Trading action · next hour</div>
          <div class='signal-action' style='color:{color}'>{action}</div>
          <div class='kpi-sub'>{sub}</div>
          <hr style='border-color:var(--border); margin:14px 0;'>
          <div class='kpi-label'>Magnitude</div>
          <div style='font-family:ui-monospace; font-size:22px; color:{color}'>
            {magnitude:,.1f} MW
          </div>
          <div class='kpi-sub'>Δ pred − baseline (1h avg)</div>
          <div style='height:10px'></div>
          <div class='kpi-label'>Confidence</div>
          <div style='font-family:ui-monospace; font-size:22px;'>
            {confidence*100:,.0f}%
          </div>
          <div class='kpi-sub'>relative to baseline error band</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# =============================================================================
# 8. BOTTOM ROW — Model vs Baseline · Recent weather mix
# =============================================================================
b1, b2 = st.columns([0.5, 0.5])

with b1:
    st.markdown("#### Model vs Baseline")
    comp = pd.DataFrame({
        "Metric": ["MAE (MW)", "RMSE (MW)"],
        "Model":    [round(model_mae, 2), round(model_rmse, 2)],
        "Baseline": [round(base_mae, 2),  round(base_rmse, 2)],
        "Δ":        [round(base_mae - model_mae, 2),
                     round(base_rmse - model_rmse, 2)],
    })
    st.dataframe(comp, hide_index=True, use_container_width=True)

with b2:
    st.markdown("#### Weather mix (window)")
    wx = (
        df["Weather_Condition"].value_counts(normalize=True)
        .mul(100).round(1).rename("share %").reset_index()
        .rename(columns={"index": "Weather_Condition"})
    )
    st.dataframe(wx, hide_index=True, use_container_width=True)

st.caption(
    "Data: mock generator (replace with SMARD + Open-Meteo pipeline). "
    "Cache TTL 15 min — UI re-syncs with inference engine automatically."
)
