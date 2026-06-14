const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./index');
require('dotenv').config();

async function seed() {
  try {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'QwinGrace@Admin2024!', 12);
    const referralCode = 'QWINGRACE';

    await db.query(`
      INSERT INTO users (
        id, username, display_name, email, phone, password_hash,
        bio, role, is_verified, is_premium, referral_code,
        theme, accent_color
      ) VALUES (
        $1, 'qwingrace', 'Qwin Grace', $2, $3, $4,
        'Founder & Creator of QwinCHAT 👑', 'superadmin', true, true, $5,
        'dark', '#00D4AA'
      ) ON CONFLICT (username) DO UPDATE SET
        role = 'superadmin', is_verified = true, is_premium = true
    `, [uuidv4(), process.env.ADMIN_EMAIL, process.env.ADMIN_PHONE, passwordHash, referralCode]);

    console.log('✅ Seeded: Qwin Grace superadmin account');
    console.log(`   Email: ${process.env.ADMIN_EMAIL}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
