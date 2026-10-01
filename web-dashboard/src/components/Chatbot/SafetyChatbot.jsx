import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';

const initialMessages = [
  { text: 'Hello! I\'m your Campus Security Assistant. How can I help?', sender: 'bot' }
];

const quickRepliesByRole = {
  student: ['How do I report an incident?', 'What does In Progress mean?', 'What is my latest incident status?', 'How do I send SOS?'],
  faculty: ['How do I report an incident?', 'What does In Progress mean?', 'What should I do during a fire?'],
  staff: ['How do I report an incident?', 'What does In Progress mean?', 'What should I do during an emergency?'],
  security: ['What incidents are assigned to me?', 'What does On Scene mean?', 'How does the response workflow work?'],
  admin: ['What are the current incident statistics?', 'How does officer assignment work?', 'How does the security workflow work?']
};

const SafetyChatbot = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [layoutBounds, setLayoutBounds] = useState({ top: 88, bottom: 12 });
  const messagesEndRef = useRef(null);
  const requestIdRef = useRef(0);

  const quickReplies = quickRepliesByRole[user?.role] || quickRepliesByRole.student;

  const sendMessage = async (message = input) => {
    const userMessage = message.trim();
    if (!userMessage || loading) return;
    const requestId = ++requestIdRef.current;
    setInput('');
    setError('');
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setLoading(true);
    try {
      const response = await api.post('/assistant/chat', { message: userMessage }, { timeout: 190000 });
      if (requestId === requestIdRef.current) {
        setMessages(prev => [...prev, { text: response.data.message, sender: 'bot', source: response.data.source }]);
      }
    } catch (requestError) {
      if (requestId === requestIdRef.current) {
        setError(requestError.response?.data?.message || (requestError.code === 'ECONNABORTED'
          ? 'The assistant request timed out. Please try again.'
          : 'The assistant is temporarily unavailable.'));
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const clearChat = () => {
    requestIdRef.current += 1;
    setMessages(initialMessages);
    setInput('');
    setError('');
    setLoading(false);
  };

  useEffect(() => {
    const header = document.querySelector('.dashboard-header');
    const footer = document.querySelector('.dashboard-app > .public-footer');
    const updateLayoutBounds = () => {
      const headerBottom = header?.getBoundingClientRect().bottom ?? 76;
      const footerTop = footer?.getBoundingClientRect().top;
      const footerClearance = footerTop !== undefined && footerTop < window.innerHeight
        ? Math.max(12, window.innerHeight - footerTop + 12)
        : 12;
      setLayoutBounds({ top: Math.max(12, headerBottom + 12), bottom: footerClearance });
    };

    updateLayoutBounds();
    window.addEventListener('resize', updateLayoutBounds);
    window.addEventListener('scroll', updateLayoutBounds, true);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateLayoutBounds);
    if (header) resizeObserver?.observe(header);
    if (footer) resizeObserver?.observe(footer);

    return () => {
      window.removeEventListener('resize', updateLayoutBounds);
      window.removeEventListener('scroll', updateLayoutBounds, true);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ ...styles.chatButton, bottom: `${Math.max(30, layoutBounds.bottom + 12)}px` }}
        aria-label="Open AI Security Assistant"
      >
        💬
      </button>
      {isOpen && (
        <div style={{ ...styles.chatWindow, top: `${layoutBounds.top}px`, bottom: `${layoutBounds.bottom}px` }}>
          <div style={styles.chatHeader}>
            <span style={styles.chatTitle}>🤖 AI Security Assistant</span>
            <button type="button" onClick={clearChat} style={styles.clearBtn}>Clear</button>
            <button type="button" onClick={() => setIsOpen(false)} style={styles.closeBtn} aria-label="Close assistant">✕</button>
          </div>
          <div style={styles.chatMessages}>
            {messages.map((msg, index) => (
              <div key={index} style={{...styles.message, alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', backgroundColor: msg.sender === 'user' ? '#2196F3' : '#f5f5f5', color: msg.sender === 'user' ? 'white' : '#333'}}>
                {msg.text}
              </div>
            ))}
            {loading && <div style={{...styles.message, alignSelf: 'flex-start', backgroundColor: '#f5f5f5'}}>Generating a response…</div>}
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
  chatWindow: { position: 'fixed', right: 'max(12px, env(safe-area-inset-right))', width: 'min(380px, calc(100vw - 24px))', maxWidth: 'calc(100vw - 24px)', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000 },
  chatHeader: { padding: '12px', backgroundColor: '#2196F3', color: 'white', borderRadius: '12px 12px 0 0', display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 'bold' },
  chatTitle: { flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere' },
  clearBtn: { flex: '0 0 auto', minHeight: '40px', padding: '8px 12px', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer' },
  closeBtn: { flex: '0 0 auto', minWidth: '40px', minHeight: '40px', background: 'none', border: 'none', borderRadius: '6px', color: 'white', fontSize: '20px', cursor: 'pointer' },
  chatMessages: { padding: '15px', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: '8px' },
  message: { padding: '10px 15px', borderRadius: '18px', maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'pre-line' },
  error: { padding: '8px 10px', color: '#b42318', backgroundColor: '#fef3f2', borderRadius: '8px', fontSize: '12px' },
  quickReplies: { padding: '10px', maxHeight: '22vh', overflowY: 'auto', flex: '0 1 auto', display: 'flex', flexWrap: 'wrap', gap: '5px', borderTop: '1px solid #eee' },
  quickReplyBtn: { maxWidth: '100%', backgroundColor: '#e3f2fd', border: '1px solid #2196F3', borderRadius: '20px', padding: '7px 12px', fontSize: '12px', cursor: 'pointer', color: '#2196F3', overflowWrap: 'anywhere' },
  chatInput: { padding: '10px', display: 'flex', gap: '8px', borderTop: '1px solid #eee' },
  input: { flex: '1 1 0', minWidth: 0, width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none' },
  sendBtn: { flex: '0 0 auto', backgroundColor: '#2196F3', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer' }
};

export default SafetyChatbot;
