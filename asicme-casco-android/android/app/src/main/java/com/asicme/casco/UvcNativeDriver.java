package com.asicme.casco;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Log;

import java.util.HashMap;

/**
 * UvcNativeDriver
 *
 * Fase 1: Detección y Permisos Nativos UVC.
 * Esta clase fundacional se encarga de escanear los buses USB del dispositivo Android,
 * buscar una interfaz que coincida con USB_CLASS_VIDEO (14) y gestionar la petición
 * de permisos al usuario sin depender de librerías de terceros.
 */
public class UvcNativeDriver {

    private static final String TAG = "UvcNativeDriver";
    private static final String ACTION_USB_PERMISSION = "com.asicme.casco.USB_PERMISSION";

    private final Context context;
    private final UsbManager usbManager;
    private UsbDevice targetDevice;
    private BroadcastReceiver permissionReceiver;

    // Interfaz para notificar a la capa superior (React/Capacitor) sobre el estado
    public interface UvcDriverListener {
        void onPermissionGranted(UsbDevice device);
        void onPermissionDenied(UsbDevice device);
        void onCameraNotFound();
    }

    private UvcDriverListener listener;

    /**
     * Constructor que recibe el Contexto de Android e inicializa el UsbManager.
     * @param context Contexto de la aplicación o actividad.
     */
    public UvcNativeDriver(Context context) {
        this.context = context;
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    public void setListener(UvcDriverListener listener) {
        this.listener = listener;
    }

    /**
     * Escanea todos los dispositivos USB conectados buscando uno que declare una interfaz
     * de clase USB_CLASS_VIDEO (14).
     */
    public void buscarCamaraUVC() {
        if (usbManager == null) {
            Log.e(TAG, "UsbManager no está disponible.");
            return;
        }

        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        Log.d(TAG, "Dispositivos USB conectados detectados: " + deviceList.size());

        targetDevice = null;

        for (UsbDevice device : deviceList.values()) {
            // Regla Crítica: No evaluar device.getDeviceClass() en la raíz.
            // Las cámaras UVC a menudo exponen la clase a nivel de interfaz.
            int interfaceCount = device.getInterfaceCount();
            for (int i = 0; i < interfaceCount; i++) {
                UsbInterface usbInterface = device.getInterface(i);
                if (usbInterface.getInterfaceClass() == UsbConstants.USB_CLASS_VIDEO) {
                    Log.d(TAG, "Cámara UVC encontrada: " + device.getDeviceName());
                    targetDevice = device;
                    break;
                }
            }
            if (targetDevice != null) {
                break; // Salir del bucle exterior si ya encontramos la cámara
            }
        }

        if (targetDevice != null) {
            solicitarPermisosNativos(targetDevice);
        } else {
            Log.w(TAG, "No se encontró ninguna cámara UVC conectada.");
            if (listener != null) listener.onCameraNotFound();
        }
    }

    /**
     * Verifica si ya se tienen permisos para el dispositivo. Si no, los solicita.
     * @param device El dispositivo USB (Cámara UVC) detectado.
     */
    private void solicitarPermisosNativos(UsbDevice device) {
        if (usbManager.hasPermission(device)) {
            Log.d(TAG, "Ya se tienen permisos para la cámara UVC.");
            abrirConexionFisica(device);
        } else {
            Log.d(TAG, "Solicitando permisos al usuario para el dispositivo USB.");
            
            // Registrar el receiver para escuchar la respuesta del usuario
            registrarReceiver();

            // Configurar el Intent pendiente. FLAG_MUTABLE requerido en Android 12+
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
            PendingIntent permissionIntent = PendingIntent.getBroadcast(
                    context, 0, new Intent(ACTION_USB_PERMISSION), flags);

            // Lanzar el cuadro de diálogo nativo de Android
            usbManager.requestPermission(device, permissionIntent);
        }
    }

    /**
     * Registra dinámicamente el BroadcastReceiver para interceptar la respuesta de permisos.
     */
    private void registrarReceiver() {
        if (permissionReceiver == null) {
            permissionReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    String action = intent.getAction();
                    if (ACTION_USB_PERMISSION.equals(action)) {
                        synchronized (this) {
                            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);

                            if (granted) {
                                Log.d(TAG, "Permiso USB CONCEDIDO por el usuario.");
                                if (device != null) {
                                    abrirConexionFisica(device);
                                }
                            } else {
                                Log.e(TAG, "Permiso USB DENEGADO por el usuario.");
                                if (listener != null) listener.onPermissionDenied(device);
                            }
                        }
                    }
                }
            };
            
            // Compatibilidad con Android 14+ requiere especificar flags de exportación para receivers
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(permissionReceiver, new IntentFilter(ACTION_USB_PERMISSION), Context.RECEIVER_NOT_EXPORTED);
            } else {
                context.registerReceiver(permissionReceiver, new IntentFilter(ACTION_USB_PERMISSION));
            }
        }
    }

    /**
     * Método para limpiar y prevenir fugas de memoria (Memory Leaks).
     * Se debe llamar cuando la actividad/plugin se destruye.
     */
    public void destruir() {
        if (permissionReceiver != null) {
            try {
                context.unregisterReceiver(permissionReceiver);
            } catch (IllegalArgumentException e) {
                Log.w(TAG, "El receiver ya estaba desregistrado.");
            }
            permissionReceiver = null;
        }
    }

    /**
     * Fase 2: Punto de entrada para abrir la comunicación con la cámara.
     * @param device El dispositivo USB autorizado.
     */
    private void abrirConexionFisica(UsbDevice device) {
        Log.i(TAG, ">>> Preparado para abrir conexión física con: " + device.getDeviceName());
        
        if (listener != null) {
            listener.onPermissionGranted(device);
        }
        
        // TODO: Fase 2 - Implementar UsbDeviceConnection, endpoints y transferencias Bulk/Isócronas.
    }
}
