require('dotenv').config();
const { initializeDatabase } = require('../utils/db');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  try {
    const db = await initializeDatabase(process.env.MONGODB_URI);
    const hash = await bcrypt.hash('12345678', 12);
    
    const result = await db.collection('users').updateOne(
      { username: 'ADMIN-001' },
      { $set: { password_hash: hash } }
    );
    
    if (result.matchedCount > 0) {
      console.log('Password updated successfully for ADMIN-001');
    } else {
      console.log('User ADMIN-001 not found.');
      // Create it just in case
      await db.collection('users').insertOne({
        username: 'ADMIN-001',
        name: 'System Admin',
        password_hash: hash,
        department: 'DA',
        position: 'District Attorney',
        account_status: 'active',
        admin_role: 'super_admin',
        verified_by: null,
        rejection_reason: null,
        email: null,
        last_login: null,
        login_attempts: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log('Created ADMIN-001 account.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

resetPassword();
