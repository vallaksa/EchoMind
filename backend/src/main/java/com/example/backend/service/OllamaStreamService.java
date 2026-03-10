package com.example.backend.service; // Assuming this package structure

import okhttp3.*;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils; // Import StringUtils

import java.io.IOException;
import java.util.function.Consumer;

@Service
public class OllamaStreamService {

    private static final Logger logger = LoggerFactory.getLogger(OllamaStreamService.class);
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private final OkHttpClient httpClient;
    private final String ollamaApiUrl;
    private final String defaultModel;

    @Autowired
    public OllamaStreamService(
            OkHttpClient httpClient,
            @Value("${ollama.api.url}") String ollamaApiUrl,
            @Value("${ollama.default.model}") String defaultModel) {
        this.httpClient = httpClient;
        this.ollamaApiUrl = ollamaApiUrl;
        this.defaultModel = defaultModel;
    }

    public void streamChat(String prompt, String model, String context, Consumer<String> onChunkReceived, Runnable onComplete, Consumer<Exception> onError) {
        
        // Use provided model or default if empty/null
        String selectedModel = StringUtils.hasText(model) ? model : defaultModel;
        logger.info("Using Ollama model: {}", selectedModel);
        
        JSONObject jsonBody = new JSONObject();
        jsonBody.put("model", selectedModel); // Use selected model
        jsonBody.put("prompt", prompt);
        
        // If context is provided, inject it as a system prompt
        if (StringUtils.hasText(context)) {
            String systemPrompt = "You are a helpful AI assistant attending an ongoing meeting. " +
                                  "Below is the live meeting transcript. Use this context to answer the user's questions.\n" +
                                  "--- MEETING TRANSCRIPT ---\n" +
                                  context + "\n" +
                                  "--- END TRANSCRIPT ---\n";
            jsonBody.put("system", systemPrompt);
            logger.info("Injected meeting context into system prompt.");
        }
        
        jsonBody.put("stream", true);

        RequestBody body = RequestBody.create(jsonBody.toString(), JSON);
        Request request = new Request.Builder()
                .url(ollamaApiUrl)
                .post(body)
                .build();

        logger.info("Sending request to Ollama API: {}", ollamaApiUrl);

        // Execute in a background thread managed by the controller or caller
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "No response body";
                logger.error("Ollama API request failed: {} - {} for model {}", response.code(), errorBody, selectedModel);
                throw new IOException("Unexpected code " + response + " Body: " + errorBody);
            }

            logger.info("Received successful response from Ollama API for model {}. Streaming started.", selectedModel);
            try (ResponseBody responseBody = response.body()) {
                if (responseBody == null) {
                     logger.warn("Received null response body from Ollama for model {}.", selectedModel);
                     throw new IOException("Received null response body");
                }
                // Use the source to read line by line
                try (okio.BufferedSource source = responseBody.source()) {
                    String previousChunk = ""; // Track previous non-empty trimmed chunk

                    while (!source.exhausted()) {
                        String line = source.readUtf8LineStrict(); // Throws EOFException if stream ends unexpectedly
                        logger.info("Raw response line from Ollama: {}", line); // Log the raw line
                        if (line != null && !line.trim().isEmpty()) {
                            try {
                                JSONObject jsonLine = new JSONObject(line);
                                if (jsonLine.has("response")) {
                                    String chunk = jsonLine.getString("response");
                                    String trimmedToken = chunk.trim();

                                    String chunkToSend = chunk; // Default to sending original chunk

                                    if (!trimmedToken.isEmpty()) { // Apply heuristic only if token has content
                                        boolean addSpace = false;
                                        if (!previousChunk.isEmpty() &&
                                            Character.isLetter(previousChunk.charAt(previousChunk.length() - 1)) &&
                                            Character.isLetter(trimmedToken.charAt(0))) {
                                            addSpace = true;
                                        }
                                        if (addSpace) {
                                            chunkToSend = " " + chunk; // Prepend space to original chunk
                                        }
                                        previousChunk = trimmedToken; // Update state ONLY with non-empty trimmed token
                                    } else if (!chunk.isEmpty()) {
                                        // If original chunk was whitespace, reset previous state
                                        previousChunk = "";
                                    }
                                    // If chunkToSend is not empty OR if it was only whitespace, send it
                                    if (!chunkToSend.isEmpty() || (!trimmedToken.isEmpty() && chunk.isEmpty())) { 
                                        onChunkReceived.accept(chunkToSend);
                                    }
                                }
                                // Check if Ollama indicates the stream is done (optional, depends on Ollama version/behavior)
                                if (jsonLine.optBoolean("done", false)) {
                                     logger.info("Ollama indicated stream completion for model {}.", selectedModel);
                                     break;
                                }
                            } catch (org.json.JSONException e) {
                                logger.warn("Failed to parse JSON line from Ollama stream for model {}: {}", selectedModel, line, e);
                                // Decide whether to continue or abort on parse error
                            }
                        }
                    }
                } catch (java.io.EOFException e) {
                    logger.info("Ollama stream finished (EOF) for model {}.", selectedModel);
                }
            }
            logger.info("Ollama stream processing complete for model {}.", selectedModel);
            onComplete.run(); // Signal completion

        } catch (IOException e) {
            logger.error("Error during Ollama stream interaction for model {}: {}", selectedModel, e.getMessage(), e);
            onError.accept(e); // Signal error
        }
    }
} 