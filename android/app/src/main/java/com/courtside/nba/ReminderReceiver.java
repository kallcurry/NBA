package com.courtside.nba;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONObject;

public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra("reminderId");
        if (id == null) return;
        SharedPreferences preferences = context.getSharedPreferences("courtside_reminders", Context.MODE_PRIVATE);
        String raw = preferences.getString("reminder:" + id, null);
        if (raw == null) return;
        try {
            JSONObject object = new JSONObject(raw);
            NotificationHelper.show(
                    context,
                    object.optString("title", "比赛提醒"),
                    object.optString("body", ""),
                    object.optString("gameId", "")
            );
        } catch (Exception ignored) {
            // Ignore malformed payloads.
        }
        ReminderStore.markDelivered(context, id);
    }
}
