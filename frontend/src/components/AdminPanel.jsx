import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';

function StatCard({ icon, label, value, color }) {
  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-sm)', padding: 16, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif" }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

export default function AdminPanel() {
  const { user } = useStore();
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [tab, setTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', target: 'all' });

  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'reports') loadReports();
    if (tab === 'audit') loadAudit();
  }, [tab, search]);

  const loadStats = async () => {
    try { const { data } = await axios.get('/api/admin/stats'); setStats(data); } catch {}
  };
  const loadUsers = async () => {
    try { const { data } = await axios.get(`/api/admin/users?q=${search}`); setUsers(data.users); } catch {}
  };
  const loadReports = async () => {
    try { const { data } = await axios.get('/api/admin/reports'); setReports(data); } catch {}
  };
  const loadAudit = async () => {
    try { const { data } = await axios.get('/api/admin/audit-logs'); setAuditLogs(data); } catch {}
  };

  const banUser = async (id) => {
    const reason = prompt('Ban reason:');
    if (reason === null) return;
    try { await axios.post(`/api/admin/users/${id}/ban`, { reason }); toast.success('User banned'); loadUsers(); } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };
  const unbanUser = async (id) => {
    try { await axios.post(`/api/admin/users/${id}/unban`); toast.success('User unbanned'); loadUsers(); } catch {}
  };
  const toggleFreeze = async (id, freeze) => {
    try { await axios.post(`/api/admin/users/${id}/freeze`, { freeze }); toast.success(freeze ? 'Account frozen' : 'Account unfrozen'); loadUsers(); } catch {}
  };
  const toggleVerify = async (id, is_verified) => {
    try { await axios.post(`/api/admin/users/${id}/verify`, { is_verified }); toast.success('Verification updated'); loadUsers(); } catch {}
  };
  const togglePremium = async (id, is_premium) => {
    try { await axios.post(`/api/admin/users/${id}/premium`, { is_premium }); toast.success('Premium updated'); loadUsers(); } catch {}
  };
  const adjustPoints = async (id) => {
    const points = prompt('Points to add (negative to remove):');
    if (!points) return;
    const num = parseInt(points);
    try {
      await axios.post(`/api/admin/users/${id}/points`, { points: Math.abs(num), action: num >= 0 ? 'add' : 'remove' });
      toast.success('Points updated'); loadUsers();
    } catch {}
  };
  const changeRole = async (id, role) => {
    try { await axios.put(`/api/admin/users/${id}/role`, { role }); toast.success(`Role set to ${role}`); loadUsers(); } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };
  const sendBroadcast = async () => {
    try {
      await axios.post('/api/admin/broadcast', broadcastForm);
      toast.success('Broadcast sent!');
      setBroadcastForm({ title: '', message: '', target: 'all' });
    } catch { toast.error('Failed to broadcast'); }
  };
  const resolveReport = async (id, status) => {
    try { await axios.put(`/api/admin/reports/${id}`, { status }); toast.success('Report updated'); loadReports(); } catch {}
  };

  const TABS = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'users', label: '👥 Users' },
    { id: 'broadcast', label: '📡 Broadcast' },
    { id: 'reports', label: '🚩 Reports' },
    { id: 'audit', label: '📜 Audit Logs' },
  ];

  return (
    <div className="chat-area" style={{ overflowY: 'auto' }}>
      <div style={{ height: 'var(--header-height)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 24 }}>👑</span>
        <div>
          <div style={{ fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>Global Admin Panel</div>
          <div style={{ fontSize: 12, color: '#F7DC6F' }}>Owner: {user?.role === 'superadmin' ? 'Qwin Grace (You)' : `Admin (${user?.display_name})`}</div>
        </div>
      </div>

      <div style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid var(--border)', gap: 4, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.id ? '#F7DC6F' : 'var(--text-secondary)',
            borderBottom: tab === t.id ? '2px solid #F7DC6F' : '2px solid transparent',
            fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap'
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <StatCard icon="👥" label="Total Users" value={stats.total_users} color="var(--qw-primary)" />
              <StatCard icon="🟢" label="Online Now" value={stats.online_now} color="#00D4AA" />
              <StatCard icon="✨" label="New (24h)" value={stats.new_users_24h} />
              <StatCard icon="⭐" label="Premium Users" value={stats.premium_users} color="#F7DC6F" />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <StatCard icon="💬" label="Messages (24h)" value={stats.messages_24h} />
              <StatCard icon="👨‍👩‍👧" label="Total Groups" value={stats.total_groups} />
              <StatCard icon="📢" label="Total Channels" value={stats.total_channels} />
              <StatCard icon="🚫" label="Banned Users" value={stats.banned_users} color="#FF6B6B" />
              <StatCard icon="🚩" label="Pending Reports" value={stats.pending_reports} color="#FDCB6E" />
            </div>

            <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 20, marginTop: 16 }}>
              <h3 style={{ marginBottom: 12 }}>⚡ Quick Actions</h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn-ghost" onClick={() => setTab('users')}>👥 Manage Users</button>
                <button className="btn-ghost" onClick={() => setTab('broadcast')}>📡 Send Broadcast</button>
                <button className="btn-ghost" onClick={() => setTab('reports')}>🚩 Review Reports</button>
                <button className="btn-ghost" onClick={() => setTab('audit')}>📜 View Audit Logs</button>
              </div>
            </div>

            <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 20, marginTop: 16 }}>
              <h3 style={{ marginBottom: 4 }}>🛠️ 60 Administrative Powers Active</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Full platform control granted to Qwin Grace as Global Super Administrator — including ban management, content moderation, broadcasts, role assignment, points/rewards control, analytics, and audit logging.</p>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div>
            <input className="input-field" placeholder="Search users by username/email..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 16, maxWidth: 400 }} />
            <div className="glass" style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    {['User', 'Role', 'Status', 'Points', 'Actions'].map(h => <th key={h} style={{ padding: 12, color: 'var(--text-secondary)' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 600 }}>{u.display_name} {u.is_verified && '✓'} {u.is_premium && '⭐'}</div>
                        <div style={{ color: 'var(--text-muted)' }}>@{u.username}</div>
                      </td>
                      <td style={{ padding: 12 }}>
                        <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} className="input-field" style={{ fontSize: 12, padding: '4px 8px', width: 110 }}>
                          <option value="user">User</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                          {user?.role === 'superadmin' && <option value="superadmin">Super Admin</option>}
                        </select>
                      </td>
                      <td style={{ padding: 12 }}>
                        {u.is_banned ? <span style={{ color: '#FF6B6B' }}>🚫 Banned</span> : u.is_frozen ? <span style={{ color: '#FDCB6E' }}>❄️ Frozen</span> : <span style={{ color: 'var(--qw-primary)' }}>✓ Active</span>}
                      </td>
                      <td style={{ padding: 12 }}>{u.points}</td>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {u.is_banned
                            ? <button onClick={() => unbanUser(u.id)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>Unban</button>
                            : <button onClick={() => banUser(u.id)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11, color: '#FF6B6B' }}>Ban</button>}
                          <button onClick={() => toggleFreeze(u.id, !u.is_frozen)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>{u.is_frozen ? 'Unfreeze' : 'Freeze'}</button>
                          <button onClick={() => toggleVerify(u.id, !u.is_verified)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>{u.is_verified ? 'Unverify' : 'Verify'}</button>
                          <button onClick={() => togglePremium(u.id, !u.is_premium)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>{u.is_premium ? 'Un-premium' : 'Premium'}</button>
                          <button onClick={() => adjustPoints(u.id)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>Points</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'broadcast' && (
          <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 24, maxWidth: 500 }}>
            <h3 style={{ marginBottom: 16 }}>📡 Global Broadcast</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Title</label>
              <input className="input-field" value={broadcastForm.title} onChange={e => setBroadcastForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Message</label>
              <textarea className="input-field" rows={4} value={broadcastForm.message} onChange={e => setBroadcastForm(p => ({ ...p, message: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Target</label>
              <select className="input-field" value={broadcastForm.target} onChange={e => setBroadcastForm(p => ({ ...p, target: e.target.value }))}>
                <option value="all">All Users</option>
                <option value="premium">Premium Users</option>
                <option value="groups">All Groups</option>
                <option value="channels">All Channels</option>
              </select>
            </div>
            <button className="btn-primary" onClick={sendBroadcast}>📡 Send Broadcast</button>
          </div>
        )}

        {tab === 'reports' && (
          <div className="glass" style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {reports.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No reports 🎉</div> : reports.map(r => (
              <div key={r.id} style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{r.reporter_name}</strong> reported <strong>{r.reported_name || 'a message'}</strong>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Reason: {r.reason}</div>
                    {r.details && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{r.details}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-tertiary)' }}>{r.status}</span>
                    {r.status === 'pending' && (
                      <>
                        <button onClick={() => resolveReport(r.id, 'resolved')} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>Resolve</button>
                        <button onClick={() => resolveReport(r.id, 'dismissed')} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>Dismiss</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'audit' && (
          <div className="glass" style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {auditLogs.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs yet</div> : auditLogs.map(log => (
              <div key={log.id} style={{ padding: 12, borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <strong>{log.admin_name}</strong> performed <code style={{ color: 'var(--qw-primary)' }}>{log.action}</code>
                  {log.target_type && <span style={{ color: 'var(--text-muted)' }}> on {log.target_type}</span>}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
