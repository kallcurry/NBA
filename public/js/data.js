/* Shared domain data, Chinese copy helpers and formatting utilities. */

export const TZ = 'Asia/Shanghai';

// Intl constructors are expensive in Android WebView. Reuse them across rows.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});

export const TEAM_CN = {
  ATL: '老鹰',
  BOS: '凯尔特人',
  BKN: '篮网',
  CHA: '黄蜂',
  CHI: '公牛',
  CLE: '骑士',
  DAL: '独行侠',
  DEN: '掘金',
  DET: '活塞',
  GS: '勇士',
  GSW: '勇士',
  HOU: '火箭',
  IND: '步行者',
  LAC: '快船',
  LAL: '湖人',
  MEM: '灰熊',
  MIA: '热火',
  MIL: '雄鹿',
  MIN: '森林狼',
  NO: '鹈鹕',
  NOP: '鹈鹕',
  NY: '尼克斯',
  NYK: '尼克斯',
  OKC: '雷霆',
  ORL: '魔术',
  PHI: '76人',
  PHX: '太阳',
  POR: '开拓者',
  SAC: '国王',
  SA: '马刺',
  SAS: '马刺',
  TOR: '猛龙',
  UTAH: '爵士',
  UTA: '爵士',
  WSH: '奇才',
  WAS: '奇才',
};

export const TEAM_CITY_CN = {
  ATL: '亚特兰大',
  BOS: '波士顿',
  BKN: '布鲁克林',
  CHA: '夏洛特',
  CHI: '芝加哥',
  CLE: '克利夫兰',
  DAL: '达拉斯',
  DEN: '丹佛',
  DET: '底特律',
  GS: '金州',
  GSW: '金州',
  HOU: '休斯顿',
  IND: '印第安纳',
  LAC: '洛杉矶',
  LAL: '洛杉矶',
  MEM: '孟菲斯',
  MIA: '迈阿密',
  MIL: '密尔沃基',
  MIN: '明尼苏达',
  NO: '新奥尔良',
  NOP: '新奥尔良',
  NY: '纽约',
  NYK: '纽约',
  OKC: '俄克拉荷马城',
  ORL: '奥兰多',
  PHI: '费城',
  PHX: '菲尼克斯',
  POR: '波特兰',
  SAC: '萨克拉门托',
  SA: '圣安东尼奥',
  SAS: '圣安东尼奥',
  TOR: '多伦多',
  UTAH: '犹他',
  UTA: '犹他',
  WSH: '华盛顿',
  WAS: '华盛顿',
};

const NAME_CN = {
  Hawks: '老鹰',
  Celtics: '凯尔特人',
  Nets: '篮网',
  Hornets: '黄蜂',
  Bulls: '公牛',
  Cavaliers: '骑士',
  Mavericks: '独行侠',
  Nuggets: '掘金',
  Pistons: '活塞',
  Warriors: '勇士',
  Rockets: '火箭',
  Pacers: '步行者',
  Clippers: '快船',
  Lakers: '湖人',
  Grizzlies: '灰熊',
  Heat: '热火',
  Bucks: '雄鹿',
  Timberwolves: '森林狼',
  Pelicans: '鹈鹕',
  Knicks: '尼克斯',
  Thunder: '雷霆',
  Magic: '魔术',
  '76ers': '76人',
  Suns: '太阳',
  'Trail Blazers': '开拓者',
  Kings: '国王',
  Spurs: '马刺',
  Raptors: '猛龙',
  Jazz: '爵士',
  Wizards: '奇才',
};

export function cnName(team = {}) {
  return (
    TEAM_CN[team.abbr] ||
    TEAM_CN[team.abbreviation] ||
    NAME_CN[team.name] ||
    NAME_CN[team.displayName?.split(' ').slice(-1)[0]] ||
    team.name ||
    team.abbr ||
    '未知'
  );
}

export function cnCity(team = {}) {
  return TEAM_CITY_CN[team.abbr] || TEAM_CITY_CN[team.abbreviation] || team.location || '';
}

export function cnFullName(team = {}) {
  const city = cnCity(team);
  const name = cnName(team);
  return city && city !== name ? `${city}${name}` : name;
}

