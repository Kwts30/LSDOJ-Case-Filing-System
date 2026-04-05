// Initialize admin account on startup

const bcrypt = require('bcryptjs');
const { getDatabase } = require('./db');

async function initializeAdmin() {
  try {
    const db = getDatabase();
    const usersCollection = db.collection('users');

    const adminUsername = (process.env.ADMIN_USERNAME || 'kdelosreyes').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || '12345678';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@dojsystem.local';

    // Ensure configured admin account always exists
    const existingAdmin = await usersCollection.findOne({ username: adminUsername });

    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(adminPassword, salt);

      const adminAccount = {
        username: adminUsername,
        email: adminEmail,
        password_hash,
        role: 'admin',
        first_name: 'Admin',
        last_name: 'Account',
        department: 'Justice',
        is_active: true,
        last_login: null,
        login_attempts: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      await usersCollection.insertOne(adminAccount);
      console.log(`✓ Admin account initialized (${adminUsername} / ${adminPassword})`);
    }
  } catch (error) {
    console.error('Failed to initialize admin account:', error);
  }
}

module.exports = { initializeAdmin };
