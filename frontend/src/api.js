import { SESSION_STORAGE_KEY } from './context/SessionContext.jsx';
import { demoFetch, isDemo } from './demo.js';

const BASE = '/api';

function actingStaffHeaders() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return {};
    const s = JSON.parse(raw);
    const id = s.staff?.id;
    if (id == null) return {};
    return { 'X-Acting-Staff-Id': String(id) };
  } catch {
    return {};
  }
}

async function request(path, { method = 'GET', body, query } = {}) {
  if (isDemo) {
    return demoFetch(method, path, body, query);
  }

  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }

  const init = {
    method,
    headers: { 'Content-Type': 'application/json', ...actingStaffHeaders() },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url.pathname + url.search, init);
  const text = await response.text();
  const data = text ? safeJSON(text) : null;

  if (!response.ok) {
    const detail = data?.detail || response.statusText || 'Request failed';
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return data;
}

function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: (path, query) => request(path, { method: 'GET', query }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};
