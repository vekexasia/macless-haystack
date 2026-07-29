'use client';

import { useState } from 'react';
import type { Accessory, AccessoryHistoryEntry, Settings } from '../lib/storage';
import type { CSSProperties, ReactNode } from 'react';

/* ====================== Icons ====================== */

const ICON_PATHS: Record<string, ReactNode> = {
  key: <><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4"/><path d="M18 5l3 3"/><path d="M15 8l3 3"/></>,
  backpack: <><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5"/><path d="M8 10h8"/></>,
  bike: <><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></>,
  wallet: <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></>,
  luggage: <><rect x="6" y="8" width="12" height="13" rx="2"/><path d="M9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/><path d="M10 21v1M14 21v1"/><path d="M6 13h12"/></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></>,
  car: <><path d="M5 17h14"/><path d="M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/><path d="M3 12l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v5H3z"/></>,
  globe: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a14 14 0 0 1 0 20 14 14 0 0 1 0-20z"/></>,
  gift: <><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
  crown: <path d="M2 7l4 7 6-9 6 9 4-7v13H2z"/>,
  walk: <><circle cx="13" cy="4" r="2"/><path d="M7 22l4-9 3 3v6"/><path d="M14 13l4-2 2 4"/></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
  rabbit: <><path d="M13 16a3 3 0 0 1 2.24 5"/><path d="M18 12h0"/><path d="M14 8c0-2.2-1.8-4-4-4-3.5 0-6 2.5-6 6 0 1.5.5 2.5 1.5 3.5"/><path d="M2.5 11.5C3 13 4 14 5.5 14h11l3 4h-3l-2-2h-3l-2 4-3 1z"/></>,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
  dot: <circle cx="12" cy="12" r="4"/>,

  refresh: <><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.3-2.55L3 16"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.3 2.55L21 8"/><polyline points="3 21 3 16 8 16"/><polyline points="21 3 21 8 16 8"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
  map: <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>,
  external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  check: <polyline points="20 6 9 17 4 12"/>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
  zoom_in: <><circle cx="11" cy="11" r="7"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  zoom_out: <><circle cx="11" cy="11" r="7"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  crosshair: <><circle cx="12" cy="12" r="9"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></>,
};

// SF-symbol-style names from the Flutter side → our lucide-style names
const ICON_ALIAS: Record<string, string> = {
  'creditcard.fill': 'wallet',
  'briefcase.fill': 'briefcase',
  'case.fill': 'briefcase',
  'latch.2.case.fill': 'luggage',
  'key.fill': 'key',
  'mappin': 'pin',
  'globe': 'globe',
  'crown.fill': 'crown',
  'gift.fill': 'gift',
  'car.fill': 'car',
  'bicycle': 'bike',
  'figure.walk': 'walk',
  'heart.fill': 'heart',
  'hare.fill': 'rabbit',
  'tortoise.fill': 'rabbit',
  'eye.fill': 'eye',
};

export const ACCESSORY_ICON_OPTIONS = [
  { name: 'creditcard.fill', label: 'Card' },
  { name: 'briefcase.fill', label: 'Briefcase' },
  { name: 'case.fill', label: 'Case' },
  { name: 'latch.2.case.fill', label: 'Luggage' },
  { name: 'key.fill', label: 'Key' },
  { name: 'mappin', label: 'Pin' },
  { name: 'globe', label: 'Globe' },
  { name: 'crown.fill', label: 'Crown' },
  { name: 'gift.fill', label: 'Gift' },
  { name: 'car.fill', label: 'Car' },
  { name: 'bicycle', label: 'Bicycle' },
  { name: 'figure.walk', label: 'Walking' },
  { name: 'heart.fill', label: 'Heart' },
  { name: 'hare.fill', label: 'Rabbit' },
  { name: 'tortoise.fill', label: 'Tortoise' },
  { name: 'eye.fill', label: 'Eye' },
] as const;

export function normalizeAccessoryIcon(raw?: string) {
  return ACCESSORY_ICON_OPTIONS.some((option) => option.name === raw) ? raw! : 'mappin';
}

