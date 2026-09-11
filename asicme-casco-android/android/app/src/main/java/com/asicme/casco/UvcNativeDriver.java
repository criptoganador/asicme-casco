package com.asicme.casco;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.graphics.SurfaceTexture;
import android.graphics.YuvImage;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbInterface;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Surface;

import com.serenegiant.usb.IFrameCallback;
import com.serenegiant.usb.Size;
import com.serenegiant.usb.USBMonitor;
import com.serenegiant.usb.UVCCamera;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * UvcNativeDriver
 *
 * Driver UVC nativo de alto rendimiento basado en libusb y libuvc (NDK C/C++).
 * Utiliza exactamente la misma arquitectura y librerías que las aplicaciones
 * comerciales de "USB Camera" en Google Play, soportando streaming continuo
 * mediante endpoints Isochronous (ISOC) y Bulk sin las limitaciones de la API Java de Android.
 */
public class UvcNativeDriver {

    private static final String TAG = "UvcNativeDriver";

    private final Context context;
    private USBMonitor mUsbMonitor;
    private UVCCamera mUvcCamera;
    private USBMonitor.UsbControlBlock mCurrentCtrlBlock;

    private int previewWidth = 640;
    private int previewHeight = 480;
    private boolean useMjpegMode = false;
    private SurfaceTexture mDummySurfaceTexture = null;
    private Surface mDummySurface = null;
    private UsbDevice mCurrentDevice = null;

    // ─── DeviceInfo ──────────────────────────────────────────────────────────────
    public static class DeviceInfo {
        public final String deviceName;   // Nombre del sistema (ej. /dev/bus/usb/001/002)
        public final String productName;  // Nombre reportado por hardware
        public final String manufacturer; // Fabricante
        public final String type;         // Tipo: "Webcam UVC", etc.
        public final String brand;        // Marca
        public final String vidPid;       // VID:PID
        public String codec;              // Formato negociado
        public final String transferType; // "ISOC (Nativo libusb)" o "BULK"
        public String supportedResolutions; // Resoluciones soportadas por hardware

        public DeviceInfo(String deviceName, String productName, String manufacturer,
                          String type, String brand, String vidPid,
                          String codec, String transferType, String supportedResolutions) {
            this.deviceName   = deviceName;
            this.productName  = productName;
            this.manufacturer = manufacturer;
            this.type         = type;
            this.brand        = brand;
            this.vidPid       = vidPid;
            this.codec        = codec;
            this.transferType = transferType;
            this.supportedResolutions = supportedResolutions != null ? supportedResolutions : "";
        }

        public DeviceInfo(String deviceName, String productName, String manufacturer,
                          String type, String brand, String vidPid,
                          String codec, String transferType) {
            this(deviceName, productName, manufacturer, type, brand, vidPid, codec, transferType, "");
        }
    }

    private DeviceInfo currentDeviceInfo = null;

    public DeviceInfo getDeviceInfo() {
        return currentDeviceInfo;
    }

    // ─── Listeners ───────────────────────────────────────────────────────────────
    public interface UvcDriverListener {
        void onPermissionGranted(UsbDevice device);
        void onPermissionDenied(UsbDevice device);
        void onCameraNotFound();
        void onCameraDisconnected();
        default void onDeviceInfoUpdated(DeviceInfo info) {}
        default void onSensorStatusChanged(String status, int fps, int framesCount, String message) {}
    }

    public interface OnFrameCapturedListener {
        void onFrame(Bitmap bitmap);
    }

    public interface OnRawFrameCapturedListener {
        void onRawFrame(byte[] jpegBytes);
    }

    private UvcDriverListener listener;
    private OnFrameCapturedListener frameListener;
    private OnRawFrameCapturedListener rawFrameListener;

    // ─── Watchdog de Sensor ──────────────────────────────────────────────────────
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final AtomicInteger frameCounter = new AtomicInteger(0);
    private final AtomicInteger totalFramesReceived = new AtomicInteger(0);
    private final AtomicBoolean isPreviewing = new AtomicBoolean(false);
    private Runnable watchdogRunnable;

    public UvcNativeDriver(Context context) {
        this.context = context;
        inicializarUsbMonitor();
    }

