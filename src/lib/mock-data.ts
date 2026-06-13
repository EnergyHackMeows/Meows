// ============================================================================
// GridSight Data Layer — Real Model Outputs
//
// ALL data in this file comes from:
//   model/generate_frontend_data.py
// which runs inference on trained LightGBM models using real SMARD + Open-Meteo data.
//
// NO dummy data. NO random numbers. NO assumptions.
// ============================================================================

import gridData from "./grid-data.json";

export type Zone = "All Germany" | "50Hertz" | "TenneT" | "Amprion" | "TransnetBW";
export type Timeframe = "15min" | "1h" | "daily" | "weekly" | "monthly" | "yearly";
export type AssetView = "solar" | "wind" | "both";

export const ZONES: Zone[] = ["All Germany", "50Hertz", "TenneT", "Amprion", "TransnetBW"];
export const TIMEFRAMES: { key: Timeframe; label: string; description: string }[] = [
  { key: "15min", label: "15 min", description: "Raw SMARD generation data (last 24h)" },
  { key: "1h", label: "1 Hour", description: "Hourly model forecast (next 72h)" },
  { key: "daily", label: "1 Day", description: "Daily actuals vs predictions (test set)" },
  { key: "weekly", label: "1 Week", description: "Weekly totals (Mar–Jun 2026)" },
  { key: "monthly", label: "1 Month", description: "Monthly totals (2021–2026)" },
  { key: "yearly", label: "1 Year", description: "Yearly totals (2021–2026)" },
];

// Types matching the JSON structure
export interface ModelMetrics {
  mae: number;
  rmse: number;
  baselineMae: number;
  baselineRmse: number;
  improvement: number;
  coverage: number;
}

export interface FeatureImportance {
  name: string;
  importance: number;
}

export interface HourlyPoint {
  ts: string;
  hour: number;
  solar_q50: number;
  solar_q10: number;
  solar_q90: number;
  wind_q50: number;
  wind_q10: number;
  wind_q90: number;
  persistence_solar: number;
  persistence_wind: number;
}

export interface FifteenMinPoint {
  ts: string;
  solar: number;
  wind_total: number;
}

export interface DailyPoint {
  date: string;
  solar_actual: number;
  wind_actual: number;
  solar_pred: number;
  wind_pred: number;
  solar_lo: number;
  solar_hi: number;
  wind_lo: number;
  wind_hi: number;
  baseline_solar: number;
  baseline_wind: number;
}

export interface WeeklyPoint {
  week: string;
  solar_actual: number;
  wind_actual: number;
  solar_pred: number;
  wind_pred: number;
  baseline_solar: number;
  baseline_wind: number;
}

export interface MonthlyPoint {
  month: string;
  solar: number;
  wind: number;
}

export interface YearlyPoint {
  year: string;
  solar: number;
  wind: number;
}

export interface RampEvent {
  hour: number;
  delta: number;
  direction: "up" | "down";
  magnitude: "medium" | "large";
}

export interface MarketSignals {
  peak_renewable_hour: number;
  peak_generation_mwh: number;
  min_renewable_hour: number;
  min_generation_mwh: number;
  total_24h_generation: number;
  ramp_events: RampEvent[];
  recommendation: string;
}

// Cast imported data
const data = gridData as any;

// Public API
export function getMetrics(zone: Zone): { solar: ModelMetrics; wind: ModelMetrics } {
  return data.metrics[zone];
}

export function getFeatureImportance(asset: "solar" | "wind"): FeatureImportance[] {
  return data.feature_importance[asset];
}

export function getMarketSignals(): MarketSignals {
  return data.market_signals;
}

export function getDataSource() {
  return data.data_source;
}

export function getModelConfig() {
  return data.model_config;
}

export function get15MinData(zone: Zone): FifteenMinPoint[] {
  return data.timeframes["15min"][zone] ?? [];
}

export function getHourlyForecast(zone: Zone): HourlyPoint[] {
  return data.timeframes["1h"][zone] ?? [];
}

export function getDailyData(zone: Zone): DailyPoint[] {
  return data.timeframes["daily"][zone] ?? [];
}

export function getWeeklyData(zone: Zone): WeeklyPoint[] {
  return data.timeframes["weekly"][zone] ?? [];
}

export function getMonthlyData(zone: Zone): MonthlyPoint[] {
  return data.timeframes["monthly"][zone] ?? [];
}

export function getYearlyData(zone: Zone): YearlyPoint[] {
  return data.timeframes["yearly"][zone] ?? [];
}

// Derived computations
export function getPeakSolar(zone: Zone): number {
  const hourly = getHourlyForecast(zone);
  if (!hourly.length) return 0;
  return Math.max(...hourly.map(h => h.solar_q50));
}

export function getPeakWind(zone: Zone): number {
  const hourly = getHourlyForecast(zone);
  if (!hourly.length) return 0;
  return Math.max(...hourly.map(h => h.wind_q50));
}

export function getTotalGeneration(zone: Zone): number {
  const hourly = getHourlyForecast(zone);
  return hourly.reduce((sum, h) => sum + h.solar_q50 + h.wind_q50, 0);
}

export function getCombinedImprovement(zone: Zone): number {
  const m = getMetrics(zone);
  const combinedModel = m.solar.mae + m.wind.mae;
  const combinedBaseline = m.solar.baselineMae + m.wind.baselineMae;
  return combinedBaseline > 0 ? ((combinedBaseline - combinedModel) / combinedBaseline) * 100 : 0;
}
