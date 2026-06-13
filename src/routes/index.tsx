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
  AlertTriangle,
  Activity,
  BarChart3,
  CheckCircle2,
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
  getValidation,
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
  getModelConfig,
  getGeneratedAt,
} from "../lib/mock-data";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [zone, setZone] = useState<Zone>("All Germany");
  const [chartView, setChartView] = useState<"forecast" | "validation">("forecast");

  const metrics = useMemo(() => getMetrics(zone), [zone]);
  const forecast = useMemo(() => getForecast72h(zone), [zone]);
  const validation = useMemo(() => getValidation(zone), [zone]);
  const congestion = useMemo(() => getCongestion(zone), [zone]);
  const savings = useMemo(() => getSavings(zone), [zone]);
  const alerts = useMemo(() => getCriticalAlerts(zone), [zone]);
  const peak = useMemo(() => getPeakGeneration(zone), [zone]);
  const rampCount = useMemo(() => getRampCount(zone), [zone]);
  const product = getProduct();
  const modelConfig = getModelConfig();
  const solarImp = getFeatureImportance("solar");
  const windImp = getFeatureImportance("wind");

  const forecastChart = useMemo(
    () => forecast.map((h) => ({ ...h, time: h.ts.slice(5, 13).replace("T", " ") })),
    [forecast]
  );

  const validationChart = useMemo(
    () => validation.map((v) => ({ ...v, time: v.ts.slice(5, 13).replace("T", " ") })),
    [validation]
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
            <span className="text-[10px] text-white/30">
              {modelConfig.training_period} training | {modelConfig.test_hours.toLocaleString()} test hours
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">
        {/* ─── KPI Strip ─── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI
            label="Wind Accuracy"
            value={`+${metrics.wind.improvement}%`}
            sub="vs persistence baseline"
            color="emerald"
            icon={<Wind className="w-4 h-4" />}
          />
          <KPI
            label="Solar Accuracy"
            value={`+${metrics.solar.improvement}%`}
            sub="vs persistence baseline"
            color="amber"
            icon={<Sun className="w-4 h-4" />}
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
            sub="detected next 72h"
            color={rampCount > 10 ? "red" : rampCount > 5 ? "amber" : "emerald"}
            icon={<Activity className="w-4 h-4" />}
          />
          <KPI
            label="Annual Value"
            value={formatEUR(savings.annual_saving_eur)}
            sub="imbalance cost reduction"
            color="emerald"
            icon={<Zap className="w-4 h-4" />}
          />
        </div>

        {/* ─── Main Content ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Chart Panel */}
          <div className="lg:col-span-8 panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/5">
                <button
                  onClick={() => setChartView("forecast")}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    chartView === "forecast" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  72h Forecast
                </button>
                <button
                  onClick={() => setChartView("validation")}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    chartView === "validation" ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  Model Proof (Test Set)
                </button>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/40">
                {chartView === "forecast" ? (
                  <>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Solar</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span>Wind</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400" style={{ borderTop: "1px dashed #10b981" }}></span>Total</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-500/40" style={{ borderTop: "1px dashed #6b7280" }}></span>Baseline</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>Actual</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span>Predicted</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-500/40" style={{ borderTop: "1px dashed #6b7280" }}></span>Baseline</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-cyan-400/10 border border-cyan-400/20"></span>P10–P90</span>
                  </>
                )}
              </div>
            </div>

            <div className="h-[310px]">
              {chartView === "forecast" ? (
                <ForecastChart data={forecastChart} />
              ) : (
                <ValidationChart data={validationChart} />
              )}
            </div>

            {chartView === "validation" && (
              <div className="mt-3 flex items-center gap-4 text-[10px] text-white/40 border-t border-white/5 pt-3">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  7-day held-out test set (never seen during training)
                </span>
                <span>Shaded area = P10-P90 uncertainty band</span>
              </div>
            )}
          </div>

          {/* Map + Zone */}
          <div className="lg:col-span-4 space-y-4">
            <div className="panel p-4">
              <h3 className="text-xs font-medium text-white/50 mb-3">TSO Region Selection</h3>
              <GermanyMap
                selectedZone={zone}
                onZoneSelect={setZone}
                congestionData={Object.fromEntries(
                  ZONES.filter((z) => z !== "All Germany").map((z) => [z, getCongestion(z).congestion_probability_pct])
                )}
              />
            </div>
            <div className="panel p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-white/40 mb-0.5">Zone Capacity</p>
                  <p className="text-xl font-bold">{formatMW(congestion.capacity_mw)} MW</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/40 mb-0.5">Peak Utilization</p>
                  <p className={`text-xl font-bold ${congestion.peak_utilization_pct > 85 ? "text-red-400" : congestion.peak_utilization_pct > 60 ? "text-amber-400" : "text-emerald-400"}`}>
                    {congestion.peak_utilization_pct}%
                  </p>
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
              <div className="mt-2 flex justify-between text-[9px] text-white/30">
                <span>0%</span>
                <span className="text-amber-400/50">70%</span>
                <span className="text-red-400/50">90%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Alerts + Model Performance + Features ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Alerts */}
          <div className="lg:col-span-4 panel p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Grid Alerts
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                {alerts.length} critical
              </span>
            </div>
            <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-thin">
              {alerts.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400/50 mx-auto mb-2" />
                  <p className="text-xs text-white/30">No critical alerts</p>
                </div>
              )}
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${
                    alert.severity === "critical" ? "bg-red-500/5 border-red-500/15" : "bg-amber-500/5 border-amber-500/10"
                  }`}
                >
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    alert.severity === "critical" ? "bg-red-400 animate-pulse" : "bg-amber-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-medium text-white/50">{alert.zone}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        alert.type === "ramp" ? "bg-purple-500/10 text-purple-300" : "bg-red-500/10 text-red-300"
                      }`}>{alert.type}</span>
                    </div>
                    <p className="text-[11px] text-white/70 leading-tight">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Performance */}
          <div className="lg:col-span-4 panel p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Model vs Baseline
            </h2>
            <div className="space-y-3">
              <PerformanceRow
                label="Wind Total"
                icon={<Wind className="w-3.5 h-3.5 text-cyan-400" />}
                modelMae={metrics.wind.mae}
                baselineMae={metrics.wind.baselineMae}
                improvement={metrics.wind.improvement}
                coverage={metrics.wind.coverage}
              />
              <PerformanceRow
                label="Solar"
                icon={<Sun className="w-3.5 h-3.5 text-amber-400" />}
                modelMae={metrics.solar.mae}
                baselineMae={metrics.solar.baselineMae}
                improvement={metrics.solar.improvement}
                coverage={metrics.solar.coverage}
              />
            </div>
            <div className="mt-4 pt-3 border-t border-white/5">
              <p className="text-[10px] text-white/40 mb-2">Methodology</p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded bg-white/[0.02]">
                  <p className="text-white/50">Algorithm</p>
                  <p className="text-white/80 font-medium">{modelConfig.algorithm}</p>
                </div>
                <div className="p-2 rounded bg-white/[0.02]">
                  <p className="text-white/50">Quantiles</p>
                  <p className="text-white/80 font-medium">P10 / P50 / P90</p>
                </div>
                <div className="p-2 rounded bg-white/[0.02]">
                  <p className="text-white/50">Training Data</p>
                  <p className="text-white/80 font-medium">{(modelConfig.training_hours / 1000).toFixed(0)}k hours</p>
                </div>
                <div className="p-2 rounded bg-white/[0.02]">
                  <p className="text-white/50">Test Data</p>
                  <p className="text-white/80 font-medium">{(modelConfig.test_hours / 1000).toFixed(1)}k hours (92 days)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Importance */}
          <div className="lg:col-span-4 panel p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Feature Importance
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-cyan-400/60 mb-2 font-medium">Wind Model Drivers</p>
                {windImp.slice(0, 5).map((f) => (
                  <FeatureBar key={f.name} name={f.name} value={f.importance} color="cyan" />
                ))}
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-amber-400/60 mb-2 font-medium">Solar Model Drivers</p>
                {solarImp.slice(0, 4).map((f) => (
                  <FeatureBar key={f.name} name={f.name} value={f.importance} color="amber" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Business Value Panel ─── */}
        <div className="panel p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1">
              <h3 className="text-xs font-medium text-white/50 mb-2">Problem</h3>
              <p className="text-[11px] text-white/70 leading-relaxed">{product.problem}</p>
            </div>
            <div className="md:col-span-1">
              <h3 className="text-xs font-medium text-white/50 mb-2">Solution</h3>
              <p className="text-[11px] text-white/70 leading-relaxed">{product.solution}</p>
            </div>
            <div className="md:col-span-1">
              <h3 className="text-xs font-medium text-white/50 mb-2">Data Foundation</h3>
              <div className="space-y-1.5 text-[10px]">
                <p className="text-white/60"><span className="text-white/80 font-medium">5 years</span> of hourly generation data</p>
                <p className="text-white/60"><span className="text-white/80 font-medium">4 TSO zones</span> × 6 grid points each</p>
                <p className="text-white/60"><span className="text-white/80 font-medium">16 weather features</span> from Open-Meteo</p>
                <p className="text-white/60"><span className="text-white/80 font-medium">SMARD</span> (Bundesnetzagentur, CC BY 4.0)</p>
              </div>
            </div>
            <div className="md:col-span-1">
              <h3 className="text-xs font-medium text-white/50 mb-2">Economic Impact</h3>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-lg font-bold text-emerald-400">{formatEUR(savings.annual_saving_eur)}/yr</p>
                  <p className="text-[9px] text-white/40">Imbalance cost reduction</p>
                </div>
                <div className="p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                  <p className="text-lg font-bold text-cyan-400">{savings.mae_reduction_mwh.toFixed(0)} MWh/hr</p>
                  <p className="text-[9px] text-white/40">Forecast error eliminated</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[10px] text-white/15 py-4 space-y-0.5">
          <p>GridSight — Energy/AI Hackathon Munich 2026</p>
          <p>Built with LightGBM, Open-Meteo, SMARD, React, TanStack Start, Cloudflare Pages</p>
        </footer>
      </main>
    </div>
  );
}

