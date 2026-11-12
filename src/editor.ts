import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { EDITOR_TYPE, resolveConfig } from './const';
import { SHOW_KEYS, toConfig, type FormData } from './editor-config';
import { detectDeviceEntities } from './entities';
import { localize } from './localize';
import type { ClimateCardConfig, HomeAssistant } from './types';

type SchemaItem = Record<string, unknown>;

const GROUPS = ['sensors', 'display', 'colors'];

export class ClimateSensorCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: ClimateCardConfig;

  public setConfig(config: ClimateCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private _formData(): FormData {
    const c = this._config!;
    const r = resolveConfig(c);
    return {
      device: c.device,
      name: c.name,
      layout: r.layout,
      graph_mode: r.graph_mode,
      profile: r.profile,
      temperature: c.entities?.temperature,
      humidity: c.entities?.humidity,
      pressure: c.entities?.pressure,
      ...Object.fromEntries(SHOW_KEYS.map((k) => [`show_${k}`, r.show[k]])),
      hours: r.hours,
      days: r.days,
      default_metric: r.default_metric,
      color_gradient: c.temperature_colors !== false,
      tint_background: r.tint_background,
      hum_low: r.humidity_thresholds.low,
      hum_high: r.humidity_thresholds.high,
      hum_critical: r.humidity_thresholds.critical,
      comfort_temp_min: r.comfort.temp_min,
      comfort_temp_max: r.comfort.temp_max,
      comfort_hum_min: r.comfort.humidity_min,
      comfort_hum_max: r.comfort.humidity_max,
    };
  }

  private _schema(d: FormData): SchemaItem[] {
    const t = (k: string) => this._t(k);
    const select = (opts: [string, string][]) => ({ select: { mode: 'dropdown', options: opts.map(([value, label]) => ({ value, label })) } });
    const bool = (name: string) => ({ name, selector: { boolean: {} } });
    const number = (name: string, min: number, max: number, unit?: string) => ({
      name,
      selector: { number: { min, max, step: 1, mode: 'box', ...(unit ? { unit_of_measurement: unit } : {}) } },
    });
    const multi = d.layout === 'multi';
    const indoor = d.profile !== 'outdoor';

    const display: SchemaItem[] = [
      {
        type: 'grid',
        name: '',
        schema: [
          bool('show_humidity'),
          bool('show_pressure'),
          ...(multi ? [] : [bool('show_dew_point'), bool('show_absolute_humidity')]),
          bool('show_graph'),
          ...(multi ? [bool('show_range_selector')] : []),
        ],
      },
    ];
    if (multi) {
      display.push({ type: 'grid', name: '', schema: [number('hours', 1, 168, 'h'), number('days', 2, 31, 'd')] });
      if (d.graph_mode !== 'stacked') {
        display.push({
          name: 'default_metric',
          selector: select([
            ['temperature', t('temperature')],
            ['humidity', t('humidity')],
            ['pressure', t('pressure')],
          ]),
        });
      }
    }

    const colors: SchemaItem[] = [{ type: 'grid', name: '', schema: [bool('color_gradient'), bool('tint_background')] }];
    if (indoor) {
      colors.push({ type: 'grid', name: '', schema: [number('hum_low', 0, 100, '%'), number('hum_high', 0, 100, '%'), number('hum_critical', 0, 100, '%')] });
      colors.push({
        type: 'grid',
        name: '',
        schema: [
          number('comfort_temp_min', -10, 40, '°C'),
          number('comfort_temp_max', -10, 40, '°C'),
          number('comfort_hum_min', 0, 100, '%'),
          number('comfort_hum_max', 0, 100, '%'),
        ],
      });
    }

    return [
      { name: 'device', selector: { device: { entity: [{ domain: 'sensor', device_class: 'temperature' }] } } },
      { name: 'name', selector: { text: {} } },
      {
        type: 'grid',
        name: '',
        schema: [
          {
            name: 'layout',
            required: true,
            selector: select([
              ['multi', t('editor.layout_multi')],
              ['comfort', t('editor.layout_comfort')],
            ]),
          },
          {
            name: 'profile',
            required: true,
            selector: select([
              ['indoor', t('editor.profile_indoor')],
              ['outdoor', t('editor.profile_outdoor')],
            ]),
          },
        ],
      },
      ...(multi
        ? [
            {
              name: 'graph_mode',
              required: true,
              selector: select([
                ['single', t('editor.graph_single')],
                ['overlay', t('editor.graph_overlay')],
                ['stacked', t('editor.graph_stacked')],
              ]),
            },
          ]
        : []),
      {
        type: 'expandable',
        name: 'sensors',
        flatten: true,
        title: t('editor.sensors'),
        schema: [
          { name: 'temperature', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'temperature' }] } } },
          { name: 'humidity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'humidity' }] } } },
          {
            name: 'pressure',
            selector: {
              entity: {
                filter: [
                  { domain: 'sensor', device_class: 'atmospheric_pressure' },
                  { domain: 'sensor', device_class: 'pressure' },
                ],
              },
            },
          },
        ],
      },
      { type: 'expandable', name: 'display', flatten: true, title: t('editor.display'), schema: display },
      { type: 'expandable', name: 'colors', flatten: true, title: t('editor.colors'), schema: colors },
    ];
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) return nothing;
    const data = this._formData();
    return html`<ha-form
      .hass=${this.hass}
      .data=${data}
      .schema=${this._schema(data)}
      .computeLabel=${this._label}
      .computeHelper=${this._helper}
      @value-changed=${this._valueChanged}
    ></ha-form>`;
  }

  private _label = (s: { name: string }) => (s.name ? this._t(`editor.${s.name}`) : '');
  private _helper = (s: { name: string }) => (s.name === 'temperature' ? this._t('editor.sensors_hint') : undefined);

  private _valueChanged(ev: CustomEvent<{ value: FormData }>): void {
    ev.stopPropagation();
    const v: FormData = { ...ev.detail.value };
    // falls eine HA-Version "flatten" nicht kennt, landen Werte verschachtelt unter dem Gruppennamen
    for (const g of GROUPS) {
      if (v[g] && typeof v[g] === 'object') {
        Object.assign(v, v[g]);
        delete v[g];
      }
    }
    const old = this._config!;
    if (v.device && v.device !== old.device) {
      const found = detectDeviceEntities(this.hass, v.device);
      v.temperature = found.temperature;
      v.humidity = found.humidity;
      v.pressure = found.pressure;
    }
    const config = toConfig(v, old);
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }
}

if (!customElements.get(EDITOR_TYPE)) customElements.define(EDITOR_TYPE, ClimateSensorCardEditor);
