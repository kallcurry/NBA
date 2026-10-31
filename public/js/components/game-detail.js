/* Game detail sheet: scoreboard, box score, play-by-play, preview, watch. */

import {
  beijingDateOf,
  broadcastShort,
  broadcasterUrl,
  cnName,
  escapeHtml,
  fmtDateLong,
  fmtTime,
  gameMargin,
  isFinal,
  isLive,
  leaderOf,
  matchupCn,
  PLATFORMS,
  periodText,
  rgba,
  readableTeamColor,
  relativeDay,
  statusText,
  todayStr,
} from '../data.js';
import { broadcastChips, emptyState, errorState, icon, liveBadge, logo, skeletonRows } from '../ui.js';
import { localizePlayerNames, playerCn } from '../player-names.js';

export const detailUi = {
  tab: null,
  team: 'away',
  playsFilter: 'all',
  gameId: null,
};

export function resetDetailUi(gameId) {
  if (detailUi.gameId === gameId) return;
  detailUi.gameId = gameId;
  detailUi.tab = null;
  detailUi.team = 'away';
  detailUi.playsFilter = 'all';
}

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

function pickGame(game, summary) {
  if (!summary) return game;
  return {
    ...game,
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

function linescore(game) {
  const periods = Math.max(
    4,
    ...(game.away.linescores || []).map((l) => l.period),
    ...(game.home.linescores || []).map((l) => l.period),
  );
  const away = game.away.linescores || [];
  const home = game.home.linescores || [];
  return `<div class="linescore-wrap">
    <table class="linescore">
      <thead><tr><th class="linescore__team"></th>${Array.from(
        { length: periods },
        (_, i) => `<th>${i + 1}</th>`,
      ).join('')}<th class="linescore__total">T</th></tr></thead>
      <tbody>
        <tr>
          <td class="linescore__team"><span>${game.away.abbr}</span></td>
          ${Array.from({ length: periods }, (_, i) => `<td>${away[i]?.display ?? '—'}</td>`).join('')}
          <td class="linescore__total">${game.status.state === 'pre' ? '—' : game.away.score}</td>
        </tr>
        <tr>
          <td class="linescore__team"><span>${game.home.abbr}</span></td>
          ${Array.from({ length: periods }, (_, i) => `<td>${home[i]?.display ?? '—'}</td>`).join('')}
          <td class="linescore__total">${game.status.state === 'pre' ? '—' : game.home.score}</td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

function detailStatus(game) {
  if (isLive(game)) {
    return `<span class="detail-status detail-status--live">${liveBadge({ label: 'LIVE' })}<span>${statusText(
      game.status,
    )}</span></span>`;
  }
  if (isFinal(game)) {
    return `<span class="detail-status"><span class="detail-status__dot"></span>${statusText(game.status)}</span>`;
  }
  return `<span class="detail-status detail-status--pre">${icon('clock')}${fmtTime(
    game.startTime,
  )} 开赛 · 北京时间</span>`;
}

function scoreBlock(game) {
  const pre = game.status.state === 'pre';
  if (pre) {
    return `<div class="detail-score is-pre">
      <span class="detail-score__tip">${fmtTime(game.startTime)}</span>
      <span class="detail-score__unit">北京时间</span>
    </div>`;
  }
  return `<div class="detail-score">
    <span class="${game.away.winner ? 'is-winner' : ''}">${game.away.score}</span>
    <em>:</em>
    <span class="${game.home.winner ? 'is-winner' : ''}">${game.home.score}</span>
  </div>`;
}

export function renderGameDetail({
  game,
  summary = null,
  tab = null,
  loading = false,
  error = null,
  favorite = false,
  hasReminder = false,
}) {
  const g = pickGame(game, summary);
  const activeTab = tab || (g.status.state === 'pre' ? 'info' : 'insight');
  const awayColor = readableTeamColor(g.away.color);
  const homeColor = readableTeamColor(g.home.color);
  const teamNames = `${cnName(g.away)} vs ${cnName(g.home)}`;
  const showWatch = !isFinal(g);

  return `<div class="game-detail" data-kind="game" data-game-id="${g.id}" style="--away-color:${awayColor};--home-color:${homeColor};--away-glow:${rgba(
    awayColor,
    0.28,
  )};--home-glow:${rgba(homeColor, 0.28)}">
    <div class="detail-hero">
      <div class="detail-hero__noise" aria-hidden="true"></div>
      <div class="detail-topbar">
        <div class="detail-league">
          <span class="detail-league__mark">NBA</span>
          <span>常规赛</span>
          <span class="detail-league__dim">${relativeDay(beijingDateOf(g.startTime))} · ${fmtDateLong(
            beijingDateOf(g.startTime),
          )}</span>
        </div>
        <div class="detail-actions">
          ${
            g.status.state === 'pre'
              ? `<button class="btn btn--ghost btn--sm ${hasReminder ? 'is-on' : ''}" data-action="toggle-reminder" data-id="${
                  g.id
                }" data-date="${beijingDateOf(g.startTime)}">
                  ${icon(hasReminder ? 'bell-ring' : 'bell')}<span class="btn__label">${
                    hasReminder ? '已设提醒' : '开赛提醒'
                  }</span>
                </button>`
              : ''
          }
          <button class="btn btn--ghost btn--sm" data-action="download-ics" data-id="${g.id}">
            ${icon('calendar-plus')}<span class="btn__label">加入日历</span>
          </button>
          ${
            showWatch
              ? `<button class="btn btn--primary btn--sm" data-action="watch" data-id="${g.id}">${icon(
                  'tv',
                )}<span class="btn__label">观看直播</span></button>`
              : ''
          }
          <button class="sheet__close icon-btn" data-close-sheet aria-label="关闭比赛详情">${icon('close')}</button>
        </div>
      </div>

      <div class="detail-scoreboard">
        <button class="detail-team detail-team--away" data-action="open-team" data-abbr="${g.away.abbr}">
          ${logo(g.away, 'lg')}
          <span class="detail-team__name">${cnName(g.away)}</span>
          <span class="detail-team__meta">${g.away.abbr} · ${g.away.record || '—'}</span>
        </button>
        <div class="detail-center">
          ${scoreBlock(g)}
          ${detailStatus(g)}
          ${linescore(g)}
        </div>
        <button class="detail-team detail-team--home" data-action="open-team" data-abbr="${g.home.abbr}">
          ${logo(g.home, 'lg')}
          <span class="detail-team__name">${cnName(g.home)}</span>
          <span class="detail-team__meta">${g.home.abbr} · ${g.home.record || '—'}</span>
        </button>
      </div>

      <div class="detail-meta">
        <span>${icon('location')}${g.venue?.name || '球馆待定'}${g.venue?.city ? ` · ${g.venue.city}` : ''}</span>
        <span>${icon('calendar-plus')}${fmtTime(g.startTime)} · 北京时间</span>
        <span class="detail-meta__tv">${broadcastChips(g.broadcasts, { max: 4 })}</span>
      </div>
    </div>

    <div class="detail-tabs" role="tablist" aria-label="比赛详情">
      <button role="tab" class="detail-tab ${activeTab === 'insight' ? 'is-active' : ''}" data-action="detail-tab" data-tab="insight" aria-selected="${
        activeTab === 'insight'
      }">${icon('chart')}比赛分析</button>
      <button role="tab" class="detail-tab ${activeTab === 'box' ? 'is-active' : ''}" data-action="detail-tab" data-tab="box" aria-selected="${
        activeTab === 'box'
      }">${icon('list')}球员数据</button>
      <button role="tab" class="detail-tab ${activeTab === 'plays' ? 'is-active' : ''}" data-action="detail-tab" data-tab="plays" aria-selected="${
        activeTab === 'plays'
      }">${icon('flame')}文字直播 ${isLive(g) ? '<i class="tab-live-dot"></i>' : ''}</button>
      <button role="tab" class="detail-tab ${activeTab === 'info' ? 'is-active' : ''}" data-action="detail-tab" data-tab="info" aria-selected="${
        activeTab === 'info'
      }">${icon('info')}${g.status.state === 'pre' ? '赛前情报' : '比赛信息'}</button>
      <span class="detail-tabs__spacer"></span>
      <span class="detail-tabs__meta">${isLive(g) ? '自动刷新中' : 'ESPN 数据'}</span>
    </div>

    <div class="detail-body" data-detail-body>
      ${
        loading && !summary
          ? `<div class="detail-loading">${skeletonRows(3, 'box')}</div>`
          : error && !summary
            ? errorState(error, { retry: 'retry-game' })
            : renderTab({ game: g, summary, tab: activeTab, error })
      }
    </div>
  </div>`;
}

function renderTab({ game, summary, tab, error }) {
  if (error && !summary) return errorState(error, { retry: 'retry-game' });
  if (!summary) return `<div class="detail-loading">${skeletonRows(3, 'box')}</div>`;
  if (tab === 'plays') return renderPlays(summary, game);
  if (tab === 'info') return renderInfo(summary, game);
  if (tab === 'box') return renderBox(summary, game);
  return renderInsight(summary, game);
}

/* ------------------------------------------------------------------ */
/* Box score                                                           */
/* ------------------------------------------------------------------ */
const LEADER_LABELS = { points: '得分', rebounds: '篮板', assists: '助攻' };

function leaderCards(summary) {
  const cards = [];
  for (const team of summary.leaders || []) {
    for (const cat of team.categories || []) {
      const leader = cat.leaders?.[0];
      if (!leader) continue;
      cards.push({ ...leader, category: LEADER_LABELS[cat.name] || cat.label, abbr: team.abbr, teamId: team.teamId });
    }
  }
  if (!cards.length) return '';
  return `<div class="leader-strip">
    ${cards
      .slice(0, 6)
      .map(
        (c) => `<div class="leader-card">
          <span class="leader-card__avatar">${
            c.headshot ? `<img src="${c.headshot}" alt="" loading="lazy" />` : icon('star')
          }</span>
          <span class="leader-card__copy">
            <span class="leader-card__value">${c.value} <em>${c.category}</em></span>
            <span class="leader-card__name">${escapeHtml(playerCn(c.name))}</span>
            <span class="leader-card__en">${escapeHtml(c.name)} · ${c.abbr}</span>
          </span>
        </div>`,
      )
      .join('')}
  </div>`;
}

const COMPARE_STATS = [
  { key: 'fieldGoalPct', label: '投篮命中率', suffix: '%' },
  { key: 'threePointFieldGoalPct', label: '三分命中率', suffix: '%' },
  { key: 'freeThrowPct', label: '罚球命中率', suffix: '%' },
  { key: 'totalRebounds', label: '篮板', suffix: '' },
  { key: 'assists', label: '助攻', suffix: '' },
  { key: 'steals', label: '抢断', suffix: '' },
  { key: 'blocks', label: '盖帽', suffix: '' },
  { key: 'turnovers', label: '失误', suffix: '', inverse: true },
  { key: 'pointsInPaint', label: '内线得分', suffix: '' },
  { key: 'fastBreakPoints', label: '快攻得分', suffix: '' },
];

function compareStats(summary, game) {
  const teams = summary.boxscore?.teams || [];
  if (teams.length < 2) return '';
  const away = teams.find((t) => t.id === game.away.id) || teams[0];
  const home = teams.find((t) => t.id === game.home.id) || teams[1];
  if (!away || !home) return '';
  const rows = COMPARE_STATS.map((def) => {
    const aRaw = Number.parseFloat(away.stats[def.key]);
    const hRaw = Number.parseFloat(home.stats[def.key]);
    if (!Number.isFinite(aRaw) || !Number.isFinite(hRaw)) return '';
    const max = Math.max(aRaw, hRaw, 1);
    const aWidth = Math.max(6, (aRaw / max) * 100);
    const hWidth = Math.max(6, (hRaw / max) * 100);
    const aBetter = def.inverse ? aRaw < hRaw : aRaw > hRaw;
    const hBetter = def.inverse ? hRaw < aRaw : hRaw > aRaw;
    return `<div class="compare-row">
      <span class="compare-row__value ${aBetter ? 'is-better' : ''}">${away.stats[def.key]}${
        def.suffix && !away.stats[def.key]?.includes('%') ? def.suffix : ''
      }</span>
      <div class="compare-row__center">
        <div class="compare-row__bars">
          <span class="compare-bar compare-bar--away" style="width:${aWidth}%;background:${readableTeamColor(
            game.away.color,
          )}"></span>
          <span class="compare-bar compare-bar--home" style="width:${hWidth}%;background:${readableTeamColor(
            game.home.color,
          )}"></span>
        </div>
        <span class="compare-row__label">${def.label}</span>
      </div>
      <span class="compare-row__value ${hBetter ? 'is-better' : ''}">${home.stats[def.key]}${
        def.suffix && !home.stats[def.key]?.includes('%') ? def.suffix : ''
      }</span>
    </div>`;
  }).filter(Boolean);
  if (!rows.length) return '';
  return `<section class="detail-section">
    <div class="detail-section__head">
      <h3>球队数据对比</h3>
      <span class="detail-section__legend"><i style="background:${game.away.color}"></i>${game.away.abbr}<i style="background:${
        game.home.color
      }"></i>${game.home.abbr}</span>
    </div>
    <div class="compare-list">${rows.join('')}</div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Visual analytics                                                    */