export function teamKey(team = {}) {
  return team.abbr || team.abbreviation || '';
}

export function darkLogo(url) {
  if (!url) return '';
  return url
    .replace('/teamlogos/nba/500/scoreboard/', '/teamlogos/nba/500-dark/scoreboard/')
    .replace('/teamlogos/nba/500/', '/teamlogos/nba/500-dark/');
}

/* ------------------------------------------------------------------ */
/* Broadcasters & official platforms                                  */
/* ------------------------------------------------------------------ */
const BROADCAST_SHORT = {
  'NBA League Pass': 'League Pass',
  'NBA TV': 'NBA TV',
  'Amazon Prime Video': 'Prime Video',
  'Spectrum Sports Net': 'Spectrum',
  'Spectrum Sports Net +': 'Spectrum+',
  'DAZN (YES)': 'DAZN',
  'FanDuel Sports Network': 'FanDuel',
  'MSG Network': 'MSG',
  'NBC Sports Boston': 'NBC Boston',
  'NBC Sports Philadelphia': 'NBC Philly',
  'NBC Sports Bay Area': 'NBC Bay Area',
  'NBC Sports California': 'NBC California',
  'NBC Sports Chicago': 'NBC Chicago',
  'Bally Sports': 'Bally',
};

export function broadcastShort(name = '') {
  if (BROADCAST_SHORT[name]) return BROADCAST_SHORT[name];
  return name.replace(/\s*\([^)]*\)/g, '').replace(' Sports', '').trim();
}

export const WATCH_SOURCES = [
  {
    id: 'jrskan', name: 'JRSKAN', short: 'JRS', region: '第三方赛事站',
    tone: '#6d8cff', url: 'https://www.jrskan.com/?ref=www.dhhao.com',
    description: '打开赛事列表，在站内选择比赛和播放线路。', cta: '打开 JRSKAN',
  },
  {
    id: 'jrs16', name: 'JRS16 手机版', short: 'JRS16', region: '第三方赛事站 · 手机',
    tone: '#5ee0b2', url: 'https://m.jrs16.com/',
    description: '手机赛事入口，比赛和播放线路以站点实时页面为准。', cta: '打开 JRS16',
  },
];

