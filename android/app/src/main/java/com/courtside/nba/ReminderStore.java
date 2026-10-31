package com.courtside.nba;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONObject;

import java.util.Map;

final class ReminderStore {
    private static final String PREFS = "courtside_reminders";
    private static final String PREFIX = "reminder:";

    private ReminderStore() {}

    static void schedule(Context context, String id, String title, String body, long triggerAt, String gameId) {
        if (id == null || id.isEmpty() || triggerAt <= System.currentTimeMillis()) return;
        try {
            JSONObject object = new JSONObject();
            object.put("id", id);
            object.put("title", title == null ? "比赛提醒" : title);
            object.put("body", body == null ? "" : body);
            object.put("triggerAt", triggerAt);
            object.put("gameId", gameId == null ? "" : gameId);
            prefs(context).edit().putString(PREFIX + id, object.toString()).apply();
            setAlarm(context, object);
        } catch (Exception ignored) {
            // A malformed reminder should never crash the WebView.
        }
    }

    static void cancel(Context context, String id) {
        if (id == null || id.isEmpty()) return;
        prefs(context).edit().remove(PREFIX + id).apply();
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager != null) manager.cancel(pendingIntent(context, id));
    }

    static void cancelAll(Context context) {
        SharedPreferences preferences = prefs(context);
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        for (String key : preferences.getAll().keySet()) {
            String id = key.substring(PREFIX.length());
            if (manager != null) manager.cancel(pendingIntent(context, id));
        }
        preferences.edit().clear().apply();
    }

    static String ids(Context context) {
        StringBuilder builder = new StringBuilder();
        for (String key : prefs(context).getAll().keySet()) {
            if (!key.startsWith(PREFIX)) continue;
            if (builder.length() > 0) builder.append(',');
            builder.append(key.substring(PREFIX.length()));
        }
        return builder.toString();
    }

    static void markDelivered(Context context, String id) {
        if (id == null) return;
        prefs(context).edit().remove(PREFIX + id).apply();
    }

    static void rescheduleAll(Context context) {
        for (Map.Entry<String, ?> entry : prefs(context).getAll().entrySet()) {
            try {
                JSONObject object = new JSONObject(String.valueOf(entry.getValue()));
                long triggerAt = object.optLong("triggerAt", 0);
                if (triggerAt > System.currentTimeMillis()) setAlarm(context, object);
                else prefs(context).edit().remove(entry.getKey()).apply();
            } catch (Exception ignored) {
                prefs(context).edit().remove(entry.getKey()).apply();
            }
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void setAlarm(Context context, JSONObject object) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        String id = object.optString("id");
        long triggerAt = object.optLong("triggerAt");
        PendingIntent pendingIntent = pendingIntent(context, id);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        } else {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        }
    }

    private static PendingIntent pendingIntent(Context context, String id) {
        Intent intent = new Intent(context, ReminderReceiver.class);
        intent.putExtra("reminderId", id);
        return PendingIntent.getBroadcast(
                context,
                NotificationHelper.stableId(id),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