// ─── Charts ──────────────────────────────────────────────────────────────────

function ForecastChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="solarG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="windG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} interval={11} />
        <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMW(v)} />
        <Tooltip contentStyle={{ backgroundColor: "#0a1420", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }} />
        <Area type="monotone" dataKey="solar_q90" fill="url(#solarG)" stroke="none" />
        <Area type="monotone" dataKey="wind_q90" fill="url(#windG)" stroke="none" />
        <Line type="monotone" dataKey="solar_q50" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Solar" />
        <Line type="monotone" dataKey="wind_q50" stroke="#22d3ee" strokeWidth={1.5} dot={false} name="Wind" />
        <Line type="monotone" dataKey="total_q50" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Total" />
        <Line type="monotone" dataKey="baseline" stroke="#6b7280" strokeWidth={1} dot={false} strokeDasharray="3 3" strokeOpacity={0.4} name="Baseline" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ValidationChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bandG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} interval={23} />
        <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMW(v)} />
        <Tooltip contentStyle={{ backgroundColor: "#0a1420", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }} />
        <Area type="monotone" dataKey="upper_total" fill="url(#bandG)" stroke="none" name="P90 Band" />
        <Area type="monotone" dataKey="lower_total" fill="var(--background)" stroke="none" name="P10 Band" />
        <Line type="monotone" dataKey="actual_total" stroke="#10b981" strokeWidth={2} dot={false} name="Actual (MW)" />
        <Line type="monotone" dataKey="predicted_total" stroke="#22d3ee" strokeWidth={1.5} dot={false} name="Predicted (MW)" />
        <Line type="monotone" dataKey="baseline_total" stroke="#6b7280" strokeWidth={1} dot={false} strokeDasharray="3 3" strokeOpacity={0.4} name="Baseline (MW)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPI({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-400",
    cyan: "from-cyan-500/10 to-transparent border-cyan-500/20 text-cyan-400",
    amber: "from-amber-500/10 to-transparent border-amber-500/20 text-amber-400",
    red: "from-red-500/10 to-transparent border-red-500/20 text-red-400",
  };
  return (
    <div className={`p-3 rounded-xl border bg-gradient-to-b ${colors[color] ?? colors.emerald}`}>
      <div className="flex items-center gap-1.5 text-[9px] text-white/45 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[9px] text-white/25 mt-0.5">{sub}</p>
    </div>
  );
}