export const PLATFORMS = [
  {
    id: 'league-pass',
    name: 'NBA League Pass',
    short: 'LP',
    region: '官方 · 全球',
    tone: '#6d8cff',
    description: 'NBA 官方全场次订阅服务。可回看、切多视角，具体可用性取决于所在地区。',
    url: 'https://www.nba.com/watch/league-pass-stream',
    cta: '前往 NBA 官方',
  },
  {
    id: 'nba-tv',
    name: 'NBA TV',
    short: 'NBA TV',
    region: '官方 · 24 小时',
    tone: '#4f7cff',
    description: 'NBA 官方频道，播比赛、集锦和战术节目。是否可用取决于你的电视或有线服务商。',
    url: 'https://www.nba.com/watch/nba-tv',
    cta: 'NBA TV 官方',
  },
  {
    id: 'prime',
    name: 'Prime Video',
    short: 'PRIME',
    region: '美国 / 国际',
    tone: '#58a6ff',
    description: 'Amazon 的流媒体服务，部分 NBA 场次与 NBA TV 内容可在这里观看。',
    url: 'https://www.amazon.com/gp/video/storefront',
    cta: '打开 Prime Video',
  },
  {
    id: 'tencent',
    name: '腾讯体育',
    short: '腾讯',
    region: '中国大陆',
    tone: '#2f9cff',
    description: '国内常用的 NBA 观赛平台。转播场次、会员权益与解说以当日节目单为准。',
    url: 'https://sports.qq.com/nba/',
    cta: '查看 NBA 频道',
  },
  {
    id: 'migu',
    name: '咪咕视频',
    short: '咪咕',
    region: '中国大陆',
    tone: '#ff4d6d',
    description: '国内常见的体育赛事平台。是否转播本场，请以平台当日赛程与节目单为准。',
    url: 'https://www.miguvideo.com/',
    cta: '打开咪咕视频',
  },
  {
    id: 'cctv',
    name: '央视体育',
    short: 'CCTV',
    region: '中国大陆 · 免费场次',
    tone: '#f2c94c',
    description: 'CCTV5 / CCTV5+ 会选择性直播重点场次，可通过央视体育客户端查看节目单。',
    url: 'https://tv.cctv.com/live/cctv5/',
    cta: 'CCTV5 直播页',
  },
  {
    id: 'espn',
    name: 'ESPN / ABC',
    short: 'ESPN',
    region: '美国',
    tone: '#e23b3b',
    description: '美国地区的 NBA 转播方之一。ESPN 与 ABC 的场次分布随赛程变化。',
    url: 'https://www.espn.com/watch/',
    cta: 'ESPN Watch',
  },
  {
    id: 'peacock',
    name: 'Peacock',
    short: 'PCO',
    region: '美国流媒体',
    tone: '#9a7bff',
    description: 'NBC 体育流媒体平台，部分 NBA 场次在此独家或同步播出。',
    url: 'https://www.peacocktv.com/',
    cta: 'Peacock',
  },
  {
    id: 'youtube-tv',
    name: 'YouTube TV',
    short: 'YTTV',
    region: '美国 · 直播电视',
    tone: '#ff5f7e',
    description: '美国流媒体电视服务，包含 ESPN、ABC、NBC 等频道；NBA 场次取决于当地频道与套餐。',
    url: 'https://tv.youtube.com/',
    cta: 'YouTube TV',
  },
  {
    id: 'hulu',
    name: 'Hulu + Live TV',
    short: 'HULU',
    region: '美国 · 直播电视',
    tone: '#5ee0b2',
    description: '包含 ESPN、ABC 等直播频道的套餐，适合已经在美国、想看线性电视的球迷。',
    url: 'https://www.hulu.com/live-tv',
    cta: 'Hulu + Live TV',
  },
  {
    id: 'fubo',
    name: 'Fubo',
    short: 'FUBO',
    region: '美国 · 直播电视',
    tone: '#ff9a62',
    description: '以体育频道为主的流媒体电视服务，频道与地区限制以套餐说明为准。',
    url: 'https://www.fubo.tv/',
    cta: 'Fubo',
  },
  {
    id: 'sling',
    name: 'Sling TV',
    short: 'SLING',
    region: '美国 · 直播电视',
    tone: '#6d8cff',
    description: '按频道包订阅的流媒体电视，适合只想补几个体育频道的用户。',
    url: 'https://www.sling.com/',
    cta: 'Sling TV',
  },
  {
    id: 'directv',
    name: 'DirecTV Stream',
    short: 'DTV',
    region: '美国 · 直播电视',
    tone: '#8b9cff',
    description: '美国流媒体电视服务，包含地区体育频道和部分全国频道。',
    url: 'https://streamtv.directv.com/',
    cta: 'DirecTV Stream',
  },
];

const BROADCAST_LINKS = {
  'NBA League Pass': 'https://www.nba.com/watch/league-pass-stream',
  ESPN: 'https://www.espn.com/watch/',
  ABC: 'https://www.espn.com/watch/',
  NBC: 'https://www.nbc.com/',
  Peacock: 'https://www.peacocktv.com/',
  'Amazon Prime Video': 'https://www.amazon.com/gp/video/storefront',
  'NBA TV': 'https://www.nba.com/watch/nba-tv',
  DAZN: 'https://www.dazn.com/',
};

export function broadcasterUrl(name = '') {
  if (BROADCAST_LINKS[name]) return BROADCAST_LINKS[name];
  if (/Spectrum/i.test(name)) return 'https://www.spectrumsportsnet.com/';
  if (/MSG/i.test(name)) return 'https://www.msgnetworks.com/';
  if (/NBC Sports/i.test(name)) return 'https://www.nbcsports.com/';
  if (/DAZN/i.test(name)) return 'https://www.dazn.com/';
  if (/FanDuel|Bally/i.test(name)) return 'https://www.fanduelsportsnetwork.com/';
  return 'https://www.nba.com/watch/';
}

