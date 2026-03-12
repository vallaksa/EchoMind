package com.example.backend.service;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

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

    /**
     * Streams an Ollama response chunk-by-chunk to the provided callbacks.
     *
     * @param prompt required prompt text
     * @param model optional model name
     * @param context optional transcript context injected into the system prompt
     * @param onChunkReceived callback for each streamed chunk
     * @param onComplete callback when the stream completes cleanly
     * @param onError callback when the request fails
     */
    public void streamChat(
            String prompt,
            String model,
            String context,
            Consumer<String> onChunkReceived,
            Runnable onComplete,
            Consumer<Exception> onError) {
        String selectedModel = StringUtils.hasText(model) ? model : defaultModel;
        logger.info("Sending chat request to Ollama with model {}", selectedModel);

        JSONObject jsonBody = new JSONObject();
        jsonBody.put("model", selectedModel);
        jsonBody.put("prompt", prompt);
        if (StringUtils.hasText(context)) {
            jsonBody.put("system", buildSystemPrompt(context));
            logger.debug("Injected transcript context into Ollama system prompt.");
        }
        jsonBody.put("stream", true);

        Request request = new Request.Builder()
                .url(ollamaApiUrl)
                .post(RequestBody.create(jsonBody.toString(), JSON))
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "No response body";
                throw new IOException("Unexpected code " + response.code() + " Body: " + errorBody);
            }

            try (ResponseBody responseBody = response.body()) {
                if (responseBody == null) {
                    throw new IOException("Received null response body from Ollama");
                }
                streamResponseBody(responseBody, selectedModel, onChunkReceived);
            }

            logger.info("Completed Ollama chat stream for model {}", selectedModel);
            onComplete.run();
        } catch (IOException e) {
            logger.error("Error during Ollama chat stream for model {}", selectedModel, e);
            onError.accept(e);
        }
    }

    private String buildSystemPrompt(String context) {
        return "You are a helpful AI assistant attending an ongoing meeting. " +
                "Below is the live meeting transcript. Use this context to answer the user's questions.\n" +
                "--- MEETING TRANSCRIPT ---\n" +
                context + "\n" +
                "--- END TRANSCRIPT ---\n";
    }

    private void streamResponseBody(
            ResponseBody responseBody,
            String selectedModel,
            Consumer<String> onChunkReceived) throws IOException {
        try (okio.BufferedSource source = responseBody.source()) {
            String previousChunk = "";

            while (!source.exhausted()) {
                String line = source.readUtf8LineStrict();
                if (line == null || line.trim().isEmpty()) {
                    continue;
                }

                try {
                    JSONObject jsonLine = new JSONObject(line);
                    if (jsonLine.has("response")) {
                        String chunk = jsonLine.getString("response");
                        String chunkToSend = applySpacingHeuristic(previousChunk, chunk);
                        String trimmedToken = chunk.trim();

                        if (!trimmedToken.isEmpty()) {
                            previousChunk = trimmedToken;
                        } else if (!chunk.isEmpty()) {
                            previousChunk = "";
                        }

                        if (!chunkToSend.isEmpty() || (!trimmedToken.isEmpty() && chunk.isEmpty())) {
                            onChunkReceived.accept(chunkToSend);
                        }
                    }

                    if (jsonLine.optBoolean("done", false)) {
                        break;
                    }
                } catch (org.json.JSONException e) {
                    logger.warn("Failed to parse Ollama stream line for model {}: {}", selectedModel, line, e);
                }
            }
        } catch (java.io.EOFException e) {
            logger.debug("Ollama stream reached EOF for model {}", selectedModel);
        }
    }

    private String applySpacingHeuristic(String previousChunk, String chunk) {
        String trimmedToken = chunk.trim();
        if (previousChunk.isEmpty() || trimmedToken.isEmpty()) {
            return chunk;
        }

        if (Character.isLetter(previousChunk.charAt(previousChunk.length() - 1)) &&
                Character.isLetter(trimmedToken.charAt(0))) {
            return " " + chunk;
        }
        return chunk;
    }
}
