import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';

export default function NewChatModal() {
  const { showNewChat, setShowNewChat, setGroups, setActivePanel } = useStore();
  const [tab, setTab] = useState('group');
  const [groupForm, setGroupForm] = useState({ name: '', description: '', type: 'private' });
  const [channelForm, setChannelForm] = useState({ name: '', description: '', type: 'public' });

  if (!showNewChat) return null;

  const close = () => setShowNewChat(false);

  const createGroup = async () => {
    if (!groupForm.name.trim()) { toast.error('Group name required'); return; }
    try {
      await axios.post('/api/groups/create', groupForm);
      toast.success('Group created! 🎉');
      setActivePanel('groups');
      const { data } = await axios.get('/api/groups/my');
      setGroups(data);
      close();
      setGroupForm({ name: '', description: '', type: 'private' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create group'); }
  };

  const createChannel = async () => {
    if (!channelForm.name.trim()) { toast.error('Channel name required'); return; }
    try {
      await axios.post('/api/channels/create', channelForm);
      toast.success('Channel created! 📢');
      setActivePanel('channels');
      close();
      setChannelForm({ name: '', description: '', type: 'public' });
    } catch { toast.error('Failed to create channel'); }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif" }}>✨ Create New</h2>
            <button onClick={close} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={() => setTab('group')} className={tab === 'group' ? 'btn-primary' : 'btn-ghost'} style={{ flex: 1, justifyContent: 'center' }}>👥 Group</button>
            <button onClick={() => setTab('channel')} className={tab === 'channel' ? 'btn-primary' : 'btn-ghost'} style={{ flex: 1, justifyContent: 'center' }}>📢 Channel</button>
          </div>

          {tab === 'group' && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Group Name *</label>
                <input className="input-field" value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} placeholder="My Awesome Group" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Description</label>
                <textarea className="input-field" rows={3} value={groupForm.description} onChange={e => setGroupForm(p => ({ ...p, description: e.target.value }))} placeholder="What's this group about?" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['private', 'public'].map(t => (
                    <button key={t} onClick={() => setGroupForm(p => ({ ...p, type: t }))}
                      className={groupForm.type === t ? 'btn-primary' : 'btn-ghost'} style={{ flex: 1, justifyContent: 'center', textTransform: 'capitalize' }}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                💡 New groups start with a 10-member capacity. Use points to upgrade!
              </div>
              <button className="btn-primary" onClick={createGroup} style={{ width: '100%', justifyContent: 'center' }}>Create Group</button>
            </div>
          )}

          {tab === 'channel' && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Channel Name *</label>
                <input className="input-field" value={channelForm.name} onChange={e => setChannelForm(p => ({ ...p, name: e.target.value }))} placeholder="My Channel" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Description</label>
                <textarea className="input-field" rows={3} value={channelForm.description} onChange={e => setChannelForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['public', 'private'].map(t => (
                    <button key={t} onClick={() => setChannelForm(p => ({ ...p, type: t }))}
                      className={channelForm.type === t ? 'btn-primary' : 'btn-ghost'} style={{ flex: 1, justifyContent: 'center', textTransform: 'capitalize' }}>{t}</button>
                  ))}
                </div>
              </div>
              <button className="btn-primary" onClick={createChannel} style={{ width: '100%', justifyContent: 'center' }}>Create Channel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
