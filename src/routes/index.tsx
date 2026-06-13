import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  Cpu,
  Gauge,
  Radio,
  Sparkles,
  Sun,
  Wind,
  Zap,
} from "lucide-react";
import {
  ZONES,
  generateMockData,
  mae,
  rmse,
  type ForecastPoint,
  type Zone,
} from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridSight — Renewable Generation Forecast" },
      {
        name: "description",
        content:
          "Short-horizon solar & wind generation forecast dashboard for German TSO zones, benchmarked against a persistence baseline.",
      },
      { property: "og:title", content: "GridSight — Renewable Generation Forecast" },
      {
        property: "og:description",
        content:
          "Live inference dashboard: predicted vs actual generation, model vs naive baseline, trading signals.",
      },
    ],
  }),
  component: Dashboard,
});

type View = "both" | "solar" | "wind";

const FEATURES = [
  { name: "Shortwave irradiance", importance: 87, color: "var(--solar)" },
  { name: "Wind speed 80m", importance: 82, color: "var(--wind)" },
  { name: "Hour of day", importance: 68, color: "var(--accent-cyan)" },
  { name: "Cloud cover", importance: 55, color: "#a78bfa" },
  { name: "Month", importance: 41, color: "#94a3b8" },
];

function Dashboard() {
  const [zone, setZone] = useState<Zone>("All Germany");
  const [view, setView] = useState<View>("both");
  const [tick, setTick] = useState(0);

  // >>> SWAP POINT: replace `data` initialization with fetch to your Python API.
  const data = useMemo(
    () => generateMockData({ seed: 42 + tick, anchor: new Date() }),
    [tick],
  );

  // Auto-refresh every 30s to simulate rolling inference
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    let rows = data.filter((r) => r.zoneLocation === zone);
    if (view !== "both") rows = rows.filter((r) => r.assetType === view);
    return rows;
  }, [data, zone, view]);

  // Aggregate per timestamp for chart (sum solar+wind when both)
  const series = useMemo(() => {
    const map = new Map<
      string,
      { ts: string; actual: number; predicted: number; baseline: number; lo: number; hi: number }
    >();
    for (const r of filtered) {
      const cur = map.get(r.timestamp) ?? {
        ts: r.timestamp,
        actual: 0,
        predicted: 0,
        baseline: 0,
        lo: 0,
        hi: 0,
      };
      cur.actual += r.actualGeneration;
      cur.predicted += r.predictedGeneration;
      cur.baseline += r.baseline;
      cur.lo += r.bandLower;
      cur.hi += r.bandUpper;
      map.set(r.timestamp, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));
  }, [filtered]);

  // KPIs
  const peak = useMemo(
    () => series.reduce((m, p) => Math.max(m, p.predicted), 0),
    [series],
  );
  const peakSolar = useMemo(() => {
    const s = aggregate(data, zone, "solar");
    return s.reduce((m, p) => Math.max(m, p.predicted), 0);
  }, [data, zone]);
  const peakWind = useMemo(() => {
    const s = aggregate(data, zone, "wind");
    return s.reduce((m, p) => Math.max(m, p.predicted), 0);
  }, [data, zone]);
  const totalNext24 = useMemo(
    () => series.reduce((s, p) => s + p.predicted, 0) / 4, // 15-min -> MWh
    [series],
  );

  const errorPairs = series.map((p) => ({ a: p.actual, p: p.predicted }));
  const baselinePairs = series.map((p) => ({ a: p.actual, p: p.baseline }));
  const modelMae = mae(errorPairs);
  const modelRmse = rmse(errorPairs);
  const baselineMae = mae(baselinePairs);
  const improvement = baselineMae > 0 ? ((baselineMae - modelMae) / baselineMae) * 100 : 0;

  // Trading signal — latest point: predicted vs baseline
  const last = series[series.length - 1];
  const delta = last ? last.predicted - last.baseline : 0;
  const signal = delta >= 0 ? "SELL" : "BUY";

  const nowLabel = new Date().toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen flex text-foreground">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 border-r border-[color:var(--panel-border)] bg-[color:var(--panel)] flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="relative">
            <div className="size-2.5 rounded-full bg-[color:var(--signal-sell)] glow-cyan" />
            <div className="absolute inset-0 size-2.5 rounded-full bg-[color:var(--signal-sell)] animate-ping opacity-70" />
          </div>
          <h1 className="text-display text-lg font-semibold tracking-tight">GridSight</h1>
        </div>

        <div className="px-5 mt-2">
          <SectionLabel>Zone</SectionLabel>
          <div className="flex flex-col gap-1.5 mt-2">
            {ZONES.map((z) => (
              <button
                key={z}
                onClick={() => setZone(z)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all border ${
                  zone === z
                    ? "bg-[color:var(--accent)] border-[color:var(--panel-border)] text-foreground"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    zone === z ? "bg-[color:var(--signal-sell)]" : "bg-muted-foreground"
                  }`}
                />
                <span className="font-mono text-[13px]">{z}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 mt-6">
          <SectionLabel>View</SectionLabel>
          <div className="grid grid-cols-1 gap-1.5 mt-2">
            {([
              ["both", "Solar + Wind", Sparkles],
              ["solar", "Solar only", Sun],
              ["wind", "Wind only", Wind],
            ] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition-all ${
                  view === k
                    ? "bg-[color:var(--background)] border-[color:var(--panel-border)] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 mt-6">
          <SectionLabel>Model</SectionLabel>
          <div className="text-[12px] text-muted-foreground space-y-1 mt-2 font-mono leading-relaxed">
            <div>XGBoost · Quantile regression</div>
            <div>Trained 2021 → 2026-06-12</div>
            <div>SMARD + Open-Meteo</div>
            <div>24 grid points · 6 per zone</div>
          </div>
        </div>

        <div className="mt-auto px-5 py-4 border-t border-[color:var(--panel-border)] text-[11px] text-muted-foreground font-mono">
          <div className="flex items-center gap-1.5">
            <Radio className="size-3 text-[color:var(--signal-sell)]" />
            inference stream · auto-refresh 30s
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 px-8 py-6">
        <header className="flex items-end justify-between mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Forecast horizon · next 24h
            </div>
            <h2 className="text-display text-2xl font-semibold mt-1">
              {zone} — {view === "both" ? "Solar + Wind" : view === "solar" ? "Solar" : "Wind"} generation
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--signal-sell)]/10 border border-[color:var(--signal-sell)]/40 text-[color:var(--signal-sell)] text-xs font-mono">
              <span className="size-1.5 rounded-full bg-[color:var(--signal-sell)] animate-pulse" />
              LIVE INFERENCE
            </span>
            <div className="font-mono text-xs text-muted-foreground">{nowLabel}</div>
          </div>
        </header>

        {/* KPI Row */}
        <section className="grid grid-cols-4 gap-4">
          <Kpi
            label="Peak Solar"
            value={peakSolar.toFixed(1)}
            unit="MWh"
            sub="instant · 15-min slot"
            icon={<Sun className="size-3.5" />}
            tone="solar"
          />
          <Kpi
            label="Peak Wind"
            value={peakWind.toFixed(1)}
            unit="MWh"
            sub="instant · 15-min slot"
            icon={<Wind className="size-3.5" />}
            tone="wind"
          />
          <Kpi
            label="Total Renewables"
            value={totalNext24.toFixed(0)}
            unit="MWh"
            sub="next 24h · predicted"
            icon={<Zap className="size-3.5" />}
            tone="neutral"
          />
          <Kpi
            label="vs Naive Baseline"
            value={improvement.toFixed(0)}
            unit="%"
            sub={`MAE ${modelMae.toFixed(2)} vs ${baselineMae.toFixed(2)}`}
            icon={<Gauge className="size-3.5" />}
            tone="signal"
            highlight
          />
        </section>

        {/* Chart */}
        <section className="panel mt-5 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">
                {zone} — next 24h generation forecast
              </div>
              <div className="text-[12px] text-muted-foreground font-mono mt-0.5">
                Quarter-hourly MWh · 80% confidence band · dashed = persistence baseline
              </div>
            </div>
            <Legend />
          </div>
          <div className="h-[360px]">
            <ResponsiveContainer>
              <ComposedChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--wind)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--wind)" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="predGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--signal-sell)" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="var(--signal-sell)" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--grid-line)" vertical={false} />
                <XAxis
                  dataKey="ts"
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  stroke="var(--muted-foreground)"
                  tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--panel-border)" }}
                  minTickGap={40}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v} MWh`}
                  width={70}
                />
                <Tooltip content={<ChartTip />} />
                {/* Band as stacked invisible+area trick */}
                <Area
                  type="monotone"
                  dataKey="lo"
                  stroke="none"
                  fill="transparent"
                  stackId="band"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey={(d: any) => d.hi - d.lo}
                  stroke="none"
                  fill="url(#bandFill)"
                  stackId="band"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="var(--muted-foreground)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--wind)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="var(--signal-sell)"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  filter="drop-shadow(0 0 6px rgba(61,220,151,0.55))"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Bottom split */}
        <section className="grid grid-cols-2 gap-4 mt-5">
          {/* Trading signal */}
          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Trading Signal · latest slot
              </div>
              <Activity className="size-4 text-muted-foreground" />
            </div>

            <div className="mt-5 flex items-center gap-5">
              <div
                className={`px-5 py-3 rounded-md font-display font-semibold text-2xl tracking-wide ${
                  signal === "SELL"
                    ? "bg-[color:var(--signal-sell)]/10 text-[color:var(--signal-sell)] glow-green"
                    : "bg-[color:var(--signal-buy)]/10 text-[color:var(--signal-buy)] glow-red"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {signal === "SELL" ? (
                    <ArrowUpRight className="size-6" />
                  ) : (
                    <ArrowDownRight className="size-6" />
                  )}
                  {signal === "SELL" ? "SELL / EXPORT" : "BUY / IMPORT"}
                </span>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {signal === "SELL" ? "Surplus volume" : "Deficit volume"}
                </div>
                <div className="font-mono text-3xl mt-1 tabular">
                  {Math.abs(delta).toFixed(2)} <span className="text-base text-muted-foreground">MWh</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-[12px]">
              <Stat label="Predicted" value={last ? last.predicted.toFixed(2) : "—"} unit="MWh" />
              <Stat label="Baseline" value={last ? last.baseline.toFixed(2) : "—"} unit="MWh" />
              <Stat
                label="Model MAE"
                value={modelMae.toFixed(2)}
                unit="MWh"
              />
            </div>

            <div className="mt-5 pt-4 border-t border-[color:var(--panel-border)] flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span className="inline-flex items-center gap-1.5">
                <Cpu className="size-3" /> XGBoost q-reg · μ + σ
              </span>
              <span>RMSE {modelRmse.toFixed(2)} MWh</span>
            </div>
          </div>

          {/* Feature importance */}
          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Feature Importance
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">gain · normalized</span>
            </div>
            <ul className="mt-4 space-y-3">
              {FEATURES.map((f) => (
                <li key={f.name} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                  <div>
                    <div className="flex justify-between text-[13px]">
                      <span>{f.name}</span>
                      <span className="font-mono tabular text-muted-foreground">{f.importance}%</span>
                    </div>
                    <div className="h-1.5 mt-1.5 rounded-full bg-[color:var(--accent)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${f.importance}%`,
                          background: f.color,
                          boxShadow: `0 0 10px ${f.color}55`,
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="mt-6 text-[11px] text-muted-foreground font-mono flex justify-between">
          <span>GridSight v0.1 · mock inference stream</span>
          <span>{/* SWAP POINT: replace mock-data.ts with REST fetch from Python pipeline */}data: mock</span>
        </footer>
      </main>
    </div>
  );
}

function aggregate(data: ForecastPoint[], zone: Zone, asset: "solar" | "wind") {
  return data
    .filter((r) => r.zoneLocation === zone && r.assetType === asset)
    .map((r) => ({ ts: r.timestamp, predicted: r.predictedGeneration }));
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-mono">
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  sub,
  icon,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
  icon: React.ReactNode;
  tone: "solar" | "wind" | "neutral" | "signal";
  highlight?: boolean;
}) {
  const accent =
    tone === "solar"
      ? "var(--solar)"
      : tone === "wind"
        ? "var(--wind)"
        : tone === "signal"
          ? "var(--signal-sell)"
          : "var(--foreground)";
  return (
    <div
      className={`panel p-4 relative overflow-hidden ${
        highlight ? "ring-1 ring-[color:var(--signal-sell)]/30" : ""
      }`}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
        <span>{label}</span>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          className="font-display text-4xl font-semibold tabular tracking-tight"
          style={{ color: accent }}
        >
          {value}
        </span>
        <span className="text-sm text-muted-foreground font-mono">{unit}</span>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground font-mono">{sub}</div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md bg-[color:var(--background)]/40 border border-[color:var(--panel-border)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div className="font-mono tabular text-base mt-0.5">
        {value} <span className="text-muted-foreground text-[11px]">{unit}</span>
      </div>
    </div>
  );
}

function Legend() {
  const items: { label: string; color: string; dashed?: boolean }[] = [
    { label: "Predicted", color: "var(--signal-sell)" },
    { label: "Actual", color: "var(--wind)" },
    { label: "±80% band", color: "var(--wind)" },
    { label: "Baseline", color: "var(--muted-foreground)", dashed: true },
  ];
  return (
    <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 h-[2px]"
            style={{
              background: i.color,
              borderTop: i.dashed ? `2px dashed ${i.color}` : undefined,
              height: i.dashed ? 0 : 2,
            }}
          />
          {i.label}
        </div>
      ))}
    </div>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as {
    ts: string;
    actual: number;
    predicted: number;
    baseline: number;
    lo: number;
    hi: number;
  };
  const ts = new Date(label).toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="panel p-3 text-[12px] font-mono shadow-2xl backdrop-blur">
      <div className="text-muted-foreground mb-1.5">{ts}</div>
      <Row color="var(--signal-sell)" label="Predicted" value={p.predicted} />
      <Row color="var(--wind)" label="Actual" value={p.actual} />
      <Row color="var(--muted-foreground)" label="Baseline" value={p.baseline} dashed />
      <div className="mt-1.5 pt-1.5 border-t border-[color:var(--panel-border)] text-muted-foreground">
        band {p.lo.toFixed(1)} – {p.hi.toFixed(1)} MWh
      </div>
    </div>
  );
}

function Row({
  color,
  label,
  value,
  dashed,
}: {
  color: string;
  label: string;
  value: number;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-2">
        <span
          className="inline-block w-3"
          style={{
            height: dashed ? 0 : 2,
            background: dashed ? "transparent" : color,
            borderTop: dashed ? `2px dashed ${color}` : undefined,
          }}
        />
        <span>{label}</span>
      </span>
      <span className="tabular" style={{ color }}>
        {value.toFixed(2)} MWh
      </span>
    </div>
  );
}
