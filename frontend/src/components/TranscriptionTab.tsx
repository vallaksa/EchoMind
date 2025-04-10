import * as React from 'react';
import { useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';

import { useTranscriptionStore } from '../store/transcriptionStore';

// Define structure for formatted lines
interface FormattedLine {
    speaker?: number;
    lineText: string;
}

// --- Helper Functions (Moved Outside Component) ---
const formatSpeaker = (speakerIndex?: number, speakerName?: string): string => {
    const prefix = typeof speakerIndex === 'number' ? `Speaker ${speakerIndex}` : 'Unknown Speaker';
    const namePart = speakerName ? ` (${speakerName})` : '';
    return `${prefix}${namePart}: `;
};

const renderStatusIcon = (isConnecting: boolean, isConnected: boolean) => {
  if (isConnecting) return <CircularProgress size={18} sx={{ mr: 1 }} />;
  if (isConnected) return <WifiIcon color="success" sx={{ mr: 1 }} />;
  return <WifiOffIcon color="error" sx={{ mr: 1 }} />;
};

const TranscriptionTab: React.FC = () => {
  const {
    isRecording,
    isConnected,
    isConnecting,
    transcript,
    _currentUtterance: currentUtterance,
    statusMessage,
    connectWebSocket,
    disconnectWebSocket,
    startRecording,
    stopRecording,
  } = useTranscriptionStore();

  const transcriptContentRef = useRef<null | HTMLDivElement>(null);
  const transcriptEndRef = useRef<null | HTMLDivElement>(null);

  // --- Transcript Formatting Logic ---
  const formattedLines = React.useMemo(() => {
    const lines: FormattedLine[] = [];
    if (!transcript || transcript.length === 0) {
        return lines;
    }

    let currentLine: FormattedLine | null = null;

    for (const segment of transcript) {
        // Start a new line if:
        // 1. It's the first segment
        // 2. The speaker is different from the current line's speaker
        if (!currentLine || segment.speaker !== currentLine.speaker) {
            currentLine = { speaker: segment.speaker, lineText: segment.text };
            lines.push(currentLine);
        } else {
            // Append text to the existing line for the same speaker
            currentLine.lineText += segment.text;
        }
    }
    return lines;
  }, [transcript]); // Recompute only when the final transcript changes

  // --- Connection Logic ---
  React.useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine the speaker info of the last formatted line
  const lastFinalSpeaker = formattedLines.length > 0 ? formattedLines[formattedLines.length - 1].speaker : undefined;

  // --- Auto-scroll Logic for Transcript ---
  React.useEffect(() => {
      const container = transcriptContentRef.current;
      if (container) {
          const scrollThreshold = 150; // Distance from bottom
          const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < scrollThreshold;

          if (isNearBottom) {
              transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }
      }
  // Scroll when final lines change OR when partial utterance changes
  }, [formattedLines, currentUtterance]);

  const controlsAreaHeight = 90;

  return (
      // Outer Box - Add consistent padding
      <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'relative', 
          p: '1.5rem' // Add overall padding
      }}>
        {/* Status Indicator Area (No extra padding needed) */}
        <Box sx={{ 
            // p: '1rem 1.5rem 0', // REMOVE padding
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: '40px',
            mb: 2,
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}> {/* Inner box for content */}
                {renderStatusIcon(isConnecting, isConnected)}
                <Typography variant="caption" color="text.secondary">
                    {statusMessage}
                </Typography>
            </Box>
        </Box>

        {/* Main Content Area (Grows, Handles Internal Layout, no padding here) */}
        <Box sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column', // Changed back to column
            width: '100%',
            overflow: 'hidden',
            // p: '0 1.5rem', // REMOVE padding
            pb: `${controlsAreaHeight + 16}px`, // Keep padding for controls
        }}>
             {/* Transcript Section (Scrolls) */}
            <Box
                ref={transcriptContentRef}
                sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    // p: '0.5rem 0', // REMOVE inner padding
                    display: 'flex',
                    flexDirection: 'column',
                    '&::-webkit-scrollbar': { width: '6px' },
                    '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: '#CBD5E1', borderRadius: '8px' },
                    pb: '1rem' // Keep padding at bottom of scroll area
                }}
            >
                {/* Placeholder at the top if empty */}
                {formattedLines.length === 0 && !currentUtterance.text && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, minHeight: '100px' }}>
                        <Typography
                            variant="h6"
                            component="p"
                            sx={{ fontStyle: 'italic', fontWeight: 400, color: '#9CA3AF', textAlign: 'center' }}
                        >
                            Listening for audio...<br />transcribing thoughts in real time.
                        </Typography>
                    </Box>
                )}

                {/* Render formatted final lines */}
                {formattedLines.map((line, index) => (
                    <Typography key={`line-${index}`} variant="body1" component="p" style={{ whiteSpace: 'pre-wrap', marginBottom: '0.5em' }}>
                        <Typography component="span" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {formatSpeaker(line.speaker, transcript.find(seg => seg.speaker === line.speaker)?.speakerName)}
                        </Typography>
                        {line.lineText}
                    </Typography>
                ))}

                {/* Render current partial utterance */}
                {currentUtterance.text && (
                    <Typography variant="body1" component="span" style={{ whiteSpace: 'pre-wrap', opacity: 0.7 }}>
                        {(currentUtterance.speaker !== lastFinalSpeaker || formattedLines.length === 0) && (
                            <Typography component="span" sx={{ fontWeight: 'bold', color: 'primary.light' }}>
                                {formatSpeaker(currentUtterance.speaker, currentUtterance.speakerName)}
                            </Typography>
                        )}
                        {currentUtterance.text}
                    </Typography>
                )}

                {/* Anchor div for scrolling */}
                <div ref={transcriptEndRef} />
            </Box>
            
        </Box>

        {/* Transcription Controls - Absolute position relative to outer Box */}
        <Box
            sx={{
                position: 'absolute',
                bottom: 0,
                // Adjust left/right to account for parent padding
                left: '1.5rem',
                right: '1.5rem',
                zIndex: 1
            }}
        >
             <TranscriptionControls
                isRecording={isRecording}
                isConnected={isConnected}
                isConnecting={isConnecting}
                startRecording={startRecording}
                stopRecording={stopRecording}
            /> 
        </Box>
      </Box>
    );
};

// --- Extracted TranscriptionControls Component (Modified) ---
interface TranscriptionControlsProps {
    isRecording: boolean;
    isConnected: boolean;
    isConnecting: boolean;
    startRecording: () => void;
    stopRecording: () => void;
}

export const TranscriptionControls: React.FC<TranscriptionControlsProps> = ({
    isRecording,
    isConnected,
    isConnecting,
    startRecording,
    stopRecording
}) => {

    return (
        // Adjusted padding, removed status message Box
        <Box sx={{ p: '1rem 1.5rem' /* Adjusted padding */, borderTop: '1px solid #e5e7eb' }}>
            {/* Controls Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={startRecording}
                    disabled={isRecording || !isConnected || isConnecting}
                    startIcon={<CheckCircleIcon />}
                >
                    Start Recording
                </Button>
                <Button
                    variant="outlined"
                    color="error"
                    onClick={stopRecording}
                    disabled={!isRecording}
                    startIcon={<ErrorIcon />}
                >
                    Stop Recording
                </Button>
            </Box>
        </Box>
    );
};

export default TranscriptionTab;