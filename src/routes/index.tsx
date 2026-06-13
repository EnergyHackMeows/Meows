import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CircleDot,
  Clock,
  Shield,
  Sun,
  TrendingUp,
  Wind,
  Zap,
} from "lucide-react";

import { GermanyMap } from "../components/GermanyMap";
import {
  type Zone,
  ZONES,
  getMetrics,
  getForecast72h,
  getAlerts,
  getCongestion,
  getSavings,
  getFeatureImportance,
  getCriticalAlerts,
  formatEUR,
  formatMW,
  getPeakGeneration,
  getRampCount,
  getProduct,
} from "../lib/mock-data";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [zone, setZone] = useState<Zone>("All Germany");

  const metrics = useMemo(() => getMetrics(zone), [zone]);
  const forecast = useMemo(() => getForecast72h(zone), [zone]);
  const congestion = useMemo(() => getCongestion(zone), [zone]);
  const savings = useMemo(() => getSavings(zone), [zone]);
  const alerts = useMemo(() => getCriticalAlerts(zone), [zone]);
  const peak = useMemo(() => getPeakGeneration(zone), [zone]);
  const rampCount = useMemo(() => getRampCount(zone), [zone]);
  const product = getProduct();
  const solarImp = getFeatureImportance("solar");
  const windImp = getFeatureImportance("wind");

  const chartData = useMemo(
    () =>
      forecast.map((h) => ({
        ...h,
        time: h.ts.slice(11, 16),
        date: h.ts.slice(5, 10),
      })),
    [forecast]
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{product.name}</h1>
              <p className="text-xs text-white/40">{product.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="badge-live text-xs">LIVE</span>
            <span className="text-xs text-white/40">
              <Clock className="w-3 h-3 inline mr-1" />
              72h Forecast Window
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* ─── KPI Strip ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KPI
            label="Forecast Accuracy"
            value={`${metrics.wind.improvement > 0 ? "+" : ""}${metrics.wind.improvement}%`}
            sub="vs persistence (wind)"
            color="emerald"
            icon={<Shield className="w-4 h-4" />}
          />
          <KPI
            label="Peak Generation"
            value={`${formatMW(peak.value)} MW`}
            sub="next 72h"
            color="cyan"
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <KPI
            label="Congestion Risk"
            value={`${congestion.congestion_probability_pct}%`}
            sub={`${congestion.critical_hours} critical hrs`}
            color={congestion.congestion_probability_pct > 30 ? "red" : congestion.congestion_probability_pct > 10 ? "amber" : "emerald"}
            icon={<AlertTriangle className="w-4 h-4" />}
          />
          <KPI
            label="Ramp Events"
            value={`${rampCount}`}
            sub="detected in 72h"
            color={rampCount > 10 ? "red" : rampCount > 5 ? "amber" : "emerald"}
            icon={<Activity className="w-4 h-4" />}
          />
          <KPI
            label="Daily Savings"
            value={formatEUR(savings.daily_saving_eur)}
            sub="vs naive baseline"
            color="emerald"
            icon={<Zap className="w-4 h-4" />}
          />
          <KPI
            label="Annual Value"
            value={formatEUR(savings.annual_saving_eur)}
            sub="redispatch reduction"
            color="cyan"
            icon={<BarChart3 className="w-4 h-4" />}
          />
        </div>

        {/* ─── Main Grid: Chart + Map ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Forecast Chart */}
          <div className="lg:col-span-8 panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">72h Generation Forecast</h2>
                <p className="text-xs text-white/40 mt-0.5">{zone} — Renewable output with capacity threshold</p>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>Solar</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>Wind</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400"></span>Capacity</span>
              </div>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={11}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatMW(v)}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0e1420", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                    itemStyle={{ color: "rgba(255,255,255,0.8)" }}
                  />
                  <ReferenceLine
                    y={congestion.capacity_mw}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeOpacity={0.7}
                    label={{ value: "Capacity", fill: "#ef4444", fontSize: 10, position: "right" }}
                  />
                  <ReferenceLine
                    y={congestion.capacity_mw * 0.7}
                    stroke="#f59e0b"
                    strokeDasharray="2 4"
                    strokeOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="solar_q90"
                    stackId="band-s"
                    fill="url(#solarGrad)"
                    stroke="none"
                    name="Solar P90"
                  />
                  <Area
                    type="monotone"
                    dataKey="wind_q90"
                    stackId="band-w"
                    fill="url(#windGrad)"
                    stroke="none"
                    name="Wind P90"
                  />
                  <Line
                    type="monotone"
                    dataKey="solar_q50"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    name="Solar (MW)"
                  />
                  <Line
                    type="monotone"
                    dataKey="wind_q50"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                    name="Wind (MW)"
                  />
                  <Line
                    type="monotone"
                    dataKey="total_q50"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                    strokeDasharray="5 3"
                    name="Total (MW)"
                  />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    stroke="#6b7280"
                    strokeWidth={1}
                    dot={false}
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    name="Persistence"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Map + Zone Info */}
          <div className="lg:col-span-4 space-y-4">
            <div className="panel p-4">
              <h3 className="text-sm font-medium text-white/60 mb-3">Select TSO Region</h3>
              <GermanyMap
                selectedZone={zone}
                onZoneSelect={setZone}
                congestionData={Object.fromEntries(
                  ZONES.filter(z => z !== "All Germany").map(z => [z, getCongestion(z).congestion_probability_pct])
                )}
              />
            </div>
            <div className="panel p-4">
              <h3 className="text-sm font-medium text-white/60 mb-2">Zone Capacity</h3>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold">{formatMW(congestion.capacity_mw)} MW</p>
                  <p className="text-xs text-white/40">Installed renewable capacity</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-semibold ${congestion.peak_utilization_pct > 85 ? "text-red-400" : congestion.peak_utilization_pct > 60 ? "text-amber-400" : "text-emerald-400"}`}>
                    {congestion.peak_utilization_pct}%
                  </p>
                  <p className="text-xs text-white/40">Peak utilization</p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    congestion.peak_utilization_pct > 85 ? "bg-red-500" : congestion.peak_utilization_pct > 60 ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(congestion.peak_utilization_pct, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Alerts + Performance ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Alerts Feed */}
          <div className="lg:col-span-5 panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Grid Alerts
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                {alerts.length} active
              </span>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin">
              {alerts.length === 0 && (
                <p className="text-sm text-white/30 text-center py-8">No critical alerts for {zone}</p>
              )}
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                    alert.severity === "critical"
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-amber-500/5 border-amber-500/15"
                  }`}
                >
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    alert.severity === "critical" ? "bg-red-400 animate-pulse" : "bg-amber-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/60">{alert.zone}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-medium ${
                        alert.type === "ramp" ? "bg-purple-500/15 text-purple-300" : "bg-red-500/15 text-red-300"
                      }`}>{alert.type}</span>
                    </div>
                    <p className="text-xs text-white/70 mt-0.5 truncate">{alert.message}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{alert.ts.replace("T", " ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Performance */}
          <div className="lg:col-span-4 panel p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Model Performance
            </h2>
            <div className="space-y-4">
              <MetricCard
                label="Solar Forecast"
                icon={<Sun className="w-4 h-4 text-amber-400" />}
                mae={metrics.solar.mae}
                improvement={metrics.solar.improvement}
                coverage={metrics.solar.coverage}
              />
              <MetricCard
                label="Wind Forecast"
                icon={<Wind className="w-4 h-4 text-cyan-400" />}
                mae={metrics.wind.mae}
                improvement={metrics.wind.improvement}
                coverage={metrics.wind.coverage}
              />
              <div className="pt-3 border-t border-white/5">
                <div className="flex justify-between text-xs text-white/40 mb-1.5">
                  <span>Q10-Q90 Uncertainty Band Coverage</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <CoverageBadge label="Solar" value={metrics.solar.coverage} />
                  <CoverageBadge label="Wind" value={metrics.wind.coverage} />
                </div>
              </div>
            </div>
          </div>

          {/* Feature Importance */}
          <div className="lg:col-span-3 panel p-5">
            <h2 className="text-base font-semibold mb-4">Top Drivers</h2>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-amber-400/70 mb-2">Solar</p>
                {solarImp.slice(0, 4).map((f) => (
                  <FeatureBar key={f.name} name={f.name} value={f.importance} color="amber" />
                ))}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-cyan-400/70 mb-2">Wind</p>
                {windImp.slice(0, 4).map((f) => (
                  <FeatureBar key={f.name} name={f.name} value={f.importance} color="cyan" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Business Value Section ─── */}
        <div className="panel p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-1">The Problem</h3>
              <p className="text-sm text-white/80 leading-relaxed">{product.problem}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-1">Our Solution</h3>
              <p className="text-sm text-white/80 leading-relaxed">{product.solution}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-1">Economic Impact</h3>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-lg font-bold text-emerald-400">{formatEUR(savings.annual_saving_eur)}</p>
                  <p className="text-[10px] text-white/40">Annual savings</p>
                </div>
                <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                  <p className="text-lg font-bold text-cyan-400">{savings.mae_reduction_mwh.toFixed(0)} MWh</p>
                  <p className="text-[10px] text-white/40">Error reduction/hr</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-white/20 py-4">
          GridSight — Energy/AI Hackathon Munich 2026 — 5 years SMARD + Open-Meteo — LightGBM Quantile Regression
        </footer>
      </main>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPI({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500/10 to-emerald-500/0 border-emerald-500/20 text-emerald-400",
    cyan: "from-cyan-500/10 to-cyan-500/0 border-cyan-500/20 text-cyan-400",
    amber: "from-amber-500/10 to-amber-500/0 border-amber-500/20 text-amber-400",
    red: "from-red-500/10 to-red-500/0 border-red-500/20 text-red-400",
  };
  return (
    <div className={`p-3 rounded-xl border bg-gradient-to-b ${colors[color] ?? colors.emerald}`}>
      <div className="flex items-center gap-1.5 text-[10px] text-white/50 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>
    </div>
  );
}

function MetricCard({ label, icon, mae, improvement, coverage }: { label: string; icon: React.ReactNode; mae: number; improvement: number; coverage: number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
      {icon}
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-white/40">MAE: {mae.toFixed(0)} MWh</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${improvement > 0 ? "text-emerald-400" : "text-red-400"}`}>
          {improvement > 0 ? "+" : ""}{improvement}%
        </p>
        <p className="text-[10px] text-white/30">vs baseline</p>
      </div>
    </div>
  );
}

function CoverageBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "emerald" : value >= 60 ? "amber" : "red";
  return (
    <div className="text-center p-2 rounded-lg bg-white/[0.02]">
      <p className={`text-base font-bold text-${color}-400`}>{value}%</p>
      <p className="text-[10px] text-white/40">{label}</p>
    </div>
  );
}

function FeatureBar({ name, value, color }: { name: string; value: number; color: string }) {
  const bg = color === "amber" ? "bg-amber-400" : "bg-cyan-400";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] text-white/50 mb-0.5">
        <span>{name.replace(/_/g, " ")}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5">
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${value}%`, opacity: 0.7 }} />
      </div>
    </div>
  );
}
