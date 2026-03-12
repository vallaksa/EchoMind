package com.example.backend.service;

import com.example.backend.dto.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import okio.ByteString;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.Map;

@Component
public class DeepgramStreamingService {

    private static final Logger log = LoggerFactory.getLogger(DeepgramStreamingService.class);
    // Live transcription configuration only. Summary, topic, and sentiment features are not enabled here.
    private static final String DEEPGRAM_URL = "wss://api.deepgram.com/v1/listen?encoding=opus&punctuate=true&interim_results=true&smart_format=true&diarize=true&keepalive=true";

    private final OkHttpClient okHttpClient;
    private final ObjectMapper objectMapper;
    private final String deepgramApiKey;

    public DeepgramStreamingService(
            ObjectMapper objectMapper,
            @Value("${deepgram.api.key}") String deepgramApiKey) {
        this.objectMapper = objectMapper;
        this.deepgramApiKey = deepgramApiKey;
        this.okHttpClient = new OkHttpClient.Builder()
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .build();
    }

    /**
     * Establishes a connection to Deepgram for a specific frontend session.
     *
     * @param frontendSession The WebSocket session of the connected frontend client.
     * @return A listener instance managing the Deepgram connection, or null on failure.
     */
    public DeepgramWebSocketListener connect(WebSocketSession frontendSession) {
        if (deepgramApiKey == null || deepgramApiKey.isEmpty()) {
            log.error("Deepgram API Key is not configured in application.properties. Cannot connect.");
            sendErrorMessageToFrontendHelper(frontendSession, objectMapper, "Backend Error: Deepgram API Key not configured.");
            return null;
        }

        Request request = new Request.Builder()
                .url(DEEPGRAM_URL)
                .addHeader("Authorization", "Token " + deepgramApiKey)
                .build();

        DeepgramWebSocketListener listener = new DeepgramWebSocketListener(frontendSession, objectMapper);
        okhttp3.WebSocket deepgramWebSocket = okHttpClient.newWebSocket(request, listener);
        listener.setDeepgramWebSocket(deepgramWebSocket);

        log.info("Attempting to connect to Deepgram for frontend session: {}", frontendSession.getId());
        return listener;
    }

    private static void sendErrorMessageToFrontendHelper(WebSocketSession session, ObjectMapper mapper, String errorMessage) {
         if (session != null && session.isOpen()) {
             try {
                String errorJson = mapper.writeValueAsString(new ErrorMessage(errorMessage));
                 session.sendMessage(new TextMessage(errorJson));
             } catch(Exception e) {
                  log.error("Failed to send error message '{}' to frontend session {}: {}", errorMessage, session.getId(), e.getMessage());
             }
         }
    }

    public static class DeepgramWebSocketListener extends WebSocketListener {
        private final WebSocketSession frontendSession;
        private final ObjectMapper objectMapper;
        private okhttp3.WebSocket deepgramWebSocket;
        private final Map<Integer, String> speakerIdToNameMap = new ConcurrentHashMap<>();

        public DeepgramWebSocketListener(WebSocketSession frontendSession, ObjectMapper objectMapper) {
            this.frontendSession = frontendSession;
            this.objectMapper = objectMapper;
        }

        public void setDeepgramWebSocket(okhttp3.WebSocket deepgramWebSocket) {
            this.deepgramWebSocket = deepgramWebSocket;
        }

        @Override
        public void onOpen(@NotNull okhttp3.WebSocket webSocket, @NotNull Response response) {
            log.info("Deepgram connection OPEN for frontend session: {}", frontendSession.getId());
        }

        @Override
        public void onMessage(@NotNull okhttp3.WebSocket webSocket, @NotNull String text) {
            try {
                JsonNode response = objectMapper.readTree(text);
                String type = response.hasNonNull("type") ? response.get("type").asText() : null;

                if ("Results".equals(type)) {
                    Integer currentSpeaker = extractSpeaker(response);
                    List<EntityMessage.EntityInfo> currentEntities = extractEntities(response);
                    associateSpeakerNames(currentSpeaker, currentEntities, response);
                    parseAndSendTranscript(response, currentSpeaker);
                    if (currentEntities != null && !currentEntities.isEmpty()) {
                         log.info("Detected {} entities for session {}", currentEntities.size(), frontendSession.getId());
                         sendDtoToFrontend(new EntityMessage(currentEntities));
                    }
                }
                else if ("Metadata".equals(type)) {
                    parseAndSendMetadata(response);
                } else if ("Summary".equals(type)) {
                    parseAndSendSummaryV2(response);
                } else if ("Topics".equals(type)) {
                     parseAndSendTopics(response);
                }

                if (response.hasNonNull("sentiments")) {
                    parseAndSendSentiment(response);
                }

            } catch (JsonProcessingException e) {
                log.error("Failed to parse Deepgram message for session {}: {}", frontendSession.getId(), text, e);
            } catch (Exception e) {
                 log.error("Error processing Deepgram message for session {}: {}", frontendSession.getId(), text, e);
            }
        }

