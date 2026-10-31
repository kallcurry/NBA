/**
 * Standalone ESPN client for the Android WebView build.
 *
 * The normal web build calls the local Node proxy (/api/*). The APK has no
 * Node process, so this module talks to ESPN directly and reproduces the
 * small normalization layer the UI expects.
 *
 * ESPN's public endpoints send `Access-Control-Allow-Origin: *`, so a direct
 * fetch from the WebView asset origin works without a proxy.
 */

// site.web.api.espn.com is the browser-friendly host used by ESPN's own web
// app. site.api.espn.com frequently returns Akamai 403s to browser requests.
const ESPN = 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_V2 = 'https://site.web.api.espn.com/apis/v2/sports/basketball/nba';
const SEASON = '2027';
const TZ = 'Asia/Shanghai';

async function fetchJSON(url) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('当前处于离线状态');
  }
  let res;
  try {
    const options = {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    };
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      options.signal = AbortSignal.timeout(18000);
    }
    res = await fetch(url, options);
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error('数据源响应超时，请稍后重试');
    }
    throw new Error('网络连接失败，请检查网络');
  }
  if (!res.ok) throw new Error(`数据源请求失败（${res.status}）`);
  try {
    return await res.json();
  } catch {
    throw new Error('数据源返回了无法解析的内容');
  }
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function beijingDate(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function compact(dateStr) {
  return dateStr.replaceAll('-', '');
}

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
  const score =
    typeof c.score === 'object' && c.score !== null ? c.score.value ?? c.score.displayValue : c.score;
  return {
    id: String(team.id || c.id || ''),
    abbr: team.abbreviation || '',
    name: team.name || team.shortDisplayName || '',
    displayName: team.displayName || team.name || '',
    location: team.location || '',
    logo: teamLogo(team),
    color: `#${(team.color || '888888').replace('#', '')}`,
    altColor: `#${(team.alternateColor || team.color || '888888').replace('#', '')}`,
    score: num(score),
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

async function scoreboardForDate(dateStr) {
  return fetchJSON(`${ESPN}/scoreboard?dates=${compact(dateStr)}`);
}

export async function getDay(dateStr) {
  const [prev, current] = await Promise.allSettled([
    scoreboardForDate(addDays(dateStr, -1)),
    scoreboardForDate(dateStr),
  ]);
  const raws = [];
  for (const result of [prev, current]) {
    if (result.status === 'fulfilled') raws.push(result.value);
  }
  if (!raws.length) throw new Error('暂时连不上 NBA 数据源，请稍后重试。');

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
  games.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
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
  const group = (teamBlock.statistics || [])[0];
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
    boxscore: {
      teams: (data.boxscore?.teams || []).map(normalizeBoxTeam),
      players: (data.boxscore?.players || []).map(normalizePlayers),
    },
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

export async function getGame(id) {
  if (!/^\d{4,12}$/.test(String(id))) throw new Error('无效的比赛 ID');
  const data = await fetchJSON(`${ESPN}/summary?event=${id}`);
  return normalizeSummary(id, data);
}

export async function getTeams() {
  // The /teams endpoint does not send CORS headers on the web host. Standings
  // contains all 30 teams with logos/colors, so derive the team directory there.
  const standings = await getStandings();
  const seen = new Set();
  const teams = [];
  for (const conf of standings.conferences || []) {
    for (const entry of conf.entries || []) {
      const team = entry.team;
      if (!team || seen.has(team.id)) continue;
      seen.add(team.id);
      teams.push({
        id: String(team.id),
        abbr: team.abbr,
        slug: '',
        name: team.name,
        location: '',
        displayName: team.displayName,
        shortDisplayName: team.name,
        logo: team.logo,
        color: team.color,
        altColor: team.altColor,
        links: [],
      });
    }
  }
  teams.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return {
    teams,
    source: 'ESPN',
    fetchedAt: new Date().toISOString(),
  };
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

export async function getStandings() {
  const data = await fetchJSON(`${ESPN_V2}/standings?season=${SEASON}`);
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
}

export async function getTeamSchedule(teamId) {
  if (!/^\d{1,3}$/.test(String(teamId))) throw new Error('无效的球队 ID');
  const data = await fetchJSON(`${ESPN}/teams/${teamId}/schedule?season=${SEASON}`);
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
}

export async function getNews() {
  const data = await fetchJSON(`${ESPN}/news?limit=8`);
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
}

export async function getCalendar() {
  const data = await fetchJSON(`${ESPN}/scoreboard`);
  const league = data.leagues?.[0] || {};
  const dates = (league.calendar || [])
    .map((iso) => addDays(iso.slice(0, 10), 1))
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return {
    dates,
    season: league.season?.displayName || '2026-27',
    source: 'ESPN',
    fetchedAt: new Date().toISOString(),
  };
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
  const data = await fetchJSON(`${ESPN}/teams/${teamId}/schedule?season=${SEASON}`);
  return (data.events || []).map(normalizeEvent).filter(Boolean);
}

export async function getSeasonSchedule() {
  const teamData = await getTeams();
  const queue = [...(teamData.teams || [])];
  const collected = new Map();
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const team = queue.shift();
      if (!team) break;
      try {
        for (const game of await getTeamSeasonEvents(team.id)) {
          if (!collected.has(game.id)) collected.set(game.id, game);
        }
      } catch {
        // One team failing should not erase the rest of the season.
      }
    }
  });
  await Promise.all(workers);
  const games = [...collected.values()]
    .map((game) => {
      const phase = phaseForGame(game);
      return { ...game, phase, phaseLabel: phaseLabelFor(game, phase) };
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
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
}
