require('dotenv').config();
const { initializeDatabase } = require('./utils/db');

async function check() {
  const db = await initializeDatabase(process.env.MONGODB_URI);
  const user = await db.collection('users').findOne({ username: 'ADMIN-001' });
  console.log(user);
  
  if (user && user.login_attempts >= 5) {
    console.log("Resetting login attempts to 0");
    await db.collection('users').updateOne(
      { username: 'ADMIN-001' },
      { $set: { login_attempts: 0 } }
    );
  }
  process.exit(0);
}
check();
