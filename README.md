# 场边 COURTSIDE

> 每天，准时坐到场边。一个为 NBA 球迷做的每日比赛台：赛程、实时比分、比赛数据、开赛提醒，以及官方观赛入口。

> **安卓安装包（v1.1.2）**：[Courtside-1.1.3.apk](Courtside-1.1.3.apk) · [release 目录](release/)

![场边 COURTSIDE 桌面端](docs/preview-desktop.jpg)

## 为什么做它

每天想知道“今天有没有 NBA、几点打、在哪看”，通常要在赛程页、比分页、新闻和几个平台之间来回跳。场边把这些信息收进一个安静的界面里：

- 打开就知道今天有几场、谁在打、打到第几节；
- 点进一场比赛，先看**比赛分析图表**，再看球员数据和文字直播；
- 每个球员都有**中文名**（英文名保留在下方），不用再对着一串英文缩写认人；
- 关注的球队会排在前面，开赛前可以用浏览器通知提醒你；
- 想看直播时，只引导到官方或持权平台，不碰来路不明的“源”。

## 功能

### 今日比赛
- 按**北京时间**整理当天全部比赛，自动处理 NBA 美国比赛日跨天的问题。
- 正在直播、即将开赛、已结束分组展示。
- 直播比分每 20 秒自动刷新，比分变化有轻微高亮。
- 今日焦点自动选择最胶着/最值得看的比赛。

### 赛季中心
- 聚合 30 支球队的赛程，去重后展示完整 **2026-27 常规赛**（1200 场）。
- 阶段筛选：全部 / 常规赛 / 季前赛 / 季后赛；季后赛未开打时显示明确空状态。
- 月份导航：10 月到次年 4 月，每月场次数量一目了然。
- 球队筛选、完整比赛列表、直接进入比赛详情。
- 季后赛入口已预留，等 2027 年 4 月季后赛开打后自动展示对应赛程。

### 比赛分析（默认打开）
- **KPI 卡片**：当前分差、最大领先、投篮命中率、三分命中、篮板/助攻，一屏看懂。
- **胜率走势**：用 ESPN 实时 win probability 画出主队胜率曲线，面积颜色直接区分两队；没有胜率数据时自动退回分差走势。
- **分节得分**：Q1–Q4/加时的双柱图，直接看哪一节拉开。
- **六维雷达**：得分、投篮、三分、篮板、助攻、防守，两队轮廓对比。
- **主要得分点**：每队前 5 名得分手横向条形图，中文名 + 英文名。
- **进阶四因子**：eFG%、TS%、TOV%、ORB% 的效率面板。
- 首页也有“今日数据观察”：当天所有比赛的分差条和总得分条，不点进比赛也能扫一眼。

### 比赛详情
- 实时比分、分节比分、球馆、转播方。
- 球员数据：首发/替补、分钟、得分、篮板、助攻、命中率、正负值。
- 球员中文名来自 NBA 中国官方球员名单，覆盖当前全部现役球员；英文名保留在中文名下方，方便对照。
- 文字直播：按节次倒序，支持“只看得分”，已知球员名会自动替换为中文。
- 赛前/赛后信息：伤病名单、赛季交手、裁判、上座人数、盘口（有数据时）、赛后速递。
- 一键导出 `.ics` 日历，支持 Apple Calendar / Google Calendar / Outlook。

### 我的球队与排名
- 东西部排名、战绩、胜率、胜差、近况、场均得分。
- 关注球队后，首页优先展示、开赛提醒默认生效。
- 球队主页：下一场/正在进行的比赛、未来赛程、近期战绩、球队数据。

### 提醒
- 浏览器通知：开赛前 5–120 分钟提醒、完场比分、关键比分（末节/加时 5 分以内）。
- 单场比赛可以单独点铃铛设置提醒。
- **Android APK 使用原生 `AlarmManager` 排程**：设置好后关掉 App，到点仍会弹系统通知；重启手机后会自动恢复。
- 所有偏好保存在本机 `localStorage`，不需要账号。
- 可安装为 PWA，从桌面直接打开。

### 观赛指南
- 本场官方转播方（来自 ESPN 节目信息）。
- 持权平台目录：NBA League Pass、NBA TV、Prime Video、腾讯体育、咪咕视频、央视体育、ESPN/ABC、Peacock、YouTube TV、Hulu + Live TV、Fubo、Sling TV、DirecTV Stream。
- 黑屏、地区版权、League Pass 限制等常见问题。
- **不提供任何非官方直播源**，不收录第三方聚合站、盗链站或“免费直播”页面，只做官方入口聚合。

## 截图

