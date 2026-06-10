package com.asicme.casco;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.app.PendingIntent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "UsbBridge")
public class UsbBridgePlugin extends Plugin {

    private BroadcastReceiver usbReceiver;
    private MjpegServer mjpegServer;
    private static final String ACTION_USB_PERMISSION = "com.asicme.casco.USB_PERMISSION";

    @Override
    public void load() {
        super.load();
        
        // Configurar el receptor de eventos del sistema operativo
        usbReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                
                if (device != null) {
                    JSObject ret = new JSObject();
                    // Enviamos datos del hardware para identificarlo en React
                    ret.put("vendorId", device.getVendorId());
                    ret.put("productId", device.getProductId());
                    ret.put("deviceName", device.getDeviceName());

                    if (UsbManager.ACTION_USB_DEVICE_ATTACHED.equals(action)) {
                        ret.put("status", "connected");
                        notifyListeners("onUsbStateChange", ret);
                    } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
                        ret.put("status", "disconnected");
                        notifyListeners("onUsbStateChange", ret);
                    }
                }
            }
        };

        // Registrar las acciones de conexión y desconexión física
        IntentFilter filter = new IntentFilter();
        filter.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        getContext().registerReceiver(usbReceiver, filter);
    }

    // Método para limpiar el receiver si la app se destruye
    @Override
    protected void handleOnDestroy() {
        if (usbReceiver != null) {
            getContext().unregisterReceiver(usbReceiver);
        }
        super.handleOnDestroy();
    }

    // Método simple por si React quiere consultar el estado actual al iniciar
    @PluginMethod
    public void checkDevice(PluginCall call) {
        UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        JSObject ret = new JSObject();
        
        if (manager != null && !manager.getDeviceList().isEmpty()) {
            ret.put("hasDevices", true);
        } else {
            ret.put("hasDevices", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestCameraPermission(PluginCall call) {
        UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        if (manager == null || manager.getDeviceList().isEmpty()) {
            call.reject("No USB devices attached");
            return;
        }

        // Tomar el primer dispositivo USB disponible (asumiendo que es la cámara)
        UsbDevice device = manager.getDeviceList().values().iterator().next();

        if (manager.hasPermission(device)) {
            call.resolve();
            return;
        }

        // Crear PendingIntent para solicitar permisos nativos
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        PendingIntent permissionIntent = PendingIntent.getBroadcast(getContext(), 0, new Intent(ACTION_USB_PERMISSION), flags);
        
        // Android lanzará el diálogo "¿Permitir acceso a [App]?"
        manager.requestPermission(device, permissionIntent);
        call.resolve();
    }

    @PluginMethod
    public void startStream(PluginCall call) {
        // Inicializar Servidor MJPEG Local en el puerto 8080 si no está activo
        if (mjpegServer == null) {
            try {
                mjpegServer = new MjpegServer(8080);
                mjpegServer.start();
            } catch (Exception e) {
                call.reject("Error iniciando servidor Mjpeg", e);
                return;
            }
        }

        // AQUI VA LA INICIALIZACIÓN NATIVA DE UVCCAMERA
        // Como AndroidUSBCamera se ejecuta asíncronamente, 
        // configuraremos el Frame Callback para alimentar a mjpegServer.updateFrame(bytes)
        
        // TODO: Inicializar IFrameCallback de AndroidUSBCamera 
        // y enviar los frames usando mjpegServer.updateFrame(jpegBytes);
        
        JSObject ret = new JSObject();
        ret.put("url", "http://127.0.0.1:8080/stream");
        call.resolve(ret);
    }
}
