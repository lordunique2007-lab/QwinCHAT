import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import { format, isToday, isYesterday } from 'date-fns';

function Avatar({ user, size = 40 }) {
  const initials = (user?.display_name || user?.username || '?').slice(0, 2).toUpperCase();
  return user?.avatar_url
    ? <img src={user.avatar_url} alt="" className="avatar" style={{ width: size, height: size }} />
    : <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: 'var(--qw-gradient)' }}>{initials}</div>;
}

function dateLabel(date) {
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

function MessageBubble({ msg, isOwn, onReply, onEdit, onDelete, onReact, onPin, onStar }) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content || '');

  const renderContent = () => {
    if (msg.is_deleted_for_all) return <em style={{ opacity: 0.6 }}>🚫 This message was deleted</em>;
    switch (msg.type) {
      case 'image':
        return <img src={msg.media_url} alt="" style={{ maxWidth: 280, borderRadius: 12, display: 'block' }} />;
      case 'video':
        return <video src={msg.media_url} controls style={{ maxWidth: 280, borderRadius: 12 }} />;
      case 'voice':
      case 'audio':
        return <audio src={msg.media_url} controls style={{ width: 240 }} />;
      case 'document':
        return <a href={msg.media_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>📄 {msg.content || 'Document'}</a>;
      case 'sticker':
        return <img src={msg.media_url} alt="" style={{ width: 100, height: 100 }} />;
      case 'location':
        return <div>📍 Location shared</div>;
      default:
        return <span>{msg.content}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', gap: 8, marginBottom: 6, alignItems: 'flex-end' }}
      onMouseEnter={() => setShowMenu(true)} onMouseLeave={() => setShowMenu(false)}>
      {!isOwn && <Avatar user={msg} size={28} />}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', position: 'relative', maxWidth: '70%' }}>
        {!isOwn && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2, marginLeft: 4 }}>{msg.display_name}</span>}

        {msg.reply_content && (
          <div style={{ fontSize: 11, padding: '4px 10px', borderLeft: '2px solid var(--qw-primary)', background: 'var(--bg-card)', borderRadius: 6, marginBottom: 2, opacity: 0.8, maxWidth: '100%' }}>
            <strong>{msg.reply_sender_name}</strong>: {msg.reply_content?.slice(0, 50)}
          </div>
        )}

        {editing ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input className="input-field" value={editText} onChange={e => setEditText(e.target.value)} style={{ fontSize: 13, padding: '6px 10px' }} autoFocus />
            <button onClick={() => { onEdit(msg.id, editText); setEditing(false); }} style={{ background: 'var(--qw-primary)', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>✓</button>
          </div>
        ) : (
          <div className={`message-bubble ${isOwn ? 'sent' : 'received'}`}>
            {renderContent()}
            {msg.is_edited && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 6 }}>(edited)</span>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{format(new Date(msg.created_at), 'HH:mm')}</span>
          {msg.is_pinned && <span style={{ fontSize: 10 }}>📌</span>}
          {msg.is_starred && <span style={{ fontSize: 10 }}>⭐</span>}
        </div>

        {showMenu && !msg.is_deleted_for_all && (
          <div className="glass fade-in" style={{
            position: 'absolute', top: -36, [isOwn ? 'right' : 'left']: 0,
            display: 'flex', gap: 2, borderRadius: 8, padding: 4, zIndex: 10
          }}>
            <button onClick={() => onReact(msg.id, '👍')} title="React" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 }}>👍</button>
            <button onClick={() => onReply(msg)} title="Reply" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 }}>↩️</button>
            <button onClick={() => onStar(msg.id, !msg.is_starred)} title="Star" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 }}>⭐</button>
            <button onClick={() => onPin(msg.id, !msg.is_pinned)} title="Pin" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 }}>📌</button>
            {isOwn && <button onClick={() => setEditing(true)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 }}>✏️</button>}
            {isOwn && <button onClick={() => onDelete(msg.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 }}>🗑️</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatWindow() {
  const { user, activeChat, messages, setMessages, addMessage, updateMessage, socket, typingUsers, onlineUsers } = useStore();
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (activeChat) loadMessages();
  }, [activeChat]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;
    const onNewMessage = (msg) => {
      const matches =
        (activeChat?.type === 'conversation' && msg.conversation_id === activeChat.id) ||
        (activeChat?.type === 'group' && msg.group_id === activeChat.id) ||
        (activeChat?.type === 'channel' && msg.channel_id === activeChat.id);
      if (matches) addMessage(msg);
    };
    socket.on('message:new', onNewMessage);
    socket.on('message:sent', onNewMessage);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:sent', onNewMessage);
    };
  }, [socket, activeChat]);

  const loadMessages = async () => {
    try {
      let url;
      if (activeChat.type === 'conversation') url = `/api/messages/conversations/${activeChat.id}/messages`;
      else if (activeChat.type === 'group') url = `/api/messages/groups/${activeChat.id}/messages`;
      else url = `/api/channels/${activeChat.id}/messages`;

      const { data } = await axios.get(url);
      setMessages(data);
      if (socket && activeChat.type === 'conversation') socket.emit('conversation:join', activeChat.id);
    } catch {}
  };

  const send = () => {
    if (!input.trim() && !replyTo) return;
    const payload = {
      content: input.trim(),
      type: 'text',
      reply_to_id: replyTo?.id || null,
    };
    if (activeChat.type === 'conversation') payload.conversation_id = activeChat.id;
    if (activeChat.type === 'group') payload.group_id = activeChat.id;
    if (activeChat.type === 'channel') payload.channel_id = activeChat.id;

    socket.emit('message:send', payload);
    setInput('');
    setReplyTo(null);
  };

  const handleTyping = (val) => {
    setInput(val);
    if (!socket) return;
    const payload = {};
    if (activeChat.type === 'conversation') payload.conversation_id = activeChat.id;
    if (activeChat.type === 'group') payload.group_id = activeChat.id;
    socket.emit('typing:start', payload);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit('typing:stop', payload), 1500);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // In production, upload to S3/R2 and get URL. Here, use a data URL for demo.
    const reader = new FileReader();
    reader.onload = () => {
      const type = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'document';
      const payload = { content: file.name, type, media_url: reader.result };
      if (activeChat.type === 'conversation') payload.conversation_id = activeChat.id;
      if (activeChat.type === 'group') payload.group_id = activeChat.id;
      if (activeChat.type === 'channel') payload.channel_id = activeChat.id;
      socket.emit('message:send', payload);
    };
    reader.readAsDataURL(file);
    setShowAttach(false);
  };

  const handleEdit = async (id, content) => {
    try {
      await axios.put(`/api/messages/${id}/edit`, { content });
      updateMessage(id, { content, is_edited: true });
    } catch { toast.error('Failed to edit'); }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/messages/${id}?for_everyone=true`);
      updateMessage(id, { is_deleted_for_all: true, content: null, media_url: null });
    } catch { toast.error('Failed to delete'); }
  };

  const handleReact = (id, emoji) => socket?.emit('message:react', { message_id: id, emoji });
  const handlePin = async (id, is_pinned) => { await axios.put(`/api/messages/${id}/pin`, { is_pinned }); updateMessage(id, { is_pinned }); };
  const handleStar = async (id, is_starred) => { await axios.put(`/api/messages/${id}/star`, { is_starred }); updateMessage(id, { is_starred }); };

  if (!activeChat) {
    return (
      <div className="chat-area" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>💬</div>
          <h2 className="gradient-text" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 28, marginBottom: 8 }}>Welcome to QwinCHAT</h2>
          <p>Select a chat to start messaging, or search for someone new</p>
        </div>
      </div>
    );
  }

  const chatName = activeChat.type === 'conversation' ? activeChat.data?.other_name : activeChat.data?.name;
  const chatAvatar = activeChat.type === 'conversation' ? activeChat.data?.other_avatar : activeChat.data?.avatar_url;
  const otherId = activeChat.data?.other_id;
  const isOnline = otherId && onlineUsers.has(otherId);
  const typing = typingUsers[activeChat.id] || [];

  // Group messages by date
  const grouped = [];
  let lastDate = null;
  messages.forEach(m => {
    const d = format(new Date(m.created_at), 'yyyy-MM-dd');
    if (d !== lastDate) { grouped.push({ type: 'date', date: m.created_at }); lastDate = d; }
    grouped.push({ type: 'msg', msg: m });
  });

  return (
    <div className="chat-area">
      {/* Header */}
      <div style={{ height: 'var(--header-height)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <Avatar user={{ display_name: chatName, avatar_url: chatAvatar }} size={42} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 4 }}>
            {chatName}
            {activeChat.data?.other_verified && <span className="verified-badge">✓</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {activeChat.type === 'group' ? `${activeChat.data?.member_count || 0} members` :
             activeChat.type === 'channel' ? `${activeChat.data?.subscriber_count || 0} subscribers` :
             isOnline ? <span style={{ color: 'var(--qw-primary)' }}>● Online</span> : 'Offline'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ background: 'var(--bg-input)', border: 'none', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }} title="Voice call">📞</button>
          <button style={{ background: 'var(--bg-input)', border: 'none', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }} title="Video call">📹</button>
          <button style={{ background: 'var(--bg-input)', border: 'none', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }} title="Search">🔍</button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {grouped.map((item, i) => item.type === 'date' ? (
          <div key={i} style={{ textAlign: 'center', margin: '12px 0' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: 99 }}>{dateLabel(item.date)}</span>
          </div>
        ) : (
          <MessageBubble key={item.msg.id} msg={item.msg} isOwn={item.msg.sender_id === user.id}
            onReply={setReplyTo} onEdit={handleEdit} onDelete={handleDelete} onReact={handleReact} onPin={handlePin} onStar={handleStar} />
        ))}
        {typing.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 8px', fontStyle: 'italic' }}>
            {typing.map(t => t.display_name).join(', ')} typing...
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12 }}><strong>Replying to {replyTo.display_name}</strong>: {replyTo.content?.slice(0, 60)}</div>
          <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', position: 'relative' }}>
        <button onClick={() => setShowAttach(!showAttach)} style={{ background: 'var(--bg-input)', border: 'none', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', fontSize: 18 }}>📎</button>
        {showAttach && (
          <div className="glass scale-in" style={{ position: 'absolute', bottom: 60, left: 16, borderRadius: 12, padding: 8, display: 'flex', gap: 8, zIndex: 20 }}>
            <button onClick={() => fileInputRef.current.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 8 }} title="Image/Video">🖼️</button>
            <button onClick={() => fileInputRef.current.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 8 }} title="Document">📄</button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 8 }} title="Location">📍</button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 8 }} title="Poll">📊</button>
          </div>
        )}
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />

        <input className="input-field" placeholder="Type a message..." value={input}
          onChange={e => handleTyping(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />

        <button onClick={send} className="btn-primary" style={{ width: 44, height: 44, borderRadius: '50%', justifyContent: 'center', padding: 0, fontSize: 18 }}>➤</button>
      </div>
    </div>
  );
}
