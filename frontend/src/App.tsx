import React from 'react';
import {
  CssBaseline,
  AppBar,
  Tabs,
  Tab,
  Box,
  Container,
  Typography,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import ChatIcon from '@mui/icons-material/Chat';
import TranscriptionTab from './components/TranscriptionTab';
import ChatTab from './components/ChatTab';

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
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  };
}

function App() {
  const [value, setValue] = React.useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <React.Fragment>
      <CssBaseline />
      <AppBar position="static">
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              EchoMind
            </Typography>
          </Box>
          <Tabs
            value={value}
            onChange={handleChange}
            aria-label="navigation tabs"
            indicatorColor="secondary"
            textColor="inherit"
            variant="fullWidth"
            centered
          >
            <Tab icon={<MicIcon />} label="Transcription" {...a11yProps(0)} />
            <Tab icon={<ChatIcon />} label="Chat" {...a11yProps(1)} />
          </Tabs>
        </Container>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <TabPanel value={value} index={0}>
          <TranscriptionTab />
        </TabPanel>
        <TabPanel value={value} index={1}>
          <ChatTab />
        </TabPanel>
      </Container>
    </React.Fragment>
  );
}

export default App;