    public void setListener(UvcDriverListener listener) {
        this.listener = listener;
    }

    public void setFrameListener(OnFrameCapturedListener listener) {
        this.frameListener = listener;
    }

    public void setRawFrameListener(OnRawFrameCapturedListener listener) {
        this.rawFrameListener = listener;
    }

    private void inicializarUsbMonitor() {
        mUsbMonitor = new USBMonitor(context, new USBMonitor.OnDeviceConnectListener() {
            @Override
            public void onAttach(UsbDevice device) {
                Log.i(TAG, "Dispositivo USB insertado: " + device.getDeviceName());
                if (isUvcDevice(device)) {
                    actualizarDeviceInfo(device);
                    mUsbMonitor.requestPermission(device);
                }
            }

            @Override
            public void onDettach(UsbDevice device) {
                Log.i(TAG, "Dispositivo USB desconectado: " + device.getDeviceName());
                cerrarCamara();
                if (listener != null) {
                    listener.onCameraDisconnected();
                }
            }

            @Override
            public void onConnect(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock, boolean createNew) {
                Log.i(TAG, "Permiso USB concedido por el usuario. Abriendo hardware con libuvc / libusb...");
                mCurrentCtrlBlock = ctrlBlock;
                mCurrentDevice = device;
                actualizarDeviceInfo(device);
                iniciarCamaraNativa(ctrlBlock, device);
            }

            @Override
            public void onDisconnect(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock) {
                Log.i(TAG, "Cámara UVC desconectada");
                cerrarCamara();
                if (listener != null) {
                    listener.onCameraDisconnected();
                }
            }

            @Override
            public void onCancel(UsbDevice device) {
                Log.w(TAG, "Permiso USB denegado o cancelado por el usuario");
                if (listener != null) {
                    listener.onPermissionDenied(device);
                }
            }
        });

        try {
            mUsbMonitor.register();
            Log.i(TAG, "USBMonitor registrado exitosamente");
        } catch (Exception e) {
            Log.e(TAG, "Error registrando USBMonitor: " + e.getMessage(), e);
        }
    }

    public void buscarCamaraUVC() {
        if (mUsbMonitor == null) {
            inicializarUsbMonitor();
        }

        if (!mUsbMonitor.isRegistered()) {
            try {
                mUsbMonitor.register();
            } catch (Exception ignored) {}
        }

        List<UsbDevice> deviceList = mUsbMonitor.getDeviceList();
        UsbDevice targetDevice = null;
        if (deviceList != null) {
            for (UsbDevice dev : deviceList) {
                if (isUvcDevice(dev)) {
                    targetDevice = dev;
                    break;
                }
            }
        }

        if (targetDevice != null) {
            Log.i(TAG, "Cámara UVC encontrada: " + targetDevice.getDeviceName() + " (" + targetDevice.getProductName() + ")");
            actualizarDeviceInfo(targetDevice);

            if (!mUsbMonitor.hasPermission(targetDevice)) {
                Log.i(TAG, "Pidiendo permiso USB para: " + targetDevice.getDeviceName());
                mUsbMonitor.requestPermission(targetDevice);
            } else {
                Log.i(TAG, "Permiso ya otorgado previamente. Conectando directamente...");
                try {
                    USBMonitor.UsbControlBlock ctrlBlock = mUsbMonitor.openDevice(targetDevice);
                    if (ctrlBlock != null) {
                        mCurrentCtrlBlock = ctrlBlock;
                        mCurrentDevice = targetDevice;
                        iniciarCamaraNativa(ctrlBlock, targetDevice);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "openDevice falló, solicitando permiso de nuevo: " + e.getMessage());
                    mUsbMonitor.requestPermission(targetDevice);
                }
            }
        } else {
            Log.w(TAG, "No se encontró ningún dispositivo UVC compatible conectado.");
            if (listener != null) {
                listener.onCameraNotFound();
            }
        }
    }