        private Integer extractSpeaker(JsonNode response) {
             JsonNode channel = response.path("channel");
             JsonNode alternatives = channel.path("alternatives");
             if (alternatives.isArray() && !alternatives.isEmpty()) {
                 JsonNode firstAlternative = alternatives.get(0);
                 JsonNode words = firstAlternative.path("words");
                 if (words.isArray() && !words.isEmpty()) {
                     int speaker = words.get(0).path("speaker").asInt(-1);
                     return speaker != -1 ? speaker : null;
                 }
                 if (firstAlternative.hasNonNull("speaker")) {
                      int speaker = firstAlternative.path("speaker").asInt(-1);
                      return speaker != -1 ? speaker : null;
                 }
             }
             return null;
        }

        private List<EntityMessage.EntityInfo> extractEntities(JsonNode response) {
            JsonNode entitiesNode = response.path("channel").path("alternatives").get(0).path("entities");
            if (entitiesNode != null && entitiesNode.isArray() && !entitiesNode.isEmpty()) {
                List<EntityMessage.EntityInfo> entityList = new ArrayList<>();
                try {
                    for (JsonNode entityJson : entitiesNode) {
                        EntityMessage.EntityInfo entityInfo = new EntityMessage.EntityInfo();
                        entityInfo.setText(entityJson.path("value").asText());
                        entityInfo.setType(entityJson.path("label").asText());
                        entityInfo.setConfidence(entityJson.path("confidence").asDouble());
                        entityInfo.setStartWord(entityJson.path("start_word").asDouble());
                        entityInfo.setEndWord(entityJson.path("end_word").asDouble());
                        entityList.add(entityInfo);
                    }
                     return entityList;
                } catch (Exception e) {
                    log.error("Failed to map entities for session {}: {}", frontendSession.getId(), e.getMessage());
                }
            }
            return null;
        }

        private void associateSpeakerNames(Integer speaker, List<EntityMessage.EntityInfo> entities, JsonNode response) {
            if (speaker == null || entities == null || entities.isEmpty()) {
                return;
            }

            for (EntityMessage.EntityInfo entity : entities) {
                if ("PERSON".equalsIgnoreCase(entity.getType()) || "PER".equalsIgnoreCase(entity.getType())) {
                    String potentialName = entity.getText();
                    if (potentialName != null && !potentialName.isEmpty() &&
                        !speakerIdToNameMap.containsKey(speaker)) {
                            String transcriptText = response.path("channel").path("alternatives").get(0).path("transcript").asText("");
                            if (transcriptText.toLowerCase().contains(potentialName.toLowerCase())) {
                                log.info("Associating speaker index {} with name '{}' for session {}", speaker, potentialName, frontendSession.getId());
                                speakerIdToNameMap.put(speaker, potentialName);
                                break;
                            }
                    }
                }
            }
        }

        private void parseAndSendTranscript(JsonNode response, Integer speaker) {
            boolean isFinal = response.path("is_final").asBoolean(false);
            JsonNode alternatives = response.path("channel").path("alternatives");

            if (alternatives.isArray() && !alternatives.isEmpty()) {
                JsonNode firstAlternative = alternatives.get(0);
                String transcript = firstAlternative.path("transcript").asText("");

                String speakerName = (speaker != null) ? speakerIdToNameMap.get(speaker) : null;

                if (!transcript.isEmpty() || isFinal) {
                    sendDtoToFrontend(new TranscriptMessage(transcript, isFinal, speaker, speakerName));
                }
            }
        }

        private void parseAndSendMetadata(JsonNode response) {
             if (response.hasNonNull("language_code")) {
                 String langCode = response.get("language_code").asText();
                 log.info("Detected language for session {}: {}", frontendSession.getId(), langCode);
                 sendDtoToFrontend(new LanguageMessage(langCode));
             }
        }

        private void parseAndSendSummaryV2(JsonNode response) {
             if (response.hasNonNull("summary")) {
                 String summaryText = response.path("summary").path("text").asText();
                 if (!summaryText.isEmpty()) {
                      log.info("Received summary for session {}: {}", frontendSession.getId(), summaryText);
                     sendDtoToFrontend(new SummaryMessage(summaryText));
                 }
             }
        }

         private void parseAndSendTopics(JsonNode response) {
            JsonNode segments = response.path("topics").path("segments");
            if (segments.isArray() && !segments.isEmpty()) {
                List<String> topicsList = new ArrayList<>();
                for (JsonNode segment : segments) {
                    JsonNode topics = segment.path("topics");
                    if (topics.isArray()) {
                        for (JsonNode topicNode : topics) {
                            String topicText = topicNode.path("topic").asText();
                            if (!topicText.isEmpty()) {
                                topicsList.add(topicText);
                            }
                        }
                    }
                }
                if (!topicsList.isEmpty()) {
                    log.info("Detected topics for session {}: {}", frontendSession.getId(), topicsList);
                    sendDtoToFrontend(new TopicsMessage(topicsList));
                }
            }
        }

