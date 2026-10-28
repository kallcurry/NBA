/* Calendar (.ics) export — works with Apple Calendar, Google Calendar, Outlook. */

import { cnName, fmtTime } from './data.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

function icsDate(iso, addHours = 0) {
  const d = new Date(new Date(iso).getTime() + addHours * 3600 * 1000);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeICS(value = '') {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function eventFor(game) {
  const title = `NBA · ${cnName(game.away)} vs ${cnName(game.home)}`;
  const broadcast = (game.broadcasts || []).map((b) => b.name).join(' / ');
  const description = [
    `${cnName(game.away)}（${game.away.abbr}） vs ${cnName(game.home)}（${game.home.abbr}）`,
    `北京时间 ${fmtTime(game.startTime)} 开赛`,
    game.venue?.name ? `球馆：${game.venue.name}` : '',
    broadcast ? `转播：${broadcast}` : '',
    '由场边 COURTSIDE 添加',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    'BEGIN:VEVENT',
    `UID:courtside-${game.id}@local`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(game.startTime)}`,
    `DTEND:${icsDate(game.startTime, 3)}`,
    `SUMMARY:${escapeICS(title)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(`${game.venue?.name || ''}${game.venue?.city ? `, ${game.venue.city}` : ''}`)}`,
    `URL:${game.link || `https://www.espn.com/nba/game/_/gameId/${game.id}`}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
  ].join('\r\n');
}

function download(filename, content) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadGamesICS(games, filename = 'courtside-nba.ics') {
  const list = (Array.isArray(games) ? games : [games]).filter((g) => g?.startTime);
  if (!list.length) return false;
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Courtside//NBA Companion//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:场边 · NBA',
    'X-WR-TIMEZONE:Asia/Shanghai',
    ...list.map(eventFor),
    'END:VCALENDAR',
  ].join('\r\n');
  download(filename, body);
  return true;
}

export function downloadGameICS(game) {
  return downloadGamesICS(game, `courtside-${game.id}.ics`);
}

export function downloadDayICS(games, date) {
  return downloadGamesICS(games, `courtside-${date}.ics`);
}
