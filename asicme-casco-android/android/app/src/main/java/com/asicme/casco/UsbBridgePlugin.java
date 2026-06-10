package com.asicme.casco;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "UsbBridge")
public class UsbBridgePlugin extends Plugin {

    private BroadcastReceiver usbReceiver;

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
}