export function resolveIconName(raw?: string) {
  if (!raw) return 'pin';
  if (ICON_ALIAS[raw]) return ICON_ALIAS[raw];
  if (ICON_PATHS[raw]) return raw;
  return 'pin';
}

type IconProps = {
  name: string;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
};
export function Icon({ name, size = 16, stroke = 1.75, className, style }: IconProps) {
  const path = ICON_PATHS[name] || ICON_PATHS.dot;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
    >
      {path}
    </svg>
  );
}

/* ====================== Color helpers ====================== */

function hexToRgb(hex: string) {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function readVar(name: string, fallback: string) {
  if (typeof getComputedStyle === 'undefined') return hexToRgb(fallback);
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return hexToRgb(v || fallback);
}

function mix(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, k: number) {
  return `rgb(${Math.round(a.r + (b.r - a.r) * k)}, ${Math.round(a.g + (b.g - a.g) * k)}, ${Math.round(a.b + (b.b - a.b) * k)})`;
}

// t in [0,1]: 0 = oldest (danger red), mid = warning amber, 1 = newest (success green)
export function pathColor(t: number) {
  const a = readVar('--duik-color-danger', '#DC2626');
  const b = readVar('--duik-color-warning', '#D97706');
  const c = readVar('--fm-path-newest', '#2BA47D');
  if (t < 0.5) return mix(a, b, t / 0.5);
  return mix(b, c, (t - 0.5) / 0.5);
}

// soft fg+bg pair derived from accessory's stored color
export function chipColors(color?: string) {
  if (!color) return { bg: '#F0EFEC', fg: '#14141A' };
  const { r, g, b } = hexToRgb(color);
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.16)`,
    fg: color,
  };
}

/* ====================== Time helpers ====================== */

export function timeAgo(ts: string | number) {
  const t = typeof ts === 'string' ? Date.parse(ts) : ts;
  if (!Number.isFinite(t)) return '—';
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function fmtTime(ts: string | number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function fmtDayTime(ts: string | number) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '—';
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return fmtTime(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + fmtTime(ts);
}

/* ====================== Small components ====================== */

export function StatusPill({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 500,
      padding: '2px 8px',
      borderRadius: 999,
      color: active ? 'var(--duik-color-success-text)' : 'var(--duik-text-secondary)',
      background: active ? 'var(--duik-color-success-bg)' : 'var(--duik-surface-sunken)',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: 999,
        background: active ? 'var(--duik-color-success)' : 'var(--duik-color-neutral-400)',
      }}/>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export function AccChip({
  accessory, size = 'md', refreshing = false, pulse = false,
}: {
  accessory: Accessory;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  refreshing?: boolean;
  pulse?: boolean;
}) {
  const c = chipColors(accessory.color);
  const sizePx = size === 'lg' ? 24 : size === 'xl' ? 32 : size === 'sm' ? 16 : 20;
  return (
    <div className={`fm-chip ${size} ${pulse ? 'fm-chip-pulse' : ''}`}
         style={{ background: c.bg, color: c.fg }}>
      <Icon name={resolveIconName(accessory.icon)} size={sizePx} />
      {refreshing && (
        <div style={{
          position: 'absolute', inset: -3,
          border: '2px solid var(--duik-color-brand-teal)',
          borderRightColor: 'transparent', borderRadius: 'inherit',
          animation: 'fmSpin 0.9s linear infinite',
        }}/>
      )}
    </div>
  );
}

export function AccessoryRow({
  accessory, selected, onSelect, refreshing, dense = false,
}: {
  accessory: Accessory;
  selected?: boolean;
  onSelect?: () => void;
  refreshing?: boolean;
  dense?: boolean;
}) {
  const latest = accessory.history?.[0];
  const ago = latest ? timeAgo(latest.timestamp) : null;
  return (
    <button
      className={`fm-acc-row ${selected ? 'selected' : ''} ${refreshing ? 'refreshing' : ''} ${!accessory.isActive ? 'inactive' : ''}`}
      onClick={onSelect}
      type="button"
    >
      <AccChip accessory={accessory} size={dense ? 'sm' : 'md'} refreshing={refreshing}/>
      <div className="body">
        <div className="name">
          {accessory.name}
          {!accessory.isActive && <StatusPill active={false}/>}
        </div>
        <div className="meta">
          {refreshing ? (
            <span style={{ color: 'var(--duik-color-brand-teal)' }}>Fetching reports…</span>
          ) : !latest ? (
            <span>No reports yet</span>
          ) : (
            <>
              <span>{ago}</span>
              <span className="sep">·</span>
              <span>±{Math.round(latest.accuracy)}m</span>
            </>
          )}
        </div>
      </div>
      <div className="right">
        {refreshing && <div className="spinner"/>}
        {!refreshing && latest && (
          <div className="reports-count">
            <span className="n">{accessory.history?.length ?? 0}</span>
            <span className="u">reports</span>
          </div>
        )}
      </div>
    </button>
  );
}

function ShareButton({ accessoryName }: { accessoryName: string }) {
  const [label, setLabel] = useState<'Share' | 'Copied' | 'Copy failed'>('Share');
  async function onClick() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Macless Haystack — ${accessoryName}`, url });
        return;
      } catch {
        // user cancelled or share failed; fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setLabel('Copied');
    } catch {
      setLabel('Copy failed');
    }
    setTimeout(() => setLabel('Share'), 1600);
  }
  return (
    <button className="btn btn-secondary btn-sm" onClick={onClick} type="button">
      <Icon name={label === 'Copied' ? 'check' : 'share'} size={14}/>
      {label === 'Share' ? 'Share link' : label}
    </button>
  );
}

