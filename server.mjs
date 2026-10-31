#!/usr/bin/env node
/**
 * COURTSIDE / 场边 — local NBA companion server.
 * Zero-dependency static server + caching proxy for ESPN's public NBA API.
 */
import http from 'node:http';
import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '127.0.0.1';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports/basketball/nba';
const SEASON = process.env.NBA_SEASON || '2027';
const TZ = 'Asia/Shanghai';
const DATA_DIR = path.join(__dirname, 'data');
const PREFS_FILE = path.join(DATA_DIR, 'preferences.json');
const NOTIFY_ICON = path.join(PUBLIC_DIR, 'assets/icon-192.png');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/* ------------------------------------------------------------------ */
/* tiny TTL cache with in-flight de-duplication                        */
/* ------------------------------------------------------------------ */
const cache = new Map();
const inflight = new Map();

function cached(key, ttl, producer) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return Promise.resolve(hit.value);
  if (inflight.has(key)) return inflight.get(key);
  const p = producer()
    .then((value) => {
      cache.set(key, { value, expires: Date.now() + ttl });
      if (cache.size > 240) {
        for (const [k, v] of cache) if (v.expires < Date.now()) cache.delete(k);
      }
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function getJSON(url, { timeout = 14000, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': 'Courtside/1.0 (personal NBA dashboard)',
        },
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) throw new Error(`ESPN responded ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

/* ------------------------------------------------------------------ */
/* date helpers — the app's "day" is always a Beijing calendar day     */
/* ------------------------------------------------------------------ */
function beijingDate(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function compact(dateStr) {
  return dateStr.replaceAll('-', '');
}

function todayBeijing() {
  return beijingDate(new Date().toISOString());
}

function formatBeijingTime(iso) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/* ------------------------------------------------------------------ */
/* ESPN normalizers                                                    */
/* ------------------------------------------------------------------ */
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function teamLogo(team) {
  return (
    team?.logo ||
    team?.logos?.find?.((l) => l.rel?.includes('default'))?.href ||
    team?.logos?.[0]?.href ||
    null
  );
}

function normalizeStatus(status = {}) {
  const type = status.type || {};
  return {
    state: type.state || 'pre',
    completed: Boolean(type.completed),
    period: num(status.period),
    clock: status.displayClock || '0:00',
    typeName: type.name || '',
    description: type.description || '',
    detail: type.detail || '',
    shortDetail: type.shortDetail || '',
    isHalftime: type.name === 'STATUS_HALFTIME' || /halftime/i.test(type.description || ''),
  };
}

function normalizeCompetitor(c) {
  const team = c.team || {};
  const overall = c.records?.find((r) => r.type === 'total' || r.name === 'overall');
  return {
    id: String(team.id || c.id || ''),
    abbr: team.abbreviation || '',
    name: team.name || team.shortDisplayName || '',
    displayName: team.displayName || team.name || '',
    location: team.location || '',
    logo: teamLogo(team),
    color: `#${(team.color || '888888').replace('#', '')}`,
    altColor: `#${(team.alternateColor || team.color || '888888').replace('#', '')}`,
    score: num(typeof c.score === 'object' && c.score !== null ? c.score.value ?? c.score.displayValue : c.score),
    record: overall?.summary || '',
    winner: Boolean(c.winner),
    homeAway: c.homeAway,
    linescores: (c.linescores || []).map((l, index) => ({
      period: num(l.period) || index + 1,
      value: num(l.value ?? l.displayValue),
      display: l.displayValue ?? String(l.value ?? ''),
    })),
    seed: c.curatedRank?.current ?? null,
  };
}

function normalizeBroadcasts(comp = {}) {
  const seen = new Map();
  const add = (name, market, kind) => {
    if (!name) return;
    const key = String(name).trim();
    if (!key || seen.has(key.toLowerCase())) return;
    seen.set(key.toLowerCase(), {
      name: key,
      market: market || 'national',
      kind: kind || 'TV',
      national: String(market || '').toLowerCase() === 'national',
    });
  };
  for (const b of comp.broadcasts || []) {
    for (const name of b.names || []) add(name, b.market, 'TV');
  }
  for (const b of comp.geoBroadcasts || []) {
    add(b.media?.shortName, b.market?.type || b.market?.id || 'national', b.type?.shortName || 'TV');
  }
  return [...seen.values()].sort((a, b) => Number(b.national) - Number(a.national));
}

function normalizeVenue(comp = {}) {
  const v = comp.venue || {};
  const addr = v.address || {};
  return {
    name: v.fullName || '',
    city: addr.city || '',
    state: addr.state || '',
    indoor: v.indoor ?? true,
  };
}

function normalizeOdds(odds) {
  const o = Array.isArray(odds) ? odds[0] : odds;
  if (!o) return null;
  return {
    provider: o.provider?.name || '',
    details: o.details || '',
    overUnder: o.overUnder ?? null,
    homeMoneyLine: o.homeTeamOdds?.moneyLine ?? null,
    awayMoneyLine: o.awayTeamOdds?.moneyLine ?? null,
    homeSpread: o.homeTeamOdds?.spreadOdds ?? null,
    awaySpread: o.awayTeamOdds?.spreadOdds ?? null,
  };
}

function normalizeEvent(event) {
  const comp = event.competitions?.[0] || {};
  const home = comp.competitors?.find((c) => c.homeAway === 'home');
  const away = comp.competitors?.find((c) => c.homeAway === 'away');
  if (!home || !away) return null;
  const broadcasts = normalizeBroadcasts(comp);
  return {
    id: String(event.id || comp.id || ''),
    date: event.date || comp.date,
    startTime: event.date || comp.date,
    name: event.name || comp.name || '',
    shortName: event.shortName || '',
    seasonType: event.seasonType?.name || '',
    week: event.week?.number ?? null,
    status: normalizeStatus(event.status || comp.status),
    away: normalizeCompetitor(away),
    home: normalizeCompetitor(home),
    venue: normalizeVenue(comp),
    broadcasts,
    nationalTV: broadcasts.some((b) => b.national),
    neutralSite: Boolean(comp.neutralSite),
    note: comp.notes?.[0]?.headline || '',
    odds: normalizeOdds(comp.odds),
    link: `https://www.espn.com/nba/game/_/gameId/${event.id}`,
  };
}

function sortGames(a, b) {
  return new Date(a.startTime) - new Date(b.startTime);
}

async function scoreboardForEspnDate(dateStr) {
  const key = `sb:${dateStr}`;
  return cached(key, 9000, async () => {
    const url = `${ESPN}/scoreboard?dates=${compact(dateStr)}`;
    const data = await getJSON(url);
    return data;
  });
}

async function getDay(dateStr) {
  const [prev, current] = await Promise.allSettled([
    scoreboardForEspnDate(addDays(dateStr, -1)),
    scoreboardForEspnDate(dateStr),
  ]);
  const raws = [];
  for (const result of [prev, current]) {
    if (result.status === 'fulfilled') raws.push(result.value);
  }
  if (!raws.length) {
    const err = new Error('无法连接 NBA 数据源');
    err.statusCode = 502;
    throw err;
  }
  const seen = new Set();
  const games = [];
  for (const raw of raws) {
    for (const event of raw.events || []) {
      if (!event?.date || seen.has(String(event.id))) continue;
      if (beijingDate(event.date) !== dateStr) continue;
      const game = normalizeEvent(event);
      if (!game) continue;
      seen.add(game.id);
      games.push(game);
    }
  }
  games.sort(sortGames);
  const league = raws.map((r) => r.leagues?.[0]).find(Boolean) || {};
  return {
    date: dateStr,
    timezone: TZ,
    games,
    count: games.length,
    liveCount: games.filter((g) => g.status.state === 'in').length,
    season: league.season
      ? {
          year: league.season.year,
          displayName: league.season.displayName,
          type: league.season.type?.name || '',
        }
      : null,
    source: 'ESPN',
    fetchedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* game summary                                                        */
/* ------------------------------------------------------------------ */
function statMap(teamStats = []) {
  const map = {};
  for (const s of teamStats) {
    map[s.name] = s.displayValue ?? String(s.value ?? '');
  }
  return map;
}

function normalizeBoxTeam(t) {
  return {
    id: String(t.team?.id || ''),
    abbr: t.team?.abbreviation || '',
    displayName: t.team?.displayName || '',
    logo: teamLogo(t.team),
    stats: statMap(t.statistics),
  };
}

function normalizePlayers(teamBlock) {
  const groups = teamBlock.statistics || [];
  const group = groups[0];
  if (!group) {
    return { teamId: String(teamBlock.team?.id || ''), abbr: teamBlock.team?.abbreviation || '', labels: [], athletes: [], totals: [] };
  }
  const labels = group.labels || [];
  const athletes = (group.athletes || []).map((a) => {
    const athlete = a.athlete || {};
    const values = {};
    labels.forEach((label, i) => {
      values[label] = a.stats?.[i] ?? '—';
    });
    return {
      id: String(athlete.id || ''),
      name: athlete.displayName || athlete.fullName || '',
      shortName: athlete.shortName || athlete.displayName || '',
      jersey: athlete.jersey || '',
      position: athlete.position?.abbreviation || '',
      starter: Boolean(a.starter),
      didNotPlay: Boolean(a.didNotPlay),
      headshot: athlete.headshot?.href || null,
      stats: values,
    };
  });
  const totals = {};
  labels.forEach((label, i) => {
    totals[label] = group.totals?.[i] ?? '';
  });
  return {
    teamId: String(teamBlock.team?.id || ''),
    abbr: teamBlock.team?.abbreviation || '',
    displayName: teamBlock.team?.displayName || '',
    labels,
    athletes,
    totals,
  };
}

function normalizePlay(p) {
  return {
    id: String(p.id || ''),
    sequence: num(p.sequenceNumber),
    text: p.text || '',
    clock: p.clock?.displayValue || '',
    period: num(p.period?.number),
    periodLabel: p.period?.displayValue || '',
    awayScore: num(p.awayScore),
    homeScore: num(p.homeScore),
    scoring: Boolean(p.scoringPlay),
    scoreValue: num(p.scoreValue),
    teamId: String(p.team?.id || ''),
    type: p.type?.text || '',
    wallclock: p.wallclock || null,
    shootingPlay: Boolean(p.shootingPlay),
  };
}

function normalizeInjuries(blocks = []) {
  return blocks
    .map((block) => ({
      teamId: String(block.team?.id || ''),
      abbr: block.team?.abbreviation || '',
      players: (block.injuries || []).map((i) => ({
        name: i.athlete?.displayName || i.athlete?.fullName || '',
        shortName: i.athlete?.shortName || '',
        headshot: i.athlete?.headshot?.href || null,
        status: i.status || '',
        date: i.date || null,
        type: i.details?.type || i.type?.name || '',
        detail: i.details?.detail || '',
        side: i.details?.side || '',
        returnDate: i.details?.returnDate || '',
      })),
    }))
    .filter((b) => b.players.length);
}

function normalizeLeaders(blocks = []) {
  return blocks.map((block) => ({
    teamId: String(block.team?.id || ''),
    abbr: block.team?.abbreviation || '',
    categories: (block.leaders || []).map((cat) => ({
      name: cat.name,
      label: cat.displayName,
      leaders: (cat.leaders || []).slice(0, 1).map((l) => ({
        name: l.athlete?.displayName || '',
        headshot: l.athlete?.headshot?.href || null,
        value: l.displayValue || String(l.value ?? ''),
      })),
    })),
  }));
}

function normalizeSeries(series = []) {
  const s = series[0];
  if (!s) return null;
  return {
    title: s.title || '',
    summary: s.summary || s.shortSummary || '',
    completed: Boolean(s.completed),
    score: s.seriesScore || '',
    total: s.totalCompetitions ?? null,
  };
}

function normalizeWinProbability(winprobability = [], plays = []) {
  const playMap = new Map((plays || []).map((p) => [String(p.id), p]));
  return (winprobability || [])
    .map((w) => {
      const play = playMap.get(String(w.playId));
      const home = Number(w.homeWinPercentage);
      if (!Number.isFinite(home)) return null;
      return {
        playId: String(w.playId || ''),
        home: Math.round(home * 1000) / 10,
        away: Math.round((1 - home) * 1000) / 10,
        period: num(play?.period?.number),
        clock: play?.clock?.displayValue || '',
        awayScore: num(play?.awayScore),
        homeScore: num(play?.homeScore),
      };
    })
    .filter(Boolean);
}

function normalizeSummary(id, data) {
  const header = data.header?.competitions?.[0] || {};
  const home = header.competitors?.find((c) => c.homeAway === 'home');
  const away = header.competitors?.find((c) => c.homeAway === 'away');
  const boxTeams = (data.boxscore?.teams || []).map(normalizeBoxTeam);
  const boxPlayers = (data.boxscore?.players || []).map(normalizePlayers);
  const plays = (data.plays || []).map(normalizePlay);
  const notable = plays
    .filter((p) => p.scoring)
    .slice(-45)
    .concat(plays.slice(-35))
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .sort((a, b) => a.sequence - b.sequence);
  return {
    id: String(id),
    date: header.date || data.meta?.date || '',
    status: normalizeStatus(header.status),
    away: away ? normalizeCompetitor(away) : null,
    home: home ? normalizeCompetitor(home) : null,
    venue: normalizeVenue(header),
    attendance: header.attendance ?? null,
    officials: (data.gameInfo?.officials || []).map((o) => o.displayName).filter(Boolean),
    broadcasts: normalizeBroadcasts(header),
    boxscore: { teams: boxTeams, players: boxPlayers },
    leaders: normalizeLeaders(data.leaders),
    plays: notable,
    winprobability: normalizeWinProbability(data.winprobability, data.plays),
    injuries: normalizeInjuries(data.injuries),
    series: normalizeSeries(data.seasonseries),
    odds: normalizeOdds(data.odds),
    article: data.article
      ? {
          headline: data.article.headline || '',
          description: data.article.description || '',
          published: data.article.published || '',
          link: data.article.links?.web?.href || '',
        }
      : null,
    source: 'ESPN',
    fetchedAt: new Date().toISOString(),
  };
}

async function getGame(id) {
  if (!/^\d{4,12}$/.test(String(id))) {
    const err = new Error('无效的比赛 ID');
    err.statusCode = 400;
    throw err;
  }
  return cached(`game:${id}`, 9000, async () => {
    const data = await getJSON(`${ESPN}/summary?event=${id}`);
    return normalizeSummary(id, data);
  });
}


/* ------------------------------------------------------------------ */
/* Full season schedule                                               */
/* ------------------------------------------------------------------ */
function phaseForGame(game) {
  const type = String(game.seasonType || '').toLowerCase();
  if (type.includes('post')) return 'playoffs';
  if (type.includes('pre')) return 'preseason';
  if (type.includes('reg')) return 'regular';
  if (type.includes('all-star') || type.includes('allstar')) return 'allstar';
  return 'other';
}

function phaseLabelFor(game, phase) {
  const note = String(game.note || '').toLowerCase();
  if (phase === 'preseason') return '季前赛';
  if (phase === 'playoffs') {
    if (note.includes('play-in') || note.includes('play in')) return '附加赛';
    if (note.includes('finals')) return '总决赛';
    if (note.includes('conference finals')) return '分区决赛';
    if (note.includes('semifinals')) return '半决赛';
    if (note.includes('first round')) return '季后赛首轮';
    return '季后赛';
  }
  if (phase === 'allstar') return '全明星';
  if (phase === 'regular') return '常规赛';
  return '其他';
}

async function getTeamSeasonEvents(teamId) {
  return cached(`team-season:${teamId}`, 60 * 60 * 1000, async () => {
    const data = await getJSON(`${ESPN}/teams/${teamId}/schedule?season=${SEASON}`);
    return (data.events || []).map(normalizeEvent).filter(Boolean);
  });
}

async function getSeasonSchedule() {
  return cached('season-schedule', 60 * 60 * 1000, async () => {
    const teamData = await getTeams();
    const teams = teamData.teams || [];
    const queue = [...teams];
    const collected = new Map();
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const team = queue.shift();
        if (!team) break;
        try {
          const games = await getTeamSeasonEvents(team.id);
          for (const game of games) {
            if (!collected.has(game.id)) collected.set(game.id, game);
          }
        } catch (err) {
          console.warn(`[season] ${team.abbr} schedule failed: ${err.message}`);
        }
      }
    });
    await Promise.all(workers);

    const games = [...collected.values()]
      .map((game) => {
        const phase = phaseForGame(game);
        return {
          ...game,
          phase,
          phaseLabel: phaseLabelFor(game, phase),
        };
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    if (!games.length) throw new Error('赛季赛程暂时不可用');

    const phases = {};
    for (const game of games) phases[game.phase] = (phases[game.phase] || 0) + 1;
    return {
      season: `${Number(SEASON) - 1}-${String(Number(SEASON)).slice(-2)}`,
      games,
      count: games.length,
      phases,
      firstGame: games[0]?.startTime || null,
      lastGame: games.at(-1)?.startTime || null,
      source: 'ESPN',
      fetchedAt: new Date().toISOString(),
    };
  });
}

/* ------------------------------------------------------------------ */
/* teams, standings, schedule, news, calendar                          */
/* ------------------------------------------------------------------ */
async function getTeams() {
  return cached('teams', 6 * 60 * 60 * 1000, async () => {
    const data = await getJSON(`${ESPN}/teams`);
    const list = data.sports?.[0]?.leagues?.[0]?.teams || [];
    return {
      teams: list.map(({ team }) => ({
        id: String(team.id),
        abbr: team.abbreviation,
        slug: team.slug,
        name: team.name,
        location: team.location,
        displayName: team.displayName,
        shortDisplayName: team.shortDisplayName,
        logo: teamLogo(team),
        color: `#${(team.color || '888888').replace('#', '')}`,
        altColor: `#${(team.alternateColor || team.color || '888888').replace('#', '')}`,
        links: team.links?.filter((l) => l.rel?.includes('desktop')).slice(0, 1) || [],
      })),
      source: 'ESPN',
      fetchedAt: new Date().toISOString(),
    };
  });
}

const STANDING_KEYS = {
  overall: 'overall',
  winPercent: 'winPercent',
  gamesBehind: 'gamesBehind',
  streak: 'streak',
  playoffSeed: 'playoffSeed',
  avgPointsFor: 'ppg',
  avgPointsAgainst: 'oppPpg',
  differential: 'diff',
  Home: 'home',
  Road: 'road',
  'Last Ten Games': 'last10',
};

async function getStandings() {
  return cached('standings', 3 * 60 * 1000, async () => {
    const data = await getJSON(`${ESPN_V2}/standings?season=${SEASON}`);
    const conferences = (data.children || []).map((conf) => ({
      id: String(conf.id),
      name: conf.name,
      abbreviation: conf.abbreviation,
      entries: (conf.standings?.entries || []).map((entry) => {
        const stats = {};
        for (const s of entry.stats || []) {
          const key = STANDING_KEYS[s.name];
          if (key) stats[key] = s.displayValue ?? String(s.value ?? '');
          if (s.name === 'wins') stats.wins = s.displayValue ?? String(s.value);
          if (s.name === 'losses') stats.losses = s.displayValue ?? String(s.value);
        }
        return {
          team: {
            id: String(entry.team.id),
            abbr: entry.team.abbreviation,
            displayName: entry.team.displayName,
            name: entry.team.name,
            logo: teamLogo(entry.team),
            color: `#${(entry.team.color || '888888').replace('#', '')}`,
            altColor: `#${(entry.team.alternateColor || entry.team.color || '888888').replace('#', '')}`,
          },
          stats,
        };
      }),
    }));
    return {
      season: data.season?.displayName || '2026-27',
      conferences,
      source: 'ESPN',
      fetchedAt: new Date().toISOString(),
    };
  });
}

async function getTeamSchedule(teamId) {
  if (!/^\d{1,3}$/.test(String(teamId))) {
    const err = new Error('无效的球队 ID');
    err.statusCode = 400;
    throw err;
  }
  return cached(`team-schedule:${teamId}`, 5 * 60 * 1000, async () => {
    const data = await getJSON(`${ESPN}/teams/${teamId}/schedule?season=${SEASON}`);
    const events = (data.events || [])
      .map((event) => {
        const game = normalizeEvent(event);
        if (!game) return null;
        const isHome = String(game.home.id) === String(teamId);
        const team = isHome ? game.home : game.away;
        const opponent = isHome ? game.away : game.home;
        return {
          id: game.id,
          date: game.date,
          status: game.status,
          isHome,
          teamScore: team.score,
          opponentScore: opponent.score,
          opponent: {
            id: opponent.id,
            abbr: opponent.abbr,
            name: opponent.name,
            displayName: opponent.displayName,
            logo: opponent.logo,
            color: opponent.color,
            record: opponent.record,
          },
          result: game.status.completed ? (team.score > opponent.score ? 'W' : 'L') : '',
          broadcasts: game.broadcasts,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const now = Date.now();
    return {
      teamId: String(teamId),
      team: data.team
        ? {
            id: String(data.team.id),
            abbr: data.team.abbreviation,
            displayName: data.team.displayName,
            name: data.team.name,
            logo: teamLogo(data.team),
            color: `#${(data.team.color || '888888').replace('#', '')}`,
          }
        : null,
      recent: events.filter((e) => new Date(e.date).getTime() <= now).slice(-5).reverse(),
      upcoming: events.filter((e) => new Date(e.date).getTime() > now).slice(0, 6),
      source: 'ESPN',
      fetchedAt: new Date().toISOString(),
    };
  });
}

async function getNews() {
  return cached('news', 4 * 60 * 1000, async () => {
    const data = await getJSON(`${ESPN}/news?limit=8`);
    return {
      articles: (data.articles || []).slice(0, 8).map((a) => ({
        id: String(a.id),
        headline: a.headline || '',
        description: a.description || '',
        published: a.published || '',
        image: a.images?.find((i) => i.type === 'header')?.url || a.images?.[0]?.url || null,
        link: a.links?.web?.href || '',
        byline: a.byline || '',
        category: a.categories?.[0]?.description || '',
      })),
      source: 'ESPN',
      fetchedAt: new Date().toISOString(),
    };
  });
}

async function getCalendar() {
  return cached('calendar', 6 * 60 * 60 * 1000, async () => {
    const data = await getJSON(`${ESPN}/scoreboard`);
    const league = data.leagues?.[0] || {};
    const dates = (league.calendar || [])
      .map((iso) => {
        const day = iso.slice(0, 10);
        return addDays(day, 1);
      })
      .filter((v, i, arr) => arr.indexOf(v) === i);
    return {
      dates,
      season: league.season?.displayName || '2026-27',
      source: 'ESPN',
      fetchedAt: new Date().toISOString(),
    };
  });
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */
function sendJSON(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function apiError(res, err) {
  const status = err.statusCode || 502;
  console.error(`[api] ${status} ${err.message}`);
  sendJSON(res, status, {
    error: true,
    message:
      status === 502
        ? '暂时连不上 NBA 数据源，请稍后重试。'
        : err.message || '请求失败',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}

/* ------------------------------------------------------------------ */
/* PC system notifications                                             */
/* ------------------------------------------------------------------ */
const DEFAULT_SETTINGS = {
  lead: 15,
  start: true,
  final: true,
  close: false,
  serverNotifications: false,
};

function defaultPreferences() {
  return {
    favorites: [],
    reminders: {},
    settings: { ...DEFAULT_SETTINGS },
    sent: {},
  };
}

let serverPrefs = defaultPreferences();
let prefsReady = null;

async function loadPreferences() {
  try {
    const raw = await readFile(PREFS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    serverPrefs = sanitizePreferences(parsed, parsed.sent || {});
  } catch {
    serverPrefs = defaultPreferences();
  }
  return serverPrefs;
}

async function savePreferences() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(PREFS_FILE, JSON.stringify(serverPrefs, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('[notify] could not save preferences:', err.message);
    return false;
  }
}

function sanitizePreferences(input = {}, sent = {}) {
  const favorites = Array.isArray(input.favorites)
    ? [...new Set(input.favorites.filter((v) => typeof v === 'string' && /^[A-Z0-9]{2,5}$/.test(v)))].slice(0, 30)
    : [];
  const reminders = {};
  if (input.reminders && typeof input.reminders === 'object') {
    for (const [key, value] of Object.entries(input.reminders).slice(0, 300)) {
      if (/^\d{4,12}$/.test(String(key))) reminders[String(key)] = value || {};
    }
  }
  const settings = {
    lead: Math.max(5, Math.min(120, Number(input.settings?.lead) || DEFAULT_SETTINGS.lead)),
    start: input.settings?.start !== false,
    final: input.settings?.final !== false,
    close: Boolean(input.settings?.close),
    serverNotifications: Boolean(input.settings?.serverNotifications),
  };
  return { favorites, reminders, settings, sent: sent && typeof sent === 'object' ? sent : {} };
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('请求内容过大'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function systemNotificationSupport() {
  if (process.platform === 'linux') return { available: true, platform: 'linux', via: 'notify-send' };
  if (process.platform === 'darwin') return { available: true, platform: 'darwin', via: 'osascript' };
  if (process.platform === 'win32') return { available: true, platform: 'win32', via: 'PowerShell toast' };
  return { available: false, platform: process.platform, via: '' };
}

function sendSystemNotification(title, body) {
  const support = systemNotificationSupport();
  if (!support.available) return Promise.resolve(false);

  if (support.platform === 'linux') {
    return new Promise((resolve) => {
      execFile(
        'notify-send',
        ['--app-name=场边 COURTSIDE', `--icon=${NOTIFY_ICON}`, '--urgency=normal', title, body],
        { timeout: 5000 },
        (error) => {
          if (error) console.warn('[notify] notify-send failed:', error.message);
          resolve(!error);
        },
      );
    });
  }

  if (support.platform === 'darwin') {
    const quote = (value) => JSON.stringify(String(value));
    const script = `display notification ${quote(body)} with title ${quote(title)} sound name "Glass"`;
    return new Promise((resolve) => {
      execFile('osascript', ['-e', script], { timeout: 5000 }, (error) => resolve(!error));
    });
  }

  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$n = New-Object System.Windows.Forms.NotifyIcon',
    '$n.Icon = [System.Drawing.SystemIcons]::Information',
    '$n.Visible = $true',
    '$n.ShowBalloonTip(10000, $env:COURTSIDE_TITLE, $env:COURTSIDE_BODY, [System.Windows.Forms.ToolTipIcon]::Info)',
    'Start-Sleep -Seconds 3',
    '$n.Dispose()',
  ].join('; ');
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      {
        timeout: 8000,
        env: { ...process.env, COURTSIDE_TITLE: String(title), COURTSIDE_BODY: String(body) },
      },
      (error) => resolve(!error),
    );
  });
}

const notificationPoll = { busy: false, timer: null };

function involvesFavorite(game) {
  return serverPrefs.favorites.includes(game.away.abbr) || serverPrefs.favorites.includes(game.home.abbr);
}

async function notifyOnce(key, title, body) {
  if (serverPrefs.sent[key]) return false;
  const ok = await sendSystemNotification(title, body);
  if (ok) {
    serverPrefs.sent[key] = Date.now();
    // Keep the state file small.
    const cutoff = Date.now() - 4 * 24 * 60 * 60 * 1000;
    for (const [sentKey, timestamp] of Object.entries(serverPrefs.sent)) {
      if (timestamp < cutoff) delete serverPrefs.sent[sentKey];
    }
    await savePreferences();
  }
  return ok;
}

async function pollSystemNotifications() {
  if (notificationPoll.busy || !serverPrefs.settings.serverNotifications) return;
  if (!serverPrefs.favorites.length && !Object.keys(serverPrefs.reminders).length) return;
  notificationPoll.busy = true;
  try {
    const day = await getDay(todayBeijing());
    const now = Date.now();
    for (const game of day.games) {
      const explicit = Boolean(serverPrefs.reminders[game.id]);
      const favorite = involvesFavorite(game);
      if (!explicit && !favorite) continue;
      const start = new Date(game.startTime).getTime();

      if (serverPrefs.settings.start && game.status.state === 'pre') {
        const minutesToStart = (start - now) / 60000;
        if (minutesToStart <= serverPrefs.settings.lead && minutesToStart > -10) {
          await notifyOnce(
            `start:${game.id}`,
            '比赛即将开始',
            `${game.away.abbr} vs ${game.home.abbr} · ${formatBeijingTime(game.startTime)} · 北京时间`,
          );
        }
      }

      if (
        serverPrefs.settings.final &&
        favorite &&
        game.status.state === 'post' &&
        now - start < 8 * 3600 * 1000
      ) {
        const winner = game.home.score > game.away.score ? game.home : game.away;
        await notifyOnce(
          `final:${game.id}`,
          '比赛结束',
          `${game.away.abbr} ${game.away.score} - ${game.home.score} ${game.home.abbr} · ${winner.abbr} 获胜`,
        );
      }

      if (
        serverPrefs.settings.close &&
        favorite &&
        game.status.state === 'in' &&
        game.status.period >= 4 &&
        Math.abs(game.home.score - game.away.score) <= 5
      ) {
        await notifyOnce(
          `close:${game.id}`,
          '关键回合 · 分差 5 分以内',
          `${game.away.abbr} ${game.away.score} - ${game.home.score} ${game.home.abbr} · ${
            game.status.period > 4 ? '加时' : `第 ${game.status.period} 节`
          }`,
        );
      }
    }
  } catch (err) {
    console.warn('[notify] poll failed:', err.message);
  } finally {
    notificationPoll.busy = false;
  }
}

function startNotificationPolling() {
  if (notificationPoll.timer) clearInterval(notificationPoll.timer);
  notificationPoll.timer = setInterval(pollSystemNotifications, 45000);
  notificationPoll.timer.unref?.();
  // Give the server and the first preference sync a moment.
  setTimeout(pollSystemNotifications, 4000).unref?.();
}


async function handleApi(req, res, url) {
  const { pathname, searchParams } = url;
  try {
    await prefsReady;
    if (pathname === '/api/health') {
      return sendJSON(res, 200, { ok: true, time: new Date().toISOString(), season: SEASON });
    }
    if (pathname === '/api/scoreboard') {
      const date = searchParams.get('date') || todayBeijing();
      if (!isValidDate(date)) return sendJSON(res, 400, { error: true, message: '日期格式应为 YYYY-MM-DD' });
      return sendJSON(res, 200, await getDay(date));
    }
    if (pathname === '/api/today') {
      return sendJSON(res, 200, await getDay(todayBeijing()));
    }
    if (pathname === '/api/game') {
      const id = searchParams.get('id');
      if (!id) return sendJSON(res, 400, { error: true, message: '缺少比赛 ID' });
      return sendJSON(res, 200, await getGame(id));
    }
    if (pathname === '/api/teams') return sendJSON(res, 200, await getTeams());
    if (pathname === '/api/standings') return sendJSON(res, 200, await getStandings());
    if (pathname === '/api/team-schedule') {
      const id = searchParams.get('team');
      if (!id) return sendJSON(res, 400, { error: true, message: '缺少球队 ID' });
      return sendJSON(res, 200, await getTeamSchedule(id));
    }
    if (pathname === '/api/news') return sendJSON(res, 200, await getNews());
    if (pathname === '/api/calendar') return sendJSON(res, 200, await getCalendar());
    if (pathname === '/api/season-schedule') return sendJSON(res, 200, await getSeasonSchedule());

    if (pathname === '/api/notification-status') {
      return sendJSON(res, 200, {
        ...systemNotificationSupport(),
        enabled: serverPrefs.settings.serverNotifications,
      });
    }

    if (pathname === '/api/preferences') {
      if (req.method === 'PUT') {
        const raw = await readBody(req);
        let parsed;
        try {
          parsed = JSON.parse(raw || '{}');
        } catch {
          return sendJSON(res, 400, { error: true, message: '偏好设置格式错误' });
        }
        serverPrefs = sanitizePreferences(parsed, serverPrefs.sent);
        await savePreferences();
        if (serverPrefs.settings.serverNotifications) setTimeout(pollSystemNotifications, 800).unref?.();
        return sendJSON(res, 200, {
          ok: true,
          favorites: serverPrefs.favorites,
          settings: serverPrefs.settings,
        });
      }
      return sendJSON(res, 200, {
        favorites: serverPrefs.favorites,
        reminders: serverPrefs.reminders,
        settings: serverPrefs.settings,
      });
    }

    if (pathname === '/api/test-notification') {
      if (req.method !== 'POST') return sendJSON(res, 405, { error: true, message: '请使用 POST' });
      const ok = await sendSystemNotification(
        '场边 · 系统通知测试',
        '如果你看到这条桌面通知，说明电脑系统提示已经工作。',
      );
      return sendJSON(res, 200, { ok, ...systemNotificationSupport() });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJSON(res, 405, { error: true, message: '接口不支持这个请求方法' });
    }
    return sendJSON(res, 404, { error: true, message: '接口不存在' });
  } catch (err) {
    return apiError(res, err);
  }
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) throw new Error('directory');
    const ext = path.extname(filePath).toLowerCase();
    const body = await readFile(filePath);
    const headers = {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control':
        ext === '.woff2'
          ? 'public, max-age=31536000, immutable'
          : ext === '.png' || ext === '.svg'
            ? 'public, max-age=86400'
            : 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    res.end(body);
  } catch {
    // hash routing: unknown paths still get the shell
    try {
      const body = await readFile(path.join(PUBLIC_DIR, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  res.setHeader('x-frame-options', 'SAMEORIGIN');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*' });
    return res.end();
  }
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end('Method not allowed');
  }
  return serveStatic(req, res, url);
});

prefsReady = loadPreferences()
  .then(() => {
    startNotificationPolling();
    return serverPrefs;
  })
  .catch((err) => {
    console.warn('[notify] preferences initialization failed:', err.message);
    return serverPrefs;
  });

server.listen(PORT, HOST, () => {
  console.log(`\n  COURTSIDE / 场边\n  http://${HOST}:${PORT}\n  season ${SEASON} · times in ${TZ}\n`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
