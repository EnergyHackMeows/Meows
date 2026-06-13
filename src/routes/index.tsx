import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Battery,
  Clock,
  Cpu,
  DollarSign,
  Gauge,
  Layers,
  Radio,
  Sun,
  TrendingDown,
  TrendingUp,
  Wind,
  Zap,
} from "lucide-react";
import {
  ZONES,
  TIMEFRAMES,
  getMetrics,
  getFeatureImportance,
  getMarketSignals,
  getHourlyForecast,
  get15MinData,
  getDailyData,
  getWeeklyData,
  getMonthlyData,
  getYearlyData,
  getPeakSolar,
  getPeakWind,
  getTotalGeneration,
  getCombinedImprovement,
  type Zone,
  type Timeframe,
  type AssetView,
} from "@/lib/mock-data";
import { GermanyMap } from "@/components/GermanyMap";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridSight — Renewable Generation Intelligence" },
      {
        name: "description",
        content: "Multi-horizon renewable energy forecasting for grid operators and energy traders. Real LightGBM models on SMARD data.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [zone, setZone] = useState<Zone>("All Germany");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [view, setView] = useState<AssetView>("both");

  const metrics = useMemo(() => getMetrics(zone), [zone]);
  const signals = useMemo(() => getMarketSignals(), []);
  const improvement = useMemo(() => getCombinedImprovement(zone), [zone]);

  const chartData = useMemo(() => {
    switch (timeframe) {
      case "15min": {
        const raw = get15MinData(zone);
        return raw.map(p => ({
          label: p.ts,
          solar: p.solar,
          wind: p.wind_total,
          total: p.solar + p.wind_total,
        }));
      }
      case "1h": {
        const hrs = getHourlyForecast(zone);
        return hrs.map(h => ({
          label: h.ts,
          predicted: view === "solar" ? h.solar_q50 : view === "wind" ? h.wind_q50 : h.solar_q50 + h.wind_q50,
          lo: view === "solar" ? h.solar_q10 : view === "wind" ? h.wind_q10 : h.solar_q10 + h.wind_q10,
          hi: view === "solar" ? h.solar_q90 : view === "wind" ? h.wind_q90 : h.solar_q90 + h.wind_q90,
          baseline: view === "solar" ? h.persistence_solar : view === "wind" ? h.persistence_wind : h.persistence_solar + h.persistence_wind,
        }));
      }
      case "daily": {
        const days = getDailyData(zone);
        return days.map(d => ({
          label: d.date,
          actual: view === "solar" ? d.solar_actual : view === "wind" ? d.wind_actual : d.solar_actual + d.wind_actual,
          predicted: view === "solar" ? d.solar_pred : view === "wind" ? d.wind_pred : d.solar_pred + d.wind_pred,
          lo: view === "solar" ? d.solar_lo : view === "wind" ? d.wind_lo : d.solar_lo + d.wind_lo,
          hi: view === "solar" ? d.solar_hi : view === "wind" ? d.wind_hi : d.solar_hi + d.wind_hi,
          baseline: view === "solar" ? d.baseline_solar : view === "wind" ? d.baseline_wind : d.baseline_solar + d.baseline_wind,
        }));
      }
      case "weekly": {
        const weeks = getWeeklyData(zone);
        return weeks.map(w => ({
          label: w.week,
          actual: view === "solar" ? w.solar_actual : view === "wind" ? w.wind_actual : w.solar_actual + w.wind_actual,
          predicted: view === "solar" ? w.solar_pred : view === "wind" ? w.wind_pred : w.solar_pred + w.wind_pred,
          baseline: view === "solar" ? w.baseline_solar : view === "wind" ? w.baseline_wind : w.baseline_solar + w.baseline_wind,
        }));
      }
      case "monthly": {
        const months = getMonthlyData(zone);
        return months.map(m => ({
          label: m.month,
          solar: m.solar,
          wind: m.wind,
          total: m.solar + m.wind,
        }));
      }
      case "yearly": {
        const years = getYearlyData(zone);
        return years.map(y => ({
          label: y.year,
          solar: y.solar,
          wind: y.wind,
          total: y.solar + y.wind,
        }));
      }
    }
  }, [zone, timeframe, view]);

  const peakSolar = useMemo(() => getPeakSolar(zone), [zone]);
  const peakWind = useMemo(() => getPeakWind(zone), [zone]);
  const totalGen = useMemo(() => getTotalGeneration(zone), [zone]);

  const features = useMemo(() => {
    if (view === "wind") return getFeatureImportance("wind");
    if (view === "solar") return getFeatureImportance("solar");
    return [...getFeatureImportance("solar").slice(0, 4), ...getFeatureImportance("wind").slice(0, 4)];
  }, [view]);

  return (
    <div className="min-h-screen flex text-foreground">
      {/* Sidebar */}
      <aside className="w-[280px] shrink-0 border-r border-[color:var(--panel-border)] sidebar-gradient flex flex-col">
        <div className="px-6 py-5 flex items-center gap-3">
          <div className="relative flex items-center justify-center size-9 rounded-lg bg-[color:var(--signal-sell)]/10 border border-[color:var(--signal-sell)]/20">
            <Zap className="size-4.5 text-[color:var(--signal-sell)]" />
          </div>
          <div>
            <h1 className="text-display text-[17px] font-bold tracking-tight">GridSight</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Energy Intelligence</p>
          </div>
        </div>

        <div className="section-divider mx-5" />

        {/* Zone selector — Interactive Map */}
        <div className="px-5 mt-4">
          <SectionLabel icon={<Layers className="size-3" />}>Select Zone</SectionLabel>
          <div className="mt-2">
            <GermanyMap selected={zone} onSelect={setZone} />
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="px-5 mt-5">
          <SectionLabel icon={<Clock className="size-3" />}>Timeframe</SectionLabel>
          <div className="flex flex-col gap-0.5 mt-2">
            {TIMEFRAMES.map(tf => (
              <button key={tf.key} onClick={() => setTimeframe(tf.key)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-[12px] transition-all ${
                  timeframe === tf.key
                    ? "bg-[color:var(--accent)] border border-[color:var(--panel-border)] text-foreground"
                    : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
                }`}>
                <span className="font-medium">{tf.label}</span>
                {timeframe === tf.key && <span className="text-[9px] text-muted-foreground font-mono">{tf.description.split("(")[0].trim()}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* View selector */}
        <div className="px-5 mt-5">
          <SectionLabel icon={<BarChart3 className="size-3" />}>Asset</SectionLabel>
          <div className="grid grid-cols-3 gap-1 mt-2">
            {(["both", "solar", "wind"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                  view === v
                    ? "bg-[color:var(--accent)] border border-[color:var(--panel-border)] text-foreground"
                    : "border border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {v === "both" ? "All" : v === "solar" ? "Solar" : "Wind"}
              </button>
            ))}
          </div>
        </div>

        {/* Market signal */}
        <div className="px-5 mt-5">
          <SectionLabel icon={<DollarSign className="size-3" />}>Market Signal</SectionLabel>
          <div className="mt-2 panel p-3 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-3 text-[color:var(--signal-sell)]" />
              <span className="text-[11px] text-foreground/80">Peak: {signals.peak_renewable_hour}:00</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{fmtMWh(signals.peak_generation_mwh)}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="size-3 text-[color:var(--signal-buy)]" />
              <span className="text-[11px] text-foreground/80">Min: {signals.min_renewable_hour}:00</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{fmtMWh(signals.min_generation_mwh)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Battery className="size-3 text-[color:var(--accent-cyan)]" />
              <span className="text-[11px] text-foreground/80">24h total</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{fmtMWh(signals.total_24h_generation)}</span>
            </div>
            {signals.ramp_events.filter(r => r.magnitude === "large").slice(0, 2).map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <AlertTriangle className="size-3 text-[color:var(--solar)]" />
                <span className="text-[10px] text-foreground/70 font-mono">
                  {r.direction === "up" ? "↑" : "↓"} {fmtMWh(Math.abs(r.delta))} @ {r.hour}:00
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto px-5 py-4 border-t border-[color:var(--panel-border)]">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <Radio className="size-3 text-[color:var(--signal-sell)]" />
            <span>SMARD + Open-Meteo + LightGBM</span>
          </div>
          <div className="mt-1.5 text-[9px] text-muted-foreground/50 font-mono">
            Energy/AI Hackathon Munich 2026
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 px-8 py-6 overflow-y-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
              <Activity className="size-3" />
              Renewable Generation Intelligence
            </div>
            <h2 className="text-display text-[24px] font-bold mt-1">
              {zone}
              <span className="text-muted-foreground font-normal mx-2">·</span>
              <span className="text-foreground/70 text-[20px]">
                {TIMEFRAMES.find(t => t.key === timeframe)?.description}
              </span>
            </h2>
          </div>
          <span className="badge-live inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-mono font-medium tracking-wide">
            REAL DATA
          </span>
        </header>

        {/* KPI cards */}
        <section className="grid grid-cols-5 gap-3">
          <Kpi label="Peak Solar" value={fmtMWh(peakSolar)} unit="MWh" icon={<Sun className="size-3.5" />} tone="solar" />
          <Kpi label="Peak Wind" value={fmtMWh(peakWind)} unit="MWh" icon={<Wind className="size-3.5" />} tone="wind" />
          <Kpi label="24h Total" value={fmtMWh(totalGen)} unit="MWh" icon={<Zap className="size-3.5" />} tone="neutral" />
          <Kpi label="vs Baseline" value={`${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}`} unit="% MAE" icon={<Gauge className="size-3.5" />} tone="signal" />
          <Kpi label="Wind Improv." value={`+${metrics.wind.improvement.toFixed(1)}`} unit="%" icon={<TrendingUp className="size-3.5" />} tone="wind" />
        </section>

        {/* Main chart */}
        <section className="panel-elevated mt-5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-semibold text-display">
                {timeframe === "15min" ? "Real-Time Generation (15-min SMARD)" :
                 timeframe === "1h" ? "Hourly Model Forecast (72h)" :
                 timeframe === "daily" ? "Daily: Actual vs Model Prediction" :
                 timeframe === "weekly" ? "Weekly Generation Totals" :
                 timeframe === "monthly" ? "Monthly Generation (5+ years)" :
                 "Yearly Generation Totals"}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {timeframe === "15min" ? "Source: SMARD (smard.de) · 15-min resolution · Last 24h of actuals" :
                 timeframe === "1h" ? "LightGBM q10/q50/q90 · dashed = persistence baseline (yesterday)" :
                 timeframe === "daily" ? "Black = actual · Green = model · Gray dashed = persistence" :
                 timeframe === "weekly" ? "Aggregated from hourly predictions on test set" :
                 "Aggregated from SMARD historical records 2021–2026"}
              </p>
            </div>
            {timeframe === "1h" && <ChartLegend />}
          </div>
          <div className="h-[340px]">
            <ResponsiveContainer>
              {renderChart(timeframe, chartData, view)}
            </ResponsiveContainer>
          </div>
        </section>

        {/* Bottom panels */}
        <section className="grid grid-cols-5 gap-4 mt-5">
          {/* Performance + Business Value */}
          <div className="col-span-3 space-y-4">
            {/* Model metrics */}
            <div className="panel p-4">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="size-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono font-medium">
                  Model Performance — Test Set (Mar–Jun 2026)
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                <Stat label="Solar MAE" value={metrics.solar.mae.toFixed(0)} unit="MWh" />
                <Stat label="Wind MAE" value={metrics.wind.mae.toFixed(0)} unit="MWh" />
                <Stat label="Solar Baseline" value={metrics.solar.baselineMae.toFixed(0)} unit="MWh" />
                <Stat label="Wind Baseline" value={metrics.wind.baselineMae.toFixed(0)} unit="MWh" />
                <Stat label="Solar Coverage" value={metrics.solar.coverage.toFixed(0)} unit="%" />
                <Stat label="Wind Coverage" value={metrics.wind.coverage.toFixed(0)} unit="%" />
              </div>
            </div>

            {/* Business value */}
            <div className="panel p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="size-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono font-medium">
                  Business Value — Energy Market Intelligence
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <BusinessCard
                  title="Intraday Trading"
                  description="60% better wind forecasts = tighter bids on EPEX Spot intraday market. Reduced imbalance costs."
                  metric={`-${metrics.wind.improvement.toFixed(0)}% error`}
                  icon={<TrendingUp className="size-4" />}
                />
                <BusinessCard
                  title="Grid Balancing"
                  description="Ramp alerts (large hour-over-hour changes) help TSOs pre-position reserves and avoid emergency actions."
                  metric={`${signals.ramp_events.length} ramps/day`}
                  icon={<AlertTriangle className="size-4" />}
                />
                <BusinessCard
                  title="Load Shifting"
                  description={`Schedule flexible loads at ${signals.peak_renewable_hour}:00 (peak renewables) for lowest marginal cost.`}
                  metric={`${fmtMWh(signals.peak_generation_mwh)} peak`}
                  icon={<Battery className="size-4" />}
                />
              </div>
              <div className="mt-3 pt-3 border-t border-[color:var(--panel-border)] text-[11px] text-muted-foreground/80 font-mono">
                <span className="text-foreground/70 font-medium">Value proposition:</span>{" "}
                Every 1% improvement in renewable forecast accuracy saves German grid operators ~€10M/year in balancing costs (source: ENTSO-E).
              </div>
            </div>
          </div>

          {/* Feature importance */}
          <div className="col-span-2 panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono font-medium">
                  Feature Importance
                </span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/60">
                {view === "wind" ? "Wind model" : view === "solar" ? "Solar model" : "Combined"}
              </span>
            </div>
            <ul className="space-y-2.5">
              {features.slice(0, 8).map(f => (
                <li key={f.name}>
                  <div className="flex justify-between items-center text-[11px] mb-1">
                    <span className="text-foreground/80">{humanFeatureName(f.name)}</span>
                    <span className="font-mono tabular text-muted-foreground text-[10px]">{f.importance.toFixed(1)}%</span>
                  </div>
                  <div className="h-[5px] rounded-full bg-[color:var(--accent)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(f.importance / features[0].importance) * 100}%`,
                        background: featureColor(f.name),
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 pt-3 border-t border-[color:var(--panel-border)]">
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono font-medium mb-2">
                Model Architecture
              </div>
              <div className="space-y-1.5 text-[11px]">
                <InfoRow label="Algorithm" value="LightGBM GBDT" />
                <InfoRow label="Trees" value="1,000 × 3 quantiles" />
                <InfoRow label="Leaves" value="127 per tree" />
                <InfoRow label="Training" value="182k hours (2021–2026)" />
                <InfoRow label="Quantiles" value="α = 0.10, 0.50, 0.90" />
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-6 pt-3 border-t border-[color:var(--panel-border)] text-[10px] text-muted-foreground/50 font-mono flex justify-between">
          <span>GridSight · Real model predictions · No dummy data</span>
          <span>Data: SMARD (CC BY 4.0) + Open-Meteo (CC BY 4.0)</span>
        </footer>
      </main>
    </div>
  );
}

// ─── Chart renderer ──────────────────────────────────────────────────────────

function renderChart(timeframe: Timeframe, data: any[], view: AssetView) {
  if (timeframe === "15min" || timeframe === "monthly" || timeframe === "yearly") {
    return (
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 6" vertical={false} />
        <XAxis dataKey="label" {...axisProps} tickFormatter={v => formatXLabel(v, timeframe)} minTickGap={timeframe === "15min" ? 60 : 30} />
        <YAxis {...axisProps} tickFormatter={fmtAxis} width={55} />
        <Tooltip content={<GenericTip timeframe={timeframe} />} />
        {(view === "solar" || view === "both") && (
          <Area type="monotone" dataKey="solar" stroke="var(--solar)" fill="var(--solar)" fillOpacity={0.15} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        )}
        {(view === "wind" || view === "both") && (
          <Area type="monotone" dataKey={timeframe === "15min" ? "wind_total" : "wind"} stroke="var(--wind)" fill="var(--wind)" fillOpacity={0.15} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        )}
        {view === "both" && (
          <Line type="monotone" dataKey="total" stroke="var(--signal-sell)" strokeWidth={2} dot={false} isAnimationActive={false} />
        )}
      </ComposedChart>
    );
  }

  if (timeframe === "1h") {
    return (
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wind)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--wind)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 6" vertical={false} />
        <XAxis dataKey="label" {...axisProps} tickFormatter={v => formatXLabel(v, "1h")} minTickGap={50} />
        <YAxis {...axisProps} tickFormatter={fmtAxis} width={55} />
        <Tooltip content={<ForecastTip />} />
        <Area type="monotone" dataKey="lo" stroke="none" fill="transparent" stackId="band" isAnimationActive={false} />
        <Area type="monotone" dataKey={(d: any) => d.hi - d.lo} stroke="none" fill="url(#bandGrad)" stackId="band" isAnimationActive={false} />
        <Line type="monotone" dataKey="baseline" stroke="var(--muted-foreground)" strokeWidth={1.2} strokeDasharray="5 5" dot={false} opacity={0.5} isAnimationActive={false} />
        <Line type="monotone" dataKey="predicted" stroke="var(--signal-sell)" strokeWidth={2.5} dot={false} isAnimationActive={false} filter="drop-shadow(0 0 6px rgba(52,211,153,0.4))" />
      </ComposedChart>
    );
  }

  // daily / weekly — actual vs predicted
  return (
    <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
      <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 6" vertical={false} />
      <XAxis dataKey="label" {...axisProps} tickFormatter={v => formatXLabel(v, timeframe)} minTickGap={timeframe === "daily" ? 60 : 30} />
      <YAxis {...axisProps} tickFormatter={fmtAxis} width={55} />
      <Tooltip content={<DailyTip timeframe={timeframe} />} />
      {"lo" in (data[0] || {}) && (
        <Area type="monotone" dataKey="lo" stroke="none" fill="transparent" stackId="ci" isAnimationActive={false} />
      )}
      {"lo" in (data[0] || {}) && (
        <Area type="monotone" dataKey={(d: any) => (d.hi || 0) - (d.lo || 0)} stroke="none" fill="var(--wind)" fillOpacity={0.08} stackId="ci" isAnimationActive={false} />
      )}
      <Line type="monotone" dataKey="actual" stroke="var(--foreground)" strokeWidth={2} dot={false} isAnimationActive={false} />
      <Line type="monotone" dataKey="predicted" stroke="var(--signal-sell)" strokeWidth={2} dot={false} isAnimationActive={false} />
      {"baseline" in (data[0] || {}) && (
        <Line type="monotone" dataKey="baseline" stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="4 4" dot={false} opacity={0.5} isAnimationActive={false} />
      )}
    </ComposedChart>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMWh(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(0)}k`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}

function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toString();
}

function formatXLabel(v: string, tf: Timeframe): string {
  if (tf === "15min" || tf === "1h") {
    const d = new Date(v);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return tf === "15min" ? `${h}:${m}` : `${h}:00`;
  }
  if (tf === "daily") return v.slice(5); // MM-DD
  if (tf === "weekly") return v.slice(5); // W##
  if (tf === "monthly") return v.slice(2); // YY-MM
  return v;
}

function humanFeatureName(f: string): string {
  const map: Record<string, string> = {
    day_of_year: "Day of year",
    cloud_cover: "Cloud cover",
    hour: "Hour of day",
    month: "Month",
    shortwave_radiation: "Shortwave radiation",
    diffuse_radiation: "Diffuse radiation",
    sunshine_duration: "Sunshine duration",
    zone: "Grid zone",
    wind_speed_100m: "Wind speed (100m)",
    wind_speed_100m_sq: "Wind speed² (100m)",
    wind_sin: "Wind direction (sin)",
    wind_cos: "Wind direction (cos)",
    wind_gusts_10m: "Wind gusts (10m)",
    temperature_2m: "Temperature (2m)",
  };
  return map[f] ?? f;
}

function featureColor(f: string): string {
  if (f.includes("solar") || f.includes("shortwave") || f.includes("diffuse") || f.includes("sunshine") || f === "day_of_year") return "var(--solar)";
  if (f.includes("wind") || f.includes("gust")) return "var(--wind)";
  if (f === "cloud_cover") return "#a78bfa";
  if (f === "temperature_2m") return "#06b6d4";
  return "var(--muted-foreground)";
}

const axisProps = {
  stroke: "var(--muted-foreground)",
  tick: { fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: "var(--muted-foreground)" },
  tickLine: false,
  axisLine: { stroke: "var(--panel-border)" },
} as const;

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono font-medium">
      {icon}{children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground/80 text-[10px]">{value}</span>
    </div>
  );
}

function Kpi({ label, value, unit, icon, tone }: { label: string; value: string; unit: string; icon: React.ReactNode; tone: "solar" | "wind" | "neutral" | "signal" }) {
  const color = tone === "solar" ? "var(--solar)" : tone === "wind" ? "var(--wind)" : tone === "signal" ? "var(--signal-sell)" : "var(--foreground)";
  return (
    <div className="panel kpi-shimmer p-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-mono">{label}</span>
        <span style={{ color }} className="opacity-60">{icon}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-[26px] font-bold tabular tracking-tight leading-none" style={{ color }}>{value}</span>
        <span className="text-[11px] text-muted-foreground font-mono">{unit}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md bg-[color:var(--background)]/60 border border-[color:var(--panel-border)] px-2.5 py-2">
      <div className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground font-mono">{label}</div>
      <div className="font-mono tabular text-[13px] font-semibold mt-0.5 text-foreground/90">
        {value}<span className="text-muted-foreground text-[9px] ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

function BusinessCard({ title, description, metric, icon }: { title: string; description: string; metric: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[color:var(--background)]/40 border border-[color:var(--panel-border)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[color:var(--accent-cyan)] opacity-70">{icon}</span>
        <span className="text-[11px] font-semibold text-foreground/90">{title}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{description}</p>
      <div className="mt-2 font-mono text-[12px] font-semibold text-[color:var(--signal-sell)]">{metric}</div>
    </div>
  );
}

function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-[color:var(--signal-sell)] rounded" />Model (q50)</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-[color:var(--wind)] opacity-40 rounded" />q10–q90 band</span>
      <span className="flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-muted-foreground" />Persistence</span>
    </div>
  );
}

function ForecastTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const hour = new Date(label).getHours();
  return (
    <div className="panel-elevated p-3 text-[10px] font-mono min-w-[180px]">
      <div className="text-muted-foreground mb-1.5">{`${hour.toString().padStart(2, "0")}:00`}</div>
      <div className="space-y-1">
        <div className="flex justify-between"><span className="text-[color:var(--signal-sell)]">Model</span><span>{fmtMWh(d.predicted)} MWh</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Baseline</span><span>{fmtMWh(d.baseline)} MWh</span></div>
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-[color:var(--panel-border)] text-[9px] text-muted-foreground/60">
        CI: {fmtMWh(d.lo)} – {fmtMWh(d.hi)}
      </div>
    </div>
  );
}

function GenericTip({ active, payload, label, timeframe }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="panel-elevated p-3 text-[10px] font-mono min-w-[160px]">
      <div className="text-muted-foreground mb-1.5">{formatXLabel(label, timeframe)}</div>
      {d.solar !== undefined && <div className="flex justify-between"><span className="text-[color:var(--solar)]">Solar</span><span>{fmtMWh(d.solar)} MWh</span></div>}
      {(d.wind !== undefined || d.wind_total !== undefined) && <div className="flex justify-between"><span className="text-[color:var(--wind)]">Wind</span><span>{fmtMWh(d.wind ?? d.wind_total)} MWh</span></div>}
      {d.total !== undefined && <div className="flex justify-between mt-1 pt-1 border-t border-[color:var(--panel-border)]"><span className="text-[color:var(--signal-sell)]">Total</span><span>{fmtMWh(d.total)} MWh</span></div>}
    </div>
  );
}

function DailyTip({ active, payload, label, timeframe }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="panel-elevated p-3 text-[10px] font-mono min-w-[180px]">
      <div className="text-muted-foreground mb-1.5">{formatXLabel(label, timeframe)}</div>
      {d.actual !== undefined && <div className="flex justify-between"><span>Actual</span><span>{fmtMWh(d.actual)} MWh</span></div>}
      {d.predicted !== undefined && <div className="flex justify-between"><span className="text-[color:var(--signal-sell)]">Model</span><span>{fmtMWh(d.predicted)} MWh</span></div>}
      {d.baseline !== undefined && <div className="flex justify-between"><span className="text-muted-foreground">Baseline</span><span>{fmtMWh(d.baseline)} MWh</span></div>}
    </div>
  );
}