export function AccessoryEditor({
  accessory, onChange,
}: {
  accessory: Accessory;
  onChange?: (patch: Partial<Accessory>) => void;
}) {
  const icon = normalizeAccessoryIcon(accessory.icon);
  const update = (patch: Partial<Accessory>) => onChange?.(patch);
  return (
    <details className="fm-accessory-editor" open>
      <summary>Edit accessory</summary>
      <div className="fm-editor-fields">
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            value={accessory.name}
            aria-label="Accessory name"
            onChange={(event) => update({ name: event.target.value })}
          />
        </label>
        <label className="fm-editor-toggle">
          <input
            type="checkbox"
            checked={accessory.isActive}
            aria-label="Active accessory"
            onChange={(event) => update({ isActive: event.target.checked })}
          />
          <span>Active</span>
        </label>
        <div className="field">
          <span>Icon</span>
          <div className="fm-icon-options" role="group" aria-label="Accessory icon">
            {ACCESSORY_ICON_OPTIONS.map((option) => (
              <button
                key={option.name}
                className={`fm-icon-option ${icon === option.name ? 'selected' : ''}`}
                type="button"
                title={option.label}
                aria-label={`${option.label} icon`}
                aria-pressed={icon === option.name}
                onClick={() => onChange?.({ icon: option.name })}
              >
                <Icon name={resolveIconName(option.name)} size={18}/>
              </button>
            ))}
          </div>
        </div>
        <label className="field fm-color-field">
          <span>Color</span>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(accessory.color) ? accessory.color : '#64748b'}
            aria-label="Accessory color"
            onChange={(event) => update({ color: event.target.value })}
          />
        </label>
      </div>
    </details>
  );
}

/* ====================== Big screen pieces ====================== */