    private synchronized void iniciarCamaraNativa(USBMonitor.UsbControlBlock ctrlBlock, UsbDevice device) {
        mCurrentDevice = device;
        mCurrentCtrlBlock = ctrlBlock;
        new Thread(() -> {
            try {
                cerrarCamara();

                mUvcCamera = new UVCCamera();
                Log.i(TAG, "Invocando mUvcCamera.open(ctrlBlock) - Traspasando file descriptor a libusb C...");
                mUvcCamera.open(ctrlBlock);

                // Conectar SurfaceTexture fuera de pantalla (ANativeWindow) para asegurar que el pipeline nativo de libuvc fluya
                try {
                    if (mDummySurfaceTexture == null) {
                        mDummySurfaceTexture = new SurfaceTexture(10);
                        mDummySurface = new Surface(mDummySurfaceTexture);
                    }
                    mUvcCamera.setPreviewDisplay(mDummySurface);
                } catch (Exception es) {
                    Log.w(TAG, "Dummy preview surface: " + es.getMessage());
                }

                // 0. Consultar resoluciones soportadas por hardware en BisonCam / cámara UVC
                try {
                    List<Size> sizes = mUvcCamera.getSupportedSizeList();
                    if (sizes != null && !sizes.isEmpty()) {
                        StringBuilder sb = new StringBuilder();
                        for (Size s : sizes) {
                            String res = s.width + "x" + s.height;
                            if (sb.indexOf(res) == -1) {
                                if (sb.length() > 0) sb.append(", ");
                                sb.append(res);
                            }
                        }
                        if (currentDeviceInfo != null) {
                            currentDeviceInfo.supportedResolutions = sb.toString();
                        }
                        Log.i(TAG, "Resoluciones UVC reportadas por hardware: " + sb.toString());
                    }
                } catch (Exception e) {
                    Log.w(TAG, "No se pudo leer supportedSizeList: " + e.getMessage());
                }

                // Configurar resolución y formato
                boolean sizeSet = false;

                // 1. Si se activó modo MJPEG (por ejemplo tras pulsar forzar encendido), probar MJPEG primero
                if (useMjpegMode) {
                    try {
                        mUvcCamera.setPreviewSize(previewWidth, previewHeight, UVCCamera.FRAME_FORMAT_MJPEG);
                        sizeSet = true;
                        if (currentDeviceInfo != null) currentDeviceInfo.codec = "MJPEG (" + previewWidth + "x" + previewHeight + ")";
                        Log.i(TAG, "PreviewSize establecido en modo forzado MJPEG: " + previewWidth + "x" + previewHeight);
                    } catch (Exception em) {
                        Log.w(TAG, "FRAME_FORMAT_MJPEG falló: " + em.getMessage());
                    }
                }

                // 2. Modo por defecto de UVCCamera (DEFAULT_PREVIEW_MODE / YUYV)
                if (!sizeSet) {
                    try {
                        mUvcCamera.setPreviewSize(previewWidth, previewHeight, UVCCamera.DEFAULT_PREVIEW_MODE);
                        sizeSet = true;
                        if (currentDeviceInfo != null) currentDeviceInfo.codec = "DEFAULT (" + previewWidth + "x" + previewHeight + ")";
                        Log.i(TAG, "PreviewSize establecido con DEFAULT_PREVIEW_MODE: " + previewWidth + "x" + previewHeight);
                    } catch (Exception e0) {
                        Log.w(TAG, "DEFAULT_PREVIEW_MODE falló: " + e0.getMessage());
                    }
                }

                // 3. Si falla el modo por defecto, intentar MJPEG directo
                if (!sizeSet) {
                    try {
                        mUvcCamera.setPreviewSize(previewWidth, previewHeight, UVCCamera.FRAME_FORMAT_MJPEG);
                        sizeSet = true;
                        if (currentDeviceInfo != null) currentDeviceInfo.codec = "MJPEG (" + previewWidth + "x" + previewHeight + ")";
                        Log.i(TAG, "PreviewSize establecido: " + previewWidth + "x" + previewHeight + " MJPEG");
                    } catch (Exception e1) {
                        Log.w(TAG, "Fallo MJPEG: " + e1.getMessage());
                    }
                }

                // 4. Si falla MJPEG, intentar YUYV
                if (!sizeSet) {
                    try {
                        mUvcCamera.setPreviewSize(previewWidth, previewHeight, UVCCamera.FRAME_FORMAT_YUYV);
                        sizeSet = true;
                        if (currentDeviceInfo != null) currentDeviceInfo.codec = "YUYV (" + previewWidth + "x" + previewHeight + ")";
                        Log.i(TAG, "PreviewSize establecido: " + previewWidth + "x" + previewHeight + " YUYV");
                    } catch (Exception e2) {
                        Log.w(TAG, "Fallo YUYV: " + e2.getMessage());
                    }
                }

                // 5. Fallback a la primera resolución soportada reportada por hardware
                if (!sizeSet) {
                    try {
                        List<Size> sizes = mUvcCamera.getSupportedSizeList();
                        if (sizes != null && !sizes.isEmpty()) {
                            Size s = sizes.get(0);
                            previewWidth = s.width;
                            previewHeight = s.height;
                            int format = (s.type == 6 || s.frame_type == 6) ? UVCCamera.FRAME_FORMAT_MJPEG : UVCCamera.FRAME_FORMAT_YUYV;
                            mUvcCamera.setPreviewSize(previewWidth, previewHeight, format);
                            sizeSet = true;
                            if (currentDeviceInfo != null) {
                                currentDeviceInfo.codec = (format == UVCCamera.FRAME_FORMAT_MJPEG ? "MJPEG" : "YUYV") + " (" + previewWidth + "x" + previewHeight + ")";
                            }
                            Log.i(TAG, "PreviewSize adaptado desde lista de hardware: " + previewWidth + "x" + previewHeight);
                        }
                    } catch (Exception e3) {
                        Log.w(TAG, "Error consultando supported sizes: " + e3.getMessage());
                    }
                }

                Size actualPreviewSize = null;
                try {
                    actualPreviewSize = mUvcCamera.getPreviewSize();
                } catch (Exception ignored) {}
                final int finalW = (actualPreviewSize != null && actualPreviewSize.width > 0) ? actualPreviewSize.width : previewWidth;
                final int finalH = (actualPreviewSize != null && actualPreviewSize.height > 0) ? actualPreviewSize.height : previewHeight;

                // Establecer callback de fotogramas usando formato NV21
                mUvcCamera.setFrameCallback(new IFrameCallback() {
                    private final ByteArrayOutputStream baos = new ByteArrayOutputStream(65536);
                    private byte[] buffer = null;

                    @Override
                    public void onFrame(ByteBuffer frame) {
                        if (frame == null) return;
                        frame.position(0);
                        int size = frame.remaining();
                        if (size <= 0) size = frame.capacity();
                        if (size <= 0) return;

                        try {
                            if (buffer == null || buffer.length != size) {
                                buffer = new byte[size];
                            }
                            frame.position(0);
                            frame.get(buffer, 0, size);

                            // 1. Detección directa de JPEG crudo (magic bytes 0xFF 0xD8)
                            if (size > 4 && (buffer[0] & 0xFF) == 0xFF && (buffer[1] & 0xFF) == 0xD8) {
                                byte[] jpegData = new byte[size];
                                System.arraycopy(buffer, 0, jpegData, 0, size);
                                if (rawFrameListener != null) {
                                    rawFrameListener.onRawFrame(jpegData);
                                }
                                frameCounter.incrementAndGet();
                                totalFramesReceived.incrementAndGet();
                                return;
                            }

                            // 2. Determinar si es NV21 (12 bits/pixel) o YUYV/YUY2 (16 bits/pixel)
                            int yuy2Expected = finalW * finalH * 2;
                            int imageFormat;
                            if (size >= yuy2Expected) {
                                imageFormat = ImageFormat.YUY2;
                            } else {
                                imageFormat = ImageFormat.NV21;
                            }

                            baos.reset();
                            YuvImage yuvImage = new YuvImage(buffer, imageFormat, finalW, finalH, null);
                            yuvImage.compressToJpeg(new Rect(0, 0, finalW, finalH), 75, baos);
                            byte[] jpegData = baos.toByteArray();

                            if (rawFrameListener != null && jpegData.length > 0) {
                                rawFrameListener.onRawFrame(jpegData);
                            }

                            frameCounter.incrementAndGet();
                            totalFramesReceived.incrementAndGet();
                        } catch (Exception e) {
                            Log.w(TAG, "Error procesando fotograma UVC (" + size + " bytes): " + e.getMessage());
                        }
                    }
                }, UVCCamera.PIXEL_FORMAT_NV21);

                // Iniciar captura de video
                mUvcCamera.startPreview();
                isPreviewing.set(true);
                Log.i(TAG, ">>> PREVIEW UVC INICIADO EXITOSAMENTE con libuvc / libusb (" + finalW + "x" + finalH + ")!");

                iniciarWatchdogSensor();

                if (listener != null) {
                    mainHandler.post(() -> {
                        listener.onPermissionGranted(device);
                        if (currentDeviceInfo != null) {
                            listener.onDeviceInfoUpdated(currentDeviceInfo);
                        }
                    });
                }
            } catch (Exception e) {
                Log.e(TAG, "Error fatal abriendo cámara UVC nativa: " + e.getMessage(), e);
            }
        }, "UvcNative-StartThread").start();
    }