function PerformanceRow({ label, icon, modelMae, baselineMae, improvement, coverage }: {
  label: string; icon: React.ReactNode; modelMae: number; baselineMae: number; improvement: number; coverage: number;
}) {
  return (
    <div className="p-3 rounded-lg bg-white/[0.015] border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className={`text-sm font-bold ${improvement > 20 ? "text-emerald-400" : improvement > 5 ? "text-cyan-400" : "text-amber-400"}`}>
          +{improvement}%
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <p className="text-white/40">Our MAE</p>
          <p className="font-medium">{modelMae.toFixed(0)} MWh</p>
        </div>
        <div>
          <p className="text-white/40">Baseline MAE</p>
          <p className="font-medium text-white/50">{baselineMae.toFixed(0)} MWh</p>
        </div>
        <div>
          <p className="text-white/40">Band Coverage</p>
          <p className="font-medium">{coverage}%</p>
        </div>
      </div>
    </div>
  );
}

function FeatureBar({ name, value, color }: { name: string; value: number; color: string }) {
  const bg = color === "amber" ? "bg-amber-400/70" : "bg-cyan-400/70";
  const displayName = name.replace(/_/g, " ").replace("100m sq", "100m²");
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] text-white/45 mb-0.5">
        <span>{displayName}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5">
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
