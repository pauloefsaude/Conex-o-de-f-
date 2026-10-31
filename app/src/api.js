import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// No celular, "localhost" é o próprio celular. Defina EXPO_PUBLIC_API_URL=http://IP-DO-COMPUTADOR:4000
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000').replace(/\/$/, '');

const KEY = 'cf_session';
let token = null;

export const session = {
  async load() {
    try {
      token = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    } catch { token = null; }
    return token;
  },
  async save(t) {
    token = t;
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, t);
    else await SecureStore.setItemAsync(KEY, t);
  },
  async clear() {
    token = null;
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  },
  get token() { return token; },
};

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body } = {}) {
  let r;
  try {
    r = await fetch(API_URL + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Sem conexão com o servidor. Verifique sua internet e tente de novo.', 0, 'network');
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && token) onUnauthorized();
  if (!r.ok) throw new ApiError(data.error || 'Algo deu errado. Tente novamente.', r.status, data.code);
  return data;
}

// Tempo real: o servidor só empurra eventos; o envio de mensagens é pela API.
export function connectRealtime(onEvent) {
  if (!token) return () => {};
  let ws, closed = false, retry = 1000;
  const open = () => {
    ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`);
    ws.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch {} };
    ws.onopen = () => { retry = 1000; };
    ws.onclose = () => { if (!closed) setTimeout(open, (retry = Math.min(retry * 2, 30000))); };
  };
  open();
  return () => { closed = true; ws?.close(); };
}
