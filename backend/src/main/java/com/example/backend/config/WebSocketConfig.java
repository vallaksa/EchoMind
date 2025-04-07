package com.example.backend.config;

import com.example.backend.handler.TranscriptionHandler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    // Audio sample rate for Deepgram (16kHz)
    private static final float SAMPLE_RATE = 16000.0f;

    // Inject the TranscriptionHandler
    @Autowired
    private TranscriptionHandler transcriptionHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        System.out.println("Registering WebSocket handler for /transcribe");
        // Register the autowired handler instance
        registry.addHandler(transcriptionHandler, "/transcribe")
                .setAllowedOrigins("*"); // Allow all origins for simplicity (consider restricting in production)
    }

    // Configure WebSocket message buffer sizes
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        // Increase buffer sizes (e.g., to 1MB) to handle larger audio chunks
        container.setMaxBinaryMessageBufferSize(1024 * 1024); // 1MB
        container.setMaxTextMessageBufferSize(1024 * 1024);   // 1MB (though less critical for audio)
        return container;
    }
}