export function SelectedSummary({
  accessory, refreshing, busy, onRefresh, onAccessoryChange, onOpenMap,
}: {
  accessory: Accessory;
  refreshing?: boolean;
  busy?: boolean;
  onRefresh?: () => void;
  onAccessoryChange?: (patch: Partial<Accessory>) => void;
  onOpenMap?: () => void;
}) {
  const latest = accessory.history?.[0];
  const c = chipColors(accessory.color);
  return (
    <div className="fm-summary">
      <div className="head">
        <AccChip accessory={accessory} size="lg" pulse={refreshing}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ color: c.fg }}>Selected accessory</div>
          <h2 style={{ marginTop: 4 }}>{accessory.name}</h2>
          {latest && (
            <div className="sub">
              <span>Last seen</span>
              <span className="editorial" style={{ color: 'var(--duik-text-primary)', fontWeight: 500 }}>
                {timeAgo(latest.timestamp)}
              </span>
              <span>·</span>
              <span>{fmtDayTime(latest.timestamp)}</span>
            </div>
          )}
        </div>
      </div>
      <AccessoryEditor accessory={accessory} onChange={onAccessoryChange}/>

      {latest ? (
        <>
          <div className="fm-stats">
            <div className="fm-stat">
              <div className="label">Coordinates</div>
              <div style={{ marginTop: 4 }} className="fm-coord">
                {latest.lat.toFixed(5)}, {latest.lon.toFixed(5)}
              </div>
            </div>
            <div className="fm-stat">
              <div className="label">Accuracy</div>
              <div className="val">±{Math.round(latest.accuracy)}<span className="unit">m</span></div>
            </div>
            <div className="fm-stat">
              <div className="label">Reports</div>
              <div className="val">{accessory.history?.length ?? 0}<span className="unit">total</span></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <button
              className="btn btn-gradient btn-sm"
              onClick={onRefresh}
              disabled={busy || refreshing}
            >
              <Icon name="refresh" size={14} style={{ animation: refreshing ? 'fmSpin 1s linear infinite' : 'none' }}/>
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
            {onOpenMap && (
              <button className="btn btn-secondary btn-sm" onClick={onOpenMap}>
                <Icon name="external" size={14}/>
                Open in Maps
              </button>
            )}
            <ShareButton accessoryName={accessory.name}/>
          </div>
        </>
      ) : (
        <div className="fm-info-strip">
          <Icon name="info" size={14}/>
          <span>No reports yet. Refresh to fetch encrypted reports for this accessory.</span>
        </div>
      )}
    </div>
  );
}

export function HistoryList({
  accessory, onPointSelect, selectedTs,
}: {
  accessory: Accessory;
  onPointSelect?: (entry: AccessoryHistoryEntry) => void;
  selectedTs?: string | null;
}) {
  const history = accessory.history ?? [];
  return (
    <div className="fm-history">
      <div className="head">
        <h3>Location history</h3>
        <span className="count">{history.length} {history.length === 1 ? 'report' : 'reports'}</span>
      </div>
      <div className="scroll">
        {history.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--duik-text-tertiary)', fontSize: 13 }}>
            No history available
          </div>
        )}
        {history.map((h, i) => {
          const t = (history.length - 1 - i) / Math.max(1, history.length - 1);
          const active = selectedTs === h.timestamp;
          return (
            <button
              key={`${h.timestamp}-${i}`}
              className={`fm-hist-row ${active ? 'active' : ''}`}
              onClick={() => onPointSelect?.(h)}
              type="button"
            >
              <span className="timeline" style={{ background: pathColor(t) }}/>
              <span className="ts">{fmtDayTime(h.timestamp)}</span>
              <span className="coords">{h.lat.toFixed(5)}, {h.lon.toFixed(5)}</span>
              <span className="acc">±{Math.round(h.accuracy)}m</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RefreshBar({
  current, total, currentName,
}: {
  current: number;
  total: number;
  currentName?: string | null;
}) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="fm-refresh-bar">
      <div className="fm-live"><span className="live-dot"/>Refreshing</div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="label">{currentName ? `Decrypting "${currentName}"…` : 'Connecting…'}</span>
          <span className="count">{current}/{total}</span>
        </div>
        <div className="progress"><div style={{ width: `${pct}%` }}/></div>
      </div>
    </div>
  );
}

export function SettingsCard({
  settings, onChange, onSave, onTest, onImport, onExport, canExport, isLoading,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onSave?: () => void;
  onTest?: () => void;
  onImport?: (file: File) => void;
  onExport?: () => void;
  canExport?: boolean;
  isLoading?: boolean;
}) {
  return (
    <div className="fm-settings-card">
      <h3>Endpoint</h3>
      <div className="field">
        <label>Endpoint URL</label>
        <input className="input mono" value={settings.endpoint}
               onChange={(e) => onChange({ ...settings, endpoint: e.target.value })}/>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Username</label>
          <input className="input" value={settings.user}
                 onChange={(e) => onChange({ ...settings, user: e.target.value })}/>
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" value={settings.pass}
                 onChange={(e) => onChange({ ...settings, pass: e.target.value })}/>
        </div>
      </div>
      <div className="field">
        <label>Days to fetch</label>
        <input className="input" type="number" value={settings.days}
               onChange={(e) => onChange({ ...settings, days: Number(e.target.value) || 1 })}/>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        {onSave && <button className="btn btn-primary btn-sm" onClick={onSave}>Save</button>}
        {onTest && (
          <button className="btn btn-secondary btn-sm" onClick={onTest} disabled={isLoading}>
            {isLoading ? 'Testing…' : 'Test connection'}
          </button>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--duik-color-neutral-200)', margin: '4px 0' }}/>

      <h3>Migration</h3>
      <label className="fm-drop">
        <Icon name="upload" size={20} style={{ color: 'var(--duik-color-brand-purple)' }}/>
        <div style={{ fontSize: 13 }}>
          Drop your <strong>accessories.json</strong> here, or <strong>browse</strong>
        </div>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && onImport) onImport(f);
          }}
        />
      </label>
      <button className="btn btn-secondary btn-sm" onClick={onExport} disabled={!canExport}>
        <Icon name="download" size={14}/>
        Export accessories.json
      </button>
    </div>
  );
}

