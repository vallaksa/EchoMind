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
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import StopIcon from '@mui/icons-material/Stop';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Model List (Keep or move to App/config) ---
const AVAILABLE_MODELS = [
    'mistral',
    'llama3',
    'gemma:2b'
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
    onStop
}) => {
    const chatContainerRef = useRef<null | HTMLDivElement>(null);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const inputAreaHeight = 70; // Estimate or calculate height of ChatInput

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
            {/* Model Selector (No extra padding needed) */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 /* Keep margin */ }}>
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
                            key={index}
                            sx={{
                                display: 'flex',
                                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                mb: 1,
                                px: 0,
                            }}
                        >
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
                                 <Typography 
                                    variant="body1" 
                                    component="div" 
                                    sx={{
                                        pr: '50px',
                                        fontFamily: 'monospace'
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
                                             {/* Show loading dots only if the *last* message is an empty AI message */}
                                             {msg.text || (isChatLoading && messages[messages.length -1] === msg && msg.sender === 'ai' && msg.text === '' ? '...' : '')}
                                         </ReactMarkdown>
                                     ) : (
                                         msg.text
                                     )}
                                 </Typography>
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
                    onKeyPress={onKeyPress}
                    onSend={onSend}
                    onStop={onStop}
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
}

export const ChatInput: React.FC<ChatInputProps> = ({
    prompt,
    isLoading,
    onInputChange,
    onKeyPress,
    onSend,
    onStop,
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
                placeholder="Type a message..."
                value={prompt}
                onChange={onInputChange}
                onKeyPress={onKeyPress}
                disabled={isLoading}
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
            <Button
                variant="contained"
                onClick={isLoading ? onStop : onSend}
                disabled={!isLoading && !prompt.trim()}
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
                {isLoading ? (
                    <StopIcon fontSize='small' />
                ) : (
                    <ArrowUpwardIcon fontSize='small' />
                )}
            </Button>
        </Box>
    );
};

export default ChatTab; 