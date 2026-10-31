# Courtside Android

A thin, standalone WebView shell for the COURTSIDE web app. The PWA assets
(`../public`) are bundled into the APK and the app uses the browser-friendly
ESPN web API directly, so there is no Node server to run on the phone.

## Build

Requirements:

- JDK 17+ (`JAVA_HOME`)
- Android SDK platform 35 and build-tools 35.0.0 (`ANDROID_HOME`)

```bash
export JAVA_HOME=/path/to/jdk
export ANDROID_HOME=/path/to/android-sdk
./build-apk.sh
```

The APK is written to `android/dist/courtside-1.1.3.apk`.

The `android/` directory also contains a normal Gradle project for Android
Studio. `local.properties` and the generated debug keystore are intentionally
ignored by Git.

## Notifications

Game reminders are scheduled natively with `AlarmManager`, with a
`BOOT_COMPLETED` receiver that restores them after a reboot. On Android 13+
the app asks for notification permission; on Android 12+ exact alarms may need
to be allowed in system settings. If exact alarms are unavailable the app
falls back to an inexact alarm.

Notifications tap through to `#/game/<id>`.

## Data

The APK calls `https://site.web.api.espn.com` directly. If ESPN is unreachable
from your network, the web/Node build (`../server.mjs`) is the fallback.
