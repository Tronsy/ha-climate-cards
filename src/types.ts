export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface HassEntityRegistryEntry {
  entity_id: string;
  device_id?: string | null;
  hidden?: boolean;
  entity_category?: string | null;
}

export interface HassDevice {
  id: string;
  name?: string | null;
  name_by_user?: string | null;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities?: Record<string, HassEntityRegistryEntry>;
  devices?: Record<string, HassDevice>;
  locale?: { language: string };
  language?: string;
  connection: {
    sendMessagePromise<T = unknown>(msg: Record<string, unknown>): Promise<T>;
  };
  formatEntityState?(stateObj: HassEntity, state?: string): string;
}

export type Layout = 'multi' | 'comfort';
export type GraphMode = 'single' | 'overlay' | 'stacked';
export type Profile = 'indoor' | 'outdoor';
export type MetricKey = 'temperature' | 'humidity' | 'pressure';
export type RangeKey = 'short' | 'long';
export type Level = 'ok' | 'warning' | 'critical';

export interface ColorStop {
  value: number;
  color: string;
}

export interface ShowConfig {
  humidity?: boolean;
  pressure?: boolean;
  dew_point?: boolean;
  absolute_humidity?: boolean;
  graph?: boolean;
  range_selector?: boolean;
}

export interface ClimateCardConfig {
  type: string;
  device?: string;
  name?: string;
  layout?: Layout;
  graph_mode?: GraphMode;
  profile?: Profile;
  entities?: Partial<Record<MetricKey, string>>;
  show?: ShowConfig;
  hours?: number;
  days?: number;
  default_metric?: MetricKey;
  temperature_colors?: ColorStop[] | false;
  tint_background?: boolean;
  humidity_thresholds?: { low?: number; high?: number; critical?: number };
  comfort?: { temp_min?: number; temp_max?: number; humidity_min?: number; humidity_max?: number };
}

/** Config with every default filled in. */
export interface ResolvedConfig {
  device?: string;
  name?: string;
  layout: Layout;
  graph_mode: GraphMode;
  profile: Profile;
  entities: Partial<Record<MetricKey, string>>;
  show: Required<ShowConfig>;
  hours: number;
  days: number;
  default_metric: MetricKey;
  temperature_colors: ColorStop[] | false;
  tint_background: boolean;
  humidity_thresholds: { low: number; high: number; critical: number };
  comfort: { temp_min: number; temp_max: number; humidity_min: number; humidity_max: number };
}
