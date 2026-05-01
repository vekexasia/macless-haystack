import { sha256 } from '@noble/hashes/sha2.js';

type Point = { x: bigint; y: bigint } | null;

const P = BigInt('0xffffffffffffffffffffffffffffffff000000000000000000000001');
const A = P - 3n;
const B = BigInt('0xb4050a850c04b3abf54132565044b0b7d7bfd8ba270b39432355ffb4');
const GX = BigInt('0xb70e0cbd6bb4bf7f321390b94a03c1d356c21122343280d6115c1d21');
const GY = BigInt('0xbd376388b5f723fb4c22dfe6cd4375a05a07476444d5819985007e34');
const G: Point = { x: GX, y: GY };
const APPLE_EPOCH = Date.UTC(2001, 0, 1);
const POINT_CORRECTION = 0xffffffff / 10000000;

export type LocationReport = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  confidence: number;
  batteryStatus?: 'ok' | 'medium' | 'low' | 'criticalLow';
};

export type KeyMaterial = {
  privateKeyBase64: string;
  privateScalar: bigint;
  advertisementKeyBase64: string;
  hashedAdvertisementKey: string;
};

export function deriveKeyMaterial(privateKeyBase64: string): KeyMaterial {
  const privateBytes = base64ToBytes(privateKeyBase64);
  const privateScalar = bytesToBigInt(privateBytes);
  const publicKey = scalarMult(privateScalar, G);
  if (!publicKey) throw new Error('Invalid private key');
  const advertisementKey = bigIntToBytes(publicKey.x, 28);
  return {
    privateKeyBase64,
    privateScalar,
    advertisementKeyBase64: bytesToBase64(advertisementKey),
    hashedAdvertisementKey: bytesToBase64(sha256(advertisementKey)),
  };
}

