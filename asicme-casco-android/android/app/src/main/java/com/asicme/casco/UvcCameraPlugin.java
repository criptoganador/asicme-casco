package com.asicme.casco;

import android.graphics.Bitmap;
import android.hardware.usb.UsbDevice;
import android.util.Log;

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
                if (savedCall != null) {
                    JSObject ret = new JSObject();
                    ret.put("streamUrl", "http://127.0.0.1:8080");
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
        super.handleOnDestroy();
    }
}