    public void forzarEncendidoSensor() {
        Log.i(TAG, "Forzando reactivación y despertar de sensor UVC (alternando modo MJPEG/YUYV)...");
        if (listener != null) {
            mainHandler.post(() -> listener.onSensorStatusChanged("ENCENDIENDO", 0, 0, "Reactivando sensor de cámara..."));
        }
        useMjpegMode = !useMjpegMode;
        if (mCurrentDevice != null && mUsbMonitor != null) {
            try {
                USBMonitor.UsbControlBlock ctrlBlock = mUsbMonitor.openDevice(mCurrentDevice);
                if (ctrlBlock != null) {
                    mCurrentCtrlBlock = ctrlBlock;
                    iniciarCamaraNativa(ctrlBlock, mCurrentDevice);
                } else if (mCurrentCtrlBlock != null) {
                    iniciarCamaraNativa(mCurrentCtrlBlock, mCurrentDevice);
                } else {
                    buscarCamaraUVC();
                }
            } catch (Exception e) {
                Log.w(TAG, "Error forzando encendido: " + e.getMessage());
                buscarCamaraUVC();
            }
        } else {
            buscarCamaraUVC();
        }
    }

    // ─── Controles de Hardware UVC (BisonCam / saki4510t) ────────────────────────
    public synchronized void setBrightness(int value) {
        if (mUvcCamera != null) {
            try {
                mUvcCamera.setBrightness(value);
                Log.i(TAG, "Brillo UVC establecido a: " + value);
            } catch (Exception e) {
                Log.w(TAG, "Error estableciendo brillo: " + e.getMessage());
            }
        }
    }

