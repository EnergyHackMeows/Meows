import { useEffect, useState } from "react";
import { Clock, Gavel, FileCheck2, Radio, Zap, AlertCircle, Calendar } from "lucide-react";
import { MARKET_TIMELINE, getMarketCountdown, type MarketEvent } from "../lib/market";

const ICONS: Record<MarketEvent["group"], React.ReactNode> = {
  forecast: <Radio className="w-3.5 h-3.5" />,
  auction: <Gavel className="w-3.5 h-3.5" />,
  schedule: <FileCheck2 className="w-3.5 h-3.5" />,
  intraday: <Clock className="w-3.5 h-3.5" />,
  delivery: <Zap className="w-3.5 h-3.5" />,
};

const GROUP_COLOR: Record<MarketEvent["group"], string> = {
  forecast: "cyan",
  auction: "amber",
  schedule: "emerald",
  intraday: "purple",
  delivery: "red",
};

function colorClasses(color: string, active: boolean, passed: boolean) {
  const palette: Record<string, { dot: string; ring: string; text: string; bg: string }> = {
    cyan: { dot: "bg-cyan-400", ring: "ring-cyan-400/40", text: "text-cyan-300", bg: "bg-cyan-500/5 border-cyan-500/15" },
    amber: { dot: "bg-amber-400", ring: "ring-amber-400/40", text: "text-amber-300", bg: "bg-amber-500/5 border-amber-500/15" },
    emerald: { dot: "bg-emerald-400", ring: "ring-emerald-400/40", text: "text-emerald-300", bg: "bg-emerald-500/5 border-emerald-500/15" },
    purple: { dot: "bg-purple-400", ring: "ring-purple-400/40", text: "text-purple-300", bg: "bg-purple-500/5 border-purple-500/15" },
    red: { dot: "bg-red-400", ring: "ring-red-400/40", text: "text-red-300", bg: "bg-red-500/5 border-red-500/15" },
  };
  const p = palette[color] ?? palette.emerald;
  if (active) return `${p.dot} ${p.ring} ring-4 ${p.text}`;
  if (passed) return `${p.dot} opacity-40`;
  return `${p.dot}`;
}

export function MarketTimeline() {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const cd = getMarketCountdown(now);
  const passedKeys = new Set(cd.passed.map((e) => e.key));
  const nextKey = cd.next_event.key;

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            German Day-Ahead Market Sequence
          </h2>
          <p className="text-[10px] text-white/40 mt-1 max-w-xl leading-relaxed">
            Every hour of the next-day forecast must clear these checkpoints. After the schedule Cut-Off
            Time at 15:30 CET, any forecast error is settled in real-time at the reBAP imbalance price.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] uppercase tracking-wider text-white/40">Next checkpoint</p>
          <p className="text-base font-bold text-emerald-300 tabular-nums">{cd.human}</p>
          <p className="text-[10px] text-white/50 leading-tight max-w-[180px]">{cd.next_event.label}</p>
        </div>
      </div>

      {/* Horizontal timeline rail */}
      <div className="relative pt-2 pb-1">
        <div className="absolute left-0 right-0 top-[26px] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="relative grid grid-cols-7 gap-1">
          {MARKET_TIMELINE.map((e) => {
            const passed = passedKeys.has(e.key);
            const active = e.key === nextKey;
            const color = GROUP_COLOR[e.group];
            return (
              <div key={e.key} className="flex flex-col items-center text-center">
                <div className={`w-3 h-3 rounded-full ${colorClasses(color, active, passed)} transition-all`} />
                <p className={`text-[10px] mt-2 font-medium tabular-nums ${active ? "text-white" : passed ? "text-white/30" : "text-white/60"}`}>
                  {e.time_cet}
                </p>
                <p className={`text-[8px] uppercase tracking-wider mt-0.5 ${active ? "text-emerald-300" : "text-white/30"}`}>
                  {e.day}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mt-5">
        {MARKET_TIMELINE.map((e) => {
          const passed = passedKeys.has(e.key);
          const active = e.key === nextKey;
          const color = GROUP_COLOR[e.group];
          const palette: Record<string, string> = {
            cyan: "border-cyan-500/20 bg-cyan-500/5",
            amber: "border-amber-500/20 bg-amber-500/5",
            emerald: "border-emerald-500/20 bg-emerald-500/5",
            purple: "border-purple-500/20 bg-purple-500/5",
            red: "border-red-500/20 bg-red-500/5",
          };
          const textPalette: Record<string, string> = {
            cyan: "text-cyan-300",
            amber: "text-amber-300",
            emerald: "text-emerald-300",
            purple: "text-purple-300",
            red: "text-red-300",
          };
          return (
            <div
              key={e.key}
              className={`relative p-3 rounded-lg border transition-all ${
                active
                  ? `${palette[color]} ring-1 ring-emerald-400/30`
                  : passed
                  ? "border-white/5 bg-white/[0.015] opacity-60"
                  : "border-white/8 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${active ? textPalette[color] : "text-white/70"}`}>
                  {ICONS[e.group]}
                  <span className="tabular-nums">{e.time_cet}</span>
                  <span className="text-[9px] uppercase tracking-wider text-white/30 ml-1">{e.day}</span>
                </div>
                {active && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 font-medium">
                    NEXT
                  </span>
                )}
                {passed && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/5">
                    DONE
                  </span>
                )}
              </div>
              <p className={`text-[11px] font-semibold leading-tight ${active ? "text-white" : "text-white/85"}`}>
                {e.label}
              </p>
              <p className="text-[10px] text-white/45 leading-relaxed mt-1">{e.description}</p>
              <p className="text-[8px] text-white/25 mt-2 italic">{e.source}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex items-start gap-2 text-[10px] text-white/45 leading-relaxed">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400/70 mt-0.5 shrink-0" />
        <p>
          GridSight's 72-hour forecast is published before <span className="text-white/80 font-semibold">12:00 CET D-1</span>
          {" "}so day-ahead bids and TSO schedules can be priced against it — every minute earlier than the schedule Cut-Off Time
          ({" "}<span className="text-white/80">15:30 CET</span>{" "}) reduces the volume that has to be closed expensively on intraday or
          settled at the reBAP.
        </p>
      </div>
    </div>
  );
}
