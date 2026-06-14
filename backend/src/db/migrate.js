const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      -- USERS
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        username VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255),
        bio TEXT,
        avatar_url TEXT,
        status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online','offline','away','busy')),
        custom_status TEXT,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user','moderator','admin','superadmin')),
        is_verified BOOLEAN DEFAULT false,
        is_premium BOOLEAN DEFAULT false,
        is_banned BOOLEAN DEFAULT false,
        is_frozen BOOLEAN DEFAULT false,
        is_shadow_banned BOOLEAN DEFAULT false,
        ban_reason TEXT,
        ban_expires_at TIMESTAMPTZ,
        points INTEGER DEFAULT 0,
        referral_code VARCHAR(20) UNIQUE,
        referred_by UUID REFERENCES users(id),
        two_factor_enabled BOOLEAN DEFAULT false,
        two_factor_secret TEXT,
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('dark','light','amoled')),
        accent_color VARCHAR(7) DEFAULT '#00D4AA',
        privacy_last_seen VARCHAR(20) DEFAULT 'everyone',
        privacy_profile_photo VARCHAR(20) DEFAULT 'everyone',
        privacy_about VARCHAR(20) DEFAULT 'everyone',
        privacy_groups VARCHAR(20) DEFAULT 'everyone',
        push_token TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- OTP CODES
      CREATE TABLE IF NOT EXISTS otp_codes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        contact VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        type VARCHAR(20) DEFAULT 'phone',
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- SESSIONS
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        device_name VARCHAR(255),
        device_type VARCHAR(50),
        ip_address INET,
        last_active TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- CONVERSATIONS (private chats)
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        participant_a UUID REFERENCES users(id) ON DELETE CASCADE,
        participant_b UUID REFERENCES users(id) ON DELETE CASCADE,
        is_secret BOOLEAN DEFAULT false,
        encryption_key TEXT,
        last_message_id UUID,
        last_message_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(participant_a, participant_b)
      );

      -- GROUPS
      CREATE TABLE IF NOT EXISTS groups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar_url TEXT,
        type VARCHAR(20) DEFAULT 'private' CHECK (type IN ('public','private')),
        invite_link VARCHAR(100) UNIQUE,
        rules TEXT,
        owner_id UUID REFERENCES users(id),
        max_members INTEGER DEFAULT 10,
        slow_mode_seconds INTEGER DEFAULT 0,
        is_announcement_mode BOOLEAN DEFAULT false,
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- GROUP MEMBERS
      CREATE TABLE IF NOT EXISTS group_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member','moderator','admin','owner')),
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        muted_until TIMESTAMPTZ,
        UNIQUE(group_id, user_id)
      );

      -- CHANNELS
      CREATE TABLE IF NOT EXISTS channels (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar_url TEXT,
        type VARCHAR(20) DEFAULT 'public' CHECK (type IN ('public','private')),
        invite_link VARCHAR(100) UNIQUE,
        owner_id UUID REFERENCES users(id),
        subscriber_count INTEGER DEFAULT 0,
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- CHANNEL SUBSCRIBERS
      CREATE TABLE IF NOT EXISTS channel_subscribers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(channel_id, user_id)
      );

      -- COMMUNITIES
      CREATE TABLE IF NOT EXISTS communities (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar_url TEXT,
        owner_id UUID REFERENCES users(id),
        invite_link VARCHAR(100) UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- MESSAGES
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
        channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
        content TEXT,
        type VARCHAR(30) DEFAULT 'text' CHECK (type IN ('text','image','video','audio','voice','gif','document','sticker','poll','contact','location','system')),
        media_url TEXT,
        media_thumbnail TEXT,
        media_size INTEGER,
        media_duration INTEGER,
        reply_to_id UUID REFERENCES messages(id),
        is_edited BOOLEAN DEFAULT false,
        edited_at TIMESTAMPTZ,
        is_deleted_for_all BOOLEAN DEFAULT false,
        is_pinned BOOLEAN DEFAULT false,
        is_starred BOOLEAN DEFAULT false,
        scheduled_at TIMESTAMPTZ,
        auto_delete_at TIMESTAMPTZ,
        forwarded_from UUID REFERENCES messages(id),
        poll_data JSONB,
        location_data JSONB,
        contact_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- MESSAGE READS
      CREATE TABLE IF NOT EXISTS message_reads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(message_id, user_id)
      );

      -- MESSAGE REACTIONS
      CREATE TABLE IF NOT EXISTS message_reactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(message_id, user_id, emoji)
      );

      -- STORIES
      CREATE TABLE IF NOT EXISTS stories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) DEFAULT 'image' CHECK (type IN ('image','video','text','music')),
        content TEXT,
        media_url TEXT,
        background_color VARCHAR(7),
        music_url TEXT,
        expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
        view_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- STORY VIEWS
      CREATE TABLE IF NOT EXISTS story_views (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        viewed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(story_id, user_id)
      );

      -- CONTACTS / FRIENDS
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        contact_id UUID REFERENCES users(id) ON DELETE CASCADE,
        nickname VARCHAR(100),
        is_blocked BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, contact_id)
      );

      -- REPORTS
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        reporter_id UUID REFERENCES users(id),
        reported_user_id UUID REFERENCES users(id),
        reported_message_id UUID REFERENCES messages(id),
        reason VARCHAR(100) NOT NULL,
        details TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','dismissed')),
        resolved_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- REFERRALS
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        referrer_id UUID REFERENCES users(id),
        referred_id UUID REFERENCES users(id),
        points_awarded INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- DAILY REWARDS
      CREATE TABLE IF NOT EXISTS daily_rewards (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        points_awarded INTEGER DEFAULT 2,
        claimed_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- AUDIT LOGS
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id UUID,
        details JSONB,
        ip_address INET,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- NOTIFICATIONS
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        body TEXT,
        data JSONB,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- CALLS
      CREATE TABLE IF NOT EXISTS calls (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        caller_id UUID REFERENCES users(id),
        callee_id UUID REFERENCES users(id),
        group_id UUID REFERENCES groups(id),
        type VARCHAR(20) DEFAULT 'voice' CHECK (type IN ('voice','video','group_voice','group_video')),
        status VARCHAR(20) DEFAULT 'ringing' CHECK (status IN ('ringing','active','ended','missed','rejected')),
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        duration_seconds INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- INDEXES
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, expires_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id, created_at DESC);
    `);

    await client.query('COMMIT');
    console.log('✅ Database migrated successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

migrate().catch(console.error);
