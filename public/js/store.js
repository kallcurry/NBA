/* Persisted user preferences: favorites, reminders, notification settings. */

const KEY = 'courtside:prefs:v1';

const DEFAULTS = {
  favorites: [],
  settings: {
    notificationsEnabled: false,
    lead: 15,
    start: true,
    final: true,
    close: false,
    refresh: 20,
  },
  reminders: {},
  notified: {},
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((x) => typeof x === 'string') : [],
      settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
      reminders: parsed.reminders && typeof parsed.reminders === 'object' ? parsed.reminders : {},
      notified: parsed.notified && typeof parsed.notified === 'object' ? parsed.notified : {},
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

const state = load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error(err);
    }
  }
}

export const store = {
  get favorites() {
    return state.favorites;
  },
  get settings() {
    return state.settings;
  },
  get reminders() {
    return state.reminders;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  isFavorite(abbr) {
    return state.favorites.includes(abbr);
  },

  toggleFavorite(abbr) {
    if (!abbr) return false;
    const idx = state.favorites.indexOf(abbr);
    if (idx >= 0) state.favorites.splice(idx, 1);
    else state.favorites.push(abbr);
    persist();
    return state.favorites.includes(abbr);
  },

  setFavorite(abbr, on) {
    if (!abbr) return;
    const has = state.favorites.includes(abbr);
    if (on && !has) state.favorites.push(abbr);
    if (!on && has) state.favorites.splice(state.favorites.indexOf(abbr), 1);
    persist();
  },

  updateSettings(patch) {
    Object.assign(state.settings, patch);
    persist();
  },

  hasReminder(gameId) {
    return Boolean(state.reminders[gameId]);
  },

  addReminder(gameId, date, meta = {}) {
    if (!gameId) return;
    state.reminders[gameId] = { date, createdAt: Date.now(), ...meta };
    persist();
  },

  removeReminder(gameId) {
    delete state.reminders[gameId];
    persist();
  },

  toggleReminder(gameId, date, meta = {}) {
    if (state.reminders[gameId]) this.removeReminder(gameId);
    else this.addReminder(gameId, date, meta);
    return Boolean(state.reminders[gameId]);
  },

  upcomingReminderIds() {
    return Object.entries(state.reminders)
      .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0))
      .map(([id]) => id);
  },

  wasNotified(key) {
    return Boolean(state.notified[key]);
  },

  markNotified(key) {
    state.notified[key] = Date.now();
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
    for (const [k, v] of Object.entries(state.notified)) {
      if (v < cutoff) delete state.notified[k];
    }
    persist();
  },

  clearNotified() {
    state.notified = {};
    persist();
  },

  clearAll() {
    state.favorites = [];
    state.settings = structuredClone(DEFAULTS.settings);
    state.reminders = {};
    state.notified = {};
    persist();
  },
};