    public synchronized int getBrightness() {
        if (mUvcCamera != null) {
            try {
                return mUvcCamera.getBrightness();
            } catch (Exception e) {
                Log.w(TAG, "Error obteniendo brillo: " + e.getMessage());
            }
        }
        return -1;
    }

    public synchronized void resetBrightness() {
        if (mUvcCamera != null) {
            try { mUvcCamera.resetBrightness(); } catch (Exception ignored) {}
        }
    }

    public synchronized void setContrast(int value) {
        if (mUvcCamera != null) {
            try {
                mUvcCamera.setContrast(value);
                Log.i(TAG, "Contraste UVC establecido a: " + value);
            } catch (Exception e) {
                Log.w(TAG, "Error estableciendo contraste: " + e.getMessage());
            }
        }
    }

    public synchronized int getContrast() {
        if (mUvcCamera != null) {
            try {
                return mUvcCamera.getContrast();
            } catch (Exception e) {
                Log.w(TAG, "Error obteniendo contraste: " + e.getMessage());
            }
        }
        return -1;
    }

    public synchronized void resetContrast() {
        if (mUvcCamera != null) {
            try { mUvcCamera.resetContrast(); } catch (Exception ignored) {}
        }
    }

    public synchronized void setSaturation(int value) {
        if (mUvcCamera != null) {
            try {
                mUvcCamera.setSaturation(value);
                Log.i(TAG, "Saturación UVC establecida a: " + value);
            } catch (Exception e) {
                Log.w(TAG, "Error estableciendo saturación: " + e.getMessage());
            }
        }
    }

