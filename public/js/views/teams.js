/* Teams, conference standings and team sheet. */

import {
  beijingDateOf,
  cnCity,
  cnName,
  countdown,
  fmtDateLong,
  fmtTime,
  relativeDay,
  rgba,
  readableTeamColor,
  todayStr,
} from '../data.js';
import { emptyState, errorState, icon, logo, spinner } from '../ui.js';
import { renderMiniGame } from '../components/game-card.js';

function streakText(streak = '') {
  const m = /^([WL])(\d+)$/.exec(streak.trim());
  if (!m) return streak || '—';
  return `${m[2]} 连${m[1] === 'W' ? '胜' : '负'}`;
}

function recordSplit(overall = '') {
  const [w, l] = overall.split('-');
  return { wins: w || '0', losses: l || '0' };
}

function conferenceData(standings, key) {
  const list = standings?.conferences || [];
  return list.find((c) => c.abbreviation === key) || list[0] || { entries: [] };
}

function findEntry(standings, abbr) {
  for (const conf of standings?.conferences || []) {
    const entry = conf.entries.find((e) => e.team.abbr === abbr);
    if (entry) return { entry, conf };
  }
  return null;
}

function favCards(favorites, standings) {
  if (!favorites.length) {
    return `<div class="fav-teams-empty">
      <span class="fav-teams-empty__icon">${icon('star')}</span>
      <div>
        <strong>还没有关注球队</strong>
        <p>点表格右侧的星标，或在下方选择主队。关注后，比赛会优先出现，开赛前也能提醒你。</p>
      </div>
    </div>`;
  }
  return `<div class="fav-team-grid">
    ${favorites
      .map((abbr) => {
        const found = findEntry(standings, abbr);
        if (!found) return '';
        const { entry, conf } = found;
        const record = recordSplit(entry.stats.overall);
        return `<button class="fav-team-card" data-action="open-team" data-abbr="${abbr}" style="--team:${readableTeamColor(
          entry.team.color,
        )};--team-glow:${rgba(entry.team.color, 0.2)}">
          ${logo(entry.team, 'md')}
          <span class="fav-team-card__copy">
            <strong>${cnName(entry.team)}</strong>
            <span>${record.wins} 胜 ${record.losses} 负 · ${conf.abbreviation === 'East' ? '东部' : '西部'}</span>
          </span>
          <span class="fav-team-card__arrow">${icon('arrow-right')}</span>
        </button>`;
      })
      .filter(Boolean)
      .join('')}
    <button class="fav-team-card fav-team-card--add" data-action="scroll-teams">
      <span class="fav-team-card__plus">${icon('plus')}</span>
      <span class="fav-team-card__copy"><strong>添加球队</strong><span>从下方排名中选择</span></span>
    </button>
  </div>`;
}

function standingsTable(conf, favorites, standings) {
  const entries = [...(conf.entries || [])].sort(
    (a, b) => Number(a.stats.playoffSeed || 99) - Number(b.stats.playoffSeed || 99),
  );
  return `<div class="standings-table" role="table" aria-label="${conf.name}排名">
    <div class="standings-row standings-row--head" role="row">
      <span class="standings-cell standings-cell--rank">#</span>
      <span class="standings-cell standings-cell--team">球队</span>
      <span class="standings-cell">战绩</span>
      <span class="standings-cell standings-cell--pct">胜率</span>
      <span class="standings-cell standings-cell--gb">胜差</span>
      <span class="standings-cell standings-cell--streak">近况</span>
      <span class="standings-cell standings-cell--ppg">场均得分</span>
      <span class="standings-cell standings-cell--star"><span class="sr-only">关注</span></span>
    </div>
    ${entries
      .map((entry) => {
        const { team, stats } = entry;
        const record = recordSplit(stats.overall);
        const isFav = favorites.includes(team.abbr);
        const seed = stats.playoffSeed || '—';
        const isPlayoff = Number(seed) <= 6;
        const isPlayin = Number(seed) >= 7 && Number(seed) <= 10;
        return `<div class="standings-row ${isFav ? 'is-favorite' : ''}" role="row" data-action="open-team" data-abbr="${
          team.abbr
        }" tabindex="0">
          <span class="standings-cell standings-cell--rank">
            <span class="seed ${isPlayoff ? 'is-playoff' : isPlayin ? 'is-playin' : ''}">${seed}</span>
          </span>
          <span class="standings-cell standings-cell--team">
            ${logo(team, 'sm')}
            <span class="standings-team__copy">
              <strong>${cnName(team)}</strong>
              <em>${team.abbr}</em>
            </span>
          </span>
          <span class="standings-cell standings-cell--record">
            <strong>${record.wins}-${record.losses}</strong>
            <em>${stats.home || ''}${stats.home && stats.road ? ' · ' : ''}${stats.road || ''}</em>
          </span>
          <span class="standings-cell standings-cell--pct">${stats.winPercent?.replace(/^0/, '') || '.000'}</span>
          <span class="standings-cell standings-cell--gb">${stats.gamesBehind && stats.gamesBehind !== '-' ? stats.gamesBehind : '—'}</span>
          <span class="standings-cell standings-cell--streak ${stats.streak?.startsWith('W') ? 'is-win' : 'is-loss'}">${streakText(
            stats.streak,
          )}</span>
          <span class="standings-cell standings-cell--ppg">${stats.ppg || '—'}</span>
          <span class="standings-cell standings-cell--star">
            <button class="icon-btn icon-btn--tiny ${isFav ? 'is-on' : ''}" data-action="toggle-favorite" data-abbr="${
              team.abbr
            }" aria-label="${isFav ? '取消关注' : '关注'}${cnName(team)}">${icon(isFav ? 'star' : 'star')}</button>
          </span>
        </div>`;
      })
      .join('')}
  </div>`;
}

