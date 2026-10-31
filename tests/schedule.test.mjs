import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beijingDateOf, fmtTime, WATCH_SOURCES } from '../public/js/data.js';
// These renderers register document listeners, but don't need a DOM to render.
globalThis.document = { addEventListener() {} };
const { renderGuide } = await import('../public/js/views/guide.js');
const { renderWatchSheet } = await import('../public/js/components/game-detail.js');

const snapshot = JSON.parse(await readFile(new URL('../public/assets/season-2027.json', import.meta.url)));
let sequence = 0;
const freshESPN = () => import(`../public/js/espn-client.js?test=${sequence++}`);
const freshAPI = () => import(`../public/js/api.js?test=${sequence++}`);
const json = (data) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function rawEvent(id, date) {
  return {
    id, date, seasonType: { name: 'Regular Season' },
    status: { type: { state: 'pre' } },
    competitions: [{ competitors: [
      { homeAway: 'home', team: { id: '1', abbreviation: 'BOS', name: 'Celtics' } },
      { homeAway: 'away', team: { id: '2', abbreviation: 'LAL', name: 'Lakers' } },
    ] }],
  };
}

function storage(t, initial = {}) {
  const values = new Map(Object.entries(initial));
  setGlobal(t, 'localStorage', {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
  setGlobal(t, 'location', { search: '?standalone=1' });
  return values;
}

function setGlobal(t, key, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, key, original);
    else delete globalThis[key];
  });
}

test('bundled season has 1200 unique, ordered ESPN games and valid cache metadata', () => {
  assert.equal(snapshot.season, '2026-27');
  assert.equal(snapshot.count, 1200);
  assert.equal(new Set(snapshot.games.map((g) => g.id)).size, snapshot.count);
  assert.ok(!snapshot.partial);
  assert.ok(Number.isFinite(Date.parse(snapshot.fetchedAt)));
  assert.ok(snapshot.games.every((g, i, a) => /^\d{4,12}$/.test(g.id) && g.home.id && g.away.id &&
    g.phase === 'regular' && (!i || Date.parse(a[i - 1].startTime) <= Date.parse(g.startTime))));
});

test('Beijing day conversion handles UTC midnight and the +08:00 boundary', () => {
  assert.equal(beijingDateOf('2026-10-31T15:59:59Z'), '2026-10-31');
  assert.equal(beijingDateOf('2026-10-31T16:00:00Z'), '2026-11-01');
  assert.equal(fmtTime('2026-10-31T16:01:00Z'), '00:01');
});

test('day requests deduplicate overlapping dates and filter by Beijing date', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    await delay(5);
    return json({ events: [rawEvent('10001', '2026-10-31T16:01:00Z'), rawEvent('10002', '2026-10-31T15:59:00Z')] });
  });
  const espn = await freshESPN();
  const [november, october] = await Promise.all([espn.getDay('2026-11-01'), espn.getDay('2026-10-31')]);
  assert.equal(calls.length, 3);
  assert.deepEqual(november.games.map((g) => g.id), ['10001']);
  assert.deepEqual(october.games.map((g) => g.id), ['10002']);
});

test('season starts from team schedules without a blocking scoreboard preview', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    if (url.includes('/standings')) return json({ children: [{ standings: { entries: [
      { team: { id: '1', abbreviation: 'BOS', displayName: 'Boston Celtics' } },
      { team: { id: '2', abbreviation: 'LAL', displayName: 'Los Angeles Lakers' } },
    ] } }] });
    return json({ events: [rawEvent('10001', '2026-10-31T23:00:00Z')] });
  });
  const espn = await freshESPN();
  const season = await espn.getSeasonSchedule();
  assert.equal(calls.length, 3);
  assert.ok(calls.every((url) => !url.includes('/scoreboard')));
  assert.equal(season.count, 1);
  assert.equal(season.partial, false);
});

test('one failed date request cannot replace a complete cached day with an empty result', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.includes('20261101')) throw new Error('timeout');
    return json({ events: [] });
  });
  const espn = await freshESPN();
  await assert.rejects(espn.getDay('2026-11-02'), /完整更新/);
});

test('first-install offline APK can read its local season and day snapshot', async (t) => {
  storage(t);
  setGlobal(t, 'navigator', { onLine: false });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    assert.equal(url, '/assets/season-2027.json');
    return json(snapshot);
  });
  const api = await freshAPI();
  const date = beijingDateOf(snapshot.games[0].startTime);
  const [season, day] = await Promise.all([api.loadSeasonSnapshot(), api.loadCachedDay(date)]);
  assert.equal(season.data.count, 1200);
  assert.ok(day.day.games.length > 0);
  assert.ok(day.day.games.every((g) => beijingDateOf(g.startTime) === date));
  assert.equal(day.stale, true);
  assert.equal(calls.length, 1);
  assert.equal(await api.loadCachedDay('2030-01-01'), null);
});

test('newer day cache takes precedence over bundled season scores', async (t) => {
  const date = beijingDateOf(snapshot.games[0].startTime);
  const day = { date, games: [{ id: 'recent-score' }] };
  storage(t, { [`courtside:day:${date}`]: JSON.stringify({ savedAt: Date.now() + 1000, day }) });
  t.mock.method(globalThis, 'fetch', async () => json(snapshot));
  const api = await freshAPI();
  assert.deepEqual((await api.loadCachedDay(date)).day, day);
});

test('stale season is delivered before a failing network refresh', async (t) => {
  const old = { ...snapshot, fetchedAt: '2026-10-01T00:00:00Z' };
  storage(t, { 'courtside:season:v2': JSON.stringify({ savedAt: 1, data: old }) });
  let shown = false;
  t.mock.method(globalThis, 'fetch', async () => {
    assert.equal(shown, true);
    throw new TypeError('offline');
  });
  const api = await freshAPI();
  await assert.rejects(api.getSeasonSchedule({ force: true, onSnapshot: (data) => {
    assert.equal(data.count, 1200);
    shown = true;
  } }));
  assert.equal(shown, true);
});

test('failed team requests cannot poison the complete season cache', async (t) => {
  const values = storage(t);
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.startsWith('/assets/')) return json(snapshot);
    if (url.includes('/standings')) return json({ children: [{ standings: { entries: [
      { team: { id: '1', abbreviation: 'BOS', displayName: 'Boston Celtics' } },
      { team: { id: '2', abbreviation: 'LAL', displayName: 'Los Angeles Lakers' } },
    ] } }] });
    if (url.includes('/teams/2/')) throw new Error('timeout');
    return json({ events: [rawEvent('10001', '2026-10-31T23:00:00Z')] });
  });
  const api = await freshAPI();
  await assert.rejects(api.getSeasonSchedule({ force: true, onBatch() {} }), /部分球队/);
  assert.equal(values.has('courtside:season:v2'), false);
});

test('both configured sources are available in the guide and game watch sheet', () => {
  for (const html of [renderGuide(), renderWatchSheet(snapshot.games[0])]) {
    for (const source of WATCH_SOURCES) {
      assert.ok(html.includes(`href="${source.url}"`));
      assert.ok(html.includes(`data-watch-source="${source.id}"`));
    }
    assert.ok(!html.includes('不提供任何非官方直播源'));
  }
});
