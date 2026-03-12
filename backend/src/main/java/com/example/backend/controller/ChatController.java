package com.example.backend.controller;

import com.example.backend.dto.ChatRequest;
import com.example.backend.service.OllamaStreamService;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);

    private final OllamaStreamService ollamaStreamService;
    private final ExecutorService sseExecutor = Executors.newCachedThreadPool();

    @Autowired
    public ChatController(OllamaStreamService ollamaStreamService) {
        this.ollamaStreamService = ollamaStreamService;
    }

    /**
     * Streams an Ollama response back to the frontend over SSE.
     *
     * @param request prompt, model, and optional transcript context
     * @return HTTP 400 for blank prompts, otherwise an SSE stream
     */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> streamChat(@RequestBody ChatRequest request) {
        if (request == null || !request.hasPrompt()) {
            logger.warn("Rejected chat request with blank prompt.");
            return ResponseEntity.badRequest().build();
        }

        String prompt = request.getPrompt().trim();
        String model = request.getModel();
        String context = request.getContext();
        String requestedModel = StringUtils.hasText(model) ? model : "(default)";
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);

        logger.info("Starting chat stream for model {}", requestedModel);

        Consumer<String> onChunkReceived = chunk -> sendChunk(emitter, chunk);
        Runnable onComplete = () -> completeEmitter(emitter, requestedModel);
        Consumer<Exception> onError = exception -> failEmitter(emitter, requestedModel, exception);

        sseExecutor.execute(() -> {
            try {
                ollamaStreamService.streamChat(prompt, model, context, onChunkReceived, onComplete, onError);
            } catch (Exception e) {
                logger.error("Unexpected chat streaming error for model {}", requestedModel, e);
                failEmitter(emitter, requestedModel, e);
            }
        });

        emitter.onCompletion(() -> logger.info("Chat emitter completed for model {}", requestedModel));
        emitter.onTimeout(() -> {
            logger.warn("Chat emitter timed out for model {}", requestedModel);
            completeQuietly(emitter);
        });
        emitter.onError(ex -> logger.error("Chat emitter error for model {}: {}", requestedModel, ex.getMessage()));

        return ResponseEntity.ok(emitter);
    }

    private void sendChunk(SseEmitter emitter, String chunk) {
        try {
            emitter.send(SseEmitter.event().data(chunk));
        } catch (IOException e) {
            logger.warn("Failed to send chat chunk to SSE client: {}", e.getMessage());
        } catch (IllegalStateException e) {
            logger.warn("Attempted to send to a completed SSE emitter: {}", e.getMessage());
        }
    }

    private void completeEmitter(SseEmitter emitter, String model) {
        logger.info("Completed chat stream for model {}", model);
        completeQuietly(emitter);
    }

    private void failEmitter(SseEmitter emitter, String model, Exception exception) {
        logger.error("Chat stream failed for model {}", model, exception);
        try {
            emitter.completeWithError(exception);
        } catch (IllegalStateException ignored) {
            logger.warn("Attempted to fail an already completed emitter for model {}", model);
        }
    }

    private void completeQuietly(SseEmitter emitter) {
        try {
            emitter.complete();
        } catch (IllegalStateException ignored) {
            logger.debug("Emitter was already completed.");
        }
    }

    @PreDestroy
    public void shutdownExecutor() {
        logger.info("Shutting down SSE executor service...");
        sseExecutor.shutdown();
        try {
            if (!sseExecutor.awaitTermination(60, java.util.concurrent.TimeUnit.SECONDS)) {
                sseExecutor.shutdownNow();
                if (!sseExecutor.awaitTermination(60, java.util.concurrent.TimeUnit.SECONDS)) {
                    logger.error("SSE executor service did not terminate");
                }
            }
        } catch (InterruptedException ie) {
            sseExecutor.shutdownNow();
            Thread.currentThread().interrupt();
        }
        logger.info("SSE executor service shut down.");
    }
}
