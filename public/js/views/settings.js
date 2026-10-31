/* Settings sheet: notifications, reminders, refresh, install & data controls. */

import { cnName, fmtTime, relativeDay } from '../data.js';
import { icon } from '../ui.js';
import { permissionState, reminderLeadLabel } from '../notifications.js';

function switchRow({ key, title, desc, on, disabled = false }) {
  return `<div class="setting-row">
    <div class="setting-row__copy"><strong>${title}</strong><span>${desc}</span></div>
    <button class="switch ${on ? 'is-on' : ''}" role="switch" aria-checked="${on}" aria-label="${title}" data-action="toggle-setting" data-key="${key}" ${
      disabled ? 'disabled' : ''
    }><span class="switch__thumb"></span></button>
  </div>`;
}

function permissionCard(permission, enabled) {
  const nativeApp = typeof window !== 'undefined' && Boolean(window.CourtsideNative);
  if (permission === 'unsupported') {
    return `<div class="permission-card is-warn">${icon('info')}<div><strong>当前浏览器不支持通知</strong><p>可以继续使用比分和赛程功能；换用 Chrome、Edge 或 Safari 可开启提醒。</p></div></div>`;
  }
  if (permission === 'denied') {
    return `<div class="permission-card is-warn">${icon('bell')}<div><strong>通知权限被拒绝</strong><p>${
      nativeApp
        ? '请在系统设置 → 应用 → 场边 NBA → 通知中允许。'
        : '点击地址栏左侧的站点图标，把“通知”改为允许，然后刷新页面。'
    }</p></div></div>`;
  }
  if (permission === 'granted' && enabled) {
    return `<div class="permission-card is-ok">${icon('check')}<div><strong>通知已开启</strong><p>开赛前会按你的设置弹出提醒。请保持页面打开，或安装到桌面。</p></div><button class="text-link" data-action="disable-notifications">暂停</button></div>`;
  }
  return `<div class="permission-card">${icon('bell')}<div><strong>开启通知</strong><p>授权后，场边才能在开赛前提醒你。通知只在本机处理，不会上传。</p></div><button class="btn btn--primary btn--sm" data-action="enable-notifications">开启通知</button></div>`;
}

function remindersList(store, day, games) {
  const map = new Map((games || []).map((g) => [g.id, g]));
  const entries = Object.entries(store.reminders)
    .map(([id, r]) => {
      const game = map.get(id);
      const meta = r;
      const startTime = game?.startTime || meta.startTime;
      const label = game
        ? `${cnName(game.away)} vs ${cnName(game.home)}`
        : meta.label || 'NBA 比赛';
      return { id, r, game, startTime, label };
    })
    .filter((x) => x.startTime && new Date(x.startTime).getTime() > Date.now() - 4 * 3600 * 1000)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  if (!entries.length) {
    return `<div class="reminder-empty">${icon('bell')}<p>还没有单独设置提醒。点任意比赛右侧的铃铛即可添加。</p></div>`;
  }
  return `<div class="reminder-list">
    ${entries
      .map(
        ({ id, startTime, label }) => `<div class="reminder-row">
          <span class="reminder-row__icon">${icon('bell-ring')}</span>
          <span class="reminder-row__copy">
            <strong>${label}</strong>
            <span>${relativeDay(
              new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(startTime)),
            )} ${fmtTime(startTime)} · 提前 ${reminderLeadLabel(store.settings.lead)}</span>
          </span>
          <button class="icon-btn icon-btn--tiny" data-action="toggle-reminder" data-id="${id}" aria-label="删除提醒">${icon(
            'close',
          )}</button>
        </div>`,
      )
      .join('')}
  </div>`;
}

