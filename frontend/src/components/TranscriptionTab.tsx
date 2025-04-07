import * as React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  LinearProgress,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SpeakerNotesIcon from '@mui/icons-material/SpeakerNotes';
import TopicIcon from '@mui/icons-material/Topic';
import CategoryIcon from '@mui/icons-material/Category';
import SummarizeIcon from '@mui/icons-material/Summarize';

import { useTranscriptionStore } from '../store/transcriptionStore';

// Define structure for formatted lines
interface FormattedLine {
    speaker?: number;
    lineText: string;
}

const TranscriptionTab: React.FC = () => {
  const {
    isRecording,
    isConnected,
    isConnecting,
    transcript,
    _currentUtterance,
    summary,
    topics,
    entities,
    statusMessage,
    connectWebSocket,
    disconnectWebSocket,
    startRecording,
    stopRecording,
  } = useTranscriptionStore();

  const transcriptEndRef = useRef<null | HTMLDivElement>(null);

  // --- Transcript Formatting Logic ---
  const formattedLines = useMemo(() => {
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

  // --- Auto-scroll Logic ---
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [formattedLines, _currentUtterance]); // Scroll when formatted lines or partial utterance changes

  // --- Connection Logic ---
  useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Helper Functions ---
  const formatSpeaker = (speakerIndex?: number, speakerName?: string): string => {
      const prefix = typeof speakerIndex === 'number' ? `Speaker ${speakerIndex}` : 'Unknown Speaker';
      const namePart = speakerName ? ` (${speakerName})` : '';
      return `${prefix}${namePart}: `;
  };

  // Determine the speaker info of the last formatted line
  const lastFinalSpeaker = formattedLines.length > 0 ? formattedLines[formattedLines.length - 1].speaker : undefined;

  return (
    <Box>
      {/* Header and Connection Status */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Real-time Transcription & Analysis</Typography>
        <Chip
          icon={isConnected ? <WifiIcon /> : <WifiOffIcon />}
          label={isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          color={isConnected ? 'success' : isConnecting ? 'warning' : 'error'}
          variant="outlined"
        />
      </Box>

      <Grid container spacing={3}>
        {/* Left Column: Transcript */}
        <Grid item xs={12} md={7}>
          <Typography variant="h6" gutterBottom>
            <SpeakerNotesIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> Transcript
          </Typography>
          <Paper elevation={3} sx={{ p: 2, mb: 2, height: '60vh', overflowY: 'auto' }}>
             {/* Render formatted final lines */}
             {formattedLines.map((line, index) => (
                 <Typography key={`line-${index}`} variant="body1" component="p" style={{ whiteSpace: 'pre-wrap', marginBottom: '0.5em' }}>
                     <Typography component="span" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                         {/* Pass name from the original transcript segment used to build this line */}
                         {/* NOTE: This assumes the name doesn't change mid-line, which is usually safe */}
                         {formatSpeaker(line.speaker, transcript.find(seg => seg.speaker === line.speaker)?.speakerName)}
                     </Typography>
                     {line.lineText}
                 </Typography>
             ))}

            {/* Render current partial utterance, considering the last speaker */}
            {_currentUtterance.text && (
                <Typography variant="body1" component="span" style={{ whiteSpace: 'pre-wrap', opacity: 0.7 }}>
                     {/* Add speaker tag to partial only if it differs from last final speaker */}
                     {(_currentUtterance.speaker !== lastFinalSpeaker || formattedLines.length === 0) && (
                         <Typography component="span" sx={{ fontWeight: 'bold', color: 'primary.light' }}>
                             {/* Format partial utterance with its potential name */}
                             {formatSpeaker(_currentUtterance.speaker, _currentUtterance.speakerName)}
                         </Typography>
                     )}
                     {_currentUtterance.text}
                </Typography>
            )}

             {/* Show initial message if nothing has been transcribed yet */}
            {formattedLines.length === 0 && !_currentUtterance.text && (
                 <Typography variant="body1" color="textSecondary">
                    {isConnected ? 'Ready to transcribe...' : 'Waiting for connection...'}
                 </Typography>
            )}
            <div ref={transcriptEndRef} /> {/* Element to scroll to */}
          </Paper>
        </Grid>

        {/* Right Column: Intelligence Features */}
        <Grid item xs={12} md={5}>
          {/* Summary */}
          {summary && (
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                <SummarizeIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> Summary
              </Typography>
              <Paper elevation={1} sx={{ p: 2, maxHeight: '15vh', overflowY: 'auto' }}>
                <Typography variant="body2">{summary}</Typography>
              </Paper>
            </Box>
          )}

          {/* Topics */}
          {topics.length > 0 && (
            <Box mb={3}>
               <Typography variant="h6" gutterBottom>
                  <TopicIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> Topics
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {topics.map((topic, index) => (
                  <Chip key={index} label={topic} size="small" />
                ))}
              </Box>
            </Box>
          )}

          {/* Entities */}
          {entities.length > 0 && (
            <Box>
               <Typography variant="h6" gutterBottom>
                 <CategoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> Entities
              </Typography>
              <Paper elevation={1} sx={{ maxHeight: '25vh', overflowY: 'auto' }}>
                <List dense>
                  {entities.map((entity, index) => (
                    <React.Fragment key={index}>
                       <ListItem>
                         <ListItemText
                            primary={entity.text}
                            secondary={`${entity.type} (Conf: ${entity.confidence.toFixed(2)})`}
                         />
                       </ListItem>
                       {index < entities.length - 1 && <Divider component="li" />}
                     </React.Fragment>
                  ))}
                </List>
              </Paper>
            </Box>
          )}
        </Grid>
      </Grid>

       {/* Controls and Status */}
       <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 3, mb: 1, gap: 2 }}>
         <Button
           variant="contained"
           color="success"
           onClick={startRecording}
           disabled={isRecording || !isConnected || isConnecting}
         >
           Start Recording
         </Button>
         <Button
           variant="contained"
           color="error"
           onClick={stopRecording}
           disabled={!isRecording}
         >
           Stop Recording
         </Button>
       </Box>

       <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '30px' }}>
         {isRecording && <LinearProgress sx={{ width: '80%', mr: 1 }} />}
         <Chip
             icon={statusMessage.toLowerCase().includes('error') || statusMessage.toLowerCase().includes('fail') || statusMessage.toLowerCase().includes('denied') ? <ErrorIcon /> : <CheckCircleIcon />}
             label={statusMessage}
             size="small"
             color={statusMessage.toLowerCase().includes('error') || statusMessage.toLowerCase().includes('fail') || statusMessage.toLowerCase().includes('denied') ? 'error' : 'info'}
             variant="outlined"
         />
       </Box>
    </Box>
  );
};

export default TranscriptionTab;