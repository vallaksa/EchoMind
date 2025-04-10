# EchoMind Frontend

This is the frontend application for EchoMind, a web application designed for real-time audio transcription and interaction with large language models (LLMs).

## Features

*   **Real-time Transcription:** Captures microphone audio and streams it to the backend for live transcription using Deepgram.
*   **LLM Chat:** Engage in conversation with various LLMs (currently supporting Mistral, Llama3, Gemma via Ollama).
*   **Streaming Responses:** Displays LLM responses as they are generated token-by-token.
*   **Model Selection:** Choose the desired LLM for chat interactions.
*   **Responsive UI:** Built with Material UI for a clean and adaptable interface.
*   **Persistent Tabs:** Remembers the last active tab (Transcription or Chat) across page refreshes using Session Storage.
*   **Automatic Reconnection:** Transcription service attempts to automatically reconnect if the connection drops due to inactivity.

## Tech Stack

*   **Framework:** React (using Vite)
*   **Language:** TypeScript
*   **UI Library:** Material UI (MUI)
*   **State Management:** Zustand (for transcription state)
*   **Communication:** WebSockets (for transcription), Server-Sent Events (SSE for chat)

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm (usually comes with Node.js)
*   A running instance of the EchoMind backend service.

### Installation

1.  **Clone the repository** (if you haven't already).
2.  **Navigate to the `frontend` directory:**
    ```bash
    cd path/to/EchoMind/frontend
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```

### Running the Development Server

1.  **Ensure the backend service is running** (usually on `http://localhost:8080`).
2.  **Start the frontend development server:**
    ```bash
    npm run dev
    ```
3.  Open your browser and navigate to the URL provided by Vite (usually `http://localhost:5173`).

### Building for Production

1.  **Build the static assets:**
    ```bash
    npm run build
    ```
2.  The optimized production build will be located in the `dist` directory. Deploy these files to your static file server.

## Key Components

*   **`App.tsx`:** Main application component, handles routing, layout, chat state, and SSE connection.
*   **`components/TranscriptionTab.tsx`:** UI for the transcription feature, interacts with the transcription store.
*   **`components/ChatTab.tsx`:** UI for the LLM chat feature.
*   **`store/transcriptionStore.ts`:** Zustand store managing WebSocket connection, recording state, and transcript data.

## Available Scripts

*   `npm run dev`: Starts the development server with hot module replacement.
*   `npm run build`: Creates a production-ready build.
*   `npm run lint`: Runs ESLint to check for code style issues.
*   `npm run preview`: Serves the production build locally for previewing.
