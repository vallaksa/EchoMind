package com.example.backend.dto;

// For sending general errors/status back to frontend
public class ErrorMessage extends WebSocketMessage {
    private String message;

    public ErrorMessage(String message) {
        super("error");
        this.message = message;
    }

    public String getMessage() {
        return message;
    }
} 