export async function fetchAndDecryptReports(args: {
  endpoint: string;
  user: string;
  pass: string;
  days: number;
  privateKeys: string[];
}): Promise<LocationReport[]> {
  const materials = args.privateKeys.map(deriveKeyMaterial);
  const byId = new Map(materials.map((item) => [item.hashedAdvertisementKey, item]));
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (args.user || args.pass) headers.Authorization = `Basic ${btoa(`${args.user}:${args.pass}`)}`;

  const response = await fetch(args.endpoint, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ ids: materials.map((item) => item.hashedAdvertisementKey), days: args.days }),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${(await response.text()).slice(0, 200)}`);

  const json = await response.json();
  const rows = Array.isArray(json.results) ? json.results : [];
  const reports: LocationReport[] = [];
  for (const row of rows) {
    const material = byId.get(row.id);
    if (!material) continue;
    reports.push(await decryptReport(row.payload, row.id, Number(row.statusCode), material.privateScalar));
  }
  reports.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return reports;
}

async function decryptReport(payloadBase64: string, id: string, _statusCode: number, privateScalar: bigint): Promise<LocationReport> {
  let payload = base64ToBytes(payloadBase64);
  if (payload.length > 88) {
    const modified = new Uint8Array(payload.length - 1);
    modified.set(payload.slice(0, 4), 0);
    modified.set(payload.slice(5), 4);
    payload = modified;
  }

  const seenTimestamp = readInt32BE(payload, 0);
  const timestamp = new Date(APPLE_EPOCH + seenTimestamp * 1000).toISOString();
  const confidence = payload[4];
  const ephemeralKeyBytes = payload.slice(5, 62);
  const encData = payload.slice(62, 72);
  const tag = payload.slice(72);
  const ephemeralPoint = decodeUncompressedPoint(ephemeralKeyBytes);
  const shared = scalarMult(privateScalar, ephemeralPoint);
  if (!shared) throw new Error('Invalid shared key');
  const sharedKeyBytes = bigIntToBytes(shared.x, 28);
  const derived = kdf(sharedKeyBytes, ephemeralKeyBytes);
  const plain = await decryptAesGcm(encData, derived.slice(0, 16), derived.slice(16), tag);

  let latitude = readUint32BE(plain, 0) / 10000000;
  let longitude = readUint32BE(plain, 4) / 10000000;
  if (latitude > 90) latitude -= POINT_CORRECTION;
  if (latitude < -90) latitude += POINT_CORRECTION;
  if (longitude > 180) longitude -= POINT_CORRECTION;
  if (longitude < -180) longitude += POINT_CORRECTION;
  const accuracy = plain[8];
  const status = plain[9];
  let batteryStatus: LocationReport['batteryStatus'];
  if ((status & 0b00100000) !== 0 || status > 0) {
    batteryStatus = (['ok', 'medium', 'low', 'criticalLow'] as const)[status >> 6];
  }
  return { id, latitude, longitude, accuracy, timestamp, confidence, batteryStatus };
}

function kdf(secret: Uint8Array, ephemeralKey: Uint8Array) {
  const counter = new Uint8Array([0, 0, 0, 1]);
  const input = new Uint8Array(secret.length + counter.length + ephemeralKey.length);
  input.set(secret, 0);
  input.set(counter, secret.length);
  input.set(ephemeralKey, secret.length + counter.length);
  return sha256(input);
}

async function decryptAesGcm(cipherText: Uint8Array, keyBytes: Uint8Array, iv: Uint8Array, tag: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', copyBuffer(keyBytes), 'AES-GCM', false, ['decrypt']);
  const data = new Uint8Array(cipherText.length + tag.length);
  data.set(cipherText, 0);
  data.set(tag, cipherText.length);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: copyBuffer(iv), tagLength: tag.length * 8 }, key, copyBuffer(data));
  return new Uint8Array(plain);
}

function decodeUncompressedPoint(bytes: Uint8Array): Point {
  if (bytes.length !== 57 || bytes[0] !== 4) throw new Error('Invalid P-224 point');
  return { x: bytesToBigInt(bytes.slice(1, 29)), y: bytesToBigInt(bytes.slice(29, 57)) };
}

function scalarMult(k: bigint, point: Point): Point {
  let n = k;
  let p = point;
  let result: Point = null;
  while (n > 0n) {
    if (n & 1n) result = pointAdd(result, p);
    p = pointAdd(p, p);
    n >>= 1n;
  }
  return result;
}

function pointAdd(p: Point, q: Point): Point {
  if (!p) return q;
  if (!q) return p;
  if (p.x === q.x && mod(p.y + q.y) === 0n) return null;
  const m = p.x === q.x && p.y === q.y
    ? mod((3n * p.x * p.x + A) * invMod(2n * p.y))
    : mod((q.y - p.y) * invMod(q.x - p.x));
  const x = mod(m * m - p.x - q.x);
  const y = mod(m * (p.x - x) - p.y);
  return { x, y };
}

function invMod(a: bigint) {
  let lm = 1n, hm = 0n;
  let low = mod(a), high = P;
  while (low > 1n) {
    const r = high / low;
    [lm, hm] = [hm - lm * r, lm];
    [low, high] = [high - low * r, low];
  }
  return mod(lm);
}

function mod(a: bigint) {
  const out = a % P;
  return out >= 0n ? out : out + P;
}

function copyBuffer(bytes: Uint8Array) {
  return bytes.slice().buffer;
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

function readInt32BE(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getInt32(0, false);
}

function base64ToBytes(base64: string) {
  const bin = atob(base64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

function bytesToBigInt(bytes: Uint8Array) {
  return BigInt(`0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`);
}

function bigIntToBytes(value: bigint, length: number) {
  let hex = value.toString(16).padStart(length * 2, '0');
  if (hex.length > length * 2) hex = hex.slice(-length * 2);
  return Uint8Array.from(hex.match(/../g)!.map((byte) => parseInt(byte, 16)));
}
