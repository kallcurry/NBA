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
  const activeTab = tab || (g.status.state === 'pre' ? 'info' : 'box');
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
          <button class="btn btn--ghost btn--sm ${hasReminder ? 'is-on' : ''}" data-action="toggle-reminder" data-id="${
            g.id
          }" data-date="${beijingDateOf(g.startTime)}">
            ${icon(hasReminder ? 'bell-ring' : 'bell')}<span class="btn__label">${hasReminder ? '已设提醒' : '开赛提醒'}</span>
          </button>
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
      <button role="tab" class="detail-tab ${activeTab === 'box' ? 'is-active' : ''}" data-action="detail-tab" data-tab="box" aria-selected="${
        activeTab === 'box'
      }">${icon('chart')}比赛数据</button>
      <button role="tab" class="detail-tab ${activeTab === 'plays' ? 'is-active' : ''}" data-action="detail-tab" data-tab="plays" aria-selected="${
        activeTab === 'plays'
      }">${icon('list')}文字直播 ${isLive(g) ? '<i class="tab-live-dot"></i>' : ''}</button>
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
  return renderBox(summary, game);
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
            <span class="leader-card__name">${c.name}</span>
            <span class="leader-card__team">${c.abbr}</span>
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
                  <span class="player-num">${p.jersey || ''}</span>
                  <span class="player-name">${p.name}${p.starter ? '<i class="starter-dot" title="首发"></i>' : ''}</span>
                  <span class="player-pos">${p.position || ''}</span>
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
    ${leaderCards(summary)}
    ${compareStats(summary, game)}
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
                    <span class="play__text">${escapeHtml(p.text)}</span>
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
                  <span class="injury-row__name">${escapeHtml(p.name)}</span>
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
          <p>我们只聚合官方与持权平台的入口，避免盗链、恶意广告和账号风险。NBA 的转播版权按地区划分，部分场次可能出现黑屏或不可用，属于正常现象。</p>
        </div>
      </div>
    </div>
  </div>`;
}
