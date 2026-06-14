import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';

const ACCENT_COLORS = ['#00D4AA', '#0984E3', '#6C5CE7', '#FD79A8', '#FDCB6E', '#E17055'];

export default function SettingsPanel() {
  const { user, setUser, theme, setTheme, logout } = useStore();
  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    custom_status: user?.custom_status || '',
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [rewards, setRewards] = useState(null);
  const [tab, setTab] = useState('profile');

  React.useEffect(() => { loadRewards(); }, []);

  const loadRewards = async () => {
    try {
      const { data } = await axios.get('/api/users/rewards/info');
      setRewards(data);
    } catch {}
  };

  const saveProfile = async () => {
    try {
      const { data } = await axios.put('/api/users/profile/update', form);
      setUser(data);
      toast.success('Profile updated!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update'); }
  };

  const changeTheme = async (t) => {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    try { await axios.put('/api/users/profile/update', { theme: t }); } catch {}
  };

  const changeAccent = async (color) => {
    document.documentElement.style.setProperty('--qw-primary', color);
    try {
      await axios.put('/api/users/profile/update', { accent_color: color });
      setUser({ ...user, accent_color: color });
    } catch {}
  };

  const changePassword = async () => {
    try {
      await axios.put('/api/auth/password', pwForm);
      toast.success('Password changed!');
      setPwForm({ current_password: '', new_password: '' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const claimDaily = async () => {
    try {
      const { data } = await axios.post('/api/users/rewards/daily');
      toast.success(data.message);
      loadRewards();
      setUser({ ...user, points: (user.points || 0) + 2 });
    } catch (err) { toast.error(err.response?.data?.error || 'Already claimed today'); }
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(rewards?.referral_code || '');
    toast.success('Referral code copied!');
  };

  const Avatar = () => {
    const initials = (user?.display_name || '?').slice(0, 2).toUpperCase();
    return user?.avatar_url
      ? <img src={user.avatar_url} alt="" className="avatar" style={{ width: 80, height: 80 }} />
      : <div className="avatar" style={{ width: 80, height: 80, fontSize: 28 }}>{initials}</div>;
  };

  const TABS = [
    { id: 'profile', label: '👤 Profile' },
    { id: 'appearance', label: '🎨 Appearance' },
    { id: 'privacy', label: '🔒 Privacy' },
    { id: 'rewards', label: '🎁 Rewards' },
    { id: 'security', label: '🛡️ Security' },
  ];

  return (
    <div className="chat-area" style={{ overflowY: 'auto' }}>
      <div style={{ height: 'var(--header-height)', display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h2 style={{ fontSize: 18, fontFamily: "'Space Grotesk',sans-serif" }}>Settings</h2>
      </div>

      <div style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid var(--border)', gap: 4, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.id ? 'var(--qw-primary)' : 'var(--text-secondary)',
            borderBottom: tab === t.id ? '2px solid var(--qw-primary)' : '2px solid transparent',
            fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap'
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 600 }}>
        {tab === 'profile' && (
          <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <Avatar />
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, display: 'flex', gap: 6, alignItems: 'center' }}>
                  {user?.display_name}
                  {user?.is_verified && <span className="verified-badge">✓</span>}
                  {user?.is_premium && <span className="premium-badge">⭐ Premium</span>}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>@{user?.username}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--qw-primary)' }}>Role: {user?.role}</div>
              </div>
            </div>

            {[
              { label: 'Display Name', key: 'display_name' },
              { label: 'Username', key: 'username' },
              { label: 'Bio', key: 'bio' },
              { label: 'Custom Status', key: 'custom_status', placeholder: 'e.g. "Busy 🔥"' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input className="input-field" value={form[f.key]} placeholder={f.placeholder}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <button className="btn-primary" onClick={saveProfile}>💾 Save Changes</button>
          </div>
        )}

        {tab === 'appearance' && (
          <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Theme</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {[{ id: 'dark', label: '🌙 Dark', bg: '#0A0E1A' }, { id: 'light', label: '☀️ Light', bg: '#F0F4FF' }, { id: 'amoled', label: '⚫ AMOLED', bg: '#000000' }].map(t => (
                <div key={t.id} onClick={() => changeTheme(t.id)} style={{
                  flex: 1, padding: 16, borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                  border: theme === t.id ? '2px solid var(--qw-primary)' : '2px solid var(--border)',
                  background: t.bg, color: t.id === 'light' ? '#000' : '#fff'
                }}>{t.label}</div>
              ))}
            </div>

            <h3 style={{ marginBottom: 16 }}>Accent Color</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              {ACCENT_COLORS.map(c => (
                <div key={c} onClick={() => changeAccent(c)} style={{
                  width: 40, height: 40, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: user?.accent_color === c ? '3px solid white' : '3px solid transparent',
                  boxShadow: user?.accent_color === c ? `0 0 0 2px ${c}` : 'none'
                }} />
              ))}
            </div>
          </div>
        )}

        {tab === 'privacy' && (
          <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Privacy Controls</h3>
            {['Last Seen', 'Profile Photo', 'About', 'Groups'].map(label => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{label}</span>
                <select className="input-field" style={{ width: 140 }} defaultValue="everyone">
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <button className="btn-ghost">🔐 Manage Active Sessions</button>
            </div>
          </div>
        )}

        {tab === 'rewards' && (
          <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="gradient-text" style={{ fontSize: 48, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif" }}>{rewards?.points ?? 0}</div>
              <div style={{ color: 'var(--text-secondary)' }}>Points</div>
            </div>

            <button className="btn-primary" onClick={claimDaily} disabled={!rewards?.can_claim_daily} style={{ width: '100%', justifyContent: 'center', marginBottom: 20, opacity: rewards?.can_claim_daily ? 1 : 0.5 }}>
              {rewards?.can_claim_daily ? '🎁 Claim Daily Reward (+2 points)' : '✅ Daily Reward Claimed'}
            </button>

            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Your Referral Code</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ fontSize: 20, fontWeight: 700, color: 'var(--qw-primary)', flex: 1 }}>{rewards?.referral_code}</code>
                <button className="btn-ghost" onClick={copyReferral}>📋 Copy</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Share this code — earn +1 point per referral!</div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: 4 }}>💡 10 points = upgrade group capacity by 50 members</div>
              <div>💡 Use points to unlock premium themes and stickers</div>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Change Password</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Current Password</label>
              <input className="input-field" type="password" value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>New Password</label>
              <input className="input-field" type="password" value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={changePassword}>🔑 Update Password</button>

            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <h3 style={{ marginBottom: 12 }}>Two-Factor Authentication</h3>
              <button className="btn-ghost">🔐 Enable 2FA</button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <button className="btn-ghost" onClick={logout} style={{ color: '#FF6B6B', borderColor: '#FF6B6B' }}>🚪 Sign Out</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
