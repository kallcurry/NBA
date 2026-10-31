/* Game cards: date strip, hero, list rows and mini schedule rows. */

import {
  addDays,
  beijingDateOf,
  broadcastShort,
  cnName,
  countdown,
  dateParts,
  fmtTime,
  gameMargin,
  isLive,
  leaderOf,
  matchupCn,
  relativeDay,
  rgba,
  readableTeamColor,
  statusShort,
  statusText,
  todayStr,
} from '../data.js';
import { broadcastChips, icon, liveBadge, logo } from '../ui.js';

export function pickFeatured(games = []) {
  if (!games.length) return null;
  const closeLive = games
    .filter((g) => isLive(g) && gameMargin(g) <= 8)
    .sort((a, b) => gameMargin(a) - gameMargin(b));
  if (closeLive.length) return closeLive[0];
  const live = games.filter(isLive);
  if (live.length) return live.sort((a, b) => gameMargin(a) - gameMargin(b))[0];
  const upcoming = games.find((g) => g.status.state === 'pre');
  if (upcoming) return upcoming;
  return [...games].sort((a, b) => gameMargin(a) - gameMargin(b))[0];
}

function heroTags(game) {
  const tags = [];
  if (isLive(game)) tags.push(`<span class="tag tag--live">${liveBadge({ label: 'LIVE' })}</span>`);
  else if (game.status.state === 'pre') tags.push(`<span class="tag tag--accent">${icon('clock')}${countdown(game.startTime)}</span>`);
  else tags.push(`<span class="tag">${statusText(game.status)}</span>`);
  if (game.nationalTV) tags.push(`<span class="tag tag--national">${icon('tv')}全美直播</span>`);
  if (isLive(game) && gameMargin(game) <= 5) tags.push(`<span class="tag tag--hot">${icon('flame')}分差 ${gameMargin(game)} 分</span>`);
  else if (!isLive(game) && game.status.state !== 'pre') tags.push(`<span class="tag">分差 ${gameMargin(game)} 分</span>`);
  return tags.slice(0, 3).join('');
}

export function renderHero(game) {
  if (!game) return '';
  const awayColor = readableTeamColor(game.away.color);
  const homeColor = readableTeamColor(game.home.color);
  const pre = game.status.state === 'pre';
  const leader = leaderOf(game);
  const centerStatus = pre
    ? `<div class="hero__countdown">${countdown(game.startTime)}</div>
       <div class="hero__tip">${fmtTime(game.startTime)} 开赛 · 北京时间</div>`
    : `<div class="hero__status">${statusText(game.status)}</div>
       <div class="hero__tip">${leader ? `${cnName(leader)} 领先 ${gameMargin(game)} 分` : '比分胶着'}</div>`;

  return `<article class="hero" style="--away-color:${awayColor};--home-color:${homeColor};--away-glow:${rgba(
    awayColor,
    0.2,
  )};--home-glow:${rgba(homeColor, 0.2)}" data-game-id="${game.id}">
    <svg class="hero__court" viewBox="0 0 1200 420" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M0 54h1200M0 366h1200M600 0v420"/>
        <circle cx="600" cy="210" r="102"/>
        <circle cx="600" cy="210" r="7"/>
        <path d="M0 118h168v184H0M1200 118h-168v184h168"/>
        <path d="M168 150a92 92 0 0 1 0 120M1032 150a92 92 0 0 0 0 120"/>
      </g>
    </svg>
    <div class="hero__top">
      <span class="hero__eyebrow"><span class="hero__eyebrow-dot"></span>今日焦点 <span>/ GAME OF THE DAY</span></span>
      <div class="hero__tags">${heroTags(game)}</div>
    </div>
    <div class="hero__body">
      <div class="hero__team hero__team--away">
        ${logo(game.away, 'xl')}
        <div class="hero__team-copy">
          <span class="hero__team-city">${cnName(game.away)}</span>
          <span class="hero__team-abbr">${game.away.abbr}</span>
          <span class="hero__team-record">${game.away.record || '—'}</span>
        </div>
      </div>
      <div class="hero__center">
        <div class="hero__score ${pre ? 'is-pre' : ''}" data-hero-score>
          <span class="${game.away.winner ? 'is-winner' : ''}">${pre ? '—' : game.away.score}</span>
          <em>:</em>
          <span class="${game.home.winner ? 'is-winner' : ''}">${pre ? '—' : game.home.score}</span>
        </div>
        ${centerStatus}
      </div>
      <div class="hero__team hero__team--home">
        ${logo(game.home, 'xl')}
        <div class="hero__team-copy">
          <span class="hero__team-city">${cnName(game.home)}</span>
          <span class="hero__team-abbr">${game.home.abbr}</span>
          <span class="hero__team-record">${game.home.record || '—'}</span>
        </div>
      </div>
    </div>
    <div class="hero__bottom">
      <div class="hero__meta">
        <span class="hero__meta-item">${icon('location')}${game.venue.name || '球馆待定'}</span>
        <span class="hero__meta-item hero__broadcasters">${broadcastChips(game.broadcasts, { max: 3 })}</span>
      </div>
      <div class="hero__actions">
        <button class="btn btn--primary" data-action="open-game" data-id="${game.id}">
          进入比赛 ${icon('arrow-right')}
        </button>
        <button class="btn btn--ghost" data-action="watch" data-id="${game.id}">
          ${icon('tv')}观看
        </button>
      </div>
    </div>
  </article>`;
}

