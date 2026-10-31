/* Full-season schedule: phase filters, month strip and chronological list. */

import {
  beijingDateOf,
  cnName,
  dateParts,
  fmtDateLong,
  fmtTime,
  isFinal,
  isLive,
  relativeDay,
  statusText,
  todayStr,
} from '../data.js';
import { emptyState, errorState, icon, logo, spinner } from '../ui.js';
import { renderDateStrip } from '../components/game-card.js';

const PHASES = [
  { id: 'all', label: '全部' },
  { id: 'regular', label: '常规赛' },
  { id: 'preseason', label: '季前赛' },
  { id: 'playoffs', label: '季后赛' },
];

function monthKey(iso) {
  return beijingDateOf(iso).slice(0, 7);
}

function monthLabel(key) {
  const [year, month] = key.split('-');
  return `${year}年${Number(month)}月`;
}

function monthShort(key) {
  return `${Number(key.split('-')[1])}月`;
}

function chooseMonth(months, requested) {
  if (requested && months.some((m) => m.key === requested)) return requested;
  const current = todayStr().slice(0, 7);
  if (months.some((m) => m.key === current)) return current;
  return months[0]?.key || '';
}

function statusFor(game) {
  if (game.status.state === 'pre') {
    return { text: fmtTime(game.startTime), sub: '未开始', live: false };
  }
  if (game.status.state === 'in') {
    return {
      text: game.status.isHalftime ? '中场' : game.status.period > 4 ? '加时' : `第${game.status.period}节`,
      sub: game.status.clock || '进行中',
      live: true,
    };
  }
  return { text: '完场', sub: statusText(game.status), live: false };
}

function seasonRow(game, { reminders = {} } = {}) {
  const pre = game.status.state === 'pre';
  const st = statusFor(game);
  const hasReminder = Boolean(reminders[game.id]);
  return `<article class="season-row ${st.live ? 'is-live' : ''} ${game.phase === 'playoffs' ? 'is-playoff' : ''}" data-action="open-game" data-id="${game.id}" data-game-id="${game.id}" tabindex="0" role="button" aria-label="${cnName(game.away)} vs ${cnName(game.home)}">
    <div class="season-row__teams">
      <div class="season-team ${game.away.winner ? 'is-winner' : ''}">
        ${logo(game.away, 'md', '', true)}
        <span>${cnName(game.away)}</span>
        <b>${pre ? '—' : game.away.score}</b>
      </div>
      <div class="season-team ${game.home.winner ? 'is-winner' : ''}">
        ${logo(game.home, 'md', '', true)}
        <span>${cnName(game.home)}</span>
        <b>${pre ? '—' : game.home.score}</b>
      </div>
    </div>
    <span class="season-phase-tag ${game.phase === 'playoffs' ? 'is-playoffs' : ''}">${game.phaseLabel || '常规赛'}</span>
    <span class="season-row__status ${st.live ? 'is-live' : ''}">
      <strong>${st.text}</strong><em>${st.sub}</em>
    </span>
    ${
      pre
        ? `<button class="icon-btn bell-btn ${hasReminder ? 'is-on' : ''}" data-action="toggle-reminder" data-id="${game.id}" data-date="${beijingDateOf(
            game.startTime,
          )}" aria-label="${hasReminder ? '取消提醒' : '设置开赛提醒'}">${icon(
            hasReminder ? 'bell-ring' : 'bell',
          )}</button>`
        : '<span class="season-row__placeholder"></span>'
    }
  </article>`;
}

function seasonStats(season, games) {
  const finished = games.filter((g) => isFinal(g)).length;
  const live = games.filter((g) => isLive(g)).length;
  const upcoming = games.filter((g) => g.status.state === 'pre').length;
  return `<div class="season-stats">
    <div class="season-stat"><span>赛季总场次</span><strong>${season.count || games.length}</strong><em>REGULAR SEASON</em></div>
    <div class="season-stat"><span>已结束</span><strong>${finished}</strong><em>FINAL</em></div>
    <div class="season-stat"><span>进行中</span><strong>${live}</strong><em>LIVE</em></div>
    <div class="season-stat"><span>未开始</span><strong>${upcoming}</strong><em>UPCOMING</em></div>
    <div class="season-stat season-stat--accent"><span>季后赛</span><strong>${
      season.phases?.playoffs || 0
    }</strong><em>PLAYOFFS</em></div>
  </div>`;
}

