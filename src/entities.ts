import type { HomeAssistant, MetricKey, ResolvedConfig } from './types';

const CLASS_TO_METRIC: Record<string, MetricKey> = {
  temperature: 'temperature',
  humidity: 'humidity',
  atmospheric_pressure: 'pressure',
  pressure: 'pressure',
};

/**
 * Finds temperature, humidity and pressure sensors of a device via device_class.
 * Diagnostic entities (e.g. the chip temperature of Zigbee sensors) are only used if nothing else exists.
 */
export function detectDeviceEntities(hass: HomeAssistant | undefined, deviceId?: string): Partial<Record<MetricKey, string>> {
  const out: Partial<Record<MetricKey, string>> = {};
  if (!hass?.entities || !deviceId) return out;
  const candidates = Object.values(hass.entities).filter(
    (e) => e.device_id === deviceId && !e.hidden && e.entity_id.startsWith('sensor.') && hass.states[e.entity_id],
  );
  for (const pass of [false, true]) {
    for (const e of candidates) {
      const isAux = !!e.entity_category;
      if (isAux !== pass) continue;
      const metric = CLASS_TO_METRIC[hass.states[e.entity_id].attributes.device_class as string];
      if (metric && !out[metric]) out[metric] = e.entity_id;
    }
  }
  return out;
}

export function resolveEntities(hass: HomeAssistant | undefined, cfg: ResolvedConfig): Partial<Record<MetricKey, string>> {
  const explicit = Object.fromEntries(Object.entries(cfg.entities).filter(([, v]) => !!v)) as Partial<Record<MetricKey, string>>;
  return { ...detectDeviceEntities(hass, cfg.device), ...explicit };
}

export function deviceName(hass: HomeAssistant | undefined, deviceId?: string): string | undefined {
  if (!hass?.devices || !deviceId) return undefined;
  const d = hass.devices[deviceId];
  return d?.name_by_user || d?.name || undefined;
}

/** Finds a device that has both a temperature and a humidity sensor (for the card picker preview). */
export function findClimateDevice(hass: HomeAssistant): string | undefined {
  if (!hass.entities) return undefined;
  const ids = new Set(Object.values(hass.entities).map((e) => e.device_id).filter((d): d is string => !!d));
  for (const id of ids) {
    const found = detectDeviceEntities(hass, id);
    if (found.temperature && found.humidity) return id;
  }
  return undefined;
}
