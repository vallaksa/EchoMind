import React, { useRef, useEffect } from 'react';
import {
    Box,
    TextField,
    Button,
    Typography,
    CircularProgress,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    SelectChangeEvent,
    IconButton,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import StopIcon from '@mui/icons-material/Stop';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import ReplayIcon from '@mui/icons-material/Replay';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranscriptionStore } from '../store/transcriptionStore';
import { colors, glassPanel } from '../styles/theme';
import { motion } from 'framer-motion';

// ─── Model List ──────────────────────────────────────
const AVAILABLE_MODELS = [
    'gpt-oss:120b-cloud',
    'qwen3-coder:480b-cloud',
    'kimi-k2.5:cloud',
    'deepseek-v3.1:671b-cloud',
];

// ─── Interfaces ──────────────────────────────────────
export interface Message {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp?: string;
}

interface ChatTabProps {
    messages: Message[];
    selectedModel: string;
    onModelChange: (event: SelectChangeEvent<string>) => void;
    prompt: string;
    isChatLoading: boolean;
    onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyPress: (event: React.KeyboardEvent) => void;
    onSend: () => void;
    onStop: () => void;
    editingMessageId: string | null;
    onEditClick: (messageId: string, currentText: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onRegenerate: () => void;
}

// ─── Markdown styles ─────────────────────────────────
const mdStyles = {
    p: { margin: '0.3em 0' },
    ol: { margin: '0.4em 0', paddingInlineStart: '1.4em' },
    ul: { margin: '0.4em 0', paddingInlineStart: '1.4em' },
    li: { margin: '0.15em 0' },
    code: {
        background: 'rgba(255,255,255,0.06)',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: '0.85em',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    },
    pre: {
        background: 'rgba(0,0,0,0.3)',
        padding: '12px 16px',
        borderRadius: 8,
        overflow: 'auto' as const,
        fontSize: '0.82em',
        maxWidth: '100%',
    },
};

// ═════════════════════════════════════════════════════
// ChatTab Component
// ═════════════════════════════════════════════════════
const ChatTab: React.FC<ChatTabProps> = ({
    messages, selectedModel, onModelChange, prompt, isChatLoading,
    onInputChange, onKeyPress, onSend, onStop,
    editingMessageId, onEditClick, onSaveEdit, onCancelEdit, onRegenerate,
}) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const transcript = useTranscriptionStore(s => s.transcript);
    const contextSize = transcript.length;