/* ------------------------------------------------------------------ */
function statNum(stats, key) {
  const value = Number.parseFloat(stats?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function parsePair(stats, key) {
  const raw = String(stats?.[key] || '0-0');
  const [made, attempted] = raw.split('-').map((v) => Number.parseInt(v, 10) || 0);
  return { made, attempted };
}

function teamPair(summary) {
  const teams = summary.boxscore?.teams || [];
  if (teams.length < 2) return null;
  return { away: teams[0], home: teams[1] };
}

function metricWidth(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 4;
  return Math.max(4, Math.min(100, (value / max) * 100));
}

function renderKpiDual({ label, sub, awayText, homeText, awayPct, homePct, game }) {
  return `<div class="kpi-card">
    <div class="kpi-card__head"><span>${label}</span><em>${sub || ''}</em></div>
    <div class="kpi-card__rows">
      <div class="kpi-card__row"><span><i style="background:${readableTeamColor(game.away.color)}"></i>${
        game.away.abbr
      }</span><strong>${awayText}</strong></div>
      <div class="kpi-card__row"><span><i style="background:${readableTeamColor(game.home.color)}"></i>${
        game.home.abbr
      }</span><strong>${homeText}</strong></div>
    </div>
    <div class="kpi-card__track">
      <span class="kpi-card__half"><i style="width:${awayPct}%;background:${readableTeamColor(game.away.color)}"></i></span>
      <span class="kpi-card__half"><i style="width:${homePct}%;background:${readableTeamColor(game.home.color)}"></i></span>
    </div>
  </div>`;
}

function renderKpis(summary, game) {
  const pair = teamPair(summary);
  const margin = Math.abs(game.home.score - game.away.score);
  const leader = game.home.score === game.away.score ? null : game.home.score > game.away.score ? game.home : game.away;
  const largest = pair ? Math.max(statNum(pair.away.stats, 'largestLead'), statNum(pair.home.stats, 'largestLead')) : 0;
  const fgA = pair ? statNum(pair.away.stats, 'fieldGoalPct') : 0;
  const fgH = pair ? statNum(pair.home.stats, 'fieldGoalPct') : 0;
  const threeA = pair ? parsePair(pair.away.stats, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted') : { made: 0, attempted: 0 };
  const threeH = pair ? parsePair(pair.home.stats, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted') : { made: 0, attempted: 0 };
  const threePctA = pair ? statNum(pair.away.stats, 'threePointFieldGoalPct') : 0;
  const threePctH = pair ? statNum(pair.home.stats, 'threePointFieldGoalPct') : 0;
  const rebA = pair ? statNum(pair.away.stats, 'totalRebounds') : 0;
  const rebH = pair ? statNum(pair.home.stats, 'totalRebounds') : 0;
  const astA = pair ? statNum(pair.away.stats, 'assists') : 0;
  const astH = pair ? statNum(pair.home.stats, 'assists') : 0;
  const fgMax = Math.max(fgA, fgH, 1);
  const threeMax = Math.max(threePctA, threePctH, 1);
  const rebMax = Math.max(rebA, rebH, 1);

  return `<div class="analytics-kpis">
    <div class="kpi-card kpi-card--lead">
      <div class="kpi-card__head"><span>${isFinal(game) ? '最终分差' : '当前分差'}</span><em>${
        largest ? `最大领先 ${largest}` : '比分'
      }</em></div>
      <div class="kpi-card__lead">
        <strong>${margin === 0 ? '平' : margin}</strong>
        <span>${leader ? `${cnName(leader)}领先` : '双方战平'}</span>
      </div>
      <div class="kpi-card__lead-line"><i style="width:100%;background:${leader ? readableTeamColor(leader.color) : 'var(--accent)'}"></i></div>
    </div>
    ${renderKpiDual({
      label: '投篮命中率',
      sub: 'FG%',
      awayText: `${fgA.toFixed(1)}%`,
      homeText: `${fgH.toFixed(1)}%`,
      awayPct: metricWidth(fgA, fgMax),
      homePct: metricWidth(fgH, fgMax),
      game,
    })}
    ${renderKpiDual({
      label: '三分球',
      sub: '3PT',
      awayText: `${threeA.made}/${threeA.attempted}`,
      homeText: `${threeH.made}/${threeH.attempted}`,
      awayPct: metricWidth(threePctA, threeMax),
      homePct: metricWidth(threePctH, threeMax),
      game,
    })}
    ${renderKpiDual({
      label: '篮板 / 助攻',
      sub: 'REB / AST',
      awayText: `${rebA} / ${astA}`,
      homeText: `${rebH} / ${astH}`,
      awayPct: metricWidth(rebA, rebMax),
      homePct: metricWidth(rebH, rebMax),
      game,
    })}
  </div>`;
}

function trendPoints(summary, game) {
  const wp = (summary.winprobability || []).filter((d) => Number.isFinite(d.home));
  if (wp.length > 2) {
    return {
      mode: 'winprob',
      values: wp.map((d) => d.home),
      periods: wp.map((d) => d.period),
      labels: { away: `${(100 - wp.at(-1).home).toFixed(1)}%`, home: `${wp.at(-1).home.toFixed(1)}%` },
    };
  }
  const scoring = (summary.plays || []).filter((p) => p.scoring);
  if (scoring.length > 2) {
    const margins = scoring.map((p) => p.homeScore - p.awayScore);
    const max = Math.max(...margins.map(Math.abs), 1);
    const last = margins.at(-1) || 0;
    const leader = last === 0 ? null : last > 0 ? game.home : game.away;
    return {
      mode: 'margin',
      values: margins.map((m) => 50 + (m / max) * 45),
      periods: scoring.map((p) => p.period),
      labels: { away: `${game.away.score}`, home: `${game.home.score}` },
      margin: Math.abs(last),
      marginLeader: leader,
    };
  }
  return null;
}

function renderTrend(summary, game) {
  const data = trendPoints(summary, game);
  if (!data) return '';
  const isWinProb = data.mode === 'winprob';
  const awayColor = readableTeamColor(game.away.color);
  const homeColor = readableTeamColor(game.home.color);
  const W = 800;
  const H = 220;
  const n = data.values.length;
  const xAt = (i) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const yAt = (v) => H - (v / 100) * H;
  const line = data.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`).join(' ');
  const endX = xAt(n - 1);
  const endY = yAt(data.values.at(-1));
  const homeArea = `M0 ${H} L${line.replace(/^M/, '')} L${W} ${H} Z`.replace('L0 ', 'L0 ');
  const awayArea = `M0 0 L${line.replace(/^M/, '')} L${W} 0 Z`;
  const periodStarts = [];
  let lastPeriod = null;
  for (let i = 0; i < data.periods.length; i++) {
    const p = data.periods[i];
    if (p && p !== lastPeriod) {
      periodStarts.push({ period: p, left: (xAt(i) / W) * 100 });
      lastPeriod = p;
    }
  }
  const grid = [0, 25, 50, 75, 100]
    .map((v) => `<line x1="0" y1="${yAt(v)}" x2="${W}" y2="${yAt(v)}" class="${v === 50 ? 'trend-grid trend-grid--mid' : 'trend-grid'}" />`)
    .join('');
  const periodLines = periodStarts
    .filter((p) => p.left > 1 && p.left < 99)
    .map((p) => `<line x1="${(p.left / 100) * W}" y1="0" x2="${(p.left / 100) * W}" y2="${H}" class="trend-period-line" />`)
    .join('');
  const periodLabels = periodStarts
    .map(
      (p) =>
        `<span style="left:${Math.min(98, Math.max(2, p.left))}%">${
          p.period > 4 ? 'OT' : `Q${p.period}`
        }</span>`,
    )
    .join('');
  const endpointLabel = isWinProb
    ? `${game.home.abbr} ${data.values.at(-1).toFixed(1)}%`
    : data.margin === 0
      ? '平分'
      : `${data.marginLeader?.abbr || ''} +${data.margin}`;
  const endTop = (endY / H) * 100;
  const endTransform = endTop < 15 ? 'translate(-100%, 0)' : endTop > 85 ? 'translate(-100%, -100%)' : 'translate(-100%, -50%)';

  return `<section class="chart-panel chart-panel--trend">
    <div class="chart-head">
      <div>
        <span class="chart-kicker">${isWinProb ? '胜率走势' : '分差走势'}</span>
        <h3>${isWinProb ? '谁在掌控比赛' : '比分如何拉开'}</h3>
      </div>
      <div class="chart-legend">
        <span><i style="background:${awayColor}"></i>${game.away.abbr}</span>
        <span><i style="background:${homeColor}"></i>${game.home.abbr}</span>
      </div>
    </div>
    <div class="trend-chart">
      <div class="trend-y"><span>100</span><span>50</span><span>0</span></div>
      <div class="trend-plot">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${isWinProb ? '主队胜率走势' : '分差走势'}">
          <rect width="${W}" height="${H}" fill="rgba(127,151,214,.045)" />
          <path d="${awayArea}" fill="${rgba(awayColor, 0.18)}" />
          <path d="${homeArea}" fill="${rgba(homeColor, 0.3)}" />
          ${grid}
          ${periodLines}
          <path d="${line}" fill="none" stroke="#f4f7ff" stroke-width="2" vector-effect="non-scaling-stroke" />
          <circle cx="${endX}" cy="${endY}" r="4" fill="#f4f7ff" stroke="${homeColor}" stroke-width="2" vector-effect="non-scaling-stroke" />
        </svg>
        <span class="trend-endpoint" style="left:${(endX / W) * 100}%;top:${endTop}%;transform:${endTransform}">${endpointLabel}</span>
      </div>
    </div>
    <div class="trend-x">${periodLabels}<span class="trend-x__now">现在</span></div>
    <div class="trend-foot">
      <span><i style="background:${awayColor}"></i>${game.away.abbr} <b>${data.labels.away}</b></span>
      <span><i style="background:${homeColor}"></i>${game.home.abbr} <b>${data.labels.home}</b></span>
      <em>${isWinProb ? 'ESPN 实时模型' : '按得分回合计算'}</em>
    </div>
  </section>`;
}

function renderQuarterChart(game) {
  const periods = Math.max(
    4,
    ...(game.away.linescores || []).map((l) => l.period),
    ...(game.home.linescores || []).map((l) => l.period),
  );
  const away = game.away.linescores || [];
  const home = game.home.linescores || [];
  if (!away.some((l) => l.value) && !home.some((l) => l.value)) return '';
  const max = Math.max(1, ...away.map((l) => l.value), ...home.map((l) => l.value));
  const groups = Array.from({ length: periods }, (_, i) => i + 1)
    .map((p) => {
      const a = away.find((l) => l.period === p)?.value || 0;
      const h = home.find((l) => l.period === p)?.value || 0;
      return `<div class="quarter-group">
        <div class="quarter-bars">
          <span class="quarter-bar quarter-bar--away" style="height:${(a / max) * 100}%;background:${readableTeamColor(
            game.away.color,
          )}"><b>${a || ''}</b></span>
          <span class="quarter-bar quarter-bar--home" style="height:${(h / max) * 100}%;background:${readableTeamColor(
            game.home.color,
          )}"><b>${h || ''}</b></span>
        </div>
        <span class="quarter-label">${p > 4 ? `OT${p - 4}` : `Q${p}`}</span>
      </div>`;
    })
    .join('');
  return `<section class="chart-panel chart-panel--quarter">
    <div class="chart-head">
      <div><span class="chart-kicker">分节得分</span><h3>每节谁更高效</h3></div>
      <div class="chart-legend">
        <span><i style="background:${readableTeamColor(game.away.color)}"></i>${game.away.abbr}</span>
        <span><i style="background:${readableTeamColor(game.home.color)}"></i>${game.home.abbr}</span>
      </div>
    </div>
    <div class="quarter-chart">${groups}</div>
  </section>`;
}

function radarValues(summary, game) {
  const pair = teamPair(summary);
  if (!pair) return null;
  const a = pair.away.stats;
  const h = pair.home.stats;
  const axes = [
    { label: '得分', away: game.away.score, home: game.home.score },
    { label: '投篮', away: statNum(a, 'fieldGoalPct'), home: statNum(h, 'fieldGoalPct') },
    { label: '三分', away: statNum(a, 'threePointFieldGoalPct'), home: statNum(h, 'threePointFieldGoalPct') },
    { label: '篮板', away: statNum(a, 'totalRebounds'), home: statNum(h, 'totalRebounds') },
    { label: '助攻', away: statNum(a, 'assists'), home: statNum(h, 'assists') },
    {
      label: '防守',
      away: statNum(a, 'steals') + statNum(a, 'blocks'),
      home: statNum(h, 'steals') + statNum(h, 'blocks'),
    },
  ];
  return axes.map((axis) => {
    const max = Math.max(axis.away, axis.home, 1);
    return {
      ...axis,
      awayPct: Math.max(12, (axis.away / max) * 100),
      homePct: Math.max(12, (axis.home / max) * 100),
    };
  });
}

function radarPolygon(values, key, cx, cy, radius) {
  return values
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
      const r = (v[key] / 100) * radius;
      return `${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`;
    })
    .join(' ');
}

function renderRadar(summary, game) {
  const values = radarValues(summary, game);
  if (!values) return '';
  const cx = 165;
  const cy = 145;
  const radius = 92;
  const rings = [25, 50, 75, 100]
    .map((p) => {
      const pts = values
        .map((_, i) => {
          const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
          const r = (p / 100) * radius;
          return `${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`;
        })
        .join(' ');
      return `<polygon points="${pts}" class="radar-ring" />`;
    })
    .join('');
  const spokes = values
    .map((_, i) => {
      const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
      return `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(angle) * radius).toFixed(2)}" y2="${(
        cy +
        Math.sin(angle) * radius
      ).toFixed(2)}" class="radar-spoke" />`;
    })
    .join('');
  const labels = values
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
      const lx = cx + Math.cos(angle) * (radius + 24);
      const ly = cy + Math.sin(angle) * (radius + 22);
      const anchor = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
      return `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${anchor}" class="radar-label">${v.label}</text>`;
    })
    .join('');
  return `<section class="chart-panel chart-panel--radar">
    <div class="chart-head">
      <div><span class="chart-kicker">球队能力</span><h3>六维对比</h3></div>
      <span class="chart-note">归一化</span>
    </div>
    <div class="radar-wrap">
      <svg viewBox="0 0 330 290" role="img" aria-label="球队能力雷达图">
        ${rings}${spokes}
        <polygon points="${radarPolygon(values, 'awayPct', cx, cy, radius)}" fill="${rgba(
          readableTeamColor(game.away.color),
          0.18,
        )}" stroke="${readableTeamColor(game.away.color)}" stroke-width="2" />
        <polygon points="${radarPolygon(values, 'homePct', cx, cy, radius)}" fill="${rgba(
          readableTeamColor(game.home.color),
          0.18,
        )}" stroke="${readableTeamColor(game.home.color)}" stroke-width="2" />
        <circle cx="${cx}" cy="${cy}" r="2" class="radar-center" />
        ${labels}
      </svg>
    </div>
    <div class="trend-foot">
      <span><i style="background:${readableTeamColor(game.away.color)}"></i>${game.away.abbr} <b>${game.away.score}</b></span>
      <span><i style="background:${readableTeamColor(game.home.color)}"></i>${game.home.abbr} <b>${game.home.score}</b></span>
      <em>得分 · 投篮 · 三分 · 篮板 · 助攻 · 防守</em>
    </div>
  </section>`;
}

