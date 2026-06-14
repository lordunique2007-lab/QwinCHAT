import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';

export function LoginPage({ onSwitch }) {
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', form);
      setToken(data.token);
      setUser(data.user);
      toast.success(`Welcome back, ${data.user.display_name}! 👋`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>💬</div>
        <h1 className="gradient-text" style={{ fontSize: 32, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>QwinCHAT</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Sign in to continue</p>
      </div>

      <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 32 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email, Phone, or Username</label>
            <input
              className="input-field"
              type="text"
              placeholder="Enter your identifier"
              value={form.identifier}
              onChange={e => setForm(p => ({ ...p, identifier: e.target.value }))}
              required
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Password</label>
            <input
              className="input-field"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? '⏳ Signing in...' : '🚀 Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button onClick={onSwitch} style={{ background: 'none', border: 'none', color: 'var(--qw-primary)', cursor: 'pointer', fontSize: 14 }}>
            Don't have an account? <strong>Create one</strong>
          </button>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage({ onSwitch }) {
  const [form, setForm] = useState({ username: '', display_name: '', email: '', phone: '', password: '', referral_code: '' });
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/register', form);
      setToken(data.token);
      setUser(data.user);
      toast.success('Welcome to QwinCHAT! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, name, type = 'text', placeholder, required }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{label}{required && ' *'}</label>
      <input className="input-field" type={type} placeholder={placeholder} value={form[name]}
        onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))} required={required} />
    </div>
  );

  return (
    <div style={{ maxWidth: 440, width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>✨</div>
        <h1 className="gradient-text" style={{ fontSize: 32, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>Join QwinCHAT</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Connect with the world</p>
      </div>

      <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 32 }}>
        <form onSubmit={handleSubmit}>
          <Field label="Username" name="username" placeholder="qwinchat_user" required />
          <Field label="Display Name" name="display_name" placeholder="Your Name" />
          <Field label="Email" name="email" type="email" placeholder="you@email.com" />
          <Field label="Phone" name="phone" placeholder="+1234567890" />
          <Field label="Password" name="password" type="password" placeholder="Min. 8 characters" required />
          <Field label="Referral Code (optional)" name="referral_code" placeholder="Enter referral code" />

          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
            {loading ? '⏳ Creating account...' : '🚀 Create Account'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button onClick={onSwitch} style={{ background: 'none', border: 'none', color: 'var(--qw-primary)', cursor: 'pointer', fontSize: 14 }}>
            Already have an account? <strong>Sign in</strong>
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuthPage() {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      {showLogin
        ? <LoginPage onSwitch={() => setShowLogin(false)} />
        : <RegisterPage onSwitch={() => setShowLogin(true)} />
      }
    </div>
  );
}
