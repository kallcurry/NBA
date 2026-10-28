/* Rendering primitives, overlays and toasts. */

import { broadcastShort, cnName, darkLogo, escapeHtml, statusText } from './data.js';

export function icon(name, className = '') {
  return `<svg class="icon ${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

export function logo(team, size = 'md', extraClass = '') {
  if (!team?.logo) {
    return `<span class="team-logo team-logo--${size} team-logo--fallback ${extraClass}" aria-hidden="true">${escapeHtml(
      team?.abbr?.slice(0, 3) || 'NBA',
    )}</span>`;
  }
  return `<span class="team-logo-wrap team-logo-wrap--${size} ${extraClass}"><img class="team-logo team-logo--${size}" src="${escapeHtml(
    darkLogo(team.logo),
  )}" alt="${escapeHtml(cnName(team))}队标" loading="lazy" decoding="async" /></span>`;
}

export function teamInline(team, { size = 'sm', showRecord = false, class: extra = '' } = {}) {
  return `<span class="team-inline ${extra}">
    ${logo(team, size)}
    <span class="team-inline__text">
      <span class="team-inline__name">${escapeHtml(cnName(team))}</span>
      ${showRecord && team.record ? `<span class="team-inline__record">${escapeHtml(team.record)}</span>` : ''}
    </span>
  </span>`;
}

export function broadcastChips(broadcasts = [], { max = 2, compact = false } = {}) {
  const list = broadcasts.filter((b) => b?.name);
  if (!list.length) return '';
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  return `<span class="broadcast-list ${compact ? 'broadcast-list--compact' : ''}">
    ${shown
      .map(
        (b) =>
          `<span class="broadcast-chip ${b.national ? 'is-national' : ''}" title="${escapeHtml(b.name)}">${
            b.national && !compact ? icon('tv') : ''
          }${escapeHtml(broadcastShort(b.name))}</span>`,
      )
      .join('')}
    ${rest > 0 ? `<span class="broadcast-chip broadcast-chip--more">+${rest}</span>` : ''}
  </span>`;
}

export function liveBadge({ label = 'LIVE' } = {}) {
  return `<span class="live-badge"><span class="live-dot" aria-hidden="true"></span>${label}</span>`;
}

export function statusLine(game) {
  const s = game.status;
  if (s.state === 'in') return `<span class="status-copy is-live">${escapeHtml(statusText(s))}</span>`;
  if (s.state === 'post') return `<span class="status-copy">${escapeHtml(statusText(s))}</span>`;
  return `<span class="status-copy is-pre">${escapeHtml(statusText(s))}</span>`;
}

export function sectionHeader({ index, title, meta = '', action = '' }) {
  return `<div class="section-head">
    <div class="section-head__main">
      ${index ? `<span class="section-index">${escapeHtml(index)}</span>` : ''}
      <h2 class="section-title">${title}</h2>
      ${meta ? `<span class="section-meta">${meta}</span>` : ''}
    </div>
    ${action ? `<div class="section-action">${action}</div>` : ''}
  </div>`;
}

export function emptyState({ iconName = 'today', title, description = '', action = '', compact = false }) {
  return `<div class="empty-state ${compact ? 'empty-state--compact' : ''}">
    <span class="empty-state__icon">${icon(iconName)}</span>
    <h3>${escapeHtml(title)}</h3>
    ${description ? `<p>${description}</p>` : ''}
    ${action ? `<div class="empty-state__action">${action}</div>` : ''}
  </div>`;
}

export function errorState(message, { retry = 'retry-data' } = {}) {
  return `<div class="error-state">
    <span class="error-state__icon">${icon('wifi-off')}</span>
    <div>
      <h3>数据没有接上</h3>
      <p>${escapeHtml(message || '请稍后重试。')}</p>
    </div>
    ${
      retry
        ? `<button class="btn btn--ghost btn--sm" data-action="${retry}">${icon('refresh')}重试</button>`
        : ''
    }
  </div>`;
}

export function skeletonRows(count = 3, variant = 'game') {
  return `<div class="skeleton-stack skeleton-stack--${variant}" aria-hidden="true">
    ${Array.from({ length: count })
      .map(
        () => `<div class="skeleton-row">
          <span class="skeleton skeleton--time"></span>
          <span class="skeleton skeleton--logo"></span>
          <span class="skeleton skeleton--line"></span>
          <span class="skeleton skeleton--score"></span>
        </div>`,
      )
      .join('')}
  </div>`;
}

