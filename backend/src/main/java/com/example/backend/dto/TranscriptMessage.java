package com.example.backend.dto;

// Represents a single transcript segment (partial or final)
public class TranscriptMessage extends WebSocketMessage {
    private String text;
    private boolean finalResult; // Using finalResult for clarity vs 'final' keyword
    private Integer speaker; // Optional: Speaker index from diarization
    private String speakerName; // Optional: Discovered speaker name

    // No-arg constructor for Jackson
    public TranscriptMessage() {
        super("transcript");
    }

    // Constructor for backend internal use during parsing
    public TranscriptMessage(String text, boolean finalResult, Integer speaker, String speakerName) {
        super("transcript");
        this.text = text;
        this.finalResult = finalResult;
        this.speaker = speaker;
        this.speakerName = speakerName;
    }
    
    // Simplified constructors might not be needed if only the full one is used internally
    // public TranscriptMessage(String text, boolean finalResult, Integer speaker) { ... }
    // public TranscriptMessage(String text, boolean finalResult) { ... }
    

    // Getters and setters (required by Jackson for serialization)
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public boolean isFinalResult() { return finalResult; }
    public void setFinalResult(boolean finalResult) { this.finalResult = finalResult; }
    public Integer getSpeaker() { return speaker; } 
    public void setSpeaker(Integer speaker) { this.speaker = speaker; } 
    public String getSpeakerName() { return speakerName; } // Getter for speakerName
    public void setSpeakerName(String speakerName) { this.speakerName = speakerName; } // Setter for speakerName
} 