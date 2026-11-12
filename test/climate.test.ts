import { describe, expect, it } from 'vitest';
import {
  absoluteHumidity,
  colorOnScale,
  comfortState,
  cssColor,
  dewPoint,
  humidityState,
  pressureTrend,
  temperatureWarning,
  toCelsius,
  toHpa,
} from '../src/climate';
import { resolveConfig } from '../src/const';
import { makeGrid, resample, valueAt, type Point } from '../src/history';
import { computeScale, linePath, yOf } from '../src/graph';
import { toConfig } from '../src/editor-config';

const indoor = resolveConfig({ type: 'custom:climate-sensor-card', entities: { temperature: 'sensor.t' } });
const outdoor = resolveConfig({ type: 'custom:climate-sensor-card', entities: { temperature: 'sensor.t' }, profile: 'outdoor' });

describe('physics', () => {
  it('dew point matches reference values', () => {
    expect(dewPoint(20, 50)).toBeCloseTo(9.3, 1);
    expect(dewPoint(25, 80)).toBeCloseTo(21.3, 1);
  });
  it('absolute humidity matches reference values', () => {
    expect(absoluteHumidity(20, 50)).toBeCloseTo(8.6, 1);
  });
  it('converts units', () => {
    expect(toCelsius(68, '°F')).toBeCloseTo(20, 5);
    expect(toCelsius(20, '°C')).toBe(20);
    expect(toHpa(29.92, 'inHg')).toBeCloseTo(1013.2, 0);
    expect(toHpa(101.3, 'kPa')).toBeCloseTo(1013, 0);
  });
  it('classifies pressure tendency', () => {
    expect(pressureTrend(1.4)).toBe('rising');
    expect(pressureTrend(-1)).toBe('falling');
    expect(pressureTrend(0.4)).toBe('steady');
  });
});

describe('colors', () => {
  it('maps HA color names to theme variables', () => {
    expect(cssColor('light-blue')).toBe('var(--light-blue-color, #03a9f4)');
    expect(cssColor('#123456')).toBe('#123456');
  });
  it('clamps and mixes on the scale', () => {
    const stops = indoor.temperature_colors as { value: number; color: string }[];
    expect(colorOnScale(stops, 5)).toBe(cssColor('blue'));
    expect(colorOnScale(stops, 35)).toBe(cssColor('red'));
    expect(colorOnScale(stops, 21.5)).toContain('color-mix');
  });
  it('uses the outdoor scale for the outdoor profile', () => {
    expect((outdoor.temperature_colors as { value: number }[])[0].value).toBe(-15);
  });
});

describe('assessments', () => {
  it('rates indoor humidity', () => {
    expect(humidityState(25, indoor).key).toBe('hum_too_dry');
    expect(humidityState(50, indoor).level).toBe('ok');
    expect(humidityState(65, indoor).level).toBe('warning');
    expect(humidityState(75, indoor).level).toBe('critical');
  });
  it('never warns about outdoor humidity', () => {
    expect(humidityState(95, outdoor).level).toBe('ok');
  });
  it('warns about ice and frost outdoors', () => {
    expect(temperatureWarning(0.5, 92, outdoor)?.key).toBe('ice');
    expect(temperatureWarning(2.5, 60, outdoor)?.key).toBe('frost');
    expect(temperatureWarning(15, 60, outdoor)).toBeNull();
  });
  it('describes indoor comfort', () => {
    expect(comfortState(22, 50, indoor).keys).toEqual(['comfortable']);
    expect(comfortState(25, 65, indoor).keys).toEqual(['warm', 'humid']);
    expect(comfortState(-3, 70, outdoor).keys).toEqual(['w_frost']);
  });
});

describe('history', () => {
  it('resamples with last known value', () => {
    const pts: Point[] = [
      [100, 1],
      [250, 2],
    ];
    expect(resample(pts, makeGrid(0, 300, 4))).toEqual([null, 1, 1, 2]);
    expect(valueAt(pts, 200)).toBe(1);
  });
});

describe('graph', () => {
  it('maps values into the view box and breaks lines at gaps', () => {
    const s = computeScale([0, 10])!;
    expect(yOf(s, 10)).toBeLessThan(yOf(s, 0));
    expect(linePath([1, null, 2, 3], s).split('M')).toHaveLength(3);
  });
});

describe('editor config', () => {
  it('leaves defaults out of the YAML', () => {
    const cfg = toConfig(
      { layout: 'multi', graph_mode: 'single', profile: 'indoor', temperature: 'sensor.t', show_humidity: true, hours: 24, color_gradient: true },
      { type: 'custom:climate-sensor-card' },
    );
    expect(cfg).toEqual({ type: 'custom:climate-sensor-card', layout: 'multi', entities: { temperature: 'sensor.t' } });
  });
  it('keeps changed values', () => {
    const cfg = toConfig(
      { layout: 'comfort', profile: 'outdoor', temperature: 'sensor.t', show_pressure: false, hum_high: 65, color_gradient: false },
      { type: 'custom:climate-sensor-card' },
    );
    expect(cfg).toMatchObject({ layout: 'comfort', profile: 'outdoor', show: { pressure: false }, humidity_thresholds: { high: 65 }, temperature_colors: false });
  });
});
