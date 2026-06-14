import React, { useState, useEffect } from 'react';
import axios from 'axios';
import useStore from '../store/useStore';
import { formatDistanceToNow } from 'date-fns';

const NAV = [
  { id: 'chats', icon: '💬', label: 'Chats' },
  { id: 'groups', icon: '👥', label: 'Groups' },
  { id: 'channels', icon: '📢', label: 'Channels' },
  { id: 'stories', icon: '✨', label: 'Stories' },
  { id: 'ai', icon: '🤖', label: 'QwinAI' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

function Avatar({ user, size = 40 }) {
  const initials = (user?.display_name || user?.username || '?').slice(0, 2).toUpperCase();
  return user?.avatar_url
    ? <img src={user.avatar_url} alt="" className="avatar" style={{ width: size, height: size }} />
    : <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: 'var(--qw-gradient)' }}>{initials}</div>;
}

function ChatItem({ conv, isActive, onClick }) {
  const { user, unreadCounts, onlineUsers } = useStore();
  const isOnline = onlineUsers.has(conv.other_id);
  const unread = unreadCounts[conv.id] || 0;

  return (
    <div onClick={onClick} style={{
      display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer',
      background: isActive ? 'var(--bg-active)' : 'transparent',
      borderRadius: 'var(--radius-sm)', margin: '2px 8px',
      transition: 'var(--transition)'
    }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar user={{ display_name: conv.other_name, avatar_url: conv.other_avatar }} size={46} />
        {isOnline && <div className="online-dot" style={{ position: 'absolute', bottom: 1, right: 1 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
            {conv.other_name}
            {conv.other_verified && <span className="verified-badge">✓</span>}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {conv.last_message_at ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false }) : ''}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
            {conv.last_message || 'No messages yet'}
          </span>
          {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
        </div>
      </div>
    </div>
  );
}

function GroupItem({ group, isActive, onClick }) {
  const unreadCounts = useStore(s => s.unreadCounts);
  const unread = unreadCounts[group.id] || 0;
  const initials = group.name.slice(0, 2).toUpperCase();

  return (
    <div onClick={onClick} style={{
      display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer',
      background: isActive ? 'var(--bg-active)' : 'transparent',
      borderRadius: 'var(--radius-sm)', margin: '2px 8px', transition: 'var(--transition)'
    }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--qw-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
        {group.avatar_url ? <img src={group.avatar_url} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover' }} /> : initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{group.name}</span>
          {group.type === 'public' && <span style={{ fontSize: 10, color: 'var(--qw-primary)', background: 'var(--bg-active)', padding: '2px 6px', borderRadius: 4 }}>PUBLIC</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{group.member_count || 0} members</span>
          {unread > 0 && <span className="badge">{unread}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { user, conversations, groups, channels, activePanel, setActivePanel, setActiveChat, activeChat, setConversations, setGroups, setChannels, setShowNewChat, logout } = useStore();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    loadData();
  }, [activePanel]);

  const loadData = async () => {
    try {
      if (activePanel === 'chats') {
        const { data } = await axios.get('/api/messages/conversations');
        setConversations(data);
      } else if (activePanel === 'groups') {
        const { data } = await axios.get('/api/groups/my');
        setGroups(data);
      } else if (activePanel === 'channels') {
        const { data } = await axios.get('/api/channels/my');
        setChannels(data);
      }
    } catch (err) {}
  };

  useEffect(() => {
    const t = setTimeout(async () => {
      if (search.length > 1) {
        try {
          const { data } = await axios.get(`/api/users/search/query?q=${search}`);
          setSearchResults(data);
        } catch {}
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const startChat = async (userId) => {
    try {
      const { data: conv } = await axios.post('/api/messages/conversations', { other_user_id: userId });
      const userResult = searchResults.find(u => u.id === userId);
      setActiveChat({ type: 'conversation', id: conv.id, data: { ...conv, other_name: userResult?.display_name, other_avatar: userResult?.avatar_url, other_id: userId } });
      setSearch('');
      setSearchResults([]);
      loadData();
    } catch {}
  };

  return (
    <div className="sidebar">
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 24 }}>💬</div>
            <span className="gradient-text" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20 }}>QwinCHAT</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowNewChat(true)} style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }} title="New chat">✏️</button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
          <input className="input-field" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36, fontSize: 13 }} />
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {searchResults.map(u => (
              <div key={u.id} onClick={() => startChat(u.id)} style={{ display: 'flex', gap: 10, padding: '10px 12px', cursor: 'pointer', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 14, background: 'var(--qw-gradient)' }}>
                  {u.display_name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{u.display_name} {u.is_verified && '✓'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{u.username}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setActivePanel(n.id)}
            style={{
              flex: 1, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              color: activePanel === n.id ? 'var(--qw-primary)' : 'var(--text-muted)',
              borderBottom: activePanel === n.id ? '2px solid var(--qw-primary)' : '2px solid transparent',
              transition: 'var(--transition)'
            }} title={n.label}>
            {n.icon}
          </button>
        ))}
        {['admin', 'superadmin'].includes(user?.role) && (
          <button onClick={() => setActivePanel('admin')} style={{ flex: 1, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: activePanel === 'admin' ? '#F7DC6F' : 'var(--text-muted)', borderBottom: activePanel === 'admin' ? '2px solid #F7DC6F' : '2px solid transparent' }} title="Admin Panel">👑</button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
        {activePanel === 'chats' && (
          conversations.length === 0
            ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><div style={{ fontSize: 40, marginBottom: 12 }}>💬</div><div>No chats yet<br /><small>Search for someone to start chatting</small></div></div>
            : conversations.map(conv => (
                <ChatItem key={conv.id} conv={conv} isActive={activeChat?.id === conv.id}
                  onClick={() => setActiveChat({ type: 'conversation', id: conv.id, data: conv })} />
              ))
        )}

        {activePanel === 'groups' && (
          <div>
            <div style={{ padding: '8px 16px 4px' }}>
              <button className="btn-primary" onClick={() => setActivePanel('groups_create')} style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '10px' }}>
                ➕ Create Group
              </button>
            </div>
            {groups.map(g => (
              <GroupItem key={g.id} group={g} isActive={activeChat?.id === g.id}
                onClick={() => setActiveChat({ type: 'group', id: g.id, data: g })} />
            ))}
          </div>
        )}

        {activePanel === 'channels' && (
          <div>
            <div style={{ padding: '8px 16px 4px' }}>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '10px' }}>
                ➕ Create Channel
              </button>
            </div>
            {channels.map(ch => (
              <div key={ch.id} onClick={() => setActiveChat({ type: 'channel', id: ch.id, data: ch })}
                style={{ display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer', margin: '2px 8px', borderRadius: 'var(--radius-sm)', background: activeChat?.id === ch.id ? 'var(--bg-active)' : 'transparent' }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--qw-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📢</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{ch.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ch.subscriber_count} subscribers</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activePanel === 'stories' && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
            <p>Stories panel — select a story from feed</p>
          </div>
        )}

        {activePanel === 'ai' && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
            <p style={{ fontWeight: 600, color: 'var(--qw-primary)' }}>QwinAI</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Chat with AI, translate, summarize & more</p>
          </div>
        )}
      </div>

      {/* User footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setActivePanel('settings')}>
          <Avatar user={user} size={38} />
          <div className="online-dot" style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            {user?.display_name}
            {user?.is_verified && <span className="verified-badge" style={{ fontSize: 12 }}>✓</span>}
            {user?.is_premium && <span className="premium-badge">⭐</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{user?.username} · {user?.points || 0} pts</div>
        </div>
        <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }} title="Logout">🚪</button>
      </div>
    </div>
  );
}
