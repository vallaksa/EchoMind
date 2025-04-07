import React from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';

const ChatTab: React.FC = () => {
  // Placeholder state
  const [messages, setMessages] = React.useState<{ sender: string; text: string }[]>([]);
  const [inputText, setInputText] = React.useState<string>('');

  const handleSendMessage = () => {
    if (inputText.trim()) {
      setMessages([...messages, { sender: 'User', text: inputText }]);
      setInputText('');
      // TODO: Implement sending message to backend
      console.log('Send message:', inputText);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <Typography variant="h5" gutterBottom>
        Chat
      </Typography>
      <Paper elevation={3} sx={{ flexGrow: 1, overflowY: 'auto', p: 2, mb: 2 }}>
        <List>
          {messages.length === 0 && (
            <ListItem>
              <ListItemText primary="No messages yet."/>
            </ListItem>
          )}
          {messages.map((msg, index) => (
            <ListItem key={index}>
              <ListItemText 
                primary={msg.text}
                secondary={msg.sender}
                sx={{ textAlign: msg.sender === 'User' ? 'right' : 'left' }}
              />
            </ListItem>
          ))}
        </List>
      </Paper>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type your message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <Button variant="contained" onClick={handleSendMessage}>
          Send
        </Button>
      </Box>
    </Box>
  );
};

export default ChatTab; 