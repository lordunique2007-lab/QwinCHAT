# 💬 QwinCHAT

**A premium, full-stack real-time messaging platform** — created by **Qwin Grace**.

QwinCHAT combines private chats, group chats, channels, stories, voice/video calling (signaling), an AI assistant (QwinAI), a points/referral economy, and a complete global admin panel — all with a custom cyan-green glassmorphism design system.

---

## 🏗️ What's Included

### Backend (`/backend`) — Node.js + Express + Socket.IO + PostgreSQL
- Full REST API (auth, users, messages, groups, channels, stories, admin, AI)
- Real-time messaging via Socket.IO (typing indicators, read receipts, reactions, presence)
- JWT authentication, OTP verification flow
- PostgreSQL schema with 18 tables (migrations included)
- QwinAI powered by the Anthropic Claude API
- Full 60-power Global Admin Panel API (ban, freeze, broadcast, audit logs, etc.)
- Rate limiting, helmet security headers, maintenance mode

### Frontend (`/frontend`) — React + Socket.IO Client
- Cyan-green glassmorphism UI (Dark / Light / AMOLED themes)
- Private chats, groups, channels, stories (24h expiry)
- QwinAI chat & translation panel
- Settings (profile, privacy, rewards/points, security)
- Full Admin Dashboard (stats, user management, broadcasts, reports, audit logs)
- WebRTC call signaling hooks (voice/video)

---

## ⚠️ Honest Scope Note

This is a **working, deployable full-stack MVP** covering the core architecture and most features from your spec (auth, messaging, groups, channels, stories, AI, points/referrals, and the full admin power set). A few advanced items are stubbed or simplified for a first deploy:

- **File uploads** use base64/data URLs by default — wire up the `S3_*` env vars + a real upload endpoint for production-scale media (Cloudflare R2 / AWS S3).
- **Voice/video calls** have working signaling (Socket.IO + WebRTC events) but need a TURN server (e.g. coturn, Twilio STUN/TURN) for reliable cross-network calls.
- **Push notifications** (Firebase) and **SMS OTP** (Twilio) have config slots ready but need your API keys to go live.
- **Secret chats / E2E encryption** has schema support (`is_secret`, `encryption_key`) — wire up client-side encryption (e.g. libsodium) before relying on it for sensitive data.
- **Mobile apps (Flutter)** are not included — this is the web version, but it's fully responsive and installable as a PWA.

Everything else (groups, channels, communities schema, points/referrals, stories, QwinAI, 60-power admin panel, real-time chat) is **fully functional**.

---

## 🚀 Deploy in ~15 Minutes

### Step 1 — Database (Railway or Render)

**Railway:**
1. Create a new Railway project → "Provision PostgreSQL"
2. Copy the `DATABASE_URL` connection string

**Render:** Render's `render.yaml` (in `/backend`) auto-provisions a PostgreSQL database.

### Step 2 — Backend (Railway or Render)

1. Push this repo to GitHub
2. **Railway**: New Project → Deploy from GitHub → select `/backend` as root directory
3. **Render**: New → Web Service → connect repo, root directory `backend`, it'll detect `render.yaml`
4. Set environment variables (copy from `backend/.env.example`):
   - `DATABASE_URL` (from Step 1)
   - `JWT_SECRET` (generate a random 32+ char string)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE` (Qwin Grace's superadmin login)
   - `FRONTEND_URL` (you'll get this in Step 3 — update after)
   - `ANTHROPIC_API_KEY` (for QwinAI — get from console.anthropic.com)
   - `NODE_ENV=production`
5. Deploy. The Dockerfile automatically runs migrations + seeds the superadmin account on startup.
6. Copy your backend URL (e.g. `https://qwinchat-backend.up.railway.app`)

### Step 3 — Frontend (Vercel)

1. Import the repo into Vercel → set root directory to `frontend`
2. Set environment variables:
   - `REACT_APP_API_URL` = your backend URL from Step 2
   - `REACT_APP_SOCKET_URL` = same backend URL
3. Deploy
4. Copy your Vercel URL (e.g. `https://qwinchat.vercel.app`)

### Step 4 — Connect Them

Go back to your backend's environment variables and set:
```
FRONTEND_URL=https://qwinchat.vercel.app
```
Redeploy the backend so CORS allows your frontend domain.

### Step 5 — Login as Qwin Grace

Go to your live frontend URL and log in with:
- **Identifier:** the `ADMIN_EMAIL` you set
- **Password:** the `ADMIN_PASSWORD` you set

You'll see the 👑 admin icon in the sidebar — full Global Admin Panel access.

---

## 🧪 Run Locally

### Backend
```bash
cd backend
cp .env.example .env       # fill in your values (a local Postgres is fine)
npm install
npm run migrate
npm run seed
npm run dev                # starts on :5000
```

### Frontend
```bash
cd frontend
cp .env.example .env
# set REACT_APP_API_URL=http://localhost:5000
# set REACT_APP_SOCKET_URL=http://localhost:5000
npm install
npm start                  # starts on :3000
```

---

## 📁 Project Structure

```
qwinchat/
├── backend/
│   ├── src/
│   │   ├── db/            # migrations + seed (creates Qwin Grace superadmin)
│   │   ├── middleware/     # JWT auth, admin auth
│   │   ├── routes/          # auth, users, messages, groups, channels, stories, admin, ai
│   │   ├── socket.js        # real-time engine
│   │   └── index.js          # server entry
│   ├── Dockerfile
│   ├── railway.json
│   └── render.yaml
└── frontend/
    ├── src/
    │   ├── components/      # Sidebar, ChatWindow, AdminPanel, etc.
    │   ├── pages/            # Auth page
    │   ├── store/             # Zustand global state
    │   ├── styles/            # QwinCHAT design system
    │   └── App.jsx
    └── vercel.json
```

---

## 🎯 Next Steps to Expand

1. **Media uploads**: Add an `/api/upload` endpoint using `multer` + S3-compatible storage (Cloudflare R2 is cheap and S3-compatible)
2. **Push notifications**: Wire Firebase Admin SDK in `backend/src/routes/admin.js` broadcast endpoint
3. **Voice/video**: Add a TURN server (coturn on a small VPS, or Twilio's TURN service) — the signaling is already wired
4. **Mobile**: Build a Flutter or React Native app that talks to the same backend API + Socket.IO
5. **Communities**: The `communities` table exists — add routes/UI to group multiple groups/channels together

---

Built with ❤️ for **Qwin Grace** — Founder, Owner & Global Super Administrator of QwinCHAT.
