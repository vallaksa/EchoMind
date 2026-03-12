# EchoMind

A real-time audio transcription and LLM interaction application featuring a React frontend and Spring Boot backend.

## Project Overview

EchoMind captures audio in real-time, transcribes it using Deepgram, and allows users to interact with local Ollama-served Large Language Models (LLMs). The application is designed for seamless user experience with features like persistent UI state and robust handling of streaming data.

### Features

*   **Real-time Transcription:** Live audio transcription via Deepgram.
*   **Speaker Diarization:** Identifies different speakers in the transcript.
*   **LLM Chat:** Conversational interface with the Ollama-compatible models configured on the local machine.
*   **Streaming IO:** Handles streaming audio input (WebSockets) and streaming text output (SSE) efficiently.
*   **Model Selection:** Allows users to select the LLM for chat.
*   **Automatic Reconnection:** Transcription service reconnects automatically after inactivity periods.
*   **Smart Token Spacing:** Corrects potential spacing issues in streamed LLM responses.
*   **Persistent UI:** Remembers the last active tab (Transcription/Chat).
*   **Modern UI:** Built with React and Material UI.
*   **Deferred Transcript Enrichment:** Summary, topic, and sentiment parsing scaffolding exists in the backend, but those Deepgram features are not currently enabled in the live request configuration.

## Architecture

### Frontend (`frontend/`)

*   **Framework:** React (using Vite)
*   **Language:** TypeScript
*   **UI Library:** Material UI (MUI)
*   **State Management:** Zustand (for transcription state)
*   **Communication:** WebSockets (to backend for transcription), Server-Sent Events (SSE from backend for chat)

### Backend (`backend/`)

*   **Framework:** Spring Boot 3
*   **Language:** Java 17
*   **Build Tool:** Maven
*   **WebSocket:** Spring WebSocket (handling frontend audio stream)
*   **SSE:** Spring WebFlux/MVC (streaming LLM responses)
*   **HTTP Client:** OkHttp3 (connecting to Deepgram & Ollama)
*   **External Services:** Deepgram (Transcription), Ollama (LLM Serving)

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   Java Development Kit (JDK) 17 or later
*   Maven 3.x
*   **Deepgram API Key:** Obtain from [Deepgram](https://deepgram.com/).
*   **(Optional) Ollama:** Install and run [Ollama](https://ollama.ai/) locally (usually `http://localhost:11434`). Ensure the configured model names are available on the machine.

### Configuration

1.  **Backend API Key:**
    *   Create or edit the file `backend/src/main/resources/application.properties`.
    *   Add your Deepgram API key:
        ```properties
        deepgram.api.key=YOUR_DEEPGRAM_API_KEY
        ```

### Running the Application

1.  **Start the Backend Service:**
    ```bash
    # Navigate to the backend directory
    cd backend
    # Run using Maven Spring Boot plugin
    mvn spring-boot:run
    ```
    *(Wait for the backend to start, usually on port 8080)*

2.  **Start the Frontend Service:**
    *   Open a **new terminal**.
    ```bash
    # Navigate to the frontend directory
    cd frontend
    # Install dependencies (only needed once)
    npm install 
    # Start the dev server
    npm run dev
    ```

3.  **Access the Application:** Open your browser to the URL provided by the frontend dev server (usually `http://localhost:5173`).

## License

[MIT](LICENSE)