export function skeletonsForPage() {
  return `<div class="page-loading">
    <div class="skeleton skeleton--eyebrow"></div>
    <div class="skeleton skeleton--headline"></div>
    <div class="skeleton skeleton--hero"></div>
    ${skeletonRows(4)}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Toast                                                              */
/* ------------------------------------------------------------------ */
let toastTimer = 0;

export function toast(message, { type = 'default', duration = 3600 } = {}) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span class="toast__icon">${icon(
    type === 'success' ? 'check' : type === 'error' ? 'info' : 'bell',
  )}</span><span class="toast__text"></span>`;
  el.querySelector('.toast__text').textContent = message;
  stack.append(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.classList.remove('is-visible');
    window.setTimeout(() => el.remove(), 280);
  }, duration);
}

/* ------------------------------------------------------------------ */
/* Overlays (stackable sheets / modals)                               */
/* ------------------------------------------------------------------ */
const overlayStack = [];
let previousFocus = null;

function lockScroll() {
  document.body.classList.add('no-scroll');
  document.getElementById('app')?.setAttribute('inert', '');
}

function unlockScroll() {
  if (!overlayStack.length) {
    document.body.classList.remove('no-scroll');
    document.getElementById('app')?.removeAttribute('inert');
  }
}

export function openOverlay({
  html,
  className = '',
  label = '对话框',
  modal = false,
  onClose = null,
  trigger = null,
} = {}) {
  const root = document.getElementById('overlay-root');
  const previous = overlayStack.at(-1);
  if (previous) previous.el.setAttribute('inert', '');
  if (!overlayStack.length) previousFocus = trigger || document.activeElement;

  const el = document.createElement('div');
  el.className = `overlay ${modal ? 'overlay--modal' : ''}`;
  el.innerHTML = `
    <div class="overlay__backdrop" data-overlay-backdrop></div>
    <section class="sheet ${modal ? 'sheet--modal' : 'sheet--side'} ${className}" role="dialog" aria-modal="true" aria-label="${escapeHtml(
      label,
    )}">
      ${html}
    </section>`;
  root.append(el);
  lockScroll();
  const handle = { el, onClose, trigger };
  overlayStack.push(handle);

  requestAnimationFrame(() => el.classList.add('is-open'));
  const focusTarget =
    el.querySelector('[autofocus]') ||
    el.querySelector('.sheet__close') ||
    el.querySelector('button, [href], input, select, textarea');
  window.setTimeout(() => focusTarget?.focus?.({ preventScroll: true }), 60);

  el.addEventListener('click', (event) => {
    if (event.target.closest('[data-overlay-backdrop]')) closeOverlay(handle);
    if (event.target.closest('[data-close-sheet]')) closeOverlay(handle);
  });

  return handle;
}

export function closeOverlay(handle = overlayStack.at(-1), { silent = false } = {}) {
  if (!handle) return;
  const index = overlayStack.indexOf(handle);
  if (index === -1) return;
  overlayStack.splice(index, 1);
  const { el, onClose } = handle;
  el.classList.remove('is-open');
  el.setAttribute('inert', '');
  window.setTimeout(() => {
    el.remove();
    const top = overlayStack.at(-1);
    if (top) {
      top.el.removeAttribute('inert');
      top.el.querySelector('.sheet__close, button')?.focus?.({ preventScroll: true });
    } else if (previousFocus?.isConnected) {
      previousFocus.focus?.({ preventScroll: true });
    }
    unlockScroll();
  }, 280);
  if (onClose && !silent) onClose();
}

export function closeTopOverlay() {
  closeOverlay(overlayStack.at(-1));
}

export function hasOverlay() {
  return overlayStack.length > 0;
}

export function topOverlayKind() {
  return overlayStack.at(-1)?.el?.querySelector('.sheet')?.dataset.kind || '';
}

document.addEventListener('keydown', (event) => {
  if (!overlayStack.length) return;
  const top = overlayStack.at(-1);
  if (event.key === 'Escape') {
    event.preventDefault();
    closeOverlay(top);
    return;
  }
  if (event.key !== 'Tab') return;
  const focusables = [
    ...top.el.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

/* Broken team/news images fall back gracefully without inline handlers. */
document.addEventListener(
  'error',
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = '1';
    if (img.closest('.team-logo-wrap')) {
      const wrap = img.closest('.team-logo-wrap');
      const text = img.alt?.replace('队标', '') || 'NBA';
      wrap.classList.add('team-logo-wrap--broken');
      wrap.innerHTML = `<span class="team-logo-fallback">${escapeHtml(text.slice(0, 3))}</span>`;
    } else {
      img.classList.add('is-broken');
      img.removeAttribute('src');
    }
  },
  true,
);

export function spinner() {
  return `<span class="spinner" aria-label="加载中"></span>`;
}
