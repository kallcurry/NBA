/* COURTSIDE app shell, router, polling, reminders and action wiring. */

import * as api from './api.js';
import { store } from './store.js';
import {
  addDays,
  beijingDateOf,
  cnName,
  dateParts,
  fmtDateLong,
  fmtTime,
  isLive,
  matchupCn,
  relativeDay,
  statusText,
  todayStr,
} from './data.js';
import {
  closeOverlay,
  errorState,
  icon,
  logo,
  openOverlay,
  spinner,
  toast,
} from './ui.js';
import { renderToday } from './views/today.js';
import { renderSchedule } from './views/schedule.js';
import { renderTeams, renderTeamSheet } from './views/teams.js';
import { renderGuide } from './views/guide.js';
import { renderSeason } from './views/season.js';
import { renderSettings } from './views/settings.js';
import {
  detailUi,
  renderGameDetail,
  renderWatchSheet,
  resetDetailUi,
} from './components/game-detail.js';
import {
  cancelAllNativeReminders,
  cancelNativeReminder,
  checkNotifications,
  isNativeApp,
  permissionState,
  requestPermission,
  scheduleNativeReminder,
  syncNativeReminders,
  testNotification,
} from './notifications.js';
import { downloadDayICS, downloadGameICS } from './calendar.js';

const STANDALONE =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('standalone');

const app = {
  currentBase: null,
  day: null,
  dayDate: null,
  dayLoading: false,
  dayError: null,
  stale: null,
  daySignature: '',
  dayToken: 0,
  dayPromise: null,
  dayPromiseDate: null,
  refreshing: false,
  lastUpdated: null,
  flashIds: new Set(),

  teams: [],
  season: null,
  seasonLoading: false,
  seasonError: null,
  seasonPromise: null,
  seasonPhase: 'all',
  seasonMonth: '',
  seasonTeam: 'all',
  seasonTeamOpen: false,
  standings: null,
  standingsLoading: false,
  standingsError: null,
  activeConference: 'East',

  news: null,
  calendarDates: [],

  currentGame: null,
  summary: null,
  summaryError: null,
  summaryLoading: false,
  summarySignature: '',
  gameHandle: null,
  openGameId: null,
  detailPoll: null,

  teamHandle: null,
  teamState: null,
  settingsHandle: null,
  installPrompt: null,
  confirmHandle: null,

  pollTimer: null,
  routeSeq: 0,
  aux: { calendar: 0, teams: 0, news: 0 },
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseRoute() {
  const raw = location.hash.replace(/^#/, '') || '/today';
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] === 'game' && parts[1]) return { name: 'game', id: parts[1] };
  if (parts[0] === 'schedule') return { name: 'schedule', date: validDate(parts[1]) ? parts[1] : todayStr() };
  if (parts[0] === 'teams') return { name: 'teams', date: todayStr() };
  if (parts[0] === 'season') return { name: 'season', date: todayStr() };
  if (parts[0] === 'guide') return { name: 'guide', date: todayStr() };
  if (parts[0] === 'today') return { name: 'today', date: validDate(parts[1]) ? parts[1] : todayStr() };
  return { name: 'today', date: todayStr() };
}

function baseHashFor(base) {
  if (base.name === 'schedule') return `#/schedule/${base.date}`;
  if (base.name === 'teams') return '#/teams';
  if (base.name === 'season') return '#/season';
  if (base.name === 'guide') return '#/guide';
  return `#/today/${base.date}`;
}

function findGame(id) {
  return app.day?.games?.find((g) => String(g.id) === String(id)) || null;
}

function findTeam(abbr) {
  for (const conf of app.standings?.conferences || []) {
    const entry = conf.entries.find((e) => e.team.abbr === abbr);
    if (entry) return { team: entry.team, stats: entry.stats, conf };
  }
  const t = (app.teams || []).find((team) => team.abbr === abbr);
  return t ? { team: t, stats: {}, conf: null } : null;
}

function teamMap() {
  const map = new Map();
  for (const t of app.teams || []) map.set(t.abbr, t);
  for (const conf of app.standings?.conferences || []) {
    for (const e of conf.entries || []) map.set(e.team.abbr, e.team);
  }
  return map;
}

