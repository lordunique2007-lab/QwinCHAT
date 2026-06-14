import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';

export default function StoriesPanel() {
  const { user } = useStore();
  const [stories, setStories] = useState([]);
  const [myStories, setMyStories] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({ type: 'text', content: '', background_color: '#00D4AA' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [feed, mine] = await Promise.all([
        axios.get('/api/stories/feed'),
        axios.get('/api/stories/mine')
      ]);
      setStories(feed.data);
      setMyStories(mine.data);
    } catch {}
  };

  const createStory = async () => {
    if (!form.content.trim()) { toast.error('Story content required'); return; }
    try {
      await axios.post('/api/stories/create', form);
      toast.success('Story posted! ✨');
      setShowCreate(false);
      setForm({ type: 'text', content: '', background_color: '#00D4AA' });
      load();
    } catch { toast.error('Failed to post story'); }
  };

  const viewStory = async (story) => {
    setViewing(story);
    try { await axios.post(`/api/stories/${story.id}/view`); } catch {}
  };

  const BG_COLORS = ['#00D4AA', '#0984E3', '#6C5CE7', '#E17055', '#FD79A8', '#2D3436'];

  // Group feed by user
  const byUser = {};
  stories.forEach(s => {
    if (!byUser[s.user_id]) byUser[s.user_id] = { user: s, items: [] };
    byUser[s.user_id].items.push(s);
  });

  return (
    <div className="chat-area" style={{ overflowY: 'auto' }}>
      <div style={{ height: 'var(--header-height)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif" }}>✨ Stories</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>➕ New Story</button>
      </div>

      <div style={{ padding: 24 }}>
        {/* My stories */}
        {myStories.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-secondary)' }}>My Stories</h3>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
              {myStories.map(s => (
                <div key={s.id} onClick={() => viewStory(s)} style={{
                  minWidth: 100, height: 160, borderRadius: 12, cursor: 'pointer',
                  background: s.media_url ? `url(${s.media_url}) center/cover` : (s.background_color || 'var(--qw-gradient)'),
                  display: 'flex', alignItems: 'flex-end', padding: 8, position: 'relative',
                  border: '2px solid var(--qw-primary)'
                }}>
                  {s.type === 'text' && <div style={{ color: 'white', fontSize: 11, fontWeight: 600, padding: 4 }}>{s.content?.slice(0, 40)}</div>}
                  <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 6, color: 'white' }}>👁 {s.view_count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feed */}
        <h3 style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-secondary)' }}>Recent Updates</h3>
        {Object.keys(byUser).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
            <p>No stories yet. Be the first to post!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.values(byUser).map(({ user: u, items }) => (
              <div key={u.user_id} onClick={() => viewStory(items[0])} style={{ cursor: 'pointer', textAlign: 'center' }}>
                <div style={{
                  width: 100, height: 160, borderRadius: 12,
                  background: items[0].media_url ? `url(${items[0].media_url}) center/cover` : (items[0].background_color || 'var(--qw-gradient)'),
                  display: 'flex', alignItems: 'flex-end', padding: 8,
                  border: items.some(i => !i.viewed_at) ? '2px solid var(--qw-primary)' : '2px solid var(--border)'
                }}>
                  {items[0].type === 'text' && <div style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>{items[0].content?.slice(0, 40)}</div>}
                </div>
                <div style={{ fontSize: 12, marginTop: 6, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.display_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h2 style={{ marginBottom: 16, fontFamily: "'Space Grotesk',sans-serif" }}>✨ Create Story</h2>

              <div style={{
                width: '100%', height: 240, borderRadius: 12, marginBottom: 16,
                background: form.background_color, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
              }}>
                <textarea
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="What's on your mind?"
                  style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 22, fontWeight: 600, textAlign: 'center', resize: 'none', width: '100%', outline: 'none' }}
                  rows={4}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {BG_COLORS.map(c => (
                  <div key={c} onClick={() => setForm(p => ({ ...p, background_color: c }))} style={{
                    width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: form.background_color === c ? '3px solid white' : '3px solid transparent'
                  }} />
                ))}
              </div>

              <button className="btn-primary" onClick={createStory} style={{ width: '100%', justifyContent: 'center' }}>Post Story (24h)</button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer */}
      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div style={{
            width: 360, height: 600, borderRadius: 16, position: 'relative', overflow: 'hidden',
            background: viewing.media_url ? `url(${viewing.media_url}) center/cover` : (viewing.background_color || 'var(--qw-gradient)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
          }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: 12, left: 12, right: 12, height: 3, background: 'rgba(255,255,255,0.3)', borderRadius: 99 }}>
              <div style={{ height: '100%', background: 'white', borderRadius: 99, animation: 'progress 5s linear forwards' }} />
            </div>
            <button onClick={() => setViewing(null)} style={{ position: 'absolute', top: 20, right: 12, background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            {viewing.type === 'text' && <div style={{ color: 'white', fontSize: 28, fontWeight: 700, textAlign: 'center' }}>{viewing.content}</div>}
          </div>
        </div>
      )}

      <style>{`@keyframes progress { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
}