function phaseTabs(phase, counts) {
  return `<div class="season-phases" role="tablist" aria-label="赛季阶段">
    ${PHASES.map(
      (p) => `<button class="season-phase ${phase === p.id ? 'is-active' : ''}" data-action="season-phase" data-phase="${p.id}" role="tab" aria-selected="${
        phase === p.id
      }">${p.label}${
        p.id !== 'all' && counts?.[p.id] ? `<em>${counts[p.id]}</em>` : ''
      }</button>`,
    ).join('')}
  </div>`;
}

function monthStrip(months, selected) {
  if (!months.length) return '';
  return `<div class="season-months" role="tablist" aria-label="选择月份">
    ${months
      .map(
        (m) => `<button class="season-month ${selected === m.key ? 'is-active' : ''}" data-action="season-month" data-month="${
          m.key
        }" role="tab" aria-selected="${selected === m.key}">
          <span>${monthShort(m.key)}</span><em>${m.count}</em>
        </button>`,
      )
      .join('')}
  </div>`;
}

function groupByDate(games) {
  const groups = new Map();
  for (const game of games) {
    const date = beijingDateOf(game.startTime);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(game);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function renderSeason({
  season = null,
  loading = false,
  error = null,
  phase = 'all',
  month = '',
  team = 'all',
  teamOpen = false,
  teams = [],
  favorites = [],
  reminders = {},
}) {
  if (loading && !season) {
    return `<div class="page page--season">
      <header class="page-head page-head--simple">
        <div><div class="skeleton skeleton--eyebrow"></div><div class="skeleton skeleton--headline"></div></div>
      </header>
      <div class="season-loading-card">${spinner()}<div><strong>正在打开赛季赛程</strong><p>先显示本机已有赛程，再联网更新比赛信息。</p></div></div>
      ${renderDateStrip(todayStr(), [], { compact: true })}
      <div class="skeleton skeleton--teams"></div>
    </div>`;
  }
  if (error && !season) {
    return `<div class="page page--season">
      <header class="page-head page-head--simple"><div><div class="eyebrow">${icon('trophy')}赛季</div><h1 class="page-title">赛季赛程</h1></div></header>
      ${errorState(error, { retry: 'retry-season' })}
    </div>`;
  }
  if (!season) return '';

  const allGames = season.games || [];
  const filteredByPhase = allGames.filter((g) => phase === 'all' || g.phase === phase);
  const teamGames = filteredByPhase.filter(
    (g) => team === 'all' || g.away.abbr === team || g.home.abbr === team,
  );
  const monthsMap = new Map();
  for (const game of teamGames) {
    const key = monthKey(game.startTime);
    monthsMap.set(key, (monthsMap.get(key) || 0) + 1);
  }
  const months = [...monthsMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count }));
  const selectedMonth = chooseMonth(months, month);
  const monthGames = teamGames.filter((g) => monthKey(g.startTime) === selectedMonth);
  const groups = groupByDate(monthGames);
  const phaseCounts = {};
  for (const game of allGames) phaseCounts[game.phase] = (phaseCounts[game.phase] || 0) + 1;
  const teamOptions = [...teams].sort((a, b) => cnName(a).localeCompare(cnName(b), 'zh-CN'));
  const empty = !teamGames.length;

  return `<div class="page page--season">
    <header class="page-head page-head--simple">
      <div class="page-head__copy">
        <div class="eyebrow">${icon('trophy')}赛季 <span>/ ${season.season || '2026-27'}</span></div>
        <h1 class="page-title">整个赛季，<br />一眼看完<span class="title-dot">.</span></h1>
        <p class="page-sub">${season.count || allGames.length} 场常规赛 · ${fmtDateLong(
          beijingDateOf(season.firstGame || allGames[0]?.startTime),
        )} — ${fmtDateLong(beijingDateOf(season.lastGame || allGames.at(-1)?.startTime))} · 北京时间</p>
      </div>
      <div class="page-head__aside">
        <span class="data-badge">${icon('trophy')}${season.season || '2026-27'} 赛季</span>
      </div>
    </header>

    ${seasonStats(season, allGames)}

    <section class="season-controls">
      ${phaseTabs(phase, phaseCounts)}
      <div class="season-team-select">
        <span>球队</span>
        <button class="season-team-trigger" data-action="toggle-team-picker" aria-expanded="${teamOpen}" aria-haspopup="listbox">
          ${team === 'all' ? '全部球队' : cnName(teamOptions.find((t) => t.abbr === team) || { name: team })}
          ${icon('chevron-down')}
        </button>
        ${
          teamOpen
            ? `<div class="team-picker" data-team-picker>
                <div class="team-picker__head"><span>选择球队</span><button class="icon-btn" data-action="close-team-picker" aria-label="关闭">${icon('close')}</button></div>
                <div class="team-picker__list" role="listbox">
                  <button class="team-option ${team === 'all' ? 'is-active' : ''}" data-action="season-team" data-team="all" role="option" aria-selected="${team === 'all'}">
                    <span class="team-option__all">${icon('teams')}</span><span>全部球队</span>
                  </button>
                  ${teamOptions
                    .map(
                      (t) => `<button class="team-option ${
                        team === t.abbr ? 'is-active' : ''
                      }" data-action="season-team" data-team="${t.abbr}" role="option" aria-selected="${
                        team === t.abbr
                      }">${logo(t, 'xs', '', true)}<span>${cnName(t)}</span><em>${t.abbr}</em></button>`,
                    )
                    .join('')}
                </div>
              </div>`
            : ''
        }
      </div>
    </section>

    ${
      phase === 'playoffs'
        ? `<div class="season-playoff-callout">
            ${icon('trophy')}
            <div><strong>2026-27 季后赛还没有开打</strong><p>预计 2027 年 4 月开始。到时这里会自动出现附加赛、首轮、分区决赛和总决赛赛程。</p></div>
          </div>`
        : ''
    }

    ${monthStrip(months, selectedMonth)}

    ${season.stale || season.partial ? `<div class="stale-banner">${icon('info')}<span>正在展示本机赛程${season.fetchedAt ? `（${beijingDateOf(season.fetchedAt)}更新）` : ''}，${loading ? '联网更新中…' : '部分比赛信息可能尚未更新'}</span></div>` : ''}

    ${
      loading
        ? `<div class="inline-loading">${spinner()}正在更新赛季赛程，当前可查看 ${allGames.length} 场</div>`
        : ''
    }
    ${
      error
        ? `<div class="inline-error">${icon('info')}${error}</div>`
        : ''
    }

    ${
      empty
        ? emptyState({
            iconName: 'trophy',
            title: phase === 'playoffs' ? '季后赛赛程还没发布' : '没有符合条件的比赛',
            description:
              phase === 'playoffs'
                ? '2026-27 季后赛预计 2027 年 4 月开打。现在可以先看常规赛，或者关注球队等季后赛。'
                : '试试切换阶段或球队筛选。',
            action: `<button class="btn btn--ghost btn--sm" data-action="season-phase" data-phase="all">查看全部比赛</button>`,
          })
        : `<div class="season-list">
            ${groups
              .map(
                ([date, games]) => `<section class="season-day">
                  <div class="season-day__head">
                    <strong>${relativeDay(date)}</strong>
                    <span>${fmtDateLong(date)}</span>
                    <em>${games.length} 场</em>
                  </div>
                  ${games.map((g) => seasonRow(g, { reminders })).join('')}
                </section>`,
              )
              .join('')}
          </div>`
    }

    <div class="page-note">${icon('info')}完整赛程由 30 支球队的赛程聚合去重，服务端缓存 1 小时；所有时间均为北京时间。</div>
  </div>`;
}