function formatClockTime(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function timeAgoText(timestamp) {
  if (!timestamp) return '等待数据';
  const sec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (sec < 10) return '刚刚更新';
  if (sec < 60) return `${sec} 秒前更新`;
  return `更新于 ${formatClockTime(new Date(timestamp))}`;
}

/* ------------------------------------------------------------------ */
/* shell                                                               */
/* ------------------------------------------------------------------ */
function activeNav() {
  const base = app.currentBase?.name || 'today';
  return base === 'game' ? 'today' : base;
}

function brandMark() {
  return `<span class="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 32 32">
      <rect x="2.5" y="2.5" width="27" height="27" rx="8" />
      <path d="M16 2.5v27M2.5 16h9M29.5 16h-9" />
      <circle cx="16" cy="16" r="4.6" />
      <circle cx="16" cy="16" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  </span>`;
}

function renderSidebar() {
  const active = activeNav();
  const map = teamMap();
  const favs = store.favorites;
  const navItems = [
    { id: 'today', href: `#/today/${todayStr()}`, icon: 'today', label: '今日比赛', meta: 'TODAY' },
    { id: 'schedule', href: `#/schedule/${todayStr()}`, icon: 'schedule', label: '赛程', meta: 'SCHEDULE' },
    { id: 'season', href: '#/season', icon: 'trophy', label: '赛季', meta: 'SEASON' },
    { id: 'teams', href: '#/teams', icon: 'teams', label: '球队', meta: 'TEAMS' },
    { id: 'guide', href: '#/guide', icon: 'guide', label: '观赛指南', meta: 'WATCH' },
  ];
  const favRows = favs
    .slice(0, 6)
    .map((abbr) => {
      const team = map.get(abbr) || { abbr, name: abbr, logo: null };
      return `<button class="sidebar-team" data-action="open-team" data-abbr="${abbr}">
        ${logo(team, 'xs')}<span>${cnName(team)}</span><em>${abbr}</em>
      </button>`;
    })
    .join('');

  return `<div class="sidebar__inner">
    <a class="brand" href="#/today/${todayStr()}" aria-label="场边首页">
      ${brandMark()}
      <span class="brand__word"><strong>场边</strong><em>COURTSIDE</em></span>
    </a>
    <div class="sidebar__season"><span>2026–27</span> REGULAR SEASON</div>

    <nav class="side-nav" aria-label="主导航">
      ${navItems
        .map(
          (item) => `<a class="side-nav__item ${active === item.id ? 'is-active' : ''}" href="${item.href}" ${
            active === item.id ? 'aria-current="page"' : ''
          }>
            <span class="side-nav__icon">${icon(item.icon)}</span>
            <span class="side-nav__label">${item.label}</span>
            <span class="side-nav__meta">${item.meta}</span>
          </a>`,
        )
        .join('')}
    </nav>

    <div class="sidebar__section">
      <div class="sidebar__section-head">
        <span>${icon('star')}我的球队</span>
        <a href="#/teams" aria-label="管理关注球队">管理</a>
      </div>
      ${favRows || `<p class="sidebar__empty">关注球队后，<br />赛程与提醒会优先展示。</p>`}
      ${!favRows ? `<a class="sidebar__pick" href="#/teams">选择主队 ${icon('arrow-right')}</a>` : ''}
    </div>

    <div class="sidebar__spacer"></div>

    <a class="sidebar-guide" href="#/guide">
      <svg class="sidebar-guide__court" viewBox="0 0 200 90" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="100" cy="45" r="26" /><circle cx="100" cy="45" r="2" />
          <path d="M0 10h200M0 80h200M100 0v90" />
          <path d="M0 25h28v40H0M200 25h-28v40h28" />
        </g>
      </svg>
      <span class="sidebar-guide__eyebrow">${icon('tv')}官方渠道</span>
      <strong>去哪看球？</strong>
      <p>League Pass、腾讯、咪咕、央视。拒绝盗链。</p>
      <span class="sidebar-guide__link">打开观赛指南 ${icon('arrow-right')}</span>
    </a>

    <div class="sidebar__foot">
      <span>数据 ESPN</span><i></i><span>北京时间</span><i></i><span>v1.1.0</span>
    </div>
  </div>`;
}

function renderTopbar() {
  const base = app.currentBase || { name: 'today', date: todayStr() };
  const live = app.day?.games?.filter(isLive).length || 0;
  const isToday = base.name === 'today' && base.date === todayStr();
  let crumb = '比赛日';
  let crumbValue = '';
  if (base.name === 'today') {
    crumb = isToday ? '今日比赛' : '比赛日';
    crumbValue = isToday ? `${dateParts(todayStr()).month}月${dateParts(todayStr()).day}日` : fmtDateLong(base.date).replace(/\s.*/, '');
  } else if (base.name === 'schedule') {
    crumb = '赛程';
    crumbValue = `${dateParts(base.date).month}月${dateParts(base.date).day}日`;
  } else if (base.name === 'teams') {
    crumb = '球队';
    crumbValue = '联盟排名';
  } else if (base.name === 'season') {
    crumb = '赛季';
    crumbValue = '完整赛程';
  } else if (base.name === 'guide') {
    crumb = '观赛指南';
    crumbValue = '官方渠道';
  }
  return `<div class="topbar__inner">
    <a class="topbar__brand" href="#/today/${todayStr()}" aria-label="场边首页">${brandMark()}<span>场边</span></a>
    <div class="topbar__crumb">
      <span>${crumb}</span><i>/</i><strong>${crumbValue}</strong>
    </div>
    <div class="topbar__spacer"></div>
    <a class="topbar__live ${live ? 'is-live' : ''}" data-live-pill href="#/today/${todayStr()}" ${
      live ? '' : 'hidden'
    }>${live ? `<span class="live-dot"></span>LIVE <strong>${live}</strong>` : ''}</a>
    <span class="topbar__updated" data-topbar-meta>${timeAgoText(app.lastUpdated)}</span>
    <button class="icon-btn topbar__icon refresh-btn" data-action="refresh" aria-label="刷新数据" title="刷新数据">
      ${icon('refresh', app.refreshing ? 'is-spinning' : '')}
    </button>
    <button class="icon-btn topbar__icon" data-action="open-settings" aria-label="通知与设置" title="通知与设置">
      ${icon('bell')}
      ${store.settings.notificationsEnabled ? '<span class="icon-btn__dot" data-bell-badge></span>' : ''}
    </button>
  </div>`;
}

function renderTabbar() {
  const active = activeNav();
  const items = [
    { id: 'today', href: `#/today/${todayStr()}`, icon: 'today', label: '今日' },
    { id: 'schedule', href: `#/schedule/${todayStr()}`, icon: 'schedule', label: '赛程' },
    { id: 'season', href: '#/season', icon: 'trophy', label: '赛季' },
    { id: 'teams', href: '#/teams', icon: 'teams', label: '球队' },
    { id: 'guide', href: '#/guide', icon: 'guide', label: '指南' },
  ];
  return items
    .map(
      (item) => `<a class="tabbar__item ${active === item.id ? 'is-active' : ''}" href="${item.href}" ${
        active === item.id ? 'aria-current="page"' : ''
      }><span class="tabbar__icon">${icon(item.icon)}</span><span>${item.label}</span></a>`,
    )
    .join('');
}

function renderFooter() {
  return `<div class="site-footer__inner">
    <div class="site-footer__brand">
      <span class="site-footer__mark">${brandMark()}</span>
      <div><strong>场边 COURTSIDE</strong><span>每天，准时坐到场边。</span></div>
    </div>
    <p class="site-footer__note">非 NBA 官方产品。赛程与比分来自 ESPN，直播入口仅指向官方与持权平台，不提供任何非官方直播源。</p>
    <div class="site-footer__links">
      <a href="#/guide">观赛指南</a>
      <a href="https://www.espn.com/nba/" target="_blank" rel="noopener noreferrer">ESPN NBA</a>
      <a href="https://www.nba.com/schedule" target="_blank" rel="noopener noreferrer">NBA 官方赛程</a>
    </div>
  </div>`;
}

function renderShell() {
  $('#sidebar').innerHTML = renderSidebar();
  $('#topbar').innerHTML = renderTopbar();
  $('#tabbar').innerHTML = renderTabbar();
  $('#site-footer').innerHTML = renderFooter();
  updateTopbarMeta();
}

function updateTopbarMeta() {
  const meta = $('[data-topbar-meta]');
  if (meta) {
    const base = app.currentBase;
    if (app.refreshing || app.dayLoading || app.standingsLoading) meta.textContent = '更新中…';
    else if (app.lastUpdated) meta.textContent = timeAgoText(app.lastUpdated);
    else if (base?.name === 'teams') meta.textContent = '载入排名…';
    else meta.textContent = '等待数据';
  }
  const pill = $('[data-live-pill]');
  if (pill) {
    const live = app.day?.games?.filter(isLive).length || 0;
    if (live) {
      pill.hidden = false;
      pill.classList.add('is-live');
      pill.innerHTML = `<span class="live-dot"></span>LIVE <strong>${live}</strong>`;
    } else {
      pill.hidden = true;
      pill.classList.remove('is-live');
      pill.innerHTML = '';
    }
  }
  const refreshIcon = $('.refresh-btn .icon');
  if (refreshIcon) refreshIcon.classList.toggle('is-spinning', Boolean(app.refreshing));
  const bell = $('[data-action="open-settings"]');
  if (bell) {
    const has = store.settings.notificationsEnabled;
    bell.classList.toggle('has-dot', has);
    let dot = bell.querySelector('.icon-btn__dot');
    if (has && !dot) {
      dot = document.createElement('span');
      dot.className = 'icon-btn__dot';
      dot.dataset.bellBadge = '';
      bell.append(dot);
    }
    if (!has && dot) dot.remove();
  }
}

/* ------------------------------------------------------------------ */
/* rendering                                                           */
/* ------------------------------------------------------------------ */
function applyScoreFlash() {
  if (!app.flashIds.size) return;
  for (const id of app.flashIds) {
    const nodes = $$(`[data-game-id="${id}"] [data-score], [data-game-id="${id}"] [data-hero-score] span`);
    for (const node of nodes) node.classList.add('score-pop');
  }
  const ids = [...app.flashIds];
  app.flashIds.clear();
  window.setTimeout(() => {
    for (const id of ids) {
      $$(`[data-game-id="${id}"] .score-pop`).forEach((node) => node.classList.remove('score-pop'));
    }
  }, 1800);
}

function pageTitleFor(base) {
  if (base.name === 'today') {
    return `${relativeDay(base.date)} NBA · ${fmtDateLong(base.date)} · 场边`;
  }
  if (base.name === 'schedule') return `NBA 赛程 · ${fmtDateLong(base.date)} · 场边`;
  if (base.name === 'teams') return '球队与排名 · 场边 COURTSIDE';
  if (base.name === 'season') return '完整赛季赛程 · 场边 COURTSIDE';
  if (base.name === 'guide') return '观赛指南 · 场边 COURTSIDE';
  return '场边 COURTSIDE';
}

function renderCurrent({ keepScroll = true } = {}) {
  const base = app.currentBase || { name: 'today', date: todayStr() };
  const view = $('#view');
  if (!view) return;
  const scrollY = window.scrollY;
  let html = '';
  if (base.name === 'today') {
    html = renderToday({
      date: base.date,
      day: app.day,
      calendarDates: app.calendarDates,
      favorites: store.favorites,
      reminders: store.reminders,
      teams: app.teams,
      news: app.news,
      loading: app.dayLoading,
      error: app.dayError,
      stale: app.stale,
      refreshSeconds: Math.max(15, Number(store.settings.refresh) || 20),
    });
  } else if (base.name === 'schedule') {
    html = renderSchedule({
      date: base.date,
      day: app.day,
      calendarDates: app.calendarDates,
      favorites: store.favorites,
      reminders: store.reminders,
      loading: app.dayLoading,
      error: app.dayError,
      stale: app.stale,
    });
  } else if (base.name === 'teams') {
    html = renderTeams({
      standings: app.standings,
      favorites: store.favorites,
      activeConference: app.activeConference,
      loading: app.standingsLoading,
      error: app.standingsError,
    });
  } else if (base.name === 'season') {
    html = renderSeason({
      season: app.season,
      loading: app.seasonLoading,
      error: app.seasonError,
      phase: app.seasonPhase,
      month: app.seasonMonth,
      team: app.seasonTeam,
      teamOpen: app.seasonTeamOpen,
      teams: app.teams,
      favorites: store.favorites,
      reminders: store.reminders,
    });
  } else if (base.name === 'guide') {
    html = renderGuide({ day: app.day?.date === todayStr() ? app.day : null });
  }
  view.innerHTML = html;
  if (keepScroll) window.scrollTo({ top: scrollY, behavior: 'instant' });
  document.title = pageTitleFor(base);
  updateTopbarMeta();
  window.requestAnimationFrame(applyScoreFlash);
}

/* ------------------------------------------------------------------ */
/* data loading                                                        */
/* ------------------------------------------------------------------ */
function computeDayFlash(oldDay, newDay) {
  const ids = new Set();
  if (!oldDay || oldDay.date !== newDay.date) return ids;
  const oldMap = new Map(oldDay.games.map((g) => [g.id, g]));
  for (const g of newDay.games) {
    const old = oldMap.get(g.id);
    if (old && (g.away.score > old.away.score || g.home.score > old.home.score)) ids.add(g.id);
  }
  return ids;
}

function daySignature(day) {
  return JSON.stringify(
    (day?.games || []).map((g) => [
      g.id,
      g.status.state,
      g.status.period,
      g.status.clock,
      g.away.score,
      g.home.score,
      g.away.record,
      g.home.record,
      g.broadcasts.map((b) => b.name),
    ]),
  );
}

function applyDay(day) {
  const flash = computeDayFlash(app.day, day);
  app.day = day;
  app.dayDate = day.date;
  app.lastUpdated = Date.now();
  app.dayError = null;
  app.stale = null;
  app.daySignature = daySignature(day);
  for (const id of flash) app.flashIds.add(id);
  if (app.currentGame && String(app.currentGame.id) === String(day.games.find((g) => g.id === app.currentGame.id)?.id)) {
    app.currentGame = findGame(app.currentGame.id) || app.currentGame;
  }
  try {
    checkNotifications({ games: day.games, store });
    syncNativeReminders(day.games, store);
  } catch (err) {
    console.warn('notification check failed', err);
  }
}

async function ensureDay(date, { force = false } = {}) {
  if (!force && app.dayDate === date && app.day) return app.day;
  if (app.dayPromise && app.dayPromiseDate === date && !force) return app.dayPromise;
  const token = ++app.dayToken;
  if (app.dayDate !== date) {
    app.day = null;
    app.dayDate = date;
    app.dayError = null;
    app.stale = null;
  }
  app.dayLoading = true;
  updateTopbarMeta();
  const promise = (async () => {
    try {
      const day = await api.getScoreboard(date, { force });
      if (token !== app.dayToken) return app.day;
      applyDay(day);
      return day;
    } catch (err) {
      if (token !== app.dayToken) return app.day;
      const snapshot = api.loadDaySnapshot(date);
      if (snapshot) {
        app.day = snapshot.day;
        app.dayDate = snapshot.day.date;
        app.stale = snapshot;
        app.dayError = null;
      } else {
        app.dayError = err?.message || '数据加载失败';
      }
      return app.day;
    } finally {
      if (token === app.dayToken) {
        app.dayLoading = false;
        app.dayPromise = null;
        app.dayPromiseDate = null;
      }
    }
  })();
  app.dayPromise = promise;
  app.dayPromiseDate = date;
  return promise;
}

async function ensureStandings({ force = false } = {}) {
  if (app.standings && !force) return app.standings;
  if (app.standingsLoading) return null;
  app.standingsLoading = true;
  app.standingsError = null;
  try {
    app.standings = await api.getStandings();
    app.lastUpdated = Date.now();
    return app.standings;
  } catch (err) {
    app.standingsError = err?.message || '排名加载失败';
    return null;
  } finally {
    app.standingsLoading = false;
  }
}

let seasonRenderTimer = 0;

function scheduleSeasonRender() {
  if (seasonRenderTimer) return;
  seasonRenderTimer = window.setTimeout(() => {
    seasonRenderTimer = 0;
    if (app.currentBase?.name === 'season') renderCurrent();
  }, 250);
}

function mergeSeasonBatch(games) {
  if (!Array.isArray(games) || !games.length) return;
  const merged = new Map((app.season?.games || []).map((game) => [game.id, game]));
  for (const game of games) merged.set(game.id, game);
  const list = [...merged.values()].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const phases = {};
  for (const game of list) phases[game.phase] = (phases[game.phase] || 0) + 1;
  app.season = {
    season: app.season?.season || '2026-27',
    games: list,
    count: list.length,
    phases,
    firstGame: list[0]?.startTime || null,
    lastGame: list.at(-1)?.startTime || null,
    source: 'ESPN',
    partial: true,
  };
  app.seasonLoading = true;
  scheduleSeasonRender();
}

async function ensureSeason({ force = false } = {}) {
  if (app.season && !force) return app.season;
  if (app.seasonPromise && !force) return app.seasonPromise;
  app.seasonLoading = true;
  app.seasonError = null;
  const promise = (async () => {
    try {
      app.season = await api.getSeasonSchedule({
        force,
        onBatch: (games) => mergeSeasonBatch(games),
      });
      app.lastUpdated = Date.now();
      return app.season;
    } catch (err) {
      app.seasonError = err?.message || '赛季赛程加载失败';
      return null;
    } finally {
      app.seasonLoading = false;
      app.seasonPromise = null;
      if (app.currentBase?.name === 'season') renderCurrent();
    }
  })();
  app.seasonPromise = promise;
  return promise;
}

async function refreshDay({ manual = false } = {}) {
  const base = app.currentBase;
  if (!base || !['today', 'schedule'].includes(base.name)) return;
  if (app.dayLoading) return;
  app.refreshing = true;
  updateTopbarMeta();
  const before = app.daySignature;
  await ensureDay(base.date, { force: true });
  app.refreshing = false;
  const changed = before !== app.daySignature;
  if (changed || manual) renderCurrent();
  else updateTopbarMeta();
  if (manual) {
    if (app.dayError) toast(app.dayError, { type: 'error' });
    else toast(changed ? '比分已更新' : '已经是最新比分', { type: changed ? 'success' : 'default' });
  }
}

function ensureAux() {
  if (!app.calendarDates.length && !app.aux.calendar) {
    app.aux.calendar = 1;
    api
      .getCalendar()
      .then((data) => {
        app.calendarDates = data.dates || [];
        if (['today', 'schedule'].includes(app.currentBase?.name)) renderCurrent();
      })
      .catch(() => {
        app.aux.calendar = 0;
      });
  }
  if (!app.teams.length && !app.aux.teams) {
    app.aux.teams = 1;
    api
      .getTeams()
      .then((data) => {
        app.teams = data.teams || [];
        renderShell();
        if (['today', 'season'].includes(app.currentBase?.name)) renderCurrent();
      })
      .catch(() => {
        app.aux.teams = 0;
      });
  }
  if (!app.news && !app.aux.news) {
    app.aux.news = 1;
    api
      .getNews()
      .then((data) => {
        app.news = data;
        if (app.currentBase?.name === 'today') renderCurrent();
      })
      .catch(() => {
        app.aux.news = 0;
      });
  }
}

/* ------------------------------------------------------------------ */
/* polling                                                             */
/* ------------------------------------------------------------------ */
function stopPolling() {
  if (app.pollTimer) clearInterval(app.pollTimer);
  app.pollTimer = null;
}

function startPolling() {
  stopPolling();
  const base = app.currentBase;
  if (!base || !['today', 'schedule'].includes(base.name)) return;
  const isToday = base.date === todayStr();
  const hasLive = (app.day?.games || []).some(isLive);
  if (!isToday && !hasLive) return;
  const seconds = Math.max(15, Number(store.settings.refresh) || 20);
  app.pollTimer = window.setInterval(() => {
    if (document.hidden || app.gameHandle) return;
    refreshDay({ manual: false });
  }, seconds * 1000);
}

function stopDetailPoll() {
  if (app.detailPoll) clearInterval(app.detailPoll);
  app.detailPoll = null;
}

function startDetailPoll() {
  stopDetailPoll();
  if (!app.gameHandle || !app.summary) return;
  if (app.summary.status.state === 'post') return;
  const delay = app.summary.status.state === 'in' ? 12000 : 40000;
  app.detailPoll = window.setInterval(() => {
    if (document.hidden) return;
    refreshGame(app.openGameId, { initial: false });
  }, delay);
}

/* ------------------------------------------------------------------ */
/* game detail                                                         */
/* ------------------------------------------------------------------ */
function mergeTeam(base = {}, extra = {}) {
  return {
    ...base,
    ...extra,
    abbr: extra.abbr || base.abbr,
    name: extra.name || base.name,
    displayName: extra.displayName || base.displayName,
    logo: extra.logo || base.logo,
    color: extra.color || base.color,
    altColor: extra.altColor || base.altColor,
    record: extra.record || base.record,
    linescores: extra.linescores?.length ? extra.linescores : base.linescores,
  };
}

function mergeGameWithSummary(game, summary) {
  if (!summary) return game;
  return {
    ...game,
    startTime: game.startTime || summary.date,
    away: mergeTeam(game.away, summary.away),
    home: mergeTeam(game.home, summary.home),
    status: summary.status || game.status,
    venue: {
      ...(game.venue || {}),
      ...(summary.venue || {}),
      name: summary.venue?.name || game.venue?.name || '',
      city: summary.venue?.city || game.venue?.city || '',
    },
    broadcasts: summary.broadcasts?.length ? summary.broadcasts : game.broadcasts,
  };
}

function updateDayFromSummary(summary) {
  const idx = app.day?.games?.findIndex((g) => String(g.id) === String(summary.id));
  if (idx >= 0) {
    const merged = mergeGameWithSummary(app.day.games[idx], summary);
    app.day.games[idx] = merged;
    app.daySignature = daySignature(app.day);
    if (app.currentGame?.id === merged.id) app.currentGame = merged;
  }
}

function paintGameDetail() {
  if (!app.gameHandle || !app.currentGame) return;
  const sheet = app.gameHandle.el.querySelector('.sheet');
  if (!sheet) return;
  const scrollTop = sheet.scrollTop;
  const focusedTab = document.activeElement?.dataset?.action === 'detail-tab' ? document.activeElement.dataset.tab : null;
  sheet.innerHTML = renderGameDetail({
    game: app.currentGame,
    summary: app.summary,
    tab: detailUi.tab,
    loading: app.summaryLoading,
    error: app.summaryError,
    favorite:
      store.isFavorite(app.currentGame?.away?.abbr) || store.isFavorite(app.currentGame?.home?.abbr),
    hasReminder: store.hasReminder(app.openGameId),
  });
  sheet.scrollTop = scrollTop;
  if (focusedTab) sheet.querySelector(`[data-action="detail-tab"][data-tab="${focusedTab}"]`)?.focus({ preventScroll: true });
}

function openGameOverlay(game, { loading = false } = {}) {
  resetDetailUi(game.id);
  app.currentGame = game;
  app.summary = null;
  app.summaryError = null;
  app.summaryLoading = loading;
  app.summarySignature = '';
  app.openGameId = game.id;
  document.title = `${matchupCn(game)} · 场边`;
  const handle = openOverlay({
    html: renderGameDetail({
      game,
      summary: null,
      loading,
      favorite: store.isFavorite(game.away?.abbr) || store.isFavorite(game.home?.abbr),
      hasReminder: store.hasReminder(game.id),
    }),
    className: 'sheet--game',
    label: `${matchupCn(game)} 比赛详情`,
    onClose: () => {
      const wasHash = location.hash.startsWith('#/game/');
      app.gameHandle = null;
      app.openGameId = null;
      stopDetailPoll();
      if (wasHash) {
        history.replaceState(null, '', app.currentBase?.hash || `#/today/${todayStr()}`);
      }
      document.title = pageTitleFor(app.currentBase || { name: 'today', date: todayStr() });
      renderShell();
      if (app.currentBase?.name === 'today' || app.currentBase?.name === 'schedule') {
        refreshDay({ manual: false });
      }
    },
  });
  handle.el.querySelector('.sheet').dataset.kind = 'game';
  app.gameHandle = handle;
}

async function openGameRoute(id) {
  if (app.openGameId === id && app.gameHandle) return;
  closeGameOverlaySilent();
  const game = findGame(id) || (app.currentGame?.id === id ? app.currentGame : null);
  if (game) {
    openGameOverlay(game, { loading: true });
    await refreshGame(id, { initial: true });
    return;
  }
  const loadingHtml = `<div class="game-detail game-detail--loading">
    <div class="detail-topbar"><span class="detail-league"><span class="detail-league__mark">NBA</span>比赛详情</span>
      <button class="sheet__close icon-btn" data-close-sheet aria-label="关闭">${icon('close')}</button>
    </div>
    <div class="detail-boot">${spinner()}<p>正在接入比赛…</p></div>
  </div>`;
  const handle = openOverlay({
    html: loadingHtml,
    className: 'sheet--game',
    label: '比赛详情',
    onClose: () => {
      app.gameHandle = null;
      app.openGameId = null;
      stopDetailPoll();
      if (location.hash.startsWith('#/game/')) history.replaceState(null, '', app.currentBase?.hash || `#/today/${todayStr()}`);
      document.title = pageTitleFor(app.currentBase || { name: 'today', date: todayStr() });
      renderShell();
    },
  });
  handle.el.querySelector('.sheet').dataset.kind = 'game';
  app.gameHandle = handle;
  app.openGameId = id;
  try {
    const summary = await api.getGame(id);
    if (!summary.away || !summary.home) throw new Error('比赛数据不完整');
    const gameFromSummary = {
      id: summary.id,
      startTime: summary.date || new Date().toISOString(),
      status: summary.status,
      away: summary.away,
      home: summary.home,
      venue: summary.venue,
      broadcasts: summary.broadcasts,
      link: '',
    };
    app.currentGame = gameFromSummary;
    app.summary = summary;
    app.summarySignature = summarySignature(summary);
    app.summaryLoading = false;
    paintGameDetail();
    startDetailPoll();
  } catch (err) {
    app.summaryError = err?.message || '比赛加载失败';
    app.summaryLoading = false;
    const sheet = app.gameHandle?.el.querySelector('.sheet');
    if (sheet) {
      sheet.innerHTML = `<div class="game-detail game-detail--loading">
        <div class="detail-topbar"><span class="detail-league"><span class="detail-league__mark">NBA</span>比赛详情</span>
          <button class="sheet__close icon-btn" data-close-sheet aria-label="关闭">${icon('close')}</button>
        </div>
        <div class="detail-boot">${errorState(app.summaryError, { retry: 'retry-game' })}</div>
      </div>`;
    }
  }
}

function summarySignature(summary) {
  if (!summary) return '';
  return JSON.stringify([
    summary.status?.state,
    summary.status?.period,
    summary.status?.clock,
    summary.away?.score,
    summary.home?.score,
    summary.plays?.length,
    summary.plays?.at(-1)?.id,
    summary.boxscore?.players?.map((p) => [p.teamId, p.athletes?.length]),
  ]);
}

async function refreshGame(id, { initial = false } = {}) {
  if (!id) return;
  if (app.summaryLoading && !initial) return;
  app.summaryLoading = true;
  if (initial) paintGameDetail();
  try {
    const summary = await api.getGame(id, { force: !initial });
    if (String(app.openGameId) !== String(id)) return;
    const sig = summarySignature(summary);
    const changed = sig !== app.summarySignature;
    app.summary = summary;
    app.summarySignature = sig;
    app.summaryError = null;
    app.currentGame = mergeGameWithSummary(app.currentGame, summary);
    updateDayFromSummary(summary);
    app.summaryLoading = false;
    if (initial || changed) paintGameDetail();
    if (summary.status.state === 'post') stopDetailPoll();
    else startDetailPoll();
  } catch (err) {
    if (String(app.openGameId) !== String(id)) return;
    app.summaryError = err?.message || '比赛数据加载失败';
    app.summaryLoading = false;
    if (initial || !app.summary) paintGameDetail();
  }
}

function closeGameOverlaySilent() {
  if (app.gameHandle) {
    closeOverlay(app.gameHandle, { silent: true });
    app.gameHandle = null;
  }
  app.openGameId = null;
  stopDetailPoll();
}

/* ------------------------------------------------------------------ */
/* team sheet                                                          */
/* ------------------------------------------------------------------ */
function paintTeamSheet() {
  if (!app.teamHandle || !app.teamState) return;
  const sheet = app.teamHandle.el.querySelector('.sheet');
  if (!sheet) return;
  const scrollTop = sheet.scrollTop;
  sheet.innerHTML = renderTeamSheet({
    abbr: app.teamState.abbr,
    standings: app.standings,
    schedule: app.teamState.schedule,
    todayGame: app.day?.games?.find(
      (g) => g.away?.abbr === app.teamState.abbr || g.home?.abbr === app.teamState.abbr,
    ),
    loading: app.teamState.loading,
    error: app.teamState.error,
    favorite: store.isFavorite(app.teamState.abbr),
  });
  sheet.scrollTop = scrollTop;
}

async function fetchTeamSchedule() {
  if (!app.teamState) return;
  app.teamState.loading = true;
  app.teamState.error = null;
  paintTeamSheet();
  try {
    app.teamState.schedule = await api.getTeamSchedule(app.teamState.teamId);
  } catch (err) {
    app.teamState.error = err?.message || '赛程加载失败';
  } finally {
    app.teamState.loading = false;
    paintTeamSheet();
  }
}

async function openTeam(abbr) {
  if (!abbr) return;
  if (!app.standings) {
    toast('正在载入球队数据…');
    await ensureStandings();
    if (!app.standings) {
      toast('球队数据暂时不可用', { type: 'error' });
      return;
    }
  }
  const found = findTeam(abbr);
  if (!found?.team?.id) {
    toast('没有找到这支球队', { type: 'error' });
    return;
  }
  if (app.teamHandle) closeOverlay(app.teamHandle, { silent: true });
  app.teamState = { abbr, teamId: found.team.id, schedule: null, loading: true, error: null };
  const handle = openOverlay({
    html: renderTeamSheet({
      abbr,
      standings: app.standings,
      schedule: null,
      todayGame: app.day?.games?.find((g) => g.away?.abbr === abbr || g.home?.abbr === abbr),
      loading: true,
      favorite: store.isFavorite(abbr),
    }),
    className: 'sheet--team',
    label: `${cnName(found.team)}球队主页`,
  });
  handle.el.querySelector('.sheet').dataset.kind = 'team';
  handle.onClose = () => {
    app.teamHandle = null;
  };
  app.teamHandle = handle;
  fetchTeamSchedule();
  if (app.day?.date !== todayStr()) {
    ensureDay(todayStr()).then(() => {
      if (app.teamState?.abbr === abbr) paintTeamSheet();
    });
  }
}

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */
function settingsHtml() {
  return renderSettings({
    store,
    day: app.day,
    installAvailable: Boolean(app.installPrompt),
    permission: permissionState(),
  });
}

function openSettings() {
  if (app.settingsHandle) {
    refreshSettings();
    return;
  }
  const handle = openOverlay({
    html: settingsHtml(),
    className: 'sheet--settings',
    label: '设置',
  });
  handle.el.querySelector('.sheet').dataset.kind = 'settings';
  app.settingsHandle = handle;
  const originalClose = handle.onClose;
  handle.onClose = (...args) => {
    app.settingsHandle = null;
    if (originalClose) originalClose(...args);
  };
}

function refreshSettings() {
  if (!app.settingsHandle) return;
  const sheet = app.settingsHandle.el.querySelector('.sheet');
  if (!sheet) return;
  const scroll = sheet.querySelector('.settings-body')?.scrollTop || 0;
  sheet.innerHTML = settingsHtml();
  const body = sheet.querySelector('.settings-body');
  if (body) body.scrollTop = scroll;
}

/* ------------------------------------------------------------------ */
/* watch                                                               */
/* ------------------------------------------------------------------ */
function openWatch(id) {
  const game = findGame(id) || (app.currentGame?.id === id ? app.currentGame : null);
  if (!game) {
    toast('比赛信息还没准备好', { type: 'error' });
    return;
  }
  const handle = openOverlay({
    html: renderWatchSheet(game),
    className: 'sheet--modal sheet--watch',
    label: '观赛渠道',
    modal: true,
  });
  handle.el.querySelector('.sheet').dataset.kind = 'watch';
}

/* ------------------------------------------------------------------ */
/* actions                                                             */
/* ------------------------------------------------------------------ */
function toggleFavorite(abbr) {
  if (!abbr) return;
  const on = store.toggleFavorite(abbr);
  const team = teamMap().get(abbr);
  toast(on ? `已关注 ${cnName(team || { abbr })}` : `已取消关注 ${cnName(team || { abbr })}`, {
    type: on ? 'success' : 'default',
  });
  renderShell();
  renderCurrent();
  syncNativeReminders(app.day?.games || [], store);
  if (app.teamHandle && app.teamState?.abbr === abbr) paintTeamSheet();
  if (app.settingsHandle) refreshSettings();
}

function toggleReminder(id, date) {
  const game = findGame(id) || (app.currentGame?.id === id ? app.currentGame : null);
  if (!game) {
    toast('比赛信息还没准备好', { type: 'error' });
    return;
  }
  if (game.status.state !== 'pre') {
    toast(game.status.state === 'in' ? '比赛已经开始，开赛提醒已错过' : '比赛已经结束，不能设置开赛提醒', {
      type: 'error',
    });
    return;
  }
  const meta = {
    label: `${cnName(game.away)} vs ${cnName(game.home)}`,
    startTime: game.startTime,
    matchup: `${game.away.abbr}-${game.home.abbr}`,
  };
  const on = store.toggleReminder(id, date || beijingDateOf(game.startTime), meta);
  if (on) {
    scheduleNativeReminder(game, store);
    if (permissionState() === 'default' && !store.settings.notificationsEnabled) {
      toast(
        isNativeApp()
          ? '提醒已添加。开启系统通知后才会弹出。'
          : '提醒已添加。开启浏览器通知后才会弹出。',
        { duration: 5000 },
      );
    } else if (permissionState() === 'denied') {
      toast('提醒已添加，但通知权限被拒绝了。', { type: 'error', duration: 5000 });
    } else {
      toast('已设置开赛提醒', { type: 'success' });
    }
  } else {
    cancelNativeReminder(id);
    toast('已取消提醒');
  }
  renderShell();
  renderCurrent();
  if (app.openGameId === id) paintGameDetail();
  if (app.settingsHandle) refreshSettings();
}

async function enableNotifications() {
  const result = await requestPermission();
  if (result === 'granted') {
    store.updateSettings({ notificationsEnabled: true, start: true });
    toast('通知已开启', { type: 'success' });
    try {
      checkNotifications({ games: app.day?.games || [], store });
      syncNativeReminders(app.day?.games || [], store);
      if (
        isNativeApp() &&
        window.CourtsideNative?.canScheduleExactAlarms &&
        !window.CourtsideNative.canScheduleExactAlarms()
      ) {
        toast('为了保证准时提醒，请在系统设置中允许“闹钟和提醒”。', { duration: 6000 });
        window.setTimeout(() => window.CourtsideNative.requestExactAlarmPermission?.(), 900);
      }
    } catch {
      /* ignore */
    }
  } else if (result === 'denied') {
    toast(
      isNativeApp()
        ? '通知权限被拒绝，请在系统设置 → 应用 → 场边 NBA → 通知中开启'
        : '通知权限被拒绝，请在浏览器站点设置中修改',
      { type: 'error', duration: 5000 },
    );
  } else if (result === 'unsupported') {
    toast('当前浏览器不支持通知', { type: 'error' });
  }
  refreshSettings();
}

function clearAllData() {
  cancelAllNativeReminders();
  store.clearAll();
  if (app.confirmHandle) {
    closeOverlay(app.confirmHandle, { silent: true });
    app.confirmHandle = null;
  }
  if (app.settingsHandle) {
    closeOverlay(app.settingsHandle, { silent: true });
    app.settingsHandle = null;
  }
  renderShell();
  renderCurrent();
  toast('本机数据已清除');
}

function showClearConfirm() {
  const handle = openOverlay({
    html: `<div class="confirm-dialog" data-kind="confirm">
      <span class="confirm-dialog__icon">${icon('info')}</span>
      <h2>清除本机数据？</h2>
      <p>关注球队、比赛提醒和通知设置都会被清空，操作无法撤销。缓存中的比分快照也会移除。</p>
      <div class="confirm-dialog__actions">
        <button class="btn btn--ghost" data-close-sheet>取消</button>
        <button class="btn btn--danger" data-action="confirm-clear">确认清除</button>
      </div>
    </div>`,
    className: 'sheet--modal',
    label: '确认清除数据',
    modal: true,
  });
  handle.el.querySelector('.sheet').dataset.kind = 'confirm';
  handle.onClose = () => {
    app.confirmHandle = null;
  };
  app.confirmHandle = handle;
}

function installApp() {
  if (!app.installPrompt) {
    toast('请使用浏览器菜单中的“添加到主屏幕”');
    return;
  }
  app.installPrompt.prompt();
  app.installPrompt.userChoice.then(() => {
    app.installPrompt = null;
    refreshSettings();
  });
}

function shiftDates(dir) {
  const base = app.currentBase;
  if (!base) return;
  const next = addDays(base.date, dir * 3);
  const target = base.name === 'schedule' ? `#/schedule/${next}` : `#/today/${next}`;
  location.hash = target;
}

function refreshAction() {
  const base = app.currentBase;
  if (!base) return;
  if (base.name === 'today' || base.name === 'schedule') {
    refreshDay({ manual: true });
  } else if (base.name === 'teams') {
    ensureStandings({ force: true }).then(() => {
      renderCurrent();
      toast('排名已更新');
    });
  } else if (base.name === 'season') {
    ensureSeason({ force: true }).then(() => {
      renderCurrent();
      toast(app.season ? '赛季赛程已更新' : '赛季赛程加载失败', { type: app.season ? 'success' : 'error' });
    });
  } else {
    toast('已经是最新内容');
  }
}

/* ------------------------------------------------------------------ */
/* event delegation                                                    */
/* ------------------------------------------------------------------ */
document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (target.matches('button, a') && target.disabled) return;

  switch (action) {
    case 'open-game': {
      event.preventDefault();
      if (app.teamHandle) {
        closeOverlay(app.teamHandle, { silent: true });
        app.teamHandle = null;
      }
      const gameId =
        target.dataset.id || target.dataset.gameId || target.closest('[data-game-id]')?.dataset.gameId;
      if (gameId) location.hash = `#/game/${gameId}`;
      break;
    }
    case 'open-team':
      event.preventDefault();
      await openTeam(target.dataset.abbr);
      break;
    case 'toggle-favorite':
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(target.dataset.abbr);
      break;
    case 'toggle-reminder': {
      event.preventDefault();
      event.stopPropagation();
      const id = target.dataset.id || app.openGameId;
      const game = findGame(id);
      const date = target.dataset.date || (game?.startTime ? beijingDateOf(game.startTime) : undefined);
      toggleReminder(id, date);
      break;
    }
    case 'watch':
      event.preventDefault();
      openWatch(target.dataset.id || app.openGameId);
      break;
    case 'open-settings':
      event.preventDefault();
      openSettings();
      break;
    case 'enable-notifications':
      event.preventDefault();
      enableNotifications();
      break;
    case 'disable-notifications':
      event.preventDefault();
      store.updateSettings({ notificationsEnabled: false });
      cancelAllNativeReminders();
      refreshSettings();
      toast('通知已暂停');
      break;
    case 'toggle-setting': {
      const key = target.dataset.key;
      if (!key) break;
      store.updateSettings({ [key]: !store.settings[key] });
      syncNativeReminders(app.day?.games || [], store);
      refreshSettings();
      break;
    }
    case 'set-refresh':
      store.updateSettings({ refresh: Number(target.dataset.value) });
      startPolling();
      refreshSettings();
      break;
    case 'test-notification': {
      const result = await requestPermission();
      if (result !== 'granted') {
        toast('请先允许浏览器通知', { type: 'error' });
        refreshSettings();
        break;
      }
      store.updateSettings({ notificationsEnabled: true });
      const ok = testNotification();
      toast(ok ? '测试通知已发送' : '通知发送失败', { type: ok ? 'success' : 'error' });
      refreshSettings();
      break;
    }
    case 'install-app':
      event.preventDefault();
      installApp();
      break;
    case 'clear-data':
      event.preventDefault();
      showClearConfirm();
      break;
    case 'confirm-clear':
      event.preventDefault();
      clearAllData();
      break;
    case 'download-ics': {
      const game = findGame(target.dataset.id) || app.currentGame;
      if (game && downloadGameICS(game)) toast('日历文件已生成', { type: 'success' });
      else toast('比赛信息还没准备好', { type: 'error' });
      break;
    }
    case 'download-day-ics': {
      const games = app.day?.games || [];
      if (downloadDayICS(games, target.dataset.date || app.day?.date)) toast('当日赛程已导出', { type: 'success' });
      else toast('当天没有可导出的比赛', { type: 'error' });
      break;
    }
    case 'detail-tab':
      event.preventDefault();
      detailUi.tab = target.dataset.tab;
      paintGameDetail();
      break;
    case 'detail-team':
      event.preventDefault();
      detailUi.team = target.dataset.team;
      paintGameDetail();
      break;
    case 'plays-filter':
      event.preventDefault();
      detailUi.playsFilter = target.dataset.filter;
      paintGameDetail();
      break;
    case 'conference':
      event.preventDefault();
      app.activeConference = target.dataset.conf;
      renderCurrent();
      break;
    case 'season-phase':
      event.preventDefault();
      app.seasonPhase = target.dataset.phase || 'all';
      app.seasonMonth = '';
      app.seasonTeamOpen = false;
      renderCurrent();
      break;
    case 'season-month':
      event.preventDefault();
      app.seasonMonth = target.dataset.month || '';
      app.seasonTeamOpen = false;
      renderCurrent();
      break;
    case 'toggle-team-picker':
      event.preventDefault();
      app.seasonTeamOpen = !app.seasonTeamOpen;
      renderCurrent();
      break;
    case 'close-team-picker':
      event.preventDefault();
      app.seasonTeamOpen = false;
      renderCurrent();
      break;
    case 'season-team':
      event.preventDefault();
      app.seasonTeam = target.dataset.team || 'all';
      app.seasonMonth = '';
      app.seasonTeamOpen = false;
      renderCurrent();
      break;
    case 'set-lead':
      event.preventDefault();
      store.updateSettings({ lead: Number(target.dataset.value) });
      syncNativeReminders(app.day?.games || [], store);
      refreshSettings();
      break;
    case 'scroll-teams':
      event.preventDefault();
      $('#all-teams')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    case 'shift-dates':
      event.preventDefault();
      shiftDates(Number(target.dataset.dir));
      break;
    case 'refresh':
      event.preventDefault();
      refreshAction();
      break;
    case 'retry-season': {
      event.preventDefault();
      app.seasonError = null;
      await ensureSeason({ force: true });
      renderCurrent();
      break;
    }
    case 'retry-data': {
      event.preventDefault();
      const base = app.currentBase;
      if (!base) break;
      app.stale = null;
      app.dayError = null;
      await ensureDay(base.date, { force: true });
      renderCurrent();
      break;
    }
    case 'retry-game':
      event.preventDefault();
      if (app.openGameId) refreshGame(app.openGameId, { initial: true });
      break;
    case 'retry-team':
      event.preventDefault();
      fetchTeamSchedule();
      break;
    default:
      break;
  }
});