    public synchronized int getSaturation() {
        if (mUvcCamera != null) {
            try {
                return mUvcCamera.getSaturation();
            } catch (Exception e) {
                Log.w(TAG, "Error obteniendo saturación: " + e.getMessage());
            }
        }
        return -1;
    }

    public synchronized void setSharpness(int value) {
        if (mUvcCamera != null) {
            try {
                mUvcCamera.setSharpness(value);
                Log.i(TAG, "Nitidez UVC establecida a: " + value);
            } catch (Exception e) {
                Log.w(TAG, "Error estableciendo nitidez: " + e.getMessage());
            }
        }
    }

    public synchronized int getSharpness() {
        if (mUvcCamera != null) {
            try {
                return mUvcCamera.getSharpness();
            } catch (Exception e) {
                Log.w(TAG, "Error obteniendo nitidez: " + e.getMessage());
            }
        }
        return -1;
    }

    public synchronized void setGain(int value) {
        if (mUvcCamera != null) {
            try {
                mUvcCamera.setGain(value);
                Log.i(TAG, "Ganancia UVC establecida a: " + value);
            } catch (Exception e) {
                Log.w(TAG, "Error estableciendo ganancia: " + e.getMessage());
            }
        }
    }

    public synchronized int getGain() {
        if (mUvcCamera != null) {
            try {
                return mUvcCamera.getGain();
            } catch (Exception e) {
                Log.w(TAG, "Error obteniendo ganancia: " + e.getMessage());
            }
        }
        return -1;
    }

    public synchronized void setAutoWhiteBalance(boolean enabled) {
        if (mUvcCamera != null) {
            try {
                mUvcCamera.setAutoWhiteBlance(enabled);
                Log.i(TAG, "AWB UVC establecido a: " + enabled);
            } catch (Exception e) {
                Log.w(TAG, "Error estableciendo AWB: " + e.getMessage());
            }
        }
    }

    public synchronized boolean getAutoWhiteBalance() {
        if (mUvcCamera != null) {
            try {
                return mUvcCamera.getAutoWhiteBlance();
            } catch (Exception e) {
                Log.w(TAG, "Error obteniendo AWB: " + e.getMessage());
            }
        }
        return true;
    }

    public synchronized void resetAllControls() {
        if (mUvcCamera != null) {
            try { mUvcCamera.resetBrightness(); } catch (Exception ignored) {}
            try { mUvcCamera.resetContrast(); } catch (Exception ignored) {}
            try { mUvcCamera.resetSaturation(); } catch (Exception ignored) {}
            try { mUvcCamera.resetSharpness(); } catch (Exception ignored) {}
            try { mUvcCamera.resetGain(); } catch (Exception ignored) {}
            try { mUvcCamera.resetWhiteBlance(); } catch (Exception ignored) {}
            try { mUvcCamera.updateCameraParams(); } catch (Exception ignored) {}
            Log.i(TAG, "Todos los controles UVC restablecidos a valores de fábrica.");
        }
    }

    public synchronized void setResolution(int width, int height) {
        Log.i(TAG, "Solicitud de cambio de resolución UVC: " + width + "x" + height);
        this.previewWidth = width;
        this.previewHeight = height;
        if (mCurrentCtrlBlock != null && mCurrentDevice != null) {
            iniciarCamaraNativa(mCurrentCtrlBlock, mCurrentDevice);
        }
    }