| 赛季中心 | 比赛详情 | 手机端 |
| --- | --- | --- |
| ![赛季中心](docs/preview-season.jpg) | ![比赛详情](docs/preview-detail.jpg) | ![手机端](docs/preview-mobile.jpg) |

## 快速开始

要求：Node.js **20+**。没有数据库，也不需要安装 npm 依赖。

```bash
git clone git@github.com:kallcurry/NBA.git
cd NBA
npm start
```

打开 <http://127.0.0.1:4321>。

开发模式：

```bash
npm run dev
```

指定端口 / 监听地址：

```bash
PORT=8080 HOST=0.0.0.0 node server.mjs
```

## 设计说明

### 为什么是“场边”
界面不追求把联盟所有数据一次性铺开，而是模拟坐在场边的观看顺序：

1. **先看今天**：大标题、比赛数量、焦点战，三秒内知道今天值不值得熬夜。
2. **再看比分**：直播中的比赛用红色 LIVE、节次和倒计时抓住注意力。
3. **需要时再深入**：点开一场比赛才有完整技术统计和文字直播，避免首页信息过载。
4. **最后才是入口**：观赛渠道放在详情和独立指南里，不和比分抢注意力。

视觉上使用冷白文字、深海军蓝底色和蓝紫渐变作为强调色；球队颜色只作为低饱和光晕，避免变成“彩虹比分板”。数字使用 Barlow Condensed，中文使用系统中文字体，保证比分和长中文队名都清晰。

### 北京时间与 NBA 比赛日
NBA 官方比赛日按美国东部时间划分，而中国球迷说的“今天”是北京时间。比如美国时间 10 月 27 日晚上的比赛，北京时间是 10 月 28 日早上。

服务端会同时拉取目标日期前一个美国比赛日和当天的数据，再按 UTC 时间转换成的**北京日期**过滤、去重和排序。所有页面展示的时间都是 `Asia/Shanghai`。

### 实时比分
- 前端默认每 20 秒刷新一次；比赛详情页每 12 秒刷新。
- 服务端对 ESPN 响应做 9 秒缓存，避免多个标签页把请求打爆。
- 页面不可见时暂停轮询；恢复可见时立即补一次。
- 浏览器离线时展示最近一次成功缓存的比赛日快照。

### 提醒的现实边界

**网页 / PWA**：通知由页面里的定时检查触发，需要页面保持打开；浏览器完全退出后无法唤醒。

**Android APK**：开赛提醒由系统 `AlarmManager` 排程，App 关闭后仍能触发；需要通知权限，Android 12+ 最好允许“闹钟和提醒”权限。当前只做**本地定时提醒**，实时比分推送仍需要服务端 FCM/Web Push。

- 不收集、不上传任何个人数据。
- App 被用户“强行停止”后，Android 会取消它的闹钟，需要重新打开一次 App。

## 项目结构

```text
.
├── server.mjs                 # 零依赖静态服务器 + ESPN 数据代理 + 归一化
├── package.json
├── docker-compose.yml         # 本地 / 服务器 Docker 部署
├── .github/workflows/docker.yml # CI、GHCR 镜像、APK 自动构建
├── android/                   # 原生 WebView APK + AlarmManager 提醒
│   ├── build-apk.sh           # 不依赖 Gradle 的 APK 构建脚本
│   └── app/src/main/          # Manifest、Activity、Receiver
├── public/
│   ├── index.html             # 壳、SVG 图标 sprite
│   ├── manifest.webmanifest   # PWA
│   ├── sw.js                  # 应用外壳缓存（API 不缓存）
│   ├── css/styles.css         # 设计系统与响应式
│   ├── assets/                # 本地字体、图标
│   └── js/
│       ├── app.js             # 路由、轮询、交互、通知调度
│       ├── api.js             # 前端缓存 / 离线快照
│       ├── store.js           # 关注、提醒、设置持久化
│       ├── data.js            # 中文队名、平台、时间与颜色工具
│       ├── ui.js              # 通用 UI、弹层、Toast
│       ├── notifications.js   # 浏览器通知 + Android 原生桥
│       ├── espn-client.js     # APK 独立模式：直连 ESPN
│       ├── calendar.js        # .ics 导出
│       ├── components/        # 比赛卡片、比赛详情
│       └── views/             # 今日、赛程、赛季、球队、指南、设置
└── docs/                      # README 截图
```

## API

服务端把 ESPN 原始 JSON 归一化成前端友好的结构，并统一处理北京日期。

