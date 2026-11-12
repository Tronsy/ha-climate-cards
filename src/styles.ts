import { css } from 'lit';

export const cardStyles = css`
  :host {
    display: block;
    height: 100%;
    --ccs-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
    --ccs-chip: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
  }
  ha-card {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: 12px 12px 10px;
    overflow: hidden;
    container-type: inline-size;
    transition: background-color 0.3s;
  }
  ha-card.tinted {
    background: color-mix(in srgb, var(--tint) 10%, var(--ccs-card-bg));
  }
  button {
    font: inherit;
  }

  /* Kopfzeile */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 4px 0;
    min-height: 28px;
  }
  .name {
    all: unset;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    color: var(--primary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .name:focus-visible,
  .seg:focus-visible,
  .range button:focus-visible,
  .row:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
    border-radius: 6px;
  }
  .header-r {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
  }
  .time {
    font-size: 12px;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .range {
    display: inline-flex;
    background: var(--ccs-chip);
    border-radius: 8px;
    padding: 2px;
  }
  .range button {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: var(--secondary-text-color);
    padding: 3px 9px;
    border-radius: 6px;
    white-space: nowrap;
  }
  .range button[aria-pressed='true'] {
    background: var(--ccs-card-bg);
    color: var(--primary-text-color);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  }

  /* Messwert-Schalter */
  .segs {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 6px;
    margin-top: 10px;
  }
  .seg {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    display: grid;
    gap: 1px;
    min-width: 0;
    padding: 7px 9px;
    border-radius: 10px;
    background: var(--ccs-chip);
    border: 1px solid transparent;
    transition: background-color 0.2s, border-color 0.2s;
  }
  .seg[aria-pressed='true'] {
    background: color-mix(in srgb, var(--c) 16%, transparent);
    border-color: color-mix(in srgb, var(--c) 45%, transparent);
  }
  .seg-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    color: var(--secondary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .seg-label ha-icon {
    --mdc-icon-size: 14px;
    color: var(--c);
    flex: none;
  }
  .seg-value {
    font-size: 15px;
    font-weight: 500;
    color: var(--primary-text-color);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .swatch {
    width: 16px;
    height: 6px;
    flex: none;
  }
  .warn {
    color: color-mix(in srgb, var(--c) 70%, var(--primary-text-color)) !important;
  }

  /* Graphen */
  .graph,
  .stack {
    position: relative;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    margin-top: 10px;
    min-height: 0;
    touch-action: pan-y;
    cursor: crosshair;
    user-select: none;
  }
  .stack {
    gap: 10px;
  }
  .g {
    position: relative;
    flex: 1 1 auto;
    min-height: 110px;
    color: var(--secondary-text-color);
  }
  .graph.overlay .g {
    min-height: 130px;
  }
  .g > svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .band {
    stroke: currentColor;
    stroke-opacity: 0.45;
    stroke-dasharray: 4 4;
  }
  .minmax {
    position: absolute;
    left: 4px;
    top: 0;
    display: grid;
    font-size: 11px;
    line-height: 1.35;
    color: var(--secondary-text-color);
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }
  .cursor {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--secondary-text-color);
    opacity: 0.5;
    pointer-events: none;
  }
  .dot {
    position: absolute;
    width: 10px;
    height: 10px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 2px solid var(--ccs-card-bg);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .xaxis {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: var(--secondary-text-color);
    padding: 4px 2px 0;
    font-variant-numeric: tabular-nums;
  }
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--secondary-text-color);
  }

  /* Getrennte Graphen */
  .block {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }
  .block-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    padding: 0 4px;
    min-width: 0;
  }
  .block-head ha-icon {
    --mdc-icon-size: 16px;
    color: var(--c);
    flex: none;
  }
  .block-label {
    color: var(--secondary-text-color);
    white-space: nowrap;
  }
  .block-range {
    margin-left: auto;
    color: var(--secondary-text-color);
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }
  .block-value {
    font-weight: 500;
    font-size: 14px;
    min-width: 70px;
    text-align: right;
    white-space: nowrap;
    color: var(--primary-text-color);
    font-variant-numeric: tabular-nums;
  }
  .block .g {
    min-height: 48px;
    margin-top: 3px;
  }

  /* Raumklima */
  .pill {
    font-size: 12px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 12px;
    white-space: nowrap;
    background: color-mix(in srgb, var(--c) 18%, transparent);
    color: color-mix(in srgb, var(--c) 68%, var(--primary-text-color));
  }
  .comfort {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    margin-top: 8px;
    padding: 0 4px;
  }
  .comfort.no-map {
    grid-template-columns: minmax(0, 1fr);
  }
  .map svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .axis {
    fill: var(--secondary-text-color);
    font-size: 9px;
    font-family: inherit;
  }
  .trail {
    fill: none;
    stroke: var(--secondary-text-color);
    stroke-opacity: 0.45;
    stroke-width: 1.2;
    stroke-linejoin: round;
  }
  .halo {
    stroke: var(--ccs-card-bg);
    stroke-width: 2;
  }
  .list {
    display: grid;
    gap: 7px;
  }
  .row {
    all: unset;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    min-width: 0;
    cursor: pointer;
  }
  .row ha-icon {
    --mdc-icon-size: 18px;
    color: var(--c);
    flex: none;
  }
  .row .k {
    flex: 1;
    min-width: 0;
    color: var(--secondary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row .v {
    font-weight: 500;
    white-space: nowrap;
    color: var(--primary-text-color);
    font-variant-numeric: tabular-nums;
  }
  .msg {
    padding: 8px 4px;
    color: var(--secondary-text-color);
  }

  @container (max-width: 360px) {
    .seg {
      padding: 6px 7px;
    }
    .seg-label .txt {
      display: none;
    }
    .seg-label ha-icon,
    .seg-label .swatch {
      --mdc-icon-size: 16px;
    }
    .seg-value {
      font-size: 13px;
    }
    .block-range {
      display: none;
    }
  }
  @container (max-width: 320px) {
    .comfort {
      grid-template-columns: minmax(0, 1fr);
    }
    .time {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    ha-card,
    .seg {
      transition: none;
    }
  }
`;
