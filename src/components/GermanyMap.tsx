import { type Zone } from "@/lib/mock-data";

interface GermanyMapProps {
  selected: Zone;
  onSelect: (zone: Zone) => void;
}

const ZONE_PATHS: Record<string, { path: string; label: string; labelPos: [number, number] }> = {
  "50Hertz": {
    path: "M 195,15 L 230,12 L 255,20 L 275,15 L 290,25 L 295,50 L 300,75 L 295,100 L 290,130 L 285,155 L 270,175 L 255,195 L 240,210 L 225,225 L 210,230 L 195,225 L 185,210 L 180,195 L 175,180 L 180,160 L 185,140 L 180,120 L 175,100 L 180,80 L 185,60 L 190,40 Z",
    label: "50Hertz",
    labelPos: [232, 115],
  },
  TenneT: {
    path: "M 100,5 L 130,8 L 155,5 L 175,10 L 195,15 L 190,40 L 185,60 L 180,80 L 175,100 L 180,120 L 185,140 L 180,160 L 175,180 L 170,195 L 160,200 L 155,215 L 160,235 L 170,255 L 180,275 L 190,290 L 200,305 L 210,320 L 200,330 L 185,325 L 170,315 L 160,300 L 155,285 L 145,270 L 135,260 L 125,250 L 120,235 L 115,220 L 108,205 L 105,190 L 100,175 L 95,155 L 90,135 L 85,115 L 88,95 L 92,75 L 95,55 L 98,35 L 100,20 Z",
    label: "TenneT",
    labelPos: [138, 148],
  },
  Amprion: {
    path: "M 30,80 L 50,75 L 70,78 L 85,85 L 88,95 L 85,115 L 90,135 L 95,155 L 100,175 L 105,190 L 108,205 L 115,220 L 120,235 L 115,250 L 105,258 L 95,265 L 85,260 L 75,250 L 65,240 L 55,225 L 48,210 L 42,195 L 38,175 L 35,155 L 30,135 L 28,115 L 30,95 Z",
    label: "Amprion",
    labelPos: [70, 168],
  },
  TransnetBW: {
    path: "M 85,260 L 95,265 L 105,258 L 115,250 L 120,235 L 125,250 L 135,260 L 145,270 L 155,285 L 160,300 L 155,315 L 145,325 L 130,330 L 115,328 L 100,320 L 88,310 L 78,295 L 75,280 L 80,270 Z",
    label: "TransnetBW",
    labelPos: [118, 288],
  },
};

const ZONE_STYLES: Record<string, { fill: string; active: string; stroke: string; glow: string }> = {
  "50Hertz": {
    fill: "rgba(6, 182, 212, 0.08)",
    active: "rgba(6, 182, 212, 0.28)",
    stroke: "rgba(6, 182, 212, 0.5)",
    glow: "rgba(6, 182, 212, 0.3)",
  },
  TenneT: {
    fill: "rgba(245, 158, 11, 0.08)",
    active: "rgba(245, 158, 11, 0.28)",
    stroke: "rgba(245, 158, 11, 0.5)",
    glow: "rgba(245, 158, 11, 0.3)",
  },
  Amprion: {
    fill: "rgba(168, 85, 247, 0.08)",
    active: "rgba(168, 85, 247, 0.28)",
    stroke: "rgba(168, 85, 247, 0.5)",
    glow: "rgba(168, 85, 247, 0.3)",
  },
  TransnetBW: {
    fill: "rgba(52, 211, 153, 0.08)",
    active: "rgba(52, 211, 153, 0.28)",
    stroke: "rgba(52, 211, 153, 0.5)",
    glow: "rgba(52, 211, 153, 0.3)",
  },
};

export function GermanyMap({ selected, onSelect }: GermanyMapProps) {
  const isAll = selected === "All Germany";

  return (
    <div className="relative">
      <button
        onClick={() => onSelect("All Germany")}
        className={`w-full mb-3 px-3 py-2 rounded-lg text-[10px] font-medium font-mono transition-all duration-150 flex items-center justify-center gap-2 ${
          isAll
            ? "bg-[color:var(--signal-sell)]/8 border border-[color:var(--signal-sell)]/20 text-[color:var(--signal-sell)]"
            : "border border-[color:var(--panel-border)] text-muted-foreground hover:text-foreground hover:border-[color:var(--muted-foreground)]/30"
        }`}
      >
        <span className={`size-1.5 rounded-full ${isAll ? "bg-[color:var(--signal-sell)]" : "bg-muted-foreground/40"}`} />
        All Germany (Aggregated)
      </button>

      <svg viewBox="0 0 320 345" className="w-full h-auto select-none">
        <defs>
          <filter id="zone-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Object.entries(ZONE_PATHS).map(([key, { path, label, labelPos }]) => {
          const isActive = selected === key;
          const styles = ZONE_STYLES[key];
          const visible = isAll || isActive;

          return (
            <g
              key={key}
              onClick={() => onSelect(key as Zone)}
              className="cursor-pointer"
              style={{
                opacity: isAll ? 0.9 : isActive ? 1 : 0.3,
                transition: "opacity 0.2s ease, transform 0.2s ease",
              }}
            >
              {/* Shadow layer for active zone */}
              {isActive && (
                <path
                  d={path}
                  fill={styles.glow}
                  filter="url(#zone-glow)"
                  className="pointer-events-none"
                />
              )}

              <path
                d={path}
                fill={visible ? styles.active : styles.fill}
                stroke={styles.stroke}
                strokeWidth={isActive ? 2.5 : isAll ? 1.2 : 0.8}
                strokeLinejoin="round"
              />

              {/* Label */}
              <text
                x={labelPos[0]}
                y={labelPos[1]}
                textAnchor="middle"
                className="pointer-events-none"
                style={{
                  fontSize: isActive ? 11 : 9.5,
                  fontFamily: "var(--font-mono)",
                  fill: visible ? "var(--foreground)" : "var(--muted-foreground)",
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: "0.02em",
                }}
              >
                {label}
              </text>

              {/* Active dot indicator */}
              {isActive && (
                <circle
                  cx={labelPos[0]}
                  cy={labelPos[1] + 15}
                  r={3.5}
                  fill={styles.stroke}
                  opacity={0.9}
                >
                  <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
