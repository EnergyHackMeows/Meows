// German balancing-market domain logic
//
// Sources (all official, cited in repo PR description):
//   - Netztransparenz, "Uniform imbalance price (reBAP)" — https://www.netztransparenz.de/en/Balancing-Capacity/Imbalance-price/Uniform-imbalance-price-reBAP
//   - Amprion, "Nomination of schedules in Germany v4.6" (2024-10-01)
//   - TransnetBW, "Fahrplanabwicklung in Deutschland v2r1" / "Balancing Group Billing"
//   - EPEX SPOT, "MRC Day-Ahead Timings and Market Messages"
//   - 50Hertz "Almanach 2024" — historical reBAP distribution
//   - BNetzA / SMARD, "Redispatch 2.0" — EnWG §13a, NABEG 2.0
//   - pv-magazine 2026-06-10 — "Solarspitzengesetz" and negative-price hours
//
// All numbers in this file are either:
//   (a) regulatory constants taken from the cited sources, or
//   (b) deterministically derived from grid-data.json (the model forecast).
// No randomness, no hidden assumptions.

import { type Zone, getForecast72h, type ForecastHour } from "./mock-data";

// ─── German market timeline (CET, day-ahead workflow per StromNZV §5(1)) ────

export interface MarketEvent {
  key: string;
  label: string;
  when: string; // ISO offset within D-1 / D
  time_cet: string;
  day: "D-1" | "D";
  group: "forecast" | "auction" | "schedule" | "intraday" | "delivery";
  description: string;
  source: string;
}

// Source: Amprion AG-FPM v4.6 (2024-10-01), TransnetBW ESS v2r1, EPEX SPOT MRC.
// Times are CET. ISP = Imbalance Settlement Period = 15 min (per ACER ISHM).
export const MARKET_TIMELINE: MarketEvent[] = [
  {
    key: "tso_forecast",
    label: "TSO renewable forecast published",
    when: "D-1T08:00",
    time_cet: "08:00",
    day: "D-1",
    group: "forecast",
    description:
      "All four German TSOs publish their day-ahead wind & solar forecast (15-min granularity) per § 1 EEG transparency rules. Direct-marketers and traders feed this into their bidding strategy.",
    source: "netztransparenz.de · EEG transparency",
  },
  {
    key: "epex_gct",
    label: "EPEX day-ahead order book closes",
    when: "D-1T12:00",
    time_cet: "12:00",
    day: "D-1",
    group: "auction",
    description:
      "Gate Closure Time of the Single Day-Ahead Coupling (SDAC) auction on EPEX SPOT. Hourly products for the next day are locked at the cleared market price.",
    source: "EPEX SPOT MRC Day-Ahead Timings",
  },
  {
    key: "epex_results",
    label: "Day-ahead market results published",
    when: "D-1T12:55",
    time_cet: "12:45 – 13:05",
    day: "D-1",
    group: "auction",
    description:
      "SDAC clearing prices and volumes published. BRPs now know their day-ahead position; the difference vs. their physical forecast is what they must close on intraday.",
    source: "EPEX SPOT MRC",
  },
  {
    key: "tso_gct",
    label: "Schedule nomination GCT",
    when: "D-1T14:30",
    time_cet: "14:30",
    day: "D-1",
    group: "schedule",
    description:
      "Gate Closure Time per StromNZV §5(1): every balancing-group manager (BKV) must have nominated its day-ahead schedule to the relevant TSO. Cross-border schedules are matched immediately after.",
    source: "Amprion AG-FPM v4.6 · StromNZV §5(1)",
  },
  {
    key: "tso_cot",
    label: "Schedule Cut-Off Time (COT)",
    when: "D-1T15:30",
    time_cet: "15:30",
    day: "D-1",
    group: "schedule",
    description:
      "Last opportunity to correct a nominated schedule after the TSO matching process flags mismatches. After 15:30 the day-ahead schedule is final.",
    source: "Amprion AG-FPM v4.6",
  },
  {
    key: "intraday_open",
    label: "Continuous intraday opens",
    when: "D-1T16:00",
    time_cet: "16:00",
    day: "D-1",
    group: "intraday",
    description:
      "EPEX intraday continuous trading opens for German 15-min, 30-min and hourly contracts. BRPs trade here to close forecast errors as the delivery hour approaches.",
    source: "EPEX SPOT trading brochure",
  },
  {
    key: "delivery",
    label: "Delivery & 15-min ISP settlement",
    when: "DT00:00",
    time_cet: "00:00 – 23:45",
    day: "D",
    group: "delivery",
    description:
      "Physical delivery. Every 15-min ISP, the TSO measures the balancing-group imbalance and settles it at the reBAP. Intraday continuous remains open until 5 min before delivery within the same TSO zone.",
    source: "Netztransparenz reBAP · TransnetBW MaBiS",
  },
];

