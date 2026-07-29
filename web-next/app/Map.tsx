'use client';

import { useEffect, useRef, useState } from 'react';
import type { Accessory, AccessoryHistoryEntry } from '../lib/storage';
import { Icon, pathColor } from './parts';

type Props = {
  accessory?: Accessory;
  accessories?: Accessory[];
  selectedTs?: string | null;
  onPointSelect?: (entry: AccessoryHistoryEntry) => void;
  onAccessorySelect?: (id: string) => void;
};

export default function MapView({ accessory, accessories = [], selectedTs, onPointSelect, onAccessorySelect }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // create map once
  useEffect(() => {
    let cancelled = false;
    if (!hostRef.current || mapRef.current) return;

    import('leaflet').then((mod) => {
      if (cancelled || !hostRef.current || mapRef.current) return;
      const L = (mod as any).default ?? mod;
      const map = L.map(hostRef.current, {
        zoomControl: false,
        attributionControl: true,
        preferCanvas: false,
      }).setView([48.8566, 2.3522], 13);

      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data © OpenStreetMap contributors, SRTM · style © OpenTopoMap (CC-BY-SA)',
        subdomains: 'abc',
        maxZoom: 17,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
      // ensure leaflet recalculates after mount (parent may animate in)
      setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      setMapReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // redraw path + markers when accessory changes (or when the map becomes ready)
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;
    const draw = async () => {
      const map = mapRef.current;
      if (!map || cancelled) return;
      const mod = await import('leaflet');
      const L = (mod as any).default ?? mod;

      layersRef.current.forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      if (!accessory) {
        const located = accessories.flatMap((item) => {
          const latest = item.history?.find((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
          return latest ? [{ item, latest }] : [];
        });
        if (!located.length) return;

        located.forEach(({ item, latest }) => {
          const marker = L.circleMarker([latest.lat, latest.lon], {
            radius: 9,
            color: '#fff',
            weight: 3,
            fillColor: item.color || '#6d28d9',
            fillOpacity: 1,
          }).addTo(map);
          const when = new Date(latest.timestamp);
          const whenLabel = Number.isFinite(when.getTime()) ? when.toLocaleString() : '—';
          marker.bindPopup(
            `<div class="fm-point-popover">
              <div class="role">${escapeHtml(item.name)}</div>
              <div class="ts">${escapeHtml(whenLabel)}</div>
              <div class="coords">${latest.lat.toFixed(5)}, ${latest.lon.toFixed(5)}</div>
              <div class="acc">±${Math.round(latest.accuracy)} m</div>
            </div>`,
          );
          marker.on('click', () => onAccessorySelect?.(item.id));
          layersRef.current.push(marker);
        });

        map.fitBounds(
          L.latLngBounds(located.map(({ latest }) => [latest.lat, latest.lon])),
          { padding: [40, 40], maxZoom: 17 },
        );
        setTimeout(() => map.invalidateSize(), 0);
        return;
      }

      const history = accessory.history ?? [];
      const valid = history.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
      if (!valid.length) return;

      // oldest -> newest
      const ordered = [...valid].reverse();
      const pts = ordered.map((h) => [h.lat, h.lon]);

      const smooth = catmullRom(pts, 8);

      for (let i = 0; i < smooth.length - 1; i++) {
        const t = i / (smooth.length - 1);
        const seg = L.polyline([smooth[i], smooth[i + 1]], {
          color: pathColor(t),
          weight: 4,
          opacity: 0.9,
          lineCap: 'round',
        }).addTo(map);
        layersRef.current.push(seg);
      }

      ordered.forEach((h, i) => {
        const t = i / Math.max(1, ordered.length - 1);
        const isStart = i === 0 && ordered.length > 1;
        const isEnd = i === ordered.length - 1;
        const cls = `fm-leaflet-pt ${isEnd ? 'endpoint' : isStart ? 'startpoint' : ''}`;
        const size = isEnd ? 22 : isStart ? 18 : 14;
        const icon = L.divIcon({
          className: '',
          html: `<div class="${cls}" style="background: ${pathColor(t)}"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker([h.lat, h.lon], { icon }).addTo(map);
        const when = new Date(h.timestamp);
        const whenLabel = Number.isFinite(when.getTime())
          ? when.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
          : '—';
        const role = isEnd ? 'Newest' : isStart ? 'Oldest' : `Report ${i + 1}/${ordered.length}`;
        marker.bindPopup(
          `<div class="fm-point-popover">
            <div class="role">${role}</div>
            <div class="ts">${escapeHtml(whenLabel)}</div>
            <div class="coords">${h.lat.toFixed(5)}, ${h.lon.toFixed(5)}</div>
            <div class="acc">±${Math.round(h.accuracy)} m</div>
          </div>`,
          { offset: [0, -size / 2], closeButton: true, autoPan: true }
        );
        marker.on('click', () => onPointSelect?.(h));
        layersRef.current.push(marker);
      });

      const bounds = L.latLngBounds(pts);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      setTimeout(() => map.invalidateSize(), 0);
    };
    draw();
    return () => { cancelled = true; };
  }, [
    mapReady,
    accessory?.id,
    accessory?.history?.map((h) => h.timestamp).join('|'),
    accessories.map((item) => `${item.id}:${item.history?.[0]?.timestamp ?? ''}`).join('|'),
  ]);

  // pan to selected point
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedTs || !accessory) return;
    const pt = accessory.history?.find((h) => h.timestamp === selectedTs);
    if (pt) map.panTo([pt.lat, pt.lon]);
  }, [selectedTs, accessory?.id]);

  const zoom = (delta: number) => {
    const m = mapRef.current;
    if (m) m.setZoom(m.getZoom() + delta);
  };
  const recenter = async () => {
    const m = mapRef.current;
    if (!m) return;
    const points = accessory
      ? (accessory.history ?? []).filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon))
      : accessories.flatMap((item) => {
          const latest = item.history?.find((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
          return latest ? [latest] : [];
        });
    if (!points.length) return;
    const mod = await import('leaflet');
    const L = (mod as any).default ?? mod;
    m.fitBounds(L.latLngBounds(points.map((h) => [h.lat, h.lon])), { padding: [40, 40], maxZoom: 17 });
  };

  const hasHistory = accessory
    ? (accessory.history?.length ?? 0) > 0
    : accessories.some((item) => (item.history?.length ?? 0) > 0);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={hostRef} style={{ height: '100%', width: '100%' }}/>
      <div className="fm-map-toolbar">
        <button onClick={() => zoom(1)} title="Zoom in" type="button"><Icon name="zoom_in"/></button>
        <button onClick={() => zoom(-1)} title="Zoom out" type="button"><Icon name="zoom_out"/></button>
        <button onClick={recenter} title="Recenter" type="button"><Icon name="crosshair"/></button>
      </div>
      {hasHistory && (
        <div className="fm-map-overlay">
          <div className="lbl">Older</div>
          <div className="gradient-bar"/>
          <div className="lbl">Newer</div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function catmullRom(pts: number[][], segments = 8): number[][] {
  if (pts.length < 2) return pts.slice();
  const out: number[][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      const t2 = t * t;
      const t3 = t2 * t;
      const lat = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const lon = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([lat, lon]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