document.addEventListener('keydown', (event) => {
  const isTyping = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '');
  if (isTyping) return;
  if (event.key === 'Enter' || event.key === ' ') {
    const roleBtn = event.target.closest('[role="button"][tabindex]');
    if (roleBtn && roleBtn.dataset.action === 'open-game') {
      event.preventDefault();
      location.hash = `#/game/${roleBtn.dataset.gameId}`;
      return;
    }
  }
  if (app.gameHandle) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const base = app.currentBase;
    if (!base || !['today', 'schedule'].includes(base.name)) return;
    if (document.activeElement?.closest('.date-strip, .calendar-card, .detail-tabs')) return;
    event.preventDefault();
    const next = addDays(base.date, event.key === 'ArrowLeft' ? -1 : 1);
    location.hash = base.name === 'schedule' ? `#/schedule/${next}` : `#/today/${next}`;
  }
  if (event.key.toLowerCase() === 't') {
    location.hash = `#/today/${todayStr()}`;
  }
});

/* ------------------------------------------------------------------ */
/* router                                                              */
/* ------------------------------------------------------------------ */
async function hydrateBase(base, seq) {
  if (base.name === 'today' || base.name === 'schedule') {
    if (app.dayDate !== base.date) {
      app.day = null;
      app.dayDate = base.date;
      app.stale = null;
      app.dayError = null;
    }
    const promise = ensureDay(base.date);
    renderCurrent();
    await promise;
    if (seq !== app.routeSeq) return;
    renderCurrent();
    ensureAux();
    return;
  }
  if (base.name === 'teams') {
    const promise = ensureStandings();
    renderCurrent();
    await promise;
    if (seq !== app.routeSeq) return;
    renderCurrent();
    ensureAux();
    return;
  }
  if (base.name === 'season') {
    const promise = ensureSeason();
    renderCurrent();
    await promise;
    if (seq !== app.routeSeq) return;
    renderCurrent();
    ensureAux();
    return;
  }
  if (base.name === 'guide') {
    renderCurrent();
    if (app.day?.date !== todayStr()) {
      await ensureDay(todayStr());
      if (seq !== app.routeSeq) return;
    }
    renderCurrent();
    ensureAux();
  }
}

