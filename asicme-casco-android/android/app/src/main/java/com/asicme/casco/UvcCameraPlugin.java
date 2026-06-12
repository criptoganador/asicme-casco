package com.asicme.casco;

import android.content.Intent;
import android.graphics.Bitmap;
import android.hardware.usb.UsbDevice;
import android.util.Log;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "UvcCamera")
public class UvcCameraPlugin extends Plugin {

    private UvcNativeDriver nativeDriver;
    private MjpegServer mjpegServer;
    private PluginCall savedCall;

    @Override
    public void load() {
        nativeDriver = new UvcNativeDriver(getContext());
        mjpegServer = new MjpegServer();
        
        nativeDriver.setListener(new UvcNativeDriver.UvcDriverListener() {
            @Override
            public void onPermissionGranted(UsbDevice device) {
                mjpegServer.start();

                // 3. Encender Escudo Protector (Foreground Service)
                Intent serviceIntent = new Intent(getContext(), UvcForegroundService.class);
                ContextCompat.startForegroundService(getContext(), serviceIntent);

                // 4. Avisar a React
                JSObject ret = new JSObject();
                ret.put("streamUrl", "http://127.0.0.1:8080");
                notifyListeners("onUsbCameraConnected", ret);

                if (savedCall != null) {
                    savedCall.resolve(ret);
                    savedCall = null;
                }
            }

            @Override
            public void onPermissionDenied(UsbDevice device) {
                if (savedCall != null) {
                    savedCall.reject("Permiso denegado por el usuario.");
                    savedCall = null;
                }
            }

            @Override
            public void onCameraNotFound() {
                if (savedCall != null) {
                    savedCall.reject("No se encontró ninguna cámara UVC.");
                    savedCall = null;
                }
            }
            @Override
            public void onCameraDisconnected() {
                // Apagar el servidor y el escudo de inmediato
                mjpegServer.stop();
                Intent serviceIntent = new Intent(getContext(), UvcForegroundService.class);
                getContext().stopService(serviceIntent);

                // Avisar a React que el cable fue extraído
                JSObject ret = new JSObject();
                notifyListeners("onUsbCameraDisconnected", ret);
            }
        });

        nativeDriver.setFrameListener(new UvcNativeDriver.OnFrameCapturedListener() {
            @Override
            public void onFrame(Bitmap bitmap) {
                mjpegServer.pushFrame(bitmap);
            }
        });
    }

    @PluginMethod
    public void startCamera(PluginCall call) {
        this.savedCall = call;
        // Iniciar la Fase 1
        nativeDriver.buscarCamaraUVC();
    }

    @Override
    protected void handleOnDestroy() {
        if (nativeDriver != null) nativeDriver.destruir();
        if (mjpegServer != null) mjpegServer.stop();
        
        // Apagar Escudo Protector
        Intent serviceIntent = new Intent(getContext(), UvcForegroundService.class);
        getContext().stopService(serviceIntent);
        
        super.handleOnDestroy();
    }
}
