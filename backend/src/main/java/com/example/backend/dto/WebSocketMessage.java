package com.example.backend.dto;

// Base class for structured messages sent to the frontend
public abstract class WebSocketMessage {
    private final String type;

    protected WebSocketMessage(String type) {
        this.type = type;
    }

    public String getType() {
        return type;
    }
} 