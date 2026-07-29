export type AccessoryDTO = {
  id: number;
  colorComponents: number[];
  name: string;
  privateKey: string;
  icon: string;
  isActive: boolean;
  additionalKeys?: string[];
};

export type AccessoryHistoryEntry = {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: string;
  batteryStatus?: string;
};

export type Accessory = {
  id: string;
  name: string;
  privateKey: string;
  icon: string;
  isActive: boolean;
  color: string;
  additionalKeys: string[];
  lastSeen?: string;
  lat?: number;
  lon?: number;
  history?: AccessoryHistoryEntry[];
};

const STORAGE_KEY = 'airtag.accessories';
const SETTINGS_KEY = 'airtag.settings';

export type Settings = {
  endpoint: string;
  user: string;
  pass: string;
  days: number;
};

export function loadAccessories(): Accessory[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: Accessory[] = JSON.parse(raw);
    // Older payloads may have collided ids (every entry id="0") — re-key locally.
    const seen = new Set<string>();
    return parsed.map((item, index) => {
      const candidate = item.id || `${index}-${item.name || 'acc'}`;
      const id = seen.has(candidate) ? `${index}-${item.name || 'acc'}` : candidate;
      seen.add(id);
      return { ...item, id };
    });
  } catch {
    return [];
  }
}

export function saveAccessories(accessories: Accessory[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accessories));
}

export function loadSettings(): Settings {
  const defaults = {
    endpoint: '',
    user: '',
    pass: '',
    days: 7,
  };
  if (typeof localStorage === 'undefined') return defaults;
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function importAccessoriesJson(text: string): Accessory[] {
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map((item: AccessoryDTO, index: number) => ({
    id: `${index}-${item.name || 'acc'}`,
    name: item.name || `Accessory ${index + 1}`,
    privateKey: item.privateKey,
    icon: item.icon || 'mappin',
    isActive: item.isActive ?? true,
    color: colorFromComponents(item.colorComponents),
    additionalKeys: item.additionalKeys || [],
  }));
}

export function exportAccessoriesJson(accessories: Accessory[]) {
  return JSON.stringify(
    accessories.map((item) => ({
      id: Number(item.id) || 0,
      colorComponents: colorToComponents(item.color),
      name: item.name,
      privateKey: item.privateKey,
      icon: item.icon,
      isActive: item.isActive,
      additionalKeys: item.additionalKeys,
    })),
    null,
    2,
  );
}

function colorFromComponents(components?: number[]) {
  if (!components || components.length < 3) return '#64748b';
  const [r, g, b] = components.map((value) => Math.max(0, Math.min(255, Math.round(value * 255))));
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function colorToComponents(color: string) {
  let clean = color.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((value) => value + value).join('');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [
    Number.isFinite(r) ? r / 255 : 100 / 255,
    Number.isFinite(g) ? g / 255 : 116 / 255,
    Number.isFinite(b) ? b / 255 : 139 / 255,
    1,
  ];
}

function hex(value: number) {
  return value.toString(16).padStart(2, '0');
}