async function handleRoute() {
  const parsed = parseRoute();
  if (parsed.name !== 'season') app.seasonTeamOpen = false;
  const seq = ++app.routeSeq;
  if (parsed.name === 'game') {
    if (!app.currentBase) {
      const base = { name: 'today', date: todayStr(), hash: `#/today/${todayStr()}` };
      app.currentBase = base;
      renderShell();
      await hydrateBase(base, seq);
      if (seq !== app.routeSeq) return;
    }
    renderShell();
    await openGameRoute(parsed.id);
    return;
  }

  const base = { ...parsed, hash: location.hash };
  app.currentBase = base;
  closeGameOverlaySilent();
  renderShell();
  stopPolling();
  if (base.name === 'today' || base.name === 'schedule' || base.name === 'guide') {
    // guide reads the current day's national broadcasts
    if (base.name === 'guide' && app.dayDate !== todayStr()) app.dayDate = null;
  }
  await hydrateBase(base, seq);
  if (seq !== app.routeSeq) return;
  startPolling();
  updateTopbarMeta();
}

function normalizeHash() {
  if (!location.hash || !location.hash.startsWith('#/')) {
    history.replaceState(null, '', `#/today/${todayStr()}`);
  }
}

function registerServiceWorker() {
  if (STANDALONE) return;
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    app.installPrompt = event;
    if (app.settingsHandle) refreshSettings();
  });
  window.addEventListener('appinstalled', () => {
    app.installPrompt = null;
    if (app.settingsHandle) refreshSettings();
    toast('已安装到场边', { type: 'success' });
  });
}

function setupConnectivity() {
  window.addEventListener('online', () => {
    toast('网络已恢复', { type: 'success' });
    if (app.currentBase?.name === 'today' || app.currentBase?.name === 'schedule') refreshDay({ manual: false });
  });
  window.addEventListener('offline', () => {
    toast('已离线，将展示最近缓存的数据');
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !app.gameHandle && ['today', 'schedule'].includes(app.currentBase?.name)) {
      refreshDay({ manual: false });
    }
  });
}

function boot() {
  normalizeHash();
  renderShell();
  setupInstallPrompt();
  setupConnectivity();
  registerServiceWorker();
  ensureAux();
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

boot();

// Close the custom team picker when tapping anywhere outside it.
document.addEventListener('click', (event) => {
  if (!app.seasonTeamOpen) return;
  if (event.target.closest('[data-team-picker]')) return;
  if (event.target.closest('[data-action="toggle-team-picker"]')) return;
  app.seasonTeamOpen = false;
  if (app.currentBase?.name === 'season') renderCurrent();
});
