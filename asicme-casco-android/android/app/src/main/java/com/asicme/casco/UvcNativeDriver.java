package com.asicme.casco;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Process;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.concurrent.atomic.AtomicBoolean;

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

    // Fase 2: Conexión y Endpoints
    private UsbDeviceConnection connection;
    private UsbInterface ctrlInterface;
    private UsbInterface streamInterface;
    private UsbEndpoint videoEndpoint;

    // Interfaz para notificar a la capa superior (React/Capacitor) sobre el estado
    public interface UvcDriverListener {
        void onPermissionGranted(UsbDevice device);
        void onPermissionDenied(UsbDevice device);
        void onCameraNotFound();
    }

    // Fase 3: Streaming y Decodificación
    public interface OnFrameCapturedListener {
        void onFrame(Bitmap bitmap);
    }

    private UvcDriverListener listener;
    private OnFrameCapturedListener frameListener;
    
    private Thread workerThread;
    private final AtomicBoolean isStreaming = new AtomicBoolean(false);

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

    public void setFrameListener(OnFrameCapturedListener listener) {
        this.frameListener = listener;
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
        isStreaming.set(false);
        if (workerThread != null) {
            try {
                workerThread.join(500); // Dar medio segundo para que cierre amablemente
            } catch (InterruptedException ignored) {}
            workerThread = null;
        }

        if (permissionReceiver != null) {
            try {
                context.unregisterReceiver(permissionReceiver);
            } catch (IllegalArgumentException e) {
                Log.w(TAG, "El receiver ya estaba desregistrado.");
            }
            permissionReceiver = null;
        }

        if (connection != null) {
            if (streamInterface != null) connection.releaseInterface(streamInterface);
            if (ctrlInterface != null) connection.releaseInterface(ctrlInterface);
            connection.close();
            connection = null;
            Log.d(TAG, "Conexión USB cerrada correctamente.");
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
        
        // 1. Abrir la conexión
        connection = usbManager.openDevice(device);
        if (connection == null) {
            Log.e(TAG, "Fallo crítico: El sistema operativo denegó el acceso físico o el dispositivo fue desconectado.");
            return;
        }
        Log.d(TAG, "Conexión USB abierta exitosamente.");

        // 2. Identificación de Interfaces UVC
        int interfaceCount = device.getInterfaceCount();
        for (int i = 0; i < interfaceCount; i++) {
            UsbInterface usbInterface = device.getInterface(i);
            
            // Clase 14 (0x0E) es Video
            if (usbInterface.getInterfaceClass() == UsbConstants.USB_CLASS_VIDEO) {
                int subclass = usbInterface.getInterfaceSubclass();
                if (subclass == 1) { // 1 = VideoControl
                    ctrlInterface = usbInterface;
                    Log.d(TAG, "Interfaz de VideoControl encontrada.");
                } else if (subclass == 2) { // 2 = VideoStreaming
                    streamInterface = usbInterface;
                    Log.d(TAG, "Interfaz de VideoStreaming encontrada.");
                }
            }
        }

        if (ctrlInterface == null || streamInterface == null) {
            Log.e(TAG, "No se encontraron las interfaces UVC requeridas (Control y Streaming).");
            connection.close();
            return;
        }

        // 3. Reclamo de Interfaces
        boolean ctrlClaimed = connection.claimInterface(ctrlInterface, true);
        boolean streamClaimed = connection.claimInterface(streamInterface, true);

        if (!ctrlClaimed || !streamClaimed) {
            Log.e(TAG, "Error crítico: No se pudieron reclamar las interfaces UVC.");
            connection.close();
            return;
        }
        Log.d(TAG, "Interfaces UVC reclamadas con éxito.");

        // 4. Búsqueda del Endpoint de Video (Entrada y Transferencia)
        int endpointCount = streamInterface.getEndpointCount();
        for (int i = 0; i < endpointCount; i++) {
            UsbEndpoint ep = streamInterface.getEndpoint(i);
            
            boolean isInput = ep.getDirection() == UsbConstants.USB_DIR_IN;
            boolean isBulkOrIsoc = ep.getType() == UsbConstants.USB_ENDPOINT_XFER_ISOC || 
                                   ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK;

            if (isInput && isBulkOrIsoc) {
                videoEndpoint = ep;
                Log.d(TAG, "Endpoint de Video encontrado: Dirección IN, Tipo " + 
                      (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_ISOC ? "Isócrono" : "Bulk"));
                break; // Solo necesitamos el primero que cumpla
            }
        }

        if (videoEndpoint == null) {
            Log.e(TAG, "No se encontró un Endpoint válido para el streaming de video.");
            connection.releaseInterface(streamInterface);
            connection.releaseInterface(ctrlInterface);
            connection.close();
            return;
        }

        Log.i(TAG, ">>> Conexión física establecida y Endpoint de video localizado. Listo para streaming.");

        iniciarLecturaVideo();
    }

    /**
     * Fase 3: Hilo de lectura continua (Worker Thread).
     * Succiona los bytes crudos del UsbEndpoint, decodifica las cabeceras UVC,
     * reensambla los fotogramas MJPEG y los convierte a Bitmap.
     */
    private void iniciarLecturaVideo() {
        if (isStreaming.get()) return;
        isStreaming.set(true);

        workerThread = new Thread(() -> {
            // 1. Asignar prioridad altísima para evitar parpadeos y retrasos (stuttering)
            Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_DISPLAY);
            Log.d(TAG, "Hilo de lectura de video iniciado con prioridad alta.");

            int maxPacketSize = videoEndpoint.getMaxPacketSize();
            byte[] buffer = new byte[maxPacketSize];
            
            // 4. Utiliza un ByteArrayOutputStream para ir acumulando los bytes de imagen.
            ByteArrayOutputStream frameBuffer = new ByteArrayOutputStream(1024 * 50); // Pre-alocado a 50KB

            try {
                while (isStreaming.get() && connection != null) {
                    // 2. Lectura en Bruto (bulkTransfer)
                    // timeout corto (100ms) para no bloquear indefinidamente el hilo si la cámara se congela
                    int bytesRead = connection.bulkTransfer(videoEndpoint, buffer, buffer.length, 100);

                    if (bytesRead > 0) {
                        // 3. Parseo del UVC Payload Header
                        // buffer[0] -> Longitud exacta de la cabecera (Header Length)
                        int headerLength = buffer[0] & 0xFF; 

                        // Validar seguridad del paquete
                        if (headerLength >= 2 && headerLength <= bytesRead) {
                            // buffer[1] -> Bitfield Header (Flags)
                            byte headerBitfield = buffer[1]; 
                            
                            // Bandera EOF (End of Frame) es el bit 1
                            boolean isEof = (headerBitfield & 0x02) != 0;

                            // 4. Reensamblaje del Fotograma (MJPEG)
                            // Ignora los primeros bytes (headerLength) y copia el "Payload"
                            int payloadLength = bytesRead - headerLength;
                            if (payloadLength > 0) {
                                frameBuffer.write(buffer, headerLength, payloadLength);
                            }

                            // 5. Decodificación a Bitmap al detectar EOF
                            if (isEof) {
                                byte[] jpegBytes = frameBuffer.toByteArray();
                                frameBuffer.reset(); // Limpiar el acumulador para la siguiente foto

                                if (jpegBytes.length > 0 && frameListener != null) {
                                    Bitmap bitmap = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.length);
                                    if (bitmap != null) {
                                        frameListener.onFrame(bitmap);
                                    } else {
                                        Log.w(TAG, "Fallo al decodificar Bitmap (fotograma corrupto o fragmentado).");
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error crítico en el hilo de lectura de video: ", e);
            } finally {
                isStreaming.set(false);
                try {
                    frameBuffer.close();
                } catch (Exception ignored) {}
                Log.d(TAG, "Hilo de lectura de video terminado de forma segura.");
            }
        });

        workerThread.setName("UVC-Stream-Worker");
        workerThread.start();
    }
}