export function EmptyImport({
  onImport, onSampleHidden, error,
}: {
  onImport?: (file: File) => void;
  onSampleHidden?: () => void;
  error?: boolean;
}) {
  return (
    <div className="fm-empty">
      <div className="icon"><Icon name="upload" size={28}/></div>
      <h3>No accessories yet</h3>
      <p>
        Import a JSON file containing your accessory keys to get started. Keys never leave this browser
        {' '}<em style={{ fontFamily: 'var(--duik-font-family-display)', fontStyle: 'italic', color: 'var(--duik-color-brand-purple)' }}>·</em>{' '}
        location reports are decrypted locally.
      </p>
      <label className="fm-drop">
        <Icon name="upload" size={20} style={{ color: 'var(--duik-color-brand-purple)' }}/>
        <div style={{ fontSize: 13 }}>
          Drop your <strong>accessories.json</strong> here, or <strong>browse</strong>
        </div>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && onImport) onImport(f);
          }}
        />
      </label>
      {error && (
        <div className="fm-error-banner" style={{ width: '100%', maxWidth: 400 }}>
          <div className="icon"><Icon name="alert"/></div>
          <div className="body">
            <h4>Couldn&apos;t read the file</h4>
            <p>The file isn&apos;t valid accessory JSON. Expected an array with name, icon, color, privateKey for each entry.</p>
          </div>
        </div>
      )}
      {onSampleHidden && (
        <button className="btn btn-ghost btn-sm" onClick={onSampleHidden}>or load sample data →</button>
      )}
    </div>
  );
}

export function ErrorBanner({
  title, body, onDismiss, onRetry,
}: {
  title: string;
  body: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="fm-error-banner">
      <div className="icon"><Icon name="alert"/></div>
      <div className="body">
        <h4>{title}</h4>
        <p>{body}</p>
        {(onRetry || onDismiss) && (
          <div className="actions">
            {onRetry && <button className="btn btn-secondary btn-sm" onClick={onRetry}>Retry</button>}
            {onDismiss && <button className="btn btn-ghost btn-sm" onClick={onDismiss}>Dismiss</button>}
          </div>
        )}
      </div>
    </div>
  );
}
