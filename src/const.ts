import type { ClimateCardConfig, ColorStop, Profile, ResolvedConfig } from './types';

export const CARD_TYPE = 'climate-sensor-card';
export const EDITOR_TYPE = 'climate-sensor-card-editor';
export const VERSION = '0.1.1';

/** Home Assistant color names with their default values (used as CSS fallback). */
export const HA_COLORS: Record<string, string> = {
  primary: '#03a9f4',
  accent: '#ff9800',
  red: '#f44336',
  pink: '#e91e63',
  purple: '#926bc7',
  'deep-purple': '#6e41ab',
  indigo: '#3f51b5',
  blue: '#2196f3',
  'light-blue': '#03a9f4',
  cyan: '#00bcd4',
  teal: '#009688',
  green: '#4caf50',
  'light-green': '#8bc34a',
  lime: '#cddc39',
  yellow: '#ffeb3b',
  amber: '#ffc107',
  orange: '#ff9800',
  'deep-orange': '#ff6f22',
  brown: '#795548',
  grey: '#9e9e9e',
  'blue-grey': '#607d8b',
  disabled: '#bdbdbd',
};

export interface ProfileDef {
  stops: ColorStop[];
  /** Map ranges for the comfort layout (°C / %). */
  map: { t0: number; t1: number; h0: number; h1: number; tTicks: number[]; hTicks: number[] };
  humidityWarnings: boolean;
  tempWarnLow?: number;
  tempWarnHigh?: number;
  frost?: number;
  ice?: number;
  iceHumidity?: number;
  heat?: number;
}

export const PROFILES: Record<Profile, ProfileDef> = {
  indoor: {
    stops: [
      { value: 14, color: 'blue' },
      { value: 18, color: 'light-blue' },
      { value: 20, color: 'green' },
      { value: 23, color: 'amber' },
      { value: 25, color: 'orange' },
      { value: 28, color: 'red' },
    ],
    map: { t0: 14, t1: 30, h0: 20, h1: 90, tTicks: [16, 20, 24, 28], hTicks: [30, 50, 70] },
    humidityWarnings: true,
    tempWarnLow: 16,
    tempWarnHigh: 27,
  },
  outdoor: {
    stops: [
      { value: -15, color: 'deep-purple' },
      { value: -5, color: 'indigo' },
      { value: 0, color: 'blue' },
      { value: 8, color: 'light-blue' },
      { value: 13, color: 'cyan' },
      { value: 18, color: 'green' },
      { value: 24, color: 'amber' },
      { value: 29, color: 'orange' },
      { value: 34, color: 'red' },
    ],
    map: { t0: -15, t1: 35, h0: 20, h1: 100, tTicks: [-10, 0, 10, 20, 30], hTicks: [40, 60, 80] },
    humidityWarnings: false,
    frost: 3,
    ice: 1,
    iceHumidity: 80,
    heat: 32,
  },
};

export const DEFAULTS: Omit<ResolvedConfig, 'temperature_colors' | 'entities'> = {
  layout: 'multi',
  graph_mode: 'single',
  profile: 'indoor',
  show: {
    humidity: true,
    pressure: true,
    dew_point: true,
    absolute_humidity: true,
    graph: true,
    range_selector: true,
  },
  hours: 24,
  days: 7,
  default_metric: 'temperature',
  tint_background: false,
  humidity_thresholds: { low: 30, high: 60, critical: 70 },
  comfort: { temp_min: 20, temp_max: 24, humidity_min: 40, humidity_max: 60 },
};

export function resolveConfig(config: ClimateCardConfig): ResolvedConfig {
  const profile = config.profile ?? DEFAULTS.profile;
  return {
    device: config.device,
    name: config.name,
    layout: config.layout ?? DEFAULTS.layout,
    graph_mode: config.graph_mode ?? DEFAULTS.graph_mode,
    profile,
    entities: { ...(config.entities ?? {}) },
    show: { ...DEFAULTS.show, ...(config.show ?? {}) },
    hours: clampInt(config.hours, 1, 168, DEFAULTS.hours),
    days: clampInt(config.days, 2, 31, DEFAULTS.days),
    default_metric: config.default_metric ?? DEFAULTS.default_metric,
    temperature_colors:
      config.temperature_colors === false
        ? false
        : Array.isArray(config.temperature_colors) && config.temperature_colors.length > 1
          ? [...config.temperature_colors].sort((a, b) => a.value - b.value)
          : PROFILES[profile].stops,
    tint_background: config.tint_background ?? DEFAULTS.tint_background,
    humidity_thresholds: { ...DEFAULTS.humidity_thresholds, ...(config.humidity_thresholds ?? {}) },
    comfort: { ...DEFAULTS.comfort, ...(config.comfort ?? {}) },
  };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
