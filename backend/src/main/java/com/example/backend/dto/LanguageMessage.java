package com.example.backend.dto;

public class LanguageMessage extends WebSocketMessage {
    private String code; // e.g., "en-US"

    public LanguageMessage(String code) {
        super("language");
        this.code = code;
    }

    public String getCode() {
        return code;
    }
} 