package com.asicme.casco;

import android.graphics.Bitmap;
import android.util.Log;

import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.atomic.AtomicBoolean;

public class MjpegServer implements Runnable {
    private static final String TAG = "MjpegServer";
    private static final String BOUNDARY = "--MyBoundary";
    
    private ServerSocket serverSocket;
    private Socket clientSocket;
    private OutputStream outputStream;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);

    public void start() {
        if (isRunning.get()) return;
        isRunning.set(true);
        new Thread(this, "MjpegServerThread").start();
    }

    public void stop() {
        isRunning.set(false);
        try {
            if (clientSocket != null) clientSocket.close();
            if (serverSocket != null) serverSocket.close();
        } catch (Exception e) {
            Log.e(TAG, "Error closing server", e);
        }
    }

    @Override
    public void run() {
        try {
            serverSocket = new ServerSocket(8080);
            Log.d(TAG, "MJPEG Server running on port 8080");

            while (isRunning.get()) {
                clientSocket = serverSocket.accept();
                Log.d(TAG, "Client connected to MJPEG Server");

                outputStream = clientSocket.getOutputStream();
                
                // Enviar cabeceras iniciales HTTP
                String header = "HTTP/1.1 200 OK\r\n" +
                                "Content-Type: multipart/x-mixed-replace; boundary=" + BOUNDARY + "\r\n" +
                                "Connection: close\r\n" +
                                "Cache-Control: no-cache\r\n" +
                                "Pragma: no-cache\r\n\r\n";
                
                outputStream.write(header.getBytes());
                outputStream.flush();

                // Mantener el socket vivo. La transmisión real ocurrirá en pushFrame()
                while (isRunning.get() && !clientSocket.isClosed()) {
                    Thread.sleep(100);
                }
            }
        } catch (Exception e) {
            if (isRunning.get()) {
                Log.e(TAG, "Server error", e);
            }
        } finally {
            stop();
        }
    }

    public synchronized void pushFrame(Bitmap frame) {
        if (outputStream == null || clientSocket == null || clientSocket.isClosed()) return;

        try {
            java.io.ByteArrayOutputStream jpegStream = new java.io.ByteArrayOutputStream();
            frame.compress(Bitmap.CompressFormat.JPEG, 60, jpegStream); // 60% quality para velocidad
            byte[] jpegBytes = jpegStream.toByteArray();

            String frameHeader = "\r\n" + BOUNDARY + "\r\n" +
                                 "Content-Type: image/jpeg\r\n" +
                                 "Content-Length: " + jpegBytes.length + "\r\n\r\n";

            outputStream.write(frameHeader.getBytes());
            outputStream.write(jpegBytes);
            outputStream.flush();
        } catch (Exception e) {
            Log.e(TAG, "Error pushing frame, client probably disconnected.", e);
            try { clientSocket.close(); } catch (Exception ignored) {}
        }
    }
}