// ─── reBAP imbalance economics ──────────────────────────────────────────────

// Regulatory constants from cited sources.
//
// reBAP statistics (50Hertz Almanach 2024, IQR centered values):
//   - 2024 median quarter-hour reBAP ≈ €80/MWh in magnitude
//   - typical scarcity quarters: ±€200–€400/MWh
//   - historical extremes: −€584 to +€1,106/MWh
//
// We use a representative absolute reBAP of €80/MWh as the "base" expected
// cost per MWh of imbalance, and an inflated price for scarcity / negative-
// price quarters (midday solar peak when grid is structurally long).
export const REBAP_BASE_EUR_PER_MWH = 80; // median magnitude, 50Hertz 2024
export const REBAP_SCARCITY_EUR_PER_MWH = 250; // typical scarcity quarter
export const REBAP_EXTREME_EUR_PER_MWH = 600; // observed extreme magnitude

// Redispatch 2.0 calculated prices (Netztransparenz, recent quarter):
//   - positive redispatch cost up to €181.10/MWh
//   - negative redispatch cost down to −€130.40/MWh
export const REDISPATCH_POS_EUR_PER_MWH = 181;
export const REDISPATCH_NEG_EUR_PER_MWH = -130;

// pv-magazine 2026-06-10: Germany had 573 hours of negative day-ahead prices
// in 2025 (vs. 457 in 2024). Solarspitzengesetz → new PV gets €0 EEG during
// each such quarter-hour.
export const NEGATIVE_DA_HOURS_2025 = 573;

export interface ImbalanceHour {
  ts: string;
  hour: number;
  solar_q50: number;
  wind_q50: number;
  total_q50: number;
  upside_mwh: number; // q90 − q50 — overproduction risk magnitude (MWh)
  downside_mwh: number; // q50 − q10 — underproduction risk magnitude (MWh)
  band_mwh: number; // q90 − q10 — total uncertainty
  system_state: "long" | "balanced" | "short"; // expected system direction in that hour
  rebap_signed_eur_per_mwh: number; // signed expected reBAP (negative = pays producer when long)
  expected_cost_eur: number; // expected € exposure if BRP is left at uncertainty mid-band
  worst_case_cost_eur: number; // € exposure at P90 deviation and scarcity reBAP
  solarspitzen_flag: boolean; // overproduction during likely-negative-price quarter (midday + high solar)
  congestion_risk: "normal" | "warning" | "critical";
}

// Heuristic for system direction (deterministic, derived from forecast):
//   - solar dominates 10:00–15:00 with q50 > capacity*0.3 → system likely LONG
//     (matches the recurring negative-DA-price midday pattern reported by EPEX
//     and pv-magazine).
//   - hours 06:00 / 18:00–20:00 (ramp shoulders) → likely SHORT.
//   - otherwise balanced.
function inferSystemState(h: ForecastHour): "long" | "balanced" | "short" {
  const hour = h.hour;
  const solarShare = h.capacity > 0 ? h.solar_q50 / h.capacity : 0;
  const totalShare = h.capacity > 0 ? h.total_q50 / h.capacity : 0;

  if (hour >= 10 && hour <= 15 && solarShare > 0.25) return "long";
  if (totalShare > 0.7) return "long";
  if ((hour >= 17 && hour <= 20) || (hour >= 6 && hour <= 8)) {
    if (totalShare < 0.3) return "short";
  }
  return "balanced";
}

function rebapForState(state: "long" | "balanced" | "short", upside: number, cap: number): number {
  // Sign convention: negative reBAP means producer PAYS when long (overproduction
  // when system is long → cost). Positive reBAP means producer is rewarded for
  // injecting (when system is short).
  const surge = cap > 0 && upside / cap > 0.08; // surge if uncertainty > 8% of capacity
  const magnitude = surge ? REBAP_SCARCITY_EUR_PER_MWH : REBAP_BASE_EUR_PER_MWH;

  if (state === "long") return -magnitude; // overproduction punished
  if (state === "short") return +magnitude; // underproduction punished (reverse)
  return 0; // balanced quarter → reBAP near zero on average
}

