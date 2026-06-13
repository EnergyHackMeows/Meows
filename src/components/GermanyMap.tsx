import { type Zone } from "../lib/mock-data";

interface GermanyMapProps {
  selectedZone: Zone;
  onZoneSelect: (zone: Zone) => void;
  congestionData?: Record<string, number>;
}

const ZONE_PATHS: Record<string, { path: string; label: string; labelPos: [number, number] }> = {
  "50Hertz": {
    path: "M 195,15 L 230,12 L 255,20 L 275,15 L 290,25 L 295,50 L 300,75 L 295,100 L 290,130 L 285,155 L 270,175 L 255,195 L 240,210 L 225,225 L 210,230 L 195,225 L 185,210 L 180,195 L 175,180 L 180,160 L 185,140 L 180,120 L 175,100 L 180,80 L 185,60 L 190,40 Z",
    label: "50Hertz",
    labelPos: [232, 110],
  },
  TenneT: {
    path: "M 100,5 L 130,8 L 155,5 L 175,10 L 195,15 L 190,40 L 185,60 L 180,80 L 175,100 L 180,120 L 185,140 L 180,160 L 175,180 L 170,195 L 160,200 L 155,215 L 160,235 L 170,255 L 180,275 L 190,290 L 200,305 L 210,320 L 200,330 L 185,325 L 170,315 L 160,300 L 155,285 L 145,270 L 135,260 L 125,250 L 120,235 L 115,220 L 108,205 L 105,190 L 100,175 L 95,155 L 90,135 L 85,115 L 88,95 L 92,75 L 95,55 L 98,35 L 100,20 Z",
    label: "TenneT",
    labelPos: [138, 140],
  },
  Amprion: {
    path: "M 30,80 L 50,75 L 70,78 L 85,85 L 88,95 L 85,115 L 90,135 L 95,155 L 100,175 L 105,190 L 108,205 L 115,220 L 120,235 L 115,250 L 105,258 L 95,265 L 85,260 L 75,250 L 65,240 L 55,225 L 48,210 L 42,195 L 38,175 L 35,155 L 30,135 L 28,115 L 30,95 Z",
    label: "Amprion",
    labelPos: [70, 165],
  },
  TransnetBW: {
    path: "M 85,260 L 95,265 L 105,258 L 115,250 L 120,235 L 125,250 L 135,260 L 145,270 L 155,285 L 160,300 L 155,315 L 145,325 L 130,330 L 115,328 L 100,320 L 88,310 L 78,295 L 75,280 L 80,270 Z",
    label: "TransnetBW",
    labelPos: [118, 285],
  },
};

function getCongestionColor(pct: number): { fill: string; stroke: string; glow: string } {
  if (pct > 30) return { fill: "rgba(239, 68, 68, 0.25)", stroke: "rgba(239, 68, 68, 0.7)", glow: "rgba(239, 68, 68, 0.4)" };
  if (pct > 10) return { fill: "rgba(245, 158, 11, 0.2)", stroke: "rgba(245, 158, 11, 0.6)", glow: "rgba(245, 158, 11, 0.3)" };
  return { fill: "rgba(16, 185, 129, 0.15)", stroke: "rgba(16, 185, 129, 0.5)", glow: "rgba(16, 185, 129, 0.25)" };
}

const BASE_STYLES: Record<string, { fill: string; stroke: string; glow: string }> = {
  "50Hertz": { fill: "rgba(6, 182, 212, 0.12)", stroke: "rgba(6, 182, 212, 0.5)", glow: "rgba(6, 182, 212, 0.3)" },
  TenneT: { fill: "rgba(245, 158, 11, 0.12)", stroke: "rgba(245, 158, 11, 0.5)", glow: "rgba(245, 158, 11, 0.3)" },
  Amprion: { fill: "rgba(168, 85, 247, 0.12)", stroke: "rgba(168, 85, 247, 0.5)", glow: "rgba(168, 85, 247, 0.3)" },
  TransnetBW: { fill: "rgba(52, 211, 153, 0.12)", stroke: "rgba(52, 211, 153, 0.5)", glow: "rgba(52, 211, 153, 0.3)" },
};

export function GermanyMap({ selectedZone, onZoneSelect, congestionData }: GermanyMapProps) {
  const isAll = selectedZone === "All Germany";

  return (
    <div className="relative">
      <button
        onClick={() => onZoneSelect("All Germany")}
        className={`w-full mb-3 px-3 py-2 rounded-lg text-[10px] font-medium transition-all duration-150 flex items-center justify-center gap-2 ${
          isAll
            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
            : "border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isAll ? "bg-emerald-400" : "bg-white/30"}`} />
        All Germany
      </button>

      <svg viewBox="0 0 320 345" className="w-full h-auto select-none">
        <defs>
          <filter id="zone-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="pulse-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Object.entries(ZONE_PATHS).map(([key, { path, label, labelPos }]) => {
          const isActive = selectedZone === key;
          const base = BASE_STYLES[key];
          const cPct = congestionData?.[key] ?? 0;
          const congColor = getCongestionColor(cPct);
          const fillColor = isActive ? congColor.fill : isAll ? base.fill : base.fill;
          const strokeColor = isActive ? congColor.stroke : isAll ? base.stroke : base.stroke;

          return (
            <g
              key={key}
              onClick={() => onZoneSelect(key as Zone)}
              className="cursor-pointer"
              style={{
                opacity: isAll ? 0.9 : isActive ? 1 : 0.55,
                transition: "opacity 0.3s ease",
              }}
            >
              {isActive && (
                <path
                  d={path}
                  fill={congColor.glow}
                  filter="url(#zone-glow)"
                  className="pointer-events-none"
                />
              )}

              <path
                d={path}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isActive ? 2.5 : isAll ? 1.2 : 0.6}
                strokeLinejoin="round"
              />

              {/* Zone label */}
              <text
                x={labelPos[0]}
                y={labelPos[1]}
                textAnchor="middle"
                className="pointer-events-none"
                style={{
                  fontSize: isActive ? 10.5 : 9,
                  fill: isAll || isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: "0.02em",
                }}
              >
                {label}
              </text>

              {/* Congestion % indicator */}
              {(isAll || isActive) && cPct > 0 && (
                <text
                  x={labelPos[0]}
                  y={labelPos[1] + 14}
                  textAnchor="middle"
                  className="pointer-events-none"
                  style={{
                    fontSize: 9,
                    fill: cPct > 30 ? "rgba(239,68,68,0.9)" : cPct > 10 ? "rgba(245,158,11,0.8)" : "rgba(16,185,129,0.7)",
                    fontWeight: 600,
                  }}
                >
                  {cPct}% risk
                </text>
              )}

              {/* Active pulse */}
              {isActive && (
                <circle
                  cx={labelPos[0]}
                  cy={labelPos[1] + 28}
                  r={3}
                  fill={congColor.stroke}
                  filter="url(#pulse-glow)"
                >
                  <animate attributeName="r" values="2.5;4;2.5" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[9px] text-white/40">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400/60"></span>Normal</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400/60"></span>Warning</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400/60"></span>Critical</span>
      </div>
    </div>
  );
}
