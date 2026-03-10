import React, { useRef, useCallback, useEffect } from 'react';
import {
    Box,
    TextField,
    Button,
    List,
    ListItem,
    Paper,
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

// --- Model List (Keep or move to App/config) ---
const AVAILABLE_MODELS = [
    'gpt-oss:120b-cloud',
    'qwen3-coder:480b-cloud',
    'kimi-k2.5:cloud',
    'deepseek-v3.1:671b-cloud',
];

// --- Markdown Styles (Keep) ---
const markdownStyles = {
    p: { marginBottom: '0.2em', marginTop: '0.2em' },
    ol: { marginBlockStart: '0.5em', marginBlockEnd: '0.5em', paddingInlineStart: '1.5em' },
    ul: { marginBlockStart: '0.5em', marginBlockEnd: '0.5em', paddingInlineStart: '1.5em' },
    li: { marginBlockStart: '0.2em', marginBlockEnd: '0.2em' },
};

// --- Helper to format timestamp (Moved outside component) ---
const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- Interfaces for Props ---
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
    // EventSource handling, message sending logic, prompt state
    // are assumed to be handled by the parent (App.tsx or store)
    prompt: string;
    isChatLoading: boolean; // Used for input disable and message loading state
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

// --- Main ChatTab Component (Refactored) ---
const ChatTab: React.FC<ChatTabProps> = ({
    messages,
    selectedModel,
    onModelChange,
    prompt,
    isChatLoading,
    onInputChange,
    onKeyPress,
    onSend,
    onStop,
    editingMessageId,
    onEditClick,
    onSaveEdit,
    onCancelEdit,
    onRegenerate,
}) => {
    const chatContainerRef = useRef<null | HTMLDivElement>(null);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const inputAreaHeight = 70; // Estimate or calculate height of ChatInput

    // Get live transcript context stats
    const transcript = useTranscriptionStore(state => state.transcript);
    const contextSize = transcript.length;

    // --- Auto-scroll Logic (Re-added with user scroll check) ---
    useEffect(() => {
        const container = chatContainerRef.current;
        if (container) {
            // Calculate distance from bottom (higher threshold for smoother experience)
            const scrollThreshold = 150;
            const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < scrollThreshold;

            // Only auto-scroll if user is near the bottom
            if (isNearBottom) {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }
        }
    }, [messages]); // Trigger effect when messages array changes

    return (
        // Outermost Box - Add consistent padding
        <Box sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            p: '1.5rem' // Add overall padding (adjust as needed)
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2, gap: 2 }}>
                {/* Model Selector */}
                <FormControl sx={{ minWidth: 200 }} size="small">
                    <InputLabel id="model-select-label">Model</InputLabel>
                    <Select
                        labelId="model-select-label"
                        value={selectedModel} // Use prop
                        label="Model"
                        onChange={onModelChange} // Use prop
                    >
                        {AVAILABLE_MODELS.map((modelName) => (
                            <MenuItem key={modelName} value={modelName}>
                                {modelName}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Context Indicator Badge */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 4,
                    bgcolor: contextSize > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                    color: contextSize > 0 ? '#10b981' : '#6b7280',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    border: '1px solid',
                    borderColor: contextSize > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)'
                }}>
                    {contextSize > 0 ? `🧠 ${contextSize} segments attached` : '💬 No meeting context'}
                </Box>
            </Box>

            {/* Chat Messages Container (Grows, Scrolls, no padding here) */}
            <Box
                ref={chatContainerRef}
                sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    // p: '0 1.5rem', // REMOVE padding, handled by parent
                    pb: `${inputAreaHeight + 16}px`,
                    // Scrollbar styles...
                    '&::-webkit-scrollbar': { width: '6px' },
                    '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: '#CBD5E1', borderRadius: '8px' }
                }}
            >
                <List sx={{ padding: 0 }}>
                    {messages.map((msg, index) => (
                        <ListItem
                            key={msg.id}
                            sx={{
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                mb: 1,
                                px: 0,
                                position: 'relative',
                            }}
                        >
                            {msg.sender === 'user' && !editingMessageId && (
                                <Box sx={{ mr: 1, alignSelf: 'center' }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => onEditClick(msg.id, msg.text)}
                                        aria-label="edit message"
                                        sx={{ color: 'text.secondary' }}
                                    >
                                        <EditIcon fontSize="inherit" />
                                    </IconButton>
                                </Box>
                            )}
                            <Paper
                                elevation={1}
                                sx={{
                                    p: '8px 14px',
                                    bgcolor: msg.sender === 'user' ? 'primary.main' : 'grey.200',
                                    color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                                    borderRadius: 2,
                                    maxWidth: '75%',
                                    wordWrap: 'break-word',
                                    whiteSpace: 'pre-wrap',
                                    position: 'relative',
                                    pb: '22px',
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                    <Typography
                                        variant="body1"
                                        component="div"
                                        sx={{
                                            pr: msg.sender === 'ai' ? '30px' : '50px',
                                            fontFamily: 'monospace',
                                            flexGrow: 1,
                                        }}
                                    >
                                        {msg.sender === 'ai' ? (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ node, ...props }) => <p style={markdownStyles.p} {...props} />,
                                                    ol: ({ node, ...props }) => <ol style={markdownStyles.ol} {...props} />,
                                                    ul: ({ node, ...props }) => <ul style={markdownStyles.ul} {...props} />,
                                                    li: ({ node, ...props }) => <li style={markdownStyles.li} {...props} />,
                                                }}
                                            >
                                                {msg.text || (isChatLoading && index === messages.length - 1 && msg.sender === 'ai' && msg.text === '' ? '...' : '')}
                                            </ReactMarkdown>
                                        ) : (
                                            msg.text
                                        )}
                                    </Typography>
                                    {msg.sender === 'ai' && index === messages.length - 1 && !isChatLoading && msg.text !== '' && (
                                        <IconButton
                                            size="small"
                                            onClick={onRegenerate}
                                            aria-label="regenerate response"
                                            sx={{ color: 'text.secondary', ml: 0.5, flexShrink: 0 }}
                                        >
                                            <ReplayIcon fontSize="inherit" />
                                        </IconButton>
                                    )}
                                </Box>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        position: 'absolute',
                                        bottom: '5px',
                                        right: '10px',
                                        color: msg.sender === 'user' ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                                        fontSize: '0.7rem',
                                    }}
                                >
                                    {msg.timestamp}
                                </Typography>
                            </Paper>
                        </ListItem>
                    ))}
                    {/* Loading indicator if AI is responding (and last message is empty AI placeholder) */}
                    {isChatLoading && messages.length > 0 && messages[messages.length - 1]?.sender === 'ai' && messages[messages.length - 1]?.text === '' && (
                        <ListItem sx={{ justifyContent: 'flex-start', px: 0 }}>
                            <Paper elevation={0} sx={{ p: '8px 14px', bgcolor: 'grey.200', borderRadius: 2 }}>
                                <CircularProgress size={18} />
                            </Paper>
                        </ListItem>
                    )}

                    {/* Anchor div for scrolling */}
                    <div ref={messagesEndRef} />
                </List>
            </Box>

            {/* Chat Input - Absolute position relative to outer Box */}
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
                <ChatInput
                    prompt={prompt}
                    isLoading={isChatLoading}
                    onInputChange={onInputChange}
                    onKeyPress={(e) => { if (!editingMessageId) { onKeyPress(e); } }}
                    onSend={onSend}
                    onStop={onStop}
                    isEditing={!!editingMessageId}
                    onSaveEdit={onSaveEdit}
                    onCancelEdit={onCancelEdit}
                />
            </Box>
        </Box>
    );
};

