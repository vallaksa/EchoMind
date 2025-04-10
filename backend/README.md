# EchoMind Backend

This is the backend service for EchoMind, built with Java 17 and Spring Boot 3.

## Features

*   **WebSocket Transcription:** Manages WebSocket connections from the frontend, receives audio streams, and forwards them to Deepgram for real-time transcription.
*   **Deepgram Integration:** Connects to Deepgram's streaming API, handles responses (transcripts, diarization, entities, topics, summaries, sentiment), and forwards structured messages back to the frontend.
*   **Automatic Reconnection:** Attempts to automatically re-establish the connection to Deepgram if it drops due to inactivity, ensuring transcription resumes seamlessly after pauses.
*   **LLM Chat Streaming:** Provides an SSE (Server-Sent Events) endpoint (`/api/chat/stream`) that takes a prompt and streams responses from an Ollama-compatible LLM (e.g., Mistral, Llama3, Gemma).
*   **Smart Token Spacing:** Intelligently adds spaces between streamed LLM tokens to prevent words from being glued together.
*   **CORS Configuration:** Allows requests from any origin (configurable).

## Tech Stack

*   **Framework:** Spring Boot 3
*   **Language:** Java 17
*   **Build Tool:** Maven
*   **WebSocket:** Spring WebSocket
*   **HTTP Client:** OkHttp3 (for Deepgram & Ollama)
*   **JSON Processing:** Jackson (Spring default), org.json
*   **Logging:** SLF4J + Logback (Spring default)

## Getting Started

### Prerequisites

*   Java Development Kit (JDK) 17 or later
*   Maven 3.x
*   **Deepgram API Key:** You need an API key from [Deepgram](https://deepgram.com/).
*   **(Optional) Ollama:** To use the LLM chat feature, you need a running instance of [Ollama](https://ollama.ai/) accessible from the backend (default URL assumes `http://localhost:11434`). Ensure you have pulled the desired models (e.g., `ollama pull mistral`).

### Configuration

1.  **API Keys:** Create or edit the file `src/main/resources/application.properties`.
2.  Add your Deepgram API key:
    ```properties
    deepgram.api.key=YOUR_DEEPGRAM_API_KEY
    ```
3.  (Optional) If your Ollama instance is running elsewhere, configure its URL (this requires modifying `OllamaStreamService.java` currently, could be moved to properties later).

### Running the Application

1.  **Navigate to the `backend` directory:**
    ```bash
    cd path/to/EchoMind/backend
    ```
2.  **Build the application using Maven:**
    ```bash
    mvn clean package
    ```
3.  **Run the application:**
    ```bash
    mvn spring-boot:run
    # OR run the generated JAR file:
    # java -jar target/backend-0.0.1-SNAPSHOT.jar 
    ```
4.  The backend service will start, typically on `http://localhost:8080`.

## Key Components

*   **`BackendApplication.java`:** Main Spring Boot application class.
*   **`config/`:** Contains configuration classes for WebSockets (`WebSocketConfig`) and CORS/OkHttp (`AppConfig`).
*   **`controller/ChatController.java`:** Handles HTTP requests for chat streaming via SSE.
*   **`dto/`:** Data Transfer Objects used for WebSocket messages and potentially other API responses.
*   **`handler/TranscriptionHandler.java`:** Manages the lifecycle of frontend WebSocket connections for transcription.
*   **`service/DeepgramStreamingService.java`:** Handles the interaction with the Deepgram streaming API.
*   **`service/OllamaStreamService.java`:** Handles the interaction with the Ollama API for chat streaming.

## API Endpoints

*   **WebSocket:** `ws://localhost:8080/transcribe` (Handles audio streaming from frontend)
*   **SSE:** `GET http://localhost:8080/api/chat/stream?prompt={YourPrompt}&model={OptionalModelName}` (Streams LLM chat responses) 