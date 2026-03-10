import { create } from 'zustand';

// Define the backend WebSocket URL
const WEBSOCKET_URL = 'ws://localhost:8080/transcribe';

// Define the structure for entities for frontend use
interface EntityInfo {
  text: string;
  type: string;
  confidence: number;
  startWord: number;
  endWord: number;
}

type TranscriptionState = {
  isRecording: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  transcript: Array<{ text: string; speaker?: number; speakerName?: string }>;
  _currentUtterance: { text: string; speaker?: number; speakerName?: string };
  summary: string;
  topics: string[];
  entities: EntityInfo[];
  socket: WebSocket | null;
  mediaRecorder: MediaRecorder | null;
  audioStream: MediaStream | null;
  statusMessage: string;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  getFormattedTranscript: () => string;
};

export const useTranscriptionStore = create<TranscriptionState>((set, get) => ({
  isRecording: false,
  isConnecting: false,
  isConnected: false,
  transcript: [],
  _currentUtterance: { text: '' },
  summary: '',
  topics: [],
  entities: [],
  socket: null,
  mediaRecorder: null,
  audioStream: null,
  statusMessage: 'Idle',

  // --- WebSocket Actions ---
  connectWebSocket: () => {
    if (get().socket || get().isConnecting) {
      return;
    }

    set({
      isConnecting: true,
      statusMessage: 'Connecting to server...',
      _currentUtterance: { text: '' },
      isConnected: false,
    });

    let ws: WebSocket;
    try {
      ws = new WebSocket(WEBSOCKET_URL);
      ws.binaryType = 'arraybuffer';
    } catch (error) {
      set({
        isConnecting: false,
        statusMessage: `Error creating WebSocket: ${error instanceof Error ? error.message : String(error)}`,
        isConnected: false,
        socket: null
      });
      return;
    }

    ws.onopen = () => {
      set({
        isConnected: true,
        isConnecting: false,
        socket: ws,
        statusMessage: 'Connected. Ready to record.'
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);



        // --- Handle Transcript Messages (with Diarization + Name) ---
        if (data.type === 'transcript') {
          const text = data.text || '';
          const isFinal = data.finalResult || false; // Use correct field name from backend DTO
          const speaker = typeof data.speaker === 'number' ? data.speaker : undefined;
          const speakerName = data.speakerName || undefined; // Get the speaker name

          if (text.trim().length > 0) { // Only process if there is text
            if (isFinal) {
              set((prevState) => ({
                transcript: [...prevState.transcript, { text: text + ' ', speaker, speakerName }],
                _currentUtterance: { text: '' } // Clear the partial utterance tracker
              }));
            } else {
              set({ _currentUtterance: { text: text, speaker, speakerName } });
            }
          } else if (isFinal) {
            set({ _currentUtterance: { text: '' } }); // Clear utterance tracker
          }
        }
        // --- Handle Summary Messages ---
        else if (data.type === 'summary') {
          set({ summary: data.summary || '' });
        }
        // --- Handle Topics Messages ---
        else if (data.type === 'topics') {
          set({ topics: data.topics || [] });
        }
        // --- Handle Entities Messages ---
        else if (data.type === 'entities') {
          const receivedEntities = data.entities || [];
          const validEntities: EntityInfo[] = receivedEntities.map((entity: any) => ({
            text: entity.text || '',
            type: entity.type || 'UNKNOWN', // Use 'type' matching our interface
            confidence: entity.confidence || 0,
            startWord: entity.startWord || 0,
            endWord: entity.endWord || 0
          }));
          set({ entities: validEntities });
        }
        // --- Handle Language Messages (Optional) ---
        else if (data.type === 'language') {
        }
        // --- Handle Sentiment Messages (Optional) ---
        else if (data.type === 'sentiment') {
        }
        // --- Handle Error Messages ---
        else if (data.type === 'error') {
          set({ statusMessage: `Server Error: ${data.message}` });
        }
      } catch {
        set({ statusMessage: 'Error processing server message.' });
      }
    };

    ws.onerror = (error) => {
      set({
        isConnected: false,
        isConnecting: false,
        socket: null,
        statusMessage: 'WebSocket connection error.',
        isRecording: false,
        _currentUtterance: { text: '' }, // Reset partial on error
        summary: '', // Reset on error
        topics: [],  // Reset on error
        entities: [], // Reset on error
      });
      get().stopRecording();
    };

    ws.onclose = (_event) => {
      const wasConnected = get().isConnected;
      const wasConnecting = get().isConnecting;

      set({
        isConnected: false,
        isConnecting: false,
        socket: null,
        statusMessage: (wasConnected && !wasConnecting) ? 'Disconnected from server.' : get().statusMessage,
        isRecording: false,
        _currentUtterance: { text: '' }, // Reset partial on close
        // Keep summary/topics/entities on normal close
      });
      get().stopRecording();
    };
  },

  disconnectWebSocket: () => {
    const { socket, stopRecording } = get();
    stopRecording();
    if (socket) {
      socket.close();
      set({ socket: null, isConnected: false, statusMessage: 'Disconnected.' });
    }
  },

  startRecording: async () => {
    if (get().isRecording || !get().isConnected || !get().socket) {
      set({ statusMessage: 'Error: Not connected to server.' });
      return;
    }
    set({
      statusMessage: 'Initializing audio...',
      transcript: [],
      _currentUtterance: { text: '' },
      summary: '',
      topics: [],
      entities: []
    });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      set({ audioStream: stream, statusMessage: 'Microphone access granted.' });
    } catch (err) {
      set({ statusMessage: `Microphone Error: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      set({ mediaRecorder: recorder });

      recorder.ondataavailable = (event) => {
        const ws = get().socket;
        if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };

      recorder.onstart = () => {
        set({ isRecording: true, statusMessage: 'Recording...' });
      };

      recorder.onstop = () => {
        get().audioStream?.getTracks().forEach(track => track.stop());
        set({
          isRecording: false,
          audioStream: null,
          mediaRecorder: null,
          statusMessage: get().isConnected ? 'Recording stopped.' : get().statusMessage
        });
        if (get().socket && get().isConnected) {
          get().socket?.send(JSON.stringify({ eof: 1 }));
        }
      };

      recorder.onerror = (_event) => {
        set({ statusMessage: 'Audio recording error.', isRecording: false });
        get().stopRecording();
      }

      recorder.start(1000);

    } catch (error) {
      set({ statusMessage: `Recorder Setup Error: ${error instanceof Error ? error.message : String(error)}` });
      stream.getTracks().forEach(track => track.stop());
      set({ audioStream: null });
    }
  },

  stopRecording: () => {
    const { mediaRecorder, isRecording } = get();
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    } else {
      get().audioStream?.getTracks().forEach(track => track.stop());
      set({ audioStream: null, mediaRecorder: null });
    }
  },

  getFormattedTranscript: () => {
    const { transcript } = get();
    if (transcript.length === 0) return '';
    return transcript.map(t => {
      const speakerLabel = t.speakerName ? `${t.speakerName}` : (t.speaker !== undefined ? `Speaker ${t.speaker}` : 'Unknown');
      return `[${speakerLabel}]: ${t.text}`;
    }).join('\n');
  }
}));