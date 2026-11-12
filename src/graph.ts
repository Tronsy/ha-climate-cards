import { html, svg, nothing, type TemplateResult } from 'lit';

/** Graph coordinates: viewBox 0..300 × 0..100, stretched to the container. */
export const VB_W = 300;
export const VB_H = 100;

export interface Scale {
  min: number;
  max: number;
  top: number;
  bottom: number;
}

export function computeScale(
  values: (number | null)[],
  opts: { lo?: number; hi?: number; top?: number; bottom?: number } = {},
): Scale | null {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return null;
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (opts.lo !== undefined) min = Math.min(min, opts.lo);
  if (opts.hi !== undefined) max = Math.max(max, opts.hi);
  const span = max - min || 1;
  return { min: min - span * 0.12, max: max + span * 0.12, top: opts.top ?? 8, bottom: opts.bottom ?? 4 };
}

export const yOf = (s: Scale, v: number) => VB_H - s.bottom - ((v - s.min) / (s.max - s.min)) * (VB_H - s.top - s.bottom);
export const xOf = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * VB_W);

function segments(values: (number | null)[]): [number, number][][] {
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push([i, v]);
  });
  if (cur.length) segs.push(cur);
  return segs;
}

export function linePath(values: (number | null)[], s: Scale): string {
  const n = values.length;
  return segments(values)
    .map((seg) => 'M' + seg.map(([i, v]) => `${xOf(i, n).toFixed(1)},${yOf(s, v).toFixed(2)}`).join('L'))
    .join('');
}

export function areaPath(values: (number | null)[], s: Scale): string {
  const n = values.length;
  return segments(values)
    .map((seg) => {
      const x0 = xOf(seg[0][0], n).toFixed(1);
      const x1 = xOf(seg[seg.length - 1][0], n).toFixed(1);
      return `M${x0},${VB_H}` + seg.map(([i, v]) => `L${xOf(i, n).toFixed(1)},${yOf(s, v).toFixed(2)}`).join('') + `L${x1},${VB_H}Z`;
    })
    .join('');
}

export interface GraphOptions {
  values: (number | null)[];
  scale: Scale;
  id: string;
  /** CSS color for line/fill, ignored when colorAt + gradient is set */
  color: string;
  /** per-value color; with gradient=true the line gets a vertical gradient */
  colorAt?: (v: number) => string;
  gradient?: boolean;
  fill?: number;
  strokeWidth?: number;
  dash?: string;
  opacity?: number;
  bands?: number[];
}

export function renderGraph(o: GraphOptions): TemplateResult {
  const s = o.scale;
  let paint = o.color;
  let defs: TemplateResult | typeof nothing = nothing;
  if (o.gradient && o.colorAt) {
    const stops = Array.from({ length: 9 }, (_, k) => {
      const v = s.max - ((s.max - s.min) * k) / 8;
      const offset = Math.max(0, Math.min(1, yOf(s, v) / VB_H));
      return svg`<stop offset=${offset.toFixed(3)} style=${`stop-color:${o.colorAt!(v)}`}></stop>`;
    });
    defs = svg`<defs><linearGradient id=${o.id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2=${VB_H}>${stops}</linearGradient></defs>`;
    paint = `url(#${o.id})`;
  }
  const fill = o.fill ?? 0;
  return html`<svg class="graph-svg" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="none" aria-hidden="true">
    ${defs}
    ${(o.bands ?? []).map((b) => {
      const y = yOf(s, b).toFixed(2);
      return svg`<line class="band" x1="0" x2=${VB_W} y1=${y} y2=${y} vector-effect="non-scaling-stroke"></line>`;
    })}
    ${fill ? svg`<path d=${areaPath(o.values, s)} style=${`fill:${paint};fill-opacity:${fill}`}></path>` : nothing}
    <path
      d=${linePath(o.values, s)}
      fill="none"
      vector-effect="non-scaling-stroke"
      stroke-linejoin="round"
      stroke-linecap="round"
      stroke-dasharray=${o.dash || nothing}
      style=${`stroke:${paint};stroke-width:${o.strokeWidth ?? 2}px;stroke-opacity:${o.opacity ?? 1}`}
    ></path>
  </svg>`;
}
