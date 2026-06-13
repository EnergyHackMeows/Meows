import { useMemo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Cell,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Banknote, Scale, Sun, TriangleAlert } from "lucide-react";

import {
  getImbalanceExposure,
  getImbalanceSummary,
  type ImbalanceHour,
  NEGATIVE_DA_HOURS_2025,
  REBAP_BASE_EUR_PER_MWH,
  REBAP_SCARCITY_EUR_PER_MWH,
} from "../lib/market";
import { formatEUR, formatMW, type Zone } from "../lib/mock-data";

interface Props {
  zone: Zone;
}

export function ImbalanceRiskPanel({ zone }: Props) {
  const exposure = useMemo(() => getImbalanceExposure(zone), [zone]);
  const summary = useMemo(() => getImbalanceSummary(zone), [zone]);

  const chartData = useMemo(
    () =>
      exposure.map((r) => ({
        ...r,
        time: r.ts.slice(5, 13).replace("T", " "),
        // Positive bar = overproduction risk (upside MWh, plotted up)
        // Negative bar = underproduction risk (downside MWh, plotted down)
        over_mwh: r.upside_mwh,
        under_mwh: -r.downside_mwh,
      })),
    [exposure]
  );

  const peakLabel = summary.peak_exposure_hour
    ? summary.peak_exposure_hour.ts.slice(5, 13).replace("T", " ") + " CET"
    : "—";

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400" />
            Imbalance Exposure (reBAP Risk)
          </h2>
          <p className="text-[10px] text-white/40 mt-1 max-w-2xl leading-relaxed">
            Forecast uncertainty translated into € exposure at the German cross-zone imbalance price (reBAP).
            Quarter-hour settlement: a balancing group that overproduces while the system is long pays the negative
            reBAP; underproducing while the system is short pays the positive reBAP.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 shrink-0 min-w-[280px]">
          <SummaryCard
            label="Expected 24h cost"
            value={formatEUR(summary.expected_cost_eur_24h)}
            sub={`${formatMW(summary.total_band_mwh)} MWh total band`}
            color="emerald"
          />
          <SummaryCard
            label="Worst-case 72h"
            value={formatEUR(summary.worst_case_cost_eur_72h)}
            sub={`at €${REBAP_SCARCITY_EUR_PER_MWH}/MWh scarcity`}
            color="red"
          />
        </div>
      </div>

      {/* Posture strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <PostureBlock
          label="Likely long quarters"
          value={summary.long_hours}
          unit="hrs"
          icon={<ArrowUpRight className="w-3.5 h-3.5" />}
          color="cyan"
          help="System surplus expected → overproduction = negative reBAP"
        />
        <PostureBlock
          label="Likely short quarters"
          value={summary.short_hours}
          unit="hrs"
          icon={<ArrowDownRight className="w-3.5 h-3.5" />}
          color="amber"
          help="System deficit expected → underproduction = positive reBAP"
        />
        <PostureBlock
          label="Solarspitzen hours"
          value={summary.solarspitzen_hours}
          unit="hrs"
          icon={<Sun className="w-3.5 h-3.5" />}
          color="red"
          help={`Midday solar peak quarters at risk of €0 EEG remuneration (${NEGATIVE_DA_HOURS_2025} hrs of negative DA prices in 2025)`}
        />
        <PostureBlock
          label="Peak exposure hour"
          value={peakLabel}
          unit=""
          icon={<TriangleAlert className="w-3.5 h-3.5" />}
          color="purple"
          help={
            summary.peak_exposure_hour
              ? `${formatEUR(summary.peak_exposure_hour.worst_case_cost_eur)} worst-case at this quarter`
              : "—"
          }
        />
      </div>

      {/* Exposure chart */}
      <div className="h-[240px] mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="costG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={11}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatMW(Math.abs(v))}
              label={{ value: "MWh", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "rgba(168,85,247,0.5)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatEUR(v)}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#0a1420", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }}
              formatter={(value: any, name: string, p: any) => {
                if (name === "over_mwh") return [`${formatMW(value)} MWh upside`, "Overproduction risk"];
                if (name === "under_mwh") return [`${formatMW(Math.abs(value))} MWh downside`, "Underproduction risk"];
                if (name === "expected_cost_eur") return [formatEUR(value), "Expected reBAP cost"];
                return [value, name];
              }}
              labelFormatter={(label, payload) => {
                const row = (payload?.[0]?.payload as ImbalanceHour & { time: string } | undefined);
                if (!row) return label as string;
                const state = row.system_state;
                const reb = row.rebap_signed_eur_per_mwh;
                return `${label}  ·  ${state.toUpperCase()}  ·  reBAP ≈ €${reb}/MWh${row.solarspitzen_flag ? "  ·  Solarspitzen" : ""}`;
              }}
            />
            <ReferenceLine yAxisId="left" y={0} stroke="rgba(255,255,255,0.15)" />
            <Bar yAxisId="left" dataKey="over_mwh" name="over_mwh" radius={[2, 2, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell
                  key={`o-${i}`}
                  fill={d.solarspitzen_flag ? "#ef4444" : d.system_state === "long" ? "#22d3ee" : "rgba(34,211,238,0.4)"}
                />
              ))}
            </Bar>
            <Bar yAxisId="left" dataKey="under_mwh" name="under_mwh" radius={[0, 0, 2, 2]}>
              {chartData.map((d, i) => (
                <Cell
                  key={`u-${i}`}
                  fill={d.system_state === "short" ? "#f59e0b" : "rgba(245,158,11,0.4)"}
                />
              ))}
            </Bar>
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="expected_cost_eur"
              stroke="#a855f7"
              strokeWidth={1.5}
              fill="url(#costG)"
              name="expected_cost_eur"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="worst_case_cost_eur"
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="worst_case_cost_eur"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/45 mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-400"></span>Upside risk · long quarter</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400"></span>Downside risk · short quarter</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400"></span>Solarspitzen quarter (€0 EEG risk)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-400"></span>Expected € cost</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400" style={{ borderTop: "1px dashed #ef4444" }}></span>Worst-case €</span>
      </div>

      {/* Footnote */}
      <div className="border-t border-white/5 pt-3 flex items-start gap-2 text-[10px] text-white/45 leading-relaxed">
        <Banknote className="w-3.5 h-3.5 text-emerald-400/70 mt-0.5 shrink-0" />
        <p>
          reBAP is symmetrical and quarter-hourly. Magnitudes used here: base €{REBAP_BASE_EUR_PER_MWH}/MWh (median 2024 magnitude
          per 50Hertz Almanach), scarcity €{REBAP_SCARCITY_EUR_PER_MWH}/MWh. Sign convention follows § 8 EBGL: negative
          when system is long, positive when system is short. Solarspitzengesetz: new PV gets €0 EEG remuneration during any
          quarter-hour with a negative day-ahead price ({NEGATIVE_DA_HOURS_2025} such hours in 2025, source: EEX / pv-magazine).
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const palette: Record<string, string> = {
    emerald: "from-emerald-500/10 border-emerald-500/20 text-emerald-300",
    red: "from-red-500/10 border-red-500/20 text-red-300",
    cyan: "from-cyan-500/10 border-cyan-500/20 text-cyan-300",
  };
  return (
    <div className={`p-2.5 rounded-lg border bg-gradient-to-b to-transparent ${palette[color] ?? palette.emerald}`}>
      <p className="text-[9px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[9px] text-white/40 mt-0.5">{sub}</p>
    </div>
  );
}

function PostureBlock({
  label,
  value,
  unit,
  icon,
  color,
  help,
}: {
  label: string;
  value: number | string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  help: string;
}) {
  const palette: Record<string, string> = {
    cyan: "text-cyan-300 border-cyan-500/15 bg-cyan-500/[0.04]",
    amber: "text-amber-300 border-amber-500/15 bg-amber-500/[0.04]",
    red: "text-red-300 border-red-500/15 bg-red-500/[0.04]",
    purple: "text-purple-300 border-purple-500/15 bg-purple-500/[0.04]",
  };
  return (
    <div className={`p-2.5 rounded-lg border ${palette[color] ?? palette.cyan}`}>
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-white/45 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm font-bold tabular-nums leading-tight">
        {value}
        {unit && <span className="text-[10px] text-white/40 ml-1 font-normal">{unit}</span>}
      </p>
      <p className="text-[9px] text-white/35 mt-1 leading-snug">{help}</p>
    </div>
  );
}
