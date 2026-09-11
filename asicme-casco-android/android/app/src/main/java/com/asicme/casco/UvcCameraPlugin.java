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

                // 4. Construir payload con información del dispositivo detectado
                JSObject ret = new JSObject();
                ret.put("streamUrl", "http://127.0.0.1:8080");

                UvcNativeDriver.DeviceInfo info = nativeDriver.getDeviceInfo();
                if (info != null) {
                    ret.put("deviceType",            info.type);
                    ret.put("deviceBrand",           info.brand);
                    ret.put("deviceProduct",         info.productName);
                    ret.put("manufacturer",          info.manufacturer);
                    ret.put("vidPid",                info.vidPid);
                    ret.put("codec",                 info.codec);
                    ret.put("transferType",          info.transferType);
                    ret.put("supportedResolutions",  info.supportedResolutions != null ? info.supportedResolutions : "");
                }

                // 5. Avisar a React
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
            @Override
            public void onDeviceInfoUpdated(UvcNativeDriver.DeviceInfo info) {
                if (info != null) {
                    JSObject ret = new JSObject();
                    ret.put("deviceType",            info.type);
                    ret.put("deviceBrand",           info.brand);
                    ret.put("deviceProduct",         info.productName);
                    ret.put("manufacturer",          info.manufacturer);
                    ret.put("vidPid",                info.vidPid);
                    ret.put("codec",                 info.codec);
                    ret.put("transferType",          info.transferType);
                    ret.put("supportedResolutions",  info.supportedResolutions != null ? info.supportedResolutions : "");
                    notifyListeners("onUsbCameraInfoUpdated", ret);
                }
            }
            @Override
            public void onSensorStatusChanged(String status, int fps, int framesCount, String message) {
                JSObject ret = new JSObject();
                ret.put("status", status);
                ret.put("fps", fps);
                ret.put("frames", framesCount);
                ret.put("message", message);
                notifyListeners("onUsbSensorStatus", ret);
            }
        });

        nativeDriver.setRawFrameListener(new UvcNativeDriver.OnRawFrameCapturedListener() {
            @Override
            public void onRawFrame(byte[] jpegBytes) {
                mjpegServer.pushRawFrame(jpegBytes);
            }
        });
    }

    @PluginMethod
    public void startCamera(PluginCall call) {
        this.savedCall = call;
        // Iniciar la Fase 1
        nativeDriver.buscarCamaraUVC();
    }

    @PluginMethod
    public void forzarEncendido(PluginCall call) {
        if (nativeDriver != null) {
            nativeDriver.forzarEncendidoSensor();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Driver nativo no disponible.");
        }
    }

    @PluginMethod
    public void getControls(PluginCall call) {
        if (nativeDriver != null) {
            JSObject ret = new JSObject();
            ret.put("brightness", nativeDriver.getBrightness());
            ret.put("contrast", nativeDriver.getContrast());
            ret.put("saturation", nativeDriver.getSaturation());
            ret.put("sharpness", nativeDriver.getSharpness());
            ret.put("gain", nativeDriver.getGain());
            ret.put("autoWhiteBalance", nativeDriver.getAutoWhiteBalance());

            UvcNativeDriver.DeviceInfo info = nativeDriver.getDeviceInfo();
            if (info != null) {
                ret.put("supportedResolutions", info.supportedResolutions != null ? info.supportedResolutions : "");
                ret.put("codec", info.codec != null ? info.codec : "");
            }
            call.resolve(ret);
        } else {
            call.reject("Driver UVC no disponible.");
        }
    }

    @PluginMethod
    public void setBrightness(PluginCall call) {
        if (nativeDriver != null && call.hasOption("value")) {
            int val = call.getInt("value", 50);
            nativeDriver.setBrightness(val);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("value", val);
            call.resolve(ret);
        } else {
            call.reject("Parámetro 'value' requerido.");
        }
    }

    @PluginMethod
    public void setContrast(PluginCall call) {
        if (nativeDriver != null && call.hasOption("value")) {
            int val = call.getInt("value", 50);
            nativeDriver.setContrast(val);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("value", val);
            call.resolve(ret);
        } else {
            call.reject("Parámetro 'value' requerido.");
        }
    }

    @PluginMethod
    public void setSaturation(PluginCall call) {
        if (nativeDriver != null && call.hasOption("value")) {
            int val = call.getInt("value", 50);
            nativeDriver.setSaturation(val);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("value", val);
            call.resolve(ret);
        } else {
            call.reject("Parámetro 'value' requerido.");
        }
    }

    @PluginMethod
    public void setSharpness(PluginCall call) {
        if (nativeDriver != null && call.hasOption("value")) {
            int val = call.getInt("value", 50);
            nativeDriver.setSharpness(val);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("value", val);
            call.resolve(ret);
        } else {
            call.reject("Parámetro 'value' requerido.");
        }
    }

    @PluginMethod
    public void setGain(PluginCall call) {
        if (nativeDriver != null && call.hasOption("value")) {
            int val = call.getInt("value", 50);
            nativeDriver.setGain(val);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("value", val);
            call.resolve(ret);
        } else {
            call.reject("Parámetro 'value' requerido.");
        }
    }

    @PluginMethod
    public void setAutoWhiteBalance(PluginCall call) {
        if (nativeDriver != null && call.hasOption("enabled")) {
            boolean enabled = call.getBoolean("enabled", true);
            nativeDriver.setAutoWhiteBalance(enabled);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("enabled", enabled);
            call.resolve(ret);
        } else {
            call.reject("Parámetro 'enabled' requerido.");
        }
    }

    @PluginMethod
    public void resetControls(PluginCall call) {
        if (nativeDriver != null) {
            nativeDriver.resetAllControls();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Driver UVC no disponible.");
        }
    }

    @PluginMethod
    public void setResolution(PluginCall call) {
        if (nativeDriver != null && call.hasOption("width") && call.hasOption("height")) {
            int width = call.getInt("width", 640);
            int height = call.getInt("height", 480);
            nativeDriver.setResolution(width, height);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("width", width);
            ret.put("height", height);
            call.resolve(ret);
        } else {
            call.reject("Parámetros 'width' y 'height' requeridos.");
        }
    }

    @PluginMethod
    public void stopCamera(PluginCall call) {
        if (nativeDriver != null) {
            nativeDriver.cerrarCamara();
        }
        if (mjpegServer != null) {
            mjpegServer.stop();
        }
        try {
            Intent serviceIntent = new Intent(getContext(), UvcForegroundService.class);
            getContext().stopService(serviceIntent);
        } catch (Exception ignored) {}

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (nativeDriver != null) nativeDriver.destruir();
        if (mjpegServer != null) mjpegServer.stop();
        
        // Apagar Escudo Protector
        try {
            Intent serviceIntent = new Intent(getContext(), UvcForegroundService.class);
            getContext().stopService(serviceIntent);
        } catch (Exception ignored) {}
        
        super.handleOnDestroy();
    }
}
