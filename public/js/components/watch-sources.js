import { WATCH_SOURCES } from '../data.js';
import { icon } from '../ui.js';

export function renderWatchSources() {
  return `<section class="watch-block">
    <div class="watch-block__head"><h3>直播源</h3><span>打开站点选择比赛</span></div>
    <div class="platform-grid">
      ${WATCH_SOURCES.map((p) => `<a class="platform-card" data-watch-source="${p.id}" href="${p.url}" target="_blank" rel="noopener noreferrer" style="--platform:${p.tone}">
        <span class="platform-card__short">${p.short}</span>
        <span class="platform-card__copy">
          <span class="platform-card__top"><strong>${p.name}</strong><em>${p.region}</em></span>
          <span class="platform-card__desc">${p.description}</span>
          <span class="platform-card__cta">${p.cta} ${icon('arrow-up-right')}</span>
        </span>
      </a>`).join('')}
    </div>
  </section>`;
}
