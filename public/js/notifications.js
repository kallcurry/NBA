/* Browser notification engine: tip-off, final score and close-game alerts. */

import { cnName, fmtTime } from './data.js';

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permissionState() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

function fire({ title, body, tag, gameId, force = false }) {
  if (!force && permissionState() !== 'granted') return false;
  try {
    const n = new Notification(title, {
      body,
      tag,
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      silent: false,
      data: { gameId },
    });
    n.onclick = () => {
      window.focus();
      if (gameId) window.location.hash = `#/game/${gameId}`;
      n.close();
    };
    window.setTimeout(() => n.close(), 12000);
    return true;
  } catch {
    return false;
  }
}

export function testNotification() {
  return fire({
    title: '场边 · 通知已就绪',
    body: '开赛前，我们会在这里提醒你。记得保持页面打开。',
    tag: 'courtside-test',
    force: true,
  });
}

function involvesFavorite(game, favorites) {
  return favorites.includes(game.away.abbr) || favorites.includes(game.home.abbr);
}

/**
 * Inspect the latest games and fire any due reminders.
 * All dedupe keys live in the persisted store, so a refresh won't spam.
 */
export function checkNotifications({
  games = [],
  store,
  notify = fire,
}) {
  const settings = store.settings;
  if (!settings.notificationsEnabled) return 0;
  if (permissionState() !== 'granted') return 0;

  let fired = 0;
  const now = Date.now();

  for (const game of games) {
    const explicit = store.hasReminder(game.id);
    const relevant = explicit || involvesFavorite(game, store.favorites);
    if (!relevant) continue;

    const start = new Date(game.startTime).getTime();
    const minutesToStart = (start - now) / 60000;

    if (
      settings.start &&
      game.status.state === 'pre' &&
      minutesToStart <= Number(settings.lead || 15) &&
      minutesToStart > -10
    ) {
      const key = `start:${game.id}`;
      if (!store.wasNotified(key)) {
        store.markNotified(key);
        const ok = notify({
          title: `还有 ${Math.max(1, Math.round(minutesToStart))} 分钟开赛`,
          body: `${cnName(game.away)} vs ${cnName(game.home)} · ${fmtTime(game.startTime)} · 北京时间`,
          tag: key,
          gameId: game.id,
        });
        if (ok) fired += 1;
      }
    }

    if (
      settings.final &&
      game.status.state === 'post' &&
      now - start < 8 * 3600 * 1000 &&
      involvesFavorite(game, store.favorites)
    ) {
      const key = `final:${game.id}`;
      if (!store.wasNotified(key)) {
        store.markNotified(key);
        const winner = game.home.score > game.away.score ? game.home : game.away;
        const ok = notify({
          title: '比赛结束',
          body: `${cnName(game.away)} ${game.away.score} - ${game.home.score} ${cnName(game.home)} · ${cnName(
            winner,
          )}获胜`,
          tag: key,
          gameId: game.id,
        });
        if (ok) fired += 1;
      }
    }

    if (
      settings.close &&
      game.status.state === 'in' &&
      game.status.period >= 4 &&
      Math.abs(game.home.score - game.away.score) <= 5 &&
      involvesFavorite(game, store.favorites)
    ) {
      const key = `close:${game.id}`;
      if (!store.wasNotified(key)) {
        store.markNotified(key);
        const ok = notify({
          title: '关键回合 · 分差 5 分以内',
          body: `${cnName(game.away)} ${game.away.score} - ${game.home.score} ${cnName(game.home)} · ${
            game.status.period > 4 ? '加时' : `第 ${game.status.period} 节`
          } ${game.status.clock || ''}`,
          tag: key,
          gameId: game.id,
        });
        if (ok) fired += 1;
      }
    }
  }
  return fired;
}

export function reminderLeadLabel(lead) {
  const n = Number(lead);
  if (n >= 60) return `${Math.round(n / 60)} 小时`;
  return `${n} 分钟`;
}
