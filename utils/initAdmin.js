// Initialize admin account on startup

const bcrypt = require('bcryptjs');
const { getDatabase } = require('./db');

async function initializeAdmin() {
  try {
    const db = getDatabase();
    const usersCollection = db.collection('users');

    // Check if any users exist
    const userCount = await usersCollection.countDocuments();

    if (userCount === 0) {
      // Hash the admin password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('12345678', salt);

      // Create admin account
      const adminAccount = {
        username: 'kdelosreyes',
        email: 'admin@dojsystem.local',
        passwordHash,
        role: 'admin',
        firstName: 'Admin',
        lastName: 'Account',
        department: 'Justice',
        isActive: true,
        lastLogin: null,
        loginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await usersCollection.insertOne(adminAccount);
      console.log('✓ Admin account initialized (kdelosreyes / 12345678)');
    }
  } catch (error) {
    console.error('Failed to initialize admin account:', error);
  }
}

module.exports = { initializeAdmin };
