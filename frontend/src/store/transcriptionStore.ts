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
    if (get().socket || get().isConnecting) return;

    console.log(`Attempting to connect to WebSocket: ${WEBSOCKET_URL}`);
    // Reset state on new connection attempt
    set({
      isConnecting: true,
      statusMessage: 'Connecting to server...',
      transcript: [],
      _currentUtterance: { text: '' },
      summary: '',
      topics: [],
      entities: [],
    });

    const ws = new WebSocket(WEBSOCKET_URL);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('WebSocket connected.');
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
        console.log('[DEBUG] WebSocket message received:', JSON.stringify(data)); // Log raw data

        const currentTranscriptSegments = get().transcript;
        let currentUtterance = get()._currentUtterance;

        // --- Handle Transcript Messages (with Diarization + Name) ---
        if (data.type === 'transcript') {
          const text = data.text || '';
          const isFinal = data.finalResult || false; // Use correct field name from backend DTO
          const speaker = typeof data.speaker === 'number' ? data.speaker : undefined;
          const speakerName = data.speakerName || undefined; // Get the speaker name

          console.log(`[DEBUG] Transcript: isFinal=${isFinal}, speaker=${speaker}, name=${speakerName}, text="${text}"`);

          if (text.trim().length > 0) { // Only process if there is text
            if (isFinal) {
              console.log('[DEBUG] Processing as FINAL transcript segment.');
              set((prevState) => ({
                  transcript: [...prevState.transcript, { text: text + ' ', speaker, speakerName }],
                  _currentUtterance: { text: '' } // Clear the partial utterance tracker
              }));
            } else {
              console.log('[DEBUG] Processing as PARTIAL transcript segment.');
              set({ _currentUtterance: { text: text, speaker, speakerName } });
            }
          } else if (isFinal) {
            console.log('[DEBUG] Received empty FINAL transcript segment, clearing utterance.');
            set({ _currentUtterance: { text: '' } }); // Clear utterance tracker
          } else {
            console.log('[DEBUG] Received empty partial transcript segment, ignoring.');
          }
        }
        // --- Handle Summary Messages ---
        else if (data.type === 'summary') {
          console.log('[DEBUG] Received Summary:', data.summary);
          set({ summary: data.summary || '' });
        }
        // --- Handle Topics Messages ---
        else if (data.type === 'topics') {
          console.log('[DEBUG] Received Topics:', data.topics);
          set({ topics: data.topics || [] });
        }
        // --- Handle Entities Messages ---
        else if (data.type === 'entities') {
           console.log('[DEBUG] Received Entities:', data.entities);
           // Ensure the received data matches the EntityInfo interface structure
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
            console.log('[DEBUG] Received Language:', data.languageCode);
        }
        // --- Handle Sentiment Messages (Optional) ---
         else if (data.type === 'sentiment') {
            console.log('[DEBUG] Received Sentiment Score:', data.averageScore);
        }
        // --- Handle Error Messages ---
        else if (data.type === 'error') {
          console.error('WebSocket server error:', data.message);
          set({ statusMessage: `Server Error: ${data.message}` });
        } else {
          console.warn('[DEBUG] Received unhandled or unexpected message format:', data);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error, 'Raw data:', event.data);
        set({ statusMessage: 'Error processing server message.' });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
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

    ws.onclose = (event) => {
      console.log(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
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
      console.log('Disconnecting WebSocket...');
      socket.close();
      set({ socket: null, isConnected: false, statusMessage: 'Disconnected.' });
    }
  },

  startRecording: async () => {
     if (get().isRecording || !get().isConnected || !get().socket) {
      console.warn('Cannot start recording. Not connected or already recording.');
      set({ statusMessage: 'Error: Not connected to server.'});
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      set({ audioStream: stream, statusMessage: 'Microphone access granted.'});

      const recorder = new MediaRecorder(stream, {
         mimeType: 'audio/webm;codecs=opus'
      });
      set({ mediaRecorder: recorder });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && get().socket && get().isConnected) {
          get().socket?.send(event.data);
        }
      };

      recorder.onstart = () => {
         console.log('MediaRecorder started.');
         set({ isRecording: true, statusMessage: 'Recording...' });
      };

      recorder.onstop = () => {
        console.log('MediaRecorder stopped.');
        get().audioStream?.getTracks().forEach(track => track.stop());
        set({
          isRecording: false,
          audioStream: null,
          mediaRecorder: null,
          statusMessage: get().isConnected ? 'Recording stopped.' : get().statusMessage
         });
        if (get().socket && get().isConnected) {
            console.log('Sending EOF signal.');
            get().socket?.send(JSON.stringify({ eof: 1 }));
        }
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        set({ statusMessage: 'Audio recording error.', isRecording: false });
        get().stopRecording();
      }

      recorder.start(1000);

    } catch (error) {
      console.error('Error starting recording:', error);
       if ((error as Error).name === 'NotAllowedError' || (error as Error).name === 'PermissionDeniedError') {
         set({ statusMessage: 'Microphone permission denied.'});
       } else {
          set({ statusMessage: 'Failed to start microphone.' });
       }
      set({ isRecording: false, audioStream: null, mediaRecorder: null });
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
}));