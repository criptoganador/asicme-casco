package com.asicme.casco;

import android.graphics.Bitmap;
import android.util.Log;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * MjpegServer
 *
 * Servidor HTTP local de streaming MJPEG multiproceso en el puerto 8080.
 * Permite que WebView de Android y LiveKit consuman el flujo de video USB
 * de manera concurrente y sin bloqueos de socket.
 */
public class MjpegServer implements Runnable {
    private static final String TAG = "MjpegServer";
    private static final String BOUNDARY = "AsicMeBoundary";
    private static final int PORT = 8080;

    private ServerSocket serverSocket;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private final List<ClientHandler> clients = new CopyOnWriteArrayList<>();

    private static class ClientHandler {
        final Socket socket;
        final OutputStream out;

        ClientHandler(Socket socket, OutputStream out) {
            this.socket = socket;
            this.out = out;
        }

        void close() {
            try {
                if (out != null) out.close();
            } catch (Exception ignored) {}
            try {
                if (socket != null) socket.close();
            } catch (Exception ignored) {}
        }
    }

    public void start() {
        if (isRunning.get()) return;
        isRunning.set(true);
        Thread serverThread = new Thread(this, "MjpegServer-Listener");
        serverThread.start();
    }

    public void stop() {
        isRunning.set(false);
        for (ClientHandler client : clients) {
            client.close();
        }
        clients.clear();

        try {
            if (serverSocket != null) serverSocket.close();
        } catch (Exception e) {
            Log.e(TAG, "Error cerrando ServerSocket", e);
        }
    }

    @Override
    public void run() {
        try {
            serverSocket = new ServerSocket(PORT);
            serverSocket.setReuseAddress(true);
            Log.i(TAG, ">>> Servidor MJPEG iniciado y escuchando en http://127.0.0.1:" + PORT);

            while (isRunning.get()) {
                Socket socket = serverSocket.accept();
                socket.setTcpNoDelay(true);

                // Leer encabezados de la petición HTTP GET entrante
                try {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                    String requestLine = reader.readLine();
                    Log.d(TAG, "Petición HTTP entrante al servidor MJPEG: " + requestLine);

                    // Enviar respuesta inicial multipart/x-mixed-replace
                    OutputStream out = socket.getOutputStream();
                    String initialResponse =
                            "HTTP/1.1 200 OK\r\n" +
                            "Content-Type: multipart/x-mixed-replace; boundary=" + BOUNDARY + "\r\n" +
                            "Connection: close\r\n" +
                            "Access-Control-Allow-Origin: *\r\n" +
                            "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
                            "Pragma: no-cache\r\n\r\n";

                    out.write(initialResponse.getBytes());
                    out.flush();

                    ClientHandler client = new ClientHandler(socket, out);
                    clients.add(client);
                    Log.i(TAG, "Cliente conectado al stream MJPEG. Clientes activos: " + clients.size());

                    // Si ya tenemos un fotograma en caché, entregarlo de inmediato para evitar pantalla negra
                    if (lastJpegBytes != null) {
                        try {
                            String firstHeader =
                                    "--" + BOUNDARY + "\r\n" +
                                    "Content-Type: image/jpeg\r\n" +
                                    "Content-Length: " + lastJpegBytes.length + "\r\n\r\n";
                            out.write(firstHeader.getBytes());
                            out.write(lastJpegBytes);
                            out.write("\r\n".getBytes());
                            out.flush();
                        } catch (Exception ignored) {}
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Error iniciando handshake con cliente MJPEG: " + e.getMessage());
                    try { socket.close(); } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            if (isRunning.get()) {
                Log.e(TAG, "Excepción en ServerSocket MJPEG: ", e);
            }
        } finally {
            stop();
        }
    }

    private final ByteArrayOutputStream jpegBuffer = new ByteArrayOutputStream(1024 * 512);
    private volatile byte[] lastJpegBytes = null;

    /**
     * Comprime y distribuye el frame a todos los clientes HTTP conectados.
     */
    public synchronized void pushFrame(Bitmap frame) {
        if (frame == null) return;

        try {
            jpegBuffer.reset();
            // Calidad 70 balancea nitidez y velocidad de transferencia
            frame.compress(Bitmap.CompressFormat.JPEG, 70, jpegBuffer);
            byte[] jpegBytes = jpegBuffer.toByteArray();
            lastJpegBytes = jpegBytes;

            if (clients.isEmpty()) return;

            String frameHeader =
                    "--" + BOUNDARY + "\r\n" +
                    "Content-Type: image/jpeg\r\n" +
                    "Content-Length: " + jpegBytes.length + "\r\n\r\n";
            byte[] headerBytes = frameHeader.getBytes();

            for (ClientHandler client : clients) {
                try {
                    client.out.write(headerBytes);
                    client.out.write(jpegBytes);
                    client.out.write("\r\n".getBytes());
                    client.out.flush();
                } catch (Exception e) {
                    Log.d(TAG, "Cliente desconectado del stream.");
                    client.close();
                    clients.remove(client);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error en pushFrame: " + e.getMessage());
        }
    }

    /**
     * Distribuye directamente bytes JPEG ya comprimidos sin requerir conversión previa a Bitmap.
     */
    public synchronized void pushRawFrame(byte[] jpegBytes) {
        if (jpegBytes == null || jpegBytes.length == 0) return;
        lastJpegBytes = jpegBytes;

        if (clients.isEmpty()) return;

        try {
            String frameHeader =
                    "--" + BOUNDARY + "\r\n" +
                    "Content-Type: image/jpeg\r\n" +
                    "Content-Length: " + jpegBytes.length + "\r\n\r\n";
            byte[] headerBytes = frameHeader.getBytes();

            for (ClientHandler client : clients) {
                try {
                    client.out.write(headerBytes);
                    client.out.write(jpegBytes);
                    client.out.write("\r\n".getBytes());
                    client.out.flush();
                } catch (Exception e) {
                    Log.d(TAG, "Cliente desconectado del stream.");
                    client.close();
                    clients.remove(client);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error en pushRawFrame: " + e.getMessage());
        }
    }
}
