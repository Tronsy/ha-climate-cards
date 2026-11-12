import { DEFAULTS } from './const';
import type { ClimateCardConfig, ShowConfig } from './types';

export type FormData = Record<string, any>;

export const SHOW_KEYS: (keyof ShowConfig)[] = ['humidity', 'pressure', 'dew_point', 'absolute_humidity', 'graph', 'range_selector'];
export const MANAGED_KEYS = [
  'device',
  'name',
  'layout',
  'graph_mode',
  'profile',
  'entities',
  'show',
  'hours',
  'days',
  'default_metric',
  'temperature_colors',
  'tint_background',
  'humidity_thresholds',
  'comfort',
] as const;

/** Builds a tidy card config from the flat form data; defaults are left out. */
export function toConfig(v: FormData, old: ClimateCardConfig): ClimateCardConfig {
  const c: ClimateCardConfig = { ...old };
  for (const k of MANAGED_KEYS) delete (c as any)[k];
  if (v.device) c.device = v.device;
  if (v.name) c.name = v.name;
  c.layout = v.layout ?? DEFAULTS.layout;
  if (c.layout === 'multi' && v.graph_mode && v.graph_mode !== DEFAULTS.graph_mode) c.graph_mode = v.graph_mode;
  if (v.profile && v.profile !== DEFAULTS.profile) c.profile = v.profile;

  const entities = Object.fromEntries((['temperature', 'humidity', 'pressure'] as const).filter((k) => v[k]).map((k) => [k, v[k]]));
  if (Object.keys(entities).length) c.entities = entities;

  const show: ShowConfig = {};
  for (const k of SHOW_KEYS) {
    const val = v[`show_${k}`];
    if (typeof val === 'boolean' && val !== DEFAULTS.show[k]) show[k] = val;
  }
  if (Object.keys(show).length) c.show = show;

  if (isNum(v.hours) && v.hours !== DEFAULTS.hours) c.hours = v.hours;
  if (isNum(v.days) && v.days !== DEFAULTS.days) c.days = v.days;
  if (v.default_metric && v.default_metric !== DEFAULTS.default_metric) c.default_metric = v.default_metric;

  if (v.color_gradient === false) c.temperature_colors = false;
  else if (Array.isArray(old.temperature_colors)) c.temperature_colors = old.temperature_colors;
  if (v.tint_background) c.tint_background = true;

  const th: Record<string, number> = {};
  if (isNum(v.hum_low) && v.hum_low !== DEFAULTS.humidity_thresholds.low) th.low = v.hum_low;
  if (isNum(v.hum_high) && v.hum_high !== DEFAULTS.humidity_thresholds.high) th.high = v.hum_high;
  if (isNum(v.hum_critical) && v.hum_critical !== DEFAULTS.humidity_thresholds.critical) th.critical = v.hum_critical;
  if (Object.keys(th).length) c.humidity_thresholds = th;

  const cf: Record<string, number> = {};
  if (isNum(v.comfort_temp_min) && v.comfort_temp_min !== DEFAULTS.comfort.temp_min) cf.temp_min = v.comfort_temp_min;
  if (isNum(v.comfort_temp_max) && v.comfort_temp_max !== DEFAULTS.comfort.temp_max) cf.temp_max = v.comfort_temp_max;
  if (isNum(v.comfort_hum_min) && v.comfort_hum_min !== DEFAULTS.comfort.humidity_min) cf.humidity_min = v.comfort_hum_min;
  if (isNum(v.comfort_hum_max) && v.comfort_hum_max !== DEFAULTS.comfort.humidity_max) cf.humidity_max = v.comfort_hum_max;
  if (Object.keys(cf).length) c.comfort = cf;
  return c;
}

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

