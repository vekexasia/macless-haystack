'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  Accessory,
  AccessoryHistoryEntry,
  exportAccessoriesJson,
  importAccessoriesJson,
  loadAccessories,
  loadSettings,
  saveAccessories,
  saveSettings,
  Settings,
} from '../lib/storage';
import { fetchAndDecryptReports } from '../lib/findmy';
import {
  AccessoryRow,
  EmptyImport,
  ErrorBanner,
  HistoryList,
  Icon,
  RefreshBar,
  SelectedSummary,
  SettingsCard,
} from './parts';

const MapView = dynamic(() => import('./Map'), { ssr: false });

type UiError = { title: string; body: string; accessoryId?: string } | null;

function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function Home() {
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [settings, setSettings] = useState<Settings>({
    endpoint: '',
    user: '',
    pass: '',
    days: 7,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTs, setSelectedTs] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<UiError>(null);
  const [importError, setImportError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'list' | 'settings'>('map');

  // initial load: hydrate from storage and select only an explicit ?acc=… target
  useEffect(() => {
    const stored = loadAccessories();
    setAccessories(stored);
    setSettings(loadSettings());
    const fromUrl = new URL(window.location.href).searchParams.get('acc');
    const match = fromUrl ? stored.find((a) => slugify(a.name) === fromUrl) : null;
    setSelectedId(match?.id ?? null);
    setIsHydrated(true);
  }, []);

  // browser back/forward should re-sync the selection
  useEffect(() => {
    const handler = () => {
      const next = new URL(window.location.href).searchParams.get('acc');
      const match = next ? accessories.find((a) => slugify(a.name) === next) : null;
      setSelectedId(match?.id ?? null);
      setShowSettings(false);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [accessories]);

  // keep ?acc=… in sync with the selected accessory (slug from name)
  useEffect(() => {
    if (!isHydrated) return;
    const acc = accessories.find((a) => a.id === selectedId);
    const url = new URL(window.location.href);
    if (!acc) {
      if (!url.searchParams.has('acc')) return;
      url.searchParams.delete('acc');
      window.history.replaceState(null, '', url.toString());
      return;
    }
    const slug = slugify(acc.name);
    if (url.searchParams.get('acc') === slug) return;
    url.searchParams.set('acc', slug);
    window.history.replaceState(null, '', url.toString());
  }, [selectedId, accessories, isHydrated]);

  const selected = useMemo(
    () => accessories.find((a) => a.id === selectedId) ?? null,
    [accessories, selectedId],
  );

  function updateSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  function persist(next: Accessory[]) {
    setAccessories(next);
    saveAccessories(next);
    if (selectedId && !next.some((a) => a.id === selectedId)) {
      setSelectedId(null);
    }
  }

  function updateAccessory(id: string, patch: Partial<Accessory>) {
    setAccessories((previous) => {
      const next = previous.map((accessory) => (
        accessory.id === id ? { ...accessory, ...patch } : accessory
      ));
      if (!next.some((accessory) => accessory.id === id)) return previous;
      saveAccessories(next);
      return next;
    });
  }

  async function onImport(file: File) {
    try {
      setImportError(false);
      const text = await file.text();
      const imported = importAccessoriesJson(text);
      persist(imported);
      setSelectedId(null);
      setShowSettings(false);
      setError(null);
    } catch {
      setImportError(true);
    }
  }

  async function refreshTargets(targetIds: string[], singleAccessoryId?: string) {
    if (isLoading) return;
    const targetSet = new Set(targetIds);
    const targets = accessories.filter((accessory) => targetSet.has(accessory.id));
    if (!targets.length) return;
    setIsLoading(true);
    setError(null);
    setProgress({ current: 0, total: targets.length });
    let completed = 0;
    try {
      for (const accessory of targets) {
        setRefreshingId(accessory.id);
        const reports = await fetchAndDecryptReports({
          endpoint: settings.endpoint,
          user: settings.user,
          pass: settings.pass,
          days: settings.days,
          privateKeys: [accessory.privateKey, ...accessory.additionalKeys],
        });
        completed += 1;
        setProgress({ current: completed, total: targets.length });
        const latest = reports[0];
        setAccessories((previous) => {
          const next = previous.map((current) => {
            if (current.id !== accessory.id) return current;
            if (!latest) return { ...current, history: [] };
            return {
              ...current,
              lat: latest.latitude,
              lon: latest.longitude,
              lastSeen: latest.timestamp,
              history: reports.map((report) => ({
                lat: report.latitude,
                lon: report.longitude,
                accuracy: report.accuracy,
                timestamp: report.timestamp,
                batteryStatus: report.batteryStatus,
              })),
            };
          });
          saveAccessories(next);
          return next;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError({
        title: "Couldn't reach the endpoint",
        body: msg || 'Verify your endpoint URL, username and password in settings, then try again.',
        accessoryId: singleAccessoryId,
      });
    } finally {
      setRefreshingId(null);
      setIsLoading(false);
    }
  }

  function refreshAll() {
    const activeIds = accessories.filter((accessory) => accessory.isActive).map((accessory) => accessory.id);
    if (!activeIds.length) {
      setError({
        title: 'No active accessories',
        body: 'Activate at least one accessory before refreshing all.',
      });
      return;
    }
    return refreshTargets(activeIds);
  }

  function refreshOne(accessoryId: string) {
    return refreshTargets([accessoryId], accessoryId);
  }

  function downloadExport() {
    const blob = new Blob([exportAccessoriesJson(accessories)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accessories.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  const isEmpty = accessories.length === 0;
  const isRefreshing = isLoading;

  // shared sub-elements
  const Sidebar = (
    <div className="fm-panel">
      <div className="fm-panel-head">
        <div className="top">
          <h1>Macless <em style={{ fontFamily: 'var(--duik-font-family-display)', fontStyle: 'italic', fontWeight: 600, color: 'var(--duik-color-brand-purple)' }}>Haystack</em></h1>
          <div style={{ display: 'flex', gap: 6 }}>
            <label className="fm-iconbtn" title="Import accessories">
              <Icon name="upload" size={15}/>
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                }}
              />
            </label>
            <button
              className={`fm-iconbtn ${isRefreshing ? 'spinning' : ''}`}
              onClick={refreshAll}
              disabled={isRefreshing || isEmpty}
              title="Refresh"
              type="button"
            >
              <Icon name="refresh" size={15}/>
            </button>
          </div>
        </div>
        <div className="editorial-line">
          Your trackers, <em>in one glance</em>.
        </div>
      </div>
      <div className="fm-panel-body">
        {isEmpty ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--duik-text-tertiary)', fontSize: 13 }}>
            <Icon name="pin" size={28} style={{ opacity: 0.4 }}/>
            <div style={{ marginTop: 12 }}>No accessories imported</div>
          </div>
        ) : (
          <>
            <div className="eyebrow" style={{ padding: '6px 10px 4px' }}>
              {accessories.filter((a) => a.isActive).length} active · {accessories.length} total
            </div>
            {accessories.map((acc) => (
              <AccessoryRow
                key={acc.id}
                accessory={acc}
                selected={acc.id === selectedId}
                onSelect={() => {
                  setSelectedId((current) => current === acc.id ? null : acc.id);
                  setShowSettings(false);
                  setSelectedTs(null);
                  setMobileTab('map');
                }}
                refreshing={acc.id === refreshingId}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );

  const RightPanel = (
    <div className="fm-panel">
      <div className="fm-panel-head">
        <div className="top">
          <h1>{showSettings ? 'Settings' : 'Details'}</h1>
          <div style={{ display: 'flex', gap: 6 }}>
            {selected && (
              <button className="fm-iconbtn" title={showSettings ? 'Show details' : 'Show settings'} onClick={() => setShowSettings((s) => !s)} type="button">
                <Icon name="settings" size={16}/>
              </button>
            )}
            <button
              className="fm-iconbtn"
              title="Close panel"
              onClick={() => { setShowSettings(false); setSelectedId(null); setSelectedTs(null); }}
              type="button"
            >
              <Icon name="x" size={16}/>
            </button>
          </div>
        </div>
      </div>
      <div className="fm-panel-body">
        {showSettings ? (
          <SettingsCard
            settings={settings}
            onChange={updateSettings}
            onTest={refreshAll}
            onImport={onImport}
            onExport={downloadExport}
            canExport={!isEmpty}
            isLoading={isLoading}
          />
        ) : selected ? (
          <>
            {error && (
              <ErrorBanner
                title={error.title}
                body={error.body}
                onRetry={() => error.accessoryId ? refreshOne(error.accessoryId) : refreshAll()}
                onDismiss={() => setError(null)}
              />
            )}
            <SelectedSummary
              accessory={selected}
              refreshing={isRefreshing && selected.id === refreshingId}
              busy={isLoading}
              onRefresh={() => refreshOne(selected.id)}
              onAccessoryChange={(patch) => updateAccessory(selected.id, patch)}
              onOpenMap={
                selected.history?.[0]
                  ? () => {
                      const h = selected.history![0];
                      window.open(
                        `https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lon}#map=18/${h.lat}/${h.lon}`,
                        '_blank',
                      );
                    }
                  : undefined
              }
            />
            {(selected.history?.length ?? 0) > 0 ? (
              <HistoryList
                accessory={selected}
                selectedTs={selectedTs}
                onPointSelect={(p: AccessoryHistoryEntry) => setSelectedTs(p.timestamp)}
              />
            ) : (
              <ErrorBanner
                title="No reports for this accessory"
                body="The endpoint returned no reports in the selected window. The accessory may be out of range, or try increasing the days to fetch."
                onRetry={() => refreshOne(selected.id)}
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="fm-app">
      {/* Desktop layout */}
      <div
        className="fm-desktop fm-desktop-only"
        style={{ gridTemplateColumns: selected || showSettings ? '320px 1fr 360px' : '320px 1fr' }}
      >
        {Sidebar}

        <div className="fm-center">
          <div className="topbar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <div className="eyebrow">Live tracking</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 600 }}>
                {selected ? selected.name : isEmpty ? 'Welcome back' : 'No accessory selected'}
              </div>
            </div>
            {isRefreshing && (
              <div style={{ flex: 1, maxWidth: 380 }}>
                <RefreshBar
                  current={progress.current}
                  total={progress.total}
                  currentName={accessories.find((a) => a.id === refreshingId)?.name}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {!selected && !showSettings && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowSettings(true)}
                  type="button"
                >
                  <Icon name="settings" size={14}/>
                  Settings
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={refreshAll}
                disabled={isRefreshing || isEmpty}
                type="button"
              >
                <Icon name="refresh" size={14}/>
                {isRefreshing ? 'Refreshing…' : 'Refresh all'}
              </button>
            </div>
          </div>
          <div className="map-wrap">
            {isEmpty ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <div style={{ maxWidth: 480, width: '100%' }}>
                  <EmptyImport onImport={onImport} error={importError}/>
                </div>
              </div>
            ) : selected && (selected.history?.length ?? 0) > 0 ? (
              <MapView
                accessory={selected}
                selectedTs={selectedTs}
                onPointSelect={(p) => setSelectedTs(p.timestamp)}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--duik-text-tertiary)' }}>
                <Icon name="pin" size={42}/>
                <div style={{ fontSize: 14 }}>{selected ? 'No reports for this accessory yet' : 'Select an accessory'}</div>
              </div>
            )}
          </div>
        </div>

        {(selected || showSettings) && RightPanel}
      </div>

      {/* Mobile layout */}
      <div className="fm-mobile fm-mobile-only">
        <div className="topbar">
          <h1>Macless <em style={{ fontFamily: 'var(--duik-font-family-display)', fontStyle: 'italic', fontWeight: 600, color: 'var(--duik-color-brand-purple)' }}>Haystack</em></h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label className="fm-iconbtn" title="Import accessories" style={{ width: 32, height: 32 }}>
              <Icon name="upload" size={14}/>
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                }}
              />
            </label>
            <button
              className={`fm-iconbtn ${isRefreshing ? 'spinning' : ''}`}
              onClick={refreshAll}
              disabled={isRefreshing || isEmpty}
              style={{ width: 32, height: 32 }}
              type="button"
            >
              <Icon name="refresh" size={14}/>
            </button>
          </div>
        </div>

        <div className="scroll">
          {isEmpty ? (
            <EmptyImport onImport={onImport} error={importError}/>
          ) : mobileTab === 'settings' ? (
            <SettingsCard
              settings={settings}
              onChange={updateSettings}
              onTest={refreshAll}
              onImport={onImport}
              onExport={downloadExport}
              canExport={!isEmpty}
              isLoading={isLoading}
            />
          ) : mobileTab === 'list' ? (
            <>
              <div className="eyebrow" style={{ padding: '0 4px' }}>
                {accessories.filter((a) => a.isActive).length} active · {accessories.length} total
              </div>
              <div className="acc-list">
                {accessories.map((acc) => (
                  <AccessoryRow
                    key={acc.id}
                    accessory={acc}
                    selected={acc.id === selectedId}
                    onSelect={() => {
                      setSelectedId((current) => current === acc.id ? null : acc.id);
                      setShowSettings(false);
                      setSelectedTs(null);
                      setMobileTab('map');
                    }}
                    refreshing={acc.id === refreshingId}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              {isRefreshing && (
                <RefreshBar
                  current={progress.current}
                  total={progress.total}
                  currentName={accessories.find((a) => a.id === refreshingId)?.name}
                />
              )}
              {error && (
                <ErrorBanner
                  title={error.title}
                  body={error.body}
                  onRetry={() => error.accessoryId ? refreshOne(error.accessoryId) : refreshAll()}
                  onDismiss={() => setError(null)}
                />
              )}
              {selected && (
                <SelectedSummary
                  accessory={selected}
                  refreshing={isRefreshing && selected.id === refreshingId}
                  busy={isLoading}
                  onRefresh={() => refreshOne(selected.id)}
                  onAccessoryChange={(patch) => updateAccessory(selected.id, patch)}
                  onOpenMap={
                    selected.history?.[0]
                      ? () => {
                          const h = selected.history![0];
                          window.open(
                            `https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lon}#map=18/${h.lat}/${h.lon}`,
                            '_blank',
                          );
                        }
                      : undefined
                  }
                />
              )}
              {selected && (selected.history?.length ?? 0) > 0 && (
                <div className="fm-map-card" style={{ height: 320 }}>
                  <div className="map-host" style={{ minHeight: 0 }}>
                    <MapView
                      accessory={selected}
                      selectedTs={selectedTs}
                      onPointSelect={(p) => setSelectedTs(p.timestamp)}
                    />
                  </div>
                </div>
              )}
              {selected && (selected.history?.length ?? 0) === 0 && (
                <ErrorBanner
                  title="No reports for this accessory"
                  body="Try refreshing, or check the days-to-fetch in settings."
                  onRetry={() => refreshOne(selected.id)}
                />
              )}
              {selected && (selected.history?.length ?? 0) > 0 && (
                <HistoryList
                  accessory={selected}
                  selectedTs={selectedTs}
                  onPointSelect={(p) => setSelectedTs(p.timestamp)}
                />
              )}
            </>
          )}
        </div>

        <div className="fm-mobile-tabbar">
          <button className={mobileTab === 'map' ? 'active' : ''} onClick={() => setMobileTab('map')} type="button">
            <Icon name="map" size={20} stroke={mobileTab === 'map' ? 2 : 1.75}/>
            Map
          </button>
          <button className={mobileTab === 'list' ? 'active' : ''} onClick={() => setMobileTab('list')} type="button">
            <Icon name="list" size={20} stroke={mobileTab === 'list' ? 2 : 1.75}/>
            Accessories
          </button>
          <button className={mobileTab === 'settings' ? 'active' : ''} onClick={() => setMobileTab('settings')} type="button">
            <Icon name="settings" size={20} stroke={mobileTab === 'settings' ? 2 : 1.75}/>
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
