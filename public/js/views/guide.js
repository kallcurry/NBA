/* Watch guide: official platform directory, region notes, FAQ. */

import { beijingDateOf, cnName, fmtTime, PLATFORMS, relativeDay } from '../data.js';
import { icon, logo } from '../ui.js';
import { renderWatchSources } from '../components/watch-sources.js';

const FAQ = [
  {
    q: '为什么点了平台，还是提示黑屏或无法播放？',
    a: 'NBA 的转播权按国家和地区拆分，平台还会对全美直播、本地转播设置黑屏限制。能不能看，取决于你的网络位置、账号地区和当场版权，和 App 本身无关。',
  },
  {
    q: 'NBA League Pass 能看所有比赛吗？',
    a: '绝大多数常规赛可以，但全美直播场次、你所在地区的本地转播场次可能被黑屏，通常要等到赛后一段时间才能看回放。购买前建议先看 League Pass 的黑屏说明。',
  },
  {
    q: '在中国大陆，最方便的选择是什么？',
    a: '先看腾讯体育、咪咕视频和央视体育的当日节目单：前两者场次较多、需要会员或单场券，央视体育以重点场次为主且免费。具体以平台当天排播为准。',
  },
  {
    q: '怎么使用 JRSKAN 和 JRS16？',
    a: '在“直播源”里点开站点，再按球队和开赛时间选择比赛。Android APK 会交给系统浏览器打开，比赛详情中的“观看直播”也能找到相同入口。',
  },
  {
    q: '为什么开赛提醒没有响？',
    a: '网页通知需要你授权，并且页面保持打开（可以安装到桌面或固定标签页）。浏览器完全关闭后，本地提醒无法唤醒；这是当前版本的已知限制。',
  },
  {
    q: '比分为什么和电视上差几秒？',
    a: '数据来自 ESPN 的公开接口，通常有 5–20 秒延迟，电视画面也可能因信号链路不同而快慢不一。比分仅供参考。',
  },
];

function nationalGames(day) {
  return (day?.games || []).filter((g) => g.broadcasts.some((b) => b.national));
}

function nationalBlock(day) {
  const games = nationalGames(day);
  if (!games.length) {
    return `<div class="guide-national guide-national--empty">${icon('tv')}<span>今天没有标注全美直播的场次。地方转播和 League Pass 仍可关注。</span></div>`;
  }
  return `<div class="guide-national-list">
    ${games
      .map(
        (g) => `<button class="guide-national-game" data-action="open-game" data-id="${g.id}">
          <span class="guide-national-game__teams">
            ${logo(g.away, 'xs')}<span>${cnName(g.away)}</span><i>@</i>${logo(g.home, 'xs')}<span>${cnName(
              g.home,
            )}</span>
          </span>
          <span class="guide-national-game__meta">${relativeDay(beijingDateOf(g.startTime))} ${fmtTime(g.startTime)} · ${g.broadcasts
            .filter((b) => b.national)
            .map((b) => b.name)
            .join(' / ')}</span>
          ${icon('arrow-right')}
        </button>`,
      )
      .join('')}
  </div>`;
}

