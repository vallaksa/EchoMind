package com.example.backend.speech;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * A mock implementation of speech recognition for testing purposes.
 * This class simulates the behavior of a speech recognizer for testing
 * without requiring external API calls to Deepgram.
 */
@Component
public class MockSpeechRecognizer {

    private static final Logger log = LoggerFactory.getLogger(MockSpeechRecognizer.class);

    public MockSpeechRecognizer() {
        log.info("MockSpeechRecognizer initialized");
    }

    /**
     * Process audio data and return a mock transcription result.
     *
     * @param audioData The audio data to process
     * @param length The length of the audio data
     * @return A JSON string containing the mock transcription result
     */
    public String processAudio(byte[] audioData, int length) {
        // Simulate processing time
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // Return a mock result
        return "{\"text\":\"this is a mock transcription\"}";
    }

    /**
     * Get a final result for the current session.
     *
     * @return A JSON string containing the mock final result
     */
    public String getFinalResult() {
        return "{\"text\":\"this is the final mock transcription\"}";
    }

    /**
     * Get a partial result for the current session.
     *
     * @return A JSON string containing the mock partial result
     */
    public String getPartialResult() {
        return "{\"partial\":\"this is a partial mock transcription\"}";
    }

    /**
     * Reset the recognizer state.
     */
    public void reset() {
        log.info("MockSpeechRecognizer reset");
    }

    /**
     * Close the recognizer and release resources.
     */
    public void close() {
        log.info("MockSpeechRecognizer closed");
    }
}
