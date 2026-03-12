import React, { useState, useEffect, useCallback } from 'react';
import {
  CssBaseline,
  Box,
  Typography,
  SelectChangeEvent,
  Tooltip,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import TranscriptionTab from './components/TranscriptionTab';
import ChatTab, { Message } from './components/ChatTab';
import { ThemeProvider } from '@mui/material/styles';
import { v4 as uuidv4 } from 'uuid';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useTranscriptionStore } from './store/transcriptionStore';
import { darkTheme, colors, glassPanel } from './styles/theme';
import { AnimatePresence, motion } from 'framer-motion';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './styles/animations.css';

// ─── Sidebar width ──────────────────────────────────
const SIDEBAR_WIDTH = 260;

// ─── Tab Panel ──────────────────────────────────────
interface TabPanelProps {
  children: React.ReactNode;
  active: boolean;
}

function TabPanel({ children, active }: TabPanelProps) {
  return (
    <div style={{ height: '100%', width: '100%', display: active ? 'block' : 'none' }}>
      {children}
    </div>
  );
}

// ─── Sidebar Nav Button ─────────────────────────────
interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: React.ReactNode;
  onClick: () => void;
}

function NavButton({ icon, label, active, badge, onClick }: NavButtonProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.2,
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        background: active ? colors.accent.primaryMuted : 'transparent',
        color: active ? colors.accent.primaryHover : colors.text.secondary,
        '&:hover': {
          background: active ? colors.accent.primaryMuted : colors.glass.bgHover,
          color: active ? colors.accent.primaryHover : colors.text.primary,
        },
      }}
    >
      {icon}
      <Typography variant="body2" sx={{ fontWeight: active ? 600 : 400, flex: 1 }}>
        {label}
      </Typography>
      {badge}
    </Box>
  );
}

