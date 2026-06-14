import { create } from 'zustand';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '';

// Set up axios defaults
axios.defaults.baseURL = API;

const useStore = create((set, get) => ({
  // Auth
  user: null,
  token: localStorage.getItem('qw_token'),
  isAuthLoading: true,

  setToken: (token) => {
    localStorage.setItem('qw_token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    set({ token });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem('qw_token');
    delete axios.defaults.headers.common['Authorization'];
    set({ user: null, token: null, conversations: [], groups: [], activeChat: null });
  },

  initAuth: async () => {
    const token = localStorage.getItem('qw_token');
    if (!token) { set({ isAuthLoading: false }); return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try {
      const { data } = await axios.get('/api/auth/me');
      set({ user: data, isAuthLoading: false });
    } catch {
      localStorage.removeItem('qw_token');
      set({ isAuthLoading: false, token: null });
    }
  },

  // Socket
  socket: null,
  setSocket: (socket) => set({ socket }),

  // Active chat
  activeChat: null, // { type: 'conversation'|'group'|'channel', id, data }
  setActiveChat: (chat) => set({ activeChat: chat, messages: [], unreadCounts: { ...get().unreadCounts, [chat?.id]: 0 } }),

  // Conversations
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  updateConversation: (conv) => set(state => ({
    conversations: state.conversations.map(c => c.id === conv.id ? { ...c, ...conv } : c)
  })),

  // Groups
  groups: [],
  setGroups: (groups) => set({ groups }),

  // Channels
  channels: [],
  setChannels: (channels) => set({ channels }),

  // Messages
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set(state => ({ messages: [...state.messages, msg] })),
  updateMessage: (id, updates) => set(state => ({
    messages: state.messages.map(m => m.id === id ? { ...m, ...updates } : m)
  })),

  // Unread counts
  unreadCounts: {},
  incrementUnread: (chatId) => set(state => ({
    unreadCounts: { ...state.unreadCounts, [chatId]: (state.unreadCounts[chatId] || 0) + 1 }
  })),

  // Typing
  typingUsers: {}, // chatId -> [{user_id, display_name}]
  setTyping: (chatId, user, isTyping) => set(state => {
    const current = state.typingUsers[chatId] || [];
    const filtered = current.filter(u => u.user_id !== user.user_id);
    return { typingUsers: { ...state.typingUsers, [chatId]: isTyping ? [...filtered, user] : filtered } };
  }),

  // Online users
  onlineUsers: new Set(),
  setUserOnline: (userId, online) => set(state => {
    const s = new Set(state.onlineUsers);
    online ? s.add(userId) : s.delete(userId);
    return { onlineUsers: s };
  }),

  // UI
  theme: localStorage.getItem('qw_theme') || 'dark',
  setTheme: (theme) => {
    localStorage.setItem('qw_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  activePanel: 'chats', // 'chats'|'groups'|'channels'|'stories'|'ai'|'settings'|'admin'
  setActivePanel: (panel) => set({ activePanel: panel }),

  showNewChat: false,
  setShowNewChat: (show) => set({ showNewChat: show }),

  // Active call
  activeCall: null,
  setActiveCall: (call) => set({ activeCall: call }),
}));

export default useStore;