/* ------------------------------------------------------------------ */
/* Date & status formatting (all display times are Beijing time)      */
/* ------------------------------------------------------------------ */
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WEEKDAYS_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function todayStr() {
  return dayFormatter.format(new Date());
}

export function beijingDateOf(iso) {
  if (!iso) return todayStr();
  return dayFormatter.format(new Date(iso));
}

export function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function dateParts(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(`${dateStr}T12:00:00+08:00`);
  return { year, month, day, weekday: WEEKDAYS[d.getUTCDay()], weekdayShort: WEEKDAYS_SHORT[d.getUTCDay()] };
}

export function fmtTime(iso) {
  if (!iso) return '--:--';
  return timeFormatter.format(new Date(iso));
}

export function fmtDateLong(dateStr) {
  const { year, month, day, weekday } = dateParts(dateStr);
  return `${year}年${month}月${day}日 ${weekday}`;
}

export function fmtDateMedium(dateStr) {
  const { month, day, weekdayShort } = dateParts(dateStr);
  return `${month}月${day}日 ${weekdayShort}`;
}

export function relativeDay(dateStr) {
  const today = todayStr();
  if (dateStr === today) return '今天';
  if (dateStr === addDays(today, 1)) return '明天';
  if (dateStr === addDays(today, -1)) return '昨天';
  return fmtDateMedium(dateStr);
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 2) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return fmtDateMedium(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso)));
}

export function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date()),
  );
  if (hour < 5) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function countdown(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return '即将开始';
  const min = Math.round(diff / 60000);
  if (min < 60) return `还有 ${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `还有 ${h} 小时${m ? ` ${m} 分` : ''}`;
  return `${Math.floor(h / 24)} 天后`;
}

export function isLive(game) {
  return game?.status?.state === 'in';
}

export function isFinal(game) {
  return game?.status?.state === 'post';
}

export function isPre(game) {
  return game?.status?.state === 'pre';
}

export function periodText(status = {}) {
  if (status.isHalftime) return '中场休息';
  if (status.typeName === 'STATUS_END_PERIOD') {
    return status.period > 4 ? '加时结束' : `第${status.period}节结束`;
  }
  if (!status.period) return status.description || '进行中';
  if (status.period > 4) return `加时 ${status.clock || ''}`.trim();
  return `第${status.period}节 ${status.clock || ''}`.trim();
}

export function statusText(status = {}) {
  if (status.state === 'post') {
    return /ot|overtime/i.test(status.detail || status.shortDetail || '') ? '已结束 · 加时' : '已结束';
  }
  if (status.state === 'in') return periodText(status);
  if (/POSTPONED/i.test(status.typeName)) return '延期';
  if (/CANCELED|CANCELLED/i.test(status.typeName)) return '取消';
  if (/DELAYED/i.test(status.typeName)) return '延迟';
  return '未开始';
}

export function statusShort(status = {}) {
  if (status.state === 'post') return '完场';
  if (status.state === 'in') {
    if (status.isHalftime) return '中场';
    return status.period > 4 ? `加时 ${status.clock}` : `第${status.period}节 ${status.clock}`;
  }
  return '未开始';
}

export function gameMargin(game) {
  return Math.abs((game?.home?.score || 0) - (game?.away?.score || 0));
}

export function leaderOf(game) {
  if (game?.status?.state === 'pre') return null;
  if (game.home.score === game.away.score) return null;
  return game.home.score > game.away.score ? game.home : game.away;
}

export function matchupCn(game) {
  if (!game) return '';
  return `${cnName(game.away)} vs ${cnName(game.home)}`;
}

/* ------------------------------------------------------------------ */
/* Color helpers                                                       */
/* ------------------------------------------------------------------ */
export function hexToRgb(hex = '#888888') {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 136, g: 136, b: 136 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function readableTeamColor(hex = '#888888') {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance < 0.18) {
    return `rgb(${Math.min(255, r + 90)}, ${Math.min(255, g + 90)}, ${Math.min(255, b + 90)})`;
  }
  return hex;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function pct(value) {
  return `${Math.round(value * 100)}%`;
}
