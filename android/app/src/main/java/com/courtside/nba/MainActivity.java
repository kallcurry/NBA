package com.courtside.nba;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + ASSET_HOST + "/index.html?standalone=1";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 1001;

    private WebView webView;
    private String pendingGameId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        NotificationHelper.ensureChannel(this);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(14, 21, 38));
        window.setNavigationBarColor(Color.rgb(14, 21, 38));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 15 enforces edge-to-edge for targetSdk 35. Draw the
            // app under the bars and add the real insets to the root view.
            window.setDecorFitsSystemWindows(false);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(14, 21, 38));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setUserAgentString(settings.getUserAgentString() + " CourtsideAndroid/1.1.1");

        webView.addJavascriptInterface(new NativeBridge(), "CourtsideNative");
        webView.setWebViewClient(new LocalWebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                return true;
            }
        });

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(14, 21, 38));
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);
        applySystemBarPadding(root);

        handleGameIntent(getIntent());
        webView.loadUrl(START_URL);
    }

    private void applySystemBarPadding(View view) {
        view.setOnApplyWindowInsetsListener((v, insets) -> {
            int top = insets.getSystemWindowInsetTop();
            int bottom = insets.getSystemWindowInsetBottom();
            v.setPadding(0, top, 0, bottom);
            return insets;
        });
        view.post(() -> view.requestApplyInsets());
    }

    private void handleGameIntent(Intent intent) {
        if (intent == null) return;
        String gameId = intent.getStringExtra("gameId");
        if (gameId != null && !gameId.isEmpty()) {
            pendingGameId = gameId;
        }
    }

    private void navigateToPendingGame() {
        if (pendingGameId == null || webView == null) return;
        String safe = pendingGameId.replaceAll("[^0-9A-Za-z_-]", "");
        if (safe.isEmpty()) return;
        webView.evaluateJavascript("window.location.hash = '#/game/" + safe + "';", null);
        pendingGameId = null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleGameIntent(intent);
        navigateToPendingGame();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("CourtsideNative");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            dispatchPermission(granted ? "granted" : "denied");
        }
    }

    private void dispatchPermission(String state) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.__courtsidePermissionResult && window.__courtsidePermissionResult('" + state + "');",
                null
        );
    }

    private String notificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted";
        return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                ? "granted"
                : "default";
    }

    private boolean canScheduleExactAlarms() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager manager = (AlarmManager) getSystemService(ALARM_SERVICE);
        return manager != null && manager.canScheduleExactAlarms();
    }

    private final class NativeBridge {
        @JavascriptInterface
        public String notificationPermission() {
            return MainActivity.this.notificationPermission();
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                    dispatchPermission("granted");
                    return;
                }
                if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                    dispatchPermission("granted");
                    return;
                }
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
            });
        }

        @JavascriptInterface
        public boolean canScheduleExactAlarms() {
            return MainActivity.this.canScheduleExactAlarms();
        }

        @JavascriptInterface
        public void requestExactAlarmPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || canScheduleExactAlarms()) return;
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception ignored) {
                    // Some OEMs do not expose this settings page.
                }
            });
        }

        @JavascriptInterface
        public void scheduleReminder(String id, String title, String body, double triggerAt, String gameId) {
            if (id == null || id.isEmpty()) return;
            ReminderStore.schedule(MainActivity.this, id, title, body, (long) triggerAt, gameId);
        }

        @JavascriptInterface
        public String scheduledIds() {
            return ReminderStore.ids(MainActivity.this);
        }

        @JavascriptInterface
        public void cancelReminder(String id) {
            ReminderStore.cancel(MainActivity.this, id);
        }

        @JavascriptInterface
        public void cancelAllReminders() {
            ReminderStore.cancelAll(MainActivity.this);
        }

        @JavascriptInterface
        public void notifyNow(String title, String body, String gameId) {
            NotificationHelper.show(MainActivity.this, title, body, gameId);
        }

        @JavascriptInterface
        public String appVersion() {
            return "1.1.1";
        }

        @JavascriptInterface
        public void openExternal(String url) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ignored) {
                // No browser installed.
            }
        }
    }

    private final class LocalWebViewClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null || !ASSET_HOST.equals(uri.getHost())) return null;
            return serveAsset(uri);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null) return false;
            String scheme = uri.getScheme();
            if ("https".equals(scheme) && ASSET_HOST.equals(uri.getHost())) return false;
            if ("http".equals(scheme) || "https".equals(scheme)) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // No browser installed.
                }
                return true;
            }
            return false;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            navigateToPendingGame();
        }
    }

    private WebResourceResponse serveAsset(Uri uri) {
        String path = uri.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
        if (path.endsWith("/")) path = path + "index.html";
        if (path.contains("..")) return notFound();

        String assetPath = "public" + path;
        try {
            InputStream stream = getAssets().open(assetPath);
            WebResourceResponse response = new WebResourceResponse(mimeType(assetPath), encodingFor(assetPath), stream);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            headers.put("Access-Control-Allow-Origin", "*");
            response.setResponseHeaders(headers);
            return response;
        } catch (IOException error) {
            return notFound();
        }
    }

    private WebResourceResponse notFound() {
        return new WebResourceResponse(
                "text/plain",
                StandardCharsets.UTF_8.name(),
                new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8))
        );
    }

    private String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    private String encodingFor(String path) {
        if (path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".jpeg")
                || path.endsWith(".webp") || path.endsWith(".woff2") || path.endsWith(".ico")) {
            return null;
        }
        return StandardCharsets.UTF_8.name();
    }
}