export function renderGuide({ day = null } = {}) {
  return `<div class="page page--guide">
    <header class="guide-hero">
      <div class="guide-hero__copy">
        <div class="eyebrow">${icon('guide')}观赛指南 <span>/ WATCH GUIDE</span></div>
        <h1>把球看懂，<br />也把路走对<span class="title-dot">.</span></h1>
        <p>选择直播源或观赛平台，按球队和开赛时间找到比赛。</p>
        <div class="guide-hero__actions">
          <a class="btn btn--primary" href="#/today">看今日比赛 ${icon('arrow-right')}</a>
          <a class="btn btn--ghost" href="https://www.nba.com/schedule" target="_blank" rel="noopener noreferrer">NBA 官方赛程 ${icon(
            'external',
          )}</a>
        </div>
      </div>
      <div class="guide-hero__art" aria-hidden="true">
        <div class="guide-orbit guide-orbit--1"></div>
        <div class="guide-orbit guide-orbit--2"></div>
        <div class="guide-ball">
          <span>NBA</span>
          <em>2026–27</em>
        </div>
        <span class="guide-float guide-float--1">LIVE</span>
        <span class="guide-float guide-float--2">官方渠道</span>
      </div>
    </header>

    <section class="guide-steps">
      <div class="guide-step">
        <span class="guide-step__num">01</span>
        <span class="guide-step__icon">${icon('schedule')}</span>
        <h3>先看今天有没有球</h3>
        <p>首页按北京时间整理当天全部比赛。直播中、即将开始、已结束，一眼分清。</p>
      </div>
      <div class="guide-step">
        <span class="guide-step__num">02</span>
        <span class="guide-step__icon">${icon('tv')}</span>
        <h3>再选一个观赛入口</h3>
        <p>打开直播源或平台页面，按球队和开赛时间选择比赛。</p>
      </div>
      <div class="guide-step">
        <span class="guide-step__num">03</span>
        <span class="guide-step__icon">${icon('bell')}</span>
        <h3>最后设个开赛提醒</h3>
        <p>点比赛右侧的铃铛。开赛前 15 分钟，浏览器会弹出通知，不用一直守着。</p>
      </div>
    </section>

    <section class="guide-section">${renderWatchSources()}</section>

    <section class="guide-section">
      <div class="section-head">
        <div class="section-head__main">
          <span class="section-index">01</span>
          <h2 class="section-title">持权平台</h2>
          <span class="section-meta">按地区与预算选择</span>
        </div>
      </div>
      <div class="platform-grid platform-grid--guide">
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

    <section class="guide-section guide-section--split">
      <div class="guide-region">
        <span class="eyebrow eyebrow--small">${icon('location')}中国大陆</span>
        <h2>国内看球，先查节目单</h2>
        <p>NBA 在中国大陆没有“一个平台包打天下”。同一场比赛，可能腾讯体育有、咪咕没有，也可能央视免费播重点场次。</p>
        <ul class="guide-list">
          <li><strong>腾讯体育</strong>：场次覆盖较全，部分比赛需要会员或单场券。</li>
          <li><strong>咪咕视频</strong>：常见体育赛事入口，转播场次随版权周期变化。</li>
          <li><strong>央视体育</strong>：重点场次免费，适合看焦点战，节目单以 CCTV5 / CCTV5+ 为准。</li>
        </ul>
        <p class="guide-region__hint">${icon('info')}不要根据“平台名字”判断有没有版权，以当天节目单和播放页为准。</p>
      </div>
      <div class="guide-region guide-region--alt">
        <span class="eyebrow eyebrow--small">${icon('guide')}海外 / 全场次</span>
        <h2>League Pass 适合谁</h2>
        <p>想追整季、看回放、切多视角，League Pass 是最完整的官方选择。但它不是“无脑全解锁”。</p>
        <ul class="guide-list">
          <li>全美直播场次可能黑屏，赛后才有回放。</li>
          <li>本地转播场次受地区限制，需要确认你的账号地区。</li>
          <li>购买前先看黑屏规则，别为一场球冲动下单。</li>
        </ul>
        <a class="text-link text-link--arrow" href="https://www.nba.com/watch/league-pass-stream" target="_blank" rel="noopener noreferrer">查看 League Pass ${icon(
          'external',
        )}</a>
      </div>
    </section>

    <section class="guide-section">
      <div class="section-head">
        <div class="section-head__main">
          <span class="section-index">02</span>
          <h2 class="section-title">今天在哪看</h2>
          <span class="section-meta">全美直播场次</span>
        </div>
      </div>
      ${nationalBlock(day)}
    </section>

    <section class="guide-section guide-section--faq">
      <div class="section-head">
        <div class="section-head__main">
          <span class="section-index">03</span>
          <h2 class="section-title">常见问题</h2>
          <span class="section-meta">黑屏、会员与提醒</span>
        </div>
      </div>
      <div class="faq-list">
        ${FAQ.map(
          (item, i) => `<details class="faq-item" ${i === 0 ? 'open' : ''}>
            <summary><span>${item.q}</span>${icon('plus')}</summary>
            <p>${item.a}</p>
          </details>`,
        ).join('')}
      </div>
    </section>

    <div class="legal-note legal-note--page">
      <span class="legal-note__icon">${icon('info')}</span>
      <div>
        <strong>关于直播源</strong>
        <p>场边提供 JRSKAN、JRS16 与各观赛平台的站点入口，不托管视频。赛事与线路可用性以站点页面为准，版权归属各权利人所有。</p>
      </div>
    </div>
  </div>`;
}
