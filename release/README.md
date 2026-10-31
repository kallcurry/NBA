# 场边 NBA · Android APK

- 最新文件：`courtside-1.1.1.apk`
- 版本：1.1.1（versionCode 2）
- 包名：`com.courtside.nba`
- 最低系统：Android 8.0 / API 26
- 大小：约 379 KB
- 签名：debug keystore（个人安装包，不适合直接上架应用商店）

## 1.1.1 修复

- 修复 Android 15 / 全面屏手机上页面顶栏与状态栏重叠的问题。
- 加入系统栏 inset 处理，顶部不再压住时间和信号图标，底部导航栏也不会被手势条遮挡。

## 安装

手机允许“安装未知来源应用”后直接打开 APK，或：

```bash
adb install -r courtside-1.1.1.apk
```

已安装 1.1.0 可以直接覆盖安装，数据会保留。

## 通知

1. 打开 App → 设置 → 通知，开启通知。
2. Android 13+ 允许通知权限。
3. Android 12+ 建议允许“闹钟和提醒”，保证准时提醒。
4. 给一场未开始的比赛点铃铛，关闭 App 后到点仍会收到系统通知。

这是本地定时提醒；实时比分推送需要 FCM 服务端推送。

## 数据

APK 直接访问 `site.web.api.espn.com`，不需要在手机上运行 Node 服务。若手机网络无法访问 ESPN，数据会加载失败，请改用 Node 服务版本或配置可访问的代理。

## 校验

```bash
sha256sum -c SHA256SUMS
```
