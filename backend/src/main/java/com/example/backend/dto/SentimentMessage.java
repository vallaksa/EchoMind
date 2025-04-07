package com.example.backend.dto;

// Represents overall sentiment score
public class SentimentMessage extends WebSocketMessage {
    private double average; // Overall sentiment average
    // Could add positive, negative, neutral breakdown if needed

    public SentimentMessage(double average) {
        super("sentiment");
        this.average = average;
    }

    public double getAverage() {
        return average;
    }
} 