    // Auto-scroll
    useEffect(() => {
        const container = chatContainerRef.current;
        if (container) {
            const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 150;
            if (isNearBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>

            {/* ─── Top bar: model + context ─── */}
            <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 2, px: 2, py: 1.2,
                borderBottom: `1px solid ${colors.glass.border}`,
            }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="model-select" sx={{ color: colors.text.muted }}>Model</InputLabel>
                    <Select
                        labelId="model-select"
                        value={selectedModel}
                        label="Model"
                        onChange={onModelChange}
                        sx={{
                            color: colors.text.primary,
                            '.MuiOutlinedInput-notchedOutline': { borderColor: colors.glass.border },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.glass.borderHover },
                            '.MuiSvgIcon-root': { color: colors.text.muted },
                        }}
                    >
                        {AVAILABLE_MODELS.map(m => (
                            <MenuItem key={m} value={m}>{m}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box sx={{
                    display: 'flex', alignItems: 'center',
                    px: 1.5, py: 0.4, borderRadius: '8px',
                    background: contextSize > 0 ? colors.successMuted : 'rgba(100,116,139,0.1)',
                    color: contextSize > 0 ? colors.success : colors.text.muted,
                    fontSize: '0.78rem', fontWeight: 500,
                }}>
                    {contextSize > 0 ? `🧠 ${contextSize} segments` : '💬 No context'}
                </Box>
            </Box>

            {/* ─── Messages area ─── */}
            <Box
                ref={chatContainerRef}
                className="echo-scrollbar"
                sx={{
                    flex: 1, overflowY: 'auto', px: 2.5, py: 2,
                    display: 'flex', flexDirection: 'column', gap: 1.5,
                }}
            >
                {messages.length === 0 && (
                    <Box sx={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column', gap: 1, opacity: 0.5,
                    }}>
                        <Typography variant="h6" sx={{ color: colors.text.muted }}>
                            Start a conversation
                        </Typography>
                        <Typography variant="caption" sx={{ color: colors.text.disabled }}>
                            {contextSize > 0
                                ? `${contextSize} meeting segments available as context`
                                : 'No meeting transcript available'}
                        </Typography>
                    </Box>
                )}

                {messages.map((msg, index) => {
                    const isUser = msg.sender === 'user';
                    const isLastAi = !isUser && index === messages.length - 1;
                    const isEmpty = msg.text === '';
                    const isStreaming = isLastAi && isChatLoading && !isEmpty;

                    return (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: 0.03 }}
                            style={{
                                display: 'flex',
                                justifyContent: isUser ? 'flex-end' : 'flex-start',
                            }}
                        >
                            <Box
                                sx={{
                                    maxWidth: '80%',
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    px: 2, py: 1.2,
                                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: isUser
                                        ? colors.accent.gradient
                                        : colors.glass.bg,
                                    border: isUser ? 'none' : `1px solid ${colors.glass.border}`,
                                    backdropFilter: isUser ? 'none' : `blur(${colors.glass.blur})`,
                                    color: isUser ? '#fff' : colors.text.primary,
                                    wordBreak: 'break-word',
                                    overflowWrap: 'anywhere',
                                }}
                            >
                                {/* Message text */}
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
                                    <Box sx={{ flex: 1, minWidth: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                                        {!isUser ? (
                                            isEmpty && isLastAi && isChatLoading ? (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                                                    <CircularProgress size={14} sx={{ color: colors.accent.primaryHover }} />
                                                    <Typography variant="caption" sx={{ color: colors.text.muted }}>
                                                        Thinking...
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        p: ({ ...props }) => <p style={mdStyles.p} {...props} />,
                                                        ol: ({ ...props }) => <ol style={mdStyles.ol} {...props} />,
                                                        ul: ({ ...props }) => <ul style={mdStyles.ul} {...props} />,
                                                        li: ({ ...props }) => <li style={mdStyles.li} {...props} />,
                                                        code: ({ ...props }) => <code style={mdStyles.code} {...props} />,
                                                        pre: ({ ...props }) => <pre style={mdStyles.pre} {...props} />,
                                                    }}
                                                >
                                                    {msg.text}
                                                </ReactMarkdown>
                                            )
                                        ) : (
                                            msg.text
                                        )}
                                        {/* Streaming cursor */}
                                        {isStreaming && (
                                            <span
                                                className="animate-cursor-blink"
                                                style={{
                                                    display: 'inline-block',
                                                    width: 2, height: '1em',
                                                    background: colors.accent.primaryHover,
                                                    marginLeft: 2,
                                                    verticalAlign: 'text-bottom',
                                                }}
                                            />
                                        )}
                                    </Box>

                                    {/* Action buttons */}
                                    {isUser && !editingMessageId && (
                                        <IconButton
                                            size="small"
                                            onClick={() => onEditClick(msg.id, msg.text)}
                                            sx={{ color: 'rgba(255,255,255,0.6)', ml: 0.5, opacity: 0, '.MuiBox-root:hover &': { opacity: 1 } }}
                                        >
                                            <EditIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    )}
                                    {isLastAi && !isChatLoading && msg.text !== '' && (
                                        <IconButton
                                            size="small"
                                            onClick={onRegenerate}
                                            sx={{ color: colors.text.muted, ml: 0.5 }}
                                        >
                                            <ReplayIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    )}
                                </Box>

                                {/* Timestamp */}
                                <Typography
                                    variant="caption"
                                    sx={{
                                        display: 'block', textAlign: isUser ? 'right' : 'left',
                                        mt: 0.5, fontSize: '0.65rem',
                                        color: isUser ? 'rgba(255,255,255,0.5)' : colors.text.disabled,
                                    }}
                                >
                                    {msg.timestamp}
                                </Typography>
                            </Box>
                        </motion.div>
                    );
                })}

                <div ref={messagesEndRef} />
            </Box>

            {/* ─── Input area ─── */}
            <Box sx={{
                px: 2, py: 1.5,
                borderTop: `1px solid ${colors.glass.border}`,
                background: colors.glass.bg,
                backdropFilter: `blur(${colors.glass.blur})`,
            }}>
                <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    ...glassPanel,
                    borderRadius: '16px',
                    px: 2, py: 0.8,
                }}>
                    <TextField
                        fullWidth
                        variant="standard"
                        placeholder={editingMessageId ? 'Edit your message...' : 'Ask about the meeting...'}
                        value={prompt}
                        onChange={onInputChange}
                        onKeyPress={(e) => { if (!editingMessageId) onKeyPress(e); }}
                        disabled={isChatLoading && !editingMessageId}
                        multiline
                        maxRows={4}
                        sx={{
                            '& .MuiInput-underline:before, & .MuiInput-underline:after': { borderBottom: 'none' },
                            '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                            '& .MuiInputBase-input': {
                                color: colors.text.primary,
                                fontSize: '0.9rem',
                                '&::placeholder': { color: colors.text.muted, opacity: 1 },
                            },
                        }}
                        InputProps={{ disableUnderline: true }}
                    />

                    {editingMessageId && (
                        <IconButton onClick={onCancelEdit} sx={{ color: colors.text.muted }}>
                            <CancelIcon fontSize="small" />
                        </IconButton>
                    )}

                    <Button
                        variant="contained"
                        onClick={editingMessageId ? onSaveEdit : (isChatLoading ? onStop : onSend)}
                        disabled={
                            (editingMessageId && !prompt.trim()) ||
                            (!editingMessageId && !isChatLoading && !prompt.trim())
                        }
                        sx={{
                            minWidth: 38, width: 38, height: 38, p: 0,
                            borderRadius: '50%',
                            background: colors.accent.gradient,
                            boxShadow: 'none',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                background: colors.accent.gradient,
                                opacity: 0.85,
                            },
                            '&.Mui-disabled': {
                                background: colors.glass.bg,
                                color: colors.text.disabled,
                            },
                        }}
                    >
                        {editingMessageId ? <SaveIcon sx={{ fontSize: 18 }} /> :
                         isChatLoading ? <StopIcon sx={{ fontSize: 18 }} /> :
                         <ArrowUpwardIcon sx={{ fontSize: 18 }} />}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default ChatTab;
