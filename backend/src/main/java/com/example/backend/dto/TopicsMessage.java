package com.example.backend.dto;

import java.util.List;

public class TopicsMessage extends WebSocketMessage {
    private List<String> topics;

    public TopicsMessage(List<String> topics) {
        super("topics");
        this.topics = topics;
    }

    public List<String> getTopics() {
        return topics;
    }
} 