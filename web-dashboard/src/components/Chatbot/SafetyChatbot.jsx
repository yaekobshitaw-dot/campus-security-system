// src/components/Chatbot/SafetyChatbot.jsx
import React, { useState, useRef, useEffect } from 'react';

const SafetyChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: 'Hello! I\'m your Campus Safety Assistant. How can I help you?', sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const quickReplies = ['How to report an incident?', 'Emergency contacts', 'Safety tips', 'Security office location'];

  const getBotResponse = (userMessage) => {
    const lower = userMessage.toLowerCase();
    if (lower.includes('report') || lower.includes('incident')) {
      return 'To report an incident, click the "Report Incident" button on the dashboard. Fill in the details and submit.';
    } else if (lower.includes('emergency') || lower.includes('contact')) {
      return 'Emergency Contacts:\nSecurity: +251-911-234-567\nMedical: +251-911-765-432\nPolice: 911';
    } else if (lower.includes('safety') || lower.includes('tip')) {
      return 'Safety Tips:\n1. Stay aware of your surroundings\n2. Report suspicious activity\n3. Use well-lit paths at night';
    } else if (lower.includes('security') || lower.includes('office')) {
      return 'The Campus Security Office is in Building A, Room 101. Open 24/7.';
    } else {
      return 'I can help with:\n• Reporting incidents\n• Emergency contacts\n• Safety tips\n• Security office location';
    }
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setLoading(true);
    setTimeout(() => {
      const response = getBotResponse(userMessage);
      setMessages(prev => [...prev, { text: response, sender: 'bot' }]);
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} style={styles.chatButton}>💬</button>
      {isOpen && (
        <div style={styles.chatWindow}>
          <div style={styles.chatHeader}>
            <span>🤖 Safety Assistant</span>
            <button onClick={() => setIsOpen(false)} style={styles.closeBtn}>✕</button>
          </div>
          <div style={styles.chatMessages}>
            {messages.map((msg, index) => (
              <div key={index} style={{...styles.message, alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', backgroundColor: msg.sender === 'user' ? '#2196F3' : '#f5f5f5', color: msg.sender === 'user' ? 'white' : '#333'}}>
                {msg.text}
              </div>
            ))}
            {loading && <div style={{...styles.message, alignSelf: 'flex-start', backgroundColor: '#f5f5f5'}}>Typing...</div>}
            <div ref={messagesEndRef} />
          </div>
          <div style={styles.quickReplies}>
            {quickReplies.map((reply, index) => (
              <button key={index} onClick={() => { setInput(reply); setTimeout(sendMessage, 100); }} style={styles.quickReplyBtn}>
                {reply}
              </button>
            ))}
          </div>
          <div style={styles.chatInput}>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." style={styles.input} />
            <button onClick={sendMessage} style={styles.sendBtn}>Send</button>
          </div>
        </div>
      )}
    </>
  );
};

const styles = {
  chatButton: { position: 'fixed', bottom: '30px', right: '30px', width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#2196F3', color: 'white', border: 'none', fontSize: '30px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1000 },
  chatWindow: { position: 'fixed', bottom: '100px', right: '30px', width: '380px', maxHeight: '500px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', zIndex: 1000 },
  chatHeader: { padding: '15px', backgroundColor: '#2196F3', color: 'white', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' },
  closeBtn: { background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' },
  chatMessages: { padding: '15px', height: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' },
  message: { padding: '10px 15px', borderRadius: '18px', maxWidth: '80%', wordWrap: 'break-word', whiteSpace: 'pre-line' },
  quickReplies: { padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px', borderTop: '1px solid #eee' },
  quickReplyBtn: { backgroundColor: '#e3f2fd', border: '1px solid #2196F3', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', color: '#2196F3' },
  chatInput: { padding: '10px', display: 'flex', gap: '10px', borderTop: '1px solid #eee' },
  input: { flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none' },
  sendBtn: { backgroundColor: '#2196F3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }
};

export default SafetyChatbot;