        private void parseAndSendSentiment(JsonNode response) {
            JsonNode sentiments = response.path("sentiments");
            if(sentiments.isArray() && !sentiments.isEmpty()) {
                double totalScore = 0;
                int count = 0;
                for(JsonNode sentimentEntry : sentiments) {
                    totalScore += sentimentEntry.path("sentiment_score").asDouble(0.0);
                    count++;
                }
                if (count > 0) {
                    double avgScore = totalScore / count;
                    log.info("Detected average sentiment for session {}: {}", frontendSession.getId(), avgScore);
                    sendDtoToFrontend(new SentimentMessage(avgScore));
                }
            }
        }

        @Override
        public void onMessage(@NotNull okhttp3.WebSocket webSocket, @NotNull ByteString bytes) {
            log.warn("Received unexpected binary message from Deepgram for session: {}", frontendSession.getId());
        }

        @Override
        public void onClosing(@NotNull okhttp3.WebSocket webSocket, int code, @NotNull String reason) {
            log.info("Deepgram connection CLOSING for frontend session {}: Code={}, Reason={}", frontendSession.getId(), code, reason);
            webSocket.close(1000, null);
        }

        @Override
        public void onClosed(@NotNull okhttp3.WebSocket webSocket, int code, @NotNull String reason) {
            log.info("Deepgram connection CLOSED for frontend session {}: Code={}, Reason={}", frontendSession.getId(), code, reason);
            sendErrorMessageToFrontendHelper(frontendSession, objectMapper, "Disconnected from transcription service.");
            this.deepgramWebSocket = null;
        }

        @Override
        public void onFailure(@NotNull okhttp3.WebSocket webSocket, @NotNull Throwable t, @Nullable Response response) {
            log.error("Deepgram connection FAILURE for frontend session {}: {}", frontendSession.getId(), t.getMessage(), t);
            sendErrorMessageToFrontendHelper(frontendSession, objectMapper, "Transcription service connection failure: " + t.getMessage());
            this.deepgramWebSocket = null;
            try {
                frontendSession.close(org.springframework.web.socket.CloseStatus.SERVER_ERROR.withReason("Deepgram connection failed"));
            } catch (IOException e) {
                log.error("Failed to close frontend session {} after Deepgram failure: {}", frontendSession.getId(), e.getMessage());
            }
        }

        private void sendDtoToFrontend(WebSocketMessage dto) {
            try {
                String jsonPayload = objectMapper.writeValueAsString(dto);
                sendMessageToFrontend(jsonPayload);
            } catch (JsonProcessingException e) {
                log.error("Failed to serialize DTO {} for session {}: {}", dto.getClass().getSimpleName(), frontendSession.getId(), e.getMessage());
            }
        }

        private void sendMessageToFrontend(String payload) {
            if (frontendSession.isOpen()) {
                try {
                    frontendSession.sendMessage(new TextMessage(payload));
                } catch (IOException e) {
                    log.error("IOException sending message to frontend session {}: {}. Closing session.", frontendSession.getId(), e.getMessage());
                    closeFrontendSessionWithError("Send message failed");
                } catch (IllegalStateException e) {
                    log.warn("IllegalStateException sending message to frontend session {}: {}. Session might be closing.", frontendSession.getId(), e.getMessage());
                }
            } else {
                log.warn("Attempted to send message to already closed frontend session {}", frontendSession.getId());
            }
        }

        private void closeFrontendSessionWithError(String reason) {
             if (frontendSession.isOpen()) {
                try {
                    frontendSession.close(org.springframework.web.socket.CloseStatus.PROTOCOL_ERROR.withReason(reason));
                } catch (IOException e) {
                    log.error("IOException during error-driven close for frontend session {}: {}", frontendSession.getId(), e.getMessage());
                }
            }
        }

        public boolean isLikelyClosed() {
            return this.deepgramWebSocket == null;
        }

        public boolean sendAudio(byte[] audioData) {
             if (deepgramWebSocket != null) {
                 return deepgramWebSocket.send(ByteString.of(audioData));
             } else {
                 log.warn("Deepgram WebSocket not available to send audio for frontend session {}", frontendSession.getId());
                 return false;
             }
        }

        public void close() {
            log.info("Requesting to close Deepgram connection for frontend session {}...", frontendSession.getId());
             if (deepgramWebSocket != null) {
                 try {
                     deepgramWebSocket.send("{\"type\": \"CloseStream\"}");
                     deepgramWebSocket.close(1000, "Client requested disconnect");
                 } catch (IllegalStateException e) {
                     log.warn("Attempted to close Deepgram WebSocket that was already closing/closed for session {}: {}", frontendSession.getId(), e.getMessage());
                 } finally {
                     deepgramWebSocket = null; // Ensure it's null after attempting close
                 }
             }
        }
    }
}
