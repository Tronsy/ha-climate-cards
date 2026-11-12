/* Demo harness: fake Home Assistant objects so the card can be developed without a HA instance. */
import '../src/climate-sensor-card';
import type { ClimateCardConfig, HassEntity, HomeAssistant } from '../src/types';

/* ---- Platzhalter für HA-Elemente ---- */
const MDI: Record<string, string> = {
  'mdi:thermometer': 'M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z',
  'mdi:water-percent':
    'M12,3.25C12,3.25 6,10 6,14C6,17.32 8.69,20 12,20A6,6 0 0,0 18,14C18,10 12,3.25 12,3.25M14.47,9.97L15.53,11.03L9.53,17.03L8.47,15.97M9.75,10A1.25,1.25 0 0,1 11,11.25A1.25,1.25 0 0,1 9.75,12.5A1.25,1.25 0 0,1 8.5,11.25A1.25,1.25 0 0,1 9.75,10M14.25,14.5A1.25,1.25 0 0,1 15.5,15.75A1.25,1.25 0 0,1 14.25,17A1.25,1.25 0 0,1 13,15.75A1.25,1.25 0 0,1 14.25,14.5Z',
  'mdi:gauge':
    'M12,16A3,3 0 0,1 9,13C9,11.88 9.61,10.9 10.5,10.39L20.21,4.77L14.68,14.35C14.18,15.33 13.17,16 12,16M12,3C13.81,3 15.5,3.5 16.97,4.32L14.87,5.53C14,5.19 13,5 12,5A8,8 0 0,0 4,13C4,15.21 4.89,17.21 6.34,18.65H6.35C6.74,19.04 6.74,19.67 6.35,20.06C5.96,20.45 5.32,20.45 4.93,20.07V20.07C3.12,18.26 2,15.76 2,13A10,10 0 0,1 12,3Z',
  'mdi:alert': 'M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z',
  'mdi:trending-up': 'M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z',
  'mdi:trending-down': 'M16,18L18.29,15.71L13.41,10.83L9.41,14.83L2,7.41L3.41,6L9.41,12L13.41,8L19.71,14.29L22,12V18H16Z',
  'mdi:trending-neutral': 'M22,12L18,8V11H3V13H18V16L22,12Z',
  'mdi:water': 'M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z',
};
MDI['mdi:water-thermometer'] = MDI['mdi:water'];

class MockHaIcon extends HTMLElement {
  private _icon = '';
  set icon(v: string) {
    this._icon = v;
    this.render();
  }
  connectedCallback() {
    this.render();
  }
  private render() {
    const s = 'var(--mdc-icon-size, 24px)';
    this.style.cssText = `display:inline-flex;width:${s};height:${s}`;
    this.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="${MDI[this._icon] ?? ''}"/></svg>`;
  }
}
class MockHaCard extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{display:block;background:var(--ha-card-background);border:1px solid var(--divider-color);border-radius:12px;color:var(--primary-text-color)}</style><slot></slot>`;
  }
}
customElements.define('ha-icon', MockHaIcon);
customElements.define('ha-card', MockHaCard);

/* ---- Simulierte Sensoren ---- */
interface Sim {
  base: number;
  amp: number;
  noise: number;
  invert?: boolean;
  drift?: number;
  unit: string;
  device_class: string;
}
const SIM: Record<string, Sim> = {
  'sensor.wohnzimmer_temperatur': { base: 21.2, amp: 1.2, noise: 0.15, unit: '°C', device_class: 'temperature' },
  'sensor.wohnzimmer_luftfeuchtigkeit': { base: 50, amp: 5, noise: 1.2, invert: true, unit: '%', device_class: 'humidity' },
  'sensor.wohnzimmer_luftdruck': { base: 1014, amp: 0.6, noise: 0.1, drift: -4, unit: 'hPa', device_class: 'atmospheric_pressure' },
  'sensor.wohnzimmer_device_temperature': { base: 27, amp: 0.5, noise: 0.1, unit: '°C', device_class: 'temperature' },
  'sensor.bad_temperatur': { base: 23.1, amp: 1, noise: 0.2, unit: '°C', device_class: 'temperature' },
  'sensor.bad_luftfeuchtigkeit': { base: 66, amp: 8, noise: 2, unit: '%', device_class: 'humidity' },
  'sensor.balkon_temperatur': { base: 4, amp: 4.5, noise: 0.3, unit: '°C', device_class: 'temperature' },
  'sensor.balkon_luftfeuchtigkeit': { base: 84, amp: 10, noise: 2, invert: true, unit: '%', device_class: 'humidity' },
  'sensor.balkon_luftdruck': { base: 1012, amp: 0.6, noise: 0.1, drift: -4, unit: 'hPa', device_class: 'atmospheric_pressure' },
};
const DEVICE_OF: Record<string, string> = {
  'sensor.wohnzimmer_temperatur': 'dev_wz',
  'sensor.wohnzimmer_luftfeuchtigkeit': 'dev_wz',
  'sensor.wohnzimmer_luftdruck': 'dev_wz',
  'sensor.wohnzimmer_device_temperature': 'dev_wz',
  'sensor.bad_temperatur': 'dev_bad',
  'sensor.bad_luftfeuchtigkeit': 'dev_bad',
  'sensor.balkon_temperatur': 'dev_balkon',
  'sensor.balkon_luftfeuchtigkeit': 'dev_balkon',
  'sensor.balkon_luftdruck': 'dev_balkon',
};

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}
function simValue(id: string, t: number): number {
  const p = SIM[id];
  const hour = (t / 3600e3) % 24;
  const day = Math.sin((2 * Math.PI * (hour - 11)) / 24) * (p.invert ? -1 : 1);
  const slow = Math.sin(t / (3.1 * 86400e3) + hash(id)) * p.amp * 0.6;
  const noise = Math.sin(t / 1.7e6 + hash(id)) * p.noise + Math.sin(t / 4.3e5) * p.noise * 0.5;
  const drift = p.drift ? (p.drift * ((t % (86400e3 * 2)) / 86400e3)) / 2 : 0;
  const v = p.base + p.amp * day + slow + noise + drift;
  return p.unit === '%' ? Math.max(5, Math.min(99, v)) : v;
}
const round = (id: string, v: number) => (SIM[id].unit === '%' ? Math.round(v) : Math.round(v * 10) / 10);

