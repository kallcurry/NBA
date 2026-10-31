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

async function request(path, { timeout = 18000, allowOffline = false } = {}) {
  if (!allowOffline && typeof navigator !== 'undefined' && navigator.onLine === false) {
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
const SEASON_CACHE = 'courtside:season:v2';
const SEASON_CACHE_TTL = 15 * 60 * 1000;
const SEASON_LABEL = `${Number(espn.SEASON) - 1}-${espn.SEASON.slice(-2)}`;
let seasonSnapshot = null;
let bundledSnapshotPromise = null;

function validSeason(data) {
  return data?.season === SEASON_LABEL && !data.partial &&
    Array.isArray(data.games) && data.games.length > 0;
}

// Both first-install APKs and returning users can render before the network.
// A snapshot is always labelled stale until a live request succeeds.
export async function loadSeasonSnapshot() {
  if (seasonSnapshot) return seasonSnapshot;
  const saved = readJSON(SEASON_CACHE);
  if (validSeason(saved?.data)) {
    seasonSnapshot = saved;
    return saved;
  }
  if (!STANDALONE) return null;
  if (!bundledSnapshotPromise) {
    bundledSnapshotPromise = request(`/assets/season-${espn.SEASON}.json`, { allowOffline: true })
      .then((data) => {
        if (!validSeason(data)) return null;
        seasonSnapshot = { savedAt: Date.parse(data.fetchedAt) || 0, data, bundled: true };
        return seasonSnapshot;
      })
      .catch(() => null);
  }
  return bundledSnapshotPromise;
}

export async function loadCachedDay(date) {
  const day = loadDaySnapshot(date);
  const snapshot = await loadSeasonSnapshot();
  if (day && (!snapshot || day.savedAt >= snapshot.savedAt)) return day;
  if (!snapshot) return day;
  // Don't infer an empty day beyond the snapshot's covered season.
  const first = espnDate(snapshot.data.firstGame);
  const last = espnDate(snapshot.data.lastGame);
  if (date < first || date > last) return day;
  const games = snapshot.data.games.filter((game) => espnDate(game.startTime) === date);
  return {
    savedAt: snapshot.savedAt, stale: true,
    day: {
      date, timezone: 'Asia/Shanghai', games, count: games.length,
      liveCount: games.filter((game) => game.status.state === 'in').length,
      season: { year: Number(espn.SEASON), displayName: SEASON_LABEL },
      source: 'ESPN', fetchedAt: snapshot.data.fetchedAt,
    },
  };
}

// Use the same Beijing-day conversion as the UI, including games around UTC midnight.
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});
function espnDate(iso) {
  return iso ? dateFormatter.format(new Date(iso)) : '';
}

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

async function streamServerSeason(onBatch) {
  let res;
  try {
    res = await fetch('/api/season-stream', {
      headers: { accept: 'application/x-ndjson' },
      signal: AbortSignal.timeout(120000),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('赛季数据流连接失败', 0);
  }
  if (!res.ok || !res.body) {
    throw new ApiError(`赛季数据流请求失败（${res.status}）`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = null;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.type === 'batch' && Array.isArray(message.games)) {
        onBatch?.(message.games, message);
      } else if (message.type === 'done') {
        done = message.data;
      } else if (message.type === 'error') {
        throw new ApiError(message.message || '赛季赛程加载失败', 0);
      }
    }
  }
  if (!done) throw new ApiError('赛季数据流提前中断', 0);
  return done;
}

export async function getSeasonSchedule({ force = false, onBatch = null, onSnapshot = null } = {}) {
  const snapshot = await loadSeasonSnapshot();
  if (!force && snapshot && !snapshot.bundled && Date.now() - snapshot.savedAt < SEASON_CACHE_TTL) {
    return typeof navigator !== 'undefined' && navigator.onLine === false
      ? { ...snapshot.data, stale: true }
      : snapshot.data;
  }
  if (snapshot) onSnapshot?.(snapshot.data);
  return memo(
    'season-schedule',
    SEASON_CACHE_TTL,
    async () => {
      const data = onBatch
        ? STANDALONE
          ? await espn.streamSeasonSchedule(onBatch)
          : await streamServerSeason(onBatch)
        : STANDALONE
          ? await espn.getSeasonSchedule()
          : await request('/api/season-schedule', { timeout: 120000 });
      if (data.partial) {
        // Never turn a failed/partial aggregation into a long-lived complete cache.
        throw new ApiError('部分球队赛程未能更新，请重试；当前保留已加载的赛程', 0);
      }
      if (!data.games?.length) throw new ApiError('赛季赛程为空，请稍后重试', 0);
      seasonSnapshot = { savedAt: Date.now(), data };
      try {
        // Reclaim the old large snapshot before writing v2 on WebView's quota.
        localStorage.removeItem('courtside:season:v1');
      } catch { /* storage may be disabled */ }
      writeJSON(SEASON_CACHE, seasonSnapshot);
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
