import React, { useState, useEffect, useCallback } from 'react';
import {
  CssBaseline,
  AppBar,
  Box,
  Container,
  Typography,
  Toolbar,
  Paper,
  SelectChangeEvent,
  Drawer,
  IconButton,
  styled,
  useTheme,
  Theme,
  Tabs,
  Tab
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MicIcon from '@mui/icons-material/Mic';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import TranscriptionTab from './components/TranscriptionTab';
import ChatTab, { Message } from './components/ChatTab';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// --- Define the custom theme based on designPrompt ---
const theme = createTheme({
  palette: {
    primary: {
      main: '#4F46E5', // Active tab, Button backgrounds
    },
    secondary: { // For Tab Background Bubble
      main: '#EEF2FF', // Tab background #EEF2FF
      contrastText: '#1E1B4B', // Tab text #1E1B4B
    },
    background: {
      default: '#f4f6f8',
      paper: '#ffffff',
    },
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"', // Refined font stack
    h5: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#6366F1', // App Title color #6366F1
    },
    button: {
      textTransform: 'none',
    }
  },
  components: {
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.95rem',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
        },
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        }
      }
    }
  }
});

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      style={{ height: '100%', width: '100%' }}
    >
      {value === index && children}
    </div>
  );
}

// --- DrawerHeader (Still needed for main content spacing) ---
const DrawerHeader = styled('div')(({ theme }: { theme: Theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

function App() {
  // Initialize state from sessionStorage, default to 0
  const [value, setValue] = useState<number>(() => {
      const savedTab = sessionStorage.getItem('echoMindActiveTab');
      const initialValue = savedTab ? parseInt(savedTab, 10) : 0;
      // Ensure value is valid (0 or 1)
      return (initialValue === 0 || initialValue === 1) ? initialValue : 0;
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const themeMui = useTheme();

  const [prompt, setPrompt] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('llama3');
  const eventSourceRef = React.useRef<EventSource | null>(null);

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsChatLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      closeEventSource();
    };
  }, [closeEventSource]);

  const handleSend = useCallback(() => {
    if (!prompt.trim() || isChatLoading) return;

    closeEventSource();

    const timestamp = formatTimestamp(new Date());
    const userMessage = { sender: 'user' as const, text: prompt, timestamp };
    setMessages((prev) => [...prev, userMessage]);
    setIsChatLoading(true);
    setPrompt('');

    setMessages((prev) => [...prev, { sender: 'ai' as const, text: '', timestamp: formatTimestamp(new Date()) }]);

    const encodedPrompt = encodeURIComponent(userMessage.text);
    const encodedModel = encodeURIComponent(selectedModel);
    const url = `http://localhost:8080/api/chat/stream?prompt=${encodedPrompt}&model=${encodedModel}`;

    const newEventSource = new EventSource(url);
    eventSourceRef.current = newEventSource;
    (newEventSource as any)._hasReceivedData = false;

    newEventSource.onopen = () => {
      // Connection is open, ready for messages
    };

    newEventSource.onmessage = (event) => {
      const chunk = event.data;
      if (!eventSourceRef.current) return;
      (eventSourceRef.current as any)._hasReceivedData = true;

      setMessages((prevMessages) => {
        const lastMessage = prevMessages[prevMessages.length - 1];
        if (lastMessage && lastMessage.sender === 'ai') {
          const newText = lastMessage.text + chunk;
          return [
            ...prevMessages.slice(0, -1),
            { ...lastMessage, text: newText, timestamp: formatTimestamp(new Date()) },
          ];
        }
        return [...prevMessages, { sender: 'ai', text: chunk, timestamp: formatTimestamp(new Date()) }];
      });
    };

    newEventSource.onerror = (error) => {
      const receivedData = (eventSourceRef.current as any)?._hasReceivedData;

      if (!receivedData) {
        setMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          if (lastMessage && lastMessage.sender === 'ai' && lastMessage.text === '') {
            return [
              ...prevMessages.slice(0, -1),
              { ...lastMessage, text: '[Error connecting to AI]', timestamp: formatTimestamp(new Date()) },
            ];
          }
          return [...prevMessages, { sender: 'ai', text: '[Error connecting to AI]', timestamp: formatTimestamp(new Date()) }];
        });
      }

      setIsChatLoading(false);
      closeEventSource();
    };

  }, [prompt, isChatLoading, selectedModel, closeEventSource]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleModelChange = (event: SelectChangeEvent<string>) => {
    setSelectedModel(event.target.value as string);
  };

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  // --- Drawer Toggle Handler ---
  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Update handleNavigation to save to sessionStorage
  const handleNavigation = (event: React.SyntheticEvent, index: number) => {
    if (index !== 1) { 
      closeEventSource();
    }
    // Save to sessionStorage
    sessionStorage.setItem('echoMindActiveTab', index.toString());
    // Update state
    setValue(index);
  };

  const drawerWidth = 240;
  const bottomNavClearance = 90;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="fixed"
          color="transparent"
          elevation={0}
          sx={{
            bgcolor: 'background.default',
            borderBottom: '1px solid #e5e7eb',
            zIndex: themeMui.zIndex.drawer + 1,
          }}
        >
          <Toolbar disableGutters sx={{ px: { xs: 1, sm: 2 } }}>
            <IconButton
              color="inherit"
              aria-label="toggle drawer"
              onClick={handleDrawerToggle}
              edge="start"
              sx={{ 
                mr: 2,
                '&:focus': {
                  outline: 'none',
                },
                '&:focus-visible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: '2px',
                }
              }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h5"
              noWrap
              component="div"
              sx={{
                fontWeight: 600,
                flexGrow: 1,
                textAlign: 'center',
              }}
            >
              EchoMind
            </Typography>
            <Box sx={{ width: 48, mr: 2 }} />
          </Toolbar>
        </AppBar>

        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={handleDrawerClose}
          hideBackdrop={true}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}
        >
          <Toolbar />
          <Typography sx={{p:2}}>Drawer Content (Optional)</Typography>
        </Drawer>

        <Box
            component="main"
            sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.default',
                mt: `calc(${themeMui.mixins.toolbar.minHeight}px + 1px)`,
                overflow: 'hidden',
                pb: `${bottomNavClearance}px`
            }}
        >
            <DrawerHeader />
            <Container maxWidth="md" sx={{
                flexGrow: 1,
                display: 'flex',
                justifyContent: 'center',
                py: 2,
                overflow: 'hidden'
             }}>
                <Box
                  component={Paper}
                  elevation={0}
                  sx={{
                    width: '100%',
                    maxWidth: '700px',
                    flexGrow: 1,
                    borderRadius: '24px',
                    bgcolor: 'background.paper',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                    <Box sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                        <TabPanel value={value} index={0}>
                            <TranscriptionTab />
                        </TabPanel>
                        <TabPanel value={value} index={1}>
                            <ChatTab
                                messages={messages}
                                selectedModel={selectedModel}
                                onModelChange={handleModelChange}
                                prompt={prompt}
                                isChatLoading={isChatLoading}
                                onInputChange={handleInputChange}
                                onKeyPress={handleKeyPress}
                                onSend={handleSend}
                                onStop={closeEventSource}
                            />
                        </TabPanel>
                    </Box>
                </Box>
            </Container>
        </Box>

        <Box sx={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1100,
        }}>
          <Paper
            elevation={0}
            sx={{
              display: 'inline-flex',
              borderRadius: '9999px',
              bgcolor: 'secondary.main',
              p: 0.75,
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Tabs
              value={value}
              onChange={handleNavigation}
              aria-label="navigation tabs"
              TabIndicatorProps={{ style: { display: 'none' } }}
              sx={{
                minHeight:'auto',
                '.MuiTabs-flexContainer': {
                  gap: '4px',
                }
              }}
            >
              <Tab
                icon={<MicIcon fontSize="small"/>}
                iconPosition="start"
                label="Transcription"
                value={0}
                sx={{
                  color: theme.palette.secondary.contrastText,
                  borderRadius: '9999px',
                  px: 2, py: 0.8,
                  minHeight: 'auto',
                  minWidth: 'auto',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease-in-out',
                  '& .MuiTab-iconWrapper': { marginRight: '6px' },
                  '&.Mui-selected': { 
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                    outline: 'none',
                  },
                }}
              />
              <Tab
                icon={<ChatBubbleOutlineIcon fontSize="small"/>}
                iconPosition="start"
                label="Chat"
                value={1}
                sx={{
                  color: theme.palette.secondary.contrastText,
                  borderRadius: '9999px',
                  px: 2, py: 0.8,
                  minHeight: 'auto',
                  minWidth: 'auto',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease-in-out',
                  '& .MuiTab-iconWrapper': { marginRight: '6px' },
                  '&.Mui-selected': { 
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                    outline: 'none',
                  },
                }}
              />
            </Tabs>
          </Paper>
        </Box>

      </Box>
    </ThemeProvider>
  );
}

export default App;
