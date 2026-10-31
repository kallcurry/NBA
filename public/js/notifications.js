/* Browser notification engine: tip-off, final score and close-game alerts. */

import { cnName, fmtTime } from './data.js';

function nativeBridge() {
  return typeof window !== 'undefined' ? window.CourtsideNative || null : null;
}

export function isNativeApp() {
  return Boolean(nativeBridge());
}

export function notificationsSupported() {
  return isNativeApp() || (typeof window !== 'undefined' && 'Notification' in window);
}

export function permissionState() {
  const native = nativeBridge();
  if (native) {
    try {
      return native.notificationPermission();
    } catch {
      return 'unsupported';
    }
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

const permissionWaiters = new Set();

if (typeof window !== 'undefined') {
  window.__courtsidePermissionResult = (state) => {
    for (const resolve of permissionWaiters) resolve(state);
    permissionWaiters.clear();
    window.dispatchEvent(new CustomEvent('courtside:notification-permission', { detail: state }));
  };
}

export async function requestPermission() {
  const native = nativeBridge();
  if (native) {
    const current = permissionState();
    if (current === 'granted' || current === 'denied') return current;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (state) => {
        if (settled) return;
        settled = true;
        permissionWaiters.delete(finish);
        resolve(state);
      };
      permissionWaiters.add(finish);
      try {
        native.requestNotificationPermission();
      } catch {
        finish('denied');
      }
      window.setTimeout(() => finish(permissionState()), 15000);
    });
  }
  if (!('Notification' in window)) return 'unsupported';
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
  const native = nativeBridge();
  if (native) {
    try {
      native.notifyNow(title, body, gameId || tag || '');
      return true;
    } catch {
      return false;
    }
  }
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
    body: isNativeApp()
      ? '开赛前，系统会提醒你。App 关闭后也会生效。'
      : '开赛前，我们会在这里提醒你。记得保持页面打开。',
    tag: 'courtside-test',
    force: true,
  });
}

/* ------------------------------------------------------------------ */
/* Native Android scheduled reminders                                 */
/* ------------------------------------------------------------------ */
const nativeScheduled = new Set();

export function scheduleNativeReminder(game, store) {
  const native = nativeBridge();
  if (!native || !game) return false;
  if (!store.settings.notificationsEnabled) return false;
  if (game.status?.state !== 'pre') return false;
  const start = new Date(game.startTime).getTime();
  const trigger = start - Number(store.settings.lead || 15) * 60000;
  if (!Number.isFinite(trigger)) return false;
  const title = '比赛即将开始';
  const body = `${cnName(game.away)} vs ${cnName(game.home)} · ${fmtTime(game.startTime)} · 北京时间`;
  try {
    if (trigger <= Date.now() + 1500) {
      native.notifyNow(title, body, String(game.id));
    } else {
      native.scheduleReminder(String(game.id), title, body, trigger, String(game.id));
    }
    nativeScheduled.add(String(game.id));
    return true;
  } catch {
    return false;
  }
}

export function cancelNativeReminder(gameId) {
  const native = nativeBridge();
  if (!native || gameId == null) return;
  try {
    native.cancelReminder(String(gameId));
  } catch {
    /* ignore */
  }
  nativeScheduled.delete(String(gameId));
}

export function cancelAllNativeReminders() {
  const native = nativeBridge();
  if (!native) return;
  try {
    native.cancelAllReminders();
  } catch {
    /* ignore */
  }
  nativeScheduled.clear();
}

function hydrateNativeScheduled(native) {
  if (nativeScheduled.size || !native?.scheduledIds) return;
  try {
    for (const id of String(native.scheduledIds() || '').split(',')) {
      if (id) nativeScheduled.add(id);
    }
  } catch {
    /* ignore */
  }
}

export function syncNativeReminders(games = [], store) {
  const native = nativeBridge();
  if (!native || !store?.settings?.notificationsEnabled) return 0;
  hydrateNativeScheduled(native);
  const desired = new Set();
  for (const game of games) {
    const explicit = store.hasReminder(game.id);
    const favorite = involvesFavorite(game, store.favorites);
    const relevant = explicit || (store.settings.start && favorite);
    if (!relevant || game.status?.state !== 'pre') continue;
    desired.add(String(game.id));
    if (!nativeScheduled.has(String(game.id))) scheduleNativeReminder(game, store);
  }
  for (const id of [...nativeScheduled]) {
    if (!desired.has(id)) cancelNativeReminder(id);
  }
  return desired.size;
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
      !isNativeApp() &&
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
