// Safe wrappers around localStorage. It can throw (private mode, blocked
// site data), and a storage problem must never break the game.

export function load(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try { localStorage.setItem(key, String(value)); } catch {}
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch {}
}

export function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  save(key, JSON.stringify(value));
}
