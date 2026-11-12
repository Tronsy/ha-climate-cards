import type { HomeAssistant } from './types';

/** [timestamp in ms, value] */
export type Point = [number, number];

interface HistoryEntry {
  s?: string;
  state?: string;
  lu?: number;
  lc?: number;
  last_updated?: string;
  last_changed?: string;
}

interface StatisticEntry {
  start: number | string;
  mean?: number | null;
}

function parseHistoryEntry(e: HistoryEntry): Point | null {
  const v = parseFloat(e.s ?? e.state ?? '');
  if (!Number.isFinite(v)) return null;
  const secs = e.lu ?? e.lc;
  const t = secs !== undefined ? secs * 1000 : Date.parse(e.last_updated ?? e.last_changed ?? '');
  return Number.isFinite(t) ? [t, v] : null;
}

/** Recorded states of numeric sensors in a time window. */
export async function fetchHistory(hass: HomeAssistant, ids: string[], start: Date, end: Date): Promise<Record<string, Point[]>> {
  if (!ids.length) return {};
  const res = await hass.connection.sendMessagePromise<Record<string, HistoryEntry[]>>({
    type: 'history/history_during_period',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    entity_ids: ids,
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
  const out: Record<string, Point[]> = {};
  for (const id of ids) {
    out[id] = (res?.[id] ?? [])
      .map(parseHistoryEntry)
      .filter((p): p is Point => p !== null)
      .sort((a, b) => a[0] - b[0]);
  }
  return out;
}

/** Hourly means from the long-term statistics (needs state_class: measurement). */
export async function fetchStatistics(hass: HomeAssistant, ids: string[], start: Date, end: Date): Promise<Record<string, Point[]>> {
  if (!ids.length) return {};
  const res = await hass.connection.sendMessagePromise<Record<string, StatisticEntry[]>>({
    type: 'recorder/statistics_during_period',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    statistic_ids: ids,
    period: 'hour',
    types: ['mean'],
  });
  const out: Record<string, Point[]> = {};
  for (const id of ids) {
    out[id] = (res?.[id] ?? [])
      .map((e): Point | null => {
        let t = typeof e.start === 'number' ? e.start : Date.parse(e.start);
        if (t < 1e12) t *= 1000; // seconds → ms
        return Number.isFinite(t) && typeof e.mean === 'number' && Number.isFinite(e.mean) ? [t, e.mean] : null;
      })
      .filter((p): p is Point => p !== null)
      .sort((a, b) => a[0] - b[0]);
  }
  return out;
}

export function makeGrid(start: number, end: number, n: number): number[] {
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(start + i * step));
}

/** Step resampling: each grid time gets the last value recorded at or before it. */
export function resample(points: Point[], times: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  let j = 0;
  let last: number | null = null;
  for (const t of times) {
    while (j < points.length && points[j][0] <= t) {
      last = points[j][1];
      j++;
    }
    out.push(last);
  }
  return out;
}

/** Last value recorded at or before t. */
export function valueAt(points: Point[] | undefined, t: number): number | null {
  if (!points?.length) return null;
  let v: number | null = null;
  for (const p of points) {
    if (p[0] > t) break;
    v = p[1];
  }
  return v;
}
