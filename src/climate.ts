import { HA_COLORS, PROFILES } from './const';
import type { ColorStop, Level, ResolvedConfig } from './types';

/* ---------- Farben ---------- */

/** Turns a HA color name ("light-blue", "red") into a themeable CSS value; other values pass through. */
export function cssColor(color: string): string {
  const key = color.trim().toLowerCase().replace(/_/g, '-');
  return key in HA_COLORS ? `var(--${key}-color, ${HA_COLORS[key]})` : color;
}

/** Color for a value on a stop scale, as a CSS color (uses color-mix between neighbouring stops). */
export function colorOnScale(stops: ColorStop[], value: number): string {
  if (!stops.length) return 'var(--state-icon-color)';
  if (value <= stops[0].value) return cssColor(stops[0].color);
  const last = stops[stops.length - 1];
  if (value >= last.value) return cssColor(last.color);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (value <= b.value) {
      const k = Math.round(((value - a.value) / (b.value - a.value)) * 100);
      if (k <= 0) return cssColor(a.color);
      if (k >= 100) return cssColor(b.color);
      return `color-mix(in srgb, ${cssColor(b.color)} ${k}%, ${cssColor(a.color)})`;
    }
  }
  return cssColor(last.color);
}

/* ---------- Einheiten und Physik ---------- */

export const isFahrenheit = (unit?: string) => unit === '°F' || unit === 'F';
export const toCelsius = (v: number, unit?: string) => (isFahrenheit(unit) ? ((v - 32) * 5) / 9 : v);
export const fromCelsius = (v: number, unit?: string) => (isFahrenheit(unit) ? (v * 9) / 5 + 32 : v);

/** Converts a pressure value to hPa. */
export function toHpa(v: number, unit?: string): number {
  switch ((unit ?? '').toLowerCase()) {
    case 'kpa':
      return v * 10;
    case 'pa':
      return v / 100;
    case 'inhg':
      return v * 33.8639;
    case 'mmhg':
      return v * 1.33322;
    case 'psi':
      return v * 68.9476;
    case 'bar':
      return v * 1000;
    default:
      return v; // hPa, mbar
  }
}

/** Dew point in °C (Magnus formula). */
export function dewPoint(tC: number, rh: number): number {
  const a = 17.62;
  const b = 243.12;
  const g = Math.log(Math.max(rh, 0.1) / 100) + (a * tC) / (b + tC);
  return (b * g) / (a - g);
}

/** Absolute humidity in g/m³. */
export function absoluteHumidity(tC: number, rh: number): number {
  return (6.112 * Math.exp((17.67 * tC) / (tC + 243.5)) * rh * 2.1674) / (273.15 + tC);
}

export type Trend = 'rising' | 'falling' | 'steady';
/** Barometric tendency from the change over 3 hours (in hPa). */
export function pressureTrend(deltaHpa: number): Trend {
  if (deltaHpa >= 1) return 'rising';
  if (deltaHpa <= -1) return 'falling';
  return 'steady';
}

/* ---------- Bewertungen ---------- */

export interface Assessment {
  level: Level;
  /** localize key */
  key: string;
  color: string;
}

export function humidityState(rh: number, cfg: ResolvedConfig): Assessment {
  if (!PROFILES[cfg.profile].humidityWarnings) {
    return { level: 'ok', key: rh >= 90 ? 'hum_very_humid' : rh < 40 ? 'hum_dry' : 'hum_normal', color: cssColor('blue') };
  }
  const t = cfg.humidity_thresholds;
  if (rh >= t.critical) return { level: 'critical', key: 'hum_mold', color: cssColor('red') };
  if (rh >= t.high) return { level: 'warning', key: 'hum_high', color: cssColor('orange') };
  if (rh < t.low) return { level: 'warning', key: 'hum_too_dry', color: cssColor('orange') };
  if (rh < cfg.comfort.humidity_min) return { level: 'ok', key: 'hum_slightly_dry', color: cssColor('light-blue') };
  return { level: 'ok', key: 'hum_ideal', color: cssColor('blue') };
}

/** Temperature warning (null when nothing to warn about). */
export function temperatureWarning(tC: number, rh: number | null, cfg: ResolvedConfig): Assessment | null {
  const p = PROFILES[cfg.profile];
  if (cfg.profile === 'outdoor') {
    if (p.ice !== undefined && tC <= p.ice && rh !== null && rh >= (p.iceHumidity ?? 80)) {
      return { level: 'critical', key: 'ice', color: cssColor('red') };
    }
    if (p.frost !== undefined && tC <= p.frost) return { level: 'warning', key: 'frost', color: cssColor('blue') };
    if (p.heat !== undefined && tC >= p.heat) return { level: 'warning', key: 'heat', color: cssColor('red') };
    return null;
  }
  if (p.tempWarnHigh !== undefined && tC >= p.tempWarnHigh) return { level: 'warning', key: 'temp_hot', color: cssColor('red') };
  if (p.tempWarnLow !== undefined && tC < p.tempWarnLow) return { level: 'warning', key: 'temp_cold', color: cssColor('blue') };
  return null;
}

export interface ComfortResult {
  /** localize keys; joined with " & " and capitalised for display */
  keys: string[];
  color: string;
}

export function comfortState(tC: number, rh: number | null, cfg: ResolvedConfig): ComfortResult {
  if (cfg.profile === 'outdoor') {
    const p = PROFILES.outdoor;
    if (rh !== null && tC <= (p.ice ?? 1) && rh >= (p.iceHumidity ?? 80)) return { keys: ['w_ice'], color: cssColor('red') };
    const key =
      tC < -5 ? 'w_severe_frost' : tC <= 0 ? 'w_frost' : tC < 10 ? 'w_cold' : tC < 18 ? 'w_cool' : tC < 25 ? 'w_pleasant' : tC < 30 ? 'w_warm' : 'w_hot';
    return { keys: [key], color: colorOnScale(p.stops, tC) };
  }
  const c = cfg.comfort;
  const h = rh ?? (c.humidity_min + c.humidity_max) / 2;
  const inner = tC >= c.temp_min && tC <= c.temp_max && h >= c.humidity_min && h <= c.humidity_max;
  if (inner) return { keys: ['comfortable'], color: cssColor('green') };
  const outer = tC >= c.temp_min - 2 && tC <= c.temp_max + 2 && h >= c.humidity_min - 10 && h <= c.humidity_max + 10;
  const keys: string[] = [];
  if (tC < c.temp_min) keys.push('cool');
  else if (tC > c.temp_max) keys.push('warm');
  if (rh !== null) {
    if (h < c.humidity_min) keys.push('dry');
    else if (h > c.humidity_max) keys.push('humid');
  }
  return { keys, color: cssColor(outer ? 'amber' : 'red') };
}
