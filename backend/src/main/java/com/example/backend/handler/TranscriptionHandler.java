package com.example.backend.handler;

import com.example.backend.service.DeepgramStreamingService;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Component
public class TranscriptionHandler extends AbstractWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(TranscriptionHandler.class);

    private final DeepgramStreamingService deepgramService;
    private final ConcurrentHashMap<String, ReentrantLock> sessionLocks = new ConcurrentHashMap<>();

    @Autowired
    public TranscriptionHandler(DeepgramStreamingService deepgramService) {
        this.deepgramService = deepgramService;
        log.info("TranscriptionHandler initialized.");
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("Frontend WebSocket connection established: Session ID {}", session.getId());
        sessionLocks.put(session.getId(), new ReentrantLock());
        connectToDeepgram(session);
    }

    private void connectToDeepgram(WebSocketSession session) {
        DeepgramStreamingService.DeepgramWebSocketListener deepgramListener =
                deepgramService.connect(session);

        if (deepgramListener != null) {
            session.getAttributes().put("deepgramListener", deepgramListener);
            log.info("Connected frontend session {} to Deepgram.", session.getId());
        } else {
            log.error("Failed to establish Deepgram connection for session {}.", session.getId());
            closeFrontendSession(session, CloseStatus.SERVER_ERROR.withReason("Backend failed to connect to transcription service"));
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        ReentrantLock lock = sessionLocks.get(session.getId());
        if (lock == null) {
            log.warn("Lock not found for session {}, cannot process binary message.", session.getId());
            return;
        }

        lock.lock();
        try {
            DeepgramStreamingService.DeepgramWebSocketListener deepgramListener =
                    (DeepgramStreamingService.DeepgramWebSocketListener) session.getAttributes().get("deepgramListener");

            if (deepgramListener == null || deepgramListener.isLikelyClosed()) {
                log.warn("Deepgram listener missing or closed for session {}. Reconnecting.", session.getId());
                session.getAttributes().remove("deepgramListener");
                if (deepgramListener != null) {
                    deepgramListener.close();
                }

                connectToDeepgram(session);
                deepgramListener = (DeepgramStreamingService.DeepgramWebSocketListener) session.getAttributes().get("deepgramListener");

                if (deepgramListener == null || deepgramListener.isLikelyClosed()) {
                    log.error("Unable to reconnect to Deepgram for session {}.", session.getId());
                    closeFrontendSession(session, CloseStatus.SERVER_ERROR.withReason("Failed to maintain connection to transcription service"));
                    return;
                }
                log.info("Reconnected Deepgram for session {}.", session.getId());
            }

            ByteBuffer payload = message.getPayload();
            byte[] audioData = new byte[payload.remaining()];
            payload.get(audioData);

            boolean sent = deepgramListener.sendAudio(audioData);
            if (!sent) {
                log.warn("Failed to send audio chunk to Deepgram for session {}.", session.getId());
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.debug("Received text message from frontend: {} from session {}", payload, session.getId());

        ReentrantLock lock = sessionLocks.get(session.getId());
        if (lock == null) {
            log.warn("Lock not found for session {}, cannot process text message.", session.getId());
            return;
        }

        lock.lock();
        try {
            try {
                JSONObject jsonPayload = new JSONObject(payload);
                if (jsonPayload.has("eof") && jsonPayload.getInt("eof") == 1) {
                    log.info("Received EOF signal from frontend session {}", session.getId());
                    DeepgramStreamingService.DeepgramWebSocketListener deepgramListener =
                            (DeepgramStreamingService.DeepgramWebSocketListener) session.getAttributes().get("deepgramListener");
                    if (deepgramListener != null) {
                        deepgramListener.close();
                        log.info("Requested Deepgram close for session {}", session.getId());
                    } else {
                        log.warn("Deepgram listener missing on EOF for session {}.", session.getId());
                    }
                } else {
                    log.warn("Received unexpected text message from frontend session {}: {}", session.getId(), payload);
                }
            } catch (Exception e) {
                log.warn("Could not parse frontend text message for session {}: {}", session.getId(), e.getMessage());
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.error("Frontend transport error for session {}: {}", session.getId(), exception.getMessage(), exception);
        cleanupDeepgramConnection(session);
        sessionLocks.remove(session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        log.info("Frontend WebSocket connection closed: Session ID {}, Status: {}", session.getId(), status);
        cleanupDeepgramConnection(session);
        sessionLocks.remove(session.getId());
    }

    private void cleanupDeepgramConnection(WebSocketSession session) {
        ReentrantLock lock = sessionLocks.get(session.getId());
        boolean locked = false;
        if (lock != null) {
            try {
                locked = lock.tryLock(100, java.util.concurrent.TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("Interrupted while trying to acquire lock for cleanup on session {}. Proceeding without lock.", session.getId());
            }
        }

        DeepgramStreamingService.DeepgramWebSocketListener deepgramListener =
                (DeepgramStreamingService.DeepgramWebSocketListener) session.getAttributes().remove("deepgramListener");
        if (deepgramListener != null) {
            log.info("Cleaning up Deepgram connection for session {}", session.getId());
            deepgramListener.close();
        } else {
            log.debug("No Deepgram listener found during cleanup for session {}", session.getId());
        }

        if (locked) {
            lock.unlock();
        }
    }

    private void closeFrontendSession(WebSocketSession session, CloseStatus status) {
        if (session.isOpen()) {
            try {
                session.close(status);
            } catch (IOException e) {
                log.error("IOException closing frontend session {}: {}", session.getId(), e.getMessage());
            }
        }
    }
}
