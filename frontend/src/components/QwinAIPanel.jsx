import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function QwinAIPanel() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm QwinAI 🤖 — your built-in assistant. I can answer questions, translate text, summarize chats, and suggest replies. How can I help?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('chat'); // chat, translate
  const [targetLang, setTargetLang] = useState('Spanish');
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      if (mode === 'translate') {
        const { data } = await axios.post('/api/ai/translate', { text: input, target_language: targetLang });
        setMessages(prev => [...prev, { role: 'assistant', content: `🌐 ${targetLang}: ${data.translation}` }]);
      } else {
        const { data } = await axios.post('/api/ai/chat', { message: input });
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      toast.error('QwinAI is unavailable');
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-area">
      <div style={{ height: 'var(--header-height)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--qw-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🤖</div>
        <div>
          <div style={{ fontWeight: 700 }}>QwinAI</div>
          <div style={{ fontSize: 12, color: 'var(--qw-primary)' }}>● Always online</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('chat')} className={mode === 'chat' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 12, padding: '8px 14px' }}>💬 Chat</button>
          <button onClick={() => setMode('translate')} className={mode === 'translate' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 12, padding: '8px 14px' }}>🌐 Translate</button>
        </div>
      </div>

      {mode === 'translate' && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Translate to:</span>
          <select className="input-field" style={{ width: 160 }} value={targetLang} onChange={e => setTargetLang(e.target.value)}>
            {['Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Arabic', 'Portuguese', 'Hindi', 'Russian', 'Korean'].map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
      )}

      <div className="messages-container">
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div className={`message-bubble ${m.role === 'user' ? 'sent' : 'received'}`} style={{ maxWidth: '75%', whiteSpace: 'pre-wrap' }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message-bubble received" style={{ maxWidth: 100 }}>
            <span className="fade-in">🤖 typing...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <input className="input-field" placeholder={mode === 'translate' ? 'Enter text to translate...' : 'Ask QwinAI anything...'}
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()} />
        <button onClick={send} className="btn-primary" style={{ width: 44, height: 44, borderRadius: '50%', justifyContent: 'center', padding: 0, fontSize: 18 }}>➤</button>
      </div>
    </div>
  );
}
