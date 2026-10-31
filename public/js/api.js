/* API client with small in-memory caches and an offline day snapshot. */
import * as espn from './espn-client.js';

const STANDALONE =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('standalone');

const MEMORY_TTL = {
  day: 7000,
  game: 7000,
  teams: 30 * 60 * 1000,
  standings: 3 * 60 * 1000,
  teamSchedule: 3 * 60 * 1000,
  news: 2 * 60 * 1000,
  calendar: 30 * 60 * 1000,
};

const memory = new Map();
const pending = new Map();

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { timeout = 18000 } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('当前处于离线状态', 0);
  }
  let res;
  try {
    res = await fetch(path, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeout),
      cache: 'no-store',
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new ApiError('数据源响应超时，请稍后重试', 0);
    }
    throw new ApiError('网络连接失败，请检查网络', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new ApiError('数据源返回了无法解析的内容', res.status);
  }
  if (!res.ok || data?.error) {
    throw new ApiError(data?.message || `请求失败（${res.status}）`, res.status);
  }
  return data;
}

function memo(key, ttl, producer, force = false) {
  const hit = memory.get(key);
  if (!force && hit && hit.expires > Date.now()) return Promise.resolve(hit.value);
  if (pending.has(key)) return pending.get(key);
  const p = producer()
    .then((value) => {
      memory.set(key, { value, expires: Date.now() + ttl });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

/* ------------------------------------------------------------------ */
/* day snapshots                                                       */
/* ------------------------------------------------------------------ */
const DAY_PREFIX = 'courtside:day:';
const DAY_INDEX = 'courtside:day-index';
const SEASON_CACHE = 'courtside:season:v1';
const SEASON_CACHE_TTL = 12 * 60 * 60 * 1000;

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be full or disabled — not fatal */
  }
}

function rememberDay(day) {
  if (!day?.date) return;
  writeJSON(`${DAY_PREFIX}${day.date}`, { savedAt: Date.now(), day });
  const index = readJSON(DAY_INDEX) || [];
  const next = [day.date, ...index.filter((d) => d !== day.date)].slice(0, 12);
  writeJSON(DAY_INDEX, next);
  for (const old of index.slice(11)) {
    try {
      localStorage.removeItem(`${DAY_PREFIX}${old}`);
    } catch {
      /* ignore */
    }
  }
}

export function loadDaySnapshot(date) {
  const saved = readJSON(`${DAY_PREFIX}${date}`);
  return saved ? { day: saved.day, savedAt: saved.savedAt, stale: true } : null;
}

export function latestDaySnapshot() {
  const index = readJSON(DAY_INDEX) || [];
  for (const date of index) {
    const saved = readJSON(`${DAY_PREFIX}${date}`);
    if (saved) return { day: saved.day, savedAt: saved.savedAt, stale: true };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* public calls                                                        */
/* ------------------------------------------------------------------ */
export function getScoreboard(date, { force = false } = {}) {
  return memo(
    `day:${date}`,
    MEMORY_TTL.day,
    async () => {
      const day = STANDALONE
        ? await espn.getDay(date)
        : await request(`/api/scoreboard?date=${encodeURIComponent(date)}&_=${Date.now()}`);
      rememberDay(day);
      return day;
    },
    force,
  );
}

export function getGame(id, { force = false } = {}) {
  return memo(
    `game:${id}`,
    MEMORY_TTL.game,
    () =>
      STANDALONE
        ? espn.getGame(id)
        : request(`/api/game?id=${encodeURIComponent(id)}&_=${Date.now()}`),
    force,
  );
}

export function getTeams() {
  return memo('teams', MEMORY_TTL.teams, () => (STANDALONE ? espn.getTeams() : request('/api/teams')));
}

export function getStandings() {
  return memo('standings', MEMORY_TTL.standings, () =>
    STANDALONE ? espn.getStandings() : request('/api/standings'),
  );
}

export function getTeamSchedule(teamId) {
  return memo(
    `team-schedule:${teamId}`,
    MEMORY_TTL.teamSchedule,
    () =>
      STANDALONE
        ? espn.getTeamSchedule(teamId)
        : request(`/api/team-schedule?team=${encodeURIComponent(teamId)}`),
  );
}

export function getNews() {
  return memo('news', MEMORY_TTL.news, () => (STANDALONE ? espn.getNews() : request('/api/news')));
}

export function getCalendar() {
  return memo('calendar', MEMORY_TTL.calendar, () =>
    STANDALONE ? espn.getCalendar() : request('/api/calendar'),
  );
}

export function getSeasonSchedule({ force = false } = {}) {
  if (!force) {
    const saved = readJSON(SEASON_CACHE);
    if (
      saved?.savedAt &&
      Date.now() - saved.savedAt < SEASON_CACHE_TTL &&
      Array.isArray(saved.data?.games) &&
      saved.data.games.length
    ) {
      return Promise.resolve(saved.data);
    }
  }
  return memo(
    'season-schedule',
    60 * 60 * 1000,
    async () => {
      const data = STANDALONE
        ? await espn.getSeasonSchedule()
        : await request('/api/season-schedule', { timeout: 120000 });
      writeJSON(SEASON_CACHE, { savedAt: Date.now(), data });
      return data;
    },
    force,
  );
}

export { STANDALONE };

export function seedMemoryDay(day) {
  if (!day?.date) return;
  memory.set(`day:${day.date}`, { value: day, expires: Date.now() + MEMORY_TTL.day });
}