export function renderSettings({
  store,
  day = null,
  installAvailable = false,
  permission = permissionState(),
}) {
  const settings = store.settings;
  const upcoming = Object.keys(store.reminders).length;
  return `<div class="settings-sheet" data-kind="settings">
    <div class="sheet__head">
      <div>
        <span class="eyebrow eyebrow--small">${icon('settings')}设置</span>
        <h2>把场边调成你的样子</h2>
        <p>通知、提醒和刷新频率都保存在本机。</p>
      </div>
      <button class="sheet__close icon-btn" data-close-sheet aria-label="关闭">${icon('close')}</button>
    </div>

    <div class="settings-body">
      <section class="settings-section">
        <div class="settings-section__head"><h3>通知</h3><span>${permission === 'granted' ? '已授权' : '仅本机'}</span></div>
        ${permissionCard(permission, settings.notificationsEnabled)}
        <div class="setting-list">
          <div class="setting-row setting-row--stack">
            <div class="setting-row__copy"><strong>开赛提醒</strong><span>在跳球前提醒你，选一个提前量</span></div>
            <div class="lead-options" role="radiogroup" aria-label="提前多久提醒">
              ${[5, 10, 15, 30, 60, 120]
                .map(
                  (m) => `<button class="lead-option ${
                    Number(settings.lead) === m ? 'is-active' : ''
                  }" data-action="set-lead" data-value="${m}" role="radio" aria-checked="${
                    Number(settings.lead) === m
                  }">${m >= 60 ? `${m / 60} 小时` : `${m} 分钟`}</button>`,
                )
                .join('')}
            </div>
          </div>
          ${switchRow({
            key: 'start',
            title: '所有关注球队',
            desc: '关注的球队开赛前自动提醒',
            on: settings.start,
          })}
          ${switchRow({
            key: 'final',
            title: '完场比分',
            desc: '关注的球队比赛结束后推送结果',
            on: settings.final,
          })}
          ${switchRow({
            key: 'close',
            title: '关键比分',
            desc: '第四节或加时、分差 5 分以内时提醒一次',
            on: settings.close,
          })}
        </div>
        <div class="settings-actions">
          <button class="btn btn--ghost btn--sm" data-action="test-notification">${icon('bell')}发一条测试通知</button>
          <span class="settings-hint">${icon('info')}页面关闭后提醒会停止</span>
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section__head"><h3>我的比赛提醒</h3><span>${upcoming} 个</span></div>
        ${remindersList(store, day, day?.games || [])}
      </section>

      <section class="settings-section">
        <div class="settings-section__head"><h3>显示与刷新</h3><span>北京时间</span></div>
        <div class="setting-row">
          <div class="setting-row__copy"><strong>自动刷新</strong><span>直播中比分更新频率</span></div>
          <div class="segmented segmented--sm">
            ${[15, 20, 30, 60]
              .map(
                (s) =>
                  `<button class="segmented__btn ${Number(settings.refresh) === s ? 'is-active' : ''}" data-action="set-refresh" data-value="${s}">${
                    s < 60 ? `${s}s` : '60s'
                  }</button>`,
              )
              .join('')}
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row__copy"><strong>安装到桌面</strong><span>像 App 一样打开，提醒更稳定</span></div>
          ${
            installAvailable
              ? `<button class="btn btn--ghost btn--sm" data-action="install-app">${icon('download')}安装</button>`
              : `<span class="settings-hint">浏览器菜单 → 添加到主屏幕</span>`
          }
        </div>
      </section>

      <section class="settings-section settings-section--about">
        <div class="settings-section__head"><h3>关于场边</h3><span>v1.1.0</span></div>
        <p class="settings-about">
          场边是一个本地优先的 NBA 观赛助手：赛程、比分和比赛数据来自 ESPN 公开接口，球员中文名来自 NBA 中国官方球员名单；直播入口只指向官方与持权平台。
        </p>
        <div class="about-links">
          <a href="#/guide" class="text-link">观赛指南 ${icon('arrow-right')}</a>
          <a href="https://www.espn.com/nba/" target="_blank" rel="noopener noreferrer" class="text-link">ESPN NBA ${icon('external')}</a>
        </div>
        <div class="settings-danger">
          <button class="text-link text-link--danger" data-action="clear-data">清除本机数据</button>
          <span>关注、提醒和设置会被清空。</span>
        </div>
      </section>
    </div>
  </div>`;
}
