/* Today / selected game day view. */

import {
  addDays,
  beijingDateOf,
  cnName,
  dateParts,
  escapeHtml,
  fmtDateLong,
  fmtTime,
  gameMargin,
  isFinal,
  isLive,
  relativeDay,
  relativeTime,
  statusText,
  todayStr,
} from '../data.js';
import {
  broadcastChips,
  emptyState,
  errorState,
  icon,
  logo,
  sectionHeader,
  skeletonRows,
  spinner,
} from '../ui.js';
import { pickFeatured, renderDateStrip, renderGameList, renderHero } from '../components/game-card.js';

function dayHeadline(date, games) {
  const isToday = date === todayStr();
  const n = games.length;
  if (!n) return isToday ? '今天，球场休息' : `${relativeDay(date)}，没有比赛`;
  const label = isToday ? '今天' : relativeDay(date);
  return `${label}，有 <em>${n}</em> 场比赛`;
}

function summaryLine(games) {
  if (!games.length) return '可以看看接下来的赛程，或去关注你的主队。';
  const live = games.filter(isLive).length;
  const pre = games.filter((g) => g.status.state === 'pre').length;
  const post = games.filter(isFinal).length;
  const bits = [];
  if (live) bits.push(`<strong>${live}</strong> 场正在进行`);
  if (pre) bits.push(`<strong>${pre}</strong> 场即将开赛`);
  if (post) bits.push(`<strong>${post}</strong> 场已结束`);
  return `${bits.join(' · ')}<span class="dot-sep"></span>时间为北京时间`;
}

