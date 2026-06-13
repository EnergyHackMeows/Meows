// GridSight TSO Command Center — Data Layer
import gridData from "./grid-data.json";

export type Zone = "All Germany" | "50Hertz" | "TenneT" | "Amprion" | "TransnetBW";
export const ZONES: Zone[] = ["All Germany", "50Hertz", "TenneT", "Amprion", "TransnetBW"];

const data = gridData as any;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ModelMetrics {
  mae: number;
  rmse: number;
  baselineMae: number;
  improvement: number;
  coverage: number;
}

export interface ForecastHour {
  ts: string;
  hour: number;
  solar_q50: number;
  solar_q10: number;
  solar_q90: number;
  wind_q50: number;
  wind_q10: number;
  wind_q90: number;
  total_q50: number;
  total_q10: number;
  total_q90: number;
  baseline: number;
  capacity: number;
  congestion_risk: "normal" | "warning" | "critical";
}

export interface ValidationPoint {
  ts: string;
  actual_solar: number;
  actual_wind: number;
  actual_total: number;
  predicted_solar: number;
  predicted_wind: number;
  predicted_total: number;
  lower_total: number;
  upper_total: number;
  baseline_total: number;
}

export interface Alert {
  zone: string;
  type: "ramp" | "congestion";
  severity: "warning" | "critical";
  hour: number;
  ts: string;
  message: string;
  value: number;
}

export interface CongestionSummary {
  capacity_mw: number;
  peak_generation_mw: number;
  peak_utilization_pct: number;
  peak_hour: string;
  critical_hours: number;
  warning_hours: number;
  safe_hours: number;
  congestion_probability_pct: number;
}

export interface Savings {
  mae_reduction_mwh: number;
  hourly_saving_eur: number;
  daily_saving_eur: number;
  annual_saving_eur: number;
  imbalance_cost_eur_per_mwh: number;
}

export interface FeatureImportance {
  name: string;
  importance: number;
}

export interface FifteenMinPoint {
  ts: string;
  solar: number;
  wind: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export function getProduct() {
  return data.product as {
    name: string;
    tagline: string;
    problem: string;
    solution: string;
    hero_stat: string;
  };
}

export function getMetrics(zone: Zone): { solar: ModelMetrics; wind: ModelMetrics } {
  return data.metrics[zone];
}

export function getForecast72h(zone: Zone): ForecastHour[] {
  return data.forecast_72h[zone] ?? [];
}

export function getValidation(zone: Zone): ValidationPoint[] {
  return data.validation[zone] ?? [];
}

export function get15MinActuals(zone: Zone): FifteenMinPoint[] {
  return data.fifteen_min_actuals[zone] ?? [];
}

export function getAlerts(zone?: Zone): Alert[] {
  const all: Alert[] = data.alerts ?? [];
  if (!zone || zone === "All Germany") return all;
  return all.filter((a) => a.zone === zone);
}

export function getCongestion(zone: Zone): CongestionSummary {
  return data.congestion[zone];
}

export function getSavings(zone: Zone): Savings {
  return data.savings[zone];
}

export function getFeatureImportance(asset: "solar" | "wind"): FeatureImportance[] {
  return data.feature_importance[asset];
}

export function getModelConfig() {
  return data.model_config;
}

export function getZoneCapacity(zone: Zone): number {
  return data.zone_capacities[zone] ?? 92000;
}

export function getGeneratedAt(): string {
  return data.generated_at ?? "";
}

// ─── Derived ─────────────────────────────────────────────────────────────────

export function getPeakGeneration(zone: Zone): { value: number; hour: string } {
  const hrs = getForecast72h(zone);
  if (!hrs.length) return { value: 0, hour: "" };
  const peak = hrs.reduce((max, h) => (h.total_q50 > max.total_q50 ? h : max), hrs[0]);
  return { value: peak.total_q50, hour: peak.ts };
}

export function getRampCount(zone: Zone): number {
  return getAlerts(zone).filter((a) => a.type === "ramp").length;
}

export function getCriticalAlerts(zone: Zone): Alert[] {
  return getAlerts(zone).filter((a) => a.severity === "critical").slice(0, 10);
}

export function formatEUR(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}k`;
  return `€${v.toFixed(0)}`;
}

export function formatMW(v: number): string {
  if (v >= 100_000) return `${(v / 1_000).toFixed(0)}k`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}