export function renderGameRow(game, { reminders = {}, favorites = [] } = {}) {
  const pre = game.status.state === 'pre';
  const post = game.status.state === 'post';
  const live = game.status.state === 'in';
  const hasReminder = Boolean(reminders[game.id]);
  const involvesFavorite =
    favorites.includes(game.away.abbr) || favorites.includes(game.home.abbr);
  const timeText = pre
    ? fmtTime(game.startTime)
    : live
      ? game.status.isHalftime
        ? '中场'
        : game.status.clock || 'LIVE'
      : '完场';
  const subText = pre
    ? relativeDay(beijingDateOf(game.startTime))
    : live
      ? game.status.isHalftime
        ? '半场休息'
        : game.status.period > 4
          ? '加时'
          : `第${game.status.period || 1}节`
      : /ot|overtime/i.test(game.status.detail || '')
        ? '加时结束'
        : '最终';

  return `<article class="game-row ${live ? 'is-live' : ''} ${post ? 'is-final' : ''} ${
    involvesFavorite ? 'is-favorite' : ''
  }" data-game-id="${game.id}" data-action="open-game" tabindex="0" role="button" aria-label="${matchupCn(game)}，${
    live ? statusText(game.status) : pre ? `${fmtTime(game.startTime)} 开赛` : '比赛结束'
  }">
    <div class="game-row__status">
      ${live ? liveBadge({ label: 'LIVE' }) : ''}
      <span class="game-row__time ${live ? 'is-live' : ''}">${timeText}</span>
      <span class="game-row__sub">${subText}</span>
    </div>
    <div class="game-row__matchup">
      <div class="game-team ${game.away.winner ? 'is-winner' : ''}">
        ${logo(game.away, 'md')}
        <span class="game-team__copy">
          <span class="game-team__name">${cnName(game.away)}<em>${game.away.abbr}</em></span>
          <span class="game-team__record">${game.away.record || '—'}</span>
        </span>
        <span class="game-team__score ${pre ? 'is-pre' : ''}" data-score="${game.away.score}">${pre ? '—' : game.away.score}</span>
      </div>
      <div class="game-team ${game.home.winner ? 'is-winner' : ''}">
        ${logo(game.home, 'md')}
        <span class="game-team__copy">
          <span class="game-team__name">${cnName(game.home)}<em>${game.home.abbr}</em></span>
          <span class="game-team__record">${game.home.record || '—'}</span>
        </span>
        <span class="game-team__score ${pre ? 'is-pre' : ''}" data-score="${game.home.score}">${pre ? '—' : game.home.score}</span>
      </div>
    </div>
    <div class="game-row__side">
      <div class="game-row__broadcasts">${broadcastChips(game.broadcasts, { max: 1, compact: true })}</div>
      ${
        pre
          ? `<button class="icon-btn bell-btn ${hasReminder ? 'is-on' : ''}" data-action="toggle-reminder" data-id="${game.id}" data-date="${beijingDateOf(
              game.startTime,
            )}" aria-label="${hasReminder ? '取消提醒' : '设置开赛提醒'}" title="${
              hasReminder ? '已设置提醒' : '设置开赛提醒'
            }">${icon(hasReminder ? 'bell-ring' : 'bell')}</button>`
          : ''
      }
      <span class="game-row__chevron">${icon('chevron-right')}</span>
    </div>
  </article>`;
}

export function renderGameList(games, { reminders, favorites, empty }) {
  if (!games.length) return empty || '';
  return `<div class="game-list">${games
    .map((g) => renderGameRow(g, { reminders, favorites }))
    .join('')}</div>`;
}

export function renderDateStrip(selected, calendarDates = [], { compact = false } = {}) {
  const today = todayStr();
  const start = addDays(today, -2);
  const days = Array.from({ length: 9 }, (_, i) => addDays(start, i));
  const set = new Set(calendarDates);
  return `<div class="date-strip-wrap ${compact ? 'is-compact' : ''}">
    <button class="date-strip__arrow" data-action="shift-dates" data-dir="-1" aria-label="前三天">${icon('chevron-left')}</button>
    <div class="date-strip" role="list">
      ${days
        .map((date) => {
          const p = dateParts(date);
          const active = date === selected;
          const isToday = date === today;
          const hasGames = set.has(date);
          return `<a class="date-chip ${active ? 'is-active' : ''} ${isToday ? 'is-today' : ''}" href="#/today/${date}" role="listitem" aria-current="${
            active ? 'date' : 'false'
          }">
            <span class="date-chip__weekday">${isToday ? '今天' : p.weekdayShort}</span>
            <span class="date-chip__day">${p.day}</span>
            <span class="date-chip__dot ${hasGames ? 'has-games' : ''}"></span>
          </a>`;
        })
        .join('')}
    </div>
    <button class="date-strip__arrow" data-action="shift-dates" data-dir="1" aria-label="后三天">${icon('chevron-right')}</button>
  </div>`;
}

function miniDate(iso) {
  const date = beijingDateOf(iso);
  const rel = relativeDay(date);
  if (rel === '今天' || rel === '明天' || rel === '昨天') return rel;
  const p = dateParts(date);
  return `${p.month}/${p.day}`;
}

export function renderMiniGame(entry, { showDate = true } = {}) {
  const status = entry.status?.state;
  const result = entry.result;
  return `<button class="mini-game" data-action="open-game" data-id="${entry.id}">
    <span class="mini-game__date">${showDate ? miniDate(entry.date) : entry.isHome ? '主' : '客'}</span>
    <span class="mini-game__opp">${logo(entry.opponent, 'xs')}<span>${entry.isHome ? 'vs' : '@'} ${cnName(
      entry.opponent,
    )}</span></span>
    <span class="mini-game__result ${result === 'W' ? 'is-win' : result === 'L' ? 'is-loss' : ''}">${
      status === 'post'
        ? `${result} ${entry.teamScore}-${entry.opponentScore}`
        : status === 'in'
          ? `${entry.teamScore}-${entry.opponentScore}`
          : fmtTime(entry.date)
    }</span>
  </button>`;
}

export function renderBroadcastPill(name, { national = false } = {}) {
  return `<span class="broadcast-chip ${national ? 'is-national' : ''}">${icon('tv')}${broadcastShort(name)}</span>`;
}