function topScorers(summary, teamId, limit = 5) {
  const block = (summary.boxscore?.players || []).find((p) => String(p.teamId) === String(teamId));
  if (!block) return [];
  return (block.athletes || [])
    .filter((a) => !a.didNotPlay)
    .map((a) => ({ ...a, points: Number.parseInt(a.stats?.PTS, 10) || 0 }))
    .filter((a) => a.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

function renderScorers(summary, game) {
  const away = topScorers(summary, game.away.id);
  const home = topScorers(summary, game.home.id);
  if (!away.length && !home.length) return '';
  const max = Math.max(1, ...away.map((p) => p.points), ...home.map((p) => p.points));
  const teamBlock = (team, players, color) => `<div class="scorers-team">
    <div class="scorers-team__head">
      ${logo(team, 'sm')}<strong>${cnName(team)}</strong><span>${team.abbr}</span>
    </div>
    ${players
      .map(
        (p, i) => `<div class="scorer-row">
          <span class="scorer-rank">${i + 1}</span>
          <span class="scorer-copy">
            <b>${escapeHtml(playerCn(p.name))}</b>
            <em>${escapeHtml(p.name)}</em>
          </span>
          <strong class="scorer-points">${p.points}</strong>
          <span class="scorer-track"><i style="width:${metricWidth(p.points, max)}%;background:${color}"></i></span>
        </div>`,
      )
      .join('')}
  </div>`;
  return `<section class="chart-panel chart-panel--scorers">
    <div class="chart-head">
      <div><span class="chart-kicker">主要得分点</span><h3>谁在得分</h3></div>
      <span class="chart-note">PTS</span>
    </div>
    <div class="scorers-grid">
      ${teamBlock(game.away, away, readableTeamColor(game.away.color))}
      ${teamBlock(game.home, home, readableTeamColor(game.home.color))}
    </div>
  </section>`;
}

function efficiencyMetrics(summary, game) {
  const pair = teamPair(summary);
  if (!pair) return null;
  const build = (teamStats, points, oppStats) => {
    const fga = parsePair(teamStats.stats, 'fieldGoalsMade-fieldGoalsAttempted').attempted;
    const fgm = parsePair(teamStats.stats, 'fieldGoalsMade-fieldGoalsAttempted').made;
    const tpm = parsePair(teamStats.stats, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted').made;
    const fta = parsePair(teamStats.stats, 'freeThrowsMade-freeThrowsAttempted').attempted;
    const tov = statNum(teamStats.stats, 'turnovers');
    const orb = statNum(teamStats.stats, 'offensiveRebounds');
    const oppDrb = statNum(oppStats.stats, 'defensiveRebounds');
    const poss = fga + 0.44 * fta + tov;
    return {
      efg: fga ? ((fgm + 0.5 * tpm) / fga) * 100 : 0,
      ts: poss ? (points / (2 * (fga + 0.44 * fta))) * 100 : 0,
      tovPct: poss ? (tov / poss) * 100 : 0,
      orbPct: orb + oppDrb ? (orb / (orb + oppDrb)) * 100 : 0,
    };
  };
  return {
    away: build(pair.away, game.away.score, pair.home),
    home: build(pair.home, game.home.score, pair.away),
  };
}

function renderEfficiency(summary, game) {
  const metrics = efficiencyMetrics(summary, game);
  if (!metrics) return '';
  const rows = [
    { key: 'efg', label: 'eFG%', desc: '投篮效率' },
    { key: 'ts', label: 'TS%', desc: '真实命中率' },
    { key: 'tovPct', label: 'TOV%', desc: '失误率', inverse: true },
    { key: 'orbPct', label: 'ORB%', desc: '前场篮板率' },
  ];
  return `<section class="chart-panel chart-panel--efficiency">
    <div class="chart-head">
      <div><span class="chart-kicker">效率面板</span><h3>进阶四因子</h3></div>
      <span class="chart-note">进阶</span>
    </div>
    <div class="efficiency-list">
      ${rows
        .map((row) => {
          const a = metrics.away[row.key];
          const h = metrics.home[row.key];
          const aMax = Math.max(a, h, 1);
          const aBetter = row.inverse ? a < h : a > h;
          const hBetter = row.inverse ? h < a : h > a;
          return `<div class="efficiency-row">
            <div class="efficiency-row__head"><strong>${row.label}</strong><span>${row.desc}</span></div>
            <span class="efficiency-value ${aBetter ? 'is-better' : ''}">${a.toFixed(1)}</span>
            <div class="efficiency-bars">
              <span style="width:${metricWidth(a, aMax)}%;background:${readableTeamColor(game.away.color)}"></span>
              <span style="width:${metricWidth(h, aMax)}%;background:${readableTeamColor(game.home.color)}"></span>
            </div>
            <span class="efficiency-value ${hBetter ? 'is-better' : ''}">${h.toFixed(1)}</span>
          </div>`;
        })
        .join('')}
    </div>
    <div class="efficiency-foot">eFG% 投篮效率 · TS% 真实命中率 · TOV% 失误率 · ORB% 前场篮板率</div>
  </section>`;
}

function renderInsight(summary, game) {
  if (game.status.state === 'pre') {
    return emptyState({
      iconName: 'chart',
      title: '比赛还没开始',
      description: '开赛后这里会出现胜率走势、分节得分、球队雷达和主要得分点图表。',
      compact: true,
    });
  }
  const hasBox = Boolean(teamPair(summary));
  const quarter = renderQuarterChart(game);
  const radar = renderRadar(summary, game);
  const compare = compareStats(summary, game);
  const efficiency = renderEfficiency(summary, game);
  return `<div class="insight-tab">
    ${renderKpis(summary, game)}
    ${renderTrend(summary, game)}
    ${
      quarter || radar
        ? `<div class="analytics-duo">${quarter}${radar}</div>`
        : ''
    }
    ${renderScorers(summary, game)}
    ${
      hasBox && (compare || efficiency)
        ? `<div class="analytics-duo analytics-duo--equal">${compare}${efficiency}</div>`
        : ''
    }
  </div>`;
}


function boxTable(teamBlock, game, which) {
  if (!teamBlock) return '';
  const team = which === 'away' ? game.away : game.home;
  const labels = teamBlock.labels || [];
  const cols = ['MIN', 'PTS', 'REB', 'AST', 'FG', '3PT', '+/-'].filter((c) => labels.includes(c));
  const rows = teamBlock.athletes || [];
  const starters = rows.filter((r) => r.starter);
  const bench = rows.filter((r) => !r.starter && !r.didNotPlay);
  const dnp = rows.filter((r) => r.didNotPlay);
  const ordered = [...starters, ...bench, ...dnp];
  return `<section class="box-panel">
    <div class="box-panel__title">
      ${logo(team, 'sm')}
      <span>${cnName(team)}</span>
      <span class="box-panel__abbr">${team.abbr}</span>
    </div>
    <div class="box-table-wrap">
      <table class="box-table">
        <thead><tr><th class="box-table__player">球员</th>${cols
          .map((c) => `<th>${c}</th>`)
          .join('')}</tr></thead>
        <tbody>
          ${ordered
            .map(
              (p) => `<tr class="${p.didNotPlay ? 'is-dnp' : ''} ${p.starter ? 'is-starter' : ''}">
                <td class="box-table__player">
                  <span class="player-cell">
                  <span class="player-num">${p.jersey || ''}</span>
                  <span class="player-meta">
                    <span class="player-name">${escapeHtml(playerCn(p.name))}${p.starter ? '<i class="starter-dot" title="首发"></i>' : ''}</span>
                    ${
                      playerCn(p.name) !== p.name
                        ? `<span class="player-en">${escapeHtml(p.name)}</span>`
                        : ''
                    }
                  </span>
                  <span class="player-pos">${p.position || ''}</span>
                  </span>
                </td>
                ${
                  p.didNotPlay
                    ? `<td colspan="${cols.length}" class="dnp-cell">未出场</td>`
                    : cols.map((c) => `<td>${p.stats[c] ?? '—'}</td>`).join('')
                }
              </tr>`,
            )
            .join('')}
          ${
            teamBlock.totals && Object.keys(teamBlock.totals).length
              ? `<tr class="is-total">
                  <td class="box-table__player">全队</td>
                  ${cols.map((c) => `<td>${teamBlock.totals[c] ?? ''}</td>`).join('')}
                </tr>`
              : ''
          }
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderBox(summary, game) {
  const available = (summary.boxscore?.players || []).filter((p) => p.athletes?.length);
  if (!available.length) {
    return emptyState({
      iconName: 'chart',
      title: game.status.state === 'pre' ? '比赛还没开始' : '暂无球员数据',
      description:
        game.status.state === 'pre'
          ? '开赛后这里会出现实时技术统计。'
          : '数据源暂未提供本场球员统计，稍后再看看。',
      compact: true,
    });
  }
  let active = detailUi.team;
  const exists = available.some((p) => p.teamId === (active === 'away' ? game.away.id : game.home.id));
  if (!exists) active = 'away';
  const activeId = active === 'away' ? game.away.id : game.home.id;
  const block = available.find((p) => p.teamId === activeId) || available[0];
  const awayBlock = available.find((p) => p.teamId === game.away.id);
  const homeBlock = available.find((p) => p.teamId === game.home.id);
  const actualWhich = block === awayBlock ? 'away' : 'home';
  return `<div class="box-tab">
    <div class="box-switch">
      <div class="segmented" role="tablist" aria-label="选择球队">
        <button role="tab" class="segmented__btn ${actualWhich === 'away' ? 'is-active' : ''}" data-action="detail-team" data-team="away" aria-selected="${
          actualWhich === 'away'
        }">${logo(game.away, 'xs')}${cnName(game.away)}</button>
        <button role="tab" class="segmented__btn ${actualWhich === 'home' ? 'is-active' : ''}" data-action="detail-team" data-team="home" aria-selected="${
          actualWhich === 'home'
        }">${logo(game.home, 'xs')}${cnName(game.home)}</button>
      </div>
      <span class="box-switch__hint">滑动查看完整数据</span>
    </div>
    ${boxTable(block, game, actualWhich)}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Play-by-play                                                        */
/* ------------------------------------------------------------------ */
function periodTitle(n) {
  if (n <= 4) return `第 ${n} 节`;
  return n === 5 ? '加时' : `第 ${n - 4} 个加时`;
}

function renderPlays(summary, game) {
  const plays = summary.plays || [];
  if (!plays.length) {
    return emptyState({
      iconName: 'list',
      title: game.status.state === 'pre' ? '等待开球' : '暂无文字直播',
      description: game.status.state === 'pre' ? '比赛开始后，这里会按回合更新。' : '稍后刷新再看看。',
      compact: true,
    });
  }
  const filtered = detailUi.playsFilter === 'scoring' ? plays.filter((p) => p.scoring) : plays;
  const ordered = [...filtered].sort((a, b) => b.sequence - a.sequence);
  const groups = [];
  for (const play of ordered) {
    const last = groups.at(-1);
    if (!last || last.period !== play.period) groups.push({ period: play.period, plays: [play] });
    else last.plays.push(play);
  }
  return `<div class="plays-tab">
    <div class="plays-toolbar">
      <div class="segmented segmented--sm">
        <button class="segmented__btn ${detailUi.playsFilter === 'all' ? 'is-active' : ''}" data-action="plays-filter" data-filter="all">全部回合</button>
        <button class="segmented__btn ${detailUi.playsFilter === 'scoring' ? 'is-active' : ''}" data-action="plays-filter" data-filter="scoring">只看得分</button>
      </div>
      <span class="plays-toolbar__hint">${isLive(game) ? '每 15 秒更新' : '按时间倒序'}</span>
    </div>
    ${groups
      .map(
        (group) => `<section class="play-period">
          <div class="play-period__head"><span>${periodTitle(group.period)}</span><i></i></div>
          <div class="play-list">
            ${group.plays
              .map(
                (p) => `<div class="play ${p.scoring ? 'is-scoring' : ''}">
                  <span class="play__clock">${escapeHtml(p.clock)}</span>
                  <span class="play__body">
                    <span class="play__text">${escapeHtml(localizePlayerNames(p.text))}</span>
                    ${
                      p.scoring
                        ? `<span class="play__score">${game.away.abbr} ${p.awayScore} <i>–</i> ${p.homeScore} ${game.home.abbr}</span>`
                        : ''
                    }
                  </span>
                  ${
                    p.scoring
                      ? `<span class="play__badge">${icon('flame')}</span>`
                      : `<span class="play__type">${escapeHtml(p.type || '')}</span>`
                  }
                </div>`,
              )
              .join('')}
          </div>
        </section>`,
      )
      .join('')}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Info / preview                                                      */
/* ------------------------------------------------------------------ */
const INJURY_STATUS = {
  Out: '缺阵',
  'Day-To-Day': '每日观察',
  Questionable: '出战成疑',
  Doubtful: '大概率缺阵',
  Probable: '大概率出战',
};

const INJURY_TYPE = {
  'Ankle Sprain': '脚踝扭伤',
  'Hamstring Strain': '腿筋拉伤',
  'Hip Bruise': '髋部挫伤',
  'Knee Soreness': '膝盖酸痛',
  Illness: '生病',
  Concussion: '脑震荡',
  'Back Spasm': '背部痉挛',
  'Calf Strain': '小腿拉伤',
  'Foot Injury': '足部伤势',
  'Thumb Injury': '拇指伤势',
  'Ankle Soreness': '脚踝酸痛',
  'Knee Injury': '膝盖伤势',
  'Groin Strain': '腹股沟拉伤',
};

function injuriesBlock(summary, game) {
  const blocks = summary.injuries || [];
  if (!blocks.length) {
    return `<div class="injury-empty">${icon('check')}暂未报告新的伤病情况</div>`;
  }
  return `<div class="injury-grid">
    ${blocks
      .map((block) => {
        const team = block.teamId === game.away.id ? game.away : game.home;
        return `<div class="injury-col">
          <div class="injury-col__head">${logo(team, 'xs')}${team.abbr}</div>
          ${block.players
            .map(
              (p) => `<div class="injury-row">
                <span class="injury-row__avatar">${p.headshot ? `<img src="${p.headshot}" alt="" loading="lazy" />` : ''}</span>
                <span class="injury-row__copy">
                  <span class="injury-row__name">${escapeHtml(playerCn(p.name))}</span>
                  ${
                    playerCn(p.name) !== p.name
                      ? `<span class="injury-row__en">${escapeHtml(p.name)}</span>`
                      : ''
                  }
                  <span class="injury-row__detail">${escapeHtml(INJURY_TYPE[p.type] || p.type || '伤势')}${
                    p.side ? ` · ${p.side === 'Left' ? '左' : p.side === 'Right' ? '右' : p.side}` : ''
                  }${p.returnDate ? ` · 预计 ${p.returnDate.slice(5)} 回归` : ''}</span>
                </span>
                <span class="injury-badge">${INJURY_STATUS[p.status] || p.status}</span>
              </div>`,
            )
            .join('')}
        </div>`;
      })
      .join('')}
  </div>`;
}

function infoRows(game, summary) {
  const rows = [];
  if (game.venue?.name) rows.push({ icon: 'location', label: '球馆', value: `${escapeHtml(game.venue.name)}${game.venue.city ? ` · ${escapeHtml(game.venue.city)}` : ''}` });
  if (summary.attendance) rows.push({ icon: 'teams', label: '上座人数', value: summary.attendance.toLocaleString('zh-CN') });
  if (summary.officials?.length) rows.push({ icon: 'star', label: '裁判', value: summary.officials.join(' · ') });
  rows.push({
    icon: 'tv',
    label: '转播',
    value: game.broadcasts?.length ? game.broadcasts.map((b) => escapeHtml(broadcastShort(b.name))).join(' · ') : '以官方节目单为准',
  });
  return `<div class="info-facts">
    ${rows
      .map(
        (r) => `<div class="info-fact"><span class="info-fact__icon">${icon(r.icon)}</span><span class="info-fact__label">${
          r.label
        }</span><span class="info-fact__value">${r.value}</span></div>`,
      )
      .join('')}
  </div>`;
}

function oddsBlock(summary) {
  const o = summary.odds;
  if (!o) return '';
  const parts = [];
  if (o.details) parts.push({ label: '让分', value: o.details });
  if (o.overUnder != null) parts.push({ label: '总分', value: o.overUnder });
  if (o.homeMoneyLine != null) parts.push({ label: '主胜赔率', value: o.homeMoneyLine > 0 ? `+${o.homeMoneyLine}` : o.homeMoneyLine });
  if (!parts.length) return '';
  return `<section class="detail-section">
    <div class="detail-section__head"><h3>盘口参考</h3><span>ESPN</span></div>
    <div class="odds-row">${parts
      .map((p) => `<div class="odds-item"><span>${p.label}</span><strong>${p.value}</strong></div>`)
      .join('')}</div>
  </section>`;
}

function renderInfo(summary, game) {
  const pre = game.status.state === 'pre';
  const article = summary.article;
  return `<div class="info-tab">
    ${
      article?.headline && game.status.state !== 'pre'
        ? `<section class="recap-card">
            <span class="eyebrow eyebrow--small">${icon('flame')}赛后速递</span>
            <h3>${escapeHtml(article.headline)}</h3>
            <p>${escapeHtml(article.description)}</p>
            ${article.link ? `<a class="text-link" href="${article.link}" target="_blank" rel="noopener noreferrer">阅读全文 ${icon('external')}</a>` : ''}
          </section>`
        : ''
    }

    <section class="detail-section">
      <div class="detail-section__head">
        <h3>${pre ? '伤病名单' : '本场伤病'}</h3>
        <span>赛前状态可能变化</span>
      </div>
      ${injuriesBlock(summary, game)}
    </section>

    ${
      summary.series
        ? `<section class="detail-section">
            <div class="detail-section__head"><h3>赛季交手</h3><span>${summary.series.title || ''}</span></div>
            <div class="series-card">
              <strong>${escapeHtml(summary.series.summary || summary.series.score || '本季首次交手')}</strong>
              <span>${summary.series.total ? `常规赛共 ${summary.series.total} 次交手` : ''}</span>
            </div>
          </section>`
        : ''
    }

    <section class="detail-section">
      <div class="detail-section__head"><h3>比赛信息</h3><span>${fmtDateLong(beijingDateOf(game.startTime))}</span></div>
      ${infoRows(game, summary)}
    </section>

    ${oddsBlock(summary)}

    <section class="watch-callout">
      <div class="watch-callout__icon">${icon('tv')}</div>
      <div class="watch-callout__copy">
        <h3>${pre ? '准备看球？' : '想看直播或回放？'}</h3>
        <p>只走官方与持权平台：League Pass、腾讯体育、咪咕视频、央视体育。</p>
      </div>
      <button class="btn btn--primary btn--sm" data-action="watch" data-id="${game.id}">查看渠道 ${icon('arrow-right')}</button>
    </section>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Watch sheet                                                         */
/* ------------------------------------------------------------------ */
export function renderWatchSheet(game) {
  const broadcasts = game.broadcasts?.length
    ? game.broadcasts
    : [{ name: 'NBA League Pass', national: true, market: 'national' }];
  return `<div class="watch-sheet" data-kind="watch">
    <div class="sheet__head">
      <div>
        <span class="eyebrow eyebrow--small">${icon('tv')}官方观赛入口</span>
        <h2>在哪看 ${cnName(game.away)} vs ${cnName(game.home)}</h2>
        <p>${fmtTime(game.startTime)} · 北京时间 · ${relativeDay(beijingDateOf(game.startTime))}</p>
      </div>
      <button class="sheet__close icon-btn" data-close-sheet aria-label="关闭">${icon('close')}</button>
    </div>

    <div class="watch-sheet__body">
      <section class="watch-block">
        <div class="watch-block__head">
          <h3>本场官方转播</h3>
          <span>来自 ESPN 节目信息</span>
        </div>
        <div class="watch-broadcasters">
          ${broadcasts
            .map(
              (b) => `<a class="watch-broadcaster" href="${broadcasterUrl(b.name)}" target="_blank" rel="noopener noreferrer">
                <span class="watch-broadcaster__logo">${b.national ? icon('tv') : icon('guide')}</span>
                <span class="watch-broadcaster__copy">
                  <strong>${escapeHtml(b.name)}</strong>
                  <span>${
                    /league pass/i.test(b.name)
                      ? '官方流媒体 · 全场次订阅'
                      : b.national
                        ? '全美 / 国际转播 · 官方渠道'
                        : b.market === 'home'
                          ? '主队地区转播 · 官方渠道'
                          : '客队地区转播 · 官方渠道'
                  }</span>
                </span>
                ${icon('external', 'watch-broadcaster__arrow')}
              </a>`,
            )
            .join('')}
        </div>
        <p class="watch-note-inline">${icon('info')}转播方与场次可能因地区、黑屏政策和临时调整而变化，请以平台节目单为准。</p>
      </section>

      <section class="watch-block">
        <div class="watch-block__head">
          <h3>持权平台</h3>
          <span>按地区选择</span>
        </div>
        <div class="platform-grid">
          ${PLATFORMS.map(
            (p) => `<a class="platform-card" href="${p.url}" target="_blank" rel="noopener noreferrer" style="--platform:${p.tone}">
              <span class="platform-card__short">${p.short}</span>
              <span class="platform-card__copy">
                <span class="platform-card__top"><strong>${p.name}</strong><em>${p.region}</em></span>
                <span class="platform-card__desc">${p.description}</span>
                <span class="platform-card__cta">${p.cta} ${icon('arrow-up-right')}</span>
              </span>
            </a>`,
          ).join('')}
        </div>
      </section>

      <div class="legal-note">
        <span class="legal-note__icon">${icon('info')}</span>
        <div>
          <strong>场边不提供任何非官方直播源。</strong>
          <p>我们只聚合官方与持权平台的入口，不收录第三方聚合站、盗链站或“免费直播”页面，避免恶意广告和账号风险。NBA 的转播版权按地区划分，部分场次可能出现黑屏或不可用，属于正常现象。</p>
        </div>
      </div>
    </div>
  </div>`;
}