// --- Extracted ChatInput Component ---
interface ChatInputProps {
    prompt: string;
    isLoading: boolean;
    onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyPress: (event: React.KeyboardEvent) => void;
    onSend: () => void;
    onStop: () => void;
    isEditing: boolean;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    prompt,
    isLoading,
    onInputChange,
    onKeyPress,
    onSend,
    onStop,
    isEditing,
    onSaveEdit,
    onCancelEdit,
}) => {
    return (
        <Box sx={{
            // Styles for the input bar container (previously absolutely positioned)
            // Now rendered directly in App.tsx, likely needs padding/margin adjustment there.
            bgcolor: '#F9FAFB',
            borderTop: '1px solid #E5E7EB', // Use borderTop instead of separate border
            p: '0.75rem 1.5rem', // Match parent padding
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
        }}>
            <TextField
                fullWidth
                variant="standard"
                placeholder={isEditing ? "Edit your message..." : "Type a message..."}
                value={prompt}
                onChange={onInputChange}
                onKeyPress={(e) => { if (!isEditing) { onKeyPress(e); } }}
                disabled={isLoading && !isEditing}
                multiline
                maxRows={4}
                sx={{
                    bgcolor: 'transparent',
                    '& .MuiInput-underline:before': { borderBottom: 'none' },
                    '& .MuiInput-underline:after': { borderBottom: 'none' },
                    '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                    '& .MuiInputBase-root': { padding: 0 },
                    '& .MuiInputBase-input': { padding: '4px 0' }
                }}
                InputProps={{ disableUnderline: true }}
                autoFocus // Maybe autofocus?
            />
            {isEditing && (
                <IconButton
                    onClick={onCancelEdit}
                    aria-label="cancel edit"
                    sx={{ color: 'text.secondary' }}
                >
                    <CancelIcon />
                </IconButton>
            )}
            <Button
                variant="contained"
                onClick={isEditing ? onSaveEdit : (isLoading ? onStop : onSend)}
                disabled={(isEditing && !prompt.trim()) || (!isEditing && !isLoading && !prompt.trim())}
                sx={{
                    minWidth: '40px',
                    width: '40px',
                    height: '40px',
                    p: 0,
                    borderRadius: '50%',
                    bgcolor: '#6366F1',
                    color: 'white',
                    boxShadow: 'none',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        bgcolor: '#4F46E5',
                    },
                    '&.Mui-disabled': {
                        bgcolor: 'grey.300',
                    }
                }}
            >
                {isEditing ? (
                    <SaveIcon fontSize="small" />
                ) : isLoading ? (
                    <StopIcon fontSize='small' />
                ) : (
                    <ArrowUpwardIcon fontSize='small' />
                )}
            </Button>
        </Box>
    );
};

export default ChatTab;