package com.example.backend.dto;

public class SummaryMessage extends WebSocketMessage {
    private String text;

    public SummaryMessage(String text) {
        super("summary");
        this.text = text;
    }

    public String getText() {
        return text;
    }
} 