| 路径 | 说明 |
| --- | --- |
| `GET /api/health` | 健康检查 |
| `GET /api/scoreboard?date=YYYY-MM-DD` | 某个北京日期的比赛 |
| `GET /api/today` | 今天（北京时间）的比赛 |
| `GET /api/game?id=...` | 比赛详情、技术统计、文字直播、伤病 |
| `GET /api/teams` | 30 支球队 |
| `GET /api/standings` | 东西部排名 |
| `GET /api/team-schedule?team=ID` | 球队近期与未来赛程 |
| `GET /api/news` | ESPN NBA 新闻 |
| `GET /api/calendar` | 赛季比赛日（用于日历圆点） |
| `GET /api/season-schedule` | 聚合后的完整赛季赛程 |

数据来源：

- 比赛、比分、技术统计、胜率、新闻：[ESPN 公开 NBA API](https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard)
- 球员中文名：[NBA 中国官方球员名单](https://mchina.nba.cn/playerindex)
- 球队标识、球员头像：ESPN CDN

本项目不是 ESPN 或 NBA 的官方产品。

## 部署

### 直接运行

```bash
HOST=0.0.0.0 PORT=4321 npm start
```

### Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f
```

默认地址：<http://127.0.0.1:4321>。停止：

```bash
docker compose down
```

使用 GitHub Actions 发布到 GHCR 的镜像：

```bash
COURTSIDE_IMAGE=ghcr.io/kallcurry/nba:latest docker compose up -d --pull always
```

如果 GHCR 包是私有的，先执行：

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u kallcurry --password-stdin
```

### 自动构建

`.github/workflows/docker.yml` 会在 push 到 `main`、打 `v*` tag 或手动触发时：

1. 校验 JS 语法；
2. 启动 Node 服务并 smoke test；
3. `docker compose config` 校验；
4. 构建 Docker 镜像并启动容器做健康检查；
5. 自动构建 Android APK，上传 `courtside-apk` artifact；
6. 非 PR 构建时，把多架构镜像推送到 GHCR：
   - `ghcr.io/kallcurry/nba:latest`
   - `ghcr.io/kallcurry/nba:main`
   - `ghcr.io/kallcurry/nba:sha-<commit>`
   - 打 tag 时额外生成版本标签。

> 部署到 HTTPS 域名后，网页通知和 PWA 安装才能完整工作。`localhost` 也被视为安全上下文。

### 赛季赛程的数据来源

公开 API 没有“一次返回整个赛季”的干净端点，所以服务端会并行拉取 30 支球队的 `schedule`，按比赛 ID 去重，补上阶段标签，再缓存 1 小时。第一次打开赛季页会慢一些，之后是内存缓存。

```text
30 × /teams/{id}/schedule?season=2027
        ↓ 去重 / 排序 / 阶段标记
/api/season-schedule
        ↓
赛季中心（月份 + 阶段 + 球队筛选）
```

### Android APK

`android/` 是一个独立的 WebView 壳，打包了 `public/`，所以不需要在手机上跑 Node 服务。它使用 `site.web.api.espn.com` 直连数据，并通过原生桥接实现关掉 App 后的开赛提醒。

```bash
export JAVA_HOME=/path/to/jdk17+
export ANDROID_HOME=/path/to/android-sdk
./android/build-apk.sh
```

产物：

```text
android/dist/courtside-1.1.3.apk
```

1.1.1 修复了 Android 15 / 全面屏手机上顶栏与状态栏重叠的问题，并处理了底部手势条遮挡。

安装：

```bash
adb install -r android/dist/courtside-1.1.3.apk
```

说明：

- 当前 APK 使用 debug keystore 签名，适合个人安装；上架应用商店需要换成正式 release keystore。
- Android 13+ 会请求通知权限；Android 12+ 建议允许“闹钟和提醒”，否则提醒可能被系统延后。
- 手机网络无法直连 ESPN 时，APK 的数据会加载失败；此时请使用 Node 服务器版本，或把数据请求改成你自己的代理地址。

## 数据与版权

- 比赛、比分、统计、新闻来自 ESPN 的公开接口，仅用于个人学习与信息聚合。
- 球队标识、球员头像、新闻图片版权归 NBA、ESPN 及各权利人所有。
- “观看”入口只指向 NBA、ESPN、NBC、Peacock、腾讯体育、咪咕视频、央视体育等官方或持权平台。
- 本项目**不收录、不托管、不推荐任何非官方直播源**，包括第三方聚合站、盗链站和声称“免费高清”的页面。请通过持权平台观看比赛。
- 本项目不是 NBA、ESPN 或任何转播平台的官方产品。

## Roadmap

- [ ] Web Push，实现关掉网页后的提醒
- [ ] 球员搜索与球员主页
- [ ] 更完整的赛季数据榜（得分/篮板/助攻）
- [ ] 多语言（English）
- [ ] 球员中文名随交易/新秀自动更新
- [ ] 接入第二个数据源做容灾
- [ ] 可选的“仅看我的球队”首页模式

## License

MIT
