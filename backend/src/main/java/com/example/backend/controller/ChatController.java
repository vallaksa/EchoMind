package com.example.backend.controller; // Assuming this package structure

import com.example.backend.service.OllamaStreamService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import com.example.backend.dto.ChatRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer; // Added missing import
import jakarta.annotation.PreDestroy; // Import PreDestroy

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);
    private final OllamaStreamService ollamaStreamService;
    // Use a dedicated thread pool for SSE tasks
    private final ExecutorService sseExecutor = Executors.newCachedThreadPool(); // Or newFixedThreadPool(N)

    @Autowired
    public ChatController(OllamaStreamService ollamaStreamService) {
        this.ollamaStreamService = ollamaStreamService;
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestBody ChatRequest request) {
                
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        String prompt = request.getPrompt();
        String model = request.getModel();
        String context = request.getContext();

        logger.info("SSE POST connection established for prompt: '{}', model: '{}'", prompt, model == null ? "(default)" : model);

        // Define callbacks for the service
        Consumer<String> onChunkReceived = chunk -> {
            try {
                // Send data chunk as an SSE event
                emitter.send(SseEmitter.event().data(chunk));
            } catch (IOException e) {
                logger.warn("Failed to send chunk to SSE client: {}", e.getMessage());
                // The emitter might already be completed/broken, IOException is expected here sometimes
                // Consider removing the emitter from any tracking list if applicable
            } catch (IllegalStateException e) {
                 logger.warn("Attempted to send chunk to already completed SSE emitter: {}", e.getMessage());
            }
        };

        Runnable onComplete = () -> {
            logger.info("Ollama stream completed for model {}. Completing SSE emitter.", model == null ? "(default)" : model);
            emitter.complete();
        };

        Consumer<Exception> onError = exception -> {
            logger.error("Error during Ollama streaming for model {}. Completing SSE emitter with error.", model == null ? "(default)" : model, exception);
            emitter.completeWithError(exception);
        };

        // Use the executor service to run the Ollama interaction asynchronously
        sseExecutor.execute(() -> {
            try {
                ollamaStreamService.streamChat(prompt, model, context, onChunkReceived, onComplete, onError);
            } catch (Exception e) {
                // Catch any unexpected exception from the service call itself
                 logger.error("Unexpected error invoking OllamaStreamService for model {}", model == null ? "(default)" : model, e);
                 emitter.completeWithError(e);
            }
        });


        // Handle emitter completion/timeout/error explicitly
         emitter.onCompletion(() -> logger.info("SSE Emitter is completed."));
         emitter.onTimeout(() -> {
            logger.warn("SSE Emitter timed out.");
            emitter.complete(); // Ensure completion on timeout
         });
        emitter.onError(ex -> logger.error("SSE Emitter error occurred: {}", ex.getMessage()));


        logger.info("Returning SseEmitter to client.");
        return emitter;
    }

    // Gracefully shut down the executor service on application exit
    @PreDestroy
    public void shutdownExecutor() {
        logger.info("Shutting down SSE executor service...");
        sseExecutor.shutdown();
        try {
            // Wait a while for existing tasks to terminate
            if (!sseExecutor.awaitTermination(60, java.util.concurrent.TimeUnit.SECONDS)) {
                sseExecutor.shutdownNow(); // Cancel currently executing tasks
                // Wait a while for tasks to respond to being cancelled
                if (!sseExecutor.awaitTermination(60, java.util.concurrent.TimeUnit.SECONDS))
                    logger.error("SSE executor service did not terminate");
            }
        } catch (InterruptedException ie) {
            // (Re-)Cancel if current thread also interrupted
            sseExecutor.shutdownNow();
            // Preserve interrupt status
            Thread.currentThread().interrupt();
        }
        logger.info("SSE executor service shut down.");
    }
} 