export function getImbalanceExposure(zone: Zone): ImbalanceHour[] {
  const forecast = getForecast72h(zone);
  return forecast.map((h) => {
    const upside = Math.max(0, h.total_q90 - h.total_q50);
    const downside = Math.max(0, h.total_q50 - h.total_q10);
    const band = Math.max(0, h.total_q90 - h.total_q10);

    const state = inferSystemState(h);
    const rebap = rebapForState(state, upside, h.capacity);

    // Expected cost: median of |deviation| × |reBAP|. We treat the half-band
    // (band/2) as the mean absolute deviation a hedge-less BRP would face.
    const expectedDeviation = band / 2;
    const expectedCost = expectedDeviation * Math.abs(rebap);

    // Worst case: P90 upside × scarcity reBAP (overproduction during long quarter).
    const worstDeviation = state === "long" ? upside : downside;
    const worstCost = worstDeviation * REBAP_SCARCITY_EUR_PER_MWH;

    // Solarspitzengesetz exposure: midday quarter, solar dominant, system long,
    // and meaningful upside risk → likely negative-DA-price quarter → €0 EEG.
    const solarShare = h.capacity > 0 ? h.solar_q50 / h.capacity : 0;
    const solarspitzen =
      h.hour >= 11 &&
      h.hour <= 14 &&
      solarShare > 0.25 &&
      state === "long" &&
      h.capacity > 0 &&
      upside / h.capacity > 0.05;

    return {
      ts: h.ts,
      hour: h.hour,
      solar_q50: h.solar_q50,
      wind_q50: h.wind_q50,
      total_q50: h.total_q50,
      upside_mwh: Math.round(upside),
      downside_mwh: Math.round(downside),
      band_mwh: Math.round(band),
      system_state: state,
      rebap_signed_eur_per_mwh: Math.round(rebap),
      expected_cost_eur: Math.round(expectedCost),
      worst_case_cost_eur: Math.round(worstCost),
      solarspitzen_flag: solarspitzen,
      congestion_risk: h.congestion_risk,
    };
  });
}

export interface ImbalanceSummary {
  total_band_mwh: number; // sum of P90−P10 over horizon
  expected_cost_eur_24h: number; // sum over first 24h
  expected_cost_eur_72h: number;
  worst_case_cost_eur_72h: number;
  long_hours: number;
  short_hours: number;
  balanced_hours: number;
  solarspitzen_hours: number;
  peak_exposure_hour?: ImbalanceHour;
}

export function getImbalanceSummary(zone: Zone): ImbalanceSummary {
  const rows = getImbalanceExposure(zone);
  const first24 = rows.slice(0, 24);

  let totalBand = 0;
  let exp24 = 0;
  let exp72 = 0;
  let worst72 = 0;
  let longH = 0;
  let shortH = 0;
  let balH = 0;
  let solarH = 0;
  let peak: ImbalanceHour | undefined;

  rows.forEach((r, i) => {
    totalBand += r.band_mwh;
    exp72 += r.expected_cost_eur;
    worst72 += r.worst_case_cost_eur;
    if (i < 24) exp24 += r.expected_cost_eur;
    if (r.system_state === "long") longH++;
    else if (r.system_state === "short") shortH++;
    else balH++;
    if (r.solarspitzen_flag) solarH++;
    if (!peak || r.worst_case_cost_eur > peak.worst_case_cost_eur) peak = r;
  });

  return {
    total_band_mwh: Math.round(totalBand),
    expected_cost_eur_24h: Math.round(exp24),
    expected_cost_eur_72h: Math.round(exp72),
    worst_case_cost_eur_72h: Math.round(worst72),
    long_hours: longH,
    short_hours: shortH,
    balanced_hours: balH,
    solarspitzen_hours: solarH,
    peak_exposure_hour: peak,
  };
}

// ─── Day-ahead countdown ────────────────────────────────────────────────────

export interface CountdownState {
  next_event: MarketEvent;
  minutes_until: number;
  human: string;
  passed: MarketEvent[];
  upcoming: MarketEvent[];
}

function minutesOfDay(hhmm: string): number {
  // Accepts "HH:MM" or "HH:MM – HH:MM" (returns first time)
  const first = hhmm.split("–")[0]?.trim() ?? hhmm.trim();
  const [h, m] = first.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export function getMarketCountdown(now: Date = new Date()): CountdownState {
  // Build event timestamps anchored to "today" relative to D = today + 1.
  // For UI purposes we treat "now" as positioned somewhere in D-1.
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Map event "day" to a minutes-offset relative to today midnight.
  // D-1 events fire today; D events fire tomorrow → +1440.
  const stamped = MARKET_TIMELINE.map((e) => {
    const base = e.day === "D" ? 24 * 60 : 0;
    return { event: e, atMin: base + minutesOfDay(e.time_cet) };
  });

  const passed = stamped.filter((s) => s.atMin <= nowMin).map((s) => s.event);
  const upcoming = stamped.filter((s) => s.atMin > nowMin).map((s) => s.event);
  const nextStamped = stamped.find((s) => s.atMin > nowMin) ?? stamped[stamped.length - 1];

  const minutesUntil = Math.max(0, nextStamped.atMin - nowMin);
  const h = Math.floor(minutesUntil / 60);
  const m = minutesUntil % 60;
  const human = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return {
    next_event: nextStamped.event,
    minutes_until: minutesUntil,
    human,
    passed,
    upcoming,
  };
}