    private void iniciarWatchdogSensor() {
        detenerWatchdogSensor();
        watchdogRunnable = new Runnable() {
            private int ciclosSinFrames = 0;

            @Override
            public void run() {
                if (!isPreviewing.get()) return;

                int framesInInterval = frameCounter.getAndSet(0);
                int fps = Math.round(framesInInterval / 2.0f);
                int total = totalFramesReceived.get();

                if (framesInInterval == 0) {
                    ciclosSinFrames++;
                    // Auto-recuperación en caso de que el sensor se haya dormido
                    if (ciclosSinFrames == 2 && mUvcCamera != null) {
                        try {
                            Log.w(TAG, "Watchdog detectó sensor inactivo (BisonCam). Intentando auto-wake...");
                            mUvcCamera.updateCameraParams();
                        } catch (Exception ignored) {}
                    }
                    if (ciclosSinFrames >= 2) {
                        // 4 segundos seguidos sin recibir fotogramas
                        if (listener != null) {
                            listener.onSensorStatusChanged("SIN_RESPUESTA", 0, total,
                                    "Cámara USB conectada, pero el sensor no está emitiendo video.");
                        }
                    } else {
                        if (listener != null) {
                            listener.onSensorStatusChanged("ENCENDIENDO", 0, total,
                                    "Esperando transmisión del sensor...");
                        }
                    }
                } else {
                    ciclosSinFrames = 0;
                    if (listener != null) {
                        listener.onSensorStatusChanged("ACTIVO", fps, total,
                                "Sensor transmitiendo en vivo a " + fps + " FPS.");
                    }
                }

                mainHandler.postDelayed(this, 2000);
            }
        };
        mainHandler.postDelayed(watchdogRunnable, 2000);
    }

    private void detenerWatchdogSensor() {
        if (watchdogRunnable != null) {
            mainHandler.removeCallbacks(watchdogRunnable);
            watchdogRunnable = null;
        }
    }

    public synchronized void cerrarCamara() {
        isPreviewing.set(false);
        detenerWatchdogSensor();

        if (mUvcCamera != null) {
            try {
                mUvcCamera.stopPreview();
            } catch (Exception ignored) {}
            try {
                mUvcCamera.close();
            } catch (Exception ignored) {}
            try {
                mUvcCamera.destroy();
            } catch (Exception ignored) {}
            mUvcCamera = null;
        }
    }

    public synchronized void destruir() {
        cerrarCamara();
        if (mDummySurface != null) {
            try { mDummySurface.release(); } catch (Exception ignored) {}
            mDummySurface = null;
        }
        if (mDummySurfaceTexture != null) {
            try { mDummySurfaceTexture.release(); } catch (Exception ignored) {}
            mDummySurfaceTexture = null;
        }
        if (mCurrentCtrlBlock != null) {
            try {
                mCurrentCtrlBlock.close();
            } catch (Exception ignored) {}
            mCurrentCtrlBlock = null;
        }
        if (mUsbMonitor != null) {
            try {
                mUsbMonitor.unregister();
            } catch (Exception ignored) {}
            try {
                mUsbMonitor.destroy();
            } catch (Exception ignored) {}
            mUsbMonitor = null;
        }
    }

    private void actualizarDeviceInfo(UsbDevice device) {
        if (device == null) return;

        String productName  = device.getProductName() != null ? device.getProductName() : "Cámara USB";
        String manufacturer = device.getManufacturerName() != null ? device.getManufacturerName() : "Genérico";
        String vidPid = String.format("%04X:%04X", device.getVendorId(), device.getProductId());

        String brand = "Genérico";
        String lowerProd = (productName + " " + manufacturer).toLowerCase();
        if (lowerProd.contains("bison")) brand = "Bison";
        else if (lowerProd.contains("logitech")) brand = "Logitech";
        else if (lowerProd.contains("elgato")) brand = "Elgato";
        else if (lowerProd.contains("microsoft")) brand = "Microsoft";

        currentDeviceInfo = new DeviceInfo(
                device.getDeviceName(),
                productName,
                manufacturer,
                "Cámara UVC (Nativa)",
                brand,
                vidPid,
                "MJPEG / YUYV (libuvc)",
                "ISOC (Nativo libusb)"
        );
    }

    private boolean isUvcDevice(UsbDevice device) {
        if (device == null) return false;
        if (device.getDeviceClass() == UsbConstants.USB_CLASS_VIDEO) {
            return true;
        }
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            if (iface.getInterfaceClass() == UsbConstants.USB_CLASS_VIDEO) {
                return true;
            }
        }
        String name = (device.getProductName() != null ? device.getProductName() : "") + " " +
                      (device.getManufacturerName() != null ? device.getManufacturerName() : "");
        name = name.toLowerCase();
        return name.contains("cam") || name.contains("uvc") || name.contains("bison");
    }
}