function renderFavoritesCard({ favorites, day, teams }) {
  const teamMap = new Map((teams || []).map((t) => [t.abbr, t]));
  const todayGames = day?.games || [];
  if (!favorites.length) {
    const quick = ['LAL', 'GS', 'BOS', 'DEN', 'OKC', 'SA']
      .map((abbr) => teamMap.get(abbr))
      .filter(Boolean)
      .slice(0, 6);
    return `<section class="rail-card rail-card--favorites">
      <div class="rail-card__head">
        <h3>${icon('star')}我的球队</h3>
        <a class="text-link" href="#/teams">全部</a>
      </div>
      <p class="rail-card__note">选几支主队，比赛会排在前面，开赛前也会提醒你。</p>
      <div class="quick-teams">
        ${
          quick.length
            ? quick
                .map(
                  (t) => `<button class="quick-team" data-action="toggle-favorite" data-abbr="${t.abbr}" title="关注${cnName(
                    t,
                  )}">${logo(t, 'xs')}<span>${cnName(t)}</span>${icon('plus')}</button>`,
                )
                .join('')
            : `<a class="btn btn--ghost btn--sm" href="#/teams">去选择球队</a>`
        }
      </div>
    </section>`;
  }

  const rows = favorites.slice(0, 4).map((abbr) => {
    const team = teamMap.get(abbr) || { abbr, name: abbr, logo: null };
    const game = todayGames.find((g) => g.away.abbr === abbr || g.home.abbr === abbr);
    let line = '<span class="fav-row__muted">今天没有比赛</span>';
    if (game) {
      const isHome = game.home.abbr === abbr;
      const opp = isHome ? game.away : game.home;
      if (game.status.state === 'pre') {
        line = `<span>${fmtTime(game.startTime)} <i>${isHome ? 'vs' : '@'}</i> ${cnName(opp)}</span>`;
      } else if (game.status.state === 'in') {
        const own = isHome ? game.home : game.away;
        line = `<span class="is-live">${statusText(game.status)} · ${own.score}-${
          isHome ? game.away.score : game.home.score
        }</span>`;
      } else {
        const own = isHome ? game.home : game.away;
        const won = own.score > (isHome ? game.away.score : game.home.score);
        line = `<span class="${won ? 'is-win' : 'is-loss'}">${won ? '胜' : '负'} ${own.score}-${
          isHome ? game.away.score : game.home.score
        }</span>`;
      }
    }
    return `<div class="fav-row" data-action="open-team" data-abbr="${abbr}">
      ${logo(team, 'sm')}
      <div class="fav-row__copy">
        <span class="fav-row__name">${cnName(team)}</span>
        ${line}
      </div>
      <button class="icon-btn icon-btn--tiny" data-action="toggle-favorite" data-abbr="${abbr}" aria-label="取消关注${cnName(
        team,
      )}">${icon('close')}</button>
    </div>`;
  });

  return `<section class="rail-card rail-card--favorites">
    <div class="rail-card__head">
      <h3>${icon('star')}我的球队</h3>
      <a class="text-link" href="#/teams">管理</a>
    </div>
    <div class="fav-list">${rows.join('')}</div>
    ${
      favorites.length > 4
        ? `<a class="rail-card__more" href="#/teams">还有 ${favorites.length - 4} 支球队 ${icon('arrow-right')}</a>`
        : ''
    }
  </section>`;
}

function renderNewsCard(news) {
  const items = (news?.articles || []).slice(0, 4);
  if (!items.length) return '';
  return `<section class="rail-card rail-card--news">
    <div class="rail-card__head">
      <h3>${icon('flame')}联盟速递</h3>
      <span class="rail-card__source">ESPN</span>
    </div>
    <div class="news-list">
      ${items
        .map(
          (item, i) => `<a class="news-item" href="${item.link}" target="_blank" rel="noopener noreferrer">
            <span class="news-item__index">${String(i + 1).padStart(2, '0')}</span>
            <span class="news-item__copy">
              <span class="news-item__headline">${escapeHtml(item.headline)}</span>
              <span class="news-item__time">${relativeTime(item.published)}</span>
            </span>
            ${icon('arrow-up-right', 'news-item__arrow')}
          </a>`,
        )
        .join('')}
    </div>
  </section>`;
}

function renderWatchCard(day) {
  const national = [...new Set((day?.games || []).flatMap((g) => g.broadcasts.filter((b) => b.national).map((b) => b.name)))];
  return `<section class="rail-card rail-card--watch">
    <div class="watch-card__art" aria-hidden="true">
      <svg viewBox="0 0 320 140" preserveAspectRatio="none">
        <g fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="160" cy="70" r="44"/>
          <circle cx="160" cy="70" r="3"/>
          <path d="M0 20h320M0 120h320M160 0v140"/>
          <path d="M0 44h52v52H0M320 44h-52v52h52"/>
        </g>
      </svg>
    </div>
    <div class="watch-card__copy">
      <span class="eyebrow eyebrow--small">${icon('tv')}官方观赛入口</span>
      <h3>去哪看，怎么选</h3>
      <p>League Pass、腾讯体育、咪咕、央视体育。只看持权平台，不碰盗链。</p>
      ${national.length ? `<div class="watch-card__today">今日全美直播 ${broadcastChips(
        national.map((n) => ({ name: n, national: true })),
        { max: 2, compact: true },
      )}</div>` : ''}
      <a class="text-link text-link--arrow" href="#/guide">查看观赛指南 ${icon('arrow-right')}</a>
    </div>
  </section>`;
}

function renderStale(stale, onRetry = true) {
  if (!stale) return '';
  const time = stale.savedAt
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(stale.savedAt))
    : '';
  return `<div class="stale-banner">
    ${icon('wifi-off')}
    <span>当前离线，正在展示 ${time} 缓存的数据。</span>
    ${onRetry ? `<button class="text-link" data-action="retry-data">重新连接</button>` : ''}
  </div>`;
}

function sectionFor(games, index, title, meta, opts) {
  return `<section class="game-section">
    ${sectionHeader({ index, title, meta })}
    ${renderGameList(games, opts)}
  </section>`;
}

export function renderToday({
  date,
  day,
  calendarDates = [],
  favorites = [],
  reminders = {},
  teams = [],
  news = null,
  loading = false,
  error = null,
  stale = null,
  refreshSeconds = 20,
}) {
  if (loading && !day) {
    return `<div class="page page--today">
      <div class="page-grid">
        <div class="page-primary">
          <div class="skeleton skeleton--eyebrow"></div>
          <div class="skeleton skeleton--headline"></div>
          <div class="skeleton skeleton--strip"></div>
          <div class="skeleton skeleton--hero"></div>
          ${skeletonRows(4)}
        </div>
        <aside class="page-rail"><div class="skeleton skeleton--rail"></div></aside>
      </div>
    </div>`;
  }

  const games = day?.games || [];
  const parts = dateParts(date);
  const live = games.filter(isLive).sort((a, b) => gameMargin(a) - gameMargin(b));
  const upcoming = games.filter((g) => g.status.state === 'pre');
  const finals = games.filter(isFinal).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const featured = pickFeatured(games);
  const isToday = date === todayStr();
  const empty = games.length === 0;

  let index = 0;
  const listOpts = { reminders, favorites };
  const liveSection = live.length
    ? sectionFor(live, String(++index).padStart(2, '0'), '正在直播', `${live.length} 场 · 每 ${refreshSeconds} 秒刷新`, {
        ...listOpts,
        empty: '',
      })
    : '';
  const upcomingSection = upcoming.length
    ? sectionFor(
        upcoming,
        String(++index).padStart(2, '0'),
        '即将开赛',
        `${upcoming.length} 场 · 北京时间`,
        { ...listOpts, empty: '' },
      )
    : '';
  const finalSection = finals.length
    ? sectionFor(
        finals,
        String(++index).padStart(2, '0'),
        isToday ? '今日战报' : '当日战报',
        `${finals.length} 场 · 已结束`,
        { ...listOpts, empty: '' },
      )
    : '';

  const nextDate = calendarDates.find((d) => d > date);
  const emptyBlock = empty && !error
    ? emptyState({
        iconName: 'schedule',
        title: isToday ? '今天没有 NBA 比赛' : '这一天没有安排比赛',
        description: nextDate
          ? `下一比赛日是 ${relativeDay(nextDate)}（${fmtDateLong(nextDate)}），可以先把这天记下来。`
          : '可以去赛程页看看接下来的比赛安排。',
        action: `<a class="btn btn--primary" href="#/schedule/${nextDate || addDays(date, 1)}">查看赛程 ${icon(
          'arrow-right',
        )}</a>`,
      })
    : '';

  return `<div class="page page--today">
    <div class="page-grid">
      <div class="page-primary">
        ${renderStale(stale)}
        ${error ? errorState(error) : ''}
        <header class="page-head">
          <div class="page-head__copy">
            <div class="eyebrow">${icon('today')}${isToday ? '今日比赛' : '比赛日'} <span>/ ${parts.year}</span></div>
            <h1 class="page-title">${error && !day ? '数据暂时没接上' : dayHeadline(date, games)}</h1>
            <p class="page-sub">${error && !day ? '请检查网络，或稍后重试。' : summaryLine(games)}</p>
          </div>
          <div class="day-stamp" aria-hidden="true">
            <span class="day-stamp__month">${String(parts.month).padStart(2, '0')}月</span>
            <span class="day-stamp__day">${String(parts.day).padStart(2, '0')}</span>
            <span class="day-stamp__weekday">${parts.weekdayShort}</span>
          </div>
        </header>

        ${renderDateStrip(date, calendarDates)}

        ${featured ? renderHero(featured) : emptyBlock}

        ${liveSection}
        ${upcomingSection}
        ${finalSection}

        ${
          loading
            ? `<div class="inline-loading">${spinner()}正在更新比分…</div>`
            : ''
        }

        ${
          games.length
            ? `<div class="page-note">
                ${icon('info')}
                <span>比分与赛程来自 ESPN，每 ${refreshSeconds} 秒自动刷新。所有时间均为北京时间。${
                  isToday ? '' : `当前查看：${fmtDateLong(date)}。`
                }</span>
              </div>`
            : ''
        }
      </div>

      <aside class="page-rail" aria-label="侧边信息">
        ${renderFavoritesCard({ favorites, day, teams })}
        ${renderWatchCard(day)}
        ${renderNewsCard(news)}
      </aside>
    </div>
  </div>`;
}
