# EchoMind

A real-time speech transcription and AI assistant application with a React frontend and Spring Boot backend.

## Project Overview

This application provides real-time speech transcription capabilities using Deepgram's API. It features a modern React frontend with Material UI components and a robust Spring Boot backend that handles WebSocket connections for streaming audio data.

### Features

- Real-time speech transcription
- Speaker diarization (identifying different speakers)
- Entity recognition
- Sentiment analysis
- Topic extraction
- Placeholder for future AI chat capabilities

## Architecture

### Frontend

- React 19 with TypeScript
- Vite as the build tool
- Material UI for components
- Zustand for state management
- WebSocket for real-time communication

### Backend

- Java 17
- Spring Boot 3.2.5
- Spring WebSocket for real-time communication
- Integration with Deepgram API for speech recognition

## Getting Started

### Prerequisites

- Node.js (v18+)
- Java 17
- Maven

### Running the Backend

```bash
cd backend
mvn spring-boot:run
```

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

## Future Development

The application is designed with extensibility in mind, with plans to integrate LLM capabilities for AI-powered chat functionality. The ChatTab component is currently a placeholder for this future implementation.

## Configuration

### API Key Security

The Deepgram API key is configured using environment variables for security. Before running the application, you need to set up your API key:

#### Option 1: Environment Variable

Set the `DEEPGRAM_API_KEY` environment variable:

```bash
# Linux/macOS
export DEEPGRAM_API_KEY=your_api_key_here

# Windows Command Prompt
set DEEPGRAM_API_KEY=your_api_key_here

# Windows PowerShell
$env:DEEPGRAM_API_KEY="your_api_key_here"
```

#### Option 2: Local Development Configuration

For local development only, you can create a copy of the template file:

1. Copy `backend/src/main/resources/application.properties.template` to `backend/src/main/resources/application.properties`
2. Add your Deepgram API key to the new file


## License

[MIT](LICENSE)
