import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client';
import useStore from './store/useStore';
import { AuthPage } from './pages/AuthPage';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import SettingsPanel from './components/SettingsPanel';
import QwinAIPanel from './components/QwinAIPanel';
import AdminPanel from './components/AdminPanel';
import StoriesPanel from './components/StoriesPanel';
import NewChatModal from './components/NewChatModal';
import './styles/globals.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || '';

export default function App() {
  const { user, token, isAuthLoading, initAuth, theme, setSocket, socket, setUserOnline, setTyping, updateConversation, incrementUnread, activeChat, activePanel } = useStore();

  useEffect(() => {
    initAuth();
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  // Connect socket when authenticated
  useEffect(() => {
    if (!user || !token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => console.log('🔌 Connected to QwinCHAT'));
    newSocket.on('connect_error', (err) => console.error('Socket error:', err.message));

    newSocket.on('user:status', ({ user_id, status }) => {
      setUserOnline(user_id, status === 'online');
    });

    newSocket.on('typing:start', (data) => {
      if (activeChat) setTyping(activeChat.id, data, true);
    });
    newSocket.on('typing:stop', (data) => {
      if (activeChat) setTyping(activeChat.id, data, false);
    });

    newSocket.on('message:new', (msg) => {
      const chatId = msg.conversation_id || msg.group_id || msg.channel_id;
      if (activeChat?.id !== chatId) {
        incrementUnread(chatId);
      }
      if (msg.conversation_id) {
        updateConversation({ id: msg.conversation_id, last_message: msg.content, last_message_at: msg.created_at });
      }
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [user, token]);

  if (isAuthLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="gradient-text" style={{ fontSize: 32, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700 }}>
          💬 QwinCHAT
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-center" toastOptions={{ style: { background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' } }} />
        <AuthPage />
      </>
    );
  }

  const renderMainPanel = () => {
    if (activePanel === 'settings') return <SettingsPanel />;
    if (activePanel === 'ai') return <QwinAIPanel />;
    if (activePanel === 'admin') return <AdminPanel />;
    if (activePanel === 'stories') return <StoriesPanel />;
    return <ChatWindow />;
  };

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' } }} />
      <div className="app-layout">
        <Sidebar />
        {renderMainPanel()}
      </div>
      <NewChatModal />
    </>
  );
}