// ═════════════════════════════════════════════════════
// Main App
// ═════════════════════════════════════════════════════
function App() {
  const [activeTab, setActiveTab] = useState<number>(() => {
    const saved = sessionStorage.getItem('echoMindActiveTab');
    const val = saved ? parseInt(saved, 10) : 0;
    return val === 0 || val === 1 ? val : 0;
  });

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-oss:120b-cloud');
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [originalPromptBeforeEdit, setOriginalPromptBeforeEdit] = useState('');

  // Transcription store (for sidebar status)
  const isConnected = useTranscriptionStore(s => s.isConnected);
  const isRecording = useTranscriptionStore(s => s.isRecording);
  const transcript = useTranscriptionStore(s => s.transcript);

  const formatTimestamp = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const createAiPlaceholder = (): Message => ({
    id: uuidv4(),
    sender: 'ai',
    text: '',
    timestamp: formatTimestamp(new Date()),
  });

  // ─── SSE lifecycle ────────────────────────────────
  const closeEventSource = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsChatLoading(false);
    }
  }, []);

  useEffect(() => () => closeEventSource(), [closeEventSource]);

  const setupEventSource = async (
    promptText: string,
    modelName: string,
    transcriptContext: string,
    targetAiMessageId: string | null = null
  ) => {
    abortControllerRef.current = new AbortController();
    let hasReceivedData = false;

    try {
      await fetchEventSource('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ prompt: promptText, model: modelName, context: transcriptContext }),
        signal: abortControllerRef.current.signal,

        onopen(res) {
          if (res.ok && res.status === 200) return Promise.resolve();
          throw new Error(`Chat stream failed: ${res.status}`);
        },
        onmessage(event) {
          const chunk = event.data;
          hasReceivedData = true;
          setMessages(prev => {
            const id = targetAiMessageId ?? prev[prev.length - 1]?.id;
            if (!id) return prev;
            const idx = prev.findIndex(m => m.id === id);
            if (idx !== -1 && prev[idx].sender === 'ai') {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], text: updated[idx].text + chunk, timestamp: formatTimestamp(new Date()) };
              return updated;
            }
            return [...prev, { id: uuidv4(), sender: 'ai', text: chunk, timestamp: formatTimestamp(new Date()) }];
          });
        },
        onerror(error) {
          if (!hasReceivedData) {
            setMessages(prev => {
              const id = targetAiMessageId ?? prev[prev.length - 1]?.id;
              if (!id) return prev;
              const idx = prev.findIndex(m => m.id === id);
              if (idx !== -1 && prev[idx].sender === 'ai') {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], text: '[Error connecting to AI]', timestamp: formatTimestamp(new Date()) };
                return updated;
              }
              return [...prev, { id: uuidv4(), sender: 'ai', text: '[Error connecting to AI]', timestamp: formatTimestamp(new Date()) }];
            });
          }
          setIsChatLoading(false);
          closeEventSource();
          throw error;
        },
        onclose() { setIsChatLoading(false); },
      });
    } catch {
      setIsChatLoading(false);
    }
  };

  // ─── Chat handlers ────────────────────────────────
  const handleSend = useCallback(() => {
    if (editingMessageId || !prompt.trim() || isChatLoading) return;
    closeEventSource();
    const trimmed = prompt.trim();
    const userMsg: Message = { id: uuidv4(), sender: 'user', text: trimmed, timestamp: formatTimestamp(new Date()) };
    const placeholder = createAiPlaceholder();
    setMessages(prev => [...prev, userMsg, placeholder]);
    setIsChatLoading(true);
    setPrompt('');
    const ctx = useTranscriptionStore.getState().getFormattedTranscript();
    setupEventSource(userMsg.text, selectedModel, ctx, placeholder.id);
  }, [prompt, isChatLoading, selectedModel, closeEventSource, editingMessageId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setPrompt(e.target.value);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (editingMessageId) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleModelChange = (e: SelectChangeEvent<string>) => setSelectedModel(e.target.value);

  const handleNavigation = (index: number) => {
    if (index !== 1) closeEventSource();
    sessionStorage.setItem('echoMindActiveTab', index.toString());
    setActiveTab(index);
  };

  // ─── Editing ──────────────────────────────────────
  const handleEditClick = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setOriginalPromptBeforeEdit(prompt);
    setPrompt(currentText);
    closeEventSource();
    setIsChatLoading(false);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setPrompt(originalPromptBeforeEdit);
    setOriginalPromptBeforeEdit('');
  };

  const handleSaveEdit = () => {
    if (!editingMessageId || !prompt.trim()) return;
    const idx = messages.findIndex(m => m.id === editingMessageId);
    if (idx === -1) { handleCancelEdit(); return; }
    const edited = prompt.trim();
    const updatedMsg: Message = { ...messages[idx], text: edited, timestamp: formatTimestamp(new Date()) + ' (edited)' };
    const placeholder = createAiPlaceholder();
    closeEventSource();
    setMessages([...messages.slice(0, idx), updatedMsg, placeholder]);
    setEditingMessageId(null);
    setOriginalPromptBeforeEdit('');
    setPrompt('');
    setIsChatLoading(true);
    const ctx = useTranscriptionStore.getState().getFormattedTranscript();
    setupEventSource(edited, selectedModel, ctx, placeholder.id);
  };

  const handleRegenerate = useCallback(() => {
    if (isChatLoading || messages.length < 2) return;
    let lastAi = -1, lastUser = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'ai') {
        lastAi = i;
        if (i > 0 && messages[i - 1].sender === 'user') { lastUser = i - 1; break; }
      }
    }
    if (lastAi === -1 || lastUser === -1) return;
    const targetId = messages[lastAi].id;
    setMessages(prev => {
      const updated = [...prev];
      const ti = updated.findIndex(m => m.id === targetId);
      if (ti !== -1) updated[ti] = { ...updated[ti], text: '', timestamp: formatTimestamp(new Date()) };
      return updated;
    });
    closeEventSource();
    setIsChatLoading(true);
    const ctx = useTranscriptionStore.getState().getFormattedTranscript();
    setupEventSource(messages[lastUser].text, selectedModel, ctx, targetId);
  }, [messages, isChatLoading, selectedModel, closeEventSource]);

  // ─── Connection status ────────────────────────────
  const connectionColor = isRecording ? colors.error : isConnected ? colors.success : colors.text.muted;
  const connectionLabel = isRecording ? 'Recording' : isConnected ? 'Connected' : 'Disconnected';

  // ═════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* ─── Sidebar ──────────────────────────── */}
        <Box
          component="nav"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            ...glassPanel,
            borderRadius: 0,
            borderRight: `1px solid ${colors.glass.border}`,
            borderTop: 'none',
            borderBottom: 'none',
            borderLeft: 'none',
          }}
        >
          {/* Logo */}
          <Box sx={{ px: 2.5, py: 2.5 }}>
            <Typography
              variant="h5"
              sx={{
                background: colors.accent.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                fontSize: '1.35rem',
              }}
            >
              EchoMind
            </Typography>
            <Typography variant="caption" sx={{ color: colors.text.muted, mt: 0.3, display: 'block' }}>
              Meeting Intelligence
            </Typography>
          </Box>

          {/* Divider */}
          <Box sx={{ mx: 2, mb: 1, borderBottom: `1px solid ${colors.glass.border}` }} />

          {/* Nav items */}
          <Box sx={{ px: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <NavButton
              icon={<MicIcon fontSize="small" />}
              label="Transcription"
              active={activeTab === 0}
              onClick={() => handleNavigation(0)}
              badge={
                isRecording ? (
                  <FiberManualRecordIcon
                    sx={{ fontSize: 10, color: colors.error }}
                    className="animate-recording-pulse"
                  />
                ) : null
              }
            />
            <NavButton
              icon={<ChatBubbleOutlineIcon fontSize="small" />}
              label="Chat"
              active={activeTab === 1}
              onClick={() => handleNavigation(1)}
              badge={
                transcript.length > 0 ? (
                  <Typography
                    variant="caption"
                    sx={{
                      background: colors.accent.primaryMuted,
                      color: colors.accent.primaryHover,
                      px: 1,
                      py: 0.2,
                      borderRadius: '6px',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                    }}
                  >
                    {transcript.length}
                  </Typography>
                ) : null
              }
            />
          </Box>

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Bottom status */}
          <Box sx={{ px: 2, pb: 2 }}>
            <Box sx={{ mx: 0, mb: 1.5, borderBottom: `1px solid ${colors.glass.border}` }} />

            {/* Connection indicator */}
            <Tooltip title={connectionLabel} placement="right">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <FiberManualRecordIcon
                  sx={{ fontSize: 8, color: connectionColor }}
                  className={isRecording ? 'animate-live-dot' : undefined}
                />
                <Typography variant="caption" sx={{ color: colors.text.muted }}>
                  {connectionLabel}
                </Typography>
              </Box>
            </Tooltip>

            {/* Transcript count */}
            {transcript.length > 0 && (
              <Typography variant="caption" sx={{ color: colors.text.muted, display: 'block' }}>
                📋 {transcript.length} segments
              </Typography>
            )}

            {/* Model info */}
            <Typography variant="caption" sx={{ color: colors.text.muted, display: 'block', mt: 0.5 }}>
              🤖 {selectedModel}
            </Typography>
          </Box>
        </Box>

        {/* ─── Main Content ─────────────────────── */}
        <Box
          component="main"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Top bar */}
          <Box
            sx={{
              px: 3,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.glass.border}`,
              background: colors.glass.bg,
              backdropFilter: `blur(${colors.glass.blur})`,
              minHeight: 52,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
              >
                <Typography variant="h6" sx={{ color: colors.text.primary, fontWeight: 600 }}>
                  {activeTab === 0 ? 'Transcription' : 'Chat'}
                </Typography>
              </motion.div>
            </AnimatePresence>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {activeTab === 1 && transcript.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.5,
                    py: 0.4,
                    borderRadius: '8px',
                    background: colors.successMuted,
                    color: colors.success,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                  }}
                >
                  🧠 {transcript.length} segments
                </Box>
              )}
            </Box>
          </Box>

          {/* Content area */}
          <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <TabPanel active={activeTab === 0}>
              <TranscriptionTab />
            </TabPanel>
            <TabPanel active={activeTab === 1}>
              <ChatTab
                messages={messages}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                prompt={prompt}
                isChatLoading={isChatLoading}
                onInputChange={handleInputChange}
                onKeyPress={handleKeyPress}
                onSend={editingMessageId ? handleSaveEdit : handleSend}
                onStop={closeEventSource}
                editingMessageId={editingMessageId}
                onEditClick={handleEditClick}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onRegenerate={handleRegenerate}
              />
            </TabPanel>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
