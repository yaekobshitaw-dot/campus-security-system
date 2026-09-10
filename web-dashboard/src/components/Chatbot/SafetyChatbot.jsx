import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';

const quickRepliesByRole = {
  student: ['How do I report an incident?', 'What does In Progress mean?', 'What is my latest incident status?', 'How do I send SOS?'],
  faculty: ['How do I report an incident?', 'What does In Progress mean?', 'What should I do during a fire?'],
  staff: ['How do I report an incident?', 'What does In Progress mean?', 'What should I do during an emergency?'],
  security: ['What incidents are assigned to me?', 'What does On Scene mean?', 'How does the response workflow work?'],
  admin: ['What are the current incident statistics?', 'How does officer assignment work?', 'How does the security workflow work?']
};

const SafetyChatbot = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: 'Hello! I\'m your Campus Security Assistant. How can I help?', sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const quickReplies = quickRepliesByRole[user?.role] || quickRepliesByRole.student;

  const sendMessage = async (message = input) => {
    const userMessage = message.trim();
    if (!userMessage || loading) return;
    setInput('');
    setError('');
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setLoading(true);
    try {
      const response = await api.post('/assistant/chat', { message: userMessage });
      setMessages(prev => [...prev, { text: response.data.message, sender: 'bot', source: response.data.source }]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The assistant is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(!isOpen)} style={styles.chatButton} aria-label="Open AI Security Assistant">💬</button>
      {isOpen && (
        <div style={styles.chatWindow}>
          <div style={styles.chatHeader}>
            <span>🤖 AI Security Assistant</span>
            <button type="button" onClick={() => setIsOpen(false)} style={styles.closeBtn} aria-label="Close assistant">✕</button>
          </div>
          <div style={styles.chatMessages}>
            {messages.map((msg, index) => (
              <div key={index} style={{...styles.message, alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', backgroundColor: msg.sender === 'user' ? '#2196F3' : '#f5f5f5', color: msg.sender === 'user' ? 'white' : '#333'}}>
                {msg.text}
              </div>
            ))}
            {loading && <div style={{...styles.message, alignSelf: 'flex-start', backgroundColor: '#f5f5f5'}}>Typing...</div>}
            {error && <div role="alert" style={styles.error}>{error}</div>}
            <div ref={messagesEndRef} />
          </div>
          <div style={styles.quickReplies}>
            {quickReplies.map((reply) => (
              <button type="button" key={reply} onClick={() => sendMessage(reply)} style={styles.quickReplyBtn} disabled={loading}>
                {reply}
              </button>
            ))}
          </div>
          <div style={styles.chatInput}>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Ask a security question..." style={styles.input} maxLength={2000} disabled={loading} />
            <button type="button" onClick={() => sendMessage()} style={styles.sendBtn} disabled={loading || !input.trim()}>Send</button>
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
  error: { padding: '8px 10px', color: '#b42318', backgroundColor: '#fef3f2', borderRadius: '8px', fontSize: '12px' },
  quickReplies: { padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px', borderTop: '1px solid #eee' },
  quickReplyBtn: { backgroundColor: '#e3f2fd', border: '1px solid #2196F3', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', color: '#2196F3' },
  chatInput: { padding: '10px', display: 'flex', gap: '10px', borderTop: '1px solid #eee' },
  input: { flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none' },
  sendBtn: { backgroundColor: '#2196F3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }
};

export default SafetyChatbot;
