package com.example.backend.dto;

import org.springframework.util.StringUtils;

public class ChatRequest {
    private String prompt;
    private String model;
    private String context;

    public ChatRequest() {}

    public ChatRequest(String prompt, String model, String context) {
        this.prompt = prompt;
        this.model = model;
        this.context = context;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getContext() {
        return context;
    }

    public void setContext(String context) {
        this.context = context;
    }

    public boolean hasPrompt() {
        return StringUtils.hasText(prompt);
    }
}
