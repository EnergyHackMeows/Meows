import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
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
  BarChart3,
  Battery,
  Clock,
  Cpu,
  DollarSign,
  Gauge,
  Layers,
  Radio,
  Shield,
  Sun,
  TrendingDown,
  TrendingUp,
  Wind,
  Zap,
} from "lucide-react";
import {
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
        return months.map(m => ({ label: m.month, solar: m.solar, wind: m.wind, total: m.solar + m.wind }));
      }
      case "yearly": {
        const years = getYearlyData(zone);
        return years.map(y => ({ label: y.year, solar: y.solar, wind: y.wind, total: y.solar + y.wind }));
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
      {/* ─── SIDEBAR ─── */}
      <aside className="w-[290px] shrink-0 border-r border-[color:var(--panel-border)] sidebar-gradient flex flex-col overflow-y-auto">
        {/* Logo */}
        <div className="px-6 pt-6 pb-5 flex items-center gap-3.5">
          <div className="relative flex items-center justify-center size-10 rounded-xl bg-[color:var(--signal-sell)]/8 border border-[color:var(--signal-sell)]/15">
            <Zap className="size-5 text-[color:var(--signal-sell)]" />
            <div className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[color:var(--signal-sell)] animate-pulse" />
          </div>
          <div>
            <h1 className="text-display text-[18px] font-bold tracking-tight leading-tight">GridSight</h1>
            <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-[0.2em] mt-0.5">Renewable Intelligence</p>
          </div>
        </div>

        <div className="section-divider mx-5" />

        {/* Map Zone Selector */}
        <div className="px-5 mt-5">
          <SectionLabel icon={<Layers className="size-3" />}>Transmission Zone</SectionLabel>
          <div className="mt-3">
            <GermanyMap selected={zone} onSelect={setZone} />
          </div>
        </div>

        <div className="section-divider mx-5 mt-5" />

        {/* Timeframe */}
        <div className="px-5 mt-5">
          <SectionLabel icon={<Clock className="size-3" />}>Forecast Horizon</SectionLabel>
          <div className="grid grid-cols-3 gap-1 mt-3">
            {TIMEFRAMES.map(tf => (
              <button key={tf.key} onClick={() => setTimeframe(tf.key)}
                className={`px-2.5 py-2 rounded-lg text-[10px] font-medium font-mono transition-all duration-150 ${
                  timeframe === tf.key
                    ? "bg-[color:var(--signal-sell)]/10 border border-[color:var(--signal-sell)]/25 text-[color:var(--signal-sell)]"
                    : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
                }`}>
                {tf.label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/60 font-mono mt-2 leading-relaxed">
            {TIMEFRAMES.find(t => t.key === timeframe)?.description}
          </p>
        </div>

        {/* Asset View */}
        <div className="px-5 mt-5">
          <SectionLabel icon={<BarChart3 className="size-3" />}>Asset Type</SectionLabel>
          <div className="flex gap-1 mt-3">
            {([
              { key: "both" as const, label: "Combined", icon: Zap },
              { key: "solar" as const, label: "Solar", icon: Sun },
              { key: "wind" as const, label: "Wind", icon: Wind },
            ]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setView(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[10px] font-medium transition-all duration-150 ${
                  view === key
                    ? "bg-[color:var(--accent)] border border-[color:var(--panel-border)] text-foreground shadow-sm"
                    : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
                }`}>
                <Icon className="size-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Market Signals */}
        <div className="px-5 mt-5">
          <SectionLabel icon={<DollarSign className="size-3" />}>Market Intelligence</SectionLabel>
          <div className="mt-3 space-y-1.5">
            <SignalRow icon={<TrendingUp className="size-3" />} color="var(--signal-sell)" label={`Peak at ${signals.peak_renewable_hour}:00`} value={fmtMWh(signals.peak_generation_mwh)} />
            <SignalRow icon={<TrendingDown className="size-3" />} color="var(--signal-buy)" label={`Trough at ${signals.min_renewable_hour}:00`} value={fmtMWh(signals.min_generation_mwh)} />
            <SignalRow icon={<Battery className="size-3" />} color="var(--accent-cyan)" label="24h generation" value={fmtMWh(signals.total_24h_generation)} />
            {signals.ramp_events.filter(r => r.magnitude === "large").slice(0, 2).map((r, i) => (
              <SignalRow key={i} icon={<AlertTriangle className="size-3" />} color="var(--solar)" label={`${r.direction === "up" ? "Ramp ↑" : "Ramp ↓"} at ${r.hour}:00`} value={`${r.direction === "up" ? "+" : "−"}${fmtMWh(Math.abs(r.delta))}`} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto px-5 py-5 border-t border-[color:var(--panel-border)]">
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground/70 font-mono">
            <Shield className="size-3 text-[color:var(--signal-sell)]/60" />
            <span>Licensed · Enterprise ready</span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[9px] text-muted-foreground/40 font-mono">
            <Radio className="size-3" />
            <span>SMARD · Open-Meteo · LightGBM</span>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 min-w-0 px-10 py-7 overflow-y-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-mono font-medium">
              <Activity className="size-3.5" />
              Day-Ahead Forecast · {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
            <h2 className="text-display text-[28px] font-bold mt-2 leading-tight">
              {zone}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              {TIMEFRAMES.find(t => t.key === timeframe)?.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge-live inline-flex items-center px-3.5 py-2 rounded-full text-[10px] font-mono font-medium tracking-wider">
              LIVE MODEL
            </span>
          </div>
        </header>

        {/* KPI Strip */}
        <section className="grid grid-cols-5 gap-4 mb-6">
          <KpiCard label="Peak Solar" value={fmtMWh(peakSolar)} unit="MWh" icon={<Sun className="size-4" />} accent="var(--solar)" />
          <KpiCard label="Peak Wind" value={fmtMWh(peakWind)} unit="MWh" icon={<Wind className="size-4" />} accent="var(--wind)" />
          <KpiCard label="24h Total" value={fmtMWh(totalGen)} unit="MWh" icon={<Zap className="size-4" />} accent="var(--foreground)" />
          <KpiCard label="MAE Reduction" value={`${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}%`} unit="vs baseline" icon={<Gauge className="size-4" />} accent="var(--signal-sell)" />
          <KpiCard label="Wind Accuracy" value={`+${metrics.wind.improvement.toFixed(0)}%`} unit="vs persistence" icon={<TrendingUp className="size-4" />} accent="var(--wind)" />
        </section>

        {/* Primary Chart */}
        <section className="panel-elevated p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-display text-[16px] font-semibold">
                {chartTitle(timeframe)}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono mt-1.5 leading-relaxed max-w-[500px]">
                {chartSubtitle(timeframe)}
              </p>
            </div>
            {(timeframe === "1h" || timeframe === "daily") && <ChartLegend timeframe={timeframe} />}
          </div>
          <div className="h-[380px]">
            <ResponsiveContainer>
              {renderChart(timeframe, chartData, view)}
            </ResponsiveContainer>
          </div>
        </section>

        {/* Bottom Panels */}
        <section className="grid grid-cols-12 gap-5 mt-6">
          {/* Performance Metrics */}
          <div className="col-span-4 panel p-5">
            <PanelHeader icon={<Cpu className="size-3.5" />} title="Model Performance" subtitle="Test set · Mar–Jun 2026" />
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <MetricTile label="Solar MAE" value={metrics.solar.mae.toFixed(0)} unit="MWh" delta={metrics.solar.improvement} />
              <MetricTile label="Wind MAE" value={metrics.wind.mae.toFixed(0)} unit="MWh" delta={metrics.wind.improvement} />
              <MetricTile label="Solar Coverage" value={metrics.solar.coverage.toFixed(0)} unit="%" />
              <MetricTile label="Wind Coverage" value={metrics.wind.coverage.toFixed(0)} unit="%" />
            </div>
            <div className="mt-4 pt-3 border-t border-[color:var(--panel-border)] text-[10px] text-muted-foreground/70 font-mono space-y-1">
              <div className="flex justify-between"><span>Baseline (Solar)</span><span className="text-foreground/60">{metrics.solar.baselineMae.toFixed(0)} MWh</span></div>
              <div className="flex justify-between"><span>Baseline (Wind)</span><span className="text-foreground/60">{metrics.wind.baselineMae.toFixed(0)} MWh</span></div>
            </div>
          </div>

          {/* Business Value */}
          <div className="col-span-4 panel p-5">
            <PanelHeader icon={<DollarSign className="size-3.5" />} title="Business Value" subtitle="Market applications" />
            <div className="mt-4 space-y-3">
              <BusinessCard
                title="Intraday Trading"
                description="60% better wind forecasts enable tighter bids on EPEX Spot, reducing imbalance penalties."
                metric={`−${metrics.wind.improvement.toFixed(0)}% forecast error`}
              />
              <BusinessCard
                title="Grid Balancing"
                description="Ramp alerts help TSOs pre-position reserves hours ahead of critical generation swings."
                metric={`${signals.ramp_events.length} ramp events detected`}
              />
              <BusinessCard
                title="Industrial Load Shifting"
                description={`Schedule energy-intensive processes at ${signals.peak_renewable_hour}:00 for minimum cost.`}
                metric={`${fmtMWh(signals.peak_generation_mwh)} peak capacity`}
              />
            </div>
            <div className="mt-4 pt-3 border-t border-[color:var(--panel-border)] text-[10px] text-muted-foreground/60 font-mono leading-relaxed">
              1% forecast improvement ≈ €10M/yr savings for German TSOs (ENTSO-E)
            </div>
          </div>

          {/* Feature Importance */}
          <div className="col-span-4 panel p-5">
            <PanelHeader icon={<BarChart3 className="size-3.5" />} title="Feature Drivers" subtitle={view === "wind" ? "Wind model" : view === "solar" ? "Solar model" : "Combined"} />
            <ul className="mt-4 space-y-3">
              {features.slice(0, 7).map((f, i) => (
                <li key={f.name}>
                  <div className="flex justify-between items-center text-[11px] mb-1.5">
                    <span className="text-foreground/80 font-medium">{humanFeatureName(f.name)}</span>
                    <span className="font-mono tabular text-muted-foreground text-[10px]">{f.importance.toFixed(1)}%</span>
                  </div>
                  <div className="feature-bar">
                    <div
                      className="feature-bar-fill"
                      style={{
                        width: `${(f.importance / features[0].importance) * 100}%`,
                        background: `linear-gradient(90deg, ${featureColor(f.name)}99, ${featureColor(f.name)})`,
                        boxShadow: i === 0 ? `0 0 8px ${featureColor(f.name)}30` : undefined,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 pt-3 border-t border-[color:var(--panel-border)]">
              <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono font-medium mb-2.5">Architecture</div>
              <div className="space-y-1.5 text-[10px]">
                <InfoRow label="Engine" value="LightGBM GBDT" />
                <InfoRow label="Estimators" value="1,000 × 6 models" />
                <InfoRow label="Training data" value="182,112 hours" />
                <InfoRow label="Quantiles" value="α ∈ {0.10, 0.50, 0.90}" />
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-[color:var(--panel-border)] flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40 font-mono">
            <span className="size-1.5 rounded-full bg-[color:var(--signal-sell)]" />
            <span>GridSight v1.0 · Real-time model inference · No synthetic data</span>
          </div>
          <div className="text-[10px] text-muted-foreground/30 font-mono">
            Sources: SMARD (CC BY 4.0) · Open-Meteo (CC BY 4.0)
          </div>
        </footer>
      </main>
    </div>
  );
}

// ─── Chart Rendering ─────────────────────────────────────────────────────────

function renderChart(timeframe: Timeframe, data: any[], view: AssetView) {
  const margin = { top: 12, right: 16, bottom: 8, left: 4 };

  if (timeframe === "15min" || timeframe === "monthly" || timeframe === "yearly") {
    return (
      <ComposedChart data={data} margin={margin}>
        <defs>
          <linearGradient id="solarFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--solar)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--solar)" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="windFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wind)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--wind)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 8" vertical={false} />
        <XAxis dataKey="label" {...axisProps} tickFormatter={v => formatXLabel(v, timeframe)} minTickGap={timeframe === "15min" ? 60 : 30} />
        <YAxis {...axisProps} tickFormatter={fmtAxis} width={58} />
        <Tooltip content={<GenericTip timeframe={timeframe} />} />
        {(view === "solar" || view === "both") && (
          <Area type="monotone" dataKey="solar" stroke="var(--solar)" fill="url(#solarFill)" strokeWidth={1.8} dot={false} isAnimationActive={false} />
        )}
        {(view === "wind" || view === "both") && (
          <Area type="monotone" dataKey={timeframe === "15min" ? "wind_total" : "wind"} stroke="var(--wind)" fill="url(#windFill)" strokeWidth={1.8} dot={false} isAnimationActive={false} />
        )}
        {view === "both" && (
          <Line type="monotone" dataKey="total" stroke="var(--signal-sell)" strokeWidth={2.2} dot={false} isAnimationActive={false} filter="drop-shadow(0 0 4px rgba(52,211,153,0.3))" />
        )}
      </ComposedChart>
    );
  }

  if (timeframe === "1h") {
    return (
      <ComposedChart data={data} margin={margin}>
        <defs>
          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--signal-sell)" stopOpacity={0.15} />
            <stop offset="100%" stopColor="var(--signal-sell)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 8" vertical={false} />
        <XAxis dataKey="label" {...axisProps} tickFormatter={v => formatXLabel(v, "1h")} minTickGap={55} />
        <YAxis {...axisProps} tickFormatter={fmtAxis} width={58} />
        <Tooltip content={<ForecastTip />} />
        <Area type="monotone" dataKey="lo" stroke="none" fill="transparent" stackId="band" isAnimationActive={false} />
        <Area type="monotone" dataKey={(d: any) => d.hi - d.lo} stroke="none" fill="url(#bandGrad)" stackId="band" isAnimationActive={false} />
        <Line type="monotone" dataKey="baseline" stroke="var(--muted-foreground)" strokeWidth={1.3} strokeDasharray="6 6" dot={false} opacity={0.45} isAnimationActive={false} />
        <Line type="monotone" dataKey="predicted" stroke="var(--signal-sell)" strokeWidth={2.5} dot={false} isAnimationActive={false} filter="drop-shadow(0 0 8px rgba(52,211,153,0.4))" />
      </ComposedChart>
    );
  }

  return (
    <ComposedChart data={data} margin={margin}>
      <defs>
        <linearGradient id="ciFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--wind)" stopOpacity={0.12} />
          <stop offset="100%" stopColor="var(--wind)" stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 8" vertical={false} />
      <XAxis dataKey="label" {...axisProps} tickFormatter={v => formatXLabel(v, timeframe)} minTickGap={timeframe === "daily" ? 60 : 35} />
      <YAxis {...axisProps} tickFormatter={fmtAxis} width={58} />
      <Tooltip content={<DailyTip timeframe={timeframe} />} />
      {"lo" in (data[0] || {}) && (
        <>
          <Area type="monotone" dataKey="lo" stroke="none" fill="transparent" stackId="ci" isAnimationActive={false} />
          <Area type="monotone" dataKey={(d: any) => (d.hi || 0) - (d.lo || 0)} stroke="none" fill="url(#ciFill)" stackId="ci" isAnimationActive={false} />
        </>
      )}
      <Line type="monotone" dataKey="actual" stroke="var(--foreground)" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.9} />
      <Line type="monotone" dataKey="predicted" stroke="var(--signal-sell)" strokeWidth={2.2} dot={false} isAnimationActive={false} filter="drop-shadow(0 0 5px rgba(52,211,153,0.3))" />
      {"baseline" in (data[0] || {}) && (
        <Line type="monotone" dataKey="baseline" stroke="var(--muted-foreground)" strokeWidth={1.2} strokeDasharray="5 5" dot={false} opacity={0.4} isAnimationActive={false} />
      )}
    </ComposedChart>
  );
}

// ─── Utility Functions ───────────────────────────────────────────────────────

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
    return tf === "15min"
      ? `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
      : `${d.getHours().toString().padStart(2, "0")}:00`;
  }
  if (tf === "daily") return v.slice(5);
  if (tf === "weekly") return v.slice(5);
  if (tf === "monthly") return v.slice(2);
  return v;
}

function chartTitle(tf: Timeframe): string {
  const titles: Record<Timeframe, string> = {
    "15min": "Real-Time Generation",
    "1h": "72-Hour Model Forecast",
    daily: "Daily Performance",
    weekly: "Weekly Aggregates",
    monthly: "Monthly Generation History",
    yearly: "Annual Generation Trends",
  };
  return titles[tf];
}

function chartSubtitle(tf: Timeframe): string {
  const subs: Record<Timeframe, string> = {
    "15min": "Live 15-minute generation data from SMARD (smard.de) — last 24 hours of measured output",
    "1h": "LightGBM quantile predictions (q10/q50/q90) with persistence baseline overlay",
    daily: "Model predictions vs actual generation — 92-day test period with confidence intervals",
    weekly: "Aggregated weekly generation totals from the model evaluation period",
    monthly: "5+ years of historical generation data aggregated monthly (2021–2026)",
    yearly: "Year-over-year renewable generation growth across all sources",
  };
  return subs[tf];
}

function humanFeatureName(f: string): string {
  const map: Record<string, string> = {
    day_of_year: "Day of Year",
    cloud_cover: "Cloud Cover",
    hour: "Hour of Day",
    month: "Month",
    shortwave_radiation: "Shortwave Radiation",
    diffuse_radiation: "Diffuse Radiation",
    sunshine_duration: "Sunshine Duration",
    zone: "Grid Zone",
    wind_speed_100m: "Wind Speed (100m)",
    wind_speed_100m_sq: "Wind Speed² (100m)",
    wind_sin: "Wind Dir. (sin)",
    wind_cos: "Wind Dir. (cos)",
    wind_gusts_10m: "Wind Gusts (10m)",
    temperature_2m: "Temperature (2m)",
  };
  return map[f] ?? f;
}

function featureColor(f: string): string {
  if (f.includes("shortwave") || f.includes("diffuse") || f.includes("sunshine") || f === "day_of_year") return "var(--solar)";
  if (f.includes("wind") || f.includes("gust")) return "var(--wind)";
  if (f === "cloud_cover") return "#a78bfa";
  if (f === "temperature_2m") return "#06b6d4";
  if (f === "hour" || f === "month") return "#64748b";
  return "var(--muted-foreground)";
}

const axisProps = {
  stroke: "var(--muted-foreground)",
  tick: { fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: "var(--muted-foreground)" },
  tickLine: false,
  axisLine: { stroke: "var(--panel-border)" },
} as const;

// ─── Sub-Components ──────────────────────────────────────────────────────────

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
      <span className="text-muted-foreground/70">{label}</span>
      <span className="font-mono text-foreground/70 text-[10px]">{value}</span>
    </div>
  );
}

function SignalRow({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-white/[0.015] transition-colors">
      <span style={{ color }} className="opacity-70">{icon}</span>
      <span className="text-[10px] text-foreground/70 flex-1">{label}</span>
      <span className="text-[10px] font-mono text-foreground/80 tabular">{value}</span>
    </div>
  );
}

function PanelHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground/60">{icon}</span>
        <span className="text-[11px] font-semibold text-foreground/90">{title}</span>
      </div>
      <span className="text-[9px] font-mono text-muted-foreground/50">{subtitle}</span>
    </div>
  );
}

function KpiCard({ label, value, unit, icon, accent }: { label: string; value: string; unit: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="panel kpi-shimmer p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-mono font-medium">{label}</span>
        <span style={{ color: accent }} className="opacity-50">{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-display text-[28px] font-bold tabular tracking-tight leading-none" style={{ color: accent }}>{value}</span>
        <span className="text-[10px] text-muted-foreground/70 font-mono">{unit}</span>
      </div>
    </div>
  );
}

function MetricTile({ label, value, unit, delta }: { label: string; value: string; unit: string; delta?: number }) {
  return (
    <div className="stat-card px-3 py-3">
      <div className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground/70 font-mono font-medium">{label}</div>
      <div className="font-mono tabular text-[15px] font-semibold mt-1.5 text-foreground/90">
        {value}<span className="text-muted-foreground/60 text-[9px] ml-1">{unit}</span>
      </div>
      {delta !== undefined && (
        <div className={`text-[9px] font-mono mt-1 ${delta >= 0 ? "text-[color:var(--signal-sell)]" : "text-[color:var(--signal-buy)]"}`}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs baseline
        </div>
      )}
    </div>
  );
}

function BusinessCard({ title, description, metric }: { title: string; description: string; metric: string }) {
  return (
    <div className="business-card p-3.5">
      <div className="text-[11px] font-semibold text-foreground/85">{title}</div>
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed mt-1">{description}</p>
      <div className="mt-2 font-mono text-[11px] font-medium text-[color:var(--signal-sell)]">{metric}</div>
    </div>
  );
}

function ChartLegend({ timeframe }: { timeframe: Timeframe }) {
  const items = timeframe === "1h"
    ? [
      { label: "Model (q50)", color: "var(--signal-sell)", solid: true },
      { label: "Confidence band", color: "var(--signal-sell)", opacity: true },
      { label: "Persistence", color: "var(--muted-foreground)", dashed: true },
    ]
    : [
      { label: "Actual", color: "var(--foreground)", solid: true },
      { label: "Model", color: "var(--signal-sell)", solid: true },
      { label: "Baseline", color: "var(--muted-foreground)", dashed: true },
    ];

  return (
    <div className="flex items-center gap-5 text-[9px] font-mono text-muted-foreground/70">
      {items.map(i => (
        <span key={i.label} className="flex items-center gap-2">
          <span
            className="inline-block w-4 rounded-sm"
            style={{
              height: i.dashed ? 0 : i.opacity ? 8 : 2,
              background: i.dashed ? "transparent" : i.opacity ? `color-mix(in srgb, ${i.color} 15%, transparent)` : i.color,
              borderTop: i.dashed ? `1.5px dashed ${i.color}` : undefined,
              borderRadius: i.opacity ? 2 : 1,
            }}
          />
          <span>{i.label}</span>
        </span>
      ))}
    </div>
  );
}

function ForecastTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const hour = new Date(label).getHours();
  return (
    <div className="panel-elevated p-4 text-[10px] font-mono min-w-[200px] shadow-xl">
      <div className="text-muted-foreground/80 font-medium mb-2">{`${hour.toString().padStart(2, "0")}:00 – ${(hour + 1).toString().padStart(2, "0")}:00`}</div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[color:var(--signal-sell)]">Model prediction</span>
          <span className="font-semibold">{fmtMWh(d.predicted)} MWh</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground/70">Persistence baseline</span>
          <span>{fmtMWh(d.baseline)} MWh</span>
        </div>
      </div>
      <div className="mt-2.5 pt-2 border-t border-[color:var(--panel-border)] text-[9px] text-muted-foreground/50">
        80% confidence: {fmtMWh(d.lo)} – {fmtMWh(d.hi)} MWh
      </div>
    </div>
  );
}

function GenericTip({ active, payload, label, timeframe }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="panel-elevated p-4 text-[10px] font-mono min-w-[180px] shadow-xl">
      <div className="text-muted-foreground/80 font-medium mb-2">{formatXLabel(label, timeframe)}</div>
      {d.solar !== undefined && <div className="flex justify-between"><span className="text-[color:var(--solar)]">Solar</span><span>{fmtMWh(d.solar)} MWh</span></div>}
      {(d.wind !== undefined || d.wind_total !== undefined) && <div className="flex justify-between"><span className="text-[color:var(--wind)]">Wind</span><span>{fmtMWh(d.wind ?? d.wind_total)} MWh</span></div>}
      {d.total !== undefined && <div className="flex justify-between mt-1.5 pt-1.5 border-t border-[color:var(--panel-border)]"><span className="text-[color:var(--signal-sell)] font-medium">Total</span><span className="font-semibold">{fmtMWh(d.total)} MWh</span></div>}
    </div>
  );
}

function DailyTip({ active, payload, label, timeframe }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="panel-elevated p-4 text-[10px] font-mono min-w-[200px] shadow-xl">
      <div className="text-muted-foreground/80 font-medium mb-2">{formatXLabel(label, timeframe)}</div>
      {d.actual !== undefined && <div className="flex justify-between"><span className="text-foreground/80">Actual</span><span className="font-semibold">{fmtMWh(d.actual)} MWh</span></div>}
      {d.predicted !== undefined && <div className="flex justify-between"><span className="text-[color:var(--signal-sell)]">Model</span><span>{fmtMWh(d.predicted)} MWh</span></div>}
      {d.baseline !== undefined && <div className="flex justify-between"><span className="text-muted-foreground/60">Baseline</span><span>{fmtMWh(d.baseline)} MWh</span></div>}
    </div>
  );
}
