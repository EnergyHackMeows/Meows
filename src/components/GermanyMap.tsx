import { type Zone } from "@/lib/mock-data";

interface GermanyMapProps {
  selected: Zone;
  onSelect: (zone: Zone) => void;
}

// Simplified SVG paths for Germany's 4 TSO zones
// Based on actual geographic boundaries of transmission system operators
const ZONE_PATHS: Record<string, { path: string; label: string; labelPos: [number, number] }> = {
  "50Hertz": {
    // Eastern Germany: Brandenburg, Berlin, Mecklenburg-Vorpommern, Sachsen, Sachsen-Anhalt, Thüringen
    path: "M 195,15 L 230,12 L 255,20 L 275,15 L 290,25 L 295,50 L 300,75 L 295,100 L 290,130 L 285,155 L 270,175 L 255,195 L 240,210 L 225,225 L 210,230 L 195,225 L 185,210 L 180,195 L 175,180 L 180,160 L 185,140 L 180,120 L 175,100 L 180,80 L 185,60 L 190,40 Z",
    label: "50Hertz",
    labelPos: [230, 120],
  },
  TenneT: {
    // Northern + parts of Southern: Schleswig-Holstein, Niedersachsen, parts of Bayern, Hessen
    path: "M 100,5 L 130,8 L 155,5 L 175,10 L 195,15 L 190,40 L 185,60 L 180,80 L 175,100 L 180,120 L 185,140 L 180,160 L 175,180 L 170,195 L 160,200 L 155,215 L 160,235 L 170,255 L 180,275 L 190,290 L 200,305 L 210,320 L 200,330 L 185,325 L 170,315 L 160,300 L 155,285 L 145,270 L 135,260 L 125,250 L 120,235 L 115,220 L 108,205 L 105,190 L 100,175 L 95,155 L 90,135 L 85,115 L 88,95 L 92,75 L 95,55 L 98,35 L 100,20 Z",
    label: "TenneT",
    labelPos: [140, 155],
  },
  Amprion: {
    // Western Germany: NRW, Rheinland-Pfalz, Saarland, parts of Hessen
    path: "M 30,80 L 50,75 L 70,78 L 85,85 L 88,95 L 85,115 L 90,135 L 95,155 L 100,175 L 105,190 L 108,205 L 115,220 L 120,235 L 115,250 L 105,258 L 95,265 L 85,260 L 75,250 L 65,240 L 55,225 L 48,210 L 42,195 L 38,175 L 35,155 L 30,135 L 28,115 L 30,95 Z",
    label: "Amprion",
    labelPos: [70, 170],
  },
  TransnetBW: {
    // Baden-Württemberg (southwestern)
    path: "M 85,260 L 95,265 L 105,258 L 115,250 L 120,235 L 125,250 L 135,260 L 145,270 L 155,285 L 160,300 L 155,315 L 145,325 L 130,330 L 115,328 L 100,320 L 88,310 L 78,295 L 75,280 L 80,270 Z",
    label: "TransnetBW",
    labelPos: [118, 290],
  },
};

const ZONE_COLORS: Record<string, { fill: string; active: string }> = {
  "50Hertz": { fill: "rgba(6, 182, 212, 0.15)", active: "rgba(6, 182, 212, 0.4)" },
  TenneT: { fill: "rgba(245, 158, 11, 0.15)", active: "rgba(245, 158, 11, 0.4)" },
  Amprion: { fill: "rgba(168, 85, 247, 0.15)", active: "rgba(168, 85, 247, 0.4)" },
  TransnetBW: { fill: "rgba(52, 211, 153, 0.15)", active: "rgba(52, 211, 153, 0.4)" },
};

const ZONE_STROKE: Record<string, string> = {
  "50Hertz": "rgba(6, 182, 212, 0.6)",
  TenneT: "rgba(245, 158, 11, 0.6)",
  Amprion: "rgba(168, 85, 247, 0.6)",
  TransnetBW: "rgba(52, 211, 153, 0.6)",
};

export function GermanyMap({ selected, onSelect }: GermanyMapProps) {
  const isAllGermany = selected === "All Germany";

  return (
    <div className="relative">
      {/* "All Germany" toggle */}
      <button
        onClick={() => onSelect("All Germany")}
        className={`w-full mb-2 px-3 py-1.5 rounded-md text-[11px] font-medium font-mono transition-all ${
          isAllGermany
            ? "bg-[color:var(--accent)] border border-[color:var(--panel-border)] text-foreground"
            : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
        }`}
      >
        All Germany
      </button>

      {/* SVG Map */}
      <svg
        viewBox="0 0 320 345"
        className="w-full h-auto"
        style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}
      >
        {/* Background glow for selected zone */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Render zones */}
        {Object.entries(ZONE_PATHS).map(([zoneKey, { path, label, labelPos }]) => {
          const isActive = selected === zoneKey;
          const isHighlighted = isAllGermany || isActive;
          const colors = ZONE_COLORS[zoneKey];
          const stroke = ZONE_STROKE[zoneKey];

          return (
            <g
              key={zoneKey}
              onClick={() => onSelect(zoneKey as Zone)}
              className="cursor-pointer transition-all duration-200"
              style={{ opacity: isAllGermany ? 0.85 : isActive ? 1 : 0.4 }}
            >
              <path
                d={path}
                fill={isHighlighted ? colors.active : colors.fill}
                stroke={stroke}
                strokeWidth={isActive ? 2 : 1}
                className="transition-all duration-200 hover:opacity-100"
                filter={isActive ? "url(#glow)" : undefined}
              />
              <text
                x={labelPos[0]}
                y={labelPos[1]}
                textAnchor="middle"
                className="pointer-events-none select-none"
                style={{
                  fontSize: isActive ? 11 : 9,
                  fontFamily: "JetBrains Mono, monospace",
                  fill: isHighlighted ? "var(--foreground)" : "var(--muted-foreground)",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {label}
              </text>
              {/* Zone capacity indicator dot */}
              <circle
                cx={labelPos[0]}
                cy={labelPos[1] + 14}
                r={isActive ? 4 : 2.5}
                fill={stroke}
                className="transition-all duration-200"
                opacity={isHighlighted ? 1 : 0.5}
              />
            </g>
          );
        })}

        {/* Compass indicator */}
        <text x="15" y="20" style={{ fontSize: 9, fill: "var(--muted-foreground)", fontFamily: "JetBrains Mono" }}>N</text>
        <line x1="18" y1="22" x2="18" y2="32" stroke="var(--muted-foreground)" strokeWidth="0.5" markerEnd="url(#arrow)" />
      </svg>

      {/* Selected zone indicator */}
      <div className="mt-2 text-center">
        <span className="text-[10px] font-mono text-muted-foreground">
          {isAllGermany ? "All 4 TSO zones" : `Selected: ${selected}`}
        </span>
      </div>
    </div>
  );
}