export function renderTeams({
  standings,
  favorites = [],
  activeConference = 'East',
  loading = false,
  error = null,
}) {
  if (loading && !standings) {
    return `<div class="page page--teams">
      <header class="page-head page-head--simple">
        <div><div class="skeleton skeleton--eyebrow"></div><div class="skeleton skeleton--headline"></div></div>
      </header>
      <div class="skeleton skeleton--teams"></div>
    </div>`;
  }
  if (error && !standings) {
    return `<div class="page page--teams">${errorState(error)}</div>`;
  }
  const conf = conferenceData(standings, activeConference);
  return `<div class="page page--teams">
    <header class="page-head page-head--simple">
      <div class="page-head__copy">
        <div class="eyebrow">${icon('teams')}球队 <span>/ TEAMS</span></div>
        <h1 class="page-title">球队与排名<span class="title-dot">.</span></h1>
        <p class="page-sub">${standings?.season || '2026-27'} 常规赛 · 关注球队，赛程与提醒会优先出现</p>
      </div>
      <div class="page-head__aside">
        <span class="data-badge">${icon('trophy')}${standings?.season || '2026-27'} 赛季</span>
      </div>
    </header>

    <section class="favorites-section">
      <div class="section-head">
        <div class="section-head__main">
          <span class="section-index">01</span>
          <h2 class="section-title">我的球队</h2>
          <span class="section-meta">${favorites.length} 支已关注</span>
        </div>
      </div>
      ${favCards(favorites, standings)}
    </section>

    <section class="standings-section" id="all-teams">
      <div class="section-head">
        <div class="section-head__main">
          <span class="section-index">02</span>
          <h2 class="section-title">联盟排名</h2>
          <span class="section-meta">${conf.name?.replace(' Conference', '') === 'Eastern' ? '东部' : conf.name?.replace(' Conference', '') === 'Western' ? '西部' : ''}</span>
        </div>
        <div class="section-action">
          <div class="segmented segmented--sm">
            <button class="segmented__btn ${activeConference === 'East' ? 'is-active' : ''}" data-action="conference" data-conf="East">东部</button>
            <button class="segmented__btn ${activeConference === 'West' ? 'is-active' : ''}" data-action="conference" data-conf="West">西部</button>
          </div>
        </div>
      </div>
      <p class="standings-hint">前 6 名直接进入季后赛，7-10 名进入附加赛。点击球队查看下一场比赛。</p>
      ${standingsTable(conf, favorites, standings)}
    </section>

    <div class="page-note">${icon('info')}排名与战绩来自 ESPN，更新可能有几分钟延迟。</div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Team sheet                                                          */
/* ------------------------------------------------------------------ */
function mergeLiveEntry(entry, todayGame, teamAbbr) {
  if (!entry || !todayGame || String(entry.id) !== String(todayGame.id)) return entry;
  const isHome = todayGame.home.abbr === teamAbbr;
  const team = isHome ? todayGame.home : todayGame.away;
  const opponent = isHome ? todayGame.away : todayGame.home;
  return {
    ...entry,
    status: todayGame.status,
    teamScore: team.score,
    opponentScore: opponent.score,
  };
}

export function renderTeamSheet({
  abbr,
  standings,
  schedule,
  todayGame = null,
  loading = false,
  error = null,
  favorite = false,
}) {
  const found = findEntry(standings, abbr);
  const entry = found?.entry;
  const team = entry?.team || {
    abbr,
    name: abbr,
    displayName: abbr,
    logo: null,
    color: '#ff5a1f',
  };
  const stats = entry?.stats || {};
  const confName = found?.conf?.abbreviation === 'East' ? '东部' : '西部';
  const record = recordSplit(stats.overall);
  const rawLiveGame = schedule?.recent?.find((g) => g.status?.state === 'in');
  const liveGame = mergeLiveEntry(rawLiveGame, todayGame, abbr);
  const recentGames = (schedule?.recent || []).map((g) => mergeLiveEntry(g, todayGame, abbr));
  const next = schedule?.upcoming?.[0];
  const color = readableTeamColor(team.color);
  const diffRaw = stats.diff || '—';
  const diffText = /^[+-]/.test(diffRaw) ? diffRaw : Number(diffRaw) > 0 ? `+${diffRaw}` : diffRaw;

  return `<div class="team-sheet" data-kind="team" style="--team:${color};--team-glow:${rgba(team.color, 0.25)}">
    <div class="team-sheet__hero">
      <div class="team-sheet__topbar">
        <span class="eyebrow eyebrow--small">${icon('teams')}球队主页</span>
        <button class="sheet__close icon-btn" data-close-sheet aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="team-sheet__identity">
        ${logo(team, 'xl')}
        <div class="team-sheet__name">
          <span class="team-sheet__city">${cnCity(team)}</span>
          <h2>${cnName(team)}</h2>
          <span class="team-sheet__abbr">${team.abbr} · ${confName}第 ${stats.playoffSeed || '—'}</span>
        </div>
        <div class="team-sheet__record">
          <strong>${record.wins}<em>-</em>${record.losses}</strong>
          <span>${stats.winPercent ? `胜率 ${stats.winPercent.replace(/^0/, '')}` : '本赛季'}</span>
        </div>
      </div>
      <div class="team-sheet__actions">
        <button class="btn ${favorite ? 'btn--primary' : 'btn--ghost'}" data-action="toggle-favorite" data-abbr="${
          team.abbr
        }">${icon('star')}${favorite ? '已关注' : '关注球队'}</button>
        ${
          next
            ? `<a class="btn btn--ghost" href="#/schedule/${beijingDateOf(next.date)}">${icon('schedule')}查看赛程</a>`
            : ''
        }
      </div>
    </div>

    <div class="team-sheet__body">
      ${
        loading && !schedule
          ? `<div class="team-sheet__loading">${spinner()}正在载入赛程…</div>`
          : error && !schedule
            ? errorState(error, { retry: 'retry-team' })
            : `${
                liveGame
                  ? `<section class="next-game next-game--live">
                      <div class="next-game__head"><span class="eyebrow eyebrow--small">${icon('flame')}正在进行</span><span>${liveGame.teamScore}-${liveGame.opponentScore}</span></div>
                      <div class="next-game__main">
                        ${logo(liveGame.opponent, 'lg')}
                        <div>
                          <h3>${liveGame.isHome ? '主场' : '客场'} vs ${cnName(liveGame.opponent)}</h3>
                          <p>${liveGame.status.period > 4 ? '加时' : `第 ${liveGame.status.period} 节`} ${liveGame.status.clock || ''}</p>
                        </div>
                        <button class="btn btn--primary btn--sm" data-action="open-game" data-id="${liveGame.id}">进入比赛 ${icon('arrow-right')}</button>
                      </div>
                    </section>`
                  : next
                    ? `<section class="next-game">
                        <div class="next-game__head"><span class="eyebrow eyebrow--small">${icon('clock')}下一场</span><span>${countdown(
                          next.date,
                        )}</span></div>
                        <div class="next-game__main">
                          ${logo(next.opponent, 'lg')}
                          <div>
                            <h3>${next.isHome ? '主场' : '客场'} vs ${cnName(next.opponent)}</h3>
                            <p>${relativeDay(beijingDateOf(next.date))} · ${fmtTime(
                              next.date,
                            )} · 北京时间</p>
                          </div>
                          <button class="btn btn--primary btn--sm" data-action="open-game" data-id="${next.id}">比赛详情 ${icon(
                            'arrow-right',
                          )}</button>
                        </div>
                        ${next.broadcasts?.length ? `<div class="next-game__tv">${next.broadcasts.map((b) => b.name).join(' · ')}</div>` : ''}
                      </section>`
                    : emptyState({ iconName: 'schedule', title: '赛季已结束', description: '暂无下一场比赛。', compact: true })
              }

              <div class="team-sheet__columns">
                <section class="detail-section">
                  <div class="detail-section__head"><h3>未来赛程</h3><span>${schedule?.upcoming?.length || 0} 场</span></div>
                  <div class="mini-list">
                    ${
                      schedule?.upcoming?.length
                        ? schedule.upcoming.map((g) => renderMiniGame(g)).join('')
                        : `<p class="muted-copy">暂无后续赛程。</p>`
                    }
                  </div>
                </section>
                <section class="detail-section">
                  <div class="detail-section__head"><h3>近期战绩</h3><span>近 ${schedule?.recent?.length || 0} 场</span></div>
                  <div class="mini-list">
                    ${
                      schedule?.recent?.length
                        ? recentGames.map((g) => renderMiniGame(g)).join('')
                        : `<p class="muted-copy">暂无近期比赛。</p>`
                    }
                  </div>
                </section>
              </div>

              <div class="team-sheet__facts">
                <div><span>场均得分</span><strong>${stats.ppg || '—'}</strong></div>
                <div><span>场均失分</span><strong>${stats.oppPpg || '—'}</strong></div>
                <div><span>净胜分</span><strong class="${Number(stats.diff) >= 0 ? 'is-win' : 'is-loss'}">${diffText}</strong></div>
                <div><span>近十场</span><strong>${stats.last10 || '—'}</strong></div>
              </div>`
      }
    </div>
  </div>`;
}
