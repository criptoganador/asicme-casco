package com.asicme.casco;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class UvcForegroundService extends Service {
    private static final String TAG = "UvcForegroundService";
    private static final String CHANNEL_ID = "UvcStreamChannel";
    private static final int NOTIFICATION_ID = 1001;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Foreground Service creado.");
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Foreground Service iniciado. Protegiendo proceso...");
        
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("AsicMe Casco")
                .setContentText("Transmisión USB activa en segundo plano")
                .setSmallIcon(android.R.drawable.stat_sys_warning) // Puedes cambiarlo por tu icono
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();

        // Android 14+ requiere especificar el tipo de servicio (connectedDevice)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        // START_STICKY asegura que si el sistema lo mata (extrema falta de RAM), intente revivirlo
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Foreground Service destruido. Proceso liberado.");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        // No necesitamos binding (comunicación directa con actividades) para este caso,
        // solo necesitamos que el servicio viva para elevar la prioridad del proceso.
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Transmisión UVC",
                    NotificationManager.IMPORTANCE_LOW // Low para no hacer ruido/vibrar
            );
            channel.setDescription("Mantiene viva la transmisión de la cámara con la pantalla apagada");
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
