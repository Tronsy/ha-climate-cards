import { LitElement, html, svg, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { CARD_TYPE, EDITOR_TYPE, PROFILES, VERSION, resolveConfig } from './const';
import {
  absoluteHumidity,
  colorOnScale,
  comfortState,
  cssColor,
  dewPoint,
  fromCelsius,
  humidityState,
  pressureTrend,
  temperatureWarning,
  toCelsius,
  toHpa,
} from './climate';
import { fetchHistory, fetchStatistics, makeGrid, resample, valueAt, type Point } from './history';
import { computeScale, renderGraph, yOf, type Scale } from './graph';
import { language, localize } from './localize';
import { deviceName, findClimateDevice, resolveEntities } from './entities';
import { cardStyles } from './styles';
import type { ClimateCardConfig, HassEntity, HomeAssistant, Level, MetricKey, RangeKey, ResolvedConfig } from './types';
import './editor';

interface RangeData {
  times: number[];
  series: Partial<Record<MetricKey, (number | null)[]>>;
  raw: Partial<Record<MetricKey, Point[]>>;
  error?: boolean;
}

interface Metric {
  key: MetricKey;
  entityId: string;
  stateObj: HassEntity;
  value: number | null;
  unit?: string;
  label: string;
  icon: string;
  color: string;
  level: Level;
  current: string;
  fmt: (v: number) => string;
  colorAt: (v: number) => string;
  gradient: boolean;
}

interface Model {
  name: string;
  metrics: Metric[];
  byKey: Partial<Record<MetricKey, Metric>>;
  tC: number | null;
  rh: number | null;
  humidityEntity?: string;
  missing?: string;
}

const ICONS: Record<MetricKey, string> = {
  temperature: 'mdi:thermometer',
  humidity: 'mdi:water-percent',
  pressure: 'mdi:gauge',
};
const DASH: Record<MetricKey, string> = { temperature: '', humidity: '6 4', pressure: '1.5 3.5' };
const SWATCH_DASH: Record<MetricKey, string> = { temperature: '', humidity: '4 2.5', pressure: '1 2.6' };
const TREND_ICON = { rising: 'mdi:trending-up', falling: 'mdi:trending-down', steady: 'mdi:trending-neutral' };
const REFRESH: Record<RangeKey, number> = { short: 5 * 60e3, long: 30 * 60e3 };

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class ClimateSensorCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _cfg?: ResolvedConfig;
  @state() private _selected: MetricKey = 'temperature';
  @state() private _range: RangeKey = 'short';
  @state() private _hover: number | null = null;
  @state() private _data: Partial<Record<RangeKey, RangeData>> = {};

  private _fetchedAt: Record<RangeKey, number> = { short: 0, long: 0 };
  private _loading: Record<RangeKey, boolean> = { short: false, long: false };
  private _token = 0;
  private _ents: Partial<Record<MetricKey, string>> = {};
  private _uid = Math.random().toString(36).slice(2, 8);

  /* ---------- Lovelace API ---------- */

  public static getConfigElement(): HTMLElement {
    return document.createElement(EDITOR_TYPE);
  }

  public static getStubConfig(hass: HomeAssistant): ClimateCardConfig {
    const device = findClimateDevice(hass);
    if (device) return { type: `custom:${CARD_TYPE}`, device };
    const temp = Object.values(hass.states).find((s) => s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'temperature');
    return { type: `custom:${CARD_TYPE}`, entities: { temperature: temp?.entity_id ?? '' } };
  }

  public setConfig(config: ClimateCardConfig): void {
    if (!config) throw new Error('Invalid configuration');
    if (!config.device && !config.entities?.temperature) {
      throw new Error('Bitte "device" oder "entities.temperature" angeben / set "device" or "entities.temperature"');
    }
    this._cfg = resolveConfig(config);
    this._selected = this._cfg.default_metric;
    this._data = {};
    this._fetchedAt = { short: 0, long: 0 };
    this._hover = null;
    this._token++;
  }

  /** Rows in the sections grid (56 px per row, 8 px gap), depending on what is visible. */
  private _rows(): { rows: number; min: number } {
    const c = this._cfg;
    if (!c) return { rows: 5, min: 4 };
    if (c.layout === 'comfort') return { rows: 4, min: 3 };
    const n = 1 + (c.show.humidity ? 1 : 0) + (c.show.pressure ? 1 : 0);
    if (c.graph_mode === 'stacked') {
      if (!c.show.graph) return n >= 3 ? { rows: 3, min: 3 } : { rows: 2, min: 2 };
      const rows = n >= 3 ? 6 : n === 2 ? 4 : 3;
      return { rows, min: rows - 1 };
    }
    return c.show.graph ? { rows: 5, min: 4 } : { rows: 2, min: 2 };
  }

  public getCardSize(): number {
    // Masonry rechnet in Einheiten von ca. 50 px
    return Math.ceil((this._rows().rows * 64 - 8) / 50);
  }

  public getGridOptions() {
    const { rows, min } = this._rows();
    return { columns: 12, rows, min_columns: 6, min_rows: min };
  }

  /* ---------- Lifecycle ---------- */

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size === 1 && changed.has('hass')) {
      const old = changed.get('hass') as HomeAssistant | undefined;
      if (old && Object.keys(this._ents).length) {
        return (
          Object.values(this._ents).some((id) => id && old.states[id] !== this.hass.states[id]) ||
          old.locale !== this.hass.locale ||
          old.entities !== this.hass.entities
        );
      }
    }
    return true;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('hass') || changed.has('_cfg') || changed.has('_range')) this._maybeFetch();
  }

  private _maybeFetch(): void {
    const c = this._cfg;
    if (!c || !this.hass) return;
    const needed: RangeKey[] = ['short'];
    if (c.layout === 'multi' && this._range === 'long' && c.show.graph) needed.push('long');
    for (const r of needed) {
      if (!this._loading[r] && Date.now() - this._fetchedAt[r] > REFRESH[r]) void this._fetch(r);
    }
  }

  private async _fetch(range: RangeKey): Promise<void> {
    const c = this._cfg!;
    const ents = resolveEntities(this.hass, c);
    const keys = (['temperature', 'humidity', 'pressure'] as MetricKey[]).filter((k) => ents[k] && this.hass.states[ents[k]!]);
    if (!keys.length) return;
    const ids = keys.map((k) => ents[k]!);
    const token = this._token;
    this._loading[range] = true;
    this._fetchedAt[range] = Date.now();
    try {
      const end = Date.now();
      const raw: Partial<Record<MetricKey, Point[]>> = {};
      let times: number[];
      if (range === 'short') {
        const start = end - Math.max(c.hours, 3) * 3600e3;
        const res = await fetchHistory(this.hass, ids, new Date(start), new Date(end));
        keys.forEach((k) => (raw[k] = res[ents[k]!] ?? []));
        times = makeGrid(end - c.hours * 3600e3, end, Math.min(c.hours * 4, 192) + 1);
      } else {
        const start = end - c.days * 86400e3;
        const stats = await fetchStatistics(this.hass, ids, new Date(start), new Date(end)).catch(() => ({}) as Record<string, Point[]>);
        const missing = ids.filter((id) => (stats[id]?.length ?? 0) < 2);
        const hist = missing.length ? await fetchHistory(this.hass, missing, new Date(start), new Date(end)) : {};
        keys.forEach((k) => {
          const id = ents[k]!;
          raw[k] = (stats[id]?.length ?? 0) >= 2 ? stats[id] : (hist[id] ?? []);
        });
        times = makeGrid(start, end, c.days * 24 + 1);
      }
      const series: RangeData['series'] = {};
      keys.forEach((k) => (series[k] = resample(raw[k] ?? [], times)));
      if (token === this._token) this._data = { ...this._data, [range]: { times, series, raw } };
    } catch (err) {
      console.warn(`[${CARD_TYPE}] history`, err);
      if (token === this._token) this._data = { ...this._data, [range]: { times: [], series: {}, raw: {}, error: true } };
    } finally {
      this._loading[range] = false;
    }
  }

  /* ---------- Modell ---------- */

  private _t(key: string, n?: string | number) {
    return localize(this.hass, key, n);
  }

  private _formatter(stateObj: HassEntity, decimals: number) {
    const unit = stateObj.attributes.unit_of_measurement as string | undefined;
    const nf = new Intl.NumberFormat(language(this.hass), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return (v: number) => {
      const s = v.toFixed(decimals);
      if (this.hass.formatEntityState) return this.hass.formatEntityState(stateObj, s);
      return unit ? `${nf.format(Number(s))} ${unit}` : nf.format(Number(s));
    };
  }

  private _buildModel(): Model | null {
    const c = this._cfg!;
    const ents = resolveEntities(this.hass, c);
    this._ents = ents;
    if (!ents.temperature) return null;
    const tState = this.hass.states[ents.temperature];
    const name = c.name || deviceName(this.hass, c.device) || (tState?.attributes.friendly_name as string) || ents.temperature;
    if (!tState) return { name, metrics: [], byKey: {}, tC: null, rh: null, missing: ents.temperature };

    const hState = ents.humidity ? this.hass.states[ents.humidity] : undefined;
    const rh = hState ? num(hState.state) : null;
    const tUnit = tState.attributes.unit_of_measurement as string | undefined;
    const tVal = num(tState.state);
    const tC = tVal !== null ? toCelsius(tVal, tUnit) : null;
    const stops = c.temperature_colors;
    const disabled = 'var(--disabled-color, #bdbdbd)';

    const keys: MetricKey[] = ['temperature'];
    if (c.show.humidity) keys.push('humidity');
    if (c.show.pressure) keys.push('pressure');

    const metrics: Metric[] = [];
    for (const key of keys) {
      const id = ents[key];
      const st = id ? this.hass.states[id] : undefined;
      if (!id || !st) continue;
      const unit = st.attributes.unit_of_measurement as string | undefined;
      const value = num(st.state);
      const base = {
        key,
        entityId: id,
        stateObj: st,
        value,
        unit,
        label: this._t(key),
        icon: ICONS[key],
        current: this.hass.formatEntityState ? this.hass.formatEntityState(st) : `${st.state} ${unit ?? ''}`.trim(),
      };
      if (key === 'temperature') {
        const warn = tC !== null ? temperatureWarning(tC, rh, c) : null;
        const color = tC === null ? disabled : stops ? colorOnScale(stops, tC) : 'var(--state-icon-color)';
        metrics.push({
          ...base,
          color,
          level: warn?.level ?? 'ok',
          fmt: this._formatter(st, 1),
          colorAt: stops ? (v) => colorOnScale(stops, toCelsius(v, unit)) : () => color,
          gradient: !!stops,
        });
      } else if (key === 'humidity') {
        const a = value !== null ? humidityState(value, c) : null;
        const color = a?.color ?? disabled;
        metrics.push({ ...base, color, level: a?.level ?? 'ok', fmt: this._formatter(st, 0), colorAt: () => color, gradient: false });
      } else {
        const u = (unit ?? '').toLowerCase();
        const decimals = u === 'inhg' ? 2 : u === 'kpa' ? 1 : 0;
        const color = value === null ? disabled : cssColor('indigo');
        metrics.push({ ...base, color, level: 'ok', fmt: this._formatter(st, decimals), colorAt: () => color, gradient: false });
      }
    }
    const byKey: Model['byKey'] = {};
    metrics.forEach((m) => (byKey[m.key] = m));
    return { name, metrics, byKey, tC, rh, humidityEntity: ents.humidity };
  }

  private _series(m: Metric, range: RangeKey = this._range): (number | null)[] | undefined {
    const s = this._data[range]?.series[m.key];
    if (!s?.length) return undefined;
    const copy = s.slice();
    if (m.value !== null) copy[copy.length - 1] = m.value;
    return copy;
  }

  /* ---------- Render ---------- */

  protected render(): TemplateResult | typeof nothing {
    const c = this._cfg;
    if (!c || !this.hass) return nothing;
    const m = this._buildModel();
    if (!m) return html`<ha-card><div class="msg">${this._t('no_entity')}</div></ha-card>`;
    if (m.missing) return html`<ha-card><div class="msg">${this._t('entity_missing', m.missing)}</div></ha-card>`;
    const tint = c.tint_background ? m.byKey.temperature?.color : undefined;
    return html`<ha-card class=${tint ? 'tinted' : ''} style=${tint ? `--tint:${tint}` : ''}>
      ${c.layout === 'comfort' ? this._renderComfort(m) : this._renderMulti(m)}
    </ha-card>`;
  }

  private _header(m: Model, right: TemplateResult | typeof nothing): TemplateResult {
    return html`<div class="header">
      <button class="name" @click=${() => this._moreInfo(m.byKey.temperature!.entityId)}>${m.name}</button>
      <div class="header-r">${right}</div>
    </div>`;
  }

  private _rangeSwitch(): TemplateResult | typeof nothing {
    const c = this._cfg!;
    if (!c.show.range_selector || !c.show.graph) return nothing;
    return html`<div class="range" role="group" aria-label=${this._t('range_label')}>
      <button aria-pressed=${String(this._range === 'short')} @click=${() => this._setRange('short')}>${this._t('range_short', c.hours)}</button>
      <button aria-pressed=${String(this._range === 'long')} @click=${() => this._setRange('long')}>${this._t('range_long', c.days)}</button>
    </div>`;
  }

  private _valueText(m: Metric, s?: (number | null)[]): string {
    if (this._hover === null || !s) return m.current;
    const v = s[this._hover];
    return v === null || v === undefined ? '—' : m.fmt(v);
  }

  /* C, C1, C2 */
  private _renderMulti(m: Model): TemplateResult {
    const c = this._cfg!;
    const data = this._data[this._range];
    const time =
      c.show.graph && data?.times.length
        ? html`<span class="time">${this._hover !== null ? this._fmtTime(data.times[this._hover]) : this._t('now')}</span>`
        : nothing;
    const head = this._header(m, html`${time}${this._rangeSwitch()}`);
    if (c.graph_mode === 'stacked') return html`${head}${this._renderStacked(m, data)}${this._xAxis(data)}`;

    const sel: MetricKey = m.byKey[this._selected] ? this._selected : 'temperature';
    const overlay = c.graph_mode === 'overlay';
    const graph = c.show.graph;
    const segs = m.metrics.map((mt) => {
      const warn = mt.level !== 'ok';
      const icon =
        overlay && graph
          ? html`<svg class="swatch" viewBox="0 0 16 6" aria-hidden="true">
              <line x1="1" x2="15" y1="3" y2="3" stroke-width="2.4" stroke-linecap="round" stroke-dasharray=${SWATCH_DASH[mt.key] || nothing} style=${`stroke:${mt.color}`}></line>
            </svg>`
          : html`<ha-icon .icon=${warn ? 'mdi:alert' : mt.icon}></ha-icon>`;
      // Ohne Verlauf gibt es nichts auszuwählen: Antippen öffnet die Details des Sensors.
      return html`<button
        class="seg"
        style=${`--c:${mt.color}`}
        aria-pressed=${graph ? String(mt.key === sel) : nothing}
        @click=${() => (graph ? (this._selected = mt.key) : this._moreInfo(mt.entityId))}
      >
        <span class="seg-label" title=${mt.label}>${icon}<span class="txt">${mt.label}</span></span>
        <span class="seg-value ${warn ? 'warn' : ''}">${this._valueText(mt, this._series(mt))}</span>
      </button>`;
    });
    return html`${head}
      <div class="segs" style=${`--n:${m.metrics.length}`}>${segs}</div>
      ${c.show.graph ? (overlay ? this._renderOverlay(m, sel, data) : this._renderSingle(m, sel, data)) : nothing}
      ${this._xAxis(data)}`;
  }

  private _placeholder(data?: RangeData): TemplateResult {
    return html`<div class="g placeholder">${data?.error || data ? this._t('no_history') : this._t('loading')}</div>`;
  }

  private _humidityBands(mt: Metric): number[] {
    const c = this._cfg!;
    return mt.key === 'humidity' && c.profile === 'indoor' ? [c.comfort.humidity_min, c.comfort.humidity_max] : [];
  }

  private _pointerHandlers() {
    return {
      move: (ev: PointerEvent) => this._onPointer(ev),
      leave: () => (this._hover = null),
    };
  }

  private _renderSingle(m: Model, sel: MetricKey, data?: RangeData): TemplateResult {
    const mt = m.byKey[sel]!;
    const s = this._series(mt);
    const bands = this._humidityBands(mt);
    const scale = s ? computeScale(s, { top: 24, ...(bands.length ? { lo: bands[0] - 2, hi: bands[1] + 2 } : {}) }) : null;
    const p = this._pointerHandlers();
    if (!s || !scale) return html`<div class="graph">${this._placeholder(data)}</div>`;
    const nums = s.filter((v): v is number => v !== null);
    return html`<div class="graph" @pointermove=${p.move} @pointerdown=${p.move} @pointerleave=${p.leave} @pointercancel=${p.leave}>
      <div class="g">
        ${renderGraph({ values: s, scale, id: `${this._uid}-s`, color: mt.color, colorAt: mt.colorAt, gradient: mt.gradient, fill: 0.14, bands })}
        ${this._cursor(s.length, [{ s, scale, mt }])}
        <div class="minmax"><span>${this._t('max')} ${mt.fmt(Math.max(...nums))}</span><span>${this._t('min')} ${mt.fmt(Math.min(...nums))}</span></div>
      </div>
    </div>`;
  }

  private _renderOverlay(m: Model, sel: MetricKey, data?: RangeData): TemplateResult {
    const layers = m.metrics
      .filter((mt) => mt.key !== sel)
      .concat(m.metrics.filter((mt) => mt.key === sel))
      .map((mt) => {
        const s = this._series(mt);
        const focus = mt.key === sel;
        const bands = focus ? this._humidityBands(mt) : [];
        const scale = s ? computeScale(s, { top: 10, ...(bands.length ? { lo: bands[0] - 2, hi: bands[1] + 2 } : {}) }) : null;
        return { mt, s, scale, focus, bands };
      })
      .filter((l): l is typeof l & { s: (number | null)[]; scale: Scale } => !!l.s && !!l.scale);
    const p = this._pointerHandlers();
    if (!layers.length) return html`<div class="graph overlay">${this._placeholder(data)}</div>`;
    return html`<div class="graph overlay" @pointermove=${p.move} @pointerdown=${p.move} @pointerleave=${p.leave} @pointercancel=${p.leave}>
      <div class="g">
        ${layers.map((l) =>
          renderGraph({
            values: l.s,
            scale: l.scale,
            id: `${this._uid}-o-${l.mt.key}`,
            color: l.mt.color,
            colorAt: l.mt.colorAt,
            gradient: l.mt.gradient,
            fill: l.focus ? 0.13 : 0,
            strokeWidth: l.focus ? 2.4 : 1.5,
            dash: DASH[l.mt.key],
            opacity: l.focus ? 1 : 0.7,
            bands: l.bands,
          }),
        )}
        ${this._cursor(layers[0].s.length, layers)}
      </div>
    </div>`;
  }

  private _renderStacked(m: Model, data?: RangeData): TemplateResult {
    const c = this._cfg!;
    const p = this._pointerHandlers();
    const nf = (d: number) => new Intl.NumberFormat(language(this.hass), { maximumFractionDigits: d, minimumFractionDigits: d });
    const blocks = m.metrics.map((mt) => {
      const s = c.show.graph ? this._series(mt) : undefined;
      const scale = s ? computeScale(s, { top: 8, bottom: 4 }) : null;
      const nums = s?.filter((v): v is number => v !== null) ?? [];
      const decimals = mt.key === 'temperature' ? 1 : 0;
      const range = nums.length ? `${nf(decimals).format(Math.min(...nums))}–${mt.fmt(Math.max(...nums))}` : '';
      const warn = mt.level !== 'ok';
      return html`<div class="block">
        <div class="block-head" style=${`--c:${mt.color}`}>
          <ha-icon .icon=${warn ? 'mdi:alert' : mt.icon}></ha-icon>
          <span class="block-label">${mt.label}</span>
          <span class="block-range">${range}</span>
          <span class="block-value ${warn ? 'warn' : ''}">${this._valueText(mt, s)}</span>
        </div>
        ${c.show.graph
          ? s && scale
            ? html`<div class="g">
                ${renderGraph({ values: s, scale, id: `${this._uid}-k-${mt.key}`, color: mt.color, colorAt: mt.colorAt, gradient: mt.gradient, fill: 0.14 })}
                ${this._cursor(s.length, [{ s, scale, mt }])}
              </div>`
            : this._placeholder(data)
          : nothing}
      </div>`;
    });
    return html`<div class="stack ${c.show.graph ? '' : 'no-graph'}" @pointermove=${p.move} @pointerdown=${p.move} @pointerleave=${p.leave} @pointercancel=${p.leave}>${blocks}</div>`;
  }

  private _cursor(n: number, layers: { s: (number | null)[]; scale: Scale; mt: Metric }[]): TemplateResult | typeof nothing {
    const i = this._hover;
    if (i === null || n < 2 || i >= n) return nothing;
    const x = (i / (n - 1)) * 100;
    return html`<div class="cursor" style=${`left:${x}%`}></div>
      ${layers.map((l) => {
        const v = l.s[i];
        return v === null || v === undefined
          ? nothing
          : html`<div class="dot" style=${`left:${x}%;top:${yOf(l.scale, v)}%;background:${l.mt.colorAt(v)}`}></div>`;
      })}`;
  }

  private _xAxis(data?: RangeData): TemplateResult | typeof nothing {
    if (!this._cfg!.show.graph || !data?.times.length) return nothing;
    const t = data.times;
    return html`<div class="xaxis">
      <span>${this._fmtAxis(t[0])}</span><span>${this._fmtAxis(t[Math.floor((t.length - 1) / 2)])}</span><span>${this._t('now')}</span>
    </div>`;
  }

  /* D */
  private _renderComfort(m: Model): TemplateResult {
    const c = this._cfg!;
    const tM = m.byKey.temperature!;
    const { tC, rh } = m;
    const cf = tC !== null ? comfortState(tC, rh, c) : null;
    const label = cf ? capitalize(cf.keys.map((k) => this._t(k)).join(' & ')) : '';
    const pill = cf && label ? html`<span class="pill" style=${`--c:${cf.color}`}>${label}</span>` : nothing;

    const rows: TemplateResult[] = [];
    const row = (entityId: string, color: string, icon: string, k: string, v: string, warn = false) =>
      html`<button class="row" style=${`--c:${color}`} @click=${() => this._moreInfo(entityId)}>
        <ha-icon .icon=${icon}></ha-icon><span class="k">${k}</span><span class="v ${warn ? 'warn' : ''}">${v}</span>
      </button>`;
    rows.push(row(tM.entityId, tM.color, tM.level !== 'ok' ? 'mdi:alert' : tM.icon, tM.label, tM.current, tM.level !== 'ok'));
    const hM = m.byKey.humidity;
    if (hM) rows.push(row(hM.entityId, hM.color, hM.level !== 'ok' ? 'mdi:alert' : hM.icon, hM.label, hM.current, hM.level !== 'ok'));
    if (tC !== null && rh !== null && m.humidityEntity) {
      if (c.show.dew_point) {
        const dew = fromCelsius(dewPoint(tC, rh), tM.unit);
        rows.push(row(m.humidityEntity, cssColor('light-blue'), 'mdi:water-thermometer', this._t('dew_point'), tM.fmt(dew)));
      }
      if (c.show.absolute_humidity) {
        const ah = new Intl.NumberFormat(language(this.hass), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(absoluteHumidity(tC, rh));
        rows.push(row(m.humidityEntity, cssColor('light-blue'), 'mdi:water', this._t('absolute_humidity'), `${ah} g/m³`));
      }
    }
    const pM = m.byKey.pressure;
    if (pM) {
      const raw = this._data.short?.raw.pressure;
      const then = valueAt(raw, Date.now() - 3 * 3600e3);
      const trend = pM.value !== null && then !== null ? pressureTrend(toHpa(pM.value, pM.unit) - toHpa(then, pM.unit)) : null;
      rows.push(row(pM.entityId, pM.color, trend ? TREND_ICON[trend] : pM.icon, trend ? `${pM.label} · ${this._t(`trend_${trend}`)}` : pM.label, pM.current));
    }

    const map = tC !== null && rh !== null ? this._comfortMap(m, tC, rh, cf?.keys.join(' ') ?? '') : nothing;
    return html`${this._header(m, pill)}
      <div class="comfort ${map === nothing ? 'no-map' : ''}">${map !== nothing ? html`<div class="map">${map}</div>` : nothing}<div class="list">${rows}</div></div>`;
  }

  private _comfortMap(m: Model, tC: number, rh: number, label: string): TemplateResult {
    const c = this._cfg!;
    const p = PROFILES[c.profile].map;
    const W = 170;
    const H = 126;
    const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const x = (t: number) => 24 + ((cl(t, p.t0, p.t1) - p.t0) / (p.t1 - p.t0)) * (W - 30);
    const y = (h: number) => H - 18 - ((cl(h, p.h0, p.h1) - p.h0) / (p.h1 - p.h0)) * (H - 26);
    const rect = (t0: number, t1: number, h0: number, h1: number, color: string, opacity: number, stroke: boolean, rx: number) =>
      svg`<rect x=${x(t0)} y=${y(h1)} width=${Math.max(0, x(t1) - x(t0))} height=${Math.max(0, y(h0) - y(h1))} rx=${rx}
        style=${`fill:${color};fill-opacity:${opacity};${stroke ? `stroke:${color};stroke-opacity:.55` : ''}`}></rect>`;

    let zones;
    if (c.profile === 'outdoor') {
      const ice = PROFILES.outdoor;
      const top = (ice.frost ?? 3) as number;
      zones = svg`${rect(-5, top, ice.iceHumidity ?? 80, 100, cssColor('light-blue'), 0.18, true, 4)}
        <text class="axis" x=${(x(-5) + x(top)) / 2} y=${y(ice.iceHumidity ?? 80) + 10} text-anchor="middle">${this._t('ice_zone')}</text>`;
    } else {
      const k = c.comfort;
      const green = cssColor('green');
      zones = svg`${rect(k.temp_min - 2, k.temp_max + 2, k.humidity_min - 10, k.humidity_max + 10, green, 0.09, false, 6)}
        ${rect(k.temp_min, k.temp_max, k.humidity_min, k.humidity_max, green, 0.2, true, 4)}`;
    }

    const tM = m.byKey.temperature!;
    const T = this._data.short?.series.temperature;
    const Hs = this._data.short?.series.humidity;
    let trail = '';
    if (c.show.graph && T && Hs) {
      const pts: string[] = [];
      for (let i = 0; i < T.length; i += 3) {
        const t = T[i];
        const h = Hs[i];
        if (t !== null && h !== null) pts.push(`${x(toCelsius(t, tM.unit)).toFixed(1)},${y(h).toFixed(1)}`);
      }
      pts.push(`${x(tC).toFixed(1)},${y(rh).toFixed(1)}`);
      trail = pts.join(' ');
    }
    const ticks = svg`${p.tTicks.map((v) => svg`<text class="axis" x=${x(v)} y=${H - 4} text-anchor="middle">${v}°</text>`)}
      ${p.hTicks.map((v) => svg`<text class="axis" x="2" y=${y(v) + 3}>${v}%</text>`)}`;
    return html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label=${label}>
      ${zones}${ticks}
      ${trail ? svg`<polyline class="trail" points=${trail}></polyline>` : nothing}
      <circle cx=${x(tC)} cy=${y(rh)} r="10" style=${`fill:${tM.color};fill-opacity:.25`}></circle>
      <circle class="halo" cx=${x(tC)} cy=${y(rh)} r="5.5" style=${`fill:${tM.color}`}></circle>
    </svg>`;
  }

  /* ---------- Helfer ---------- */

  private _onPointer(ev: PointerEvent): void {
    const host = ev.currentTarget as HTMLElement;
    const g = host.querySelector('.g:not(.placeholder)') as HTMLElement | null;
    const n = this._data[this._range]?.times.length ?? 0;
    if (!g || n < 2) return;
    const r = g.getBoundingClientRect();
    const px = ev.clientX - r.left;
    if (px < 0 || px > r.width) {
      this._hover = null;
      return;
    }
    const i = Math.round((px / r.width) * (n - 1));
    if (i !== this._hover) this._hover = i;
  }

  private _setRange(r: RangeKey): void {
    this._range = r;
    this._hover = null;
  }

  private _fmtTime(ts: number): string {
    const opts: Intl.DateTimeFormatOptions =
      this._range === 'short' ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short', hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat(language(this.hass), opts).format(ts);
  }

  private _fmtAxis(ts: number): string {
    const opts: Intl.DateTimeFormatOptions =
      this._range === 'short' ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short', day: 'numeric', month: 'numeric' };
    return new Intl.DateTimeFormat(language(this.hass), opts).format(ts);
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
  }
}

if (!customElements.get(CARD_TYPE)) customElements.define(CARD_TYPE, ClimateSensorCard);

declare global {
  interface Window {
    customCards?: Array<Record<string, unknown>>;
  }
}
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: localize(undefined, 'card_name'),
    description: localize(undefined, 'card_description'),
    preview: true,
    documentationURL: 'https://github.com/Tronsy/ha-climate-cards',
  });
}

console.info(`%c CLIMATE-SENSOR-CARD %c ${VERSION} `, 'color:#fff;background:#03a9f4;font-weight:600', 'color:#03a9f4;background:transparent');
