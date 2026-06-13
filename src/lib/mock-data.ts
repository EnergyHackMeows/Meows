// ============================================================================
// Mock data generator for GridSight forecast dashboard.
//
// >>> SWAP POINT: Replace `generateMockData()` with a fetch() call to your
//     Python inference API. Keep the shape of `ForecastPoint` identical.
//     Example:
//       const res = await fetch("/api/forecast?zone=All Germany&asset=solar");
//       const data: ForecastPoint[] = await res.json();
// ============================================================================

export type AssetType = "solar" | "wind";
export type Zone =
  | "All Germany"
  | "TenneT"
  | "50Hertz"
  | "Amprion"
  | "TransnetBW";

export const ZONES: Zone[] = [
  "All Germany",
  "TenneT",
  "50Hertz",
  "Amprion",
  "TransnetBW",
];

export type WeatherCondition = "Sunny" | "Cloudy" | "High Wind Storm" | "Overcast" | "Clear Night";

export interface ForecastPoint {
  timestamp: string;          // ISO/UTC
  actualGeneration: number;   // SMARD.de ground truth (MWh)
  predictedGeneration: number;// ML model output (MWh)
  baseline: number;           // Naive persistence baseline (MWh)
  bandLower: number;          // 80% CI lower
  bandUpper: number;          // 80% CI upper
  assetType: AssetType;
  zoneLocation: Zone;
  weatherCondition: WeatherCondition;
}

// Deterministic pseudo-random so charts don't flicker
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ZONE_SCALE: Record<Zone, number> = {
  "All Germany": 1.0,
  TenneT: 0.42,
  "50Hertz": 0.28,
  Amprion: 0.22,
  TransnetBW: 0.12,
};

function solarCurve(hour: number) {
  // bell curve peaked at noon
  const x = (hour - 13) / 4.2;
  return Math.max(0, Math.exp(-x * x) * 18);
}

function windCurve(hour: number, rand: () => number) {
  // baseline + slow oscillation + noise
  return 8 + 3 * Math.sin((hour / 24) * Math.PI * 2 + 1.1) + (rand() - 0.5) * 2;
}

export function generateMockData(opts?: { seed?: number; anchor?: Date }): ForecastPoint[] {
  const rand = mulberry32(opts?.seed ?? 42);
  const anchor = opts?.anchor ?? new Date();
  anchor.setMinutes(0, 0, 0);
  const start = new Date(anchor.getTime() - 12 * 3600_000); // 12h back, 12h forward

  const points: ForecastPoint[] = [];
  const STEPS = 24 * 4; // 24h quarter-hourly

  for (const zone of ZONES) {
    const scale = ZONE_SCALE[zone];
    for (const asset of ["solar", "wind"] as AssetType[]) {
      for (let i = 0; i < STEPS; i++) {
        const ts = new Date(start.getTime() + i * 15 * 60_000);
        const hour = ts.getHours() + ts.getMinutes() / 60;

        const base = asset === "solar" ? solarCurve(hour) : windCurve(hour, rand);
        const weatherNoise = (rand() - 0.5) * (asset === "solar" ? 1.6 : 2.8);
        const actual = Math.max(0, (base + weatherNoise) * scale);

        // Predicted ~ actual with small model error
        const modelErr = (rand() - 0.5) * (asset === "solar" ? 0.8 : 1.4) * scale;
        const predicted = Math.max(0, actual + modelErr);

        // Naive persistence = value from 24h ago — simulate by shifting curve
        const baselineHour = hour;
        const baseB = asset === "solar" ? solarCurve(baselineHour) : windCurve(baselineHour + 3, rand);
        const baselineNoise = (rand() - 0.5) * (asset === "solar" ? 3.5 : 4.2);
        const baseline = Math.max(0, (baseB + baselineNoise) * scale);

        const sigma = Math.max(0.4, predicted * 0.12);
        const weather: WeatherCondition =
          asset === "solar"
            ? hour < 6 || hour > 20
              ? "Clear Night"
              : actual > 10 * scale
                ? "Sunny"
                : "Cloudy"
            : actual > 11 * scale
              ? "High Wind Storm"
              : "Overcast";

        points.push({
          timestamp: ts.toISOString(),
          actualGeneration: round(actual),
          predictedGeneration: round(predicted),
          baseline: round(baseline),
          bandLower: round(Math.max(0, predicted - sigma)),
          bandUpper: round(predicted + sigma),
          assetType: asset,
          zoneLocation: zone,
          weatherCondition: weather,
        });
      }
    }
  }
  return points;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

// Metrics
export function mae(rows: { a: number; p: number }[]) {
  if (!rows.length) return 0;
  return rows.reduce((s, r) => s + Math.abs(r.a - r.p), 0) / rows.length;
}
export function rmse(rows: { a: number; p: number }[]) {
  if (!rows.length) return 0;
  const m = rows.reduce((s, r) => s + (r.a - r.p) ** 2, 0) / rows.length;
  return Math.sqrt(m);
}