const now = Date.now();
const states: Record<string, HassEntity> = {};
for (const id of Object.keys(SIM)) {
  const p = SIM[id];
  states[id] = {
    entity_id: id,
    state: String(round(id, simValue(id, now))),
    attributes: {
      unit_of_measurement: p.unit,
      device_class: p.device_class,
      state_class: 'measurement',
      friendly_name: id.replace('sensor.', '').replace(/_/g, ' '),
    },
    last_changed: new Date(now).toISOString(),
    last_updated: new Date(now).toISOString(),
  };
}

const hass: HomeAssistant = {
  states,
  entities: Object.fromEntries(
    Object.keys(SIM).map((id) => [
      id,
      { entity_id: id, device_id: DEVICE_OF[id], entity_category: id.includes('device_temperature') ? 'diagnostic' : null },
    ]),
  ),
  devices: {
    dev_wz: { id: 'dev_wz', name: 'Klimasensor Wohnzimmer', name_by_user: 'Wohnzimmer' },
    dev_bad: { id: 'dev_bad', name: 'Klimasensor Bad', name_by_user: 'Bad' },
    dev_balkon: { id: 'dev_balkon', name: 'Wetterstation', name_by_user: 'Balkon' },
  },
  locale: { language: 'de' },
  formatEntityState(stateObj, state) {
    const v = Number(state ?? stateObj.state);
    const unit = stateObj.attributes.unit_of_measurement;
    if (!Number.isFinite(v)) return 'Nicht verfügbar';
    const dec = unit === '°C' ? 1 : 0;
    return `${v.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec })} ${unit}`;
  },
  connection: {
    async sendMessagePromise<T>(msg: Record<string, any>): Promise<T> {
      await new Promise((r) => setTimeout(r, 250));
      const start = Date.parse(msg.start_time);
      const end = Date.parse(msg.end_time);
      const out: Record<string, unknown[]> = {};
      if (msg.type === 'history/history_during_period') {
        for (const id of msg.entity_ids as string[]) {
          const pts = [];
          for (let t = start; t <= end; t += 5 * 60e3) pts.push({ s: String(round(id, simValue(id, t))), lu: t / 1000 });
          out[id] = pts;
        }
      } else if (msg.type === 'recorder/statistics_during_period') {
        for (const id of msg.statistic_ids as string[]) {
          const pts = [];
          for (let t = Math.ceil(start / 3600e3) * 3600e3; t < end - 3600e3; t += 3600e3) pts.push({ start: t, mean: simValue(id, t + 1800e3) });
          out[id] = pts;
        }
      }
      return out as T;
    },
  },
};

/* ---- Karten ---- */
const CARDS: { title: string; config: Omit<ClimateCardConfig, 'type'>; half?: boolean; masonry?: boolean }[] = [
  { title: 'C · layout: multi, graph_mode: single', config: { device: 'dev_wz' } },
  { title: 'C1 · graph_mode: overlay', config: { device: 'dev_wz', graph_mode: 'overlay' } },
  { title: 'C2 · graph_mode: stacked', config: { device: 'dev_wz', graph_mode: 'stacked' } },
  { title: 'D · layout: comfort (innen)', config: { device: 'dev_wz', layout: 'comfort' } },
  { title: 'D · Bad mit hoher Luftfeuchte, ohne Luftdruck', config: { device: 'dev_bad', layout: 'comfort', tint_background: true } },
  { title: 'D · profile: outdoor', config: { device: 'dev_balkon', layout: 'comfort', profile: 'outdoor' } },
  { title: 'C · profile: outdoor', config: { device: 'dev_balkon', profile: 'outdoor' } },
  { title: 'C1 · halbe Breite (6 Spalten)', config: { device: 'dev_wz', graph_mode: 'overlay' }, half: true },
  { title: 'C2 · Masonry (Höhe automatisch)', config: { device: 'dev_bad', graph_mode: 'stacked' }, masonry: true },
];

const grid = document.getElementById('grid')!;
for (const c of CARDS) {
  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.innerHTML = `<h2>${c.title}</h2>`;
  const card = document.createElement('climate-sensor-card') as any;
  card.setConfig({ type: 'custom:climate-sensor-card', ...c.config });
  card.hass = hass;
  const wrap = document.createElement('div');
  if (!c.masonry) {
    const rows = card.getGridOptions().rows as number;
    wrap.style.height = `${rows * 56 + (rows - 1) * 8}px`;
  }
  if (c.half) wrap.className = 'half';
  wrap.appendChild(card);
  slot.appendChild(wrap);
  grid.appendChild(slot);
}

document.getElementById('theme')!.addEventListener('click', () => document.documentElement.classList.toggle('dark'));
if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
