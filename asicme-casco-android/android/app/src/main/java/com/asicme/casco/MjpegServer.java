package com.asicme.casco;

import fi.iki.elonen.NanoHTTPD;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.IOException;

public class MjpegServer extends NanoHTTPD {
    private byte[] currentFrame;
    private final Object frameLock = new Object();

    public MjpegServer(int port) {
        super(port);
    }

    public void updateFrame(byte[] jpegData) {
        synchronized (frameLock) {
            this.currentFrame = jpegData;
            frameLock.notifyAll(); // Despierta a los clientes esperando un nuevo frame
        }
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        if ("/stream".equals(uri)) {
            // El encabezado multipart/x-mixed-replace mantiene la conexión viva
            Response res = NanoHTTPD.newChunkedResponse(Response.Status.OK, 
                "multipart/x-mixed-replace; boundary=--BoundaryString", 
                new MjpegStream());
            // Añadir CORS para evitar problemas desde el WebView
            res.addHeader("Access-Control-Allow-Origin", "*");
            res.addHeader("Cache-Control", "no-cache, private");
            return res;
        }
        return NanoHTTPD.newFixedLengthResponse("MJPEG Servidor Activo en Android");
    }

    /**
     * InputStream infinito que genera los chunks del MJPEG en tiempo real
     */
    private class MjpegStream extends InputStream {
        private ByteArrayInputStream currentStream = null;

        @Override
        public int read() throws IOException {
            byte[] b = new byte[1];
            int count = read(b, 0, 1);
            return count < 0 ? -1 : (b[0] & 0xFF);
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (currentStream == null || currentStream.available() == 0) {
                byte[] frameData;
                synchronized (frameLock) {
                    try {
                        frameLock.wait(1000); // Esperar nuevo frame (max 1 segundo)
                    } catch (InterruptedException e) {
                        return -1;
                    }
                    frameData = currentFrame;
                }
                
                if (frameData == null) {
                    return 0; // Evitar bloquear si no hay cámara
                }

                // Construir la cabecera HTTP del chunk MJPEG
                String header = "\r\n--BoundaryString\r\n" +
                                "Content-Type: image/jpeg\r\n" +
                                "Content-Length: " + frameData.length + "\r\n\r\n";
                byte[] headerBytes = header.getBytes();
                
                // Concatenar cabecera y bytes de la imagen
                byte[] chunk = new byte[headerBytes.length + frameData.length];
                System.arraycopy(headerBytes, 0, chunk, 0, headerBytes.length);
                System.arraycopy(frameData, 0, chunk, headerBytes.length, frameData.length);
                
                currentStream = new ByteArrayInputStream(chunk);
            }
            return currentStream.read(b, off, len);
        }
    }
}
