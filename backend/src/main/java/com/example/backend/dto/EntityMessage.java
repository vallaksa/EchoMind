package com.example.backend.dto;

import java.util.List;

// Represents detected named entities
public class EntityMessage extends WebSocketMessage {
    private List<EntityInfo> entities;

    // Inner class to hold info for a single entity
    public static class EntityInfo {
        private String text;
        private String type;
        private double confidence;
        private double startWord;
        private double endWord;

        // No-arg constructor for Jackson
        public EntityInfo() {}

        // Getters and setters
        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public double getConfidence() { return confidence; }
        public void setConfidence(double confidence) { this.confidence = confidence; }
        public double getStartWord() { return startWord; }
        public void setStartWord(double startWord) { this.startWord = startWord; }
        public double getEndWord() { return endWord; }
        public void setEndWord(double endWord) { this.endWord = endWord; }
    }

    // No-arg constructor for Jackson
    public EntityMessage() {
        super("entities");
    }

    public EntityMessage(List<EntityInfo> entities) {
        super("entities");
        this.entities = entities;
    }

    // Getters and setters
    public List<EntityInfo> getEntities() { return entities; }
    public void setEntities(List<EntityInfo> entities) { this.entities = entities; }
} 