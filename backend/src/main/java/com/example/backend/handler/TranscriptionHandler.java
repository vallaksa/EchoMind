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

@Component
public class TranscriptionHandler extends AbstractWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(TranscriptionHandler.class);

    private final DeepgramStreamingService deepgramService;

    @Autowired
    public TranscriptionHandler(DeepgramStreamingService deepgramService) {
        this.deepgramService = deepgramService;
        log.info("TranscriptionHandler initialized with Deepgram Service.");
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("Frontend WebSocket connection established: Session ID {}", session.getId());
        DeepgramStreamingService.DeepgramWebSocketListener deepgramListener =
                deepgramService.connect(session);

        if (deepgramListener != null) {
            session.getAttributes().put("deepgramListener", deepgramListener);
            log.info("Associated Deepgram listener with frontend session {}", session.getId());
        } else {
            log.error("Failed to establish Deepgram connection for frontend session {}. Closing frontend session.", session.getId());
            if (session.isOpen()) {
                session.close(CloseStatus.SERVER_ERROR.withReason("Backend failed to connect to transcription service"));
            }
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        DeepgramStreamingService.DeepgramWebSocketListener deepgramListener =
                (DeepgramStreamingService.DeepgramWebSocketListener) session.getAttributes().get("deepgramListener");

        if (deepgramListener == null) {
            log.warn("Deepgram listener not found for session {}, cannot forward audio. Frontend might be closing or connection failed.", session.getId());
            return;
        }

        ByteBuffer payload = message.getPayload();
        byte[] audioData = new byte[payload.remaining()];
        payload.get(audioData);

        boolean sent = deepgramListener.sendAudio(audioData);
        if (!sent) {
            log.warn("Failed to send audio chunk to Deepgram for session {}. WebSocket might be closed.", session.getId());
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.debug("Received text message from frontend: {} from session {}", payload, session.getId());

        try {
            JSONObject jsonPayload = new JSONObject(payload);
            if (jsonPayload.has("eof") && jsonPayload.getInt("eof") == 1) {
                log.info("Received EOF signal from frontend session {}", session.getId());
                DeepgramStreamingService.DeepgramWebSocketListener deepgramListener =
                        (DeepgramStreamingService.DeepgramWebSocketListener) session.getAttributes().get("deepgramListener");
                if (deepgramListener != null) {
                    deepgramListener.close();
                    log.info("Requested Deepgram connection close for session {}", session.getId());
                } else {
                    log.warn("Deepgram listener not found on EOF for session {}, cannot signal close.", session.getId());
                }
            } else {
                 log.warn("Received unexpected text message format from frontend: {}", payload);
            }
        } catch (Exception e) {
            log.warn("Could not parse text message from frontend as JSON or unexpected content: '{}' from session {}. Error: {}",
                     payload, session.getId(), e.getMessage());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.error("Frontend transport error for session {}: {}", session.getId(), exception.getMessage(), exception);
        cleanupDeepgramConnection(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        log.info("Frontend WebSocket connection closed: Session ID {}, Status: {}", session.getId(), status);
        cleanupDeepgramConnection(session);
    }

    private void cleanupDeepgramConnection(WebSocketSession session) {
        DeepgramStreamingService.DeepgramWebSocketListener deepgramListener =
                (DeepgramStreamingService.DeepgramWebSocketListener) session.getAttributes().remove("deepgramListener");
        if (deepgramListener != null) {
            log.info("Cleaning up Deepgram connection for frontend session {}", session.getId());
            deepgramListener.close();
        } else {
             log.debug("No active Deepgram listener found in attributes to clean up for session {}", session.getId());
        }
    }
}