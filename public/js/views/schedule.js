/* Month schedule + selected day games. */

import {
  addDays,
  dateParts,
  fmtDateLong,
  fmtTime,
  isFinal,
  isLive,
  relativeDay,
  todayStr,
} from '../data.js';
import { emptyState, icon, sectionHeader, spinner } from '../ui.js';
import { renderDateStrip, renderGameList } from '../components/game-card.js';

function monthMatrix(dateStr) {
  const { year, month } = dateParts(dateStr);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftMonth(dateStr, delta) {
  const { year, month } = dateParts(dateStr);
  const target = new Date(Date.UTC(year, month - 1 + delta, 1));
  return target.toISOString().slice(0, 10);
}

function firstGameDateInMonth(dateStr, calendarDates) {
  const { year, month } = dateParts(dateStr);
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const candidates = calendarDates.filter((d) => d.startsWith(prefix)).sort();
  return candidates[0] || dateStr;
}

function calendarCard(date, calendarDates, day) {
  const { year, month } = dateParts(date);
  const cells = monthMatrix(date);
  const set = new Set(calendarDates);
  const today = todayStr();
  return `<section class="calendar-card">
    <div class="calendar-card__head">
      <div>
        <span class="eyebrow eyebrow--small">${icon('schedule')}赛季日历</span>
        <h2>${year} 年 ${month} 月</h2>
      </div>
      <div class="calendar-card__nav">
        <a class="icon-btn" href="#/schedule/${shiftMonth(date, -1)}" aria-label="上个月">${icon('chevron-left')}</a>
        <a class="calendar-card__today" href="#/schedule/${today}">今天</a>
        <a class="icon-btn" href="#/schedule/${shiftMonth(date, 1)}" aria-label="下个月">${icon('chevron-right')}</a>
      </div>
    </div>
    <div class="calendar-grid calendar-grid--head" aria-hidden="true">
      ${['一', '二', '三', '四', '五', '六', '日'].map((d) => `<span>${d}</span>`).join('')}
    </div>
    <div class="calendar-grid" role="grid">
      ${cells
        .map((d, i) => {
          if (!d) return `<span class="calendar-cell is-empty" aria-hidden="true"></span>`;
          const p = dateParts(d);
          const hasGame = set.has(d);
          const selected = d === date;
          const isToday = d === today;
          const count = selected ? day?.count || 0 : null;
          return `<a class="calendar-cell ${selected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''} ${
            hasGame ? 'has-game' : ''
          }" href="#/schedule/${d}" role="gridcell" aria-label="${fmtDateLong(d)}${hasGame ? '，有比赛' : ''}" aria-selected="${selected}">
            <span class="calendar-cell__num">${p.day}</span>
            ${hasGame ? '<span class="calendar-cell__dot"></span>' : ''}
            ${selected && count ? `<span class="calendar-cell__count">${count}</span>` : ''}
          </a>`;
        })
        .join('')}
    </div>
    <div class="calendar-card__foot">
      <span><i class="legend-dot"></i>比赛日</span>
      <span><i class="legend-dot legend-dot--today"></i>今天</span>
      <span class="calendar-card__tz">北京时间</span>
    </div>
  </section>`;
}

function renderGroup(title, games, opts, meta = '') {
  if (!games.length) return '';
  return `<section class="schedule-group">
    <div class="schedule-group__head">
      <h3>${title}${meta ? `<span>${meta}</span>` : ''}</h3>
      <span>${games.length} 场</span>
    </div>
    ${renderGameList(games, opts)}
  </section>`;
}

export function renderSchedule({
  date,
  day,
  calendarDates = [],
  favorites = [],
  reminders = {},
  loading = false,
  error = null,
  stale = null,
}) {
  const games = day?.games || [];
  const live = games.filter(isLive);
  const upcoming = games.filter((g) => g.status.state === 'pre');
  const finals = games.filter(isFinal);
  const nextDate = calendarDates.find((d) => d > date);
  const opts = { favorites, reminders, empty: '' };
  const monthShift = (delta) => firstGameDateInMonth(shiftMonth(date, delta), calendarDates);

  return `<div class="page page--schedule">
    <header class="page-head page-head--simple">
      <div class="page-head__copy">
        <div class="eyebrow">${icon('schedule')}赛程 <span>/ SCHEDULE</span></div>
        <h1 class="page-title">赛季日历<span class="title-dot">.</span></h1>
        <p class="page-sub">2026-27 常规赛 · 所有时间均为北京时间 · 点选日期查看当天比赛</p>
      </div>
      <div class="page-head__aside">
        <a class="month-jump" href="#/schedule/${monthShift(-1)}">${icon('chevron-left')}上月</a>
        <a class="month-jump" href="#/schedule/${monthShift(1)}">下月${icon('chevron-right')}</a>
      </div>
    </header>

    ${renderDateStrip(date, calendarDates, { compact: true })}

    <div class="schedule-layout">
      ${calendarCard(date, calendarDates, day)}

      <section class="schedule-day">
        <div class="schedule-day__head">
          <div>
            <span class="eyebrow eyebrow--small">${relativeDay(date)} · ${dateParts(date).weekday}</span>
            <h2>${dateParts(date).month}月${dateParts(date).day}日</h2>
            <p>${
              loading && !day
                ? '正在载入比赛…'
                : games.length
                  ? `${games.length} 场比赛${live.length ? ` · ${live.length} 场正在进行` : ''}`
                  : '没有安排比赛'
            }</p>
          </div>
          <div class="schedule-day__actions">
            ${
              games.length
                ? `<button class="btn btn--ghost btn--sm" data-action="download-day-ics" data-date="${date}">${icon(
                    'download',
                  )}导出日历</button>`
                : ''
            }
          </div>
        </div>

        ${stale ? `<div class="stale-banner">${icon('wifi-off')}<span>正在展示缓存数据</span><button class="text-link" data-action="retry-data">重连</button></div>` : ''}
        ${error ? `<div class="inline-error">${icon('info')}${error}</div>` : ''}

        ${
          loading && !day
            ? `<div class="schedule-loading">${spinner()}正在载入 ${fmtDateLong(date)} 的比赛…</div>`
            : games.length
              ? `${renderGroup('正在直播', live, opts, 'LIVE')}
                 ${renderGroup('即将开赛', upcoming, opts)}
                 ${renderGroup('已结束', finals, opts)}`
              : error && !day
                ? ''
                : emptyState({
                  iconName: 'schedule',
                  title: '这一天没有比赛',
                  description: nextDate
                    ? `下一比赛日是 ${fmtDateLong(nextDate)}。`
                    : '可以看看本月其他日期，或回到今天的比赛。',
                  action: `<div class="empty-actions">
                    ${nextDate ? `<a class="btn btn--primary" href="#/schedule/${nextDate}">下一比赛日 ${icon('arrow-right')}</a>` : ''}
                    <a class="btn btn--ghost" href="#/today/${todayStr()}">回到今天</a>
                  </div>`,
                })
        }

        ${
          games.length
            ? `<div class="schedule-day__foot">
                <span>${icon('info')}数据来自 ESPN，赛程可能临时调整。</span>
                <span>${games[0] ? `首场 ${fmtTime(games[0].startTime)}` : ''}${
                  games.length > 1 ? ` · 末场 ${fmtTime(games[games.length - 1].startTime)}` : ''
                }</span>
              </div>`
            : ''
        }
      </section>
    </div>
  </div>`;
}
