import * as React from 'react';
import { useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useTranscriptionStore } from '../store/transcriptionStore';
import { colors, glassPanel } from '../styles/theme';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───────────────────────────────────────────
interface FormattedLine {
  speaker?: number;
  lineText: string;
}

// ─── Helpers ─────────────────────────────────────────
const getSpeakerColor = (speakerIndex?: number): string => {
  if (typeof speakerIndex !== 'number') return colors.text.muted;
  return colors.speakers[speakerIndex % colors.speakers.length];
};

const formatSpeaker = (speakerIndex?: number, speakerName?: string): string => {
  const prefix = typeof speakerIndex === 'number' ? `Speaker ${speakerIndex}` : 'Unknown';
  const name = speakerName ? ` (${speakerName})` : '';
  return `${prefix}${name}`;
};

// ═════════════════════════════════════════════════════
// TranscriptionTab Component
// ═════════════════════════════════════════════════════
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

  const transcriptContentRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // ─── Format transcript by speaker ─────────────
  const formattedLines = React.useMemo(() => {
    const lines: FormattedLine[] = [];
    if (!transcript || transcript.length === 0) return lines;
    let current: FormattedLine | null = null;
    for (const seg of transcript) {
      if (!current || seg.speaker !== current.speaker) {
        current = { speaker: seg.speaker, lineText: seg.text };
        lines.push(current);
      } else {
        current.lineText += seg.text;
      }
    }
    return lines;
  }, [transcript]);

  // ─── Auto-connect ─────────────────────────────
  React.useEffect(() => {
    connectWebSocket();
    return () => disconnectWebSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastFinalSpeaker = formattedLines.length > 0 ? formattedLines[formattedLines.length - 1].speaker : undefined;

  // ─── Auto-scroll ──────────────────────────────
  React.useEffect(() => {
    const container = transcriptContentRef.current;
    if (container) {
      const isNear = container.scrollHeight - container.clientHeight - container.scrollTop < 150;
      if (isNear) transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [formattedLines, currentUtterance]);

  // ─── Elapsed time ─────────────────────────────
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    if (!isRecording) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Unique speakers
  const uniqueSpeakers = React.useMemo(() => {
    const set = new Set<number>();
    transcript.forEach(t => { if (typeof t.speaker === 'number') set.add(t.speaker); });
    return set.size;
  }, [transcript]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* ─── Status bar ─── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2.5, py: 1.2,
        borderBottom: `1px solid ${colors.glass.border}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isConnecting ? (
            <CircularProgress size={14} sx={{ color: colors.accent.primaryHover }} />
          ) : isConnected ? (
            <FiberManualRecordIcon sx={{ fontSize: 8, color: colors.success }} />
          ) : (
            <FiberManualRecordIcon sx={{ fontSize: 8, color: colors.error }} />
          )}
          <Typography variant="caption" sx={{ color: colors.text.muted }}>
            {statusMessage}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isRecording && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FiberManualRecordIcon
                sx={{ fontSize: 10, color: colors.error }}
                className="animate-live-dot"
              />
              <Typography variant="caption" sx={{ color: colors.error, fontWeight: 600, fontFamily: 'monospace' }}>
                {formatElapsed(elapsed)}
              </Typography>
            </Box>
          )}
          {transcript.length > 0 && (
            <Typography variant="caption" sx={{ color: colors.text.muted }}>
              {transcript.length} segments · {uniqueSpeakers} speaker{uniqueSpeakers !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>
      </Box>

      {/* ─── Transcript body ─── */}
      <Box
        ref={transcriptContentRef}
        className="echo-scrollbar"
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2.5,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.8,
          pb: 12,
        }}
      >
        {/* Empty state */}
        {formattedLines.length === 0 && !currentUtterance.text && (
          <Box sx={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 1.5, opacity: 0.5,
          }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%',
              background: colors.glass.bg, border: `1px solid ${colors.glass.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MicIcon sx={{ fontSize: 28, color: colors.text.muted }} />
            </Box>
            <Typography variant="body1" sx={{ color: colors.text.muted, textAlign: 'center' }}>
              Listening for audio...
            </Typography>
            <Typography variant="caption" sx={{ color: colors.text.disabled, textAlign: 'center' }}>
              Click <strong>Start Recording</strong> to begin real-time transcription
            </Typography>
          </Box>
        )}

        {/* Formatted transcript lines */}
        <AnimatePresence initial={false}>
          {formattedLines.map((line, index) => {
            const speakerColor = getSpeakerColor(line.speaker);
            return (
              <motion.div
                key={`line-${index}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Box sx={{
                  display: 'flex', gap: 1.5, alignItems: 'flex-start',
                  py: 0.8, px: 1.5,
                  borderRadius: '12px',
                  transition: 'background 0.2s',
                  '&:hover': { background: colors.glass.bgHover },
                }}>
                  {/* Speaker indicator */}
                  <Box sx={{
                    mt: 0.6, flexShrink: 0,
                    width: 6, height: 6, borderRadius: '50%',
                    background: speakerColor,
                    boxShadow: `0 0 8px ${speakerColor}40`,
                  }} />

                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{ color: speakerColor, fontWeight: 600, fontSize: '0.72rem' }}
                    >
                      {formatSpeaker(line.speaker, transcript.find(s => s.speaker === line.speaker)?.speakerName)}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: colors.text.primary, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
                    >
                      {line.lineText}
                    </Typography>
                  </Box>
                </Box>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Current partial utterance */}
        {currentUtterance.text && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 0.15 }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 0.8, px: 1.5 }}>
              <Box sx={{
                mt: 0.6, flexShrink: 0,
                width: 6, height: 6, borderRadius: '50%',
                background: getSpeakerColor(currentUtterance.speaker),
              }} />
              <Box>
                {(currentUtterance.speaker !== lastFinalSpeaker || formattedLines.length === 0) && (
                  <Typography variant="caption" sx={{
                    color: getSpeakerColor(currentUtterance.speaker),
                    fontWeight: 600, fontSize: '0.72rem',
                  }}>
                    {formatSpeaker(currentUtterance.speaker, currentUtterance.speakerName)}
                  </Typography>
                )}
                <Typography variant="body2" sx={{
                  color: colors.text.secondary,
                  whiteSpace: 'pre-wrap', lineHeight: 1.7, fontStyle: 'italic',
                }}>
                  {currentUtterance.text}
                  <span className="animate-cursor-blink" style={{
                    display: 'inline-block', width: 2, height: '0.9em',
                    background: colors.accent.primaryHover, marginLeft: 2,
                    verticalAlign: 'text-bottom',
                  }} />
                </Typography>
              </Box>
            </Box>
          </motion.div>
        )}

        <div ref={transcriptEndRef} />
      </Box>

      {/* ─── Controls ─── */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        px: 2.5, py: 1.5,
        borderTop: `1px solid ${colors.glass.border}`,
        background: colors.glass.bg,
        backdropFilter: `blur(${colors.glass.blur})`,
        display: 'flex', justifyContent: 'center', gap: 2,
      }}>
        <Button
          variant="contained"
          onClick={startRecording}
          disabled={isRecording || !isConnected || isConnecting}
          startIcon={<MicIcon />}
          sx={{
            px: 3, py: 1,
            borderRadius: '12px',
            background: colors.accent.gradient,
            fontWeight: 600,
            '&:hover': { opacity: 0.9, background: colors.accent.gradient },
            '&.Mui-disabled': { background: colors.glass.bg, color: colors.text.disabled },
          }}
        >
          Start Recording
        </Button>
        <Button
          variant="outlined"
          onClick={stopRecording}
          disabled={!isRecording}
          startIcon={<MicOffIcon />}
          sx={{
            px: 3, py: 1,
            borderRadius: '12px',
            borderColor: isRecording ? colors.error : colors.glass.border,
            color: isRecording ? colors.error : colors.text.muted,
            fontWeight: 600,
            '&:hover': {
              borderColor: colors.error,
              background: colors.errorMuted,
            },
            '&.Mui-disabled': { borderColor: colors.glass.border, color: colors.text.disabled },
          }}
        >
          Stop Recording
        </Button>
      </Box>
    </Box>
  );
};

export default TranscriptionTab;